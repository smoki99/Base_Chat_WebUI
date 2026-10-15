# Voice Sidecar

Standalone TTS + STT service for base-chat-webui.

- **TTS** via [edge-tts](https://pypi.org/project/edge-tts/) (Microsoft, online, no API key)
- **STT** via [Whisper](https://github.com/openai/whisper) (local, offline)
- Languages: **de, es, en**

## Quick start

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python voz.py            # starts on 127.0.0.1:8765
```

> First STT request triggers the Whisper model download (~500 MB–1.5 GB
> depending on GPU/CPU). TTS (edge-tts) requires an internet connection.

## Configuration

| Env             | Default                                   | Description          |
| --------------- | ----------------------------------------- | -------------------- |
| `VOICE_PORT`    | `8765`                                    | Port for the sidecar |
| `WHISPER_MODEL` | auto (`large-v3-turbo` GPU / `small` CPU) | Whisper model        |

## Endpoints

| Method | Path      | Body / Query               | Response                                         |
| ------ | --------- | -------------------------- | ------------------------------------------------ |
| GET    | `/health` | –                          | `{ tts, stt, voices, languages, default_voice }` |
| POST   | `/tts`    | `{ text, voice? }`         | `audio/mpeg`                                     |
| POST   | `/stt`    | raw audio + `?language=de` | `{ text }`                                       |

## Concurrency

Die STT-Inferrerence (Whisper/transformers) ist CPU/GPU-lastig und läuft daher
im **Starlette-Thread-Pool** (`run_in_threadpool`), serialisiert über eine
Lock – der asyncio-Event-Loop bleibt frei, **TTS-Requests werden weiterhin
bedient, während STT läuft**.

## Tests

```bash
pip install pytest
pytest test_voz.py -v
```

## Docker

```bash
docker build -t base-chat-voz .
docker run -p 8765:8765 base-chat-voz
```

## Integration with the API

Set `VOICE_SERVICE_URL` in the API's `.env`:

```bash
VOICE_SERVICE_URL=http://127.0.0.1:8765
```

The API exposes:

- `GET /api/voice/capabilities` → `{ data: { tts, stt, voices, languages, defaultVoiceByLanguage } }`
- `POST /api/voice/tts` → audio
- `POST /api/voice/stt` → `{ data: { text } }`
