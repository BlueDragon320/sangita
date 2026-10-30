import unittest
import os
import json
import sqlite3
import uuid
import app as app_mod

class TestBackendFixes(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Safely backup users.json
        cls._users_backup = None
        if os.path.exists(app_mod.USERS_FILE):
            with open(app_mod.USERS_FILE, 'r', encoding='utf-8') as f:
                cls._users_backup = f.read()

        cls.app = app_mod.app
        cls.app.config['TESTING'] = True
        cls.client = cls.app.test_client()

        cls.admin_token = app_mod._make_token('admin')
        cls.user_token = app_mod._make_token('fix_user1')
        cls.admin_headers = {'Authorization': f'Bearer {cls.admin_token}'}
        cls.user_headers = {'Authorization': f'Bearer {cls.user_token}'}

        cls.music_dir = app_mod.MUSIC_DIR
        cls.folder_allowed = os.path.join(cls.music_dir, "AllowedFolder")
        cls.folder_secret = os.path.join(cls.music_dir, "RestrictedFolder")
        cls.folder_artist = os.path.join(cls.music_dir, "ArtistOnlyFolder")
        cls.folder_dup = os.path.join(cls.music_dir, "DupPlaylist")

        for fld in [cls.folder_allowed, cls.folder_secret, cls.folder_artist, cls.folder_dup]:
            os.makedirs(fld, exist_ok=True)

        cls.allowed_song = os.path.join(cls.folder_allowed, "allowed.mp3")
        cls.secret_song = os.path.join(cls.folder_secret, "secret.mp3")
        cls.artist_song = os.path.join(cls.folder_artist, "artist_track.mp3")
        cls.dup_song = os.path.join(cls.folder_dup, "dup_folder_track.mp3")

        for fpath in [cls.allowed_song, cls.secret_song, cls.artist_song, cls.dup_song]:
            if not os.path.exists(fpath):
                with open(fpath, "wb") as f:
                    f.write(b"ID3\x03\x00\x00\x00\x00\x00\x00" + b"\x00" * 200)

        users = app_mod.load_users()
        if 'admin' not in users:
            users['admin'] = {'username': 'admin'}
        users['admin'].update({
            'username': 'admin',
            'role': 'admin',
            'rules': {'allowed_playlists': ['*']}
        })
        users['fix_user1'] = {
            'username': 'fix_user1',
            'role': 'user',
            'rules': {'allowed_playlists': ['AllowedFolder', 'ArtistOnlyFolder', 'DupPlaylist']}
        }
        app_mod.save_users(users)

        conn = app_mod.get_db()
        app_mod.migrate_v2_schema(conn)
        conn.execute("INSERT OR IGNORE INTO source_folders (folder_name, classification) VALUES ('AllowedFolder', 'unclassified')")
        conn.execute("INSERT OR IGNORE INTO source_folders (folder_name, classification) VALUES ('RestrictedFolder', 'unclassified')")
        conn.execute("INSERT OR IGNORE INTO source_folders (folder_name, classification) VALUES ('ArtistOnlyFolder', 'artist')")
        conn.execute("UPDATE source_folders SET classification = 'artist' WHERE folder_name = 'ArtistOnlyFolder'")
        conn.commit()
        conn.close()

    @classmethod
    def tearDownClass(cls):
        # Restore users.json
        if cls._users_backup is not None:
            with open(app_mod.USERS_FILE, 'w', encoding='utf-8') as f:
                f.write(cls._users_backup)
        elif os.path.exists(app_mod.USERS_FILE):
            os.remove(app_mod.USERS_FILE)

        # Clean up test files and directories
        for fpath in [cls.allowed_song, cls.secret_song, cls.artist_song, cls.dup_song]:
            if os.path.exists(fpath):
                try:
                    os.remove(fpath)
                except Exception:
                    pass
        for fld in [cls.folder_allowed, cls.folder_secret, cls.folder_artist, cls.folder_dup]:
            if os.path.isdir(fld):
                try:
                    import shutil
                    shutil.rmtree(fld)
                except Exception:
                    pass

        conn = app_mod.get_db()
        try:
            conn.execute("DELETE FROM source_folders WHERE folder_name IN ('AllowedFolder', 'RestrictedFolder', 'ArtistOnlyFolder', 'DupPlaylist', 'FolderPLTest')")
            conn.commit()
        finally:
            conn.close()

    def test_01_honor_playlist_visibility_and_description_on_creation(self):
        """[P1] /api/user-playlists POST accepts visibility and description, syncs to v2."""
        pl_name = f"PublicVibe_{uuid.uuid4().hex[:6]}"
        res = self.client.post('/api/user-playlists', headers=self.user_headers, json={
            'name': pl_name,
            'description': 'A very cool public playlist',
            'visibility': 'public'
        })
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data.get("status"), "created")
        self.assertEqual(data.get("name"), pl_name)
        self.assertEqual(data.get("visibility"), "public")
        self.assertEqual(data.get("description"), "A very cool public playlist")
        self.assertTrue(bool(data.get("id")))
        pl_id = data["id"]

        # Check DB directly
        conn = app_mod.get_db()
        v2_row = conn.execute("SELECT * FROM playlists WHERE id = ?", (pl_id,)).fetchone()
        self.assertIsNotNone(v2_row)
        self.assertEqual(v2_row["owner"], "fix_user1")
        self.assertEqual(v2_row["title"], pl_name)
        self.assertEqual(v2_row["visibility"], "public")
        self.assertEqual(v2_row["description"], "A very cool public playlist")

        legacy_row = conn.execute("SELECT * FROM user_playlists WHERE username = 'fix_user1' AND name = ?", (pl_name,)).fetchone()
        self.assertIsNotNone(legacy_row)

        # Update via calling POST again with updated visibility and description
        res_update = self.client.post('/api/user-playlists', headers=self.user_headers, json={
            'name': pl_name,
            'description': 'Updated description here',
            'visibility': 'private'
        })
        self.assertEqual(res_update.status_code, 200)
        u_data = res_update.get_json()
        self.assertEqual(u_data.get("visibility"), "private")
        self.assertEqual(u_data.get("description"), "Updated description here")

        v2_updated = conn.execute("SELECT * FROM playlists WHERE id = ?", (pl_id,)).fetchone()
        self.assertEqual(v2_updated["visibility"], "private")
        self.assertEqual(v2_updated["description"], "Updated description here")
        conn.close()

    def test_02_enforce_source_access_on_legacy_playlist_mutations(self):
        """[P1] Reject adding tracks from inaccessible folders (403)."""
        pl_name = f"StrictPl_{uuid.uuid4().hex[:6]}"
        self.client.post('/api/user-playlists', headers=self.user_headers, json={'name': pl_name})

        # 1. POST /api/user-playlists/<name>/tracks with inaccessible track -> 403
        res_denied = self.client.post(f'/api/user-playlists/{pl_name}/tracks', headers=self.user_headers, json={
            'track_path': 'RestrictedFolder/secret.mp3'
        })
        self.assertEqual(res_denied.status_code, 403)
        self.assertIn("Access denied", res_denied.get_json().get("error", ""))

        # 2. POST /api/user-playlists/<name>/tracks with accessible track -> 200
        res_ok = self.client.post(f'/api/user-playlists/{pl_name}/tracks', headers=self.user_headers, json={
            'track_path': 'AllowedFolder/allowed.mp3'
        })
        self.assertEqual(res_ok.status_code, 200)

        # 3. PUT /api/user-playlists/<name> with invalid / inaccessible track -> 403
        res_put_denied = self.client.put(f'/api/user-playlists/{pl_name}', headers=self.user_headers, json={
            'tracks': ['AllowedFolder/allowed.mp3', 'RestrictedFolder/secret.mp3']
        })
        self.assertEqual(res_put_denied.status_code, 403)

        # 4. PUT /api/user-playlists/<name> with accessible tracks only -> 200
        res_put_ok = self.client.put(f'/api/user-playlists/{pl_name}', headers=self.user_headers, json={
            'tracks': ['AllowedFolder/allowed.mp3']
        })
        self.assertEqual(res_put_ok.status_code, 200)

    def test_03_delete_both_playlist_representations_admin(self):
        """[P1] /api/admin/library/playlists/<id> deletes integer, UUID, and folder playlists across v1 and v2."""
        # A. Integer id deletion
        pl_name_a = f"DelTestInt_{uuid.uuid4().hex[:6]}"
        c_res = self.client.post('/api/user-playlists', headers=self.user_headers, json={'name': pl_name_a})
        self.assertEqual(c_res.status_code, 200)
        self.client.post(f'/api/user-playlists/{pl_name_a}/tracks', headers=self.user_headers, json={'track_path': 'AllowedFolder/allowed.mp3'})

        conn = app_mod.get_db()
        legacy_row = conn.execute("SELECT id FROM user_playlists WHERE username = 'fix_user1' AND name = ?", (pl_name_a,)).fetchone()
        int_id = legacy_row["id"]
        v2_row = conn.execute("SELECT id FROM playlists WHERE owner = 'fix_user1' AND title = ?", (pl_name_a,)).fetchone()
        v2_id = v2_row["id"]
        conn.close()

        # Delete by integer id
        del_int_res = self.client.delete(f'/api/admin/library/playlists/{int_id}', headers=self.admin_headers)
        self.assertEqual(del_int_res.status_code, 200)

        conn = app_mod.get_db()
        self.assertIsNone(conn.execute("SELECT * FROM user_playlists WHERE id = ?", (int_id,)).fetchone())
        self.assertIsNone(conn.execute("SELECT * FROM playlists WHERE id = ?", (v2_id,)).fetchone())
        self.assertEqual(len(conn.execute("SELECT * FROM playlist_tracks WHERE username = 'fix_user1' AND playlist_name = ?", (pl_name_a,)).fetchall()), 0)
        self.assertEqual(len(conn.execute("SELECT * FROM playlist_tracks_v2 WHERE playlist_id = ?", (v2_id,)).fetchall()), 0)
        conn.close()

        # B. UUID deletion
        pl_name_b = f"DelTestUUID_{uuid.uuid4().hex[:6]}"
        c_res2 = self.client.post('/api/user-playlists', headers=self.user_headers, json={'name': pl_name_b})
        uuid_id = c_res2.get_json()["id"]

        del_uuid_res = self.client.delete(f'/api/admin/library/playlists/{uuid_id}', headers=self.admin_headers)
        self.assertEqual(del_uuid_res.status_code, 200)

        conn = app_mod.get_db()
        self.assertIsNone(conn.execute("SELECT * FROM playlists WHERE id = ?", (uuid_id,)).fetchone())
        self.assertIsNone(conn.execute("SELECT * FROM user_playlists WHERE username = 'fix_user1' AND name = ?", (pl_name_b,)).fetchone())
        conn.close()

        # C. Folder playlist deletion
        conn = app_mod.get_db()
        conn.execute("INSERT OR REPLACE INTO source_folders (folder_name, classification) VALUES ('FolderPLTest', 'playlist')")
        fpl_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, "sangita:source_folder:FolderPLTest"))
        conn.execute("INSERT OR REPLACE INTO playlists (id, owner, title, visibility, is_folder_playlist) VALUES (?, 'system', 'FolderPLTest', 'public', 1)", (fpl_id,))
        conn.commit()
        conn.close()

        del_folder_res = self.client.delete('/api/admin/library/playlists/folder:FolderPLTest', headers=self.admin_headers)
        self.assertEqual(del_folder_res.status_code, 200)

        conn = app_mod.get_db()
        sf_row = conn.execute("SELECT classification FROM source_folders WHERE folder_name = 'FolderPLTest'").fetchone()
        self.assertEqual(sf_row["classification"], "unclassified")
        self.assertIsNone(conn.execute("SELECT * FROM playlists WHERE id = ?", (fpl_id,)).fetchone())
        conn.close()

    def test_04_playlists_classification_and_personal_precedence(self):
        """[P2] /api/playlists ignores 'artist' folders and prioritizes personal playlists over same-named folders."""
        # 1. Verify ArtistOnlyFolder is NOT present in /api/playlists
        res = self.client.get('/api/playlists', headers=self.user_headers)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertNotIn("ArtistOnlyFolder", data, "Artist folder must not be returned in /api/playlists")

        # 2. Personal playlist precedence over physical folder name
        # Create personal playlist named 'DupPlaylist' containing 'AllowedFolder/allowed.mp3'
        self.client.post('/api/user-playlists', headers=self.user_headers, json={'name': 'DupPlaylist'})
        self.client.post('/api/user-playlists/DupPlaylist/tracks', headers=self.user_headers, json={'track_path': 'AllowedFolder/allowed.mp3'})

        res_dup = self.client.get('/api/playlists', headers=self.user_headers)
        dup_data = res_dup.get_json()
        self.assertIn("DupPlaylist", dup_data)
        # Should contain personal track 'AllowedFolder/allowed.mp3', NOT physical folder track 'DupPlaylist/dup_folder_track.mp3'
        self.assertEqual(dup_data["DupPlaylist"], ['AllowedFolder/allowed.mp3'])

if __name__ == '__main__':
    unittest.main()
