import unittest
import json
import os
import sqlite3
import app as app_mod

class TestAdminAPI(unittest.TestCase):
    def setUp(self):
        self.app = app_mod.app
        self.app.config['TESTING'] = True
        self.client = self.app.test_client()
        self.admin_token = app_mod._make_token('admin')
        self.user_token = app_mod._make_token('test_user_nonadmin')

        # Insert dummy user
        users = app_mod.load_users()
        users['test_user_nonadmin'] = {
            'username': 'test_user_nonadmin',
            'password_hash': 'test',
            'role': 'user',
            'rules': {'allowed_playlists': ['*']}
        }
        app_mod.save_users(users)

    def test_unauthorized_access(self):
        # No token
        res = self.client.get('/api/admin/analytics')
        self.assertEqual(res.status_code, 401)

        # Non-admin token
        res = self.client.get('/api/admin/analytics', headers={'Authorization': f'Bearer {self.user_token}'})
        self.assertEqual(res.status_code, 403)

    def test_analytics_endpoint(self):
        headers = {'Authorization': f'Bearer {self.admin_token}'}
        
        # Test 24h
        res = self.client.get('/api/admin/analytics?timeframe=24h', headers=headers)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn('kpis', data)
        self.assertIn('timeline', data)
        self.assertIn('hourly_distribution', data)
        self.assertEqual(len(data['hourly_distribution']), 24)
        self.assertIn('weekday_distribution', data)
        self.assertEqual(len(data['weekday_distribution']), 7)
        self.assertIn('peak_hour', data['kpis'])
        self.assertIn('peak_vs_avg', data['kpis'])

        # Test 7d, 30d, 90d, all
        for tf in ['7d', '30d', '90d', 'all']:
            res = self.client.get(f'/api/admin/analytics?timeframe={tf}', headers=headers)
            self.assertEqual(res.status_code, 200)

    def test_logs_endpoint(self):
        headers = {'Authorization': f'Bearer {self.admin_token}'}
        res = self.client.get('/api/admin/logs?page=1&limit=10', headers=headers)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn('events', data)
        self.assertIn('total', data)
        self.assertIn('page', data)

    def test_timezone_analytics(self):
        headers = {'Authorization': f'Bearer {self.admin_token}'}
        
        # Default IST
        res = self.client.get('/api/admin/analytics?timeframe=24h', headers=headers)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data.get('timezone'), 'Asia/Kolkata')
        
        # Explicit UTC
        res = self.client.get('/api/admin/analytics?timeframe=24h&tz=UTC', headers=headers)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data.get('timezone'), 'UTC')

        # User listening history with timezone
        user_headers = {'Authorization': f'Bearer {self.user_token}'}
        res = self.client.get('/api/user/listening-history?range=24h&tz=Asia/Kolkata', headers=user_headers)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data.get('timezone'), 'Asia/Kolkata')

    def test_export_endpoint(self):
        headers = {'Authorization': f'Bearer {self.admin_token}'}
        res = self.client.get('/api/admin/export?tz=Asia/Kolkata', headers=headers)
        self.assertEqual(res.status_code, 200)
        self.assertIn('text/csv', res.content_type)
        self.assertIn(b'Timestamp (Asia/Kolkata)', res.data)

    def test_user_management(self):
        headers = {'Authorization': f'Bearer {self.admin_token}'}
        
        # Create user
        res = self.client.post('/api/admin/users', headers=headers, json={
            'username': 'dj_producer',
            'password': 'password123',
            'role': 'user',
            'rules': {'allowed_playlists': ['Electronic']}
        })
        self.assertEqual(res.status_code, 201)

        # Get users
        res = self.client.get('/api/admin/users', headers=headers)
        self.assertEqual(res.status_code, 200)
        user_list = res.get_json()
        usernames = [u['username'] for u in user_list]
        self.assertIn('dj_producer', usernames)

        # Update user
        res = self.client.put('/api/admin/users/dj_producer', headers=headers, json={
            'role': 'admin'
        })
        self.assertEqual(res.status_code, 200)

        # Delete user
        res = self.client.delete('/api/admin/users/dj_producer', headers=headers)
        self.assertEqual(res.status_code, 200)

if __name__ == '__main__':
    unittest.main()
