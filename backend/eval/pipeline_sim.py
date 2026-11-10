#!/usr/bin/env python3
"""Simulated end-to-end evaluation: lighting -> white balance -> sampling -> MST.

Where this sits
---------------
``classifier_eval.py`` measures the classifier on exact LAB values.
``run_eval.py`` measures the whole pipeline on labelled photographs, and is
blocked until real, consented photos exist.

This harness fills the gap between them. It renders synthetic portrait scenes
with a known skin colour, lights them the way real rooms do (warm bulbs, blue
shade, dim interiors), adds sensor noise and JPEG compression, then runs the
*production* code on the result: ``neutral_pixel_whitebalance`` from
color_utils, ``_extract_patches`` from face_detection (with the real landmark
indices, patch radius, quality gate and luminance-trimmed mean) and
``classify_mst``. Every scene runs twice, with and without white balance, so
the report shows what that stage is worth.

What it does NOT measure
------------------------
Face detection (landmarks are placed, not found), real skin texture, makeup,
mixed light sources, and phone tone-mapping. The scenes are cartoons with
physically plausible colour. Treat the numbers as an upper bound on what the
colour stages can do, and as a map of *where* they fail. Only photographs
settle the absolute accuracy.

Ground truth
------------
Each simulated subject gets their own skin colour, jittered around an MST
reference. The label is the level that colour classifies as *before* any
lighting is applied. So an error here is always caused by the pipeline
(lighting, white balance, sampling), never by a subject sitting between two
levels.

Usage
-----
    python eval/pipeline_sim.py                       # summary to stdout
    python eval/pipeline_sim.py --out report.json     # full report
    python eval/pipeline_sim.py --subjects 10         # quicker run
"""
from __future__ import annotations

import argparse
import json
import math
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from types import SimpleNamespace

import cv2
import numpy as np

EVAL_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(EVAL_DIR.parent))
sys.path.insert(0, str(EVAL_DIR))

from color_science import delta_e_2000, hex_to_lab  # noqa: E402
from color_utils import neutral_pixel_whitebalance  # noqa: E402
from detection.face_detection import (  # noqa: E402
    CHEEK_LANDMARKS,
    FOREHEAD_LANDMARKS,
    _extract_patches,
    _rgb_to_lab,
)
from detection.monk_classifier import _MONK_RGB, classify_mst  # noqa: E402

LEVELS = list(range(1, 11))
SEED = 20261104
SIZE = 360
JPEG_QUALITY = 85


# ── Lighting ──────────────────────────────────────────────────────────────────

def _cct_to_srgb(kelvin: float) -> np.ndarray:
    """Approximate white point of a black body, in sRGB 0-1.

    Tanner Helland's fit to the Planckian locus. Accurate to a few percent
    between 1000 K and 40000 K, which is plenty for simulating a colour cast.
    """
    t = kelvin / 100.0
    r = 255.0 if t <= 66 else 329.698727446 * (t - 60) ** -0.1332047592
    g = (
        99.4708025861 * math.log(t) - 161.1195681661
        if t <= 66
        else 288.1221695283 * (t - 60) ** -0.0755148492
    )
    if t >= 66:
        b = 255.0
    elif t <= 19:
        b = 0.0
    else:
        b = 138.5177312231 * math.log(t - 10) - 305.0447927307
    return np.clip(np.array([r, g, b]) / 255.0, 0, 1)


def _srgb_to_linear(x: np.ndarray) -> np.ndarray:
    return np.where(x <= 0.04045, x / 12.92, ((x + 0.055) / 1.055) ** 2.4)


def _linear_to_srgb(x: np.ndarray) -> np.ndarray:
    x = np.clip(x, 0, 1)
    return np.where(x <= 0.0031308, x * 12.92, 1.055 * x ** (1 / 2.4) - 0.055)


def _cast(kelvin: float, residual: float) -> np.ndarray:
    """Per-channel gain left after the phone's own auto white balance.

    Phones correct most of a colour cast but not all of it. ``residual`` is
    the fraction that survives (0 = perfect camera AWB, 1 = none at all).
    """
    white = _srgb_to_linear(_cct_to_srgb(kelvin)) / _srgb_to_linear(_cct_to_srgb(6500))
    gains = white ** residual
    return gains / gains[1]


@dataclass(frozen=True)
class Lighting:
    key: str
    label: str
    description: str
    gains: tuple[float, float, float]
    exposure: float       # scene brightness before the camera's auto gain
    auto_gain: float      # brightening the camera applies afterwards
    shot_noise: float     # photon noise scale (grows with the auto gain)


