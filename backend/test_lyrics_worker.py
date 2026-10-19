import unittest
from unittest.mock import patch, MagicMock
from backend.lyrics_worker import (
    clean_tag_value,
    sanitize_song_title,
    parse_audio_metadata,
    query_lrclib,
    offload_to_remote_whisper
)

class TestLyricsWorker(unittest.TestCase):
    def test_clean_tag_value_lists(self):
        self.assertEqual(clean_tag_value(["Song Title"]), "Song Title")
        self.assertEqual(clean_tag_value("['Song Title']"), "Song Title")
        self.assertEqual(clean_tag_value('["Artist Name"]'), "Artist Name")
        self.assertEqual(clean_tag_value(None), "")

    def test_sanitize_song_title(self):
        self.assertEqual(sanitize_song_title("Song Name | Lyrics"), "Song Name")
        self.assertEqual(sanitize_song_title("Track Title (Official Video)"), "Track Title")
        self.assertEqual(sanitize_song_title("Awesome Track [Lyrics Video]"), "Awesome Track")
        self.assertEqual(sanitize_song_title("Clean Song"), "Clean Song")

    def test_parse_audio_metadata_clean(self):
        meta = parse_audio_metadata("music/main/Dr Zues, Shortie - Jugni Ji.mp3")
        self.assertEqual(meta["title"], "Jugni Ji")
        self.assertTrue(meta["duration"] > 0)

    def test_query_lrclib_empty(self):
        result = query_lrclib({"title": "", "artist": ""})
        self.assertIsNone(result)

    def test_query_lrclib_nonexistent(self):
        result = query_lrclib({"title": "X99_NonExistentTrack_999ZZZ", "artist": "NoArtist", "duration": 100})
        self.assertIsNone(result)

    def test_cli_flags_api_toggle(self):
        import argparse
        parser = argparse.ArgumentParser()
        parser.add_argument("--api", dest="api", action="store_true", default=True)
        parser.add_argument("--no-api", dest="api", action="store_false", default=True)
        parser.add_argument("--remote-whisper-url", default="")
        parser.add_argument("--only-remote-gpu", action="store_true")

        args_default = parser.parse_args([])
        self.assertTrue(args_default.api)
        self.assertEqual(args_default.remote_whisper_url, "")
        self.assertFalse(args_default.only_remote_gpu)

        args_remote = parser.parse_args(["--remote-whisper-url", "http://192.168.1.50:8000", "--only-remote-gpu"])
        self.assertEqual(args_remote.remote_whisper_url, "http://192.168.1.50:8000")
        self.assertTrue(args_remote.only_remote_gpu)

    @patch("requests.post")
    @patch("requests.get")
    def test_offload_to_remote_whisper_success(self, mock_get, mock_post):
        mock_get.return_value = MagicMock(status_code=200)
        mock_post.return_value = MagicMock(
            status_code=200,
            json=lambda: {
                "success": True,
                "lrc": "[00:01.00] Test line",
                "language": "hi",
                "duration_sec": 3.2,
                "device": "cuda"
            }
        )

        with patch("builtins.open", MagicMock()):
            lrc, lang = offload_to_remote_whisper("dummy.mp3", "http://192.168.1.50:8000", "small", "hi")
            self.assertEqual(lrc, "[00:01.00] Test line")
            self.assertEqual(lang, "hi")

    @patch("requests.get")
    def test_offload_to_remote_whisper_unreachable(self, mock_get):
        mock_get.side_effect = Exception("Connection refused")
        lrc, lang = offload_to_remote_whisper("dummy.mp3", "http://192.168.1.50:8000", "small", "auto")
        self.assertIsNone(lrc)
        self.assertIsNone(lang)

if __name__ == "__main__":
    unittest.main()

