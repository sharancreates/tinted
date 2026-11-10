"""Cheaper alternatives ("dupes") for a product already on someone's shelf.

One Claude call per product, cached hard: a product's dupes change about as
often as its shade range does, and everyone owns the same few hundred things.

The answer is advice, not a catalogue lookup, so the prompt asks for fewer
results over invented ones and every result says why it is a match. Prices are
typical retail and labelled as estimates in the UI.
"""

from __future__ import annotations

import json
import os
import threading
import time

import anthropic

from api.limits import record_claude_usage

_client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))
_MODEL = "claude-haiku-4-5-20251001"

_MAX_RESULTS = 3
_TTL_SECONDS = 7 * 24 * 60 * 60
_MAX_ENTRIES = 2_000

_cache: dict[str, tuple[list[dict], float]] = {}
_lock = threading.Lock()


def _key(brand: str, product: str, shade: str | None) -> str:
    return "|".join(" ".join(part.lower().split()) for part in (brand, product, shade or ""))


def _cache_get(key: str) -> list[dict] | None:
    with _lock:
        entry = _cache.get(key)
        if entry is None:
            return None
        value, expires = entry
        if time.monotonic() >= expires:
            del _cache[key]
            return None
        return value


def _cache_put(key: str, value: list[dict]) -> None:
    with _lock:
        if len(_cache) >= _MAX_ENTRIES:
            del _cache[min(_cache, key=lambda k: _cache[k][1])]
        _cache[key] = (value, time.monotonic() + _TTL_SECONDS)


def _ask(system: str, user: str) -> str:
    """The one network call. Stubbed in tests."""
    response = _client.messages.create(
        model=_MODEL,
        max_tokens=900,
        system=system,
        messages=[{"role": "user", "content": user}],
    )
    record_claude_usage(response)
    return response.content[0].text.strip()


def find_dupes(
    brand: str,
    product: str,
    shade: str | None = None,
    category: str | None = None,
    price_cents: int | None = None,
) -> list[dict]:
    """Return up to three cheaper alternatives. Never raises; [] on any failure."""
    brand, product = brand.strip(), product.strip()
    if not brand or not product:
        return []

    key = _key(brand, product, shade)
    cached = _cache_get(key)
    if cached is not None:
        return cached

    named = f"{brand} {product}" + (f" in {shade}" if shade else "")
    price_line = f"It costs about ${price_cents / 100:.2f}. " if price_cents else ""
    system = (
        "You know real, currently sold makeup and skincare products and which "
        "ones are close, cheaper alternatives to each other. Return ONLY a JSON "
        "array, no preamble, no markdown fences."
    )
    user = (
        f"Someone owns {named}"
        + (f" ({category})" if category else "")
        + f". {price_line}"
        f"Suggest up to {_MAX_RESULTS} real products from other brands that are "
        "cheaper and give a similar result: same finish, similar formula, and "
        "for coloured products the closest matching shade.\n\n"
        "Never invent a product or a shade. If you know fewer close matches, "
        "return fewer, or an empty array.\n\n"
        "Each element:\n"
        '{ "brand": "<company>", "product": "<product line without the brand>", '
        '"shade": "<closest shade name, or empty>", '
        '"price_usd": <typical retail price as a number, or null>, '
        '"why": "<one short sentence on what makes it a match, no dashes>" }'
    )

    try:
        raw = _ask(system, user)
    except Exception as exc:  # network, auth, rate limit: degrade to no dupes
        print(f"[dupes] request failed for {named!r}: {exc}")
        return []

    results = parse(raw, exclude_brand=brand)
    _cache_put(key, results)
    return results


def parse(raw: str, exclude_brand: str = "") -> list[dict]:
    """Turn the model's text into clean results, dropping anything unusable."""
    text = raw.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[-1]
    if text.endswith("```"):
        text = text.rsplit("```", 1)[0]
    try:
        parsed = json.loads(text.strip())
    except json.JSONDecodeError:
        return []
    if not isinstance(parsed, list):
        return []

    own = " ".join(exclude_brand.lower().split())
    out: list[dict] = []
    for item in parsed:
        clean = _clean(item)
        # A "dupe" from the same brand is just the product again.
        if clean and clean["brand"].lower() != own:
            out.append(clean)
        if len(out) == _MAX_RESULTS:
            break
    return out


def _clean(item: object) -> dict | None:
    if not isinstance(item, dict):
        return None
    brand = str(item.get("brand") or "").strip()
    product = str(item.get("product") or "").strip()
    if not brand or not product:
        return None

    price = item.get("price_usd")
    try:
        price_cents = round(float(price) * 100) if price is not None else None
    except (TypeError, ValueError):
        price_cents = None
    if price_cents is not None and not (0 < price_cents <= 100_000_00):
        price_cents = None

    return {
        "brand": brand,
        "product": product,
        "shade": str(item.get("shade") or "").strip() or None,
        "price_cents": price_cents,
        "why": str(item.get("why") or "").strip().replace(" — ", ", ") or None,
    }
