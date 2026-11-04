"""Simulated lighting eval, and the exposure gate it led to changing."""

import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "eval"))

import pipeline_sim as sim  # noqa: E402
from detection.face_detection import _clipped  # noqa: E402


def test_pale_skin_patch_is_not_called_overexposed():
    # MST 1 reference renders at V 246. The old "mean V above 240" rule
    # refused it; it is skin, not a blown highlight.
    rng = np.random.default_rng(0)
    patch = np.clip(246 + rng.normal(0, 2, (7, 7)), 0, 255).astype(np.uint8)
    assert not _clipped(patch)


def test_clipped_patch_is_still_refused():
    patch = np.full((7, 7), 230, np.uint8)
    patch[:4, :] = 255  # more than a quarter at the ceiling
    assert _clipped(patch)


def test_report_shape_and_daylight_sanity():
    report = sim.run(subjects=2, seed=1)
    assert [l["key"] for l in report["lighting"]] == ["daylight", "warm", "cool", "low"]
    assert report["meta"]["scenes"] == 2 * 10 * 4

    day = report["by_lighting"]["on"]["daylight"]
    assert day["n"] == 20
    assert len(day["confusion"]) == 10 and all(len(r) == 10 for r in day["confusion"])
    assert sum(map(sum, day["confusion"])) == day["measured"]
    # Even a tiny run should land within one level in plain daylight.
    assert day["within1"] >= 0.8


def test_run_is_deterministic():
    a = sim.run(subjects=1, seed=5)["overall"]["on"]["confusion"]
    b = sim.run(subjects=1, seed=5)["overall"]["on"]["confusion"]
    assert a == b


def test_warm_cast_is_warm():
    warm = next(l for l in sim._lightings() if l.key == "warm")
    r, g, b = warm.gains
    assert r > g > b
