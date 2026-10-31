import unittest
import os
import sqlite3
import uuid
import app as app_mod

class TestLibraryV2(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls._users_backup = None
        if os.path.exists(app_mod.USERS_FILE):
            with open(app_mod.USERS_FILE, 'r', encoding='utf-8') as f:
                cls._users_backup = f.read()

        cls.app = app_mod.app
        cls.app.config['TESTING'] = True
        cls.client = cls.app.test_client()

        # Auth tokens
        cls.admin_token = app_mod._make_token('admin')
        cls.user1_token = app_mod._make_token('lib_user1')
        cls.user2_token = app_mod._make_token('lib_user2')

        cls.admin_headers = {'Authorization': f'Bearer {cls.admin_token}'}
        cls.user1_headers = {'Authorization': f'Bearer {cls.user1_token}'}
        cls.user2_headers = {'Authorization': f'Bearer {cls.user2_token}'}

        # Directories and test songs
        cls.music_dir = app_mod.MUSIC_DIR
        cls.rock_dir = os.path.join(cls.music_dir, "RockFolder")
        cls.jazz_dir = os.path.join(cls.music_dir, "JazzFolder")
        cls.secret_dir = os.path.join(cls.music_dir, "SecretFolder")
        os.makedirs(cls.rock_dir, exist_ok=True)
        os.makedirs(cls.jazz_dir, exist_ok=True)
        os.makedirs(cls.secret_dir, exist_ok=True)

        for folder, fname in [
            (cls.rock_dir, "rock_anthem.mp3"),
            (cls.rock_dir, "rock_ballad.mp3"),
            (cls.jazz_dir, "jazz_smooth.mp3"),
            (cls.secret_dir, "secret_classified.mp3")
        ]:
            fpath = os.path.join(folder, fname)
            if not os.path.exists(fpath):
                with open(fpath, "wb") as f:
                    f.write(b"ID3\x03\x00\x00\x00\x00\x00\x00" + b"\x00" * 300)

        # Users configuration:
        # lib_user1: access to RockFolder and JazzFolder
        # lib_user2: access only to RockFolder
        users = app_mod.load_users()
        users['admin'] = {'username': 'admin', 'role': 'admin', 'rules': {'allowed_playlists': ['*']}}
        users['lib_user1'] = {'username': 'lib_user1', 'role': 'user', 'rules': {'allowed_playlists': ['RockFolder', 'JazzFolder']}}
        users['lib_user2'] = {'username': 'lib_user2', 'role': 'user', 'rules': {'allowed_playlists': ['RockFolder']}}
        app_mod.save_users(users)

        app_mod.init_db()

    @classmethod
    def tearDownClass(cls):
        if cls._users_backup is not None:
            with open(app_mod.USERS_FILE, 'w', encoding='utf-8') as f:
                f.write(cls._users_backup)

    def test_01_db_tables_and_indices_exist(self):
        """Verify user_saved_artists and user_saved_tracks tables and indices exist."""
        conn = app_mod.get_db()
        try:
            tables = [r["name"] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
            self.assertIn("user_saved_artists", tables)
            self.assertIn("user_saved_tracks", tables)

            # Check indices
            indices = [r["name"] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='index'").fetchall()]
            self.assertIn("idx_user_saved_artists_user", indices)
            self.assertIn("idx_user_saved_tracks_user", indices)
        finally:
            conn.close()

    def test_02_favorites_auto_seeding_into_saved_tracks(self):
        """Legacy favorites are seeded into user_saved_tracks."""
        conn = app_mod.get_db()
        try:
            conn.execute("""
                INSERT OR IGNORE INTO playlist_tracks (username, playlist_name, track_path)
                VALUES ('seed_test_user', 'Favorites', 'RockFolder/rock_anthem.mp3')
            """)
            conn.execute("DELETE FROM library_migrations WHERE name = 'favorites_to_saved_tracks_v1'")
            conn.commit()

            # Trigger migration
            app_mod.migrate_v2_schema(conn)

            row = conn.execute(
                "SELECT * FROM user_saved_tracks WHERE username = 'seed_test_user' AND track_path = 'RockFolder/rock_anthem.mp3'"
            ).fetchone()
            self.assertIsNotNone(row, "Favorites must be seeded into user_saved_tracks")
            conn.execute("DELETE FROM user_saved_tracks WHERE username = 'seed_test_user'")
            conn.commit()
            app_mod.migrate_v2_schema(conn)
            row = conn.execute("SELECT 1 FROM user_saved_tracks WHERE username = 'seed_test_user'").fetchone()
            self.assertIsNone(row, "Migration must not restore a song removed later")
        finally:
            conn.close()

    def test_03_v2_get_playlists_library_and_discover_mode(self):
        """
        In library mode (default), returns ONLY owned and saved playlists (no unsaved folder playlists).
        In discover mode, returns folder playlists and other users' public playlists.
        """
        # Ensure a folder playlist exists
        conn = app_mod.get_db()
        try:
            conn.execute("""
                INSERT OR REPLACE INTO source_folders (folder_name, name, display_name, classification)
                VALUES ('JazzFolder', 'JazzFolder', 'Jazz Vibes', 'playlist')
            """)
            conn.commit()
        finally:
            conn.close()

        # Trigger sync by calling GET /api/v2/playlists
        self.client.get('/api/v2/playlists', headers=self.admin_headers)

        # lib_user1 starts with no owned or saved playlists
        lib_res = self.client.get('/api/v2/playlists', headers=self.user1_headers)
        self.assertEqual(lib_res.status_code, 200)
        lib_pls = lib_res.get_json()['playlists']
        # Folder playlist must NOT appear in library mode if not saved
        self.assertFalse(any(p.get('is_folder_playlist') and not p.get('is_saved') for p in lib_pls),
                         "Unsaved folder playlist must NOT appear in library mode")

        # In discover mode, folder playlist MUST appear
        disc_res = self.client.get('/api/v2/playlists?discover=true', headers=self.user1_headers)
        self.assertEqual(disc_res.status_code, 200)
        disc_pls = disc_res.get_json()['playlists']
        folder_pl = next((p for p in disc_pls if p.get('is_folder_playlist')), None)
        self.assertIsNotNone(folder_pl, "Folder playlist must appear in discover mode")

        # Now save folder playlist to personal library
        save_res = self.client.post(f"/api/v2/playlists/{folder_pl['id']}/save", headers=self.user1_headers)
        self.assertEqual(save_res.status_code, 200)

        # Now it MUST appear in library mode with is_saved = True
        lib_res_saved = self.client.get('/api/v2/playlists', headers=self.user1_headers)
        self.assertEqual(lib_res_saved.status_code, 200)
        saved_folder_pl = next((p for p in lib_res_saved.get_json()['playlists'] if p['id'] == folder_pl['id']), None)
        self.assertIsNotNone(saved_folder_pl, "Saved folder playlist must now appear in library mode")
        self.assertTrue(saved_folder_pl['is_saved'])

        # Unsave folder playlist
        unsave_res = self.client.delete(f"/api/v2/playlists/{folder_pl['id']}/save", headers=self.user1_headers)
        self.assertEqual(unsave_res.status_code, 200)

    def test_04_artist_library_lifecycle(self):
        """
        Test GET /api/v2/artists (with is_saved), POST /api/v2/artists/<id>/save,
        DELETE /api/v2/artists/<id>/save, and GET /api/v2/library/artists.
        """
        # Create an artist
        artist_name = f"Artist_{uuid.uuid4().hex[:6]}"
        create_res = self.client.post('/api/v2/artists', headers=self.admin_headers, json={
            'name': artist_name,
            'bio': 'Legendary artist'
        })
        self.assertEqual(create_res.status_code, 201)
        art_id = create_res.get_json()['id']

        # Map RockFolder to this artist
        conn = app_mod.get_db()
        try:
            conn.execute("""
                UPDATE source_folders
                SET classification = 'artist', mapped_artist_id = ?, mapped_artist_name = ?, display_name = ?
                WHERE folder_name = 'RockFolder'
            """, (art_id, artist_name, artist_name))
            conn.commit()
        finally:
            conn.close()

        # 1. GET /api/v2/artists shows is_saved = False initially
        list_res = self.client.get('/api/v2/artists', headers=self.user1_headers)
        self.assertEqual(list_res.status_code, 200)
        art_entry = next((a for a in list_res.get_json()['artists'] if a['id'] == art_id), None)
        self.assertIsNotNone(art_entry)
        self.assertFalse(art_entry['is_saved'])

        # 2. GET /api/v2/library/artists does NOT include this artist yet
        lib_art_res = self.client.get('/api/v2/library/artists', headers=self.user1_headers)
        self.assertEqual(lib_art_res.status_code, 200)
        self.assertFalse(any(a['id'] == art_id for a in lib_art_res.get_json()['artists']))

        # 3. POST /api/v2/artists/<id>/save saves artist
        save_res = self.client.post(f'/api/v2/artists/{art_id}/save', headers=self.user1_headers)
        self.assertEqual(save_res.status_code, 200)
        self.assertEqual(save_res.get_json(), {"status": "saved", "artist_id": art_id})

        # 4. Now GET /api/v2/library/artists includes artist with is_saved = True
        lib_art_res_after = self.client.get('/api/v2/library/artists', headers=self.user1_headers)
        self.assertEqual(lib_art_res_after.status_code, 200)
        saved_art = next((a for a in lib_art_res_after.get_json()['artists'] if a['id'] == art_id), None)
        self.assertIsNotNone(saved_art)
        self.assertTrue(saved_art['is_saved'])
        self.assertGreaterEqual(saved_art['track_count'], 1)

        # 5. GET /api/v2/artists now has is_saved = True
        list_res_after = self.client.get('/api/v2/artists', headers=self.user1_headers)
        art_entry_after = next((a for a in list_res_after.get_json()['artists'] if a['id'] == art_id), None)
        self.assertTrue(art_entry_after['is_saved'])

        # 6. DELETE /api/v2/artists/<id>/save removes artist
        del_res = self.client.delete(f'/api/v2/artists/{art_id}/save', headers=self.user1_headers)
        self.assertEqual(del_res.status_code, 200)
        self.assertEqual(del_res.get_json(), {"status": "removed", "artist_id": art_id})

        # 7. Safe repeat delete (idempotent)
        del_res_repeat = self.client.delete(f'/api/v2/artists/{art_id}/save', headers=self.user1_headers)
        self.assertEqual(del_res_repeat.status_code, 200)

        # 8. Library artists no longer contains artist
        lib_art_res_del = self.client.get('/api/v2/library/artists', headers=self.user1_headers)
        self.assertFalse(any(a['id'] == art_id for a in lib_art_res_del.get_json()['artists']))

    def test_05_track_library_lifecycle_and_access_validation(self):
        """
        Test GET /api/v2/library/tracks, POST /api/v2/library/tracks, and DELETE /api/v2/library/tracks.
        Enforces user_can_access_track, idempotency, and is_favorite metadata.
        """
        track_accessible = "RockFolder/rock_anthem.mp3"
        track_forbidden = "SecretFolder/secret_classified.mp3"

        # 1. lib_user2 cannot save forbidden track
        res_forbid = self.client.post('/api/v2/library/tracks', headers=self.user2_headers, json={
            'track_path': track_forbidden
        })
        self.assertEqual(res_forbid.status_code, 403)

        # 2. lib_user2 saves accessible track with is_favorite = True
        res_save = self.client.post('/api/v2/library/tracks', headers=self.user2_headers, json={
            'track_path': track_accessible,
            'is_favorite': True
        })
        self.assertEqual(res_save.status_code, 200)
        self.assertEqual(res_save.get_json()['status'], 'saved')
        self.assertTrue(res_save.get_json()['is_favorite'])

        # 3. Idempotent repeat save
        res_repeat = self.client.post('/api/v2/library/tracks', headers=self.user2_headers, json={
            'track_path': track_accessible
        })
        self.assertEqual(res_repeat.status_code, 200)

        # 4. GET /api/v2/library/tracks returns saved track with metadata
        res_list = self.client.get('/api/v2/library/tracks', headers=self.user2_headers)
        self.assertEqual(res_list.status_code, 200)
        tracks = res_list.get_json()['tracks']
        found = next((t for t in tracks if t['track_path'] == track_accessible), None)
        self.assertIsNotNone(found)
        self.assertTrue(found['is_favorite'])
        self.assertIn('title', found)
        self.assertIn('artist', found)

        # 5. DELETE /api/v2/library/tracks via JSON body
        res_del_body = self.client.delete('/api/v2/library/tracks', headers=self.user2_headers, json={
            'track_path': track_accessible
        })
        self.assertEqual(res_del_body.status_code, 200)
        self.assertEqual(res_del_body.get_json()['status'], 'removed')

        # 6. Safe repeat delete via query param
        res_del_query = self.client.delete(f'/api/v2/library/tracks?track_path={track_accessible}', headers=self.user2_headers)
        self.assertEqual(res_del_query.status_code, 200)
        self.assertEqual(res_del_query.get_json()['status'], 'removed')

        # 7. Library is now empty of that track
        res_list_after = self.client.get('/api/v2/library/tracks', headers=self.user2_headers)
        self.assertFalse(any(t['track_path'] == track_accessible for t in res_list_after.get_json()['tracks']))

    def test_06_track_metadata_decoupling_and_legacy_playlists(self):
        """
        Verify /api/track-metadata returns metadata for accessible catalog songs even if
        personal library is empty, and /api/playlists backwards compatibility is preserved.
        """
        # User 1 has access to RockFolder and JazzFolder
        res_meta = self.client.get('/api/track-metadata', headers=self.user1_headers)
        self.assertEqual(res_meta.status_code, 200)
        meta = res_meta.get_json()
        self.assertIsInstance(meta, dict)
        self.assertIn("RockFolder/rock_anthem.mp3", meta)
        # Forbidden track must NOT be present
        self.assertNotIn("SecretFolder/secret_classified.mp3", meta)

        # /api/playlists legacy backwards compatibility
        res_pl = self.client.get('/api/playlists', headers=self.user1_headers)
        self.assertEqual(res_pl.status_code, 200)
        pl_dict = res_pl.get_json()
        self.assertIsInstance(pl_dict, dict)
        self.assertIn("Favorites", pl_dict)

    def test_07_saved_items_require_access_and_existing_audio(self):
        name = f"Restricted_{uuid.uuid4().hex[:6]}"
        response = self.client.post('/api/v2/artists', headers=self.admin_headers, json={'name': name})
        artist_id = response.get_json()['id']
        conn = app_mod.get_db()
        try:
            conn.execute("INSERT OR REPLACE INTO source_folders (folder_name, name, display_name, classification, mapped_artist_id) VALUES ('SecretFolder', 'SecretFolder', ?, 'artist', ?)", (name, artist_id))
            conn.commit()
        finally:
            conn.close()
        response = self.client.post(f'/api/v2/artists/{artist_id}/save', headers=self.user2_headers)
        self.assertEqual(response.status_code, 404)
        response = self.client.post('/api/v2/library/tracks', headers=self.user2_headers, json={'track_path': 'RockFolder/missing.mp3'})
        self.assertEqual(response.status_code, 404)

if __name__ == '__main__':
    unittest.main()
