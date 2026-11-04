"""Barcode lookup via Open Beauty Facts (network stubbed)."""

import httpx
import pytest
from fastapi.testclient import TestClient

import api.barcode as barcode
from main import app


@pytest.fixture(autouse=True)
def _clear():
    barcode._cache.clear()
    yield
    barcode._cache.clear()


FOUND = {"status": 1, "product": {"product_name": "Pro Filt'r Soft Matte Longwear Foundation", "brands": "Fenty Beauty, Kendo"}}


def test_parse_takes_first_brand_and_english_name():
    payload = {"status": 1, "product": {"product_name": "Fond de teint", "product_name_en": "Foundation", "brands": "Fenty Beauty,Kendo"}}
    assert barcode.parse(payload) == {"brand": "Fenty Beauty", "product_name": "Foundation"}


def test_parse_rejects_unknown_products():
    assert barcode.parse({"status": 0, "status_verbose": "product not found"}) is None
    assert barcode.parse({}) is None
    assert barcode.parse({"status": 1, "product": {}}) is None


def test_lookup_caches_hits(monkeypatch):
    calls = []
    monkeypatch.setattr(barcode, "_fetch", lambda code: calls.append(code) or FOUND)
    assert barcode.lookup_barcode("0816657023234")["brand"] == "Fenty Beauty"
    assert barcode.lookup_barcode("0816657023234")["brand"] == "Fenty Beauty"
    assert calls == ["0816657023234"]


def test_network_errors_are_not_cached(monkeypatch):
    def boom(code):
        raise httpx.ConnectError("down")

    monkeypatch.setattr(barcode, "_fetch", boom)
    assert barcode.lookup_barcode("0816657023234") is None
    assert barcode._cache == {}


def test_route(monkeypatch):
    monkeypatch.setattr(barcode, "_fetch", lambda code: FOUND)
    client = TestClient(app)
    assert client.get("/barcode/0816657023234").json()["product"]["product_name"].startswith("Pro Filt")
    assert client.get("/barcode/abc").status_code == 422
