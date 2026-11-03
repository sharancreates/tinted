import asyncio
import json
import os
import queue as thread_queue
import threading

from ddgs import DDGS
from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from api.claude_recommendations import get_full_beauty_recommendations
from api.limits import (
    ANALYZE_RULES,
    SEARCH_RULES,
    client_key,
    limiter,
    spend_guard,
)
from api.product_images import resolve_many
from api.product_lookup import search as search_products, shades as lookup_shades
from api.skincare_recommendations import get_routine_products
from api.uploads import read_image_upload
from color_utils import preprocess_image
from detection.face_detection import (
    detect_face,
    extract_patches_streaming,
    extract_skin_sample_from_image,
    run_landmark_detection,
)
from detection.monk_classifier import classify_monk, classify_mst_with_distances
from detection.shade_matcher import match_shades
from foundation_matcher import match_foundation
from quality_gate import describe as describe_gate, run_quality_gate
from skincare_quiz import QUESTIONS, score as score_quiz

router = APIRouter()


# ── Health ────────────────────────────────────────────────────────────────────

@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "project": "GlowMatch"}


# ── Analyze ───────────────────────────────────────────────────────────────────

@router.post("/analyze")
async def analyze(
    request: Request,
    file: UploadFile = File(...),
    budget: str = Form(default="all"),
    # The frontend sends "false" and fetches /recommendations separately, so the
    # measurement shows in about a second instead of after the ~20s Claude call.
    # Defaults to true so older clients keep working.
    recommendations: bool = Form(default=True),
) -> dict:
    limiter.check(client_key(request), "analyze", ANALYZE_RULES)
    spend_guard.check()

    image_bytes = await read_image_upload(file)

    # ── Preprocess + landmark detection ──────────────────────────────────────
    try:
        img_bgr, landmarks = await asyncio.to_thread(detect_face, image_bytes)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    if landmarks is None:
        raise HTTPException(
            status_code=422,
            detail=["No face detected — try a well-lit, front-facing photo with your full face visible."],
        )

    # ── Pre-analysis quality gate ─────────────────────────────────────────────
    gate = run_quality_gate(img_bgr, landmarks)
    if not gate["passed"]:
        # Also surfaced as a response header so the measured values are visible
        # in the browser's network tab, not just the server terminal. The body
        # shape is unchanged — the frontend still gets a plain list of strings.
        print(f"[quality-gate] REJECTED  {describe_gate(gate)}")
        raise HTTPException(
            status_code=422,
            detail=gate["failure_reasons"],
            headers={"X-Quality-Gate": describe_gate(gate)},
        )
    print(f"[quality-gate] passed    {describe_gate(gate)}")

    # ── Skin pixel extraction ─────────────────────────────────────────────────
    try:
        sample = await asyncio.to_thread(extract_skin_sample_from_image, img_bgr, landmarks)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    result = classify_monk(sample, image_bytes)
    mst_level = int(result["monk_scale"].split("-")[1])
    matched_shades = await asyncio.to_thread(
        match_shades, mst_level, result["undertone"], result["avg_hex"]
    )

    beauty_recs: dict = {}
    if recommendations:
        try:
            beauty_recs = await asyncio.to_thread(
                get_full_beauty_recommendations,
                monk_scale=result["monk_scale"],
                undertone=result["undertone"],
                avg_hex=result["avg_hex"],
                budget=budget,
            )
        except Exception as e:
            print(f"Claude recommendations failed: {e}")
            beauty_recs = {}

    return {
        "pixel_count":     sample.patch_count,
        "monk_scale":      result["monk_scale"],
        "undertone":       result["undertone"],
        "avg_hex":         result["avg_hex"],
        "matched_shades":  matched_shades,
        "recommendations": beauty_recs,
    }


# ── Analyze (streaming SSE) ───────────────────────────────────────────────────

