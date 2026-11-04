"""Turn a product barcode into a brand and product name.

Barcodes carry no words, only a number, so the number is looked up in Open
Beauty Facts (https://world.openbeautyfacts.org), an open, crowd-sourced
database of cosmetics. The name it returns goes into the same catalogue
search as typed text. Coverage is patchy for some brands; a miss returns
None and the app suggests the photo or search instead.
"""

from __future__ import annotations

import re
import threading
import time

import httpx

_URL = "https://world.openbeautyfacts.org/api/v2/product/{code}.json"
# Open Beauty Facts asks API users to identify themselves.
_HEADERS = {"User-Agent": "Tinted/1.0 (https://tinted2.vercel.app)"}
_FIELDS = "product_name,product_name_en,brands"
_TTL = 7 * 24 * 60 * 60
_MAX = 5_000

_cache: dict[str, tuple[dict | None, float]] = {}
_lock = threading.Lock()

BARCODE = re.compile(r"^\d{8,14}$")


def _fetch(code: str) -> dict:
    """The one network call. Stubbed in tests."""
    r = httpx.get(_URL.format(code=code), params={"fields": _FIELDS}, headers=_HEADERS, timeout=5.0)
    if r.status_code == 404:
        return {}
    r.raise_for_status()
    return r.json()


def parse(payload: dict) -> dict | None:
    if not isinstance(payload, dict) or payload.get("status") not in (1, "1", "success_with_warnings", "success"):
        return None
    product = payload.get("product") or {}
    name = str(product.get("product_name_en") or product.get("product_name") or "").strip()
    brand = str(product.get("brands") or "").split(",")[0].strip()
    if not name and not brand:
        return None
    return {"brand": brand[:120], "product_name": name[:200]}


def lookup_barcode(code: str) -> dict | None:
    """{"brand", "product_name"} for a barcode, or None. Never raises."""
    code = code.strip()
    if not BARCODE.match(code):
        return None
    now = time.monotonic()
    with _lock:
        hit = _cache.get(code)
        if hit and hit[1] > now:
            return hit[0]
    try:
        result = parse(_fetch(code))
    except (httpx.HTTPError, ValueError):
        return None  # not cached: a network blip shouldn't stick for a week
    with _lock:
        if len(_cache) >= _MAX:
            _cache.pop(next(iter(_cache)))
        _cache[code] = (result, now + _TTL)
    return result
