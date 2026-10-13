"""Tests for the voice sidecar (voz.py).

These tests validate the HTTP contract (health, TTS validation, STT validation)
without requiring a real edge-tts/Whisper model. Run with:
  pytest test_voz.py -v
"""

import pytest
from fastapi.testclient import TestClient

import voz


@pytest.fixture
def client():
    """Test client with both TTS and STT marked as available."""
    voz.state["tts"] = True
    voz.state["stt"] = True
    return TestClient(voz.app)


def test_health_returns_capabilities(client):
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["tts"] is True
    assert data["stt"] is True
    assert len(data["voices"]) == 6
    assert set(data["languages"]) == {"de", "es", "en"}
    assert data["default_voice"]["de"] == "de-DE-KatjaNeural"
    assert data["default_voice"]["es"] == "es-ES-ElviraNeural"
    assert data["default_voice"]["en"] == "en-US-JennyNeural"


def test_voices_have_valid_shape(client):
    res = client.get("/health")
    data = res.json()
    for voice in data["voices"]:
        assert voice["id"]
        assert voice["name"]
        assert voice["gender"] in ("f", "m")
        assert voice["language"] in ("de", "es", "en")


def test_tts_requires_text(client):
    res = client.post("/tts", json={})
    assert res.status_code == 400
    assert "text" in res.json()["error"]


def test_tts_rejects_blank_text(client):
    res = client.post("/tts", json={"text": "   "})
    assert res.status_code == 400


def test_stt_rejects_empty_audio(client):
    res = client.post("/stt")
    assert res.status_code == 400
    assert "audio" in res.json()["error"]


def test_stt_returns_503_when_not_ready():
    """When STT is not ready, the endpoint returns 503."""
    voz.state["stt"] = False
    client = TestClient(voz.app)
    res = client.post("/stt", content=b"fake-audio", headers={"Content-Type": "audio/webm"})
    assert res.status_code == 503
    assert "STT" in res.json()["error"]