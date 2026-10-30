import unittest
import json
import os
import sqlite3
import uuid
import app as app_mod

class TestAdminLibraryAPI(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Safely backup users.json
        cls._users_backup = None
        if os.path.exists(app_mod.USERS_FILE):
            with open(app_mod.USERS_FILE, 'r', encoding='utf-8') as f:
                cls._users_backup = f.read()

        # Safely backup 'main' source_folder state
        cls._main_folder_backup = None
        conn = app_mod.get_db()
        try:
            row = conn.execute("SELECT * FROM source_folders WHERE folder_name = 'main'").fetchone()
            if row:
                cls._main_folder_backup = dict(row)
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

        # Restore 'main' source_folder state so other tests never fail due to missing folders
        conn = app_mod.get_db()
        try:
            if cls._main_folder_backup is not None:
                conn.execute("""
                    INSERT INTO source_folders (folder_name, name, classification, display_name, mapped_artist_id, mapped_artist_name, artist_id)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(folder_name) DO UPDATE SET
                        name = excluded.name,
                        classification = excluded.classification,
                        display_name = excluded.display_name,
                        mapped_artist_id = excluded.mapped_artist_id,
                        mapped_artist_name = excluded.mapped_artist_name,
                        artist_id = excluded.artist_id
                """, (
                    cls._main_folder_backup.get('folder_name', 'main'),
                    cls._main_folder_backup.get('name', 'main'),
                    cls._main_folder_backup.get('classification', 'unclassified'),
                    cls._main_folder_backup.get('display_name', 'main'),
                    cls._main_folder_backup.get('mapped_artist_id'),
                    cls._main_folder_backup.get('mapped_artist_name'),
                    cls._main_folder_backup.get('artist_id'),
                ))
            else:
                conn.execute("""
                    INSERT OR IGNORE INTO source_folders (folder_name, name, display_name, classification)
                    VALUES ('main', 'main', 'main', 'unclassified')
                """)
            conn.commit()
        finally:
            conn.close()

    def setUp(self):
        self.app = app_mod.app
        self.app.config['TESTING'] = True
        self.client = self.app.test_client()
        self.admin_token = app_mod._make_token('admin')
        self.user_token = app_mod._make_token('test_normal_user')

        # Insert dummy regular user
        users = app_mod.load_users()
        users['test_normal_user'] = {
            'username': 'test_normal_user',
            'password_hash': 'test',
            'role': 'user',
            'rules': {'allowed_playlists': ['main']}
        }
        app_mod.save_users(users)

        # Clean up any test state, preserving main folder in source_folders
        conn = app_mod.get_db()
        conn.execute("DELETE FROM artists WHERE name IN ('Mitski', 'Mac DeMarco', 'Test Artist')")
        conn.execute("""
            INSERT INTO source_folders (folder_name, name, display_name, classification, mapped_artist_name, mapped_artist_id)
            VALUES ('main', 'main', 'main', 'unclassified', NULL, NULL)
            ON CONFLICT(folder_name) DO UPDATE SET
                classification = 'unclassified',
                display_name = 'main',
                mapped_artist_name = NULL,
                mapped_artist_id = NULL
        """)
        conn.execute("DELETE FROM user_playlists WHERE name IN ('Roadtrip Vibes', 'Dual Delete UUID')")
        conn.execute("DELETE FROM playlist_tracks WHERE playlist_name IN ('Roadtrip Vibes', 'Dual Delete UUID')")
        conn.execute("DELETE FROM playlists WHERE title IN ('Roadtrip Vibes', 'Dual Delete UUID')")
        conn.commit()
        conn.close()

    def test_unauthorized_access(self):
        # No token
        res = self.client.get('/api/admin/library/folders')
        self.assertEqual(res.status_code, 401)

        # Non-admin token
        user_headers = {'Authorization': f'Bearer {self.user_token}'}
        res = self.client.get('/api/admin/library/folders', headers=user_headers)
        self.assertEqual(res.status_code, 403)

        res = self.client.post('/api/admin/library/folders/classify', headers=user_headers, json={'folder': 'main'})
        self.assertEqual(res.status_code, 403)

        res = self.client.get('/api/admin/library/playlists', headers=user_headers)
        self.assertEqual(res.status_code, 403)

        res = self.client.delete('/api/admin/library/playlists/1', headers=user_headers)
        self.assertEqual(res.status_code, 403)

        res = self.client.get('/api/admin/library/artists', headers=user_headers)
        self.assertEqual(res.status_code, 403)

        res = self.client.post('/api/admin/library/artists', headers=user_headers, json={'name': 'Test'})
        self.assertEqual(res.status_code, 403)

    def test_get_library_folders(self):
        admin_headers = {'Authorization': f'Bearer {self.admin_token}'}
        res = self.client.get('/api/admin/library/folders', headers=admin_headers)
        self.assertEqual(res.status_code, 200)
        folders = res.get_json()
        self.assertIsInstance(folders, list)
        folder_names = [f['folder'] for f in folders]
        self.assertIn('main', folder_names)

        # Verify fields on the detected folder
        main_folder = next(f for f in folders if f['folder'] == 'main')
        self.assertIn('classification', main_folder)
        self.assertIn('display_name', main_folder)
        self.assertIn('mapped_artist', main_folder)
        self.assertIn('track_count', main_folder)
        self.assertIn('user_access_grants', main_folder)
        self.assertIn('scan_status', main_folder)
        self.assertGreater(main_folder['track_count'], 0)
        self.assertIn('test_normal_user', main_folder['user_access_grants'])

        # Dict format support
        res_dict = self.client.get('/api/admin/library/folders?format=dict', headers=admin_headers)
        self.assertEqual(res_dict.status_code, 200)
        self.assertIn('folders', res_dict.get_json())

    def test_classify_and_reclassify_folder(self):
        admin_headers = {'Authorization': f'Bearer {self.admin_token}'}

        # 1. Invalid input validation
        res = self.client.post('/api/admin/library/folders/classify', headers=admin_headers, json={})
        self.assertEqual(res.status_code, 400)

        res = self.client.post('/api/admin/library/folders/classify', headers=admin_headers, json={
            'folder': 'main',
            'classification': 'invalid_kind'
        })
        self.assertEqual(res.status_code, 400)

        # 2. Classify as artist with mapped artist
        res = self.client.post('/api/admin/library/folders/classify', headers=admin_headers, json={
            'folder': 'main',
            'classification': 'artist',
            'display_name': 'Mac DeMarco Official',
            'mapped_artist': 'Mac DeMarco'
        })
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data['folder']['classification'], 'artist')
        self.assertEqual(data['folder']['display_name'], 'Mac DeMarco Official')
        self.assertEqual(data['folder']['mapped_artist'], 'Mac DeMarco')

        # Check that GET reflection works
        res = self.client.get('/api/admin/library/folders', headers=admin_headers)
        folders = res.get_json()
        main_folder = next(f for f in folders if f['folder'] == 'main')
        self.assertEqual(main_folder['classification'], 'artist')
        self.assertEqual(main_folder['display_name'], 'Mac DeMarco Official')
        self.assertEqual(main_folder['mapped_artist'], 'Mac DeMarco')

        # 3. Reclassify as playlist
        res = self.client.post('/api/admin/library/folders/classify', headers=admin_headers, json={
            'folder': 'main',
            'classification': 'playlist',
            'display_name': 'Main Hits Playlist'
        })
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data['folder']['classification'], 'playlist')
        self.assertIsNone(data['folder']['mapped_artist'])

        # 4. Reclassify as unclassified
        res = self.client.post('/api/admin/library/folders/classify', headers=admin_headers, json={
            'folder': 'main',
            'classification': 'unclassified'
        })
        self.assertEqual(res.status_code, 200)

    def test_artists_management(self):
        admin_headers = {'Authorization': f'Bearer {self.admin_token}'}

        # 1. Validation
        res = self.client.post('/api/admin/library/artists', headers=admin_headers, json={})
        self.assertEqual(res.status_code, 400)

        # 2. Create Artist
        res = self.client.post('/api/admin/library/artists', headers=admin_headers, json={
            'name': 'Mitski',
            'bio': 'Japanese-American singer-songwriter'
        })
        self.assertEqual(res.status_code, 201)
        data = res.get_json()
        self.assertEqual(data['artist']['name'], 'Mitski')
        self.assertEqual(data['artist']['bio'], 'Japanese-American singer-songwriter')

        # 3. Prevent duplicate
        res = self.client.post('/api/admin/library/artists', headers=admin_headers, json={
            'name': 'mitski',
            'bio': 'Duplicate'
        })
        self.assertEqual(res.status_code, 400)

        # 4. List Artists
        res = self.client.get('/api/admin/library/artists', headers=admin_headers)
        self.assertEqual(res.status_code, 200)
        artists = res.get_json()
        artist_names = [a['name'] for a in artists]
        self.assertIn('Mitski', artist_names)

    def test_global_playlist_inventory_and_administrative_delete(self):
        admin_headers = {'Authorization': f'Bearer {self.admin_token}'}

        # Create user playlist in database (both legacy and v2)
        v2_id = str(uuid.uuid4())
        conn = app_mod.get_db()
        conn.execute("INSERT OR REPLACE INTO user_playlists (username, name, visibility) VALUES ('test_normal_user', 'Roadtrip Vibes', 'private')")
        conn.execute("INSERT OR REPLACE INTO playlist_tracks (username, playlist_name, track_path) VALUES ('test_normal_user', 'Roadtrip Vibes', 'main/09. Mac DeMarco - Chamber Of Reflection.mp3')")
        conn.execute("INSERT OR REPLACE INTO playlists (id, owner, title, description, visibility, is_folder_playlist) VALUES (?, 'test_normal_user', 'Roadtrip Vibes', '', 'private', 0)", (v2_id,))
        conn.execute("INSERT OR REPLACE INTO playlist_tracks_v2 (playlist_id, track_path, position) VALUES (?, 'main/09. Mac DeMarco - Chamber Of Reflection.mp3', 0)", (v2_id,))
        conn.commit()
        pl_row = conn.execute("SELECT id FROM user_playlists WHERE username = 'test_normal_user' AND name = 'Roadtrip Vibes'").fetchone()
        playlist_id = pl_row['id']
        conn.close()

        # 1. Get Playlists Inventory
        res = self.client.get('/api/admin/library/playlists', headers=admin_headers)
        self.assertEqual(res.status_code, 200)
        playlists = res.get_json()
        matching = [p for p in playlists if p['id'] == playlist_id]
        self.assertEqual(len(matching), 1)
        item = matching[0]
        self.assertEqual(item['title'], 'Roadtrip Vibes')
        self.assertEqual(item['owner'], 'test_normal_user')
        self.assertEqual(item['visibility'], 'private')
        self.assertEqual(item['track_count'], 1)
        self.assertFalse(item['is_folder_playlist'])

        # 2. Filtering
        res_priv = self.client.get('/api/admin/library/playlists?visibility=private', headers=admin_headers)
        self.assertEqual(res_priv.status_code, 200)
        self.assertTrue(any(p['id'] == playlist_id for p in res_priv.get_json()))

        res_pub = self.client.get('/api/admin/library/playlists?visibility=public', headers=admin_headers)
        self.assertEqual(res_pub.status_code, 200)
        self.assertFalse(any(p['id'] == playlist_id for p in res_pub.get_json()))

        res_search = self.client.get('/api/admin/library/playlists?search=roadtrip', headers=admin_headers)
        self.assertEqual(res_search.status_code, 200)
        self.assertTrue(any(p['id'] == playlist_id for p in res_search.get_json()))

        # 3. Administrative Delete using integer ID
        res_del = self.client.delete(f'/api/admin/library/playlists/{playlist_id}', headers=admin_headers)
        self.assertEqual(res_del.status_code, 200)

        # Check DB that both legacy and v2 records are removed
        conn = app_mod.get_db()
        check_pl = conn.execute("SELECT * FROM user_playlists WHERE id = ?", (playlist_id,)).fetchone()
        self.assertIsNone(check_pl)
        check_tracks = conn.execute("SELECT * FROM playlist_tracks WHERE username = 'test_normal_user' AND playlist_name = 'Roadtrip Vibes'").fetchall()
        self.assertEqual(len(check_tracks), 0)
        check_v2 = conn.execute("SELECT * FROM playlists WHERE id = ?", (v2_id,)).fetchone()
        self.assertIsNone(check_v2)
        check_v2_trks = conn.execute("SELECT * FROM playlist_tracks_v2 WHERE playlist_id = ?", (v2_id,)).fetchall()
        self.assertEqual(len(check_v2_trks), 0)

        # Check audit log in database
        audit_row = conn.execute("SELECT * FROM admin_audit_logs WHERE action = 'delete_playlist' AND target_id = ?", (str(playlist_id),)).fetchone()
        self.assertIsNotNone(audit_row)
        self.assertEqual(audit_row['admin_username'], 'admin')
        self.assertIn('Roadtrip Vibes', audit_row['details'])
        conn.close()

        # Check audit logs endpoint
        res_audit = self.client.get('/api/admin/library/audit-logs', headers=admin_headers)
        self.assertEqual(res_audit.status_code, 200)
        self.assertTrue(any(a['action'] == 'delete_playlist' for a in res_audit.get_json()))

        # Deleting again returns 404
        res_del_again = self.client.delete(f'/api/admin/library/playlists/{playlist_id}', headers=admin_headers)
        self.assertEqual(res_del_again.status_code, 404)

    def test_administrative_delete_by_uuid_removes_both_legacy_and_v2_records(self):
        """Admin delete /api/admin/library/playlists/<id> with UUID removes both legacy and v2 records."""
        admin_headers = {'Authorization': f'Bearer {self.admin_token}'}

        v2_id = str(uuid.uuid4())
        track = 'main/09. Mac DeMarco - Chamber Of Reflection.mp3'

        conn = app_mod.get_db()
        conn.execute("INSERT OR REPLACE INTO playlists (id, owner, title, description, visibility, is_folder_playlist) VALUES (?, 'test_normal_user', 'Dual Delete UUID', 'desc', 'public', 0)", (v2_id,))
        conn.execute("INSERT OR REPLACE INTO playlist_tracks_v2 (playlist_id, track_path, position) VALUES (?, ?, 0)", (v2_id, track))
        conn.execute("INSERT OR REPLACE INTO user_playlists (username, name, visibility) VALUES ('test_normal_user', 'Dual Delete UUID', 'public')")
        conn.execute("INSERT OR REPLACE INTO playlist_tracks (username, playlist_name, track_path) VALUES ('test_normal_user', 'Dual Delete UUID', ?)", (track,))
        conn.commit()
        conn.close()

        # Delete by UUID
        res_del = self.client.delete(f'/api/admin/library/playlists/{v2_id}', headers=admin_headers)
        self.assertEqual(res_del.status_code, 200)

        # Verify both legacy and v2 records are removed
        conn = app_mod.get_db()
        self.assertIsNone(conn.execute("SELECT * FROM playlists WHERE id = ?", (v2_id,)).fetchone())
        self.assertEqual(len(conn.execute("SELECT * FROM playlist_tracks_v2 WHERE playlist_id = ?", (v2_id,)).fetchall()), 0)
        self.assertIsNone(conn.execute("SELECT * FROM user_playlists WHERE username = 'test_normal_user' AND name = 'Dual Delete UUID'").fetchone())
        self.assertEqual(len(conn.execute("SELECT * FROM playlist_tracks WHERE username = 'test_normal_user' AND playlist_name = 'Dual Delete UUID'").fetchall()), 0)

        # Verify audit log
        audit_row = conn.execute("SELECT * FROM admin_audit_logs WHERE action = 'delete_playlist' AND target_id = ?", (v2_id,)).fetchone()
        self.assertIsNotNone(audit_row)
        conn.close()

        # Deleting again returns 404
        res_del_again = self.client.delete(f'/api/admin/library/playlists/{v2_id}', headers=admin_headers)
        self.assertEqual(res_del_again.status_code, 404)

if __name__ == '__main__':
    unittest.main()
