"""Shelf-based skincare routine suggestions."""

import asyncio

from fastapi import APIRouter, Request
from pydantic import BaseModel

from api.limits import SEARCH_RULES, client_key, limiter, spend_guard
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
