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
        cls.user3_token = app_mod._make_token('v2_user3')

        cls.admin_headers = {'Authorization': f'Bearer {cls.admin_token}'}
        cls.user1_headers = {'Authorization': f'Bearer {cls.user1_token}'}
        cls.user2_headers = {'Authorization': f'Bearer {cls.user2_token}'}
        cls.user3_headers = {'Authorization': f'Bearer {cls.user3_token}'}

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
        users['v2_user3'] = {
            'username': 'v2_user3',
            'role': 'user',
            'rules': {'allowed_playlists': ['RockFolder']}
        }
        app_mod.save_users(users)

        # Ensure DB is migrated
        app_mod.init_db()

        # Clean up any leftover test playlists from previous test runs
        conn = app_mod.get_db()
        try:
            conn.execute("DELETE FROM playlists WHERE owner IN ('v2_user1', 'v2_user2', 'v2_user3')")
            conn.execute("DELETE FROM user_playlists WHERE username IN ('v2_user1', 'v2_user2', 'v2_user3')")
            conn.execute("DELETE FROM playlist_tracks WHERE username IN ('v2_user1', 'v2_user2', 'v2_user3')")
            conn.execute("DELETE FROM playlist_tracks_v2 WHERE playlist_id NOT IN (SELECT id FROM playlists)")
            conn.execute("DELETE FROM user_saved_playlists WHERE username IN ('v2_user1', 'v2_user2', 'v2_user3')")
            conn.execute("DELETE FROM playlist_access_grants WHERE username IN ('v2_user1', 'v2_user2', 'v2_user3')")
            conn.commit()
        finally:
            conn.close()

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
            conn.execute("DELETE FROM playlists WHERE owner IN ('v2_user1', 'v2_user2', 'v2_user3')")
            conn.execute("DELETE FROM user_playlists WHERE username IN ('v2_user1', 'v2_user2', 'v2_user3')")
            conn.execute("DELETE FROM playlist_tracks WHERE username IN ('v2_user1', 'v2_user2', 'v2_user3')")
            conn.execute("DELETE FROM playlist_tracks_v2 WHERE playlist_id NOT IN (SELECT id FROM playlists)")
            conn.execute("DELETE FROM user_saved_playlists WHERE username IN ('v2_user1', 'v2_user2', 'v2_user3')")
            conn.execute("DELETE FROM playlist_access_grants WHERE username IN ('v2_user1', 'v2_user2', 'v2_user3')")
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
                for t in ["source_folders", "artists", "playlists", "playlist_tracks_v2", "user_saved_playlists", "playlist_access_grants"]:
                    self.assertIn(t, tables, f"Table {t} should exist in {db_path}")

                # Verify playlists columns
                pl_cols = [r["name"] for r in conn.execute("PRAGMA table_info(playlists)").fetchall()]
                for c in ["id", "owner", "title", "description", "visibility", "is_folder_playlist", "idempotency_key"]:
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
        self.client.delete(f'/api/v2/playlists/{priv_id}', headers=self.user1_headers)

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

    def test_10_unique_playlist_titles_enforcement(self):
        """Verify enforcement of unique playlist titles per owner (case-insensitive) on create and update."""
        # 1. User1 creates a playlist
        res1 = self.client.post('/api/v2/playlists', headers=self.user1_headers, json={
            'title': 'Synthwave Chill',
            'visibility': 'private'
        })
        self.assertEqual(res1.status_code, 201)
        pl1_id = res1.get_json()['id']

        # 2. User1 attempts to create another playlist with exact same title -> 409
        res2 = self.client.post('/api/v2/playlists', headers=self.user1_headers, json={
            'title': 'Synthwave Chill',
            'visibility': 'private'
        })
        self.assertEqual(res2.status_code, 409)
        self.assertEqual(res2.get_json().get('error'), 'A playlist with this title already exists')

        # 3. User1 attempts to create another playlist with case variation -> 409
        res3 = self.client.post('/api/v2/playlists', headers=self.user1_headers, json={
            'title': 'synthwave chill',
            'visibility': 'public'
        })
        self.assertEqual(res3.status_code, 409)
        self.assertEqual(res3.get_json().get('error'), 'A playlist with this title already exists')

        # 4. User2 CAN create a playlist with the same title ('Synthwave Chill') because uniqueness is per owner
        res_u2 = self.client.post('/api/v2/playlists', headers=self.user2_headers, json={
            'title': 'Synthwave Chill',
            'visibility': 'private'
        })
        self.assertEqual(res_u2.status_code, 201)
        pl_u2_id = res_u2.get_json()['id']

        # 5. User1 creates a second distinct playlist
        res4 = self.client.post('/api/v2/playlists', headers=self.user1_headers, json={
            'title': 'Lo-Fi Beats',
            'visibility': 'private'
        })
        self.assertEqual(res4.status_code, 201)
        pl2_id = res4.get_json()['id']

        # 6. User1 renames second playlist to an existing title ('Synthwave Chill') -> 409
        res_rename_conflict = self.client.put(f'/api/v2/playlists/{pl2_id}', headers=self.user1_headers, json={
            'title': 'Synthwave Chill'
        })
        self.assertEqual(res_rename_conflict.status_code, 409)
        self.assertEqual(res_rename_conflict.get_json().get('error'), 'A playlist with this title already exists')

        # 7. User1 renames second playlist to case-insensitive variation of existing title -> 409
        res_rename_case = self.client.put(f'/api/v2/playlists/{pl2_id}', headers=self.user1_headers, json={
            'title': 'SYNTHWAVE CHILL'
        })
        self.assertEqual(res_rename_case.status_code, 409)
        self.assertEqual(res_rename_case.get_json().get('error'), 'A playlist with this title already exists')

        # 8. Updating the playlist keeping its current title succeeds -> 200
        res_same_title = self.client.put(f'/api/v2/playlists/{pl2_id}', headers=self.user1_headers, json={
            'title': 'Lo-Fi Beats',
            'description': 'Updated description only'
        })
        self.assertEqual(res_same_title.status_code, 200)
        self.assertEqual(res_same_title.get_json()['title'], 'Lo-Fi Beats')

        # Clean up
        self.client.delete(f'/api/v2/playlists/{pl1_id}', headers=self.user1_headers)
        self.client.delete(f'/api/v2/playlists/{pl2_id}', headers=self.user1_headers)
        self.client.delete(f'/api/v2/playlists/{pl_u2_id}', headers=self.user2_headers)

    def test_11_catch_all_frontend_route_guard_api_404(self):
        """Verify that unknown routes under /api/ return 404 rather than false-positive frontend 200 OK."""
        # 1. Unknown V2 route
        res1 = self.client.get('/api/v2/non-existent-route')
        self.assertEqual(res1.status_code, 404)
        self.assertEqual(res1.get_json(), {"error": "Resource not found"})

        # 2. Unknown nested route
        res2 = self.client.post('/api/v2/playlists/some-id/invalid-action')
        self.assertEqual(res2.status_code, 404)
        self.assertEqual(res2.get_json(), {"error": "Resource not found"})

        # 3. Base /api or /api/
        res3 = self.client.get('/api/unknown-endpoint')
        self.assertEqual(res3.status_code, 404)
        self.assertEqual(res3.get_json(), {"error": "Resource not found"})

    def test_12_personal_library_isolation_and_discover_mode(self):
        """Verify personal library only contains owned + saved playlists, discover contains public playlists, and save/unsave lifecycle."""
        # 1. user1 creates a public playlist and a private playlist
        res_pub = self.client.post('/api/v2/playlists', headers=self.user1_headers, json={
            'title': 'User1 Public Showcase',
            'visibility': 'public'
        })
        self.assertEqual(res_pub.status_code, 201)
        pub_id = res_pub.get_json()['id']

        res_priv = self.client.post('/api/v2/playlists', headers=self.user1_headers, json={
            'title': 'User1 Secret Stash',
            'visibility': 'private'
        })
        self.assertEqual(res_priv.status_code, 201)
        priv_id = res_priv.get_json()['id']

        # 2. user2 queries library mode (default) -> user1's public and private playlists are NOT present
        lib_u2 = self.client.get('/api/v2/playlists', headers=self.user2_headers)
        self.assertEqual(lib_u2.status_code, 200)
        u2_lib_ids = [p['id'] for p in lib_u2.get_json()['playlists']]
        self.assertNotIn(pub_id, u2_lib_ids)
        self.assertNotIn(priv_id, u2_lib_ids)

        # 3. user2 queries discover mode (?discover=true) -> user1's public playlist IS present, private is NOT
        disc_u2 = self.client.get('/api/v2/playlists?discover=true', headers=self.user2_headers)
        self.assertEqual(disc_u2.status_code, 200)
        disc_pls = disc_u2.get_json()['playlists']
        found_pub = next((p for p in disc_pls if p['id'] == pub_id), None)
        self.assertIsNotNone(found_pub)
        self.assertFalse(found_pub['is_owner'])
        self.assertFalse(found_pub['is_saved'])
        self.assertIsNone(next((p for p in disc_pls if p['id'] == priv_id), None))

        # 4. user2 saves user1's public playlist
        save_res = self.client.post(f'/api/v2/playlists/{pub_id}/save', headers=self.user2_headers)
        self.assertEqual(save_res.status_code, 200)
        self.assertEqual(save_res.get_json(), {"status": "saved", "playlist_id": pub_id})

        # 5. user2 queries library mode -> user1's public playlist now appears in user2's library
        lib_u2_after = self.client.get('/api/v2/playlists', headers=self.user2_headers)
        self.assertEqual(lib_u2_after.status_code, 200)
        saved_in_lib = next((p for p in lib_u2_after.get_json()['playlists'] if p['id'] == pub_id), None)
        self.assertIsNotNone(saved_in_lib)
        self.assertFalse(saved_in_lib['is_owner'])
        self.assertTrue(saved_in_lib['is_saved'])

        # In discover mode, is_saved is now true
        disc_u2_after = self.client.get('/api/v2/playlists?discover=true', headers=self.user2_headers)
        found_pub_disc = next((p for p in disc_u2_after.get_json()['playlists'] if p['id'] == pub_id), None)
        self.assertIsNotNone(found_pub_disc)
        self.assertTrue(found_pub_disc['is_saved'])

        # 6. user2 unsaves user1's public playlist
        unsave_res = self.client.delete(f'/api/v2/playlists/{pub_id}/save', headers=self.user2_headers)
        self.assertEqual(unsave_res.status_code, 200)
        self.assertEqual(unsave_res.get_json(), {"status": "unsaved", "playlist_id": pub_id})

        # 7. user2 queries library mode -> playlist is no longer in library
        lib_u2_unsaved = self.client.get('/api/v2/playlists', headers=self.user2_headers)
        u2_lib_ids_unsaved = [p['id'] for p in lib_u2_unsaved.get_json()['playlists']]
        self.assertNotIn(pub_id, u2_lib_ids_unsaved)

        # Clean up
        self.client.delete(f'/api/v2/playlists/{pub_id}', headers=self.user1_headers)
        self.client.delete(f'/api/v2/playlists/{priv_id}', headers=self.user1_headers)

    def test_13_artist_add_to_playlist_and_source_isolation(self):
        """POST /api/v2/artists/<id>/add-to-playlist supports new & existing playlists, deduplication, and source isolation."""
        # 1. Create artist and map RockFolder and SecretFolder to artist
        art_name = f"MultiArtist_{uuid.uuid4().hex[:6]}"
        create_art = self.client.post('/api/v2/artists', headers=self.admin_headers, json={'name': art_name})
        self.assertEqual(create_art.status_code, 201)
        art_id = create_art.get_json()['id']

        conn = app_mod.get_db()
        try:
            conn.execute("""
                INSERT OR REPLACE INTO source_folders (folder_name, display_name, classification, mapped_artist_id, mapped_artist_name)
                VALUES ('RockFolder', 'Rock Classics', 'artist', ?, ?)
            """, (art_id, art_name))
            conn.execute("""
                INSERT OR REPLACE INTO source_folders (folder_name, display_name, classification, mapped_artist_id, mapped_artist_name)
                VALUES ('SecretFolder', 'Secret Vault', 'artist', ?, ?)
            """, (art_id, art_name))
            conn.commit()
        finally:
            conn.close()

        # user2 has access to RockFolder but NOT SecretFolder
        # 2. user2 adds artist collection to a NEW playlist
        res_new = self.client.post(f'/api/v2/artists/{art_id}/add-to-playlist', headers=self.user2_headers, json={
            'new_playlist_title': 'My Artist Collection',
            'description': 'Collection test',
            'visibility': 'private'
        })
        self.assertEqual(res_new.status_code, 200)
        data_new = res_new.get_json()
        self.assertEqual(data_new['status'], 'added')
        target_pl_id = data_new['playlist_id']
        self.assertGreaterEqual(data_new['tracks_added'], 1)
        self.assertEqual(data_new['duplicates_skipped'], 0)
        self.assertEqual(data_new['total_tracks'], data_new['tracks_added'])

        # 3. Verify user2 playlist detail: rock_anthem.mp3 is added, secret_classified.mp3 was NOT added
        detail = self.client.get(f'/api/v2/playlists/{target_pl_id}', headers=self.user2_headers)
        self.assertEqual(detail.status_code, 200)
        pl_tracks = [t['track_path'] for t in detail.get_json()['tracks']]
        self.assertIn('RockFolder/rock_anthem.mp3', pl_tracks)
        self.assertNotIn('SecretFolder/secret_classified.mp3', pl_tracks)

        # 4. user2 calls add-to-playlist again on the EXISTING playlist -> duplicate skipping
        res_dup = self.client.post(f'/api/v2/artists/{art_id}/add-to-playlist', headers=self.user2_headers, json={
            'playlist_id': target_pl_id
        })
        self.assertEqual(res_dup.status_code, 200)
        data_dup = res_dup.get_json()
        self.assertEqual(data_dup['status'], 'added')
        self.assertEqual(data_dup['playlist_id'], target_pl_id)
        self.assertEqual(data_dup['tracks_added'], 0)
        self.assertGreaterEqual(data_dup['duplicates_skipped'], 1)
        self.assertEqual(data_dup['total_tracks'], data_new['total_tracks'])

        # 5. user1 attempts to add artist tracks to user2's playlist -> 403 Forbidden
        res_forbidden = self.client.post(f'/api/v2/artists/{art_id}/add-to-playlist', headers=self.user1_headers, json={
            'playlist_id': target_pl_id
        })
        self.assertEqual(res_forbidden.status_code, 403)

        # Clean up
        self.client.delete(f'/api/v2/playlists/{target_pl_id}', headers=self.user2_headers)

    def test_14_admin_access_grants_visibility_and_streaming_permissions(self):
        """Admin playlist access grants, visibility toggle, and enforcement across detail, cloning, streaming."""
        # 1. user1 creates private playlist with a Rock track and a Jazz track
        p_res = self.client.post('/api/v2/playlists', headers=self.user1_headers, json={
            'title': 'User1 Exclusive Private',
            'visibility': 'private',
            'tracks': ['RockFolder/rock_anthem.mp3', 'JazzFolder/jazz_smooth.mp3']
        })
        self.assertEqual(p_res.status_code, 201)
        pl_id = p_res.get_json()['id']

        # 2. user2 has no grant -> 404 on detail, clone, save, stream with playlist_id
        self.assertEqual(self.client.get(f'/api/v2/playlists/{pl_id}', headers=self.user2_headers).status_code, 404)
        self.assertEqual(self.client.post(f'/api/v2/playlists/{pl_id}/clone', headers=self.user2_headers).status_code, 404)
        self.assertEqual(self.client.post(f'/api/v2/playlists/{pl_id}/save', headers=self.user2_headers).status_code, 404)
        self.assertEqual(self.client.get(f'/api/stream/RockFolder/rock_anthem.mp3?playlist_id={pl_id}', headers=self.user2_headers).status_code, 404)

        # 3. Non-admin cannot view/modify access grants
        self.assertEqual(self.client.get(f'/api/v2/admin/playlists/{pl_id}/access', headers=self.user2_headers).status_code, 403)
        self.assertEqual(self.client.post(f'/api/v2/admin/playlists/{pl_id}/access', headers=self.user2_headers, json={'grant_user': 'v2_user2'}).status_code, 403)

        # 4. Admin inspects access grants
        admin_acc = self.client.get(f'/api/v2/admin/playlists/{pl_id}/access', headers=self.admin_headers)
        self.assertEqual(admin_acc.status_code, 200)
        self.assertEqual(admin_acc.get_json()['grants'], [])

        # 5. Admin grants access to user2
        grant_res = self.client.post(f'/api/v2/admin/playlists/{pl_id}/access', headers=self.admin_headers, json={
            'grant_user': 'v2_user2'
        })
        self.assertEqual(grant_res.status_code, 200)
        self.assertIn('v2_user2', grant_res.get_json()['grants'])

        # 6. user2 can now access detail; user2 only has access to RockFolder, JazzFolder track is masked!
        u2_detail = self.client.get(f'/api/v2/playlists/{pl_id}', headers=self.user2_headers)
        self.assertEqual(u2_detail.status_code, 200)
        u2_tracks = u2_detail.get_json()['tracks']
        self.assertEqual(len(u2_tracks), 1)
        self.assertEqual(u2_tracks[0]['track_path'], 'RockFolder/rock_anthem.mp3')
        self.assertEqual(u2_detail.get_json()['unavailable_count'], 1)

        # user2 can now save it
        self.assertEqual(self.client.post(f'/api/v2/playlists/{pl_id}/save', headers=self.user2_headers).status_code, 200)
        # Appears in user2's library
        u2_lib = self.client.get('/api/v2/playlists', headers=self.user2_headers)
        self.assertIn(pl_id, [p['id'] for p in u2_lib.get_json()['playlists']])

        # user2 can now clone it
        u2_clone = self.client.post(f'/api/v2/playlists/{pl_id}/clone', headers=self.user2_headers)
        self.assertEqual(u2_clone.status_code, 201)
        u2_clone_id = u2_clone.get_json()['id']
        self.client.delete(f'/api/v2/playlists/{u2_clone_id}', headers=self.user2_headers)

        # user2 can stream with playlist_id
        stream_ok = self.client.get(f'/api/stream/RockFolder/rock_anthem.mp3?playlist_id={pl_id}', headers=self.user2_headers)
        self.assertIn(stream_ok.status_code, (200, 206))

        # user2 cannot stream JazzFolder track (track source strictly enforced -> 403)
        stream_denied = self.client.get(f'/api/stream/JazzFolder/jazz_smooth.mp3?playlist_id={pl_id}', headers=self.user2_headers)
        self.assertEqual(stream_denied.status_code, 403)

        # 7. Admin revokes access from user2
        revoke_res = self.client.post(f'/api/v2/admin/playlists/{pl_id}/access', headers=self.admin_headers, json={
            'revoke_user': 'v2_user2'
        })
        self.assertEqual(revoke_res.status_code, 200)
        self.assertNotIn('v2_user2', revoke_res.get_json()['grants'])

        # user2 now gets 404 again and playlist disappears from library
        self.assertEqual(self.client.get(f'/api/v2/playlists/{pl_id}', headers=self.user2_headers).status_code, 404)
        u2_lib_revoked = self.client.get('/api/v2/playlists', headers=self.user2_headers)
        self.assertNotIn(pl_id, [p['id'] for p in u2_lib_revoked.get_json()['playlists']])

        # 8. Admin changes visibility to public
        vis_res = self.client.put(f'/api/v2/admin/playlists/{pl_id}/visibility', headers=self.admin_headers, json={
            'visibility': 'public'
        })
        self.assertEqual(vis_res.status_code, 200)
        self.assertEqual(vis_res.get_json()['visibility'], 'public')

        # user2 can now access as public
        self.assertEqual(self.client.get(f'/api/v2/playlists/{pl_id}', headers=self.user2_headers).status_code, 200)

        # Clean up
        self.client.delete(f'/api/v2/playlists/{pl_id}', headers=self.user1_headers)

    def test_15_idempotency_key_create_and_clone(self):
        """Idempotency key prevents duplicate playlists on create and clone."""
        idem_create_key = f"create-idem-{uuid.uuid4().hex}"

        # 1. Create with idempotency_key in JSON body
        res1 = self.client.post('/api/v2/playlists', headers=self.user1_headers, json={
            'title': 'Original Idem Playlist',
            'description': 'First try',
            'visibility': 'public',
            'idempotency_key': idem_create_key
        })
        self.assertEqual(res1.status_code, 201)
        orig_id = res1.get_json()['id']

        # 2. Repeat request with same idempotency_key (even with different title) -> returns existing playlist with 200 OK
        res2 = self.client.post('/api/v2/playlists', headers=self.user1_headers, json={
            'title': 'Different Title Attempt',
            'description': 'Retry',
            'visibility': 'public',
            'idempotency_key': idem_create_key
        })
        self.assertEqual(res2.status_code, 200)
        self.assertEqual(res2.get_json()['id'], orig_id)
        self.assertEqual(res2.get_json()['title'], 'Original Idem Playlist')

        # 3. Clone with Idempotency-Key header
        idem_clone_key = f"clone-idem-{uuid.uuid4().hex}"
        clone_headers = dict(self.user2_headers)
        clone_headers['Idempotency-Key'] = idem_clone_key

        res_c1 = self.client.post(f'/api/v2/playlists/{orig_id}/clone', headers=clone_headers, json={
            'title': 'Cloned Idem Playlist'
        })
        self.assertEqual(res_c1.status_code, 201)
        cloned_id = res_c1.get_json()['id']

        # 4. Repeat clone with same Idempotency-Key header -> returns existing clone with 200 OK
        res_c2 = self.client.post(f'/api/v2/playlists/{orig_id}/clone', headers=clone_headers, json={
            'title': 'Another Clone Name'
        })
        self.assertEqual(res_c2.status_code, 200)
        self.assertEqual(res_c2.get_json()['id'], cloned_id)
        self.assertEqual(res_c2.get_json()['title'], 'Cloned Idem Playlist')

        # Clean up
        self.client.delete(f'/api/v2/playlists/{orig_id}', headers=self.user1_headers)
        self.client.delete(f'/api/v2/playlists/{cloned_id}', headers=self.user2_headers)

    def test_16_simplified_folder_playlist_descriptions(self):
        """Folder playlists should have empty descriptions rather than 'Folder playlist for ...'."""
        conn = app_mod.get_db()
        try:
            conn.execute("""
                INSERT OR REPLACE INTO source_folders (folder_name, display_name, classification)
                VALUES ('RockFolder', 'Rock Music', 'playlist')
            """)
            conn.commit()
        finally:
            conn.close()

        # Trigger sync via GET /api/v2/playlists
        res = self.client.get('/api/v2/playlists', headers=self.user1_headers)
        self.assertEqual(res.status_code, 200)

        conn = app_mod.get_db()
        try:
            folder_pl = conn.execute("SELECT * FROM playlists WHERE is_folder_playlist = 1 AND (title = 'Rock Music' OR title = 'RockFolder')").fetchone()
            self.assertIsNotNone(folder_pl)
            self.assertEqual(folder_pl['description'], "")

            # Ensure no existing playlists match old pattern
            old_pattern_count = conn.execute("SELECT COUNT(*) as cnt FROM playlists WHERE is_folder_playlist = 1 AND description LIKE 'Folder playlist for %'").fetchone()['cnt']
            self.assertEqual(old_pattern_count, 0)
        finally:
            conn.close()

    def test_17_granted_private_playlist_discoverable_and_savable(self):
        """
        A private playlist granted to an individual is discoverable in Discover mode with is_granted=True,
        not visible to non-granted users, and can be saved to library where is_saved=True.
        """
        # 1. User A (v2_user1) creates a private playlist
        create_res = self.client.post('/api/v2/playlists', headers=self.user1_headers, json={
            'title': 'User A Secret Mix',
            'description': 'Only for invited friends',
            'visibility': 'private',
            'tracks': ['RockFolder/rock_anthem.mp3']
        })
        self.assertEqual(create_res.status_code, 201)
        pl_id = create_res.get_json()['id']

        try:
            # Initially, User B (v2_user2) cannot see this private playlist in Discover
            u2_disc_before = self.client.get('/api/v2/playlists?discover=true', headers=self.user2_headers)
            self.assertEqual(u2_disc_before.status_code, 200)
            self.assertNotIn(pl_id, [p['id'] for p in u2_disc_before.get_json()['playlists']])

            # Admin grants access to User B (v2_user2)
            grant_res = self.client.post(f'/api/v2/admin/playlists/{pl_id}/access', headers=self.admin_headers, json={
                'grant_user': 'v2_user2'
            })
            self.assertEqual(grant_res.status_code, 200)

            # User B querying GET /api/v2/playlists?discover=true sees the granted private playlist with is_granted = True
            u2_disc_after = self.client.get('/api/v2/playlists?discover=true', headers=self.user2_headers)
            self.assertEqual(u2_disc_after.status_code, 200)
            u2_playlists = u2_disc_after.get_json()['playlists']
            u2_pl = next((p for p in u2_playlists if p['id'] == pl_id), None)
            self.assertIsNotNone(u2_pl, "User B should discover the granted private playlist")
            self.assertTrue(u2_pl.get('is_granted'), "Granted playlist should have is_granted = True")
            self.assertFalse(u2_pl.get('is_saved'), "Playlist should not be saved yet")

            # User C (v2_user3, not granted) querying GET /api/v2/playlists?discover=true does NOT see the private playlist
            u3_disc = self.client.get('/api/v2/playlists?discover=true', headers=self.user3_headers)
            self.assertEqual(u3_disc.status_code, 200)
            self.assertNotIn(pl_id, [p['id'] for p in u3_disc.get_json()['playlists']], "User C should not see private playlist in discover")

            # User C directly requesting detail also gets 404
            u3_detail = self.client.get(f'/api/v2/playlists/{pl_id}', headers=self.user3_headers)
            self.assertEqual(u3_detail.status_code, 404)

            # User B can call POST /api/v2/playlists/<id>/save to add it to their personal library
            save_res = self.client.post(f'/api/v2/playlists/{pl_id}/save', headers=self.user2_headers)
            self.assertEqual(save_res.status_code, 200)

            # User B querying GET /api/v2/playlists (library mode) now sees it in their library with is_saved = True
            u2_lib = self.client.get('/api/v2/playlists', headers=self.user2_headers)
            self.assertEqual(u2_lib.status_code, 200)
            u2_lib_playlists = u2_lib.get_json()['playlists']
            saved_pl = next((p for p in u2_lib_playlists if p['id'] == pl_id), None)
            self.assertIsNotNone(saved_pl, "User B should see saved playlist in library")
            self.assertTrue(saved_pl.get('is_saved'), "Saved playlist should have is_saved = True")
            self.assertTrue(saved_pl.get('is_granted'), "Saved playlist should retain is_granted = True")

            # User B can also inspect detail of the playlist and see is_granted = True and is_saved = True
            u2_detail = self.client.get(f'/api/v2/playlists/{pl_id}', headers=self.user2_headers)
            self.assertEqual(u2_detail.status_code, 200)
            self.assertTrue(u2_detail.get_json().get('is_granted'))
            self.assertTrue(u2_detail.get_json().get('is_saved'))

        finally:
            # Clean up
            self.client.delete(f'/api/v2/playlists/{pl_id}', headers=self.user1_headers)

if __name__ == '__main__':
    unittest.main()
