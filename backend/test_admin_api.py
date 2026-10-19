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

    def test_lyrics_endpoints(self):
        # 1. Unauthorized
        res = self.client.get('/api/lyrics/nonexistent.mp3')
        self.assertEqual(res.status_code, 401)

        # 2. Authorized query for missing lyrics
        res = self.client.get('/api/lyrics/nonexistent.mp3', headers={'Authorization': f'Bearer {self.user_token}'})
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertFalse(data.get('has_lyrics'))

        # 3. Path traversal protection
        res = self.client.get('/api/lyrics/../../etc/passwd', headers={'Authorization': f'Bearer {self.user_token}'})
        self.assertEqual(res.status_code, 403)

    def test_admin_lyrics_control(self):
        admin_headers = {'Authorization': f'Bearer {self.admin_token}'}
        user_headers = {'Authorization': f'Bearer {self.user_token}'}

        # Non-admin forbidden
        res = self.client.get('/api/admin/lyrics/status', headers=user_headers)
        self.assertEqual(res.status_code, 403)

        # Admin status
        res = self.client.get('/api/admin/lyrics/status', headers=admin_headers)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn('job', data)
        self.assertIn('resources', data)

        # Admin logs
        res = self.client.get('/api/admin/lyrics/logs', headers=admin_headers)
        self.assertEqual(res.status_code, 200)
        self.assertIn('logs', res.get_json())

        # Admin edit / create .lrc
        test_content = "[00:01.00] Hello Sangita\n[00:03.50] Synced Lyrics Test"
        res = self.client.put('/api/admin/lyrics/edit', headers=admin_headers, json={
            'filepath': 'test_song.mp3',
            'content': test_content
        })
        self.assertEqual(res.status_code, 200)

        # Verify lyrics can be read back via /api/lyrics
        res = self.client.get('/api/lyrics/test_song.mp3', headers=user_headers)
        self.assertEqual(res.status_code, 200)
        lyrics_data = res.get_json()
        self.assertTrue(lyrics_data.get('has_lyrics'))
        self.assertIn('Hello Sangita', lyrics_data.get('raw', ''))

        # Clean up test .lrc
        test_lrc = os.path.join(app_mod.MUSIC_DIR, 'test_song.lrc')
        if os.path.isfile(test_lrc):
            try:
                os.remove(test_lrc)
            except Exception:
                pass

    def test_admin_lyrics_start_api_flag(self):
        from unittest.mock import patch
        admin_headers = {'Authorization': f'Bearer {self.admin_token}'}

        with patch('subprocess.Popen') as mock_popen, patch('psutil.pid_exists', return_value=False):
            mock_proc = mock_popen.return_value
            mock_proc.pid = 99999

            # 1. API: True (default)
            res = self.client.post('/api/admin/lyrics/start', headers=admin_headers, json={'api': True})
            self.assertEqual(res.status_code, 202)
            cmd_args = mock_popen.call_args[0][0]
            self.assertNotIn('--no-api', cmd_args)

            # 2. API: False (Direct Local Models)
            res = self.client.post('/api/admin/lyrics/start', headers=admin_headers, json={'api': False})
            self.assertEqual(res.status_code, 202)
            cmd_args = mock_popen.call_args[0][0]
            self.assertIn('--no-api', cmd_args)

            # 3. Remote Whisper URL provided
            res = self.client.post('/api/admin/lyrics/start', headers=admin_headers, json={'remote_whisper_url': 'http://192.168.1.50:8000'})
            self.assertEqual(res.status_code, 202)
            cmd_args = mock_popen.call_args[0][0]
            self.assertIn('--remote-whisper-url', cmd_args)
            self.assertIn('http://192.168.1.50:8000', cmd_args)

            # 4. Exclusive GPU mode (only_remote_gpu: True)
            res = self.client.post('/api/admin/lyrics/start', headers=admin_headers, json={
                'remote_whisper_url': 'http://192.168.1.50:8000',
                'only_remote_gpu': True
            })
            self.assertEqual(res.status_code, 202)
            cmd_args = mock_popen.call_args[0][0]
            self.assertIn('--only-remote-gpu', cmd_args)
            self.assertIn('--remote-whisper-url', cmd_args)

        # 5. Check status endpoint reports only_remote_gpu
        res = self.client.get('/api/admin/lyrics/status', headers=admin_headers)
        self.assertEqual(res.status_code, 200)
        status_json = res.get_json()
        self.assertIn('only_remote_gpu', status_json)
        self.assertTrue(status_json['only_remote_gpu'])

    def test_admin_lyrics_test_remote_endpoint(self):
        from unittest.mock import patch, MagicMock
        admin_headers = {'Authorization': f'Bearer {self.admin_token}'}

        # Empty URL
        res = self.client.post('/api/admin/lyrics/test-remote', headers=admin_headers, json={'url': ''})
        self.assertEqual(res.status_code, 400)

        # Successful connection
        with patch('requests.get') as mock_get:
            mock_res = MagicMock(status_code=200)
            mock_res.json.return_value = {
                "status": "ready",
                "device": "cuda",
                "gpu_name": "NVIDIA GeForce RTX 3060",
                "has_cuda": True,
                "total_vram_mb": 6144,
                "used_vram_mb": 20,
                "active_job": "idle"
            }
            mock_get.return_value = mock_res

            res = self.client.post('/api/admin/lyrics/test-remote', headers=admin_headers, json={'url': 'http://192.168.1.50:8000'})
            self.assertEqual(res.status_code, 200)
            data = res.get_json()
            self.assertTrue(data['online'])
            self.assertEqual(data['gpu_name'], 'NVIDIA GeForce RTX 3060')
            self.assertTrue(data['has_cuda'])

        # Unreachable connection
        with patch('requests.get', side_effect=Exception("Connection timed out")):
            res = self.client.post('/api/admin/lyrics/test-remote', headers=admin_headers, json={'url': 'http://192.168.1.50:8000'})
            self.assertEqual(res.status_code, 200)
            data = res.get_json()
            self.assertFalse(data['online'])
            self.assertIn('Unreachable', data['error'])

    def test_lyrics_model_streaming_endpoints(self):
        # Model info endpoint
        res = self.client.get('/api/lyrics/model/small/info')
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data.get('model'), 'small')
        self.assertIn('available', data)

        # Non-existent file
        res = self.client.get('/api/lyrics/model/nonexistent_model/model.bin')
        self.assertEqual(res.status_code, 404)

    def test_admin_lyrics_remote_prime_purge_settings(self):
        from unittest.mock import patch, MagicMock
        admin_headers = {'Authorization': f'Bearer {self.admin_token}'}

        with patch('requests.post') as mock_post, patch('requests.get') as mock_get:
            # 1. Remote Prime
            mock_prime_res = MagicMock(status_code=200)
            mock_prime_res.json.return_value = {"success": True, "message": "Model primed into RAM"}
            mock_post.return_value = mock_prime_res

            res = self.client.post('/api/admin/lyrics/remote-prime', headers=admin_headers, json={
                'url': 'http://127.0.0.1:8000',
                'model': 'small',
                'source': 'online'
            })
            self.assertEqual(res.status_code, 200)
            self.assertTrue(res.get_json()['success'])

            # 2. Remote Purge
            mock_purge_res = MagicMock(status_code=200)
            mock_purge_res.json.return_value = {"success": True, "message": "Purged from RAM/GPU"}
            mock_post.return_value = mock_purge_res

            res = self.client.post('/api/admin/lyrics/remote-purge', headers=admin_headers, json={
                'url': 'http://127.0.0.1:8000'
            })
            self.assertEqual(res.status_code, 200)
            self.assertTrue(res.get_json()['success'])

            # 3. Remote Settings POST
            mock_settings_res = MagicMock(status_code=200)
            mock_settings_res.json.return_value = {
                "success": True,
                "limits": {"cpu_threads": 4, "max_ram_mb": 8192, "cooldown_sec": 1.0}
            }
            mock_post.return_value = mock_settings_res

            res = self.client.post('/api/admin/lyrics/remote-settings', headers=admin_headers, json={
                'url': 'http://127.0.0.1:8000',
                'cpu_threads': 4,
                'max_ram_mb': 8192,
                'cooldown_sec': 1.0
            })
            self.assertEqual(res.status_code, 200)
            self.assertTrue(res.get_json()['success'])

            # 4. Remote Settings GET
            mock_get.return_value = mock_settings_res
            res = self.client.get('/api/admin/lyrics/remote-settings?url=http://127.0.0.1:8000', headers=admin_headers)
            self.assertEqual(res.status_code, 200)


    def test_login_lockout_after_three_failed_attempts(self):
        # Clean any existing lockouts for test IP
        test_ip = "192.168.99.99"
        headers = {"X-Forwarded-For": test_ip}

        # Attempt 1: wrong password -> 401 (2 attempts remaining)
        res1 = self.client.post('/api/login', headers=headers, json={
            'username': 'admin',
            'password': 'wrong_password_1'
        })
        self.assertEqual(res1.status_code, 401)
        self.assertIn('2 attempts remaining', res1.get_json()['error'])

        # Attempt 2: wrong password -> 401 (1 attempt remaining)
        res2 = self.client.post('/api/login', headers=headers, json={
            'username': 'admin',
            'password': 'wrong_password_2'
        })
        self.assertEqual(res2.status_code, 401)
        self.assertIn('1 attempt remaining', res2.get_json()['error'])

        # Attempt 3: wrong password -> 429 (locked out for 5 minutes)
        res3 = self.client.post('/api/login', headers=headers, json={
            'username': 'admin',
            'password': 'wrong_password_3'
        })
        self.assertEqual(res3.status_code, 429)
        data3 = res3.get_json()
        self.assertIn('Too many failed login attempts', data3['error'])
        self.assertIn('Locked out', data3['error'])
        self.assertTrue(data3.get('retry_after', 0) > 0)
        self.assertIn('Retry-After', res3.headers)

        # Attempt 4 while locked -> immediately 429 without checking password
        res4 = self.client.post('/api/login', headers=headers, json={
            'username': 'admin',
            'password': 'wrong_password_4'
        })
        self.assertEqual(res4.status_code, 429)
        self.assertIn('Too many failed login attempts', res4.get_json()['error'])

        # Cleanup lockout for test_ip
        app_mod._clear_login_lockout('admin', test_ip)

if __name__ == '__main__':
    unittest.main()



