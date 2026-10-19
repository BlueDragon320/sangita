import unittest
import json
import os
import app as app_mod

class TestSecurityAudit(unittest.TestCase):
    def setUp(self):
        self.app = app_mod.app
        self.app.config['TESTING'] = True
        self.client = self.app.test_client()
        self.admin_token = app_mod._make_token('admin')
        self.user_token = app_mod._make_token('sec_tester')

        users = app_mod.load_users()
        users['sec_tester'] = {
            'username': 'sec_tester',
            'password_hash': app_mod.generate_password_hash('password123'),
            'role': 'user',
            'rules': {'allowed_playlists': ['*']}
        }
        app_mod.save_users(users)

    def test_security_headers_present(self):
        """Item 11: Verify OWASP Security Headers & CSP are added to responses."""
        res = self.client.get('/api/login')
        self.assertEqual(res.headers.get('X-Content-Type-Options'), 'nosniff')
        self.assertEqual(res.headers.get('X-Frame-Options'), 'SAMEORIGIN')
        self.assertEqual(res.headers.get('X-XSS-Protection'), '1; mode=block')
        self.assertIn('Content-Security-Policy', res.headers)
        self.assertIn('Permissions-Policy', res.headers)

    def test_admin_routes_forbidden_for_regular_user(self):
        """Item 3 & 5: Ensure non-admin users cannot access admin routes."""
        user_headers = {'Authorization': f'Bearer {self.user_token}'}
        endpoints = [
            ('/api/admin/users', 'GET'),
            ('/api/admin/analytics', 'GET'),
            ('/api/admin/logs', 'GET'),
            ('/api/admin/export', 'GET'),
            ('/api/admin/stats', 'GET'),
            ('/api/admin/lyrics/status', 'GET')
        ]
        for url, method in endpoints:
            if method == 'GET':
                res = self.client.get(url, headers=user_headers)
            self.assertEqual(res.status_code, 403, f"Endpoint {url} should return 403 for regular user")

    def test_unauthenticated_requests_rejected(self):
        """Item 4: Verify unauthenticated requests return 401."""
        res = self.client.get('/api/me')
        self.assertEqual(res.status_code, 401)
        res = self.client.get('/api/playlists')
        self.assertEqual(res.status_code, 401)

    def test_form_sanitization_username_regex(self):
        """Item 6 & 7: Form sanitization rejects invalid usernames and weak passwords."""
        admin_headers = {'Authorization': f'Bearer {self.admin_token}'}
        # Malicious / invalid characters in username
        invalid_users = ["<script>alert(1)</script>", "admin; DROP TABLE users;--", "user name with spaces", "a"]
        for bad_u in invalid_users:
            res = self.client.post('/api/admin/users', headers=admin_headers, json={
                'username': bad_u,
                'password': 'validPassword123',
                'role': 'user'
            })
            self.assertEqual(res.status_code, 400, f"Username '{bad_u}' should be rejected with 400")

        # Weak password (< 6 chars)
        res = self.client.post('/api/admin/users', headers=admin_headers, json={
            'username': 'good_username',
            'password': '123',
            'role': 'user'
        })
        self.assertEqual(res.status_code, 400)
        self.assertIn('at least 6 characters', res.get_json().get('error', ''))

    def test_path_traversal_protections(self):
        """Item 9 & 15: Verify path traversal attempts are blocked."""
        user_headers = {'Authorization': f'Bearer {self.user_token}'}
        # Stream traversal
        res = self.client.get('/api/stream/../../etc/passwd', headers=user_headers)
        self.assertEqual(res.status_code, 403)

        # Lyrics traversal
        res = self.client.get('/api/lyrics/../../etc/shadow', headers=user_headers)
        self.assertEqual(res.status_code, 403)

        # User playlist track traversal
        res = self.client.post('/api/user-playlists/TestPL/tracks', headers=user_headers, json={
            'track_path': '../../etc/passwd'
        })
        self.assertEqual(res.status_code, 400)

    def test_rate_limiter_logic(self):
        """Item 8: Verify in-memory sliding-window rate limiter mechanics."""
        self.app.config['TESTING'] = False
        try:
            limiter = app_mod.SlidingWindowRateLimiter()
            test_key = "test_ip_1"
            # 3 requests allowed in 60s
            self.assertTrue(limiter.is_allowed(test_key, 3, 60)[0])
            self.assertTrue(limiter.is_allowed(test_key, 3, 60)[0])
            self.assertTrue(limiter.is_allowed(test_key, 3, 60)[0])
            # 4th request must be rejected
            allowed, retry_after = limiter.is_allowed(test_key, 3, 60)
            self.assertFalse(allowed)
            self.assertGreater(retry_after, 0)
        finally:
            self.app.config['TESTING'] = True

    def test_persistent_secret_key(self):
        """Item 1 & 2: Ensure generated SECRET_KEY is >= 32 characters and non-default."""
        self.assertIsNotNone(app_mod.SECRET_KEY)
        self.assertGreaterEqual(len(app_mod.SECRET_KEY), 32)
        self.assertNotEqual(app_mod.SECRET_KEY, "change-this-secret")

if __name__ == '__main__':
    unittest.main()
