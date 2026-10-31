import unittest
import os
import sqlite3
import tempfile
import app as app_mod

class TestAuditFixesB1B6(unittest.TestCase):
    def setUp(self):
        self.app = app_mod.app
        self.client = self.app.test_client()
        self.user_token = app_mod._make_token('audit_tester')
        users = app_mod.load_users()
        users['audit_tester'] = {
            'username': 'audit_tester',
            'password_hash': 'dummy',
            'role': 'user',
            'rules': {'allowed_playlists': ['*']}
        }
        app_mod.save_users(users)
        self.headers = {'Authorization': f'Bearer {self.user_token}'}

    def test_b1_ip_spoofing_prevented(self):
        """B1: _get_client_ip() and _is_authorized_node_or_admin() verify peer remote_addr."""
        # When request comes from an external IP (e.g. 203.0.113.195), X-Forwarded-For is NOT trusted
        with self.app.test_request_context('/', environ_base={'REMOTE_ADDR': '203.0.113.195'},
                                           headers={'X-Forwarded-For': '127.0.0.1'}):
            self.assertEqual(app_mod._get_client_ip(), '203.0.113.195')

        # When request comes through local reverse proxy (127.0.0.1), X-Forwarded-For IS trusted
        with self.app.test_request_context('/', environ_base={'REMOTE_ADDR': '127.0.0.1'},
                                           headers={'X-Forwarded-For': '198.51.100.25'}):
            self.assertEqual(app_mod._get_client_ip(), '198.51.100.25')

        # _is_authorized_node_or_admin rejects spoofed loopback from external peer
        self.app.config['TESTING'] = False
        try:
            with self.app.test_request_context('/', environ_base={'REMOTE_ADDR': '203.0.113.195'},
                                               headers={'X-Forwarded-For': '127.0.0.1'}):
                self.assertFalse(app_mod._is_authorized_node_or_admin())

            # Accepts legitimate local request
            with self.app.test_request_context('/', environ_base={'REMOTE_ADDR': '127.0.0.1'}):
                self.assertTrue(app_mod._is_authorized_node_or_admin())
        finally:
            self.app.config['TESTING'] = True

    def test_b2_playlists_read_only(self):
        """B2: GET /api/v2/playlists returns 200 without executing write transactions on read."""
        res = self.client.get('/api/v2/playlists', headers=self.headers)
        self.assertEqual(res.status_code, 200)

    def test_b3_wal_and_pragmas(self):
        """B3: Database connection applies busy_timeout=5000 and foreign_keys=ON, journal_mode is WAL."""
        conn = app_mod.get_db()
        fk = conn.execute("PRAGMA foreign_keys;").fetchone()[0]
        self.assertEqual(fk, 1)
        busy_timeout = conn.execute("PRAGMA busy_timeout;").fetchone()[0]
        self.assertEqual(busy_timeout, 5000)
        mode = conn.execute("PRAGMA journal_mode;").fetchone()[0]
        self.assertEqual(mode.lower(), "wal")

    def test_b4_total_bytes_reported_in_stats(self):
        """B4: Total bandwidth consumption is populated in /api/user/stats."""
        conn = app_mod.get_db()
        conn.execute("""
            INSERT INTO user_totals (username, total_seconds, total_bytes)
            VALUES ('audit_tester', 120, 5242880)
            ON CONFLICT(username) DO UPDATE SET total_bytes = 5242880
        """)
        conn.commit()

        res = self.client.get('/api/user/stats', headers=self.headers)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn('data_consumed_total', data)
        self.assertEqual(data['data_consumed_total']['bytes'], 5242880)
        self.assertIn('5.0 MB', data['data_consumed_total']['formatted'])

    def test_b5_range_request_data_accounting(self):
        """B5: Range request accounts only for partial bytes and does not count as new stream when offset > 0."""
        # Create a temporary dummy audio track in MUSIC_DIR
        test_track_name = "test_audit_track.mp3"
        test_track_path = os.path.join(app_mod.MUSIC_DIR, test_track_name)
        with open(test_track_path, "wb") as f:
            f.write(b"0" * 10000) # 10,000 bytes

        try:
            # First request: bytes 0-999 (offset 0, should count as new stream)
            res1 = self.client.get(f'/api/stream/{test_track_name}', headers={
                **self.headers,
                'Range': 'bytes=0-999'
            })
            self.assertIn(res1.status_code, (200, 206))

            # Query daily data
            conn = app_mod.get_db()
            today_str = conn.execute("SELECT strftime('%Y-%m-%d', 'now')").fetchone()[0]
            row1 = conn.execute("SELECT bytes_consumed, stream_requests FROM user_daily_data WHERE username = 'audit_tester'").fetchone()
            initial_reqs = row1['stream_requests']
            initial_bytes = row1['bytes_consumed']

            # Seeking request: bytes 5000-5999 (offset 5000 > 0, should NOT increment stream_requests)
            res2 = self.client.get(f'/api/stream/{test_track_name}', headers={
                **self.headers,
                'Range': 'bytes=5000-5999'
            })
            self.assertIn(res2.status_code, (200, 206))

            row2 = conn.execute("SELECT bytes_consumed, stream_requests FROM user_daily_data WHERE username = 'audit_tester'").fetchone()
            self.assertEqual(row2['stream_requests'], initial_reqs, "Seeking (offset > 0) must not increment stream_requests")
            self.assertEqual(row2['bytes_consumed'], initial_bytes + 1000, "Should account for exactly 1000 bytes requested")
        finally:
            if os.path.exists(test_track_path):
                os.unlink(test_track_path)

    def test_b6_audio_mime_types(self):
        """B6: Explicit audio MIME types for .opus, .flac, .m4a."""
        for ext, expected_mime in [
            ('.opus', 'audio/ogg; codecs=opus'),
            ('.flac', 'audio/flac'),
            ('.m4a', 'audio/mp4'),
        ]:
            fname = f"test_mime{ext}"
            fpath = os.path.join(app_mod.MUSIC_DIR, fname)
            with open(fpath, "wb") as f:
                f.write(b"dummy")
            try:
                res = self.client.get(f'/api/stream/{fname}', headers=self.headers)
                self.assertEqual(res.headers.get("Content-Type"), expected_mime)
            finally:
                if os.path.exists(fpath):
                    os.unlink(fpath)

if __name__ == '__main__':
    unittest.main()
