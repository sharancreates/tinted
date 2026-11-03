"""Dupe finder: parsing, caching and the route (the Claude call is stubbed)."""

import json

import pytest
from fastapi.testclient import TestClient

import api.dupes as dupes
from main import app


@pytest.fixture(autouse=True)
def _clear_cache():
    dupes._cache.clear()
    yield
    dupes._cache.clear()


def _reply(items) -> str:
    return json.dumps(items)


def test_parse_cleans_prices_and_drops_bad_rows():
    raw = _reply([
        {"brand": "e.l.f.", "product": "Halo Glow", "shade": "Fair", "price_usd": 14, "why": "Same soft glow."},
        {"brand": "", "product": "No brand"},
        {"brand": "Milani", "product": "Conceal + Perfect", "price_usd": "cheap"},
        "not an object",
    ])
    out = dupes.parse(raw)
    assert [d["brand"] for d in out] == ["e.l.f.", "Milani"]
    assert out[0]["price_cents"] == 1400
    assert out[1]["price_cents"] is None


def test_parse_handles_fences_and_garbage():
    assert dupes.parse("```json\n[]\n```") == []
    assert dupes.parse("I can't help with that") == []
    assert dupes.parse('{"brand": "x"}') == []


def test_same_brand_is_not_a_dupe():
    raw = _reply([
        {"brand": "NARS", "product": "Radiant Creamy Concealer"},
        {"brand": "L'Oreal", "product": "Infallible Concealer"},
    ])
    assert [d["brand"] for d in dupes.parse(raw, exclude_brand="nars")] == ["L'Oreal"]


def test_caps_at_three():
    raw = _reply([{"brand": f"B{i}", "product": "P"} for i in range(6)])
    assert len(dupes.parse(raw)) == 3


def test_second_lookup_is_cached(monkeypatch):
    calls = []
    monkeypatch.setattr(dupes, "_ask", lambda s, u: calls.append(u) or _reply([{"brand": "A", "product": "B"}]))
    first = dupes.find_dupes("Charlotte Tilbury", "Hollywood Flawless Filter", "4 Medium")
    second = dupes.find_dupes("charlotte  tilbury", "Hollywood Flawless Filter", "4 medium")
    assert first == second and len(calls) == 1


def test_failure_returns_empty(monkeypatch):
    def boom(*_):
        raise RuntimeError("down")

    monkeypatch.setattr(dupes, "_ask", boom)
    assert dupes.find_dupes("Fenty", "Pro Filt'r") == []


def test_route_returns_results(monkeypatch):
    monkeypatch.setattr(dupes, "_ask", lambda s, u: _reply([{"brand": "Maybelline", "product": "Fit Me", "price_usd": 9.99}]))
    response = TestClient(app).post("/dupes", json={"brand": "Fenty Beauty", "product": "Pro Filt'r Foundation", "shade": "240"})
    assert response.status_code == 200
    assert response.json()["results"][0]["price_cents"] == 999


def test_route_rejects_empty_brand():
    assert TestClient(app).post("/dupes", json={"brand": "", "product": "X"}).status_code == 422
