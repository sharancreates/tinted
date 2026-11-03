"""Product photo lookup for recommendation cards.

Recommendations now come back as ~27 products, and resolving a photo for each
one is far too slow and too rate-limit-prone to do inside /analyze — DuckDuckGo
will start refusing the deploy's IP long before 27 sequential image searches
finish. So image resolution is a separate, cached, batched call that the
frontend makes for the cards it is actually rendering.

Design notes
------------
* **Cache first.** Product names repeat heavily across users (there are only so
  many foundations Claude will recommend for MST-5 neutral), so an in-process
  cache absorbs most of the traffic. Same single-instance caveat as
  api.limits — see that module's docstring.
* **Negative results are cached too**, with a shorter TTL. Without that, every
  product DDGS has no image for gets retried on every single request.
* **Bounded concurrency.** DDGS is the bottleneck and it blocks, so lookups run
  in a thread pool with a small ceiling rather than all at once.
"""

from __future__ import annotations

import asyncio
import os
import random
import re
import threading
import time

import httpx
from ddgs import DDGS

# How long a resolved URL stays good. Product imagery does not churn quickly and
# a stale-but-working image is much better than a slow page.
_TTL_HIT_SECONDS = 24 * 60 * 60
# Misses expire sooner so a transient DDGS failure isn't remembered all day.
_TTL_MISS_SECONDS = 30 * 60

# DDGS throttles far more aggressively than a 429 would suggest. Under load it
# does not error — it returns a full page of results for something unrelated
# ("Revlon ColorStay Foundation" came back as Riverdale cast photos, "Laura
# Mercier Flawless Fusion" as photographs of a scarlet ibis). The same queries
# in isolation return correct results, so this is our own concurrency poisoning
# the well. Two at a time, staggered.
_MAX_CONCURRENCY = 2

# Jitter before each request so a batch does not arrive as one burst.
_STAGGER_MIN_MS = 120
_STAGGER_MAX_MS = 320

# Refuse to grow without bound if traffic is all unique products.
_MAX_ENTRIES = 5_000


class _ImageCache:
    """TTL cache mapping a product query to a resolved image URL (or None)."""

    def __init__(self) -> None:
        self._entries: dict[str, tuple[str | None, float]] = {}
        self._lock = threading.Lock()

    def get(self, key: str) -> tuple[bool, str | None]:
        """Return (hit, url). ``hit`` distinguishes a cached None from a miss."""
        now = time.monotonic()
        with self._lock:
            entry = self._entries.get(key)
            if entry is None:
                return False, None
            url, expires_at = entry
            if now >= expires_at:
                del self._entries[key]
                return False, None
            return True, url

    def put(self, key: str, url: str | None) -> None:
        ttl = _TTL_HIT_SECONDS if url else _TTL_MISS_SECONDS
        now = time.monotonic()
        with self._lock:
            if len(self._entries) >= _MAX_ENTRIES:
                self._evict_expired(now)
                if len(self._entries) >= _MAX_ENTRIES:
                    # Still full and everything is live — drop the entry closest
                    # to expiry so the cache stays bounded.
                    oldest = min(self._entries, key=lambda k: self._entries[k][1])
                    del self._entries[oldest]
            self._entries[key] = (url, now + ttl)

    def _evict_expired(self, now: float) -> None:
        """Caller must hold the lock."""
        for key in [k for k, (_, exp) in self._entries.items() if now >= exp]:
            del self._entries[key]

    def stats(self) -> dict[str, int]:
        with self._lock:
            return {"entries": len(self._entries)}


_cache = _ImageCache()


def cache_key(brand: str, product: str) -> str:
    return f"{brand.strip().lower()}|{product.strip().lower()}"


# Hosts that serve user-generated content. An image search for a real product
# name reliably surfaces these — swatch photos, "get the look" posts, nail art
# tagged with the foundation someone happened to be wearing. They match the
# words and not the product, which is the worst possible outcome on a card whose
# whole job is to show you the thing you would be buying.
_UGC_HOSTS = (
    "pinimg.com", "pinterest.", "instagram.", "cdninstagram.", "fbcdn.net",
    # Substrings, not domains — "tiktok." would miss p16.tiktokcdn.com.
    "tiktok", "tumblr.", "blogspot.", "wordpress.", "reddit.", "redd.it",
    "twimg.com", "ytimg.com", "youtube.", "facebook.", "wixstatic.com",
    "squarespace-cdn.com", "medium.com", "quoracdn.net", "wp.com",
)

