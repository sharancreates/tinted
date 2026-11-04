"""Read a brand and product name off a photo of the packaging.

Used by /find-shade's photo method: the answer is fed into the same catalogue
search as typed text, so this only has to name the product, not match it.

The photo is downscaled before it leaves the server (long edge 1568 px, the
size Claude reads at anyway), which keeps phone photos under the API's image
limit and the cost per call small. It is never stored.
"""

from __future__ import annotations

import base64
import json

import anthropic
import cv2
import numpy as np

from api.limits import record_claude_usage

_client: anthropic.Anthropic | None = None
_MODEL = "claude-opus-5-5"
_MAX_EDGE = 1568

_SCHEMA = {
    "type": "object",
    "properties": {
        "found": {"type": "boolean"},
        "brand": {"type": "string"},
        "product_name": {"type": "string"},
    },
    "required": ["found", "brand", "product_name"],
    "additionalProperties": False,
}

_PROMPT = (
    "This is a photo of a beauty product. Read the brand and the product name "
    "from the packaging, as printed, without the shade. Example: brand "
    '"Fenty Beauty", product_name "Pro Filt\'r Soft Matte Longwear Foundation". '
    "If no product or no legible name is visible, set found to false and leave "
    "both strings empty. Do not guess a product you cannot read."
)


def _prepare(image_bytes: bytes) -> str:
    """Decode, shrink to the long-edge limit, re-encode as JPEG, base64."""
    img = cv2.imdecode(np.frombuffer(image_bytes, np.uint8), cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Could not read that image.")
    h, w = img.shape[:2]
    scale = _MAX_EDGE / max(h, w)
    if scale < 1:
        img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
    ok, buf = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 85])
    if not ok:
        raise ValueError("Could not read that image.")
    return base64.standard_b64encode(buf.tobytes()).decode("ascii")


def _ask(image_b64: str) -> str:
    """The one network call. Stubbed in tests."""
    global _client
    if _client is None:
        # Created on first use, so importing this module never needs credentials.
        _client = anthropic.Anthropic()
    response = _client.beta.messages.create(
        model=_MODEL,
        max_tokens=1024,
        # Reading a label is easy; keep the thinking short.
        output_config={
            "effort": "low",
            "format": {"type": "json_schema", "schema": _SCHEMA},
        },
        # A declined request is retried on a model chosen for the refusal
        # category, inside the same call.
        betas=["server-side-fallback-2026-07-01"],
        fallbacks="default",
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": image_b64}},
                    {"type": "text", "text": _PROMPT},
                ],
            }
        ],
    )
    record_claude_usage(response)
    if response.stop_reason == "refusal":
        return ""
    return next((b.text for b in response.content if b.type == "text"), "")


def parse(raw: str) -> dict | None:
    """{"brand", "product_name"} or None when nothing usable came back."""
    try:
        data = json.loads(raw)
    except (TypeError, ValueError):
        return None
    if not isinstance(data, dict) or not data.get("found"):
        return None
    brand = str(data.get("brand") or "").strip()[:120]
    product = str(data.get("product_name") or "").strip()[:200]
    if not brand and not product:
        return None
    return {"brand": brand, "product_name": product}


def identify_product(image_bytes: bytes) -> dict | None:
    """Name the product in a photo. Raises ValueError for an unreadable image;
    returns None when no product could be read or the API call failed."""
    image_b64 = _prepare(image_bytes)
    try:
        raw = _ask(image_b64)
    except anthropic.APIError:
        return None
    return parse(raw)
