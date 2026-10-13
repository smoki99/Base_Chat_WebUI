"""Tests for the voz voice sidecar (FastAPI)."""

import sys
import types
from unittest.mock import MagicMock

import pytest

# ── Mock out heavy/optional deps BEFORE importing voz ──────────────────────
edge_tts_mock = MagicMock()
edge_tts_mock.Communicate = MagicMock(return_value=MagicMock())
sys.modules["edge_tts"] = edge_tts_mock

torch_mock = MagicMock()
torch_mock.cuda.is_available.return_value = False
sys.modules["torch"] = torch_mock

# Force the openai-whisper code path (deterministic, no CTranslate2).
whisper_mock = MagicMock()
whisper_mock.load_model = MagicMock()
sys.modules["faster_whisper"] = None  # trigger ImportError branch
sys.modules["whisper"] = whisper_mock

import voz  # noqa: E402


def make_client():
    from starlette.testclient import TestClient

    return TestClient(voz.app)


def test_health_reports_availability():
    client = make_client()
    resp = client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["tts"] is True
    assert body["stt"] in (True, False)  # depends on model load thread
    assert "de" in body["languages"]
    assert "en" in body["languages"]


def test_tts_requires_text():
    client = make_client()
    resp = client.post("/tts", json={})
    assert resp.status_code == 400
    assert "text" in resp.json()["error"]


def test_tts_rejects_oversized_text():
    client = make_client()
    resp = client.post("/tts", json={"text": "x" * 5001})
    assert resp.status_code == 400


def test_stt_rejects_empty_audio():
    client = make_client()
    resp = client.post("/stt", content=b"")
    assert resp.status_code in (400, 503)  # 503 if model not yet loaded


def test_stt_returns_transcript_when_ready():
    """With a fake pipeline returning a fixed text, STT returns it."""
    voz.state["stt"] = True
    voz.whisper_pipe = MagicMock(return_value={"text": "  Hallo Welt  "})
    client = make_client()
    resp = client.post("/stt?language=de", content=b"fake-audio-bytes")
    assert resp.status_code == 200
    assert resp.json()["text"] == "Hallo Welt"


def test_stt_defaults_language_to_de_when_invalid():
    voz.state["stt"] = True
    captured = {}

    def fake_pipe(audio, generate_kwargs, return_timestamps):
        captured["language"] = generate_kwargs["language"]
        return {"text": "ok"}

    voz.whisper_pipe = fake_pipe
    client = make_client()
    resp = client.post("/stt?language=xx", content=b"fake-audio-bytes")
    assert resp.status_code == 200
    assert captured["language"] == "de"


def test_stt_blocking_inference_is_offloaded_to_threadpool():
    """Regression: Whisper must never run on the asyncio event loop.

    If inference blocks the loop, all concurrent TTS requests stall while
    STT is running. The endpoint stays async (to read the request body),
    the blocking part is dispatched via run_in_threadpool.
    """
    import inspect

    assert inspect.iscoroutinefunction(voz.stt)
    assert not inspect.iscoroutinefunction(voz._transcribe)
    assert "run_in_threadpool" in inspect.getsource(voz.stt)


def test_stt_serializes_inference_with_a_lock():
    """Concurrent STT calls must not run Whisper in parallel (not thread-safe)."""
    import threading

    assert isinstance(voz.stt_lock, type(threading.Lock()))
