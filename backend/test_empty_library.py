import unittest
import json
import os
import sqlite3
import subprocess
import uuid
import app as app_mod

class TestEmptyLibraryAndSecurity(unittest.TestCase):
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

        # Auth tokens
        cls.admin_token = app_mod._make_token('admin')
        cls.brand_new_user_token = app_mod._make_token('brand_new_user')
        cls.user_a_token = app_mod._make_token('empty_user_a')
        cls.user_b_token = app_mod._make_token('empty_user_b')
        cls.restricted_user_token = app_mod._make_token('empty_restricted_user')
        cls.existing_user_token = app_mod._make_token('existing_user_legacy')

        cls.admin_headers = {'Authorization': f'Bearer {cls.admin_token}'}
        cls.brand_new_headers = {'Authorization': f'Bearer {cls.brand_new_user_token}'}
        cls.user_a_headers = {'Authorization': f'Bearer {cls.user_a_token}'}
        cls.user_b_headers = {'Authorization': f'Bearer {cls.user_b_token}'}
        cls.restricted_headers = {'Authorization': f'Bearer {cls.restricted_user_token}'}
        cls.existing_headers = {'Authorization': f'Bearer {cls.existing_user_token}'}

        # Setup test folders and songs in MUSIC_DIR
        cls.music_dir = app_mod.MUSIC_DIR
        cls.folder_rock = os.path.join(cls.music_dir, "RockFolder")
        cls.folder_jazz = os.path.join(cls.music_dir, "JazzFolder")
        cls.folder_secret = os.path.join(cls.music_dir, "SecretFolder")
        os.makedirs(cls.folder_rock, exist_ok=True)
        os.makedirs(cls.folder_jazz, exist_ok=True)
        os.makedirs(cls.folder_secret, exist_ok=True)

        cls.rock_track1 = os.path.join(cls.folder_rock, "rock_anthem.mp3")
        cls.rock_track2 = os.path.join(cls.folder_rock, "rock_ballad.mp3")
        cls.jazz_track1 = os.path.join(cls.folder_jazz, "jazz_smooth.mp3")
        cls.secret_track1 = os.path.join(cls.folder_secret, "secret_classified.mp3")

        # Generate valid minimal MP3 files using ffmpeg so mutagen and metadata parsers read them cleanly
        for fpath, title, artist in [
            (cls.rock_track1, "Rock Anthem", "The Rockers"),
            (cls.rock_track2, "Rock Ballad", "The Rockers"),
            (cls.jazz_track1, "Jazz Smooth", "Jazz Master"),
            (cls.secret_track1, "Secret Classified", "Secret Artist"),
        ]:
            if not os.path.exists(fpath):
                try:
                    subprocess.run([
                        "ffmpeg", "-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono",
                        "-t", "0.5", "-metadata", f"title={title}", "-metadata", f"artist={artist}",
                        "-acodec", "libmp3lame", fpath
                    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
                except Exception:
                    with open(fpath, "wb") as f:
                        f.write(b"ID3\x03\x00\x00\x00\x00\x00\x00" + b"\x00" * 300)

        # Clear metadata cache so fresh stat / mutagen read occurs
        if hasattr(app_mod, '_track_metadata_cache'):
            app_mod._track_metadata_cache.clear()

        # Configure users
        users = app_mod.load_users()
        users['admin'] = {
            'username': 'admin',
            'role': 'admin',
            'rules': {'allowed_playlists': ['*']}
        }
        users['brand_new_user'] = {
            'username': 'brand_new_user',
            'role': 'user',
            'rules': {'allowed_playlists': ['RockFolder', 'JazzFolder']}
        }
        users['empty_user_a'] = {
            'username': 'empty_user_a',
            'role': 'user',
            'rules': {'allowed_playlists': ['RockFolder', 'JazzFolder']}
        }
        users['empty_user_b'] = {
            'username': 'empty_user_b',
            'role': 'user',
            'rules': {'allowed_playlists': ['RockFolder', 'JazzFolder']}
        }
        users['empty_restricted_user'] = {
            'username': 'empty_restricted_user',
            'role': 'user',
            'rules': {'allowed_playlists': ['RockFolder']}
        }
        users['existing_user_legacy'] = {
            'username': 'existing_user_legacy',
            'role': 'user',
            'rules': {'allowed_playlists': ['*']}
        }
        app_mod.save_users(users)

        # Initialize/migrate DB
        app_mod.init_db()

        # Seed catalog data for testing:
        # Source folders:
        # - RockFolder: artist classification -> mapped to 'The Rockers'
        # - JazzFolder: playlist classification -> 'Jazz Vibes'
        # - SecretFolder: folder classification
        conn = app_mod.get_db()
        try:
            # Upsert artist 'The Rockers'
            art = conn.execute("SELECT id FROM artists WHERE LOWER(name) = LOWER('The Rockers')").fetchone()
            if not art:
                cur = conn.execute("INSERT INTO artists (name, bio) VALUES ('The Rockers', 'Legendary rock band')")
                cls.artist_id = cur.lastrowid
            else:
                cls.artist_id = art["id"]

            conn.execute("""
                INSERT OR REPLACE INTO source_folders (folder_name, name, display_name, classification, mapped_artist_id, mapped_artist_name)
                VALUES ('RockFolder', 'RockFolder', 'The Rockers', 'artist', ?, 'The Rockers')
            """, (cls.artist_id,))

            conn.execute("""
                INSERT OR REPLACE INTO source_folders (folder_name, name, display_name, classification, mapped_artist_id, mapped_artist_name)
                VALUES ('JazzFolder', 'JazzFolder', 'Jazz Vibes', 'playlist', NULL, NULL)
            """)

            conn.execute("""
                INSERT OR REPLACE INTO source_folders (folder_name, name, display_name, classification, mapped_artist_id, mapped_artist_name)
                VALUES ('SecretFolder', 'SecretFolder', 'Secret Folder', 'folder', NULL, NULL)
            """)

            # Clean any previous test user state
            test_usernames = ('brand_new_user', 'empty_user_a', 'empty_user_b', 'empty_restricted_user', 'existing_user_legacy')
            ph = ','.join('?' for _ in test_usernames)
            conn.execute(f"DELETE FROM playlists WHERE owner IN ({ph})", test_usernames)
            conn.execute(f"DELETE FROM user_playlists WHERE username IN ({ph})", test_usernames)
            conn.execute(f"DELETE FROM playlist_tracks WHERE username IN ({ph})", test_usernames)
            conn.execute(f"DELETE FROM user_saved_playlists WHERE username IN ({ph})", test_usernames)
            conn.execute("DELETE FROM playlists WHERE title LIKE 'Public Security Playlist%'")
            try:
                conn.execute(f"DELETE FROM user_saved_artists WHERE username IN ({ph})", test_usernames)
            except Exception:
                pass
            try:
                conn.execute(f"DELETE FROM user_saved_tracks WHERE username IN ({ph})", test_usernames)
            except Exception:
                pass
            conn.execute(f"DELETE FROM playlist_access_grants WHERE username IN ({ph})", test_usernames)

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

        # Remove audio files created
        for fpath in [cls.rock_track1, cls.rock_track2, cls.jazz_track1, cls.secret_track1]:
            if os.path.exists(fpath):
                try:
                    os.remove(fpath)
                except Exception:
                    pass

        # Cleanup DB
        conn = app_mod.get_db()
        try:
            test_usernames = ('brand_new_user', 'empty_user_a', 'empty_user_b', 'empty_restricted_user', 'existing_user_legacy')
            ph = ','.join('?' for _ in test_usernames)
            conn.execute(f"DELETE FROM playlists WHERE owner IN ({ph})", test_usernames)
            conn.execute(f"DELETE FROM user_playlists WHERE username IN ({ph})", test_usernames)
            conn.execute(f"DELETE FROM playlist_tracks WHERE username IN ({ph})", test_usernames)
            conn.execute(f"DELETE FROM user_saved_playlists WHERE username IN ({ph})", test_usernames)
            conn.execute("DELETE FROM playlists WHERE title LIKE 'Public Security Playlist%'")
            try:
                conn.execute(f"DELETE FROM user_saved_artists WHERE username IN ({ph})", test_usernames)
            except Exception:
                pass
            try:
                conn.execute(f"DELETE FROM user_saved_tracks WHERE username IN ({ph})", test_usernames)
            except Exception:
                pass
            conn.execute(f"DELETE FROM playlist_access_grants WHERE username IN ({ph})", test_usernames)
            conn.commit()
        finally:
            conn.close()

    def test_01_brand_new_user_starts_with_empty_personal_library(self):
        """
        Test 1: Brand new user starts with an empty personal library:
        - GET /api/v2/playlists returns {"playlists": []}
        - GET /api/v2/library/artists returns {"artists": []}
        - GET /api/v2/library/tracks returns {"tracks": []}
        - But Discover (GET /api/v2/playlists?discover=true and GET /api/v2/artists)
          continues to return authorized catalog items!
        """
        # 1. Personal playlists library must be empty
        res_pl = self.client.get('/api/v2/playlists', headers=self.brand_new_headers)
        self.assertEqual(res_pl.status_code, 200)
        pl_data = res_pl.get_json()
        self.assertIn("playlists", pl_data)
        self.assertEqual(pl_data["playlists"], [], "Brand new user personal library playlists must be empty")

        # 2. Personal artists library must be empty
        res_art = self.client.get('/api/v2/library/artists', headers=self.brand_new_headers)
        self.assertEqual(res_art.status_code, 200)
        art_data = res_art.get_json()
        self.assertIn("artists", art_data)
        self.assertEqual(art_data["artists"], [], "Brand new user personal library artists must be empty")

        # 3. Personal tracks library must be empty
        res_tr = self.client.get('/api/v2/library/tracks', headers=self.brand_new_headers)
        self.assertEqual(res_tr.status_code, 200)
        tr_data = res_tr.get_json()
        self.assertIn("tracks", tr_data)
        self.assertEqual(tr_data["tracks"], [], "Brand new user personal library tracks must be empty")

        # 4. Discover mode playlists continues to return authorized catalog items (e.g. folder playlist Jazz Vibes)
        res_disc = self.client.get('/api/v2/playlists?discover=true', headers=self.brand_new_headers)
        self.assertEqual(res_disc.status_code, 200)
        disc_pls = res_disc.get_json()["playlists"]
        self.assertGreater(len(disc_pls), 0, "Discover playlists should return catalog playlists")
        jazz_pl = next((p for p in disc_pls if p.get("title") == "Jazz Vibes" or p.get("title") == "JazzFolder"), None)
        self.assertIsNotNone(jazz_pl, "Authorized folder playlist should appear in Discover")
        self.assertFalse(jazz_pl.get("is_saved", False), "Unsaved catalog playlist must have is_saved == False")

        # 5. Catalog artists continues to return authorized artists (e.g. 'The Rockers')
        res_cat_art = self.client.get('/api/v2/artists', headers=self.brand_new_headers)
        self.assertEqual(res_cat_art.status_code, 200)
        cat_artists = res_cat_art.get_json()["artists"]
        self.assertGreater(len(cat_artists), 0, "Catalog artists should return accessible artists")
        rock_artist = next((a for a in cat_artists if a["name"] == "The Rockers"), None)
        self.assertIsNotNone(rock_artist, "The Rockers should appear in catalog artists")
        self.assertFalse(rock_artist.get("is_saved", False), "Unsaved artist in catalog should have is_saved == False")

    def test_02_saving_and_removing_items_playlists_artists_tracks(self):
        """
        Test 2: Saving and removing items (Playlists, Artists, Tracks):
        - Save playlist (POST /api/v2/playlists/<id>/save) -> appears in GET /api/v2/playlists.
        - Remove playlist (DELETE /api/v2/playlists/<id>/save) -> removed from GET /api/v2/playlists.
        - Safe repeat / idempotent behavior (repeated saves/deletes return 200/201 and don't duplicate).
        - Save artist (POST /api/v2/artists/<id>/save) -> appears in GET /api/v2/library/artists.
        - Remove artist (DELETE /api/v2/artists/<id>/save) -> removed.
        - Safe repeat / idempotent behavior for artists.
        - Save track (POST /api/v2/library/tracks) -> appears in GET /api/v2/library/tracks.
        - Remove track (DELETE /api/v2/library/tracks) -> removed.
        - Safe repeat / idempotent behavior for tracks.
        """
        # Find the Jazz Vibes playlist ID from discover
        res_disc = self.client.get('/api/v2/playlists?discover=true', headers=self.brand_new_headers)
        disc_pls = res_disc.get_json()["playlists"]
        jazz_pl = next((p for p in disc_pls if p.get("title") == "Jazz Vibes" or p.get("title") == "JazzFolder"), disc_pls[0])
        pl_id = jazz_pl["id"]

        # --- A. Save Playlist ---
        # 1. Save playlist
        save_pl_res = self.client.post(f'/api/v2/playlists/{pl_id}/save', headers=self.brand_new_headers)
        self.assertIn(save_pl_res.status_code, (200, 201))
        self.assertEqual(save_pl_res.get_json().get("status"), "saved")

        # 2. Check it appears in GET /api/v2/playlists
        lib_pls = self.client.get('/api/v2/playlists', headers=self.brand_new_headers).get_json()["playlists"]
        saved_pl = next((p for p in lib_pls if p["id"] == pl_id), None)
        self.assertIsNotNone(saved_pl, "Saved playlist must appear in GET /api/v2/playlists")
        self.assertTrue(saved_pl.get("is_saved", False))

        # 3. Repeat save (idempotency check)
        save_pl_repeat = self.client.post(f'/api/v2/playlists/{pl_id}/save', headers=self.brand_new_headers)
        self.assertIn(save_pl_repeat.status_code, (200, 201))
        # Ensure not duplicated in library
        lib_pls_rep = self.client.get('/api/v2/playlists', headers=self.brand_new_headers).get_json()["playlists"]
        matching = [p for p in lib_pls_rep if p["id"] == pl_id]
        self.assertEqual(len(matching), 1, "Repeated save must not duplicate playlist in library")

        # 4. Remove playlist
        del_pl_res = self.client.delete(f'/api/v2/playlists/{pl_id}/save', headers=self.brand_new_headers)
        self.assertEqual(del_pl_res.status_code, 200)

        # 5. Check removed from GET /api/v2/playlists
        lib_pls_after = self.client.get('/api/v2/playlists', headers=self.brand_new_headers).get_json()["playlists"]
        self.assertIsNone(next((p for p in lib_pls_after if p["id"] == pl_id), None), "Playlist must be removed from library")

        # 6. Repeat delete (idempotency check)
        del_pl_repeat = self.client.delete(f'/api/v2/playlists/{pl_id}/save', headers=self.brand_new_headers)
        self.assertEqual(del_pl_repeat.status_code, 200)

        # --- B. Save Artist ---
        art_id = str(self.artist_id)

        # 1. Save artist
        save_art_res = self.client.post(f'/api/v2/artists/{art_id}/save', headers=self.brand_new_headers)
        self.assertIn(save_art_res.status_code, (200, 201))
        self.assertEqual(save_art_res.get_json().get("status"), "saved")
        self.assertEqual(str(save_art_res.get_json().get("artist_id")), art_id)

        # 2. Check appears in GET /api/v2/library/artists
        lib_arts = self.client.get('/api/v2/library/artists', headers=self.brand_new_headers).get_json()["artists"]
        saved_art = next((a for a in lib_arts if str(a["id"]) == art_id or a["name"] == "The Rockers"), None)
        self.assertIsNotNone(saved_art, "Saved artist must appear in GET /api/v2/library/artists")
        self.assertTrue(saved_art.get("is_saved", True))

        # Check in catalog GET /api/v2/artists that is_saved is True
        cat_arts = self.client.get('/api/v2/artists', headers=self.brand_new_headers).get_json()["artists"]
        cat_saved = next((a for a in cat_arts if str(a["id"]) == art_id), None)
        if cat_saved:
            self.assertTrue(cat_saved.get("is_saved", False))

        # 3. Repeat save artist (idempotency)
        save_art_rep = self.client.post(f'/api/v2/artists/{art_id}/save', headers=self.brand_new_headers)
        self.assertIn(save_art_rep.status_code, (200, 201))
        lib_arts_rep = self.client.get('/api/v2/library/artists', headers=self.brand_new_headers).get_json()["artists"]
        matching_arts = [a for a in lib_arts_rep if str(a["id"]) == art_id]
        self.assertEqual(len(matching_arts), 1, "Repeated artist save must not duplicate artist in library")

        # 4. Remove artist
        del_art_res = self.client.delete(f'/api/v2/artists/{art_id}/save', headers=self.brand_new_headers)
        self.assertEqual(del_art_res.status_code, 200)
        self.assertEqual(del_art_res.get_json().get("status"), "removed")

        # 5. Check removed from GET /api/v2/library/artists
        lib_arts_after = self.client.get('/api/v2/library/artists', headers=self.brand_new_headers).get_json()["artists"]
        self.assertIsNone(next((a for a in lib_arts_after if str(a["id"]) == art_id), None))

        # 6. Repeat delete artist (idempotency)
        del_art_rep = self.client.delete(f'/api/v2/artists/{art_id}/save', headers=self.brand_new_headers)
        self.assertEqual(del_art_rep.status_code, 200)

        # --- C. Save Track ---
        track_rel_path = "RockFolder/rock_anthem.mp3"

        # 1. Save track
        save_tr_res = self.client.post('/api/v2/library/tracks', headers=self.brand_new_headers, json={
            "track_path": track_rel_path
        })
        self.assertIn(save_tr_res.status_code, (200, 201))
        self.assertEqual(save_tr_res.get_json().get("status"), "saved")

        # 2. Check appears in GET /api/v2/library/tracks
        lib_tracks = self.client.get('/api/v2/library/tracks', headers=self.brand_new_headers).get_json()["tracks"]
        saved_tr = next((t for t in lib_tracks if t.get("track_path") == track_rel_path or t.get("path") == track_rel_path), None)
        self.assertIsNotNone(saved_tr, "Saved track must appear in GET /api/v2/library/tracks")

        # 3. Repeat save track (idempotency)
        save_tr_rep = self.client.post('/api/v2/library/tracks', headers=self.brand_new_headers, json={
            "track_path": track_rel_path
        })
        self.assertIn(save_tr_rep.status_code, (200, 201))
        lib_tracks_rep = self.client.get('/api/v2/library/tracks', headers=self.brand_new_headers).get_json()["tracks"]
        matching_trs = [t for t in lib_tracks_rep if t.get("track_path") == track_rel_path or t.get("path") == track_rel_path]
        self.assertEqual(len(matching_trs), 1, "Repeated track save must not duplicate track in library")

        # 4. Remove track via JSON body
        del_tr_res = self.client.delete('/api/v2/library/tracks', headers=self.brand_new_headers, json={
            "track_path": track_rel_path
        })
        self.assertEqual(del_tr_res.status_code, 200)

        # 5. Check removed from GET /api/v2/library/tracks
        lib_trs_after = self.client.get('/api/v2/library/tracks', headers=self.brand_new_headers).get_json()["tracks"]
        self.assertIsNone(next((t for t in lib_trs_after if t.get("track_path") == track_rel_path or t.get("path") == track_rel_path), None))

        # 6. Repeat delete track (idempotency)
        del_tr_rep = self.client.delete('/api/v2/library/tracks', headers=self.brand_new_headers, json={
            "track_path": track_rel_path
        })
        self.assertEqual(del_tr_rep.status_code, 200)

        # Test delete track via query param
        self.client.post('/api/v2/library/tracks', headers=self.brand_new_headers, json={"track_path": track_rel_path})
        del_query_res = self.client.delete(f'/api/v2/library/tracks?track_path={track_rel_path}', headers=self.brand_new_headers)
        self.assertEqual(del_query_res.status_code, 200)
        lib_trs_after_q = self.client.get('/api/v2/library/tracks', headers=self.brand_new_headers).get_json()["tracks"]
        self.assertIsNone(next((t for t in lib_trs_after_q if t.get("track_path") == track_rel_path or t.get("path") == track_rel_path), None))

    def test_03_cross_account_isolation(self):
        """
        Test 3: Account isolation:
        - User A saves an artist, a track, and a playlist, and creates a private personal playlist.
        - User B's library remains empty.
        - User B cannot see User A's private personal playlists.
        """
        # User A saves an artist
        art_id = str(self.artist_id)
        self.client.post(f'/api/v2/artists/{art_id}/save', headers=self.user_a_headers)

        # User A saves a track
        self.client.post('/api/v2/library/tracks', headers=self.user_a_headers, json={
            "track_path": "RockFolder/rock_anthem.mp3"
        })

        # User A creates a private personal playlist
        create_priv = self.client.post('/api/v2/playlists', headers=self.user_a_headers, json={
            "title": f"User A Private Playlist {uuid.uuid4().hex[:6]}",
            "description": "Private only to User A",
            "visibility": "private",
            "tracks": ["RockFolder/rock_anthem.mp3"]
        })
        self.assertEqual(create_priv.status_code, 201)
        user_a_priv_id = create_priv.get_json()["id"]

        # User A also saves the catalog folder playlist (Jazz Vibes)
        res_disc = self.client.get('/api/v2/playlists?discover=true', headers=self.user_a_headers)
        jazz_pl = next(p for p in res_disc.get_json()["playlists"] if p.get("title") in ("Jazz Vibes", "JazzFolder"))
        self.client.post(f'/api/v2/playlists/{jazz_pl["id"]}/save', headers=self.user_a_headers)

        # Verify User A's library is populated
        u_a_pls = self.client.get('/api/v2/playlists', headers=self.user_a_headers).get_json()["playlists"]
        u_a_arts = self.client.get('/api/v2/library/artists', headers=self.user_a_headers).get_json()["artists"]
        u_a_trs = self.client.get('/api/v2/library/tracks', headers=self.user_a_headers).get_json()["tracks"]
        self.assertGreater(len(u_a_pls), 0)
        self.assertGreater(len(u_a_arts), 0)
        self.assertGreater(len(u_a_trs), 0)

        # Check User B's library: MUST REMAIN COMPLETELY EMPTY!
        u_b_pls = self.client.get('/api/v2/playlists', headers=self.user_b_headers).get_json()["playlists"]
        u_b_arts = self.client.get('/api/v2/library/artists', headers=self.user_b_headers).get_json()["artists"]
        u_b_trs = self.client.get('/api/v2/library/tracks', headers=self.user_b_headers).get_json()["tracks"]

        self.assertEqual(u_b_pls, [], "User B's playlist library must remain empty")
        self.assertEqual(u_b_arts, [], "User B's artist library must remain empty")
        self.assertEqual(u_b_trs, [], "User B's track library must remain empty")

        # User B cannot see User A's private personal playlist in Discover mode
        u_b_disc = self.client.get('/api/v2/playlists?discover=true', headers=self.user_b_headers).get_json()["playlists"]
        self.assertIsNone(next((p for p in u_b_disc if p["id"] == user_a_priv_id), None),
                          "User A's private playlist must not leak into User B's discover view")

        # Direct detail access by User B -> 404
        u_b_detail = self.client.get(f'/api/v2/playlists/{user_a_priv_id}', headers=self.user_b_headers)
        self.assertEqual(u_b_detail.status_code, 404, "User B accessing User A private playlist must return 404")

        # User B cannot save User A's private playlist -> 404
        u_b_save_attempt = self.client.post(f'/api/v2/playlists/{user_a_priv_id}/save', headers=self.user_b_headers)
        self.assertEqual(u_b_save_attempt.status_code, 404)

        # Cleanup User A's private playlist
        self.client.delete(f'/api/v2/playlists/{user_a_priv_id}', headers=self.user_a_headers)

    def test_04_security_and_permissions(self):
        """
        Test 4: Security & Permissions:
        - Saving a track or playlist does NOT grant stream/download access if user's allowed_playlists restricts folder.
        - Inaccessible tracks in public playlists remain masked with is_available: false and unavailable_count.
        """
        # restricted_user has allowed_playlists: ['RockFolder'].
        # SecretFolder and JazzFolder are forbidden.

        # 1. Attempting to save a track in SecretFolder via POST /api/v2/library/tracks -> 403 Forbidden
        res_save_restricted = self.client.post('/api/v2/library/tracks', headers=self.restricted_headers, json={
            "track_path": "SecretFolder/secret_classified.mp3"
        })
        self.assertEqual(res_save_restricted.status_code, 403, "Saving inaccessible track must be forbidden (403)")

        # 2. Even if an inaccessible track was somehow in user_saved_tracks in DB, GET /api/v2/library/tracks must filter it
        conn = app_mod.get_db()
        try:
            conn.execute("""
                INSERT OR IGNORE INTO user_saved_tracks (username, track_path)
                VALUES ('empty_restricted_user', 'SecretFolder/secret_classified.mp3')
            """)
            conn.commit()
        finally:
            conn.close()

        res_lib_trs = self.client.get('/api/v2/library/tracks', headers=self.restricted_headers)
        self.assertEqual(res_lib_trs.status_code, 200)
        trs = res_lib_trs.get_json()["tracks"]
        secret_in_trs = next((t for t in trs if "secret_classified.mp3" in (t.get("track_path") or t.get("path") or "")), None)
        self.assertIsNone(secret_in_trs, "Inaccessible track in user_saved_tracks must NOT be returned in GET /api/v2/library/tracks")

        # 3. Direct streaming and downloading of SecretFolder must be forbidden
        stream_res = self.client.get('/api/stream/SecretFolder/secret_classified.mp3', headers=self.restricted_headers)
        self.assertEqual(stream_res.status_code, 403)

        download_res = self.client.get('/api/download/SecretFolder/secret_classified.mp3', headers=self.restricted_headers)
        self.assertEqual(download_res.status_code, 403)

        # 4. Inaccessible tracks in public playlists remain masked:
        # Admin creates a public playlist with 1 accessible track (RockFolder) and 1 restricted track (SecretFolder)
        unique_pub_title = f"Public Security Playlist {uuid.uuid4().hex[:6]}"
        create_pub = self.client.post('/api/v2/playlists', headers=self.admin_headers, json={
            "title": unique_pub_title,
            "visibility": "public",
            "tracks": [
                "RockFolder/rock_anthem.mp3",
                "SecretFolder/secret_classified.mp3"
            ]
        })
        self.assertEqual(create_pub.status_code, 201)
        pub_pl_id = create_pub.get_json()["id"]

        # restricted_user saves the public playlist to their library
        save_pub = self.client.post(f'/api/v2/playlists/{pub_pl_id}/save', headers=self.restricted_headers)
        self.assertEqual(save_pub.status_code, 200)

        # Saving the playlist does NOT grant stream/download access to the restricted track!
        stream_via_pl = self.client.get(
            f'/api/stream/SecretFolder/secret_classified.mp3?playlist_id={pub_pl_id}',
            headers=self.restricted_headers
        )
        self.assertIn(stream_via_pl.status_code, (403, 404), "Streaming restricted track via saved playlist must remain blocked")

        # When viewing playlist details, the restricted track must be masked:
        pl_detail = self.client.get(f'/api/v2/playlists/{pub_pl_id}', headers=self.restricted_headers)
        self.assertEqual(pl_detail.status_code, 200)
        detail_data = pl_detail.get_json()
        tracks_list = detail_data.get("tracks", [])

        # unavailable_count must be 1
        self.assertEqual(detail_data.get("unavailable_count"), 1, "Unavailable count must reflect restricted tracks")

        # Accessible track is present and marked is_available: true
        rock_item = next((t for t in tracks_list if "rock_anthem.mp3" in (t.get("track_path") or t.get("path") or "")), None)
        self.assertIsNotNone(rock_item)
        self.assertTrue(rock_item.get("is_available", True), "Accessible track must have is_available: true")

        # Inaccessible track in saved playlist is masked with is_available: false
        secret_item = next((t for t in tracks_list if "secret_classified.mp3" in (t.get("track_path") or t.get("path") or "")), None)
        self.assertIsNotNone(secret_item, "Restricted track is included in playlist track list")
        self.assertFalse(secret_item.get("is_available", True), "Inaccessible track must be masked with is_available: false")

        # For playlist owner/admin, if a track is unavailable (e.g. removed from disk), it is marked is_available: false
        missing_track_title = f"Owner Missing Track Playlist {uuid.uuid4().hex[:6]}"
        create_missing = self.client.post('/api/v2/playlists', headers=self.admin_headers, json={
            "title": missing_track_title,
            "visibility": "public",
            "tracks": [
                "RockFolder/rock_anthem.mp3",
                "RockFolder/non_existent_deleted_track.mp3"
            ]
        })
        self.assertEqual(create_missing.status_code, 201)
        missing_pl_id = create_missing.get_json()["id"]

        admin_view = self.client.get(f'/api/v2/playlists/{missing_pl_id}', headers=self.admin_headers).get_json()
        self.assertEqual(admin_view.get("unavailable_count"), 1)
        missing_item = next((t for t in admin_view.get("tracks", []) if "non_existent_deleted_track.mp3" in t.get("track_path", "")), None)
        self.assertIsNotNone(missing_item)
        self.assertFalse(missing_item.get("is_available", True), "Missing track must have is_available: false")

        # Clean up public playlists
        self.client.delete(f'/api/v2/playlists/{pub_pl_id}', headers=self.admin_headers)
        self.client.delete(f'/api/v2/playlists/{missing_pl_id}', headers=self.admin_headers)

    def test_05_existing_data_preservation(self):
        """
        Test 5: Existing data preservation:
        - Existing users with pre-existing Favorites, personal playlists, and downloads do NOT lose their data.
        - /api/track-metadata continues to return metadata for accessible catalog tracks even when library is empty.
        """
        # 1. Pre-seed legacy Favorites into playlist_tracks for existing_user_legacy
        conn = app_mod.get_db()
        try:
            conn.execute("""
                INSERT OR REPLACE INTO playlist_tracks (username, playlist_name, track_path)
                VALUES ('existing_user_legacy', 'Favorites', 'RockFolder/rock_ballad.mp3')
            """)
            # Also seed existing personal playlist in playlists and playlist_tracks_v2
            pl_uuid = str(uuid.uuid4())
            conn.execute("""
                INSERT OR REPLACE INTO playlists (id, owner, title, description, visibility, is_folder_playlist)
                VALUES (?, 'existing_user_legacy', 'My Old School Classics', 'Pre-existing custom playlist', 'private', 0)
            """, (pl_uuid,))
            conn.execute("""
                INSERT OR REPLACE INTO playlist_tracks_v2 (playlist_id, track_path, position)
                VALUES (?, 'RockFolder/rock_ballad.mp3', 0)
            """, (pl_uuid,))
            # Legacy user_playlists
            conn.execute("""
                INSERT OR REPLACE INTO user_playlists (username, name, visibility)
                VALUES ('existing_user_legacy', 'My Old School Classics', 'private')
            """)
            # Simulate the first upgrade from a database predating the migration.
            conn.execute("DELETE FROM library_migrations WHERE name = 'favorites_to_saved_tracks_v1'")
            conn.commit()
        finally:
            conn.close()

        # Re-trigger init_db or seed migration to ensure legacy favorites are migrated into user_saved_tracks
        app_mod.init_db()

        # Check existing user's personal playlists: pre-existing playlist MUST be present!
        res_pls = self.client.get('/api/v2/playlists', headers=self.existing_headers)
        self.assertEqual(res_pls.status_code, 200)
        existing_pls = res_pls.get_json()["playlists"]
        my_old_pl = next((p for p in existing_pls if p["id"] == pl_uuid or p["title"] == "My Old School Classics"), None)
        self.assertIsNotNone(my_old_pl, "Pre-existing personal playlist must NOT be lost")
        self.assertEqual(my_old_pl.get("track_count"), 1)

        # Check existing user's saved tracks / favorites:
        # GET /api/v2/library/tracks must contain rock_ballad.mp3
        res_trs = self.client.get('/api/v2/library/tracks', headers=self.existing_headers)
        self.assertEqual(res_trs.status_code, 200)
        trs = res_trs.get_json()["tracks"]
        fav_tr = next((t for t in trs if "rock_ballad.mp3" in (t.get("track_path") or t.get("path") or "")), None)
        self.assertIsNotNone(fav_tr, "Pre-existing Favorite track must be preserved in GET /api/v2/library/tracks")
        self.assertTrue(fav_tr.get("is_favorite", False), "Preserved favorite track should have is_favorite: True")

        # Check legacy /api/favorites endpoint returns the track as well
        res_leg_fav = self.client.get('/api/favorites', headers=self.existing_headers)
        self.assertEqual(res_leg_fav.status_code, 200)
        leg_favs = res_leg_fav.get_json()
        self.assertIn("RockFolder/rock_ballad.mp3", leg_favs, "Legacy /api/favorites must preserve favorite tracks")

        # Check /api/track-metadata decoupling:
        # brand_new_user has an EMPTY personal library, but /api/track-metadata MUST return metadata
        # directly scanned from accessible source folders (RockFolder and JazzFolder)
        res_meta = self.client.get('/api/track-metadata', headers=self.brand_new_headers)
        self.assertEqual(res_meta.status_code, 200)
        meta_dict = res_meta.get_json()
        self.assertIsInstance(meta_dict, dict)
        self.assertIn("RockFolder/rock_anthem.mp3", meta_dict,
                      "/api/track-metadata must return accessible catalog songs even if personal library is empty")
        # Inaccessible song must NOT be in track metadata
        self.assertNotIn("SecretFolder/secret_classified.mp3", meta_dict,
                         "/api/track-metadata must not leak songs from unauthorized folders")

if __name__ == '__main__':
    unittest.main()
