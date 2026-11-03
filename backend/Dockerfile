# Tinted API.
#
# Docker rather than Render's native Python runtime because MediaPipe depends on
# opencv-contrib-python — the non-headless build — which needs libGL and glib at
# import time. Swapping our own pin to opencv-python-headless does not help:
# mediapipe pulls contrib in regardless, so the system libraries have to exist.
# Native runtimes give no way to install them, hence this file.

FROM python:3.11-slim

# libgl1 + libglib2.0-0 satisfy the OpenCV import. libgomp1 is needed by the
# ONNX/TFLite kernels MediaPipe runs on CPU. libegl1 + libgles2 are loaded by
# libmediapipe.so in mediapipe 0.10.30+, which no longer bundles them.
RUN apt-get update && apt-get install -y --no-install-recommends \
        libgl1 \
        libglib2.0-0 \
        libgomp1 \
        libegl1 \
        libgles2 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Requirements first so the dependency layer caches across code changes.
# Only requirements.txt — torch and torchvision live in requirements-train.txt
# and are not installed here, which keeps roughly 543MB out of the image.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# .dockerignore keeps the local virtualenvs, tests, eval assets and the unused
# training checkpoint out of this layer.
COPY . .

ENV PYTHONUNBUFFERED=1

# Render injects PORT. The shell form is required so it expands.
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
