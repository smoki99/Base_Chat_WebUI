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

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else int(os.environ.get("VOICE_PORT", "8765"))
WHISPER_MODEL = os.environ.get("WHISPER_MODEL") or (
    "openai/whisper-large-v3-turbo" if DEVICE == "cuda" else "openai/whisper-small"
)

# ── Voice catalog (edge-tts) ────────────────────────────────────────────────
VOICES = [
    {"id": "de-DE-KatjaNeural", "name": "Katja", "gender": "f", "language": "de"},
    {"id": "de-DE-ConradNeural", "name": "Conrad", "gender": "m", "language": "de"},
    {"id": "es-ES-ElviraNeural", "name": "Elvira", "gender": "f", "language": "es"},
    {"id": "es-ES-AlvaroNeural", "name": "Alvaro", "gender": "m", "language": "es"},
    {"id": "en-US-JennyNeural", "name": "Jenny", "gender": "f", "language": "en"},
    {"id": "en-US-GuyNeural", "name": "Guy", "gender": "m", "language": "en"},
]
DEFAULT_VOICE = {"de": "de-DE-KatjaNeural", "es": "es-ES-ElviraNeural", "en": "en-US-JennyNeural"}
VALID_VOICE_IDS = {v["id"] for v in VOICES}
LANGUAGES = ["de", "es", "en"]

# ── Runtime state ───────────────────────────────────────────────────────────
# edge-tts is an online service – it is always "available" once installed.
# STT (Whisper) needs a model download and loads in the background.
state = {"tts": True, "stt": False, "error": None}
whisper_pipe = None
# Serializes Whisper inference (the transformers pipeline is not thread-safe).
stt_lock = threading.Lock()


def _load_stt():
    """Load the Whisper model in a background thread."""
    global whisper_pipe
    try:
        print(f"[voz] Loading Whisper ({WHISPER_MODEL}) ...", flush=True)
        from transformers import pipeline

        whisper_pipe = pipeline(
            "automatic-speech-recognition",
            model=WHISPER_MODEL,
            device=DEVICE,
        )
        state["stt"] = True
        print("[voz] STT ready", flush=True)
    except Exception as exc:
        state["error"] = (state["error"] or "") + f" STT: {exc}"
        print(f"[voz] STT load error: {exc}", flush=True)


async def _synthesize_edge(text: str, voice: str) -> bytes:
    """Synthesize speech with edge-tts, return MP3 bytes."""
    communicate = edge_tts.Communicate(text, voice)
    buf = io.BytesIO()
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            buf.write(chunk["data"])
    return buf.getvalue()


app = FastAPI()


@app.get("/health")
def health():
    return {
        "tts": state["tts"],
        "stt": state["stt"],
        "voices": VOICES,
        "languages": LANGUAGES,
        "default_voice": DEFAULT_VOICE,
        "error": state["error"],
    }


@app.post("/tts")
async def tts(req: Request):
    body = await req.json()
    text = (body.get("text") or "").strip()
    if not text:
        return JSONResponse({"error": "text is required"}, status_code=400)

    voice = body.get("voice") or DEFAULT_VOICE["de"]
    if voice not in VALID_VOICE_IDS:
        voice = DEFAULT_VOICE["de"]

    try:
        audio = await _synthesize_edge(text, voice)
    except Exception as exc:
        return JSONResponse({"error": f"tts: {exc}"}, status_code=500)

    return Response(content=audio, media_type="audio/mpeg")


def _transcribe(audio_bytes: bytes, language: str) -> str:
    """Blocking Whisper inference – always run in the thread pool, never on
    the event loop (otherwise concurrent TTS requests would stall).

    Serialized via stt_lock: the transformers pipeline is not thread-safe.
    """
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
    print(f"[voz] Voice sidecar · port {PORT} · device {DEVICE}", flush=True)
    threading.Thread(target=_load_stt, daemon=True).start()
    uvicorn.run(app, host="127.0.0.1", port=PORT, log_level="warning")
