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

    def test_model_status_reported_in_health_and_telemetry(self):
        res = self.client.get('/health')
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn("model_status", data)
        self.assertIn("cached", data["model_status"])

        res_tel = self.client.get('/api/telemetry')
        self.assertEqual(res_tel.status_code, 200)
        data_tel = res_tel.get_json()
        self.assertIn("model_status", data_tel)

    @patch("Local_PC_Lyrics_API.server.get_whisper_model")
    def test_transcribe_cuda_fallback_to_cpu(self, mock_get_model):
        # 1st call on cuda raises RuntimeError (like missing cublas)
        mock_cuda_model = MagicMock()
        mock_cuda_model.transcribe.side_effect = RuntimeError("Library libcublas.so.12 is not found or cannot be loaded")

        # 2nd call on cpu succeeds
        mock_cpu_seg = MagicMock(start=1.0, end=4.0, text="Fallback CPU lyrics", no_speech_prob=0.01, compression_ratio=1.0)
        mock_cpu_info = MagicMock(language="en")
        mock_cpu_model = MagicMock()
        mock_cpu_model.transcribe.return_value = ([mock_cpu_seg], mock_cpu_info)

        def side_effect(model_name="small", force_device=None):
            if force_device == "cpu":
                return (mock_cpu_model, "cpu", "int8")
            return (mock_cuda_model, "cuda", "float16")

        mock_get_model.side_effect = side_effect

        data = {
            "audio": (io.BytesIO(b"MOCK_AUDIO"), "fallback_song.mp3"),
            "model": "small"
        }
        res = self.client.post('/transcribe', data=data, content_type='multipart/form-data')
        self.assertEqual(res.status_code, 200)
        resp_data = res.get_json()
        self.assertTrue(resp_data["success"])
        self.assertIn("cpu (fallback)", resp_data["device"])
        self.assertIn("Fallback CPU lyrics", resp_data["lrc"])

    @patch("Local_PC_Lyrics_API.server.load_model_to_ram")
    def test_model_load_endpoint(self, mock_load):
        mock_load.return_value = (MagicMock(), "cuda", "float16", "/dev/shm/test")
        res = self.client.post('/api/model/load', json={"source": "online", "model": "small"})
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data["success"])
        self.assertEqual(data["device"], "cuda")
        self.assertIn("storage_info", data)

    def test_model_purge_endpoint(self):
        res = self.client.post('/api/model/purge')
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data["success"])
        self.assertIn("storage_info", data)


if __name__ == "__main__":
    unittest.main()