def _lightings() -> list[Lighting]:
    warm = _cast(2700, 0.5)
    cool = _cast(9000, 0.5)
    return [
        Lighting("daylight", "Daylight", "Window light, about 6500 K.", (1.0, 1.0, 1.0), 1.0, 1.0, 0.012),
        Lighting("warm", "Warm bulb", "Indoor bulb, 2700 K, half the cast left after the phone corrects.", tuple(warm), 1.0, 1.0, 0.012),
        Lighting("cool", "Cool shade", "Open shade, 9000 K, half the cast left after the phone corrects.", tuple(cool), 1.0, 1.0, 0.012),
        Lighting("low", "Low light", "A dim room. The phone brightens a third of the light 2.6 times, noise included.", (1.0, 1.0, 1.0), 0.38, 2.6, 0.03),
    ]


# ── Scenes ────────────────────────────────────────────────────────────────────

@dataclass
class Subject:
    true_rgb: tuple[int, int, int]
    true_level: int


def _subject(level: int, rng: np.random.Generator) -> Subject:
    """A person whose skin sits near the MST reference, as real people do."""
    L, a, b = _rgb_to_lab(*_MONK_RGB[level - 1])
    lab = np.array([[[
        np.clip(L + rng.normal(0, 3.0), 0, 255),
        np.clip(a + rng.normal(0, 1.5), 0, 255),
        np.clip(b + rng.normal(0, 1.5), 0, 255),
    ]]], dtype=np.uint8)
    r, g, bl = (int(v) for v in cv2.cvtColor(lab, cv2.COLOR_LAB2RGB)[0, 0])
    return Subject((r, g, bl), classify_mst(_rgb_to_lab(r, g, bl)))


# Face geometry on the SIZE x SIZE canvas.
_CX, _CY, _AX, _AY = 180, 175, 95, 125
_CHEEK_Y = 205
_FOREHEAD_Y = 98


