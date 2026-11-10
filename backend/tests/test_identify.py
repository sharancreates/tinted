"""Product photo identification: parsing, image prep and the route (Claude stubbed)."""

import base64
import json

import cv2
import numpy as np
from fastapi.testclient import TestClient

import api.identify as identify
from main import app


def _jpeg(w: int = 640, h: int = 480) -> bytes:
    img = np.full((h, w, 3), 200, np.uint8)
    cv2.putText(img, "FENTY", (40, h // 2), cv2.FONT_HERSHEY_SIMPLEX, 2, (20, 20, 20), 4)
    ok, buf = cv2.imencode(".jpg", img)
    assert ok
    return buf.tobytes()


def test_parse_accepts_a_found_product():
    raw = json.dumps({"found": True, "brand": " Fenty Beauty ", "product_name": "Pro Filt'r Soft Matte"})
    assert identify.parse(raw) == {"brand": "Fenty Beauty", "product_name": "Pro Filt'r Soft Matte"}


def test_parse_rejects_not_found_and_garbage():
    assert identify.parse(json.dumps({"found": False, "brand": "", "product_name": ""})) is None
    assert identify.parse(json.dumps({"found": True, "brand": "", "product_name": ""})) is None
    assert identify.parse("not json") is None
    assert identify.parse("") is None


def test_prepare_downscales_large_photos():
    b64 = identify._prepare(_jpeg(4000, 3000))
    img = cv2.imdecode(np.frombuffer(base64.b64decode(b64), np.uint8), cv2.IMREAD_COLOR)
    assert max(img.shape[:2]) == identify._MAX_EDGE


def test_route_returns_the_product(monkeypatch):
    monkeypatch.setattr(identify, "_ask", lambda b64: json.dumps({"found": True, "brand": "Fenty Beauty", "product_name": "Pro Filt'r"}))
    r = TestClient(app).post("/identify-product", files={"file": ("p.jpg", _jpeg(), "image/jpeg")})
    assert r.status_code == 200
    assert r.json() == {"product": {"brand": "Fenty Beauty", "product_name": "Pro Filt'r"}}


def test_route_returns_null_when_nothing_is_legible(monkeypatch):
    monkeypatch.setattr(identify, "_ask", lambda b64: "")  # e.g. a refusal
    r = TestClient(app).post("/identify-product", files={"file": ("p.jpg", _jpeg(), "image/jpeg")})
    assert r.status_code == 200 and r.json() == {"product": None}


def test_route_rejects_non_images():
    r = TestClient(app).post("/identify-product", files={"file": ("p.jpg", b"not an image at all", "image/jpeg")})
    assert r.status_code == 400
