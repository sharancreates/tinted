"""CORS: the deployed frontend must pass regardless of ALLOWED_ORIGINS."""

import importlib

import pytest
from fastapi.testclient import TestClient

PROD = "https://tinted2.vercel.app"


def _preflight(monkeypatch, allowed: str | None, origin: str) -> int:
    if allowed is None:
        monkeypatch.delenv("ALLOWED_ORIGINS", raising=False)
    else:
        monkeypatch.setenv("ALLOWED_ORIGINS", allowed)
    monkeypatch.delenv("ALLOWED_ORIGIN_REGEX", raising=False)
    import main

    app = importlib.reload(main).app
    r = TestClient(app).options(
        "/analyze",
        headers={"Origin": origin, "Access-Control-Request-Method": "POST"},
    )
    return r.status_code


@pytest.mark.parametrize(
    "allowed",
    [None, "", "http://localhost:3002 uvicorn main:app --reload", "https://other.app"],
)
def test_production_origin_always_allowed(monkeypatch, allowed):
    assert _preflight(monkeypatch, allowed, PROD) == 200


def test_unknown_origin_refused(monkeypatch):
    assert _preflight(monkeypatch, PROD, "https://evil.example") == 400


def test_localhost_allowed_only_in_dev_mode(monkeypatch):
    assert _preflight(monkeypatch, None, "http://localhost:3000") == 200
    assert _preflight(monkeypatch, PROD, "http://localhost:3000") == 400
