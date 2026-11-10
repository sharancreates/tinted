"""Skin pixel extraction using MediaPipe Face Landmarker (Tasks API).

FaceLandmarker is initialised once at module load time and reused across
every request.  The public surface is:

    extract_skin_sample(image_bytes) -> SkinSample   (raises ValueError on failure)
    extract_face_crop(image_bytes)   -> np.ndarray | None   (for the ML model)
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from pathlib import Path

import cv2
import mediapipe as mp
import numpy as np

from color_utils import apply_clahe, preprocess_image

# ---------------------------------------------------------------------------
# MediaPipe FaceLandmarker singleton (Tasks API, mediapipe >= 0.10)
# ---------------------------------------------------------------------------

_MODEL_PATH = Path(__file__).resolve().parent.parent / "ml" / "face_landmarker.task"

_BaseOptions = mp.tasks.BaseOptions
_FaceLandmarker = mp.tasks.vision.FaceLandmarker
_FaceLandmarkerOptions = mp.tasks.vision.FaceLandmarkerOptions
_RunningMode = mp.tasks.vision.RunningMode

_face_landmarker = _FaceLandmarker.create_from_options(
    _FaceLandmarkerOptions(
        base_options=_BaseOptions(model_asset_path=str(_MODEL_PATH)),
        running_mode=_RunningMode.IMAGE,
        num_faces=1,
        min_face_detection_confidence=0.5,
        min_face_presence_confidence=0.5,
        min_tracking_confidence=0.5,
    )
)

# ---------------------------------------------------------------------------
# Landmark index sets
#
# Chosen from the MediaPipe 468-point canonical model to sit on the flat
# malar skin area, away from the nasolabial fold, lip corners, and the
# infraorbital zone.  Forehead count is intentionally low (5): the forehead
# is the region most prone to specular highlights and overhead lighting wash.
# ---------------------------------------------------------------------------

CHEEK_LANDMARKS: list[int] = [
    # left cheek (subject's left)
    50, 101, 118, 36, 123, 147,
    # right cheek (subject's right)
    280, 330, 347, 266, 352, 376,
]

FOREHEAD_LANDMARKS: list[int] = [10, 151, 9, 107, 336]

_ALL_LANDMARKS: list[int] = CHEEK_LANDMARKS + FOREHEAD_LANDMARKS

# ---------------------------------------------------------------------------
# Quality-filter thresholds
# ---------------------------------------------------------------------------

_STD_MAX     = 30    # max V-channel std within a patch; above → edge or highlight
# A patch is blown out when a quarter of its pixels sit at the sensor ceiling.
# This used to be "mean V above 240", but the MST 1-3 references are V 243-247:
# the gate threw away healthy pale skin as overexposed. The simulated lighting
# eval (eval/pipeline_sim.py) refused a third of MST 1-3 faces in daylight.
_CLIP_V        = 252   # V at or above this counts as clipped
_CLIP_FRAC_MAX = 0.25  # more clipped pixels than this → patch is blown out
_V_MIN       = 30    # min mean V; below → patch is in deep shadow
_TRIM_FRAC   = 0.10  # fraction to drop from each L*-sorted tail
_MIN_PATCHES = 5     # minimum patches required before we'll return a result

# ---------------------------------------------------------------------------
# Result type
# ---------------------------------------------------------------------------


def _clipped(v: np.ndarray) -> bool:
    """True when too much of a patch's V channel is at the sensor ceiling."""
    return float((v >= _CLIP_V).mean()) > _CLIP_FRAC_MAX


@dataclass
class SkinSample:
    """Aggregated skin colour derived from quality-filtered landmark patches."""
    rgb:            tuple[int, int, int]
    lab:            tuple[float, float, float]
    patch_count:    int   # patches that survived quality checks
    rejected_count: int   # patches rejected by the quality filter


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def detect_face(image_bytes: bytes) -> tuple[np.ndarray, object | None]:
    """Preprocess *image_bytes* and run face landmark detection.

    Returns ``(img_bgr, landmarks)`` where *landmarks* is ``None`` when no
    face is found.  Raises ``ValueError`` when the bytes cannot be decoded.

    This is the first half of :func:`extract_skin_sample`.  Call it before
    running the quality gate so preprocessing and landmark detection happen
    only once.
    """
    img_bgr = preprocess_image(image_bytes)
    return img_bgr, _detect_landmarks(img_bgr)


