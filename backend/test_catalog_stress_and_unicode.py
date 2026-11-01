import unittest
import os
import shutil
import tempfile
import time
import urllib.parse
import sqlite3
import struct

from backend import app as app_mod

# Minimal 44-byte PCM WAV header for valid audio parsing
MINIMAL_WAV_HEADER = (
    b'RIFF' + struct.pack('<I', 36) + b'WAVE' +
    b'fmt ' + struct.pack('<IHHIIHH', 16, 1, 1, 8000, 8000, 1, 8) +
    b'data' + struct.pack('<I', 0)
)

class TestUnicodeAndSpecialCharacterCatalog(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp_dir = tempfile.TemporaryDirectory(prefix="sangita-unicode-test-")
        cls.music_dir = os.path.join(cls.temp_dir.name, "music")
        cls.data_dir = os.path.join(cls.temp_dir.name, "data")
        os.makedirs(cls.music_dir, exist_ok=True)
        os.makedirs(cls.data_dir, exist_ok=True)

        cls.orig_music_dir = app_mod.MUSIC_DIR
        cls.orig_data_dir = app_mod.DATA_DIR
        app_mod.MUSIC_DIR = cls.music_dir
        app_mod.DATA_DIR = cls.data_dir

        app_mod.app.config["TESTING"] = True
        cls.client = app_mod.app.test_client()
        cls.admin_token = app_mod._make_token("admin")
        cls.admin_headers = {"Authorization": f"Bearer {cls.admin_token}"}

        # 1. Unicode files and folders
        cls.unicode_files = [
            "音楽/東京_Midnight_🎶.mp3",
            "Музыка/Вечер_Песня.mp3",
            "संगीत/राग_भैरवी.mp3",
            "Chansons/Été_À_Paris.mp3",
        ]
        for rel in cls.unicode_files:
            full = os.path.join(cls.music_dir, rel)
            os.makedirs(os.path.dirname(full), exist_ok=True)
            with open(full, "wb") as f:
                f.write(MINIMAL_WAV_HEADER)

        # 2. Special character files and folders: ', ", #, %, &, +, [, ]
        cls.special_files = [
            "Special/track_single_quote_'.mp3",
            "Special/track_double_quote_\".mp3",
            "Special/track_hash_#.mp3",
            "Special/track_percent_%.mp3",
            "Special/track_ampersand_&.mp3",
            "Special/track_plus_+.mp3",
            "Special/track_brackets_[].mp3",
            "Special/all_in_one_'\"#%&+[].mp3",
            "Special_#_percent_%20_plus_+_brackets_[1]/'quote'_\"dbl\"#1.mp3",
        ]
        for rel in cls.special_files:
            full = os.path.join(cls.music_dir, rel)
            os.makedirs(os.path.dirname(full), exist_ok=True)
            with open(full, "wb") as f:
                f.write(MINIMAL_WAV_HEADER)

        # 3. Empty (0-byte) audio files
        cls.empty_audio_files = [
            "EmptyFolder/zero_byte.mp3",
            "EmptyFolder/zero_byte.wav",
            "EmptyFolder/zero_byte.flac",
        ]
        for rel in cls.empty_audio_files:
            full = os.path.join(cls.music_dir, rel)
            os.makedirs(os.path.dirname(full), exist_ok=True)
            with open(full, "wb") as f:
                pass  # 0 bytes

        # 4. Non-audio files
        cls.non_audio_files = [
            "EmptyFolder/readme.txt",
            "EmptyFolder/album_art.jpg",
            "EmptyFolder/notes.pdf",
            "EmptyFolder/metadata.json",
        ]
        for rel in cls.non_audio_files:
            full = os.path.join(cls.music_dir, rel)
            os.makedirs(os.path.dirname(full), exist_ok=True)
            with open(full, "wb") as f:
                f.write(b"non-audio-content")

        # 5. Missing files in database
        cls.missing_track_1 = "GhostFolder/ghost_track_1.mp3"
        cls.missing_track_2 = "MissingFolder/vanished_track_2.wav"

        conn = app_mod.get_db()
        try:
            # Custom playlist with missing file
            conn.execute("""
                INSERT OR IGNORE INTO user_playlists (username, name)
                VALUES ('admin', 'GhostPlaylist')
            """)
            conn.execute("""
                INSERT OR IGNORE INTO playlist_tracks (username, playlist_name, track_path)
                VALUES ('admin', 'GhostPlaylist', ?)
            """, (cls.missing_track_1,))

            # Favorites with missing file
            conn.execute("""
                INSERT OR IGNORE INTO playlist_tracks (username, playlist_name, track_path)
                VALUES ('admin', 'Favorites', ?)
            """, (cls.missing_track_2,))

            # V2 playlist with missing file
            conn.execute("""
                INSERT OR IGNORE INTO playlists (id, title, owner, visibility, is_folder_playlist)
                VALUES ('ghost-v2-pl', 'Ghost V2 Playlist', 'admin', 'public', 0)
            """)
            conn.execute("""
                INSERT OR IGNORE INTO playlist_tracks_v2 (playlist_id, track_path, position)
                VALUES ('ghost-v2-pl', ?, 0)
            """, (cls.missing_track_1,))
            conn.commit()
        finally:
            conn.close()

    @classmethod
    def tearDownClass(cls):
        # Clean up database entries created
        conn = app_mod.get_db()
        try:
            conn.execute("DELETE FROM user_playlists WHERE name = 'GhostPlaylist'")
            conn.execute("DELETE FROM playlist_tracks WHERE playlist_name IN ('GhostPlaylist', 'Favorites') AND track_path LIKE '%ghost%'")
            conn.execute("DELETE FROM playlists WHERE id = 'ghost-v2-pl'")
            conn.execute("DELETE FROM playlist_tracks_v2 WHERE playlist_id = 'ghost-v2-pl'")
            conn.commit()
        except Exception:
            pass
        finally:
            conn.close()

        app_mod.MUSIC_DIR = cls.orig_music_dir
        app_mod.DATA_DIR = cls.orig_data_dir
        cls.temp_dir.cleanup()

    def test_unicode_catalog_scanning(self):
        """Verify Japanese, Cyrillic, Hindi, accented characters, and emojis in library scanning."""
        res = self.client.get("/api/playlists", headers=self.admin_headers)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()

        # Folders detected
        self.assertIn("音楽", data)
        self.assertIn("Музыка", data)
        self.assertIn("संगीत", data)
        self.assertIn("Chansons", data)

        # Tracks listed under folders
        self.assertIn("音楽/東京_Midnight_🎶.mp3", data["音楽"])
        self.assertIn("Музыка/Вечер_Песня.mp3", data["Музыка"])
        self.assertIn("संगीत/राग_भैरवी.mp3", data["संगीत"])
        self.assertIn("Chansons/Été_À_Paris.mp3", data["Chansons"])

    def test_unicode_streaming_and_downloading(self):
        """Verify streaming and downloading files with Unicode characters and emojis."""
        for rel in self.unicode_files:
            quoted = urllib.parse.quote(rel)
            # Stream
            res_stream = self.client.get(f"/api/stream/{quoted}", headers=self.admin_headers)
            try:
                self.assertEqual(res_stream.status_code, 200, f"Streaming failed for {rel}")
                self.assertEqual(res_stream.data, MINIMAL_WAV_HEADER)
            finally:
                res_stream.close()

            # Download
            res_down = self.client.get(f"/api/download/{quoted}", headers=self.admin_headers)
            try:
                self.assertEqual(res_down.status_code, 200, f"Downloading failed for {rel}")
                self.assertEqual(res_down.data, MINIMAL_WAV_HEADER)
            finally:
                res_down.close()

    def test_special_characters_streaming_and_paths(self):
        """Verify file paths containing special characters: ', \", #, %, &, +, [, ]."""
        res = self.client.get("/api/playlists", headers=self.admin_headers)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn("Special", data)

        for rel in self.special_files:
            # Check presence in catalog
            folder = rel.split("/")[0]
            self.assertIn(folder, data)
            self.assertIn(rel, data[folder])

            # Check streaming with URL-encoded path
            quoted = urllib.parse.quote(rel)
            res_stream = self.client.get(f"/api/stream/{quoted}", headers=self.admin_headers)
            try:
                self.assertEqual(res_stream.status_code, 200, f"Streaming failed for special file: {rel}")
                self.assertEqual(res_stream.data, MINIMAL_WAV_HEADER)
            finally:
                res_stream.close()

            # Check download
            res_down = self.client.get(f"/api/download/{quoted}", headers=self.admin_headers)
            try:
                self.assertEqual(res_down.status_code, 200, f"Downloading failed for special file: {rel}")
                self.assertEqual(res_down.data, MINIMAL_WAV_HEADER)
            finally:
                res_down.close()

    def test_empty_and_non_audio_files(self):
        """Verify 0-byte audio files do not crash scanning and non-audio files are strictly ignored."""
        res = self.client.get("/api/playlists", headers=self.admin_headers)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()

        self.assertIn("EmptyFolder", data)
        empty_tracks = data["EmptyFolder"]

        # 0-byte audio files are listed without crash
        for empty_audio in self.empty_audio_files:
            self.assertIn(empty_audio, empty_tracks)

        # Non-audio files (.txt, .jpg, .pdf, .json) are NEVER included
        for non_audio in self.non_audio_files:
            self.assertNotIn(non_audio, empty_tracks)

        # Streaming 0-byte file succeeds with empty body
        res_stream_0 = self.client.get(f"/api/stream/{urllib.parse.quote(self.empty_audio_files[0])}", headers=self.admin_headers)
        try:
            self.assertEqual(res_stream_0.status_code, 200)
            self.assertEqual(len(res_stream_0.data), 0)
        finally:
            res_stream_0.close()

        # Streaming non-audio file is rejected (403 Forbidden)
        res_txt = self.client.get(f"/api/stream/{urllib.parse.quote('EmptyFolder/readme.txt')}", headers=self.admin_headers)
        res_txt.close()
        self.assertEqual(res_txt.status_code, 403)
        res_pdf = self.client.get(f"/api/stream/{urllib.parse.quote('EmptyFolder/notes.pdf')}", headers=self.admin_headers)
        res_pdf.close()
        self.assertEqual(res_pdf.status_code, 403)

        # Durations scan does not crash on 0-byte audio
        app_mod._durations_cache = {"ts": 0, "data": None}
        res_dur = self.client.get("/api/durations", headers=self.admin_headers)
        self.assertEqual(res_dur.status_code, 200)

    def test_missing_files_in_database(self):
        """Verify database references to missing/deleted files do not crash the API."""
        # 1. /api/playlists includes custom playlist without crashing
        res = self.client.get("/api/playlists", headers=self.admin_headers)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn("GhostPlaylist", data)
        self.assertIn(self.missing_track_1, data["GhostPlaylist"])

        # 2. V2 Playlist Detail correctly flags missing track
        res_v2 = self.client.get("/api/v2/playlists/ghost-v2-pl", headers=self.admin_headers)
        self.assertEqual(res_v2.status_code, 200)
        v2_data = res_v2.get_json()
        self.assertEqual(v2_data["title"], "Ghost V2 Playlist")
        self.assertEqual(len(v2_data["tracks"]), 1)
        self.assertFalse(v2_data["tracks"][0]["is_available"])

        # 3. /api/track-metadata does not crash on missing files
        res_meta = self.client.get("/api/track-metadata", headers=self.admin_headers)
        self.assertEqual(res_meta.status_code, 200)
        meta_data = res_meta.get_json()
        self.assertNotIn(self.missing_track_1, meta_data)

        # 4. Stream and download on missing file return 404 (not 500)
        quoted_missing = urllib.parse.quote(self.missing_track_1)
        res_stream = self.client.get(f"/api/stream/{quoted_missing}", headers=self.admin_headers)
        self.assertEqual(res_stream.status_code, 404)

        res_down = self.client.get(f"/api/download/{quoted_missing}", headers=self.admin_headers)
        self.assertEqual(res_down.status_code, 404)

        res_cover = self.client.get(f"/api/cover/{quoted_missing}", headers=self.admin_headers)
        self.assertEqual(res_cover.status_code, 404)


class TestCatalogStressAndBenchmarking(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp_dir = tempfile.TemporaryDirectory(prefix="sangita-stress-bench-")
        cls.music_dir = os.path.join(cls.temp_dir.name, "music")
        os.makedirs(cls.music_dir, exist_ok=True)

        cls.orig_music_dir = app_mod.MUSIC_DIR
        app_mod.MUSIC_DIR = cls.music_dir

        app_mod.app.config["TESTING"] = True
        cls.client = app_mod.app.test_client()
        cls.admin_token = app_mod._make_token("admin")
        cls.admin_headers = {"Authorization": f"Bearer {cls.admin_token}"}

        # Create 1,000 synthetic audio tracks across 20 albums (50 tracks per album)
        cls.total_expected_tracks = 1000
        cls.num_albums = 20
        cls.tracks_per_album = 50

        t0_setup = time.perf_counter()
        for a_idx in range(cls.num_albums):
            album_folder = os.path.join(cls.music_dir, f"Album_{a_idx:02d}")
            os.makedirs(album_folder, exist_ok=True)
            for t_idx in range(cls.tracks_per_album):
                track_file = os.path.join(album_folder, f"track_{a_idx:02d}_{t_idx:02d}.mp3")
                with open(track_file, "wb") as f:
                    f.write(MINIMAL_WAV_HEADER)
        cls.setup_duration = time.perf_counter() - t0_setup

    @classmethod
    def tearDownClass(cls):
        app_mod.MUSIC_DIR = cls.orig_music_dir
        cls.temp_dir.cleanup()

    def test_catalog_scanning_benchmark_and_integrity(self):
        """
        Measure scan execution duration across 1,000 synthetic audio tracks:
        - Must complete in < 3 seconds.
        - Verify /api/playlists and /api/tracks return all items properly formatted without crashes.
        """
        # 1. Benchmark /api/playlists scan
        t0_playlists = time.perf_counter()
        res_pl = self.client.get("/api/playlists", headers=self.admin_headers)
        playlists_duration = time.perf_counter() - t0_playlists

        self.assertEqual(res_pl.status_code, 200)
        pl_data = res_pl.get_json()
        self.assertIsInstance(pl_data, dict)

        # Count tracks across the 20 album playlists
        scanned_tracks_count = sum(len(tracks) for k, tracks in pl_data.items() if k.startswith("Album_"))
        self.assertEqual(scanned_tracks_count, self.total_expected_tracks)
        self.assertLess(playlists_duration, 3.0, f"/api/playlists scan took {playlists_duration:.4f}s (budget: <3.0s)")

        # 2. Benchmark /api/tracks scan
        t0_tracks = time.perf_counter()
        res_tr = self.client.get("/api/tracks", headers=self.admin_headers)
        tracks_duration = time.perf_counter() - t0_tracks

        self.assertEqual(res_tr.status_code, 200)
        tr_data = res_tr.get_json()
        tracks_list = tr_data.get("tracks") if isinstance(tr_data, dict) else tr_data
        self.assertIsInstance(tracks_list, list)
        self.assertEqual(len(tracks_list), self.total_expected_tracks)
        self.assertLess(tracks_duration, 3.0, f"/api/tracks scan took {tracks_duration:.4f}s (budget: <3.0s)")

        # Verify proper formatting of track items
        sample_track = tracks_list[0]
        self.assertIn("path", sample_track)
        self.assertIn("title", sample_track)
        self.assertIn("artist", sample_track)
        self.assertIn("source", sample_track)
        self.assertTrue(sample_track["path"].endswith(".mp3"))

        print(f"\n[BENCHMARK] Catalog Scan (1,000 tracks):")
        print(f"  - /api/playlists execution duration: {playlists_duration*1000:.2f} ms")
        print(f"  - /api/tracks execution duration:    {tracks_duration*1000:.2f} ms")

    def test_search_response_time_benchmark(self):
        """
        Measure search response time across 1,000 tracks:
        - Must complete in < 50ms.
        - Verify accurate search results.
        """
        # Test distinct search queries: specific track, specific album, and common pattern
        queries = ["track_05_25", "Album_12", "track_"]
        latencies = []

        for q in queries:
            t0 = time.perf_counter()
            res = self.client.get(f"/api/tracks?q={urllib.parse.quote(q)}", headers=self.admin_headers)
            duration_ms = (time.perf_counter() - t0) * 1000.0
            latencies.append(duration_ms)

            self.assertEqual(res.status_code, 200)
            data = res.get_json()
            matches = data.get("tracks") if isinstance(data, dict) else data

            if q == "track_05_25":
                self.assertEqual(len(matches), 1)
                self.assertIn("track_05_25", matches[0]["path"])
            elif q == "Album_12":
                self.assertEqual(len(matches), self.tracks_per_album)
            elif q == "track_":
                self.assertEqual(len(matches), self.total_expected_tracks)

            self.assertLess(duration_ms, 50.0, f"Search query '{q}' took {duration_ms:.2f}ms (budget: <50ms)")

        avg_latency = sum(latencies) / len(latencies)
        max_latency = max(latencies)
        print(f"\n[BENCHMARK] Search Latency across 1,000 tracks:")
        print(f"  - Average search latency: {avg_latency:.2f} ms")
        print(f"  - Maximum search latency: {max_latency:.2f} ms")
        self.assertLess(max_latency, 50.0)


if __name__ == "__main__":
    unittest.main()
