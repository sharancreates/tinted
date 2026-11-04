"""Shelf-based skincare routine suggestions."""

import asyncio

from fastapi import APIRouter, File, HTTPException, Request, UploadFile
from pydantic import BaseModel, Field

from api.limits import SEARCH_RULES, client_key, limiter, spend_guard
from api.dupes import find_dupes
from api.identify import identify_product
from api.barcode import BARCODE, lookup_barcode
from api.uploads import read_image_upload
from api.skincare_recommendations import suggest_shelf_routines

router = APIRouter()


class RoutineSuggestRequest(BaseModel):
    products: list[dict]


@router.post("/routines/suggest")
async def routines_suggest(request: Request, req: RoutineSuggestRequest) -> dict:
    """Suggest AM and PM ordering for products supplied from the user's shelf."""
    limiter.check(client_key(request), "search", SEARCH_RULES)
    spend_guard.check()
    return await asyncio.to_thread(suggest_shelf_routines, req.products)


class DupesRequest(BaseModel):
    brand: str = Field(min_length=1, max_length=120)
    product: str = Field(min_length=1, max_length=200)
    shade: str | None = Field(default=None, max_length=120)
    category: str | None = Field(default=None, max_length=60)
    price_cents: int | None = Field(default=None, ge=0, le=10_000_000)


@router.post("/dupes")
async def dupes(request: Request, req: DupesRequest) -> dict:
    """Up to three cheaper alternatives for one shelf product."""
    limiter.check(client_key(request), "search", SEARCH_RULES)
    spend_guard.check()
    results = await asyncio.to_thread(
        find_dupes, req.brand, req.product, req.shade, req.category, req.price_cents
    )
    return {"results": results}


@router.post("/identify-product")
async def identify(request: Request, file: UploadFile = File(...)) -> dict:
    """Brand and product name read from a photo of the packaging.

    Returns {"product": {"brand", "product_name"}} or {"product": null} when
    nothing legible was found. The photo is not stored.
    """
    limiter.check(client_key(request), "search", SEARCH_RULES)
    spend_guard.check()
    image_bytes = await read_image_upload(file)
    try:
        product = await asyncio.to_thread(identify_product, image_bytes)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    return {"product": product}


@router.get("/barcode/{code}")
async def barcode(request: Request, code: str) -> dict:
    """Brand and product name for a scanned barcode, via Open Beauty Facts.

    Returns {"product": {...}} or {"product": null} when the code is unknown.
    """
    if not BARCODE.match(code):
        raise HTTPException(status_code=422, detail="That doesn't look like a product barcode.")
    limiter.check(client_key(request), "search", SEARCH_RULES)
    return {"product": await asyncio.to_thread(lookup_barcode, code)}