def extract_skin_sample(image_bytes: bytes) -> SkinSample:
    """Full pipeline: decode → preprocess → detect → extract skin sample.

    Raises:
        ValueError: when no face is detected, or fewer than ``_MIN_PATCHES``
                    patches survive quality checks.  The message is safe to
                    surface directly to the end user.
    """
    img_bgr, landmarks = detect_face(image_bytes)
    if landmarks is None:
        raise ValueError(
            "No face detected. "
            "Try a well-lit, front-facing photo with your full face visible."
        )
    return _extract_patches(img_bgr, landmarks)


def extract_skin_sample_from_image(
    img_bgr: np.ndarray,
    landmarks,
) -> SkinSample:
    """Extract a :class:`SkinSample` from a pre-processed image with known landmarks.

    Use this after :func:`detect_face` and the quality gate to avoid re-running
    preprocessing and landmark detection a second time.

    Raises:
        ValueError: when fewer than ``_MIN_PATCHES`` patches survive quality checks.
    """
    return _extract_patches(img_bgr, landmarks)


def run_landmark_detection(img_bgr: np.ndarray):
    """Public wrapper around _detect_landmarks for the streaming pipeline."""
    return _detect_landmarks(img_bgr)


def extract_patches_streaming(
    img_bgr: np.ndarray,
    landmarks,
    patch_callback,
) -> SkinSample:
    """Like _extract_patches but calls patch_callback(patch_dict) for every patch evaluated.

    patch_dict keys: x, y, rgb ([r,g,b]), accepted (bool), reject_reason (str|None).
    Raises ValueError when too few patches survive quality checks.
    """
    h, w = img_bgr.shape[:2]
    patch_radius = _compute_patch_radius(landmarks, w, h)
    image_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
    image_hsv = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2HSV)

    accepted: list[tuple[int, int, int]] = []
    rejected_count = 0

    for idx in _ALL_LANDMARKS:
        lm = landmarks[idx]
        cx = int(lm.x * w)
        cy = int(lm.y * h)

        x0 = max(cx - patch_radius, 0)
        x1 = min(cx + patch_radius + 1, w)
        y0 = max(cy - patch_radius, 0)
        y1 = min(cy + patch_radius + 1, h)

        patch_rgb = image_rgb[y0:y1, x0:x1]
        patch_hsv = image_hsv[y0:y1, x0:x1]

        if patch_rgb.size == 0:
            patch_callback({"x": cx, "y": cy, "rgb": [0, 0, 0], "accepted": False, "reject_reason": "out of bounds"})
            rejected_count += 1
            continue

        v      = patch_hsv[:, :, 2]
        v_mean = float(v.mean())
        v_std  = float(v.std())

        mean_px = patch_rgb.reshape(-1, 3).mean(axis=0).round().astype(int)
        rgb_vals = [int(mean_px[0]), int(mean_px[1]), int(mean_px[2])]

        if v_std > _STD_MAX:
            reason = "specular highlight"
        elif _clipped(v):
            reason = "overexposed"
        elif v_mean < _V_MIN:
            reason = "underexposed"
        else:
            reason = None

        if reason:
            patch_callback({"x": cx, "y": cy, "rgb": rgb_vals, "accepted": False, "reject_reason": reason})
            rejected_count += 1
        else:
            patch_callback({"x": cx, "y": cy, "rgb": rgb_vals, "accepted": True, "reject_reason": None})
            accepted.append((rgb_vals[0], rgb_vals[1], rgb_vals[2]))

    if len(accepted) < _MIN_PATCHES:
        raise ValueError(
            f"Only {len(accepted)} of {len(_ALL_LANDMARKS)} skin patches passed "
            f"quality checks ({rejected_count} rejected for harsh highlights, "
            "deep shadows, or uneven lighting). "
            "Try a photo taken in soft, even light — near a window works well."
        )

    avg_rgb, avg_lab = _trimmed_mean_by_luminance(accepted)
    return SkinSample(rgb=avg_rgb, lab=avg_lab, patch_count=len(accepted), rejected_count=rejected_count)


