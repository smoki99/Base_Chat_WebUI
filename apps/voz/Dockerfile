# Voice sidecar – base-chat-webui
# TTS (edge-tts, online) + STT (Whisper, local)
FROM python:3.11-slim

# libgomp1 (OpenMP for torch), ffmpeg (audio decoding)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 ffmpeg && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY voz.py .

EXPOSE 8765
CMD ["python", "voz.py", "8765"]