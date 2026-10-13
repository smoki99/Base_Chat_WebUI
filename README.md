# voz

Voice-Sidecar für base-chat-webui: **TTS + STT** in einem separaten Prozess.

| Funktion | Technologie | Offline? |
| -------- | ----------- | -------- |
| TTS      | edge-tts (Microsoft) | Nein (Online) |
| STT      | Whisper (OpenAI / faster-whisper) | Ja (lokal) |

**Sprachen:** `de`, `en`, `es` (STT: Whisper multi-sprachig; TTS: pro Sprache eine Default-Stimme)

## Quick start

```bash
cd voz
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python voz.py            # lauscht auf http://127.0.0.1:8765
```

## Endpoints

| Method | Path      | Body / Query                        | Response              |
| ------ | --------- | ----------------------------------- | --------------------- |
| GET    | `/health` | –                                   | Verfügbarkeit + Stimmen |
| POST   | `/tts`    | `{ text, voice?, language? }`       | `audio/mpeg`          |
| POST   | `/stt`    | raw audio + `?language=de\|en\|es`  | `{ text }`            |

## Concurrency

Die STT-Inferrerence (Whisper) ist CPU/GPU-lastig und läuft daher im
**Starlette-Thread-Pool** (`run_in_threadpool`), serialisiert über eine Lock.
Der asyncio-Event-Loop bleibt frei – **TTS-Requests werden weiterhin
bedient, während STT läuft**.

## Integration

Die Express-API (`apps/api`) erkennt den Sidecar automatisch über
`VOICE_SERVICE_URL` (Default `http://127.0.0.1:8765`).
Ohne Sidecar sind die Voice-Buttons im Web-UI ausgegraut
(Capability-Detection).

## Tests

```bash
pip install pytest
pytest test_voz.py -v
```

## Docker

```bash
docker build -t voz .
docker run -p 8765:8765 voz
```

## Sicherheitshinweise

- **TTS (edge-tts)**: Sendet Text + Sprachwahl an Microsoft-Server.
  **Keine lokalen Daten** – aber **Online-Abhängigkeit**.
- **STT (Whisper)**: Läuft **vollständig lokal** – keine Daten verlassen die Maschine.
- **API ohne Auth**: Bindet standardmäßig auf `127.0.0.1` (localhost-only).
  Bei Netzwerk-Exposition **vor** dem Reverse-Proxy einen Token hinzufügen.
- **Kein API-Key**: edge-tts nutzt eine anonyme Microsoft-Instanz –
  bei hohem Volumen kann rate-limiten. Für Produktion: eigene TTS-Instanz oder
  API-Key (z. B. Azure Speech) konfigurieren.
- **Whisper-Modell**: `base` (Default, ~140 MB). Für bessere Qualität:
  `WHISPER_MODEL=small` oder `WHISPER_MODEL=medium` setzen.
  Modelle werden **einmalig** heruntergeladen und lokal gecachtet.

## Performance (Typisch, M1/M2 Mac)

| Aufgabe | Modell | Zeit |
| ------- | ------ | ---- |
| TTS (50 Wörter) | edge-tts | ~2–4 s |
| STT (5 s Audio) | whisper base | ~1–3 s (CPU) / ~0.5 s (GPU) |