def extract_face_crop(image_bytes: bytes, pad: float = 0.15) -> np.ndarray | None:
    """Return the face region as an (H, W, 3) RGB uint8 array.

    Used by the ML model in monk_classifier to obtain a face-sized crop.
    Returns None when no face is detected or the image cannot be decoded.
    """
    try:
        image_bgr = preprocess_image(image_bytes)
    except ValueError:
        return None

    h, w = image_bgr.shape[:2]
    landmarks = _detect_landmarks(image_bgr)
    if landmarks is None:
        return None

    xs = [int(lm.x * w) for lm in landmarks]
    ys = [int(lm.y * h) for lm in landmarks]
    x0, x1 = min(xs), max(xs)
    y0, y1 = min(ys), max(ys)

    pad_x = int((x1 - x0) * pad)
    pad_y = int((y1 - y0) * pad)
    x0 = max(0, x0 - pad_x)
    x1 = min(w, x1 + pad_x)
    y0 = max(0, y0 - pad_y)
    y1 = min(h, y1 + pad_y)

    crop = image_bgr[y0:y1, x0:x1]
    return cv2.cvtColor(crop, cv2.COLOR_BGR2RGB) if crop.size > 0 else None


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _detect_landmarks(image_bgr: np.ndarray):
    """Run the module-level FaceLandmarker on *image_bgr* and return the first
    face's landmark sequence, or None when no face is found.

    Detection runs on a CLAHE-boosted working copy so shadowed faces are still
    found; *image_bgr* itself is never modified.  Landmark coordinates are
    normalised, so they apply directly to the caller's colour-faithful image.
    """
    working = apply_clahe(image_bgr)
    landmarks = _run_landmarker(working)
    if landmarks is not None:
        return landmarks

    # Close-up portraits that crop the forehead or chin defeat the face
    # detector, which expects a whole face with some margin around it. Padding
    # the frame and retrying recovers them; the landmarks are then mapped back
    # into the unpadded image's normalised coordinates.
    h, w = working.shape[:2]
    pad_y, pad_x = int(h * _RETRY_PAD), int(w * _RETRY_PAD)
    padded = cv2.copyMakeBorder(
        working, pad_y, pad_y, pad_x, pad_x, cv2.BORDER_CONSTANT, value=(128, 128, 128)
    )
    landmarks = _run_landmarker(padded)
    if landmarks is None:
        return None
    pw, ph = w + 2 * pad_x, h + 2 * pad_y
    return [
        _Landmark(
            x=(lm.x * pw - pad_x) / w,
            y=(lm.y * ph - pad_y) / h,
            z=lm.z,
        )
        for lm in landmarks
    ]


# Fraction of each dimension added on every side for the padded retry.
_RETRY_PAD = 0.25


@dataclass(frozen=True)
class _Landmark:
    x: float
    y: float
    z: float


def _run_landmarker(image_bgr: np.ndarray):
    image_rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=image_rgb)
    result = _face_landmarker.detect(mp_image)
    if not result.face_landmarks:
        return None
    return result.face_landmarks[0]


def _compute_patch_radius(landmarks, w: int, h: int) -> int:
    """Return a patch radius scaled to the face size.

    Uses 1 % of the face bounding-box diagonal so patches adapt to both
    thumbnail uploads (where 7 px would cross feature boundaries) and
    high-resolution photos (where 7 px would be sub-millimetre noise).
    Minimum 3 px.
    """
    xs = [int(lm.x * w) for lm in landmarks]
    ys = [int(lm.y * h) for lm in landmarks]
    diagonal = math.sqrt((max(xs) - min(xs)) ** 2 + (max(ys) - min(ys)) ** 2)
    return max(3, int(diagonal * 0.01))


