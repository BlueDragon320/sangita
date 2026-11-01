import os
import shutil
import sqlite3
import pytest
from unittest.mock import patch, MagicMock

import backend.app as app_mod


@pytest.fixture
def client():
    app_mod.app.config["TESTING"] = True
    with app_mod.app.test_client() as client:
        yield client


def test_api_health_success_schema(client):
    """Verify /api/health returns 200 OK and expected JSON schema structure."""
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.is_json

    data = response.get_json()
    assert isinstance(data, dict)

    # Required top-level fields
    assert data["status"] == "ok"
    assert data["version"] == "1.2.0"

    # Database observability payload
    assert "database" in data
    assert isinstance(data["database"], dict)
    assert data["database"]["status"] == "ok"
    assert "stats_count" in data["database"]
    assert isinstance(data["database"]["stats_count"], int)
    assert data["database"]["stats_count"] >= 0

    # Storage observability payload
    assert "storage" in data
    assert isinstance(data["storage"], dict)
    assert "data_dir_free_mb" in data["storage"]
    assert "music_dir_free_mb" in data["storage"]
    assert isinstance(data["storage"]["data_dir_free_mb"], (int, float))
    assert isinstance(data["storage"]["music_dir_free_mb"], (int, float))

    # Sync server status
    assert "sync_server" in data
    assert data["sync_server"] in ("disabled", "ok", "reachable")


def test_database_failure_simulation_returns_degraded(client):
    """Simulate database failure and verify degraded status (HTTP 503)."""
    with patch.object(app_mod, "get_db", side_effect=sqlite3.OperationalError("Simulated DB lock")):
        response = client.get("/api/health")
        assert response.status_code == 503
        assert response.is_json

        data = response.get_json()
        assert data["status"] == "degraded"
        assert data["database"]["status"] in ("error", "degraded")
        assert data["database"]["stats_count"] is None


def test_storage_space_metrics_positive_numbers(client):
    """Ensure storage space metrics are numbers > 0."""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.get_json()

    data_dir_mb = data["storage"]["data_dir_free_mb"]
    music_dir_mb = data["storage"]["music_dir_free_mb"]

    assert isinstance(data_dir_mb, (int, float))
    assert isinstance(music_dir_mb, (int, float))
    assert data_dir_mb > 0
    assert music_dir_mb > 0


def test_storage_critical_failure_simulation(client):
    """Simulate storage failure and verify HTTP 503 and degraded status."""
    with patch("shutil.disk_usage", side_effect=OSError("Disk unreadable")):
        response = client.get("/api/health")
        assert response.status_code == 503
        data = response.get_json()
        assert data["status"] == "degraded"
        assert data["storage"]["data_dir_free_mb"] == 0.0
        assert data["storage"]["music_dir_free_mb"] == 0.0


def test_sync_server_configured_reachable(client):
    """Verify sync_server reports 'ok' when configured and endpoint responds 200."""
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"status": "ok"}

    with patch.dict(os.environ, {"SYNC_SERVER_URL": "http://127.0.0.1:3001"}):
        with patch("requests.get", return_value=mock_resp):
            response = client.get("/api/health")
            assert response.status_code == 200
            data = response.get_json()
            assert data["status"] == "ok"
            assert data["sync_server"] == "ok"


def test_sync_server_configured_unreachable(client):
    """Verify sync_server reports 'unreachable' and overall status 'degraded' (HTTP 200) without crashing."""
    with patch.dict(os.environ, {"SYNC_SERVER_URL": "http://127.0.0.1:3001"}):
        with patch("requests.get", side_effect=Exception("Connection refused")):
            response = client.get("/api/health")
            assert response.status_code == 200
            data = response.get_json()
            assert data["status"] == "degraded"
            assert data["sync_server"] == "unreachable"


def test_no_sensitive_data_exposure(client):
    """Verify no secret keys, credentials, or internal secrets are exposed."""
    response = client.get("/api/health?internal_secret=secret123&token=myjwt")
    assert response.status_code == 200
    raw_text = response.get_data(as_text=True)

    # Check secret key not exposed
    assert app_mod.SECRET_KEY not in raw_text
    assert app_mod.PASSWORD not in raw_text
    assert "internal_secret" not in raw_text
    assert "secret123" not in raw_text
    assert "myjwt" not in raw_text

    # Check allowed keys only
    data = response.get_json()
    assert set(data.keys()) == {"status", "database", "storage", "sync_server", "version"}
    assert set(data["database"].keys()) == {"status", "stats_count"}
    assert set(data["storage"].keys()) == {"data_dir_free_mb", "music_dir_free_mb"}


def test_no_sqlite_connection_leak(client):
    """Verify repeated health check calls do not leak SQLite connections or throw exceptions."""
    for _ in range(25):
        resp = client.get("/api/health")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["status"] == "ok"


def test_health_head_method(client):
    """Verify HEAD method is supported on /api/health."""
    response = client.head("/api/health")
    assert response.status_code == 200


def test_health_alias_endpoint(client):
    """Verify /health route alias functions identically."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.get_json()
    assert data["status"] == "ok"
    assert data["version"] == "1.2.0"
