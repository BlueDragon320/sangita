import unittest
import json
import os
import sqlite3
import uuid
import app as app_mod

class TestCatalogRedesign(unittest.TestCase):
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

        # Tokens for testing
        cls.admin_token = app_mod._make_token('admin')
        cls.user_a_token = app_mod._make_token('test_user_a')
        cls.user_b_token = app_mod._make_token('test_user_b')

        cls.admin_headers = {'Authorization': f'Bearer {cls.admin_token}'}
        cls.user_a_headers = {'Authorization': f'Bearer {cls.user_a_token}'}
        cls.user_b_headers = {'Authorization': f'Bearer {cls.user_b_token}'}

        # Setup test music directories in MUSIC_DIR
        cls.music_dir = app_mod.MUSIC_DIR
        cls.folder_allowed = os.path.join(cls.music_dir, "AllowedFolder")
        cls.folder_restricted = os.path.join(cls.music_dir, "RestrictedFolder")
        os.makedirs(cls.folder_allowed, exist_ok=True)
        os.makedirs(cls.folder_restricted, exist_ok=True)

        cls.song_allowed = os.path.join(cls.folder_allowed, "allowed_track.mp3")
        cls.song_restricted = os.path.join(cls.folder_restricted, "restricted_secret_song.mp3")

        for fpath in [cls.song_allowed, cls.song_restricted]:
            if not os.path.exists(fpath):
                with open(fpath, "wb") as f:
                    f.write(b"ID3\x03\x00\x00\x00\x00\x00\x00" + b"\x00" * 200)

        # Users configuration:
        # test_user_a: full access ('*')
        # test_user_b: restricted access to only 'AllowedFolder'
        users = app_mod.load_users()
        existing_admin_hash = users.get('admin', {}).get('password_hash') or app_mod.generate_password_hash("sangita123")
        users['admin'] = {
            'username': 'admin',
            'password_hash': existing_admin_hash,
            'role': 'admin',
            'rules': {'allowed_playlists': ['*']}
        }
        users['test_user_a'] = {
            'username': 'test_user_a',
            'role': 'user',
            'rules': {'allowed_playlists': ['*']}
        }
        users['test_user_b'] = {
            'username': 'test_user_b',
            'role': 'user',
            'rules': {'allowed_playlists': ['AllowedFolder']}
        }
        app_mod.save_users(users)

        # Run database init/migration
        app_mod.init_db()

    @classmethod
    def tearDownClass(cls):
        # Restore users.json
        if cls._users_backup is not None:
            with open(app_mod.USERS_FILE, 'w', encoding='utf-8') as f:
                f.write(cls._users_backup)
        elif os.path.exists(app_mod.USERS_FILE):
            os.remove(app_mod.USERS_FILE)

        # Clean up test files and directories in MUSIC_DIR
        for fpath in [cls.song_allowed, cls.song_restricted]:
            if os.path.exists(fpath):
                try:
                    os.remove(fpath)
                except Exception:
                    pass
        for dirpath in [cls.folder_allowed, cls.folder_restricted]:
            if os.path.isdir(dirpath):
                try:
                    import shutil
                    shutil.rmtree(dirpath)
                except Exception:
                    pass

        conn = app_mod.get_db()
        try:
            conn.execute("DELETE FROM source_folders WHERE folder_name IN ('AllowedFolder', 'RestrictedFolder')")
            conn.commit()
        finally:
            conn.close()

    def setUp(self):
        # Refresh database migration before tests
        conn = app_mod.get_db()
        try:
            if hasattr(app_mod, 'migrate_v2_schema'):
                app_mod.migrate_v2_schema(conn)
            conn.commit()
        finally:
            conn.close()

    # =========================================================================
    # 1. Database Schema & Migration Tests
    # =========================================================================
    def test_01_database_tables_exist(self):
        """Verify tables source_folders, artists, playlists, playlist_tracks_v2 exist in SQLite."""
        conn = app_mod.get_db()
        try:
            rows = conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
            table_names = [r["name"] for r in rows]

            # Core required tables for the redesign
            self.assertIn("source_folders", table_names, "Table 'source_folders' must exist")
            self.assertIn("artists", table_names, "Table 'artists' must exist")
            self.assertIn("playlists", table_names, "Table 'playlists' must exist")
            self.assertIn("playlist_tracks_v2", table_names, "Table 'playlist_tracks_v2' must exist")
            self.assertIn("admin_audit_logs", table_names, "Table 'admin_audit_logs' must exist")

            # Check columns in playlists
            cols = [r["name"] for r in conn.execute("PRAGMA table_info(playlists)").fetchall()]
            for expected_col in ["id", "title", "owner", "visibility"]:
                self.assertIn(expected_col, cols, f"Column '{expected_col}' should exist in 'playlists'")

            # Check columns in playlist_tracks_v2
            p_cols = [r["name"] for r in conn.execute("PRAGMA table_info(playlist_tracks_v2)").fetchall()]
            for expected_col in ["playlist_id", "track_path"]:
                self.assertIn(expected_col, p_cols, f"Column '{expected_col}' should exist in 'playlist_tracks_v2'")

            # Check columns in source_folders
            sf_cols = [r["name"] for r in conn.execute("PRAGMA table_info(source_folders)").fetchall()]
            for expected_col in ["folder_name", "classification", "display_name"]:
                self.assertIn(expected_col, sf_cols, f"Column '{expected_col}' should exist in 'source_folders'")
        finally:
            conn.close()

    def test_02_migration_idempotent_and_legacy_data_migrated(self):
        """Verify migration is idempotent and correctly converts legacy user_playlists & playlist_tracks."""
        conn = app_mod.get_db()
        test_pl_name = f"MigratedJams_{uuid.uuid4().hex[:6]}"
        try:
            # Seed legacy user playlist and tracks
            conn.execute(
                "INSERT OR REPLACE INTO user_playlists (username, name) VALUES (?, ?)",
                ("test_user_a", test_pl_name)
            )
            conn.execute(
                "INSERT OR REPLACE INTO playlist_tracks (username, playlist_name, track_path, position) VALUES (?, ?, ?, ?)",
                ("test_user_a", test_pl_name, "AllowedFolder/allowed_track.mp3", 0)
            )
            # Seed Favorites in legacy playlist_tracks
            conn.execute(
                "INSERT OR REPLACE INTO playlist_tracks (username, playlist_name, track_path, position) VALUES (?, 'Favorites', ?, ?)",
                ("test_user_a", "AllowedFolder/allowed_track.mp3", 0)
            )
            conn.commit()

            # Execute migration multiple times to test idempotency
            if hasattr(app_mod, 'migrate_v2_schema'):
                app_mod.migrate_v2_schema(conn)
                app_mod.migrate_v2_schema(conn)
            conn.commit()

            # Verify migrated entry in playlists
            row = conn.execute(
                "SELECT * FROM playlists WHERE owner = ? AND title = ?",
                ("test_user_a", test_pl_name)
            ).fetchone()
            self.assertIsNotNone(row, "Legacy user playlist should be migrated to playlists table")
            self.assertEqual(row["visibility"], "private", "Migrated playlists default to private")
            self.assertEqual(row["is_folder_playlist"], 0, "Migrated user playlists must have is_folder_playlist=0")

            # Verify tracks in playlist_tracks_v2
            t_row = conn.execute(
                "SELECT * FROM playlist_tracks_v2 WHERE playlist_id = ? AND track_path = ?",
                (row["id"], "AllowedFolder/allowed_track.mp3")
            ).fetchone()
            self.assertIsNotNone(t_row, "Tracks must be migrated to playlist_tracks_v2 linked by playlist_id")

            # Verify Favorites is preserved in playlist_tracks and NOT converted to an ordinary playlist in playlists
            fav_in_playlists = conn.execute(
                "SELECT * FROM playlists WHERE owner = ? AND title = 'Favorites'",
                ("test_user_a",)
            ).fetchone()
            self.assertIsNone(fav_in_playlists, "Favorites must not be imported as a regular playlist in playlists table")

            fav_in_tracks = conn.execute(
                "SELECT * FROM playlist_tracks WHERE username = ? AND playlist_name = 'Favorites'",
                ("test_user_a",)
            ).fetchone()
            self.assertIsNotNone(fav_in_tracks, "Favorites must remain preserved in playlist_tracks")
        finally:
            conn.close()

    def test_03_source_folders_scanned_and_populated(self):
        """Verify detected physical folders exist in source_folders with default classification."""
        conn = app_mod.get_db()
        try:
            if hasattr(app_mod, '_get_detected_source_folders'):
                app_mod._get_detected_source_folders(conn=conn)

            rows = conn.execute("SELECT folder_name, classification FROM source_folders").fetchall()
            names = [r["folder_name"] for r in rows]
            self.assertIn("AllowedFolder", names)
            self.assertIn("RestrictedFolder", names)
        finally:
            conn.close()

    # =========================================================================
    # 2. Folder Classification Endpoints Tests
    # =========================================================================
    def test_04_folder_classification_endpoints(self):
        """Test admin folder classification: 'artist', 'playlist', and 'unclassified'."""
        # 1. Non-admin forbidden
        res = self.client.post(
            '/api/admin/library/folders/classify',
            headers=self.user_a_headers,
            json={'folder': 'AllowedFolder', 'classification': 'artist'}
        )
        self.assertEqual(res.status_code, 403, "Regular user cannot classify folders")

        # 2. Unauthenticated unauthorized
        res = self.client.post(
            '/api/admin/library/folders/classify',
            json={'folder': 'AllowedFolder', 'classification': 'artist'}
        )
        self.assertEqual(res.status_code, 401, "Unauthenticated user cannot classify folders")

        # 3. Classify as 'artist' with mapped artist
        res = self.client.post(
            '/api/admin/library/folders/classify',
            headers=self.admin_headers,
            json={
                'folder': 'AllowedFolder',
                'classification': 'artist',
                'display_name': 'Allowed Artists',
                'mapped_artist': 'Alpha Band'
            }
        )
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data['folder']['classification'], 'artist')

        # Check in admin listing
        res = self.client.get('/api/admin/library/folders', headers=self.admin_headers)
        self.assertEqual(res.status_code, 200)
        folders = res.get_json()
        if isinstance(folders, dict):
            folders = folders.get("folders", [])
        af = next((f for f in folders if f.get("folder") == "AllowedFolder"), None)
        self.assertIsNotNone(af)
        self.assertEqual(af["classification"], "artist")

        # 4. Classify as 'playlist'
        res = self.client.post(
            '/api/admin/library/folders/classify',
            headers=self.admin_headers,
            json={'folder': 'AllowedFolder', 'classification': 'playlist', 'display_name': 'Party Mix'}
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.get_json()['folder']['classification'], 'playlist')

        # 5. Reset to 'unclassified'
        res = self.client.post(
            '/api/admin/library/folders/classify',
            headers=self.admin_headers,
            json={'folder': 'AllowedFolder', 'classification': 'unclassified'}
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.get_json()['folder']['classification'], 'unclassified')

    def test_05_catalog_sources_endpoint(self):
        """Test GET /api/v2/catalog/sources returns classification and user access indicators."""
        res = self.client.get('/api/v2/catalog/sources', headers=self.user_b_headers)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        sources = data if isinstance(data, list) else data.get("sources", [])
        self.assertIsInstance(sources, list)

        allowed_source = next((s for s in sources if s.get("name") == "AllowedFolder" or s.get("folder") == "AllowedFolder"), None)
        restricted_source = next((s for s in sources if s.get("name") == "RestrictedFolder" or s.get("folder") == "RestrictedFolder"), None)

        self.assertIsNotNone(allowed_source, "AllowedFolder should be listed in sources")
        self.assertIsNotNone(restricted_source, "RestrictedFolder should be listed in sources")

        # User B has access to AllowedFolder but not RestrictedFolder
        if "has_access" in allowed_source:
            self.assertTrue(allowed_source["has_access"])
            self.assertFalse(restricted_source["has_access"])

    # =========================================================================
    # 3. Playlist Visibility & Track Masking Tests
    # =========================================================================
    def test_06_private_playlist_visibility(self):
        """Private playlist: accessible by owner and admin; returns 404 for other authenticated users."""
        # User A creates a private playlist
        create_res = self.client.post(
            '/api/v2/playlists',
            headers=self.user_a_headers,
            json={
                'title': f'Secret Jam {uuid.uuid4().hex[:6]}',
                'description': 'Private thoughts',
                'visibility': 'private'
            }
        )
        self.assertIn(create_res.status_code, (200, 201))
        playlist = create_res.get_json()
        pid = playlist['id']

        # 1. Owner can access
        res = self.client.get(f'/api/v2/playlists/{pid}', headers=self.user_a_headers)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.get_json()['id'], pid)

        # 2. Admin can access
        res = self.client.get(f'/api/v2/playlists/{pid}', headers=self.admin_headers)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.get_json()['id'], pid)

        # 3. Other authenticated user gets 404
        res = self.client.get(f'/api/v2/playlists/{pid}', headers=self.user_b_headers)
        self.assertEqual(res.status_code, 404, "Private playlist must return 404 to other users")

        # 4. Unauthenticated gets 401
        res = self.client.get(f'/api/v2/playlists/{pid}')
        self.assertEqual(res.status_code, 401, "Unauthenticated request must return 401")

    def test_07_public_playlist_visibility_and_inaccessible_track_masking(self):
        """
        Public playlist: accessible by all authenticated users;
        inaccessible tracks (restricted folders) are masked/filtered out and unavailable_count returned;
        no restricted filepaths or titles are leaked.
        """
        # User A creates a public playlist
        create_res = self.client.post(
            '/api/v2/playlists',
            headers=self.user_a_headers,
            json={
                'title': f'Public Jams {uuid.uuid4().hex[:6]}',
                'description': 'Open for everyone',
                'visibility': 'public'
            }
        )
        self.assertIn(create_res.status_code, (200, 201))
        pid = create_res.get_json()['id']

        # User A adds both AllowedFolder track and RestrictedFolder track
        add_res1 = self.client.post(
            f'/api/v2/playlists/{pid}/tracks',
            headers=self.user_a_headers,
            json={'track_path': 'AllowedFolder/allowed_track.mp3'}
        )
        self.assertIn(add_res1.status_code, (200, 201))

        add_res2 = self.client.post(
            f'/api/v2/playlists/{pid}/tracks',
            headers=self.user_a_headers,
            json={'track_path': 'RestrictedFolder/restricted_secret_song.mp3'}
        )
        self.assertIn(add_res2.status_code, (200, 201))

        # --- Check 1: Owner (User A) retrieves playlist ---
        res_owner = self.client.get(f'/api/v2/playlists/{pid}', headers=self.user_a_headers)
        self.assertEqual(res_owner.status_code, 200)
        owner_data = res_owner.get_json()
        self.assertEqual(len(owner_data.get('tracks', [])), 2, "Owner should see all tracks")
        self.assertEqual(owner_data.get('unavailable_count', 0), 0)

        # --- Check 2: Admin retrieves playlist ---
        res_admin = self.client.get(f'/api/v2/playlists/{pid}', headers=self.admin_headers)
        self.assertEqual(res_admin.status_code, 200)
        admin_data = res_admin.get_json()
        self.assertEqual(len(admin_data.get('tracks', [])), 2, "Admin should see all tracks")
        self.assertEqual(admin_data.get('unavailable_count', 0), 0)

        # --- Check 3: Restricted Viewer (User B) retrieves playlist ---
        res_b = self.client.get(f'/api/v2/playlists/{pid}', headers=self.user_b_headers)
        self.assertEqual(res_b.status_code, 200, "Public playlist must be accessible to User B")
        b_data = res_b.get_json()

        # Track list for User B should ONLY contain the accessible track
        b_tracks = b_data.get('tracks', [])
        self.assertEqual(len(b_tracks), 1, "User B should only see playable tracks")
        actual_track_path = b_tracks[0].get('track_path') or b_tracks[0].get('path')
        self.assertEqual(actual_track_path, 'AllowedFolder/allowed_track.mp3')

        # unavailable_count must be 1
        self.assertEqual(b_data.get('unavailable_count'), 1, "unavailable_count must reflect masked songs")

        # --- Check 4: DATA LEAKAGE VERIFICATION ---
        # Neither the restricted file path nor the restricted title must appear anywhere in User B's response
        raw_response_text = res_b.get_data(as_text=True)
        self.assertNotIn("restricted_secret_song", raw_response_text, "Restricted track name leaked in response!")
        self.assertNotIn("RestrictedFolder", raw_response_text, "Restricted folder path leaked in response!")

    # =========================================================================
    # 4. Playlist Mutations & Permissions Tests
    # =========================================================================
    def test_08_playlist_mutations_and_permissions(self):
        """Only owner or admin can update (PUT) or delete (DELETE) playlists."""
        # User A creates a playlist
        create_res = self.client.post(
            '/api/v2/playlists',
            headers=self.user_a_headers,
            json={'title': 'User A Modifiable', 'visibility': 'private'}
        )
        self.assertIn(create_res.status_code, (200, 201))
        pid = create_res.get_json()['id']

        # 1. Non-owner (User B) attempts update -> 403 or 404
        res = self.client.put(
            f'/api/v2/playlists/{pid}',
            headers=self.user_b_headers,
            json={'title': 'Hijacked Title'}
        )
        self.assertIn(res.status_code, (403, 404), "Non-owner cannot update playlist")

        # 2. Non-owner (User B) attempts delete -> 403 or 404
        res = self.client.delete(f'/api/v2/playlists/{pid}', headers=self.user_b_headers)
        self.assertIn(res.status_code, (403, 404), "Non-owner cannot delete playlist")

        # 3. Non-owner (User B) attempts adding track -> 403 or 404
        res = self.client.post(
            f'/api/v2/playlists/{pid}/tracks',
            headers=self.user_b_headers,
            json={'track_path': 'AllowedFolder/allowed_track.mp3'}
        )
        self.assertIn(res.status_code, (403, 404), "Non-owner cannot add tracks")

        # 4. Owner (User A) updates playlist -> 200
        res = self.client.put(
            f'/api/v2/playlists/{pid}',
            headers=self.user_a_headers,
            json={'title': 'User A Renamed', 'description': 'Updated description', 'visibility': 'public'}
        )
        self.assertEqual(res.status_code, 200)
        updated = res.get_json()
        self.assertEqual(updated.get('title'), 'User A Renamed')
        self.assertEqual(updated.get('visibility'), 'public')

        # 5. Admin updates playlist -> 200
        res = self.client.put(
            f'/api/v2/playlists/{pid}',
            headers=self.admin_headers,
            json={'title': 'Admin Controlled'}
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.get_json().get('title'), 'Admin Controlled')

        # 6. Owner deletes playlist -> 200
        del_res = self.client.delete(f'/api/v2/playlists/{pid}', headers=self.user_a_headers)
        self.assertEqual(del_res.status_code, 200)

        # Confirm playlist no longer exists
        get_res = self.client.get(f'/api/v2/playlists/{pid}', headers=self.user_a_headers)
        self.assertEqual(get_res.status_code, 404)

    def test_09_admin_deletion_safeguards_and_audit_log(self):
        """Admin delete via /api/admin/library/playlists/<id> records an audit log entry."""
        # User A creates a playlist
        create_res = self.client.post(
            '/api/v2/playlists',
            headers=self.user_a_headers,
            json={'title': 'Playlist for Audit Test', 'visibility': 'private'}
        )
        self.assertIn(create_res.status_code, (200, 201))
        pid = create_res.get_json()['id']

        # Non-admin cannot call admin delete endpoint -> 403
        res = self.client.delete(f'/api/admin/library/playlists/{pid}', headers=self.user_a_headers)
        self.assertEqual(res.status_code, 403, "Non-admin cannot use admin delete")

        # Admin deletes playlist
        res = self.client.delete(f'/api/admin/library/playlists/{pid}', headers=self.admin_headers)
        self.assertEqual(res.status_code, 200)

        # Verify audit log in database
        conn = app_mod.get_db()
        try:
            log_row = conn.execute(
                "SELECT * FROM admin_audit_logs WHERE action = 'delete_playlist' AND target_id = ?",
                (str(pid),)
            ).fetchone()
            self.assertIsNotNone(log_row, "Audit log must be created when admin deletes playlist")
            self.assertEqual(log_row["admin_username"], "admin")
        finally:
            conn.close()

    # =========================================================================
    # 5. Backward Compatibility Tests
    # =========================================================================
    def test_10_backward_compatibility_endpoints(self):
        """Verify legacy /api/playlists, /api/user-playlists, /api/favorites remain functional."""
        # 1. GET /api/playlists
        res = self.client.get('/api/playlists', headers=self.user_a_headers)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIsInstance(data, dict, "Legacy /api/playlists must return dict of playlists")
        self.assertIn("Favorites", data, "Favorites must be present in legacy /api/playlists")

        # 2. GET /api/user-playlists
        res = self.client.get('/api/user-playlists', headers=self.user_a_headers)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn("playlists", data, "Legacy /api/user-playlists must return {'playlists': [...]}")

        # 3. GET /api/favorites
        res = self.client.get('/api/favorites', headers=self.user_a_headers)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIsInstance(data, list, "Legacy /api/favorites must return list")

        # 4. Strict source folder enforcement on streaming
        # User B accessing allowed track -> 200 or 206
        res_stream_ok = self.client.get('/api/stream/AllowedFolder/allowed_track.mp3', headers=self.user_b_headers)
        self.assertIn(res_stream_ok.status_code, (200, 206))

        # User B accessing restricted track -> 403 Forbidden
        res_stream_denied = self.client.get('/api/stream/RestrictedFolder/restricted_secret_song.mp3', headers=self.user_b_headers)
        self.assertEqual(res_stream_denied.status_code, 403, "Restricted track stream must return 403")

    # =========================================================================
    # 6. Additional Thorough Redesign Edge Cases
    # =========================================================================
    def test_11_artist_endpoints_and_filtering(self):
        """Test GET /api/v2/artists and /api/v2/artists/<id> with role-based track filtering."""
        # Admin creates an artist
        artist_name = f"Artist_{uuid.uuid4().hex[:6]}"
        res = self.client.post('/api/v2/artists', headers=self.admin_headers, json={
            'name': artist_name,
            'bio': 'Talented musician'
        })
        self.assertEqual(res.status_code, 201)
        artist_id = res.get_json()['id']

        # Map AllowedFolder to this artist
        self.client.post(
            '/api/admin/library/folders/classify',
            headers=self.admin_headers,
            json={'folder': 'AllowedFolder', 'classification': 'artist', 'mapped_artist': artist_name}
        )

        # Listing artists
        res_list = self.client.get('/api/v2/artists', headers=self.user_b_headers)
        self.assertEqual(res_list.status_code, 200)
        artists = res_list.get_json()
        if isinstance(artists, dict):
            artists = artists.get('artists', [])
        found = next((a for a in artists if a['name'] == artist_name), None)
        self.assertIsNotNone(found, f"Artist {artist_name} should be listed in artists")

        # User B gets artist details
        res_detail = self.client.get(f'/api/v2/artists/{artist_id}', headers=self.user_b_headers)
        self.assertEqual(res_detail.status_code, 200)
        detail_data = res_detail.get_json()
        self.assertEqual(detail_data['name'], artist_name)
        self.assertGreaterEqual(len(detail_data.get('tracks', [])), 1)

    def test_12_playlist_creation_validation(self):
        """Test validation on playlist creation: reserved names, empty title, and default privacy."""
        # 1. Reserved name 'Favorites' rejected
        res = self.client.post('/api/v2/playlists', headers=self.user_a_headers, json={'title': 'Favorites'})
        self.assertEqual(res.status_code, 400)

        # 2. Reserved name 'Library' rejected
        res = self.client.post('/api/v2/playlists', headers=self.user_a_headers, json={'title': 'Library'})
        self.assertEqual(res.status_code, 400)

        # 3. Blank title rejected
        res = self.client.post('/api/v2/playlists', headers=self.user_a_headers, json={'title': '   '})
        self.assertEqual(res.status_code, 400)

        # 4. Default privacy is 'private' when visibility omitted
        res = self.client.post('/api/v2/playlists', headers=self.user_a_headers, json={'title': 'Default Privacy PL'})
        self.assertEqual(res.status_code, 201)
        data = res.get_json()
        self.assertEqual(data.get('visibility'), 'private', "Default visibility must be 'private'")

        # Clean up
        self.client.delete(f"/api/v2/playlists/{data['id']}", headers=self.user_a_headers)

    def test_13_playlist_duplicate_tracks_and_reorder(self):
        """Test duplicate track rejection and playlist reordering."""
        # Create playlist
        res = self.client.post('/api/v2/playlists', headers=self.user_a_headers, json={'title': 'Track Mgmt Test'})
        self.assertEqual(res.status_code, 201)
        pid = res.get_json()['id']

        # Add track first time -> 201
        res1 = self.client.post(
            f'/api/v2/playlists/{pid}/tracks',
            headers=self.user_a_headers,
            json={'track_path': 'AllowedFolder/allowed_track.mp3'}
        )
        self.assertEqual(res1.status_code, 201)

        # Add duplicate track -> 409 Conflict
        res2 = self.client.post(
            f'/api/v2/playlists/{pid}/tracks',
            headers=self.user_a_headers,
            json={'track_path': 'AllowedFolder/allowed_track.mp3'}
        )
        self.assertEqual(res2.status_code, 409, "Duplicate track addition should return 409")

        # Delete track from playlist
        del_trk_res = self.client.delete(
            f'/api/v2/playlists/{pid}/tracks',
            headers=self.user_a_headers,
            json={'track_path': 'AllowedFolder/allowed_track.mp3'}
        )
        self.assertEqual(del_trk_res.status_code, 200)

        # Clean up playlist
        self.client.delete(f'/api/v2/playlists/{pid}', headers=self.user_a_headers)

    def test_14_user_cannot_add_inaccessible_tracks(self):
        """User cannot add tracks from restricted folders to their own playlist."""
        res = self.client.post('/api/v2/playlists', headers=self.user_b_headers, json={'title': 'User B Playlist'})
        self.assertEqual(res.status_code, 201)
        pid = res.get_json()['id']

        # User B attempts to add RestrictedFolder song -> 403 Forbidden
        res_forbidden = self.client.post(
            f'/api/v2/playlists/{pid}/tracks',
            headers=self.user_b_headers,
            json={'track_path': 'RestrictedFolder/restricted_secret_song.mp3'}
        )
        self.assertEqual(res_forbidden.status_code, 403, "User cannot add inaccessible song to playlist")

        # Clean up
        self.client.delete(f'/api/v2/playlists/{pid}', headers=self.user_b_headers)

    def test_15_admin_library_playlist_inventory_filters(self):
        """Verify admin library playlist inventory filtering by visibility and search."""
        res_all = self.client.get('/api/admin/library/playlists?visibility=all', headers=self.admin_headers)
        self.assertEqual(res_all.status_code, 200)

        res_pub = self.client.get('/api/admin/library/playlists?visibility=public', headers=self.admin_headers)
        self.assertEqual(res_pub.status_code, 200)
        pub_list = res_pub.get_json()
        if isinstance(pub_list, dict):
            pub_list = pub_list.get('playlists', [])
        for pl in pub_list:
            self.assertEqual(pl.get('visibility'), 'public')

        res_priv = self.client.get('/api/admin/library/playlists?visibility=private', headers=self.admin_headers)
        self.assertEqual(res_priv.status_code, 200)
        priv_list = res_priv.get_json()
        if isinstance(priv_list, dict):
            priv_list = priv_list.get('playlists', [])
        for pl in priv_list:
            self.assertEqual(pl.get('visibility'), 'private')

    def test_16_create_public_playlist_with_description_saves_to_playlists(self):
        """Issue 1: Creating a public playlist with description via /api/user-playlists POST and /api/v2/playlists POST saves visibility='public' and description in playlists."""
        # 1. Via /api/user-playlists POST
        res_legacy = self.client.post('/api/user-playlists', headers=self.user_a_headers, json={
            'name': 'Public Legacy List',
            'description': 'Legacy public description',
            'visibility': 'public'
        })
        self.assertIn(res_legacy.status_code, (200, 201))

        conn = app_mod.get_db()
        try:
            row_v2 = conn.execute("SELECT * FROM playlists WHERE owner = 'test_user_a' AND title = 'Public Legacy List'").fetchone()
            self.assertIsNotNone(row_v2, "Record must exist in playlists table")
            self.assertEqual(row_v2['visibility'], 'public')
            self.assertEqual(row_v2['description'], 'Legacy public description')

            row_legacy = conn.execute("SELECT * FROM user_playlists WHERE username = 'test_user_a' AND name = 'Public Legacy List'").fetchone()
            self.assertIsNotNone(row_legacy)
            self.assertEqual(row_legacy['visibility'], 'public')
        finally:
            conn.close()

        # 2. Via /api/v2/playlists POST
        res_v2 = self.client.post('/api/v2/playlists', headers=self.user_a_headers, json={
            'title': 'Public V2 List',
            'description': 'V2 public description',
            'visibility': 'public'
        })
        self.assertEqual(res_v2.status_code, 201)
        data_v2 = res_v2.get_json()
        self.assertEqual(data_v2['visibility'], 'public')
        self.assertEqual(data_v2['description'], 'V2 public description')

        conn = app_mod.get_db()
        try:
            row_v2_check = conn.execute("SELECT * FROM playlists WHERE id = ?", (data_v2['id'],)).fetchone()
            self.assertIsNotNone(row_v2_check)
            self.assertEqual(row_v2_check['visibility'], 'public')
            self.assertEqual(row_v2_check['description'], 'V2 public description')
        finally:
            conn.close()

        # Clean up
        self.client.delete(f'/api/v2/playlists/{data_v2["id"]}', headers=self.user_a_headers)
        conn = app_mod.get_db()
        try:
            conn.execute("DELETE FROM playlists WHERE title = 'Public Legacy List'")
            conn.execute("DELETE FROM user_playlists WHERE name = 'Public Legacy List'")
            conn.commit()
        finally:
            conn.close()

    def test_17_user_playlists_tracks_enforces_source_folder_access(self):
        """Issue 5: /api/user-playlists/<name>/tracks POST denies access (403) when user lacks access to track's source folder, and succeeds when access is granted."""
        # Create playlist for User B (User B only has access to AllowedFolder, not RestrictedFolder)
        res_create = self.client.post('/api/user-playlists', headers=self.user_b_headers, json={'name': 'User B Guarded'})
        self.assertIn(res_create.status_code, (200, 201))

        # Attempt to add track from RestrictedFolder -> 403 Forbidden
        res_denied = self.client.post(
            '/api/user-playlists/User B Guarded/tracks',
            headers=self.user_b_headers,
            json={'track_path': 'RestrictedFolder/restricted_secret_song.mp3'}
        )
        self.assertEqual(res_denied.status_code, 403, "Must return 403 when user lacks source folder access")

        conn = app_mod.get_db()
        try:
            cnt = conn.execute("SELECT COUNT(*) as c FROM playlist_tracks WHERE username = 'test_user_b' AND playlist_name = 'User B Guarded'").fetchone()['c']
            self.assertEqual(cnt, 0, "Denied track must not be inserted into playlist_tracks")
        finally:
            conn.close()

        # Add track from AllowedFolder -> 200 OK
        res_ok = self.client.post(
            '/api/user-playlists/User B Guarded/tracks',
            headers=self.user_b_headers,
            json={'track_path': 'AllowedFolder/allowed_track.mp3'}
        )
        self.assertEqual(res_ok.status_code, 200, "Must succeed when user has source folder access")

        conn = app_mod.get_db()
        try:
            cnt = conn.execute("SELECT COUNT(*) as c FROM playlist_tracks WHERE username = 'test_user_b' AND playlist_name = 'User B Guarded'").fetchone()['c']
            self.assertEqual(cnt, 1, "Allowed track must be inserted into playlist_tracks")
        finally:
            conn.close()

        # Clean up
        conn = app_mod.get_db()
        try:
            conn.execute("DELETE FROM playlist_tracks WHERE username = 'test_user_b' AND playlist_name = 'User B Guarded'")
            conn.execute("DELETE FROM user_playlists WHERE username = 'test_user_b' AND name = 'User B Guarded'")
            conn.execute("DELETE FROM playlists WHERE owner = 'test_user_b' AND title = 'User B Guarded'")
            conn.commit()
        finally:
            conn.close()

    def test_18_same_name_personal_playlist_and_artist_folder_preservation(self):
        """Issue 3: When a personal playlist has the same name as a physical folder, /api/playlists preserves the personal playlist and does not overwrite it. When a folder is classified as 'artist', it is not included in /api/playlists."""
        # 1. Personal playlist having the same name as physical folder 'AllowedFolder'
        conn = app_mod.get_db()
        try:
            conn.execute("INSERT OR REPLACE INTO user_playlists (username, name) VALUES ('test_user_a', 'AllowedFolder')")
            conn.execute("INSERT OR REPLACE INTO playlist_tracks (username, playlist_name, track_path) VALUES ('test_user_a', 'AllowedFolder', 'RestrictedFolder/restricted_secret_song.mp3')")
            conn.commit()
        finally:
            conn.close()

        res_pl = self.client.get('/api/playlists', headers=self.user_a_headers)
        self.assertEqual(res_pl.status_code, 200)
        data = res_pl.get_json()

        self.assertIn('AllowedFolder', data)
        # Should preserve the personal playlist tracks and NOT be overwritten by physical folder's ['AllowedFolder/allowed_track.mp3']
        self.assertEqual(data['AllowedFolder'], ['RestrictedFolder/restricted_secret_song.mp3'])

        # 2. Folder classified as 'artist' is not included in /api/playlists
        # Classify RestrictedFolder as 'artist'
        res_classify = self.client.post('/api/admin/library/folders/classify', headers=self.admin_headers, json={
            'folder': 'RestrictedFolder',
            'classification': 'artist',
            'display_name': 'Restricted Artist'
        })
        self.assertEqual(res_classify.status_code, 200)

        # GET /api/playlists as user_a (who has wildcard access to all folders)
        res_pl2 = self.client.get('/api/playlists', headers=self.user_a_headers)
        self.assertEqual(res_pl2.status_code, 200)
        data2 = res_pl2.get_json()
        self.assertNotIn('RestrictedFolder', data2, "Folder classified as artist must not be included in /api/playlists")

        # Reclassify RestrictedFolder back to unclassified
        self.client.post('/api/admin/library/folders/classify', headers=self.admin_headers, json={
            'folder': 'RestrictedFolder',
            'classification': 'unclassified'
        })

        # Clean up personal playlist
        conn = app_mod.get_db()
        try:
            conn.execute("DELETE FROM playlist_tracks WHERE username = 'test_user_a' AND playlist_name = 'AllowedFolder'")
            conn.execute("DELETE FROM user_playlists WHERE username = 'test_user_a' AND name = 'AllowedFolder'")
            conn.execute("DELETE FROM playlists WHERE owner = 'test_user_a' AND title = 'AllowedFolder'")
            conn.commit()
        finally:
            conn.close()

    def test_19_admin_delete_removes_both_legacy_and_v2_records(self):
        """Issue 4: Admin delete /api/admin/library/playlists/<id> removes both legacy and v2 records whether int ID or UUID is passed."""
        # 1. Test with Integer ID
        v2_id = str(uuid.uuid4())
        conn = app_mod.get_db()
        try:
            conn.execute("INSERT OR REPLACE INTO user_playlists (username, name, visibility) VALUES ('test_user_a', 'Admin Del Int', 'private')")
            conn.execute("INSERT OR REPLACE INTO playlist_tracks (username, playlist_name, track_path) VALUES ('test_user_a', 'Admin Del Int', 'AllowedFolder/allowed_track.mp3')")
            conn.execute("INSERT OR REPLACE INTO playlists (id, owner, title, description, visibility, is_folder_playlist) VALUES (?, 'test_user_a', 'Admin Del Int', 'desc', 'private', 0)", (v2_id,))
            conn.execute("INSERT OR REPLACE INTO playlist_tracks_v2 (playlist_id, track_path, position) VALUES (?, 'AllowedFolder/allowed_track.mp3', 0)", (v2_id,))
            conn.commit()
            up_row = conn.execute("SELECT id FROM user_playlists WHERE username = 'test_user_a' AND name = 'Admin Del Int'").fetchone()
            int_id = up_row['id']
        finally:
            conn.close()

        del_res1 = self.client.delete(f'/api/admin/library/playlists/{int_id}', headers=self.admin_headers)
        self.assertEqual(del_res1.status_code, 200)

        conn = app_mod.get_db()
        try:
            self.assertIsNone(conn.execute("SELECT * FROM user_playlists WHERE id = ?", (int_id,)).fetchone())
            self.assertEqual(len(conn.execute("SELECT * FROM playlist_tracks WHERE username = 'test_user_a' AND playlist_name = 'Admin Del Int'").fetchall()), 0)
            self.assertIsNone(conn.execute("SELECT * FROM playlists WHERE id = ?", (v2_id,)).fetchone())
            self.assertEqual(len(conn.execute("SELECT * FROM playlist_tracks_v2 WHERE playlist_id = ?", (v2_id,)).fetchall()), 0)
        finally:
            conn.close()

        # Subsequent delete returns 404
        self.assertEqual(self.client.delete(f'/api/admin/library/playlists/{int_id}', headers=self.admin_headers).status_code, 404)

        # 2. Test with UUID
        v2_id2 = str(uuid.uuid4())
        conn = app_mod.get_db()
        try:
            conn.execute("INSERT OR REPLACE INTO playlists (id, owner, title, description, visibility, is_folder_playlist) VALUES (?, 'test_user_a', 'Admin Del UUID', 'desc', 'public', 0)", (v2_id2,))
            conn.execute("INSERT OR REPLACE INTO playlist_tracks_v2 (playlist_id, track_path, position) VALUES (?, 'AllowedFolder/allowed_track.mp3', 0)", (v2_id2,))
            conn.execute("INSERT OR REPLACE INTO user_playlists (username, name, visibility) VALUES ('test_user_a', 'Admin Del UUID', 'public')")
            conn.execute("INSERT OR REPLACE INTO playlist_tracks (username, playlist_name, track_path) VALUES ('test_user_a', 'Admin Del UUID', 'AllowedFolder/allowed_track.mp3')")
            conn.commit()
        finally:
            conn.close()

        del_res2 = self.client.delete(f'/api/admin/library/playlists/{v2_id2}', headers=self.admin_headers)
        self.assertEqual(del_res2.status_code, 200)

        conn = app_mod.get_db()
        try:
            self.assertIsNone(conn.execute("SELECT * FROM playlists WHERE id = ?", (v2_id2,)).fetchone())
            self.assertEqual(len(conn.execute("SELECT * FROM playlist_tracks_v2 WHERE playlist_id = ?", (v2_id2,)).fetchall()), 0)
            self.assertIsNone(conn.execute("SELECT * FROM user_playlists WHERE username = 'test_user_a' AND name = 'Admin Del UUID'").fetchone())
            self.assertEqual(len(conn.execute("SELECT * FROM playlist_tracks WHERE username = 'test_user_a' AND playlist_name = 'Admin Del UUID'").fetchall()), 0)
        finally:
            conn.close()

        # Subsequent delete returns 404
        self.assertEqual(self.client.delete(f'/api/admin/library/playlists/{v2_id2}', headers=self.admin_headers).status_code, 404)

if __name__ == '__main__':
    unittest.main()
