from fastapi.testclient import TestClient
from fastapi import FastAPI

from api import routine_routes, skincare_recommendations


def test_suggest_shelf_routines_orders_only_known_product_ids(monkeypatch):
    monkeypatch.setattr(
        skincare_recommendations,
        "_invoke",
        lambda *_args, **_kwargs: (
            '{"morning":[{"product_id":"p1","step_name":"Cleanser",'
            '"reason":"Cleans first."},{"product_id":"invented",'
            '"step_name":"Serum","reason":"Unknown."}],'
            '"evening":[],"reasoning":"Use thin to thick."}'
        ),
    )

    result = skincare_recommendations.suggest_shelf_routines([
        {"id": "p1", "brand": "CeraVe", "product": "Cleanser", "category": "cleanser"}
    ])

    assert result["morning"] == [
        {"product_id": "p1", "step_name": "Cleanser", "reason": "Cleans first."}
    ]
    assert result["evening"] == []


def test_routine_suggest_endpoint_uses_existing_limit_guards(monkeypatch):
    app = FastAPI()
    app.include_router(routine_routes.router)
    guard_calls = []
    monkeypatch.setattr(routine_routes.limiter, "check", lambda *args: guard_calls.append("rate"))
    monkeypatch.setattr(routine_routes.spend_guard, "check", lambda: guard_calls.append("spend"))
    monkeypatch.setattr(
        routine_routes,
        "suggest_shelf_routines",
        lambda products: {"morning": [], "evening": [], "reasoning": str(len(products))},
    )

    response = TestClient(app).post(
        "/routines/suggest",
        json={"products": [{"id": "p1", "brand": "CeraVe", "product": "Cleanser", "category": "cleanser"}]},
    )

    assert response.status_code == 200
    assert response.json() == {"morning": [], "evening": [], "reasoning": "1"}
    assert guard_calls == ["rate", "spend"]