def _sse(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"


def _run_streaming_pipeline(
    image_bytes: bytes, budget: str, q: thread_queue.Queue, with_recs: bool = True
) -> None:
    """Synchronous pipeline that emits SSE-formatted dicts into *q*.

    Runs in a daemon thread so it can block freely.  The async generator in
    analyze_stream drains *q* and yields each event to the client.
    """
    def emit(event: dict) -> None:
        q.put(event)

    try:
        # ── Stage 1: preprocessing ────────────────────────────────────────────
        emit({"stage": "preprocessing", "message": "Applying white balance correction..."})
        img_bgr = preprocess_image(image_bytes)
        h, w = img_bgr.shape[:2]

        # ── Stage 2: face detection ───────────────────────────────────────────
        landmarks = run_landmark_detection(img_bgr)
        if landmarks is None:
            emit({"stage": "error", "errors": [
                "No face detected — try a well-lit, front-facing photo with your full face visible."
            ]})
            return

        # Bounding box from all 468 landmark points.
        all_xs = [int(lm.x * w) for lm in landmarks]
        all_ys = [int(lm.y * h) for lm in landmarks]
        bbox = [min(all_xs), min(all_ys), max(all_xs) - min(all_xs), max(all_ys) - min(all_ys)]

        # Only the 17 sampled landmark indices, in image pixel space.
        from detection.face_detection import _ALL_LANDMARKS as _SAMPLE_IDX
        sampled_pts = [[int(landmarks[i].x * w), int(landmarks[i].y * h)] for i in _SAMPLE_IDX]

        emit({
            "stage":        "face_detected",
            "landmarks":    sampled_pts,
            "bbox":         bbox,
            "image_width":  w,
            "image_height": h,
        })

        # ── Stage 3: quality gate ─────────────────────────────────────────────
        gate = run_quality_gate(img_bgr, landmarks)
        if not gate["passed"]:
            print(f"[quality-gate] REJECTED  {describe_gate(gate)}")
            emit({"stage": "error", "errors": gate["failure_reasons"]})
            return

        # ── Stage 4: per-patch sampling ───────────────────────────────────────
        def on_patch(patch: dict) -> None:
            emit({"stage": "sampling", "patch": patch})

        try:
            skin_sample = extract_patches_streaming(img_bgr, landmarks, on_patch)
        except ValueError as exc:
            emit({"stage": "error", "errors": [str(exc)]})
            return

        # ── Stage 5: aggregating ──────────────────────────────────────────────
        emit({
            "stage":            "aggregating",
            "trimmed_mean_rgb": list(skin_sample.rgb),
            "patch_count":      skin_sample.patch_count,
            "rejected_count":   skin_sample.rejected_count,
        })

        # ── Stage 6: classifying ──────────────────────────────────────────────
        classification = classify_monk(skin_sample, image_bytes)
        mst_level = int(classification["monk_scale"].split("-")[1])
        distances = classify_mst_with_distances(skin_sample.lab)

        emit({
            "stage":     "classifying",
            "mst_level": mst_level,
            "distances": distances,
        })

        # ── Stage 7: shade matching ───────────────────────────────────────────
        matched_shades = match_shades(mst_level, classification["undertone"], classification["avg_hex"])
        emit({"stage": "matching", "shades": matched_shades})

        # ── Stage 8: beauty recs → complete ──────────────────────────────────
        beauty_recs: dict = {}
        if with_recs:
            try:
                beauty_recs = get_full_beauty_recommendations(
                    monk_scale=classification["monk_scale"],
                    undertone=classification["undertone"],
                    avg_hex=classification["avg_hex"],
                    budget=budget,
                )
            except Exception as exc:
                print(f"[analyze-stream] beauty recs failed: {exc}")
                beauty_recs = {}

        emit({
            "stage": "complete",
            "result": {
                "pixel_count":     skin_sample.patch_count,
                "monk_scale":      classification["monk_scale"],
                "undertone":       classification["undertone"],
                "avg_hex":         classification["avg_hex"],
                "matched_shades":  matched_shades,
                "recommendations": beauty_recs,
            },
        })

    except Exception as exc:
        emit({"stage": "error", "errors": [f"Unexpected error: {exc}"]})


@router.post("/analyze-stream")
async def analyze_stream(
    request: Request,
    file: UploadFile = File(...),
    budget: str = Form(default="all"),
    recommendations: bool = Form(default=True),
) -> StreamingResponse:
    """Run the analysis pipeline and stream each stage as a server-sent event."""
    # Same cost profile as /analyze, so it shares the bucket — a client can't
    # double its budget by alternating between the two.
    limiter.check(client_key(request), "analyze", ANALYZE_RULES)
    spend_guard.check()

    image_bytes = await read_image_upload(file)
    q: thread_queue.Queue = thread_queue.Queue()

    def _run() -> None:
        _run_streaming_pipeline(image_bytes, budget, q, recommendations)
        q.put(None)  # sentinel

    threading.Thread(target=_run, daemon=True).start()

    async def gen():
        loop = asyncio.get_event_loop()
        while True:
            event = await loop.run_in_executor(None, q.get)
            if event is None:
                break
            yield _sse(event)

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ── Recommendations ───────────────────────────────────────────────────────────

class RecommendationsRequest(BaseModel):
    monk_scale: str
    undertone:  str
    budget:     str = "all"


@router.post("/recommendations")
async def recommendations_endpoint(request: Request, req: RecommendationsRequest) -> dict:
    """Product picks for a measured tone, fetched after /analyze returns.

    Cached per (Monk level, undertone, budget), so after the first request for
    a combination this answers instantly and costs nothing.
    """
    limiter.check(client_key(request), "recommendations", ANALYZE_RULES)
    spend_guard.check()
    recs = await asyncio.to_thread(
        get_full_beauty_recommendations,
        monk_scale=req.monk_scale[:16],
        undertone=req.undertone[:16],
        budget=req.budget[:16],
    )
    return {"recommendations": recs}


# ── Foundation match ──────────────────────────────────────────────────────────

class FoundationMatchRequest(BaseModel):
    shade_input: str
    mst_level:   int
    undertone:   str


@router.post("/match-foundation")
async def match_foundation_endpoint(request: Request, req: FoundationMatchRequest) -> dict:
    # CLIP inference is CPU-heavy and match_foundation also calls Claude, so this
    # needs both the throttle and the budget check.
    limiter.check(client_key(request), "match", SEARCH_RULES)
    spend_guard.check()

    if not req.shade_input.strip():
        return {"matches": []}
    try:
        matches = await asyncio.to_thread(
            match_foundation,
            req.shade_input.strip(),
            req.mst_level,
            req.undertone,
        )
        return {"matches": matches}
    except Exception as e:
        print(f"Foundation match error: {e}")
        return {"matches": []}


# ── Product search ────────────────────────────────────────────────────────────

class SearchRequest(BaseModel):
    query: str


def _ddgs_image_search(query: str) -> list[dict]:
    with DDGS() as ddgs:
        return list(ddgs.images(
            query,
            max_results=4,
            safesearch="moderate",
        ))



# ── Skincare quiz ─────────────────────────────────────────────────────────────

@router.get("/skincare-quiz/questions")
async def skincare_questions() -> dict:
    """Serve the question set so the frontend doesn't duplicate it.

    Weights are deliberately omitted — they are scoring internals, and shipping
    them would let a client reverse-engineer the "right" answers.
    """
    return {
        "questions": [
            {
                "id":        q.id,
                "prompt":    q.prompt,
                "multi":     q.multi,
                "help_text": q.help_text,
                "options": [
                    {"value": o.value, "label": o.label, "hint": o.hint}
                    for o in q.options
                ],
            }
            for q in QUESTIONS
        ]
    }


class SkincareQuizRequest(BaseModel):
    # Values are str for single-select and list[str] for multi-select.
    answers: dict[str, str | list[str]]
    budget:  str = "all"


@router.post("/skincare-quiz")
async def skincare_quiz(request: Request, req: SkincareQuizRequest) -> dict:
    """Score quiz answers into a routine, then fill it with real products."""
    limiter.check(client_key(request), "analyze", ANALYZE_RULES)
    spend_guard.check()

    result = score_quiz(dict(req.answers))

    try:
        products = await asyncio.to_thread(
            get_routine_products, result, req.budget
        )
    except Exception as exc:
        print(f"[skincare-quiz] product selection failed: {exc}")
        products = []

    return {
        "profile": {
            "top_tags":   list(result.top_tags),
            "tag_scores": result.tag_scores,
            "sensitive":  result.sensitive,
            "beginner":   result.beginner,
            "rationale":  {k: list(v) for k, v in result.rationale.items()},
        },
        "routine_steps": list(result.routine_steps),
        "routine":       products,
    }


# ── Product lookup (inventory search) ─────────────────────────────────────────

class ProductLookupRequest(BaseModel):
    query: str


@router.post("/product-lookup")
async def product_lookup(request: Request, req: ProductLookupRequest) -> dict:
    """Turn a partial product name into structured candidates.

    Backs the inventory search box, so adding something you own is one search
    and one click rather than six form fields. Shares the search rate-limit
    bucket and the spend cap, since it is a Claude call per uncached query.
    """
    limiter.check(client_key(request), "search", SEARCH_RULES)
    spend_guard.check()

    results = await asyncio.to_thread(search_products, req.query.strip()[:120])
    return {"results": results}


class ProductShadesRequest(BaseModel):
    brand:   str
    product: str


@router.post("/product-shades")
async def product_shades(request: Request, req: ProductShadesRequest) -> dict:
    """The shade range for one product.

    Separate from /product-lookup because shade names only mean anything once
    the product is known — "Deauville" is unfindable until you know it is NARS
    Sheer Glow. So: search the product, then pick the shade.
    """
    limiter.check(client_key(request), "search", SEARCH_RULES)
    spend_guard.check()

    results = await asyncio.to_thread(
        lookup_shades, req.brand.strip()[:80], req.product.strip()[:120]
    )
    return {"shades": results}


# ── Product images (batch) ────────────────────────────────────────────────────

class ProductRef(BaseModel):
    brand:   str
    product: str


class ProductImagesRequest(BaseModel):
    products: list[ProductRef]


# A full recommendation set is 27 products. Allow a little headroom, but cap it
# so one request can't fan out into hundreds of DDGS lookups.
_MAX_IMAGE_LOOKUPS = 40


@router.post("/product-images")
async def product_images(request: Request, req: ProductImagesRequest) -> dict:
    """Resolve photo URLs for recommendation cards.

    Split out of /analyze deliberately: 27 sequential image searches would
    dominate analysis latency and get the deploy's IP throttled. Results are
    cached, so repeat products across users cost nothing.
    """
    limiter.check(client_key(request), "search", SEARCH_RULES)

    pairs = [
        (p.brand.strip(), p.product.strip())
        for p in req.products[:_MAX_IMAGE_LOOKUPS]
        if p.brand.strip() and p.product.strip()
    ]
    if not pairs:
        return {"images": {}}

    images = await resolve_many(pairs)
    return {"images": images}


@router.post("/search-product")
async def search_product(request: Request, req: SearchRequest) -> dict:
    # DuckDuckGo will rate-limit or block the deploy's IP if this runs hot.
    limiter.check(client_key(request), "search", SEARCH_RULES)

    query = req.query.strip()[:200]
    if not query:
        return {"results": []}
    try:
        images = await asyncio.to_thread(
            _ddgs_image_search,
            f"{query} beauty product",
        )
        results = [
            {"imageUrl": img.get("image", ""), "cutoutUrl": None}
            for img in images[:4]
            if img.get("image")
        ]
        return {"results": results}
    except Exception as e:
        print(f"Search error: {e}")
        return {"results": []}
