import os
import io
import json
import unittest
from unittest.mock import patch, MagicMock

from Local_PC_Lyrics_API.server import app, detect_gpu, get_hardware_telemetry, ACTIVE_JOB, HISTORY

class TestWhisperGPUServer(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_health_endpoint(self):
        res = self.client.get('/health')
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["status"], "ready")
        self.assertIn("device", data)
        self.assertIn("has_cuda", data)

    def test_telemetry_endpoint(self):
        res = self.client.get('/api/telemetry')
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn("gpu", data)
        self.assertIn("cpu", data)
        self.assertIn("ram", data)
        self.assertIn("active_job", data)

    def test_transcribe_no_file(self):
        res = self.client.post('/transcribe', data={})
        self.assertEqual(res.status_code, 400)
        data = res.get_json()
        self.assertIn("error", data)

    @patch("Local_PC_Lyrics_API.server.get_whisper_model")
    def test_transcribe_success_and_temp_file_deleted(self, mock_get_model):
        # Mock Whisper model and segments
        mock_seg1 = MagicMock(start=0.0, end=3.5, text="First line of lyrics", no_speech_prob=0.01, compression_ratio=1.0)
        mock_seg2 = MagicMock(start=4.0, end=8.0, text="Second line of lyrics", no_speech_prob=0.01, compression_ratio=1.0)
        mock_info = MagicMock(language="en")

        mock_model = MagicMock()
        mock_model.transcribe.return_value = ([mock_seg1, mock_seg2], mock_info)
        mock_get_model.return_value = (mock_model, "cuda", "float16")

        audio_bytes = b"FAKE_AUDIO_DATA_FOR_TESTING"
        data = {
            "audio": (io.BytesIO(audio_bytes), "test_song.mp3"),
            "model": "small",
            "language": "en"
        }

        res = self.client.post('/transcribe', data=data, content_type='multipart/form-data')
        self.assertEqual(res.status_code, 200)
        resp_data = res.get_json()
        self.assertTrue(resp_data["success"])
        self.assertEqual(resp_data["language"], "en")
        self.assertIn("[00:00.00] First line of lyrics", resp_data["lrc"])
        self.assertIn("[00:04.00] Second line of lyrics", resp_data["lrc"])
        self.assertTrue(resp_data["temp_purged"])

        # Verify active job was reset to idle
        self.assertEqual(ACTIVE_JOB["status"], "idle")

    def test_clear_history(self):
        res = self.client.post('/api/clear-history')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(HISTORY), 0)

    def test_settings_endpoint_get_and_post(self):
        # 1. GET settings
        res = self.client.get('/api/settings')
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn("limits", data)
        self.assertIn("cpu_threads", data["limits"])
        self.assertIn("max_ram_mb", data["limits"])
        self.assertIn("cooldown_sec", data["limits"])

        # 2. POST update settings
        new_limits = {
            "cpu_threads": 4,
            "max_ram_mb": 2048,
            "cooldown_sec": 1.0,
            "low_priority": True,
            "compute_type": "int8_float16"
        }
        res = self.client.post('/api/settings', json=new_limits)
        self.assertEqual(res.status_code, 200)
        resp = res.get_json()
        self.assertTrue(resp["success"])
        self.assertEqual(resp["limits"]["cpu_threads"], 4)
        self.assertEqual(resp["limits"]["max_ram_mb"], 2048)
        self.assertEqual(resp["limits"]["cooldown_sec"], 1.0)
        self.assertEqual(resp["limits"]["compute_type"], "int8_float16")

        # 3. Health check reflects limits
        res_health = self.client.get('/health')
        health_data = res_health.get_json()
        self.assertIn("limits", health_data)
        self.assertEqual(health_data["limits"]["cpu_threads"], 4)

if __name__ == "__main__":
    unittest.main()
