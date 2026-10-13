# Voice Sidecar – Start-Anleitung

Der Voice-Sidecar (`apps/voz`) stellt **TTS** (edge-tts, online) und **STT**
(Whisper, lokal) als eigenständigen FastAPI-Dienst bereit. Er ist **optional**:
Ohne Sidecar läuft die App normal weiter – die Voice-Buttons werden einfach
nicht angezeigt.

## Voraussetzungen

- Python ≥ 3.10
- Für STT (Whisper): ~2 GB RAM (CPU) bzw. GPU mit ≥ 4 GB VRAM (empfohlen)
- Für TTS (edge-tts): Internetzugang

## Schnellstart

```bash
cd apps/voz

# 1. Virtuelle Umgebung erstellen (einmalig)
python3 -m venv .venv

# 2. Dependencies installieren (einmalig)
.venv/bin/pip install -r requirements.txt

# 3. Sidecar starten
.venv/bin/python voz.py
```

Der Sidecar lauscht auf `http://127.0.0.1:8765`.

> **Hinweis:** Beim ersten Start lädt Whisper das Modell (~150 MB) aus dem
> Hugging Face Hub. Danach wird es lokal zwischengespeichert.

### Hintergrund-Start (empfohlen für Dev)

```bash
cd apps/voz
nohup .venv/bin/python voz.py > /tmp/voz.log 2>&1 &
echo "Sidecar PID: $!"
```

Logs: `tail -f /tmp/voz.log`

### Stoppen

```bash
kill $(lsof -t -i:8765)
# oder, wenn die PID bekannt ist:
kill <PID>
```

## Konfiguration

| Variable        | Default | Beschreibung                                                                      |
| --------------- | ------- | --------------------------------------------------------------------------------- |
| `VOICE_PORT`    | `8765`  | Port des Sidecars (alternativ: `python voz.py 9000`)                              |
| `WHISPER_MODEL` | auto    | Whisper-Modell (auto: `whisper-large-v3-turbo` bei CUDA, `whisper-small` bei CPU) |

### API-seitig (`.env`)

```env
VOICE_SERVICE_URL=http://127.0.0.1:8765
```

Diese URL muss auf den Sidecar zeigen. Ohne sie nutzt die API den Default
(`http://127.0.0.1:8765`) – funktioniert also out of the box.

## Endpunkte

| Methode | Pfad               | Beschreibung                                                     |
| ------- | ------------------ | ---------------------------------------------------------------- |
| `GET`   | `/health`          | Availability, Voice-Katalog, Fehler                              |
| `POST`  | `/tts`             | `{ "text": "...", "voice": "de-DE-KatjaNeural" }` → `audio/mpeg` |
| `POST`  | `/stt?language=de` | Raw Audio (body) → `{ "text": "..." }`                           |

### Beispiel: TTS

```bash
curl -X POST http://127.0.0.1:8765/tts \
  -H 'Content-Type: application/json' \
  -d '{"text": "Hallo Welt", "voice": "de-DE-KatjaNeural"}' \
  -o hello.mp3
```

### Beispiel: Health-Check

```bash
curl http://127.0.0.1:8765/health | python3 -m json.tool
```

## Voice-Katalog (edge-tts)

| ID                   | Name      | Sprache  |
| -------------------- | --------- | -------- |
| `de-DE-KatjaNeural`  | Katja 🇩🇪  | Deutsch  |
| `de-DE-ConradNeural` | Conrad 🇩🇪 | Deutsch  |
| `es-ES-ElviraNeural` | Elvira 🇪🇸 | Spanisch |
| `es-ES-AlvaroNeural` | Alvaro 🇪🇸 | Spanisch |
| `en-US-JennyNeural`  | Jenny 🇺🇸  | Englisch |
| `en-US-GuyNeural`    | Guy 🇺🇸    | Englisch |

## Docker (alternativ)

```bash
docker build -t voz apps/voz
docker run --rm -p 8765:8765 voz
```

## Troubleshooting

| Symptom                          | Ursache                  | Fix                                                  |
| -------------------------------- | ------------------------ | ---------------------------------------------------- |
| `STT not ready` (503)            | Whisper-Modell lädt noch | `tail -f /tmp/voz.log` – warten bis „STT ready"      |
| `tts: ...` (500)                 | edge-tts offline         | Internetverbindung prüfen                            |
| Sidecar startet nicht            | Port belegt              | `lsof -i:8765` → killen oder `VOICE_PORT` ändern     |
| `externally-managed-environment` | System-Python ohne Venv  | Immer `.venv/bin/pip` verwenden (siehe oben)         |
| GPU nicht erkannt                | CUDA fehlt               | `WHISPER_MODEL=openai/whisper-small` für CPU-Betrieb |
