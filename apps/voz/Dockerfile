# voz sidecar – base-chat-webui (CUDA build for the RTX 5090 machine)
# TTS (edge-tts, online) + STT (Whisper large-v3-turbo on GPU)
#
# Base ships torch (CUDA build) preinstalled – `pip install -r requirements.txt`
# sees the `torch>=2.0` requirement as satisfied and keeps the GPU build.
#
# Build: docker build -t base-chat-webui/voz apps/voz

FROM pytorch/pytorch:2.9.1-cuda12.8-cudnn9-runtime

# libgomp1 (OpenMP for torch), ffmpeg (audio decoding for STT input)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 ffmpeg && \
    rm -rf /var/lib/apt/lists/*

# Non-root user + writable HF cache home (volume mount target)
RUN useradd -m voz

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY --chown=voz:voz voz.py .
RUN mkdir -p /home/voz/.cache/huggingface \
    && chown -R voz:voz /app /home/voz/.cache/huggingface

USER voz
ENV HOME=/home/voz
EXPOSE 8765
HEALTHCHECK --interval=30s --timeout=10s --start-period=180s --retries=5 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8765/health')" || exit 1
CMD ["python", "voz.py", "8765"]