import os
import sqlite3
import tempfile
import unittest
from unittest.mock import patch

import app as app_mod


class FavoriteSetTest(unittest.TestCase):
    def setUp(self):
        self.tempdir = tempfile.TemporaryDirectory()
        self.db = os.path.join(self.tempdir.name, 'test.db')
        with sqlite3.connect(self.db) as conn:
            conn.execute('''CREATE TABLE playlist_tracks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL, playlist_name TEXT NOT NULL,
                track_path TEXT NOT NULL, position INTEGER DEFAULT 0,
                added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (username, playlist_name, track_path))''')
        self.patches = [
            patch.object(app_mod, 'STATS_DB', self.db),
            patch.object(app_mod, '_verify_token', return_value='alice'),
            patch.object(app_mod, 'load_users', return_value={'alice': {'username': 'alice', 'role': 'user'}}),
        ]
        for p in self.patches:
            p.start()
        self.client = app_mod.app.test_client()

    def tearDown(self):
        for p in reversed(self.patches):
            p.stop()
        self.tempdir.cleanup()

    def test_retries_are_idempotent_and_can_remove(self):
        body = {'track_path': 'Rock/song.mp3', 'is_favorite': True}
        for _ in range(2):
            response = self.client.post('/api/favorites/set', json=body)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json['favorites'], ['Rock/song.mp3'])
        body['is_favorite'] = False
        for _ in range(2):
            response = self.client.post('/api/favorites/set', json=body)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json['favorites'], [])

    def test_favorites_are_isolated_between_accounts(self):
        users = {'alice': {'username': 'alice'}, 'bob': {'username': 'bob'}}
        with patch.object(app_mod, '_verify_token', side_effect=lambda token: token or None), \
             patch.object(app_mod, 'load_users', return_value=users):
            body = {'track_path': 'Shared/song.mp3', 'is_favorite': True}
            self.client.post('/api/favorites/set', headers={'Authorization': 'Bearer alice'}, json=body)
            bob = self.client.get('/api/favorites', headers={'Authorization': 'Bearer bob'})
            self.assertEqual(bob.json, [])
            alice = self.client.get('/api/favorites', headers={'Authorization': 'Bearer alice'})
            self.assertEqual(alice.json, ['Shared/song.mp3'])

    def test_rejects_non_boolean_desired_state(self):
        response = self.client.post('/api/favorites/set', json={'track_path': 'song.mp3', 'is_favorite': 'false'})
        self.assertEqual(response.status_code, 400)