# Retailer and brand CDNs. Not exhaustive and not required — it only breaks
# ties, so an unknown legitimate shop still wins on title relevance alone.
_PREFERRED_HOSTS = (
    "walmartimages.com", "media-amazon.com", "ebayimg.com", "ulta.com",
    "sephora.com", "target.scene7.com", "targetimg", "cdn.shopify.com",
    "boots.com", "cultbeauty.co.uk", "lookfantastic.com", "notino.",
    "douglas.", "sokoglam.com", "beautybay.com", "feelunique.com",
)

# Words that mark a result as a look rather than a product shot.
_BAD_TITLE_WORDS = (
    "nail", "nails", "manicure", "hairstyle", "outfit", "tattoo", "meme",
    "wallpaper", "drawing", "aesthetic", "tutorial", "vs ", "dupe",
    # Shade charts and swatch grids match the brand and the product type but
    # show forty colours instead of the bottle. "Black Opal True Color" was
    # shown as a "100+ shades of black" chart.
    "shades of", "swatch", "chart", "shade range", "all shades", "collage",
    "comparison", "before and after", "review",
)

# Brand words that say nothing about which brand it is. "Fenty Beauty" is
# identified by "fenty"; requiring "beauty" would only lose real listings.
_GENERIC_BRAND_WORDS = {
    "beauty", "cosmetics", "cosmetic", "makeup", "professional", "pro", "paris",
    "london", "new", "york", "by", "the", "and", "co", "labs", "skincare", "skin",
}

# Product types. A result that names a *different* type than the one
# recommended (a mascara photo for a foundation) is the wrong product even
# when the brand matches.
_PRODUCT_TYPES = {
    "foundation", "concealer", "blush", "bronzer", "highlighter", "lipstick",
    "gloss", "liner", "mascara", "brow", "powder", "palette", "eyeshadow",
    "primer", "serum", "cleanser", "moisturizer", "moisturiser", "sunscreen",
    "contour", "tint", "balm",
}

# Banners and shade charts are wide; product shots are square or portrait.
_MAX_ASPECT = 1.8
_MIN_SIDE_PX = 150


def _words(text: str) -> set[str]:
    """Lower-cased words with punctuation removed, so "M·A·C" reads as "mac"."""
    text = re.sub(r"(?<=\w)[·.](?=\w)", "", text.lower())
    return set(re.findall(r"[a-z0-9']+", text))


def _brand_matches(brand: str, title_words: set[str]) -> bool:
    words = [w for w in _words(brand) if w not in _GENERIC_BRAND_WORDS]
    if not words:
        words = sorted(_words(brand))[:1]
    return bool(words) and all(w in title_words for w in words)

# Below this, we would rather show no photo than a wrong one — the card is
# built to look complete without an image.
_MIN_SCORE = 2


def _score_candidate(image: dict, brand: str, product: str) -> int:
    """Rank a search hit by how likely it is to be a photo of this product."""
    url = str(image.get("image", ""))
    title = str(image.get("title", "")).lower()
    host = url.split("/")[2].lower() if url.count("/") >= 2 else ""

    if not url.startswith("https://"):
        return -1
    if any(bad in host for bad in _UGC_HOSTS):
        return -1
    if any(word in title for word in _BAD_TITLE_WORDS):
        return -1

    width, height = image.get("width"), image.get("height")
    if isinstance(width, (int, float)) and isinstance(height, (int, float)) and width and height:
        if width / height > _MAX_ASPECT or min(width, height) < _MIN_SIDE_PX:
            return -1

    title_words = _words(title)
    product_words = _words(product)

    wanted_types = product_words & _PRODUCT_TYPES
    shown_types = title_words & _PRODUCT_TYPES
    if wanted_types and shown_types and not (wanted_types & shown_types):
        return -1

    # The whole brand appearing in the title is the strongest signal that the
    # result is the product rather than something worn with it. Only the
    # distinctive words count, all of them: matching on the first word alone
    # let "Black Opal" match anything titled "black".
    relevance = 3 if _brand_matches(brand, title_words) else 0

    # Overlap on the distinguishing words of the product name.
    words = [w for w in product_words if len(w) > 3]
    if words:
        relevance += min(sum(1 for w in words if w in title_words), 3)

    # A trusted host is a tie-breaker, never a substitute for relevance. Without
    # this guard a well-known retailer CDN could clear the bar on host score
    # alone and put an unrelated product on the card.
    if relevance == 0:
        return -1

    if any(good in host for good in _PREFERRED_HOSTS):
        relevance += 2

    return relevance


SERPER_URL = "https://google.serper.dev/images"


