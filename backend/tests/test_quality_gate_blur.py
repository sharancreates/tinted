"""Blur gate: sharp laptop-webcam selfies must pass, heavily blurred ones must not."""

from pathlib import Path

import cv2
import numpy as np
import pytest

from detection.face_detection import _detect_landmarks
from quality_gate import _BLUR_MIN, check_blur

IMAGES = Path(__file__).resolve().parents[2] / "data" / "test_images"
NAMES = ["Deep:dark.png", "Light:medium.png", "Medium.png", "very_fair_skin.png"]


def _webcam_frame(img: np.ndarray) -> np.ndarray:
    """The portrait, small, in a 1280x720 frame of smooth wall, JPEG-encoded,
    which is roughly what a laptop webcam capture looks like."""
    H, W = 720, 1280
    frame = np.full((H, W, 3), (170, 180, 190), np.uint8)
    th = int(H * 0.5)
    tw = int(img.shape[1] * th / img.shape[0])
    small = cv2.resize(img, (tw, th), interpolation=cv2.INTER_AREA)
    y, x = (H - th) // 2, (W - tw) // 2
    frame[y : y + th, x : x + tw] = small
    _, enc = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 92])
    return cv2.imdecode(enc, cv2.IMREAD_COLOR)


@pytest.mark.parametrize("name", NAMES)
def test_sharp_webcam_frame_passes(name):
    frame = _webcam_frame(cv2.imread(str(IMAGES / name)))
    landmarks = _detect_landmarks(frame)
    assert landmarks is not None
    assert check_blur(frame, landmarks) >= _BLUR_MIN


@pytest.mark.parametrize("name", NAMES)
def test_heavily_blurred_webcam_frame_fails(name):
    frame = _webcam_frame(cv2.imread(str(IMAGES / name)))
    landmarks = _detect_landmarks(frame)
    blurred = cv2.GaussianBlur(frame, (0, 0), 5)
    assert check_blur(blurred, landmarks) < _BLUR_MIN
