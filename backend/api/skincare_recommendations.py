"""Fill a quiz-derived routine skeleton with real products, via Claude.

The split matters: skincare_quiz.score() decides *what kind* of product each
step needs (deterministic, unit-tested, no network). This module only decides
*which* product — the part that needs current product knowledge.
"""

from __future__ import annotations

import json
import os

import anthropic

from api.limits import record_claude_usage
from skincare_quiz import QuizResult

client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

_BUDGET_RULES: dict[str, str] = {
    "drugstore": (
        "Budget: DRUGSTORE only, every product under $20. Choose from CeraVe, "
        "La Roche-Posay, Neutrogena, The Ordinary, Cetaphil, Vanicream, "
        "Eucerin, Good Molecules, Naturium. Set price_range to \"$\"."
    ),
    "mid": (
        "Budget: MID-RANGE only, $20–$60. Choose from Paula's Choice, "
        "Glossier, Kiehl's, First Aid Beauty, Krave Beauty, Beauty of Joseon, "
        "COSRX, Farmacy, Youth to the People. Set price_range to \"$$\"."
    ),
    "high": (
        "Budget: HIGH-END only, over $60. Choose from SkinCeuticals, Drunk "
        "Elephant, Augustinus Bader, Tatcha, Sunday Riley, Dr. Barbara Sturm, "
        "Biologique Recherche. Set price_range to \"$$$\"."
    ),
    "all": (
        "Budget: no constraint, but favour value — at least half the routine "
        "should be under $30, since a routine nobody can afford to repurchase "
        "is not a routine."
    ),
}


def get_routine_products(
    result: QuizResult,
    budget: str = "all",
) -> list[dict]:
    """Return one product per step in *result.routine_steps*, in order.

    Never raises. On failure returns an empty list and the caller renders the
    routine skeleton without products.
    """
    profile = ", ".join(
        f"{tag} ({result.tag_scores[tag]})" for tag in result.top_tags
    ) or "no strong signal"

    constraints = []
    if result.sensitive:
        constraints.append(
            "This user is REACTIVE. Avoid retinoids, high-strength acids, "
            "essential oils and fragrance. Prefer fragrance-free formulas and "
            "say so in the `why`."
        )
    if result.beginner:
        constraints.append(
            "This user is new to skincare. Prefer simple, forgiving formulas "
            "and keep every `why` free of jargon."
        )

    system = (
        "You are a licensed esthetician assembling a skincare routine. "
        "You recommend real, currently-sold products and never invent one. "
        "Return ONLY a JSON array, no preamble, no markdown fences."
    )

    user_content = (
        f"Skin profile, strongest needs first: {profile}.\n"
        f"{_BUDGET_RULES.get(budget, _BUDGET_RULES['all'])}\n"
        + ("\n".join(constraints) + "\n" if constraints else "")
        + f"\nRecommend exactly one product for each of these steps, in this "
        f"order: {', '.join(result.routine_steps)}.\n"
        "Use a different brand for every step.\n\n"
        "Return a JSON array of objects with exactly these keys:\n"
        '{ "step": "<the step name, copied exactly from the list above>", '
        '"brand": "<string>", "product": "<string>", '
        '"price_range": "<$ | $$ | $$$>", '
        '"key_ingredient": "<the one active that earns its place>", '
        '"why": "<one sentence, addressed to the user as \\"you\\", naming '
        'the need it addresses>", '
        '"when": "<AM | PM | AM & PM | 2-3x per week>", '
        '"url": "<full purchase URL including https://>" }'
    )

    raw = _invoke([{"role": "user", "content": user_content}], system)
    return _parse_routine(raw, result.routine_steps)