def _search_images(query: str) -> list[dict]:
    """Image search results as {image, title, width, height} dicts.

    Uses Serper (Google Images through an API) when SERPER_API_KEY is set,
    because scraping DuckDuckGo from a data-centre IP is throttled into
    returning unrelated results. Without a key, or if Serper fails, it falls
    back to DuckDuckGo. Raises only if every source fails.
    """
    key = os.environ.get("SERPER_API_KEY", "").strip()
    if key:
        try:
            response = httpx.post(
                SERPER_URL,
                headers={"X-API-KEY": key, "Content-Type": "application/json"},
                json={"q": query, "num": 10},
                timeout=8.0,
            )
            response.raise_for_status()
            return [
                {
                    "image": item.get("imageUrl", ""),
                    "title": item.get("title", ""),
                    "width": item.get("imageWidth"),
                    "height": item.get("imageHeight"),
                }
                for item in response.json().get("images", [])
            ]
        except Exception as exc:
            print(f"[product-images] serper failed for {query!r}, using ddgs: {exc}")

    with DDGS() as ddgs:
        return list(ddgs.images(query, max_results=12, safesearch="moderate"))


def _lookup_one(brand: str, product: str) -> str | None:
    """Blocking DDGS image search for a single product. Never raises.

    Takes the best-scoring candidate from a wider result set rather than the
    first https hit. The old behaviour — first result wins — is why an
    unrelated photo could end up on a card: DDGS ordering is not stable, and
    when a UGC host took the top slot there was nothing to reject it.
    """
    query = f"{brand} {product}".strip()
    if not query:
        return None

    # DDGS is unreliable in a way that looks like "this product has no photo":
    # it intermittently returns one unrelated result, or nothing, for queries
    # that work fine seconds later. A single attempt therefore drops photos for
    # real products. Retry once with a shortened query — the brand plus the
    # first two words of the product name — which also helps when the model
    # returns an over-long product string.
    # Retry the SAME query rather than a shortened one. Truncating loses the
    # discriminating words and makes things worse, not better: "NARS Natural
    # Radiant Longwear Foundation" returns the product, while "NARS Natural
    # Radiant" returns Matchbox toy cars. The full query is right; the failure
    # is transient throttling, so the fix is to wait rather than to reword.
    attempts = 3

    for index in range(attempts):
        attempt = query
        if index:
            time.sleep(0.9 * index)
        try:
            candidates = _search_images(attempt)
        except Exception as exc:
            print(f"[product-images] lookup failed for {attempt!r}: {exc}")
            continue

        best_url, best_score = None, _MIN_SCORE - 1
        for image in candidates:
            score = _score_candidate(image, brand, product)
            if score > best_score:
                best_url, best_score = str(image.get("image", "")), score

        if best_url is not None:
            return best_url

        # Retrying on *relevance*, not on result count. A throttled response
        # arrives full — ten results, none of them the product — so counting
        # rows would never catch it.
        print(
            f"[product-images] {len(candidates)} results but none relevant for "
            f"{attempt!r}"
        )

    print(f"[product-images] no confident match for {query!r} — showing none")
    return None


async def resolve_many(products: list[tuple[str, str]]) -> dict[str, str | None]:
    """Resolve image URLs for (brand, product) pairs, keyed by cache_key.

    Cached entries are returned without a network call; the rest are fetched
    with bounded concurrency. Always returns a key for every input pair.
    """
    results: dict[str, str | None] = {}
    pending: list[tuple[str, str, str]] = []  # (key, brand, product)
    # Tracks keys already resolved *or* already queued. Checking `results`
    # alone would miss duplicates within this batch, since pending keys have
    # no entry there yet — and the same product genuinely does repeat across
    # categories (a tinted moisturiser under both foundation and concealer).
    seen: set[str] = set()

    for brand, product in products:
        key = cache_key(brand, product)
        if key in seen:
            continue
        seen.add(key)
        hit, url = _cache.get(key)
        if hit:
            results[key] = url
        else:
            pending.append((key, brand, product))

    if not pending:
        return results

    semaphore = asyncio.Semaphore(_MAX_CONCURRENCY)

    async def worker(key: str, brand: str, product: str) -> None:
        async with semaphore:
            await asyncio.sleep(random.uniform(_STAGGER_MIN_MS, _STAGGER_MAX_MS) / 1000)
            url = await asyncio.to_thread(_lookup_one, brand, product)
        _cache.put(key, url)
        results[key] = url

    await asyncio.gather(*(worker(*item) for item in pending))
    print(
        f"[product-images] {len(products)} requested, {len(seen)} unique, "
        f"{len(seen) - len(pending)} cached, {len(pending)} fetched, "
        f"{sum(1 for v in results.values() if v)} resolved"
    )
    return results


def cache_stats() -> dict[str, int]:
    return _cache.stats()
