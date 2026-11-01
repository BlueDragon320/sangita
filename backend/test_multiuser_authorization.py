import io
import json
import logging
import os
import sqlite3
import unittest
import uuid
import app as app_mod

class TestMultiUserAuthorization(unittest.TestCase):
    """
    Priority 2 Multi-User Authorization & Security Audit Test Suite:
    - User playlist isolation (private playlist non-owner access/modification/deletion blocked).
    - Restricted folder access (stream, download, cover art, lyrics) scoped by user permissions.
    - Token and credential redaction across logs and stderr/stdout.
    - GPU/Whisper model and telemetry endpoints authorization.
    - Catalog sources access indicators and sensitive metadata leakage prevention.
    - Public playlist track masking for users with different folder access rights.
    """

    @classmethod
    def setUpClass(cls):
        # 1. Back up users.json to ensure isolation
        cls._users_backup = None
        if os.path.exists(app_mod.USERS_FILE):
            with open(app_mod.USERS_FILE, 'r', encoding='utf-8') as f:
                cls._users_backup = f.read()

        cls.app = app_mod.app
        cls.app.config['TESTING'] = True
        cls.client = cls.app.test_client()

        # 2. Setup Tokens for 1 Admin + 2 Non-Admin Users
        cls.admin_token = app_mod._make_token('admin')
        cls.alpha_token = app_mod._make_token('user_alpha')
        cls.beta_token = app_mod._make_token('user_beta')

        cls.admin_headers = {'Authorization': f'Bearer {cls.admin_token}'}
        cls.alpha_headers = {'Authorization': f'Bearer {cls.alpha_token}'}
        cls.beta_headers = {'Authorization': f'Bearer {cls.beta_token}'}

        # 3. Setup Folders and Audio/Image Fixtures
        cls.music_dir = app_mod.MUSIC_DIR
        cls.folder_a = os.path.join(cls.music_dir, "Folder_A")
        cls.folder_b = os.path.join(cls.music_dir, "Folder_B")
        os.makedirs(cls.folder_a, exist_ok=True)
        os.makedirs(cls.folder_b, exist_ok=True)

        cls.track_a1 = os.path.join(cls.folder_a, "track_a1.mp3")
        cls.track_a2 = os.path.join(cls.folder_a, "track_a2.mp3")
        cls.track_b1 = os.path.join(cls.folder_b, "track_b1.mp3")
        cls.track_b2 = os.path.join(cls.folder_b, "track_b2.mp3")

        dummy_audio = b"ID3\x03\x00\x00\x00\x00\x00\x00" + b"\x00" * 300
        for p in [cls.track_a1, cls.track_a2, cls.track_b1, cls.track_b2]:
            if not os.path.exists(p):
                with open(p, "wb") as f:
                    f.write(dummy_audio)

        # 1x1 Minimal valid JPEG
        jpeg_data = (
            b'\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00H\x00H\x00\x00'
            b'\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t\x08\n\x0c\x14\r\x0c'
            b'\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a\x1f\x1e\x1d\x1a\x1c\x1c $.\' ",#\x1c\x1c'
            b'(7),01444\x1f\'9=82<.342\xff\xc0\x00\x0b\x08\x00\x01\x00\x01\x01\x01\x11\x00'
            b'\xff\xc4\x00\x1f\x00\x00\x01\x05\x01\x01\x01\x01\x01\x01\x00\x00\x00\x00\x00\x00\x00'
            b'\x00\x01\x02\x03\x04\x05\x06\x07\x08\t\n\x0b\xff\xda\x00\x08\x01\x01\x00\x00?\x00'
            b'\xbf\x00\xff\xd9'
        )
        cls.cover_a = os.path.join(cls.folder_a, "cover.jpg")
        cls.cover_b = os.path.join(cls.folder_b, "cover.jpg")
        for p in [cls.cover_a, cls.cover_b]:
            if not os.path.exists(p):
                with open(p, "wb") as f:
                    f.write(jpeg_data)

        # 4. Configure Users in users.json:
        # - admin: role='admin', allowed_playlists=['*']
        # - user_alpha: role='user', allowed_folders=['Folder_A']
        # - user_beta: role='user', allowed_folders=['Folder_B']
        users = app_mod.load_users()
        users['admin'] = {
            'username': 'admin',
            'role': 'admin',
            'password_hash': app_mod.generate_password_hash('AdminPass#123'),
            'rules': {'allowed_playlists': ['*']}
        }
        users['user_alpha'] = {
            'username': 'user_alpha',
            'role': 'user',
            'password_hash': app_mod.generate_password_hash('AlphaPass#123'),
            'rules': {'allowed_folders': ['Folder_A']}
        }
        users['user_beta'] = {
            'username': 'user_beta',
            'role': 'user',
            'password_hash': app_mod.generate_password_hash('BetaPass#123'),
            'rules': {'allowed_folders': ['Folder_B']}
        }
        app_mod.save_users(users)
        app_mod.init_db()

    def setUp(self):
        conn = app_mod.get_db()
        try:
            conn.execute("DELETE FROM login_lockouts")
            conn.execute("DELETE FROM playlist_tracks_v2 WHERE playlist_id IN (SELECT id FROM playlists WHERE owner IN ('user_alpha', 'user_beta', 'user_legacy'))")
            conn.execute("DELETE FROM playlists WHERE owner IN ('user_alpha', 'user_beta', 'user_legacy')")
            conn.execute("DELETE FROM playlist_tracks WHERE username IN ('user_alpha', 'user_beta', 'user_legacy')")
            conn.execute("DELETE FROM user_playlists WHERE username IN ('user_alpha', 'user_beta', 'user_legacy')")
            conn.commit()
        finally:
            conn.close()

    @classmethod
    def tearDownClass(cls):
        conn = app_mod.get_db()
        try:
            conn.execute("DELETE FROM playlist_tracks_v2 WHERE playlist_id IN (SELECT id FROM playlists WHERE owner IN ('user_alpha', 'user_beta', 'user_legacy'))")
            conn.execute("DELETE FROM playlists WHERE owner IN ('user_alpha', 'user_beta', 'user_legacy')")
            conn.execute("DELETE FROM playlist_tracks WHERE username IN ('user_alpha', 'user_beta', 'user_legacy')")
            conn.execute("DELETE FROM user_playlists WHERE username IN ('user_alpha', 'user_beta', 'user_legacy')")
            conn.commit()
        finally:
            conn.close()

        if cls._users_backup is not None:
            with open(app_mod.USERS_FILE, 'w', encoding='utf-8') as f:
                f.write(cls._users_backup)

    def test_01_user_alpha_private_playlist_isolation_against_user_beta(self):
        """
        Test User Alpha's private playlist cannot be fetched (/api/v2/playlists/<id>),
        modified, or deleted by User Beta (returns 404 or 403).
        """
        # User Alpha creates private playlist
        create_res = self.client.post('/api/v2/playlists', headers=self.alpha_headers, json={
            'title': 'Alpha Private Chill',
            'description': 'Strictly confidential jams',
            'visibility': 'private'
        })
        self.assertEqual(create_res.status_code, 201)
        pl_data = create_res.get_json()
        alpha_pl_id = pl_data['id']

        # User Alpha adds their track
        add_trk_res = self.client.post(f'/api/v2/playlists/{alpha_pl_id}/tracks', headers=self.alpha_headers, json={
            'track_path': 'Folder_A/track_a1.mp3'
        })
        self.assertEqual(add_trk_res.status_code, 201)

        # 1. User Beta cannot fetch User Alpha's private playlist (must return 404)
        get_res = self.client.get(f'/api/v2/playlists/{alpha_pl_id}', headers=self.beta_headers)
        self.assertIn(get_res.status_code, [403, 404], "User Beta fetching Alpha's private playlist must return 404 or 403")

        # 2. User Beta cannot update User Alpha's private playlist (returns 403 or 404)
        put_res = self.client.put(f'/api/v2/playlists/{alpha_pl_id}', headers=self.beta_headers, json={
            'title': 'Hacked Title By Beta'
        })
        self.assertIn(put_res.status_code, [403, 404])

        # 3. User Beta cannot add tracks to Alpha's private playlist (returns 403 or 404)
        add_by_beta = self.client.post(f'/api/v2/playlists/{alpha_pl_id}/tracks', headers=self.beta_headers, json={
            'track_path': 'Folder_B/track_b1.mp3'
        })
        self.assertIn(add_by_beta.status_code, [403, 404])

        # 4. User Beta cannot delete tracks from Alpha's private playlist (returns 403 or 404)
        del_trk_beta = self.client.delete(f'/api/v2/playlists/{alpha_pl_id}/tracks', headers=self.beta_headers, json={
            'track_path': 'Folder_A/track_a1.mp3'
        })
        self.assertIn(del_trk_beta.status_code, [403, 404])

        # 5. User Beta cannot delete Alpha's private playlist (returns 403 or 404)
        del_pl_beta = self.client.delete(f'/api/v2/playlists/{alpha_pl_id}', headers=self.beta_headers)
        self.assertIn(del_pl_beta.status_code, [403, 404])

        # 6. User Beta cannot clone Alpha's private playlist (returns 404 or 403)
        clone_beta = self.client.post(f'/api/v2/playlists/{alpha_pl_id}/clone', headers=self.beta_headers, json={
            'title': 'Beta Cloned Stolen Playlist'
        })
        self.assertIn(clone_beta.status_code, [403, 404])

        # 7. User Beta cannot save Alpha's private playlist (returns 404 or 403)
        save_beta = self.client.post(f'/api/v2/playlists/{alpha_pl_id}/save', headers=self.beta_headers)
        self.assertIn(save_beta.status_code, [403, 404])

        # 8. User Beta playlist listings do NOT include Alpha's private playlist
        list_library = self.client.get('/api/v2/playlists', headers=self.beta_headers)
        self.assertEqual(list_library.status_code, 200)
        lib_data = list_library.get_json()
        lib_items = lib_data.get('playlists', lib_data if isinstance(lib_data, list) else [])
        lib_ids = [p['id'] for p in lib_items]
        self.assertNotIn(alpha_pl_id, lib_ids)

        list_discover = self.client.get('/api/v2/playlists?discover=true', headers=self.beta_headers)
        self.assertEqual(list_discover.status_code, 200)
        disc_data = list_discover.get_json()
        disc_items = disc_data.get('playlists', disc_data if isinstance(disc_data, list) else [])
        disc_ids = [p['id'] for p in disc_items]
        self.assertNotIn(alpha_pl_id, disc_ids)

        # 9. Admin CAN fetch User Alpha's playlist
        admin_get = self.client.get(f'/api/v2/playlists/{alpha_pl_id}', headers=self.admin_headers)
        self.assertEqual(admin_get.status_code, 200)
        self.assertEqual(admin_get.get_json()['title'], 'Alpha Private Chill')

    def test_02_restricted_folders_playback_and_download_isolation(self):
        """
        Test restricted folders:
        - User Alpha with permission to Folder_A cannot stream or download tracks from Folder_B (403 Forbidden).
        - User Beta with permission to Folder_B cannot stream or download tracks from Folder_A (403 Forbidden).
        - Both users can stream and download from their own permitted folder.
        - Admin can stream and download from all folders.
        """
        # User Alpha attempts to access Folder_B
        res_alpha_stream_b = self.client.get('/api/stream/Folder_B/track_b1.mp3', headers=self.alpha_headers)
        self.assertEqual(res_alpha_stream_b.status_code, 403, "User Alpha must be forbidden from streaming Folder_B")

        res_alpha_dl_b = self.client.get('/api/download/Folder_B/track_b1.mp3', headers=self.alpha_headers)
        self.assertEqual(res_alpha_dl_b.status_code, 403, "User Alpha must be forbidden from downloading Folder_B")

        # User Beta attempts to access Folder_A
        res_beta_stream_a = self.client.get('/api/stream/Folder_A/track_a1.mp3', headers=self.beta_headers)
        self.assertEqual(res_beta_stream_a.status_code, 403, "User Beta must be forbidden from streaming Folder_A")

        res_beta_dl_a = self.client.get('/api/download/Folder_A/track_a1.mp3', headers=self.beta_headers)
        self.assertEqual(res_beta_dl_a.status_code, 403, "User Beta must be forbidden from downloading Folder_A")

        # Legitimate access for User Alpha on Folder_A
        res_alpha_stream_a = self.client.get('/api/stream/Folder_A/track_a1.mp3', headers=self.alpha_headers)
        self.assertIn(res_alpha_stream_a.status_code, [200, 206])
        res_alpha_stream_a.close()

        res_alpha_dl_a = self.client.get('/api/download/Folder_A/track_a1.mp3', headers=self.alpha_headers)
        self.assertEqual(res_alpha_dl_a.status_code, 200)
        res_alpha_dl_a.close()

        # Legitimate access for User Beta on Folder_B
        res_beta_stream_b = self.client.get('/api/stream/Folder_B/track_b1.mp3', headers=self.beta_headers)
        self.assertIn(res_beta_stream_b.status_code, [200, 206])
        res_beta_stream_b.close()

        res_beta_dl_b = self.client.get('/api/download/Folder_B/track_b1.mp3', headers=self.beta_headers)
        self.assertEqual(res_beta_dl_b.status_code, 200)
        res_beta_dl_b.close()

        # Admin access to both folders
        admin_stream_a = self.client.get('/api/stream/Folder_A/track_a1.mp3', headers=self.admin_headers)
        self.assertIn(admin_stream_a.status_code, [200, 206])
        admin_stream_a.close()

        admin_stream_b = self.client.get('/api/stream/Folder_B/track_b1.mp3', headers=self.admin_headers)
        self.assertIn(admin_stream_b.status_code, [200, 206])
        admin_stream_b.close()

        admin_dl_a = self.client.get('/api/download/Folder_A/track_a1.mp3', headers=self.admin_headers)
        self.assertEqual(admin_dl_a.status_code, 200)
        admin_dl_a.close()

        admin_dl_b = self.client.get('/api/download/Folder_B/track_b1.mp3', headers=self.admin_headers)
        self.assertEqual(admin_dl_b.status_code, 200)
        admin_dl_b.close()

    def test_03_cover_art_isolation(self):
        """
        Cover art for tracks in unpermitted folders returns 403 or 404.
        Permitted folder cover art returns 200.
        """
        # User Alpha requesting Folder_B track cover
        res_alpha_b_track = self.client.get('/api/cover/Folder_B/track_b1.mp3', headers=self.alpha_headers)
        self.assertIn(res_alpha_b_track.status_code, [403, 404], "Unpermitted track cover must return 403 or 404")

        # User Alpha requesting Folder_B folder cover
        res_alpha_b_folder = self.client.get('/api/cover/Folder_B', headers=self.alpha_headers)
        self.assertIn(res_alpha_b_folder.status_code, [403, 404], "Unpermitted folder cover must return 403 or 404")

        # User Beta requesting Folder_A track cover
        res_beta_a_track = self.client.get('/api/cover/Folder_A/track_a1.mp3', headers=self.beta_headers)
        self.assertIn(res_beta_a_track.status_code, [403, 404], "Unpermitted track cover must return 403 or 404")

        # User Beta requesting Folder_A folder cover
        res_beta_a_folder = self.client.get('/api/cover/Folder_A', headers=self.beta_headers)
        self.assertIn(res_beta_a_folder.status_code, [403, 404], "Unpermitted folder cover must return 403 or 404")

        # Permitted cover art for User Alpha on Folder_A
        res_alpha_a = self.client.get('/api/cover/Folder_A/track_a1.mp3', headers=self.alpha_headers)
        self.assertEqual(res_alpha_a.status_code, 200)
        self.assertEqual(res_alpha_a.mimetype, 'image/jpeg')

        # Permitted cover art for User Beta on Folder_B
        res_beta_b = self.client.get('/api/cover/Folder_B/track_b1.mp3', headers=self.beta_headers)
        self.assertEqual(res_beta_b.status_code, 200)
        self.assertEqual(res_beta_b.mimetype, 'image/jpeg')

    def test_04_token_redaction_in_logs_and_credentials_privacy(self):
        """
        Verify token redaction in logs: test that invalid login or requests
        do not print secret tokens or passwords to stdout/logs.
        """
        # Setup log capture handler on root, werkzeug, and flask loggers
        log_stream = io.StringIO()
        handler = logging.StreamHandler(log_stream)
        handler.addFilter(app_mod._sensitive_filter)

        root_logger = logging.getLogger()
        werkzeug_logger = logging.getLogger("werkzeug")
        flask_logger = app_mod.app.logger

        root_logger.addHandler(handler)
        werkzeug_logger.addHandler(handler)
        flask_logger.addHandler(handler)

        secret_password_test = "SuperSecretPlainTextPassword_XYZ_999!"
        secret_url_token_test = "SuperSecretQueryToken_Alpha999_ShouldNotBeLogged"
        secret_bearer_test = "SuperSecretBearerToken_Alpha123456789"

        try:
            # 1. Invalid login with secret password
            login_res = self.client.post('/api/login', json={
                'username': 'user_alpha',
                'password': secret_password_test
            })
            self.assertEqual(login_res.status_code, 401)

            # 2. Request with sensitive token in query string
            stream_res = self.client.get(
                f'/api/stream/Folder_A/track_a1.mp3?token={secret_url_token_test}',
                headers={'Authorization': f'Bearer {self.alpha_token}'}
            )
            self.assertIn(stream_res.status_code, [200, 206])
            stream_res.close()

            # 3. Request with custom bearer token
            me_res = self.client.get(
                '/api/me',
                headers={'Authorization': f'Bearer {secret_bearer_test}'}
            )
            # Will be 401 because token is dummy
            self.assertEqual(me_res.status_code, 401)

            # 4. Direct logging test through loggers
            root_logger.info(f"Test log with query ?token={secret_url_token_test} and password={secret_password_test}")
            werkzeug_logger.info(f'GET /api/stream/Folder_A/track_a1.mp3?token={secret_url_token_test} HTTP/1.1')
            flask_logger.warning(f'User failed with Authorization: Bearer {secret_bearer_test}')

            handler.flush()
            captured_logs = log_stream.getvalue()

            # Verify neither secret password nor tokens were ever printed
            self.assertNotIn(secret_password_test, captured_logs, "Secret password must not leak into logs")
            self.assertNotIn(secret_url_token_test, captured_logs, "Secret query token must not leak into logs")
            self.assertNotIn(secret_bearer_test, captured_logs, "Secret bearer token must not leak into logs")

            # Check redaction placeholder was used
            self.assertIn("[REDACTED]", captured_logs, "Logs must contain [REDACTED] placeholder")

            # Direct unit test of SensitiveDataRedactingFilter
            test_filter = app_mod.SensitiveDataRedactingFilter()
            record = logging.LogRecord(
                name="test", level=logging.INFO, pathname=__file__, lineno=10,
                msg="Token in URL: /api/stream?token=abc123456&foo=bar with Bearer mysecrettoken and {\"password\": \"secretpass123\"}",
                args=(), exc_info=None
            )
            test_filter.filter(record)
            self.assertNotIn("abc123456", record.msg)
            self.assertNotIn("mysecrettoken", record.msg)
            self.assertNotIn("secretpass123", record.msg)
            self.assertIn("token=[REDACTED]", record.msg)
            self.assertIn("Bearer [REDACTED]", record.msg)
            self.assertIn('"password": "[REDACTED]"', record.msg)

        finally:
            root_logger.removeHandler(handler)
            werkzeug_logger.removeHandler(handler)
            flask_logger.removeHandler(handler)

    def test_05_optional_gpu_service_and_lyrics_authorization(self):
        """
        Review authorization for lyrics and optional GPU service:
        - Non-admin users cannot access admin lyrics status or telemetry endpoints.
        - Non-admin users cannot download model weights or probe model info via Bearer tokens.
        - Admin can access model info and lyrics endpoints.
        - Non-admin users cannot read lyrics for tracks in folders they are not permitted to access.
        """
        # 1. Non-admin users blocked from admin lyrics status
        self.assertEqual(self.client.get('/api/admin/lyrics/status', headers=self.alpha_headers).status_code, 403)
        self.assertEqual(self.client.get('/api/admin/lyrics/status', headers=self.beta_headers).status_code, 403)

        # 2. Non-admin users blocked from model download/info endpoints
        res_info_alpha = self.client.get('/api/lyrics/model/small/info', headers=self.alpha_headers)
        self.assertEqual(res_info_alpha.status_code, 401, "Non-admin token must be rejected on model info")

        res_model_beta = self.client.get('/api/lyrics/model/small/model.bin', headers=self.beta_headers)
        self.assertEqual(res_model_beta.status_code, 401, "Non-admin token must be rejected on model download")

        # 3. Admin token allowed to query model info
        res_info_admin = self.client.get('/api/lyrics/model/small/info', headers=self.admin_headers)
        self.assertEqual(res_info_admin.status_code, 200)

        # 4. User Alpha cannot get lyrics for Folder_B track (403 Forbidden)
        res_lrc_alpha = self.client.get('/api/lyrics/Folder_B/track_b1.mp3', headers=self.alpha_headers)
        self.assertEqual(res_lrc_alpha.status_code, 403)

        # User Beta cannot get lyrics for Folder_A track (403 Forbidden)
        res_lrc_beta = self.client.get('/api/lyrics/Folder_A/track_a1.mp3', headers=self.beta_headers)
        self.assertEqual(res_lrc_beta.status_code, 403)

    def test_06_catalog_sources_and_folder_permissions_isolation(self):
        """
        Catalog sources endpoint must mark has_access=True for permitted folders,
        has_access=False for unpermitted, and suppress track_count (0) for unpermitted folders.
        """
        res_sources_alpha = self.client.get('/api/v2/catalog/sources', headers=self.alpha_headers)
        self.assertEqual(res_sources_alpha.status_code, 200)
        sources_alpha = {s['name']: s for s in res_sources_alpha.get_json().get('sources', [])}

        self.assertIn('Folder_A', sources_alpha)
        self.assertTrue(sources_alpha['Folder_A']['has_access'])
        self.assertGreater(sources_alpha['Folder_A']['track_count'], 0)

        if 'Folder_B' in sources_alpha:
            self.assertFalse(sources_alpha['Folder_B']['has_access'])
            self.assertEqual(sources_alpha['Folder_B']['track_count'], 0, "Unpermitted folder must not leak track count")

        # User Beta
        res_sources_beta = self.client.get('/api/v2/catalog/sources', headers=self.beta_headers)
        self.assertEqual(res_sources_beta.status_code, 200)
        sources_beta = {s['name']: s for s in res_sources_beta.get_json().get('sources', [])}

        self.assertIn('Folder_B', sources_beta)
        self.assertTrue(sources_beta['Folder_B']['has_access'])
        self.assertGreater(sources_beta['Folder_B']['track_count'], 0)

        if 'Folder_A' in sources_beta:
            self.assertFalse(sources_beta['Folder_A']['has_access'])
            self.assertEqual(sources_beta['Folder_A']['track_count'], 0, "Unpermitted folder must not leak track count")

    def test_07_public_playlist_track_masking_across_users(self):
        """
        When viewing a public playlist containing tracks from multiple folders:
        - Tracks from unpermitted folders are omitted from the tracks array.
        - unavailable_count is incremented without leaking restricted track paths or metadata.
        """
        # User Alpha creates a public playlist
        create_res = self.client.post('/api/v2/playlists', headers=self.alpha_headers, json={
            'title': 'Alpha Public Mixtape',
            'visibility': 'public'
        })
        self.assertEqual(create_res.status_code, 201)
        pub_pl_id = create_res.get_json()['id']

        # Add Folder_A track (permitted for Alpha)
        self.client.post(f'/api/v2/playlists/{pub_pl_id}/tracks', headers=self.alpha_headers, json={
            'track_path': 'Folder_A/track_a1.mp3'
        })

        # Admin adds Folder_B track to the playlist
        self.client.post(f'/api/v2/playlists/{pub_pl_id}/tracks', headers=self.admin_headers, json={
            'track_path': 'Folder_B/track_b1.mp3'
        })

        # User Beta views the public playlist
        beta_view = self.client.get(f'/api/v2/playlists/{pub_pl_id}', headers=self.beta_headers)
        self.assertEqual(beta_view.status_code, 200)
        data = beta_view.get_json()

        # User Beta can only see Folder_B track in 'tracks'
        returned_paths = [t['track_path'] for t in data['tracks']]
        self.assertIn('Folder_B/track_b1.mp3', returned_paths)
        self.assertNotIn('Folder_A/track_a1.mp3', returned_paths, "Restricted track path must not be visible to User Beta")
        self.assertEqual(data['unavailable_count'], 1)

    def test_08_allowed_playlists_backwards_compatibility(self):
        """
        Verify users configured with legacy 'allowed_playlists' rule behave identically
        to those configured with 'allowed_folders'.
        """
        users = app_mod.load_users()
        users['user_legacy'] = {
            'username': 'user_legacy',
            'role': 'user',
            'password_hash': app_mod.generate_password_hash('LegacyPass#123'),
            'rules': {'allowed_playlists': ['Folder_A']}
        }
        app_mod.save_users(users)
        legacy_token = app_mod._make_token('user_legacy')
        legacy_headers = {'Authorization': f'Bearer {legacy_token}'}

        # Permitted on Folder_A
        res_a = self.client.get('/api/stream/Folder_A/track_a1.mp3', headers=legacy_headers)
        self.assertIn(res_a.status_code, [200, 206])
        res_a.close()

        # Forbidden on Folder_B
        res_b = self.client.get('/api/stream/Folder_B/track_b1.mp3', headers=legacy_headers)
        self.assertEqual(res_b.status_code, 403)


if __name__ == '__main__':
    unittest.main()