def suggest_shelf_routines(products: list[dict]) -> dict:
    """Order known shelf products into simple AM and PM routines.

    Product identifiers are treated as untrusted model output and are retained
    only when they match an identifier supplied in the request.
    """
    clean_products = []
    for product in products[:40]:
        if not isinstance(product, dict):
            continue
        product_id = str(product.get("id", "")).strip()[:80]
        brand = str(product.get("brand", "")).strip()[:80]
        name = str(product.get("product", "")).strip()[:120]
        category = str(product.get("category", "other")).strip()[:50]
        if product_id and brand and name:
            clean_products.append({"id": product_id, "brand": brand, "product": name, "category": category})
    if not clean_products:
        return {"morning": [], "evening": [], "reasoning": "Add products to your shelf first."}

    products_json = json.dumps(clean_products, ensure_ascii=False)
    system = (
        "You organize skincare products into gentle, conventional application order. "
        "Never make medical claims. Return only valid JSON, with no markdown."
    )
    prompt = (
        "Create concise AM and PM routines using only products from this list. "
        "Follow basic layering order: cleanser, toner, treatments or serums, "
        "moisturizer, then sunscreen in the morning. Avoid placing sunscreen at "
        "night. Include a product only when its category reasonably fits. "
        "The product_id must be copied exactly from the input. Do not invent products.\n\n"
        f"Products: {products_json}\n\n"
        'Return this shape: {"morning":[{"product_id":"...","step_name":"...","reason":"..."}], '
        '"evening":[{"product_id":"...","step_name":"...","reason":"..."}], '
        '"reasoning":"one short sentence"}. Use empty arrays when no suitable product exists.'
    )
    try:
        raw = _invoke([{"role": "user", "content": prompt}], system)
        parsed = json.loads(raw)
    except Exception as exc:
        print(f"[routine-suggest] suggestion failed: {exc}")
        return {"morning": [], "evening": [], "reasoning": "Suggestions are temporarily unavailable."}

    allowed = {product["id"] for product in clean_products}

    def clean_steps(key: str) -> list[dict]:
        raw_steps = parsed.get(key, []) if isinstance(parsed, dict) else []
        if not isinstance(raw_steps, list):
            return []
        output = []
        for step in raw_steps[:20]:
            if not isinstance(step, dict):
                continue
            product_id = str(step.get("product_id", ""))
            if product_id not in allowed:
                continue
            output.append({
                "product_id": product_id,
                "step_name": str(step.get("step_name", "Skincare"))[:80],
                "reason": str(step.get("reason", ""))[:240],
            })
        return output

    return {
        "morning": clean_steps("morning"),
        "evening": clean_steps("evening"),
        "reasoning": str(parsed.get("reasoning", ""))[:400] if isinstance(parsed, dict) else "",
    }


_FIELDS = ("step", "brand", "product", "price_range",
           "key_ingredient", "why", "when", "url")


def _parse_routine(raw: str, expected_steps: tuple[str, ...]) -> list[dict]:
    """Parse the model's array and align it to the requested steps.

    Output is ordered by *expected_steps*, not by whatever order the model
    returned, and any step the model skipped is simply absent — the frontend
    renders the skeleton regardless.
    """
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        print(f"[skincare] response was not valid JSON: {raw[:300]}")
        return []

    if not isinstance(parsed, list):
        print(f"[skincare] expected a JSON array, got {type(parsed).__name__}")
        return []

    by_step: dict[str, dict] = {}
    for entry in parsed:
        if not isinstance(entry, dict):
            continue
        clean = {f: str(entry.get(f, "") or "").strip() for f in _FIELDS}
        step = clean["step"].lower()
        if step in expected_steps and clean["brand"] and clean["product"]:
            by_step.setdefault(step, clean)

    missing = [s for s in expected_steps if s not in by_step]
    if missing:
        print(f"[skincare] no product returned for steps: {missing}")

    return [by_step[step] for step in expected_steps if step in by_step]


def _invoke(messages: list[dict], system: str) -> str:
    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=2500,
        system=system,
        messages=messages,
    )
    record_claude_usage(response)
    text = response.content[0].text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[-1]
    if text.endswith("```"):
        text = text.rsplit("```", 1)[0]
    return text.strip()
