"""Voice sidecar for base-chat-webui.

Provides TTS (edge-tts, online) and STT (Whisper, local) as a standalone
FastAPI service. Supports de / es / en.

Endpoints:
  GET  /health  -> availability + voice list
  POST /tts     -> { text, voice? } -> audio/mpeg
  POST /stt     -> raw audio + ?language=de -> { text }

Start:
  python voz.py [PORT]
"""

import io
import os
import sys
import threading

import edge_tts
import torch
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, Response
from starlette.concurrency import run_in_threadpool
import uvicorn

try:
    from faster_whisper import WhisperModel

    WHISPER_BACKEND = "faster-whisper"
except ImportError:
    WhisperModel = None
    WHISPER_BACKEND = "openai-whisper"
    import whisper

LANGUAGES = {"de": "de", "es": "es", "en": "en"}

app = FastAPI(title="voz", version="1.0.0")

# ── Runtime state ───────────────────────────────────────────────────────────
# edge-tts is an online service – it is always "available" once installed.
# STT (Whisper) needs a model download and loads in the background.
state = {"tts": True, "stt": False, "error": None}
whisper_pipe = None
# Serializes Whisper inference (the pipeline is not thread-safe).
stt_lock = threading.Lock()


def _load_whisper():
    global whisper_pipe
    model_name = os.environ.get("WHISPER_MODEL", "base")
    if WHISPER_BACKEND == "faster-whisper":
        # faster-whisper: local files, no download, CTranslate2 backend
        model_path = os.environ.get("WHISPER_MODEL_PATH")
        whisper_pipe = WhisperModel(
            model_path or model_name,
            device="cuda" if torch.cuda.is_available() else "cpu",
            compute_type="float16" if torch.cuda.is_available() else "int8",
        )
        state["stt"] = True
    else:
        whisper_pipe = whisper.load_model(model_name)
        state["stt"] = True


@app.on_event("startup")
def startup():
    # Load Whisper in a daemon thread so the server can start immediately.
    # TTS works right away; STT reports 503 until the model is ready.
    t = threading.Thread(target=_load_whisper, daemon=True)
    t.start()


def _resolve_voice(voice: str | None, language: str) -> str:
    """Map language → default voice, or use explicit voice."""
    if voice:
        return voice
    defaults = {"de": "de-DE-ConradNeural", "en": "en-US-AriaNeural", "es": "es-ES-ElviraNeural"}
    return defaults.get(language, defaults["de"])


@app.get("/health")
async def health():
    """Availability + voice list for capability detection."""
    voices = []
    if state["tts"]:
        try:
            voices = [v["ShortName"] for v in await edge_tts.list_voices()]
        except Exception:
            pass
    return {
        "tts": state["tts"],
        "stt": state["stt"],
        "voices": voices,
        "languages": list(LANGUAGES.keys()),
        "defaultVoiceByLanguage": {
            "de": "de-DE-ConradNeural",
            "en": "en-US-AriaNeural",
            "es": "es-ES-ElviraNeural",
        },
        "error": state["error"],
    }


@app.post("/tts")
async def tts(req: Request):
    if not state["tts"]:
        return JSONResponse({"error": "TTS not ready"}, status_code=503)

    try:
        body = await req.json()
    except Exception:
        return JSONResponse({"error": "invalid JSON body"}, status_code=400)

    text = (body.get("text") or "").strip()
    if not text:
        return JSONResponse({"error": "text is required"}, status_code=400)
    if len(text) > 5000:
        return JSONResponse({"error": "text too long (max 5000 chars)"}, status_code=400)

    language = (body.get("language") or "de").lower()
    if language not in LANGUAGES:
        language = "de"
    voice = _resolve_voice(body.get("voice"), language)

    try:
        communicate = edge_tts.Communicate(text, voice)
        audio_chunks = []
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_chunks.append(chunk["data"])
        audio = b"".join(audio_chunks)
    except Exception as exc:
        return JSONResponse({"error": f"tts: {exc}"}, status_code=500)

    if not audio:
        return JSONResponse({"error": "tts: empty audio response"}, status_code=500)

    return Response(content=audio, media_type="audio/mpeg")


def _transcribe(audio_bytes: bytes, language: str) -> str:
    """Blocking Whisper inference – always run in the thread pool, never on
    the event loop (otherwise concurrent TTS requests would stall)."""
    with stt_lock:
        result = whisper_pipe(
            audio_bytes,
            generate_kwargs={"language": language, "task": "transcribe"},
            return_timestamps=False,
        )
    return (result.get("text") or "").strip()


@app.post("/stt")
async def stt(req: Request):
    if not state["stt"]:
        return JSONResponse({"error": "STT not ready"}, status_code=503)

    audio_bytes = await req.body()
    if not audio_bytes:
        return JSONResponse({"error": "empty audio"}, status_code=400)

    language = req.query_params.get("language", "de")
    if language not in LANGUAGES:
        language = "de"

    try:
        # run_in_threadpool: Whisper inference (CPU/GPU-bound) must not block
        # the asyncio event loop – TTS requests keep being served meanwhile.
        text = await run_in_threadpool(_transcribe, audio_bytes, language)
    except Exception as exc:
        return JSONResponse({"error": f"stt: {exc}"}, status_code=500)

    return {"text": text}


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning")
