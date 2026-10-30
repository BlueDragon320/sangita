import unittest
import json
import os
import sqlite3
import uuid
import app as app_mod

class TestV2APIsComprehensive(unittest.TestCase):
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
        cls.user1_token = app_mod._make_token('v2_user1')
        cls.user2_token = app_mod._make_token('v2_user2')

        cls.admin_headers = {'Authorization': f'Bearer {cls.admin_token}'}
        cls.user1_headers = {'Authorization': f'Bearer {cls.user1_token}'}
        cls.user2_headers = {'Authorization': f'Bearer {cls.user2_token}'}

        # Setup test folders and songs in MUSIC_DIR
        cls.music_dir = app_mod.MUSIC_DIR
        cls.folder_rock = os.path.join(cls.music_dir, "RockFolder")
        cls.folder_jazz = os.path.join(cls.music_dir, "JazzFolder")
        cls.folder_secret = os.path.join(cls.music_dir, "SecretFolder")
        os.makedirs(cls.folder_rock, exist_ok=True)
        os.makedirs(cls.folder_jazz, exist_ok=True)
        os.makedirs(cls.folder_secret, exist_ok=True)

        cls.rock_song = os.path.join(cls.folder_rock, "rock_anthem.mp3")
        cls.jazz_song = os.path.join(cls.folder_jazz, "jazz_smooth.mp3")
        cls.secret_song = os.path.join(cls.folder_secret, "secret_classified.mp3")
        cls.secret_lrc = os.path.join(cls.folder_secret, "secret_classified.lrc")

        for fpath in [cls.rock_song, cls.jazz_song, cls.secret_song]:
            if not os.path.exists(fpath):
                with open(fpath, "wb") as f:
                    f.write(b"ID3\x03\x00\x00\x00\x00\x00\x00" + b"\x00" * 300)

        with open(cls.secret_lrc, "w", encoding="utf-8") as f:
            f.write("[00:01.00]Top secret lyrics line")

        # Configure users:
        # user1: access to RockFolder and JazzFolder
        # user2: access only to RockFolder
        users = app_mod.load_users()
        users['admin'] = {
            'username': 'admin',
            'role': 'admin',
            'rules': {'allowed_playlists': ['*']}
        }
        users['v2_user1'] = {
            'username': 'v2_user1',
            'role': 'user',
            'rules': {'allowed_playlists': ['RockFolder', 'JazzFolder']}
        }
        users['v2_user2'] = {
            'username': 'v2_user2',
            'role': 'user',
            'rules': {'allowed_playlists': ['RockFolder']}
        }
        app_mod.save_users(users)

        # Ensure DB is migrated
        app_mod.init_db()

    @classmethod
    def tearDownClass(cls):
        # Restore users.json
        if cls._users_backup is not None:
            with open(app_mod.USERS_FILE, 'w', encoding='utf-8') as f:
                f.write(cls._users_backup)
        elif os.path.exists(app_mod.USERS_FILE):
            os.remove(app_mod.USERS_FILE)

        # Clean up test audio files and lrc files in MUSIC_DIR
        for fpath in [cls.rock_song, cls.jazz_song, cls.secret_song, cls.secret_lrc]:
            if os.path.exists(fpath):
                try:
                    os.remove(fpath)
                except Exception:
                    pass
        for dirpath in [cls.folder_rock, cls.folder_jazz, cls.folder_secret]:
            if os.path.isdir(dirpath):
                try:
                    import shutil
                    shutil.rmtree(dirpath)
                except Exception:
                    pass

        conn = app_mod.get_db()
        try:
            conn.execute("DELETE FROM source_folders WHERE folder_name IN ('RockFolder', 'JazzFolder', 'SecretFolder')")
            conn.commit()
        finally:
            conn.close()

    def test_01_schema_migration_verification(self):
        """Verify tables and columns in both primary and secondary SQLite databases."""
        for db_path in [app_mod.STATS_DB, os.path.join(os.path.dirname(os.path.abspath(app_mod.__file__)), "data", "stats.db")]:
            if os.path.exists(db_path):
                conn = sqlite3.connect(db_path)
                conn.row_factory = sqlite3.Row
                tables = [r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
                for t in ["source_folders", "artists", "playlists", "playlist_tracks_v2"]:
                    self.assertIn(t, tables, f"Table {t} should exist in {db_path}")

                # Verify playlists columns
                pl_cols = [r["name"] for r in conn.execute("PRAGMA table_info(playlists)").fetchall()]
                for c in ["id", "owner", "title", "description", "visibility", "is_folder_playlist"]:
                    self.assertIn(c, pl_cols, f"Column {c} missing in playlists table in {db_path}")

                conn.close()

    def test_02_catalog_sources_listing_and_access_indicator(self):
        """GET /api/v2/catalog/sources returns classification, track count, and access indicator without leaking counts."""
        res1 = self.client.get('/api/v2/catalog/sources', headers=self.user1_headers)
        self.assertEqual(res1.status_code, 200)
        data1 = res1.get_json()["sources"]

        rock1 = next((s for s in data1 if s["name"] == "RockFolder"), None)
        jazz1 = next((s for s in data1 if s["name"] == "JazzFolder"), None)
        sec1 = next((s for s in data1 if s["name"] == "SecretFolder"), None)

        self.assertTrue(rock1["has_access"])
        self.assertTrue(jazz1["has_access"])
        self.assertFalse(sec1["has_access"])
        self.assertEqual(sec1["track_count"], 0, "Restricted source must not leak track count")

        # user2 has no access to JazzFolder or SecretFolder
        res2 = self.client.get('/api/v2/catalog/sources', headers=self.user2_headers)
        self.assertEqual(res2.status_code, 200)
        data2 = res2.get_json()["sources"]
        jazz2 = next((s for s in data2 if s["name"] == "JazzFolder"), None)
        self.assertFalse(jazz2["has_access"])
        self.assertEqual(jazz2["track_count"], 0, "User lacking access should see 0 track count")

    def test_03_artists_listing_and_detail(self):
        """GET /api/v2/artists and GET /api/v2/artists/<id> respects source access."""
        art_name = f"Rockstar_{uuid.uuid4().hex[:6]}"
        create_res = self.client.post('/api/v2/artists', headers=self.admin_headers, json={'name': art_name, 'bio': 'Rock legend'})
        self.assertEqual(create_res.status_code, 201)
        art_id = create_res.get_json()["id"]

        # Map RockFolder to this artist
        conn = app_mod.get_db()
        conn.execute("UPDATE source_folders SET classification = 'artist', mapped_artist_id = ?, mapped_artist_name = ?, display_name = ? WHERE folder_name = 'RockFolder'", (art_id, art_name, art_name))
        conn.commit()

        # Both user1 and user2 have access to RockFolder -> artist is visible
        res = self.client.get('/api/v2/artists', headers=self.user2_headers)
        self.assertEqual(res.status_code, 200)
        artists = res.get_json()["artists"]
        found = next((a for a in artists if a["name"] == art_name), None)
        self.assertIsNotNone(found)
        self.assertGreaterEqual(found["track_count"], 1)

        # Get artist detail
        detail_res = self.client.get(f'/api/v2/artists/{art_id}', headers=self.user2_headers)
        self.assertEqual(detail_res.status_code, 200)
        detail = detail_res.get_json()
        self.assertEqual(detail["name"], art_name)
        self.assertGreaterEqual(len(detail["tracks"]), 1)

    def test_04_playlists_lifecycle_visibility_and_zero_leakage(self):
        """Test full playlist CRUD, private vs public, track order, and track masking."""
        # 1. user1 creates a private playlist
        c_res = self.client.post('/api/v2/playlists', headers=self.user1_headers, json={
            'title': 'User1 Private Chill',
            'description': 'For my ears only',
            'visibility': 'private'
        })
        self.assertEqual(c_res.status_code, 201)
        priv_id = c_res.get_json()["id"]

        # 2. user2 requests private playlist -> 404 Not Found
        res_priv_u2 = self.client.get(f'/api/v2/playlists/{priv_id}', headers=self.user2_headers)
        self.assertEqual(res_priv_u2.status_code, 404, "Private playlist must return 404 to non-owner non-admin")

        # 3. user1 creates a public playlist
        pub_res = self.client.post('/api/v2/playlists', headers=self.user1_headers, json={
            'title': 'User1 Public Mix',
            'description': 'Share with world',
            'visibility': 'public'
        })
        self.assertEqual(pub_res.status_code, 201)
        pub_id = pub_res.get_json()["id"]

        # Add accessible track (RockFolder) and restricted track for user2 (JazzFolder)
        add_trk1 = self.client.post(f'/api/v2/playlists/{pub_id}/tracks', headers=self.user1_headers, json={'track_path': 'RockFolder/rock_anthem.mp3'})
        self.assertEqual(add_trk1.status_code, 201)

        add_trk2 = self.client.post(f'/api/v2/playlists/{pub_id}/tracks', headers=self.user1_headers, json={'track_path': 'JazzFolder/jazz_smooth.mp3'})
        self.assertEqual(add_trk2.status_code, 201)

        # 4. user2 views public playlist:
        # Should see rock_anthem.mp3, but jazz_smooth.mp3 should be omitted with unavailable_count = 1
        u2_view = self.client.get(f'/api/v2/playlists/{pub_id}', headers=self.user2_headers)
        self.assertEqual(u2_view.status_code, 200)
        u2_data = u2_view.get_json()

        self.assertEqual(len(u2_data["tracks"]), 1)
        self.assertEqual(u2_data["tracks"][0]["track_path"], "RockFolder/rock_anthem.mp3")
        self.assertEqual(u2_data["unavailable_count"], 1)

        # ZERO DATA LEAKAGE: ensure no restricted paths or names in raw text
        raw_text = u2_view.get_data(as_text=True)
        self.assertNotIn("jazz_smooth", raw_text)
        self.assertNotIn("JazzFolder", raw_text)

        # 5. Track reordering via PUT
        reorder_res = self.client.put(f'/api/v2/playlists/{pub_id}', headers=self.user1_headers, json={
            'title': 'User1 Public Mix Updated',
            'tracks': ['JazzFolder/jazz_smooth.mp3', 'RockFolder/rock_anthem.mp3']
        })
        self.assertEqual(reorder_res.status_code, 200)

        # 6. Delete track from playlist
        del_trk_res = self.client.delete(f'/api/v2/playlists/{pub_id}/tracks', headers=self.user1_headers, json={'track_path': 'RockFolder/rock_anthem.mp3'})
        self.assertEqual(del_trk_res.status_code, 200)

        # 7. Delete playlist
        del_pl = self.client.delete(f'/api/v2/playlists/{pub_id}', headers=self.user1_headers)
        self.assertEqual(del_pl.status_code, 200)

        # Confirm 404
        self.assertEqual(self.client.get(f'/api/v2/playlists/{pub_id}', headers=self.user1_headers).status_code, 404)

    def test_05_strict_source_enforcement_on_stream_download_cover_lyrics(self):
        """Verify strict allowed_playlists enforcement on stream, download, cover, and lyrics."""
        # Stream:
        # user2 allowed RockFolder -> 200/206
        self.assertIn(self.client.get('/api/stream/RockFolder/rock_anthem.mp3', headers=self.user2_headers).status_code, (200, 206))
        # user2 denied SecretFolder -> 403
        self.assertEqual(self.client.get('/api/stream/SecretFolder/secret_classified.mp3', headers=self.user2_headers).status_code, 403)

        # Download:
        # user2 allowed RockFolder -> 200
        self.assertEqual(self.client.get('/api/download/RockFolder/rock_anthem.mp3', headers=self.user2_headers).status_code, 200)
        # user2 denied SecretFolder -> 403
        self.assertEqual(self.client.get('/api/download/SecretFolder/secret_classified.mp3', headers=self.user2_headers).status_code, 403)

        # Lyrics:
        # user2 denied SecretFolder lyrics -> 403
        self.assertEqual(self.client.get('/api/lyrics/SecretFolder/secret_classified.mp3', headers=self.user2_headers).status_code, 403)
        # user1 denied SecretFolder lyrics -> 403
        self.assertEqual(self.client.get('/api/lyrics/SecretFolder/secret_classified.mp3', headers=self.user1_headers).status_code, 403)
        # admin allowed SecretFolder lyrics -> 200
        admin_lyrics_res = self.client.get('/api/lyrics/SecretFolder/secret_classified.mp3', headers=self.admin_headers)
        self.assertEqual(admin_lyrics_res.status_code, 200)
        self.assertTrue(admin_lyrics_res.get_json()["has_lyrics"])

        # Cover:
        # user2 denied SecretFolder cover -> 403
        self.assertEqual(self.client.get('/api/cover/SecretFolder/secret_classified.mp3', headers=self.user2_headers).status_code, 403)
        self.assertEqual(self.client.get('/api/cover/SecretFolder', headers=self.user2_headers).status_code, 403)

    def test_06_backward_compatibility_adapters(self):
        """Verify legacy /api/playlists, /api/user-playlists, /api/favorites, /api/track-metadata continue working seamlessly."""
        # 1. /api/playlists
        res = self.client.get('/api/playlists', headers=self.user1_headers)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn("Favorites", data)
        self.assertNotIn("RockFolder", data, "RockFolder is classified as artist, not a playlist")
        self.assertIn("JazzFolder", data)
        self.assertNotIn("SecretFolder", data, "User1 has no access to SecretFolder")

        # 2. /api/user-playlists
        res_upl = self.client.get('/api/user-playlists', headers=self.user1_headers)
        self.assertEqual(res_upl.status_code, 200)
        self.assertIn("playlists", res_upl.get_json())

        # 3. /api/favorites
        res_fav = self.client.get('/api/favorites', headers=self.user1_headers)
        self.assertEqual(res_fav.status_code, 200)
        self.assertIsInstance(res_fav.get_json(), list)

        # 4. /api/track-metadata
        res_meta = self.client.get('/api/track-metadata', headers=self.user1_headers)
        self.assertEqual(res_meta.status_code, 200)
        meta_dict = res_meta.get_json()
        self.assertIsInstance(meta_dict, dict)

    def test_07_public_playlist_with_description_and_track_access_enforcement(self):
        """Issue 1 & Issue 5 verification in V2 suite."""
        # Issue 1: creating public playlist with description via /api/user-playlists and /api/v2/playlists
        res_v2 = self.client.post('/api/v2/playlists', headers=self.user1_headers, json={
            'title': 'User1 V2 Public',
            'description': 'Description for V2 Public',
            'visibility': 'public'
        })
        self.assertEqual(res_v2.status_code, 201)
        pid = res_v2.get_json()['id']

        conn = app_mod.get_db()
        try:
            pl_check = conn.execute("SELECT * FROM playlists WHERE id = ?", (pid,)).fetchone()
            self.assertEqual(pl_check['visibility'], 'public')
            self.assertEqual(pl_check['description'], 'Description for V2 Public')
        finally:
            conn.close()

        # Issue 5: /api/user-playlists/<name>/tracks POST denies access (403) when user lacks access to track's source folder
        # user2 has access only to RockFolder, not SecretFolder
        self.client.post('/api/user-playlists', headers=self.user2_headers, json={'name': 'User2 My List'})
        res_forbidden = self.client.post(
            '/api/user-playlists/User2 My List/tracks',
            headers=self.user2_headers,
            json={'track_path': 'SecretFolder/secret_classified.mp3'}
        )
        self.assertEqual(res_forbidden.status_code, 403)

        res_ok = self.client.post(
            '/api/user-playlists/User2 My List/tracks',
            headers=self.user2_headers,
            json={'track_path': 'RockFolder/rock_anthem.mp3'}
        )
        self.assertEqual(res_ok.status_code, 200)

        # Clean up
        self.client.delete(f'/api/v2/playlists/{pid}', headers=self.user1_headers)
        conn = app_mod.get_db()
        try:
            conn.execute("DELETE FROM playlist_tracks WHERE username = 'v2_user2' AND playlist_name = 'User2 My List'")
            conn.execute("DELETE FROM user_playlists WHERE username = 'v2_user2' AND name = 'User2 My List'")
            conn.execute("DELETE FROM playlists WHERE owner = 'v2_user2' AND title = 'User2 My List'")
            conn.commit()
        finally:
            conn.close()

    def test_08_create_playlist_with_tracks_and_access_enforcement(self):
        """POST /api/v2/playlists accepts optional tracks array (strings or objects) and enforces access permissions."""
        # user2 only has access to RockFolder, not JazzFolder or SecretFolder
        payload_u2 = {
            'title': 'User2 Fast Playlist',
            'description': 'Created with initial tracks',
            'visibility': 'private',
            'tracks': [
                'RockFolder/rock_anthem.mp3',
                {'path': 'JazzFolder/jazz_smooth.mp3'},
                {'track_path': 'SecretFolder/secret_classified.mp3'},
                'RockFolder/rock_anthem.mp3'  # duplicate
            ]
        }
        res_u2 = self.client.post('/api/v2/playlists', headers=self.user2_headers, json=payload_u2)
        self.assertEqual(res_u2.status_code, 201)
        data_u2 = res_u2.get_json()
        self.assertEqual(data_u2['track_count'], 1)
        self.assertEqual(len(data_u2['tracks']), 1)
        self.assertEqual(data_u2['tracks'][0]['track_path'], 'RockFolder/rock_anthem.mp3')
        self.assertEqual(data_u2['tracks'][0]['position'], 0)
        pl_id_u2 = data_u2['id']

        # Verify DB records
        conn = app_mod.get_db()
        try:
            rows_v2 = conn.execute("SELECT * FROM playlist_tracks_v2 WHERE playlist_id = ?", (pl_id_u2,)).fetchall()
            self.assertEqual(len(rows_v2), 1)
            self.assertEqual(rows_v2[0]['track_path'], 'RockFolder/rock_anthem.mp3')
            self.assertEqual(rows_v2[0]['position'], 0)

            # Check legacy sync
            rows_legacy = conn.execute("SELECT * FROM playlist_tracks WHERE username = 'v2_user2' AND playlist_name = 'User2 Fast Playlist'").fetchall()
            self.assertEqual(len(rows_legacy), 1)
            self.assertEqual(rows_legacy[0]['track_path'], 'RockFolder/rock_anthem.mp3')
        finally:
            conn.close()

        # user1 has access to both RockFolder and JazzFolder
        payload_u1 = {
            'title': 'User1 Multi Track PL',
            'visibility': 'public',
            'tracks': [
                {'path': 'RockFolder/rock_anthem.mp3'},
                {'track_path': 'JazzFolder/jazz_smooth.mp3'}
            ]
        }
        res_u1 = self.client.post('/api/v2/playlists', headers=self.user1_headers, json=payload_u1)
        self.assertEqual(res_u1.status_code, 201)
        data_u1 = res_u1.get_json()
        self.assertEqual(data_u1['track_count'], 2)
        self.assertEqual(len(data_u1['tracks']), 2)
        self.assertEqual(data_u1['tracks'][0]['position'], 0)
        self.assertEqual(data_u1['tracks'][1]['position'], 1)
        pl_id_u1 = data_u1['id']

        # Clean up
        self.client.delete(f'/api/v2/playlists/{pl_id_u2}', headers=self.user2_headers)
        self.client.delete(f'/api/v2/playlists/{pl_id_u1}', headers=self.user1_headers)

    def test_09_clone_playlist_and_access_isolation(self):
        """POST /api/v2/playlists/<id>/clone clones playlists, enforces visibility and isolates unauthorized tracks."""
        # 1. user1 creates a public playlist with both rock and jazz
        pub_create = self.client.post('/api/v2/playlists', headers=self.user1_headers, json={
            'title': 'User1 Source Public',
            'description': 'Public source description',
            'visibility': 'public',
            'tracks': ['RockFolder/rock_anthem.mp3', 'JazzFolder/jazz_smooth.mp3']
        })
        self.assertEqual(pub_create.status_code, 201)
        source_pub_id = pub_create.get_json()['id']

        # 2. user2 clones user1's public playlist (user2 cannot access JazzFolder)
        clone_res = self.client.post(f'/api/v2/playlists/{source_pub_id}/clone', headers=self.user2_headers, json={
            'title': 'User2 Cloned Mix',
            'description': 'Cloned by user2'
        })
        self.assertEqual(clone_res.status_code, 201)
        cloned_data = clone_res.get_json()
        cloned_id = cloned_data['id']
        self.assertNotEqual(cloned_id, source_pub_id)
        self.assertEqual(cloned_data['owner'], 'v2_user2')
        self.assertEqual(cloned_data['title'], 'User2 Cloned Mix')
        self.assertEqual(cloned_data['description'], 'Cloned by user2')
        self.assertEqual(cloned_data['visibility'], 'private')  # default visibility is private
        # CRITICAL ZERO LEAKAGE: user2 must ONLY get the Rock track, Jazz track must be excluded!
        self.assertEqual(cloned_data['track_count'], 1)
        self.assertEqual(len(cloned_data['tracks']), 1)
        self.assertEqual(cloned_data['tracks'][0]['track_path'], 'RockFolder/rock_anthem.mp3')
        self.assertEqual(cloned_data['tracks'][0]['position'], 0)

        # 3. user1 creates a private playlist
        priv_create = self.client.post('/api/v2/playlists', headers=self.user1_headers, json={
            'title': 'User1 Top Secret Private',
            'visibility': 'private',
            'tracks': ['RockFolder/rock_anthem.mp3']
        })
        self.assertEqual(priv_create.status_code, 201)
        source_priv_id = priv_create.get_json()['id']

        # 4. user2 tries to clone user1's private playlist -> 404
        clone_forbidden = self.client.post(f'/api/v2/playlists/{source_priv_id}/clone', headers=self.user2_headers)
        self.assertEqual(clone_forbidden.status_code, 404)

        # 5. admin clones user1's private playlist -> 201
        admin_clone = self.client.post(f'/api/v2/playlists/{source_priv_id}/clone', headers=self.admin_headers, json={
            'title': 'Admin Copy of Private'
        })
        self.assertEqual(admin_clone.status_code, 201)
        admin_cloned_id = admin_clone.get_json()['id']
        self.assertEqual(admin_clone.get_json()['owner'], 'admin')

        # 6. Cloning non-existent playlist -> 404
        res_404 = self.client.post('/api/v2/playlists/non-existent-uuid/clone', headers=self.user1_headers)
        self.assertEqual(res_404.status_code, 404)

        # 7. Folder playlist cloning:
        # Register JazzFolder as playlist classification
        conn = app_mod.get_db()
        try:
            conn.execute("""
                INSERT OR REPLACE INTO source_folders (folder_name, display_name, classification)
                VALUES ('JazzFolder', 'Jazz Gems', 'playlist')
            """)
            conn.commit()
        finally:
            conn.close()

        # Sync playlists to ensure folder playlist exists
        self.client.get('/api/v2/playlists', headers=self.user1_headers)
        conn = app_mod.get_db()
        try:
            fp_row = conn.execute("SELECT id FROM playlists WHERE is_folder_playlist = 1 AND (title = 'Jazz Gems' OR title = 'JazzFolder')").fetchone()
            self.assertIsNotNone(fp_row)
            folder_pl_id = fp_row['id']
        finally:
            conn.close()

        # user1 has access to JazzFolder -> clone succeeds
        u1_folder_clone = self.client.post(f'/api/v2/playlists/{folder_pl_id}/clone', headers=self.user1_headers)
        self.assertEqual(u1_folder_clone.status_code, 201)
        u1_folder_cloned_id = u1_folder_clone.get_json()['id']
        self.assertEqual(u1_folder_clone.get_json()['track_count'], 1)

        # user2 has no access to JazzFolder -> clone returns 404
        u2_folder_clone = self.client.post(f'/api/v2/playlists/{folder_pl_id}/clone', headers=self.user2_headers)
        self.assertEqual(u2_folder_clone.status_code, 404)

        # Clean up
        self.client.delete(f'/api/v2/playlists/{source_pub_id}', headers=self.user1_headers)
        self.client.delete(f'/api/v2/playlists/{cloned_id}', headers=self.user2_headers)
        self.client.delete(f'/api/v2/playlists/{source_priv_id}', headers=self.user1_headers)
        self.client.delete(f'/api/v2/playlists/{admin_cloned_id}', headers=self.admin_headers)
        self.client.delete(f'/api/v2/playlists/{u1_folder_cloned_id}', headers=self.user1_headers)

if __name__ == '__main__':
    unittest.main()
