"""Per-IP rate limiting and a daily spend cap for the paid upstream APIs.

State is in-process, which is correct for a single-instance deploy (Render's
free/starter tiers run one container). If GlowMatch ever scales past one
instance these counters become per-instance and the effective limits multiply
by the instance count — move them to Redis at that point.
"""

from __future__ import annotations

import os
import threading
import time
from collections import defaultdict, deque
from dataclasses import dataclass
from datetime import datetime, timezone

from fastapi import HTTPException, Request


# ── Config ────────────────────────────────────────────────────────────────────

def _env_float(name: str, default: float) -> float:
    try:
        return float(os.environ.get(name, default))
    except ValueError:
        return default


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, default))
    except ValueError:
        return default


# Claude pricing, USD per million tokens. Update if the model changes.
# claude-haiku-4-5 bills at $1 / $5 per MTok (input / output).
CLAUDE_INPUT_PER_MTOK = _env_float("CLAUDE_INPUT_PER_MTOK", 1.00)
CLAUDE_OUTPUT_PER_MTOK = _env_float("CLAUDE_OUTPUT_PER_MTOK", 5.00)


# Hard ceiling on what a single day can cost. Once crossed, the paid paths
# fail closed until UTC midnight.
DAILY_BUDGET_USD = _env_float("DAILY_BUDGET_USD", 5.00)

MAX_UPLOAD_BYTES = _env_int("MAX_UPLOAD_BYTES", 8 * 1024 * 1024)  # 8 MB


# ── Client identity ───────────────────────────────────────────────────────────

def client_key(request: Request) -> str:
    """Best-effort per-client identifier.

    Behind Render (and most PaaS proxies) the real client is the first entry of
    X-Forwarded-For. That header is trivially forged when the app is reachable
    directly, so this is a fair-use control, not a security boundary — a
    determined abuser can rotate it. The spend cap below is the real backstop.
    """
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


# ── Rate limiting ─────────────────────────────────────────────────────────────

@dataclass(frozen=True)
class Rule:
    """At most `limit` requests per `window_seconds`, per client."""
    limit: int
    window_seconds: int


class RateLimiter:
    """Sliding-window request log, keyed by (client, bucket)."""

    def __init__(self) -> None:
        self._hits: dict[tuple[str, str], deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()
        self._last_sweep = time.monotonic()

    def check(self, key: str, bucket: str, rules: tuple[Rule, ...]) -> None:
        """Record a hit, or raise 429 if any rule is already exhausted."""
        now = time.monotonic()
        widest = max(rule.window_seconds for rule in rules)

        with self._lock:
            self._sweep(now)

            log = self._hits[(key, bucket)]
            while log and now - log[0] > widest:
                log.popleft()

            for rule in rules:
                in_window = sum(1 for t in log if now - t <= rule.window_seconds)
                if in_window >= rule.limit:
                    oldest = next(t for t in log if now - t <= rule.window_seconds)
                    retry_after = max(1, int(rule.window_seconds - (now - oldest)) + 1)
                    raise HTTPException(
                        status_code=429,
                        detail="Too many requests. Please wait a moment and try again.",
                        headers={"Retry-After": str(retry_after)},
                    )

            log.append(now)

    def _sweep(self, now: float) -> None:
        """Drop empty/stale logs so unique-IP traffic can't grow memory forever.

        Caller must hold the lock.
        """
        if now - self._last_sweep < 300:
            return
        self._last_sweep = now
        stale = [k for k, log in self._hits.items() if not log or now - log[-1] > 86_400]
        for k in stale:
            del self._hits[k]


limiter = RateLimiter()

# /analyze runs face detection, a torch model, and a Claude call. Keep it tight.
ANALYZE_RULES = (Rule(limit=5, window_seconds=60), Rule(limit=40, window_seconds=86_400))

# /search-product hits DuckDuckGo, Claude, and remove.bg. Cheaper, but not free.
SEARCH_RULES = (Rule(limit=15, window_seconds=60), Rule(limit=150, window_seconds=86_400))


# ── Spend cap ─────────────────────────────────────────────────────────────────

class SpendGuard:
    """Tracks estimated spend for the current UTC day and fails closed at the cap."""

    def __init__(self, daily_budget_usd: float) -> None:
        self.daily_budget_usd = daily_budget_usd
        self._lock = threading.Lock()
        self._day = self._today()
        self._spent = 0.0

    @staticmethod
    def _today() -> str:
        return datetime.now(timezone.utc).strftime("%Y-%m-%d")

    def _roll(self) -> None:
        """Caller must hold the lock."""
        today = self._today()
        if today != self._day:
            self._day = today
            self._spent = 0.0

    def check(self) -> None:
        """Raise 503 if today's budget is already spent."""
        with self._lock:
            self._roll()
            if self._spent >= self.daily_budget_usd:
                raise HTTPException(
                    status_code=503,
                    detail=(
                        "GlowMatch has hit its daily usage limit. "
                        "Please try again tomorrow."
                    ),
                )

    def record(self, usd: float) -> None:
        if usd <= 0:
            return
        with self._lock:
            self._roll()
            self._spent += usd
            if self._spent >= self.daily_budget_usd:
                print(
                    f"[spend] daily budget reached: "
                    f"${self._spent:.4f} / ${self.daily_budget_usd:.2f} — "
                    f"paid endpoints now closed until UTC midnight"
                )

    def snapshot(self) -> dict[str, float | str]:
        with self._lock:
            self._roll()
            return {
                "day": self._day,
                "spent_usd": round(self._spent, 4),
                "budget_usd": self.daily_budget_usd,
                "remaining_usd": round(max(0.0, self.daily_budget_usd - self._spent), 4),
            }


spend_guard = SpendGuard(DAILY_BUDGET_USD)


# Per-model rates, USD per million tokens (input, output). The backend calls two
# different models — Haiku for recommendations, Sonnet for foundation matching —
# so billing has to be model-aware. Matched by prefix, since ids carry date
# suffixes (e.g. claude-haiku-4-5-20251001).
MODEL_PRICING: tuple[tuple[str, float, float], ...] = (
    ("claude-haiku-4-5", 1.00, 5.00),
    ("claude-opus-5-5", 4.00, 20.00),
    ("claude-sonnet-4-5", 3.00, 15.00),
    ("claude-sonnet-4-6", 3.00, 15.00),
    ("claude-opus-4", 5.00, 25.00),
)


def _rates_for(model: str | None) -> tuple[float, float]:
    """Rates for a model id, falling back to the env-configured defaults."""
    if model:
        for prefix, rate_in, rate_out in MODEL_PRICING:
            if model.startswith(prefix):
                return rate_in, rate_out
    return CLAUDE_INPUT_PER_MTOK, CLAUDE_OUTPUT_PER_MTOK


def record_claude_usage(message) -> float:
    """Bill a Claude response against today's budget using its real token counts.

    Takes the SDK's Message object; returns the recorded cost so callers can log it.
    """
    usage = getattr(message, "usage", None)
    if usage is None:
        return 0.0

    rate_in, rate_out = _rates_for(getattr(message, "model", None))
    input_tokens = getattr(usage, "input_tokens", 0) or 0
    output_tokens = getattr(usage, "output_tokens", 0) or 0
    cost = input_tokens / 1_000_000 * rate_in + output_tokens / 1_000_000 * rate_out
    spend_guard.record(cost)
    return cost