def _rgb_to_lab(r: int, g: int, b: int) -> tuple[float, float, float]:
    """Convert a single RGB triplet to OpenCV LAB."""
    pixel = np.array([[[b, g, r]]], dtype=np.uint8)
    lab = cv2.cvtColor(pixel, cv2.COLOR_BGR2LAB)
    L, a, b_val = lab[0, 0]
    return (float(L), float(a), float(b_val))


def _trimmed_mean_by_luminance(
    patch_means: list[tuple[int, int, int]],
) -> tuple[tuple[int, int, int], tuple[float, float, float]]:
    """Sort patch RGB means by L* in LAB, drop the outer *_TRIM_FRAC* fraction
    from each tail, and return (avg_rgb, avg_lab) of the remainder.

    Trimming by luminance removes blown-out highlights (high L*) and
    shadowed patches (low L*) that survived the per-patch V-channel gate.
    """
    # Annotate each sample with its L* for sorting.
    with_lum = sorted(
        [(_rgb_to_lab(r, g, b)[0], r, g, b) for r, g, b in patch_means],
        key=lambda x: x[0],
    )

    n    = len(with_lum)
    trim = int(n * _TRIM_FRAC)   # 0 when n < 10; no trimming for small sets
    kept = (
        with_lum[trim: n - trim]
        if trim > 0 and n - 2 * trim > 0
        else with_lum
    )

    r = int(round(sum(s[1] for s in kept) / len(kept)))
    g = int(round(sum(s[2] for s in kept) / len(kept)))
    b = int(round(sum(s[3] for s in kept) / len(kept)))
    avg_rgb = (r, g, b)

    return avg_rgb, _rgb_to_lab(r, g, b)


def _extract_patches(img_bgr: np.ndarray, landmarks) -> SkinSample:
    """Core patch extraction shared by the public extract_skin_sample variants.

    Assumes *landmarks* is not None.  Raises ``ValueError`` when fewer than
    ``_MIN_PATCHES`` patches survive the per-patch quality gate.
    """
    h, w = img_bgr.shape[:2]

    patch_radius = _compute_patch_radius(landmarks, w, h)
    image_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
    image_hsv = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2HSV)

    accepted: list[tuple[int, int, int]] = []
    rejected_count = 0

    for idx in _ALL_LANDMARKS:
        lm = landmarks[idx]
        cx = int(lm.x * w)
        cy = int(lm.y * h)

        x0 = max(cx - patch_radius, 0)
        x1 = min(cx + patch_radius + 1, w)
        y0 = max(cy - patch_radius, 0)
        y1 = min(cy + patch_radius + 1, h)

        patch_rgb = image_rgb[y0:y1, x0:x1]
        patch_hsv = image_hsv[y0:y1, x0:x1]

        if patch_rgb.size == 0:
            rejected_count += 1
            continue

        v      = patch_hsv[:, :, 2]
        v_mean = float(v.mean())
        v_std  = float(v.std())

        if v_std > _STD_MAX or _clipped(v) or v_mean < _V_MIN:
            rejected_count += 1
            continue

        mean_px = patch_rgb.reshape(-1, 3).mean(axis=0).round().astype(int)
        accepted.append((int(mean_px[0]), int(mean_px[1]), int(mean_px[2])))

    if len(accepted) < _MIN_PATCHES:
        raise ValueError(
            f"Only {len(accepted)} of {len(_ALL_LANDMARKS)} skin patches passed "
            f"quality checks ({rejected_count} rejected for harsh highlights, "
            "deep shadows, or uneven lighting). "
            "Try a photo taken in soft, even light — near a window works well."
        )

    avg_rgb, avg_lab = _trimmed_mean_by_luminance(accepted)
    return SkinSample(
        rgb=avg_rgb,
        lab=avg_lab,
        patch_count=len(accepted),
        rejected_count=rejected_count,
    )
