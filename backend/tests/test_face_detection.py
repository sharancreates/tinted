"""Face detection on real photographs from data/test_images."""

from pathlib import Path

import pytest

from detection.face_detection import detect_face, extract_skin_sample_from_image

IMAGES = Path(__file__).resolve().parents[2] / "data" / "test_images"


@pytest.mark.parametrize(
    "name", ["Deep:dark.png", "Light:medium.png", "Medium.png", "very_fair_skin.png"]
)
def test_face_found_in_every_test_image(name):
    _, landmarks = detect_face((IMAGES / name).read_bytes())
    assert landmarks is not None


def test_tight_crop_landmarks_map_back_into_frame():
    # Deep:dark.png crops the forehead and chin, so detection only succeeds on
    # the padded retry. The eyes and nose must still land inside the original
    # frame, or patches would be sampled from the wrong place.
    img, landmarks = detect_face((IMAGES / "Deep:dark.png").read_bytes())
    nose_tip = landmarks[1]
    assert 0.0 < nose_tip.x < 1.0 and 0.0 < nose_tip.y < 1.0

    sample = extract_skin_sample_from_image(img, landmarks)
    r, g, b = sample.rgb
    assert r + g + b < 3 * 128, f"deep skin sampled as {sample.rgb}"