def _landmarks(rng: np.random.Generator) -> list:
    """478 landmark stand-ins: real indices on cheeks and forehead.

    The rest trace the face outline so ``_compute_patch_radius`` sees a face
    of realistic size, exactly as it would with MediaPipe output.
    """
    pts = []
    for i in range(478):
        t = 2 * math.pi * i / 478
        pts.append(SimpleNamespace(x=(_CX + _AX * math.cos(t)) / SIZE, y=(_CY + _AY * math.sin(t)) / SIZE, z=0.0))

    def place(idx: int, x: float, y: float) -> None:
        pts[idx] = SimpleNamespace(x=(x + rng.normal(0, 3)) / SIZE, y=(y + rng.normal(0, 3)) / SIZE, z=0.0)

    for k, idx in enumerate(CHEEK_LANDMARKS):
        side = -1 if k < 6 else 1
        j = k % 6
        place(idx, _CX + side * (38 + 7 * (j % 3)), _CHEEK_Y + 12 * (j // 3) - 6)
    for k, idx in enumerate(FOREHEAD_LANDMARKS):
        place(idx, _CX + (k - 2) * 16, _FOREHEAD_Y)
    return pts


_WALLS_COLOURED = [(0.20, 0.42, 0.40), (0.55, 0.38, 0.22), (0.30, 0.30, 0.55)]


def _scene(subject: Subject, rng: np.random.Generator) -> np.ndarray:
    """A portrait in linear RGB, before any lighting."""
    img = np.zeros((SIZE, SIZE, 3), np.float32)

    # A quarter of scenes have a saturated wall, which starves white balance
    # of neutral pixels the way a bright bedroom wall does.
    if rng.random() < 0.25:
        wall = np.array(_WALLS_COLOURED[rng.integers(len(_WALLS_COLOURED))])
    else:
        grey = rng.uniform(0.25, 0.7)
        wall = grey * (1 + rng.normal(0, 0.02, 3))
    img[:] = wall

    yy, xx = np.mgrid[0:SIZE, 0:SIZE].astype(np.float32)

    shirt = rng.choice([0.05, 0.6, 0.85]) * np.ones(3) if rng.random() < 0.6 else rng.uniform(0.1, 0.6, 3)
    img[yy > 300] = shirt

    face = ((xx - _CX) / _AX) ** 2 + ((yy - _CY) / _AY) ** 2 <= 1
    skin = _srgb_to_linear(np.array(subject.true_rgb, np.float32) / 255.0)
    # Soft side light: one cheek a little brighter than the other, averaging
    # out across both, plus fine texture.
    side = rng.choice([-1.0, 1.0]) * rng.uniform(0.02, 0.08)
    shade = 1 + side * (xx - _CX) / _AX
    texture = 1 + rng.normal(0, 0.02, (SIZE, SIZE)).astype(np.float32)
    img[face] = (skin[None, :] * (shade * texture)[face][:, None])

    hair = face & (yy < _CY - _AY + 28)
    img[hair] = np.array([0.03, 0.02, 0.015])

    for ex in (_CX - 35, _CX + 35):
        sclera = ((xx - ex) / 16) ** 2 + ((yy - 152) / 7) ** 2 <= 1
        img[sclera] = 0.78
        img[((xx - ex) / 6) ** 2 + ((yy - 152) / 6) ** 2 <= 1] = 0.02
    return img


_KNEE = 0.8


def _rolloff(x: np.ndarray) -> np.ndarray:
    """Phone-style highlight shoulder: linear to the knee, then compressed.

    Phones never hard-clip a face the way a raw sensor does; their tone curve
    rolls highlights off so a pale cheek under a warm bulb keeps its detail.
    Without this every MST 1-5 face under warm light clipped and was refused,
    which says more about the simulator than about the pipeline.
    """
    head = 1 - _KNEE
    return np.where(x < _KNEE, x, _KNEE + head * np.tanh((x - _KNEE) / head))


def _photograph(linear: np.ndarray, light: Lighting, rng: np.random.Generator) -> np.ndarray:
    """Light the scene, add sensor noise, auto-expose, encode as JPEG."""
    exposure = light.exposure * math.exp(rng.normal(0, 0.08))
    lit = linear * np.array(light.gains, np.float32) * exposure
    noise = rng.normal(0, 1, lit.shape).astype(np.float32)
    lit = lit + noise * (light.shot_noise * np.sqrt(np.clip(lit, 0, None)) + 0.002)
    lit = _rolloff(lit * light.auto_gain)
    srgb = (_linear_to_srgb(lit) * 255).round().astype(np.uint8)
    bgr = cv2.cvtColor(srgb, cv2.COLOR_RGB2BGR)
    ok, buf = cv2.imencode(".jpg", bgr, [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY])
    assert ok
    return cv2.imdecode(buf, cv2.IMREAD_COLOR)


# ── Running ───────────────────────────────────────────────────────────────────

def _measure(img_bgr: np.ndarray, landmarks, white_balance: bool):
    """The production pipeline after face detection. None when it refuses."""
    if white_balance:
        img_bgr = neutral_pixel_whitebalance(img_bgr)
    try:
        sample = _extract_patches(img_bgr, landmarks)
    except ValueError:
        return None
    return classify_mst(sample.lab), sample.rgb


def _hex(rgb) -> str:
    return "#%02x%02x%02x" % tuple(rgb)


def _empty_cell() -> dict:
    return {
        "n": 0, "exact": 0, "within1": 0, "rejected": 0, "error_sum": 0, "de_sum": 0.0,
        "confusion": [[0] * 10 for _ in LEVELS],
        "per_level": {lvl: {"n": 0, "exact": 0, "within1": 0, "rejected": 0, "error_sum": 0} for lvl in LEVELS},
    }


def _record(cell: dict, truth: int, result, true_rgb) -> None:
    cell["n"] += 1
    lvl = cell["per_level"][truth]
    lvl["n"] += 1
    if result is None:
        cell["rejected"] += 1
        lvl["rejected"] += 1
        return
    pred, rgb = result
    err = pred - truth
    cell["confusion"][truth - 1][pred - 1] += 1
    cell["error_sum"] += err
    lvl["error_sum"] += err
    cell["de_sum"] += delta_e_2000(hex_to_lab(_hex(rgb)), hex_to_lab(_hex(true_rgb)))
    if err == 0:
        cell["exact"] += 1
        lvl["exact"] += 1
    if abs(err) <= 1:
        cell["within1"] += 1
        lvl["within1"] += 1


def _rate(num: int, den: int):
    return round(num / den, 4) if den else None


def _summarise(cell: dict) -> dict:
    measured = cell["n"] - cell["rejected"]
    return {
        "n": cell["n"],
        "measured": measured,
        "rejected": cell["rejected"],
        "exact": _rate(cell["exact"], measured),
        "within1": _rate(cell["within1"], measured),
        "exact_of_all": _rate(cell["exact"], cell["n"]),
        "within1_of_all": _rate(cell["within1"], cell["n"]),
        "rejection_rate": _rate(cell["rejected"], cell["n"]),
        "mean_bias": _rate(cell["error_sum"], measured),
        "mean_delta_e": round(cell["de_sum"] / measured, 2) if measured else None,
        "confusion": cell["confusion"],
        "per_level": [
            {
                "level": lvl,
                "n": v["n"],
                "exact": _rate(v["exact"], v["n"] - v["rejected"]),
                "within1": _rate(v["within1"], v["n"] - v["rejected"]),
                "rejection_rate": _rate(v["rejected"], v["n"]),
                "mean_bias": _rate(v["error_sum"], v["n"] - v["rejected"]),
            }
            for lvl, v in cell["per_level"].items()
        ],
    }


def run(subjects: int = 30, seed: int = SEED, samples_dir: Path | None = None) -> dict:
    rng = np.random.default_rng(seed)
    lights = _lightings()
    cells = {wb: {l.key: _empty_cell() for l in lights} for wb in ("on", "off")}
    overall = {"on": _empty_cell(), "off": _empty_cell()}

    for level in LEVELS:
        for _ in range(subjects):
            subject = _subject(level, rng)
            scene = _scene(subject, rng)
            landmarks = _landmarks(rng)
            for light in lights:
                img = _photograph(scene, light, rng)
                for wb in ("on", "off"):
                    result = _measure(img, landmarks, wb == "on")
                    _record(cells[wb][light.key], subject.true_level, result, subject.true_rgb)
                    _record(overall[wb], subject.true_level, result, subject.true_rgb)

    if samples_dir is not None:
        _write_samples(samples_dir, lights, seed)

    return {
        "meta": {
            "kind": "simulation",
            "subjects_per_level": subjects,
            "scenes": subjects * len(LEVELS) * len(lights),
            "seed": seed,
            "jpeg_quality": JPEG_QUALITY,
            "image_size": SIZE,
            "generated": time.strftime("%Y-%m-%d"),
        },
        "lighting": [
            {"key": l.key, "label": l.label, "description": l.description, "gains": [round(g, 3) for g in l.gains]}
            for l in lights
        ],
        "levels": [{"level": lvl, "hex": _hex(_MONK_RGB[lvl - 1])} for lvl in LEVELS],
        "overall": {wb: _summarise(c) for wb, c in overall.items()},
        "by_lighting": {wb: {k: _summarise(c) for k, c in per.items()} for wb, per in cells.items()},
    }


def _write_samples(out: Path, lights: list[Lighting], seed: int) -> None:
    """One MST 5 subject under each light, as the pipeline receives it."""
    out.mkdir(parents=True, exist_ok=True)
    rng = np.random.default_rng(seed + 7)
    subject = _subject(5, rng)
    scene = _scene(subject, rng)
    for light in lights:
        img = _photograph(scene, light, rng)
        cv2.imwrite(str(out / f"{light.key}.jpg"), cv2.resize(img, (180, 180)), [cv2.IMWRITE_JPEG_QUALITY, 80])


def stage_report() -> dict:
    """The classifier-only results from classifier_eval.py, trimmed for display."""
    import classifier_eval as ce

    return {
        "margins": ce.margins(),
        "noise": ce.noise_sweep([1, 2, 3, 5, 8, 12], trials=1500),
        "illuminant": ce.illuminant_sweep([-16, -12, -8, -4, -2, 2, 4, 8, 12, 16]),
    }


def _baseline(before: dict, note: str) -> dict:
    """Refusal and accuracy from an earlier run, for a before/after view."""
    return {
        "note": note,
        "by_lighting": {
            k: {
                "rejection_rate": v["rejection_rate"],
                "exact_of_all": v.get("exact_of_all"),
                "within1_of_all": v.get("within1_of_all"),
                "per_level_rejection": [p["rejection_rate"] for p in v["per_level"]],
            }
            for k, v in before["by_lighting"]["on"].items()
        },
    }


def _print_summary(report: dict) -> None:
    print(f"Simulated scenes: {report['meta']['scenes']} (x2: with and without white balance)\n")
    print(f"{'lighting':<12}{'WB':>4}{'exact':>9}{'within 1':>10}{'refused':>9}{'of all':>9}{'bias':>8}{'dE00':>7}")
    for light in report["lighting"]:
        for wb in ("on", "off"):
            s = report["by_lighting"][wb][light["key"]]
            fmt = lambda v: "  n/a" if v is None else f"{v:.1%}"  # noqa: E731
            print(
                f"{light['label']:<12}{wb:>4}{fmt(s['exact']):>9}{fmt(s['within1']):>10}"
                f"{fmt(s['rejection_rate']):>9}{fmt(s['exact_of_all']):>9}{(s['mean_bias'] or 0):>+8.2f}{(s['mean_delta_e'] or 0):>7.1f}"
            )


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--subjects", type=int, default=30, help="simulated people per MST level")
    ap.add_argument("--seed", type=int, default=SEED)
    ap.add_argument("--out", type=Path, help="write the full JSON report here")
    ap.add_argument("--samples", type=Path, help="write example scene JPEGs here")
    ap.add_argument("--baseline", type=Path, help="an earlier --out report to compare against")
    ap.add_argument("--baseline-note", default="", help="what changed since the baseline")
    args = ap.parse_args()

    report = run(args.subjects, args.seed, args.samples)
    report["stage"] = stage_report()
    if args.baseline:
        report["baseline"] = _baseline(json.loads(args.baseline.read_text()), args.baseline_note)
    _print_summary(report)
    if args.out:
        args.out.write_text(json.dumps(report, indent=1) + "\n")
        print(f"\nwrote {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
