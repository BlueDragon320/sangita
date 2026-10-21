import unittest
import json
import os
import tempfile
import app as app_mod

class TestDataConsumption(unittest.TestCase):
    def setUp(self):
        self.client = app_mod.app.test_client()
        self.user_token = app_mod._make_token('data_tester')
        
        users = app_mod.load_users()
        users['data_tester'] = {
            'username': 'data_tester',
            'password_hash': 'dummy',
            'role': 'user',
            'rules': {'allowed_playlists': ['*']}
        }
        app_mod.save_users(users)
        self.headers = {'Authorization': f'Bearer {self.user_token}'}

    def test_record_and_get_data_usage(self):
        # 1. Record data consumption
        app_mod.record_user_data_consumption('data_tester', 1048576) # 1 MB
        
        # 2. Get data usage
        res = self.client.get('/api/user/data-usage', headers=self.headers)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data['username'], 'data_tester')
        self.assertGreaterEqual(data['today']['bytes'], 1048576)
        self.assertIn('MB', data['today']['formatted'])
        self.assertGreaterEqual(data['total']['bytes'], 1048576)

    def test_post_data_usage_increment(self):
        res = self.client.post('/api/user/data-usage', headers=self.headers, json={
            'bytes': 524288 # 512 KB
        })
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertGreaterEqual(data['today']['bytes'], 524288)

    def test_user_stats_includes_data_consumed(self):
        app_mod.record_user_data_consumption('data_tester', 2097152) # 2 MB
        res = self.client.get('/api/user/stats', headers=self.headers)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn('data_consumed_today', data)
        self.assertIn('data_consumed_total', data)
        self.assertGreaterEqual(data['data_consumed_today']['bytes'], 2097152)

if __name__ == '__main__':
    unittest.main()
