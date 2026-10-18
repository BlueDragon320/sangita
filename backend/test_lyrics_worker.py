import unittest
from backend.lyrics_worker import (
    clean_tag_value,
    sanitize_song_title,
    parse_audio_metadata,
    query_lrclib
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

        args_default = parser.parse_args([])
        self.assertTrue(args_default.api)

        args_on = parser.parse_args(["--api"])
        self.assertTrue(args_on.api)

        args_off = parser.parse_args(["--no-api"])
        self.assertFalse(args_off.api)

if __name__ == "__main__":
    unittest.main()
