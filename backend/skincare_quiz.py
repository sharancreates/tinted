"""Skincare quiz: question set, weighted tag scoring, and routine construction.

Everything in this module is deterministic and offline. The quiz produces a
*tag profile* and a *routine skeleton*; picking real products to fill that
skeleton is a separate, Claude-backed step (api.skincare_recommendations), so
the scoring can be unit-tested without a network call or an API key.

Why tag scoring rather than a decision tree
-------------------------------------------
A tree over seven questions is unmaintainable by about question five, and it
cannot express the thing that actually matters here: two different answers
pointing at the same ingredient. "Dark spots" and "dullness" both argue for
brightening, and their weights should add up rather than one branch winning.

The question set and its order follow the industry playbook — see
docs/frontend-research.md.
"""

from __future__ import annotations

from dataclasses import dataclass, field

# ── Tags ──────────────────────────────────────────────────────────────────────

# The vocabulary product picks are scored against. Kept small on purpose: more
# tags means thinner scores and more ties.
TAGS = (
    "hydrating",
    "brightening",
    "exfoliating",
    "gentle",
    "oil-control",
    "anti-aging",
    "barrier-repair",
    "spf",
    "calming",
    "acne-fighting",
    "pore-refining",
)


# ── Question definitions ──────────────────────────────────────────────────────

@dataclass(frozen=True)
class Option:
    value: str
    label: str
    # Tag -> weight contributed when this option is chosen.
    weights: dict[str, int] = field(default_factory=dict)
    # Shown under the label in the UI. Empty means no helper text.
    hint: str = ""


@dataclass(frozen=True)
class Question:
    id: str
    prompt: str
    multi: bool
    options: tuple[Option, ...]
    help_text: str = ""


QUESTIONS: tuple[Question, ...] = (
    Question(
        id="skin_type",
        prompt="How does your skin usually behave?",
        multi=False,
        help_text="Think about how it feels a few hours after washing.",
        options=(
            Option("oily", "Oily",
                   {"oil-control": 3, "pore-refining": 2},
                   "Shiny by midday, makeup slides off"),
            Option("dry", "Dry",
                   {"hydrating": 3, "barrier-repair": 2},
                   "Tight, flaky, drinks up moisturiser"),
            Option("combination", "Combination",
                   {"hydrating": 1, "oil-control": 1, "pore-refining": 1},
                   "Oily T-zone, normal or dry cheeks"),
            Option("sensitive", "Sensitive",
                   {"gentle": 3, "calming": 3, "barrier-repair": 2},
                   "Stings or reddens easily with new products"),
            Option("normal", "Normal",
                   {"hydrating": 1},
                   "Comfortable most of the time"),
        ),
    ),
    Question(
        id="concerns",
        prompt="What would you most like to change?",
        multi=True,
        help_text="Pick as many as apply.",
        options=(
            Option("acne", "Breakouts", {"acne-fighting": 3, "pore-refining": 2}),
            Option("dehydration", "Dehydration", {"hydrating": 3, "barrier-repair": 1}),
            Option("fine_lines", "Fine lines", {"anti-aging": 3}),
            Option("dark_spots", "Dark spots", {"brightening": 3}),
            Option("redness", "Redness", {"calming": 3, "gentle": 2}),
            Option("dullness", "Dullness", {"brightening": 2, "exfoliating": 2}),
            Option("texture", "Uneven texture", {"exfoliating": 3, "pore-refining": 1}),
        ),
    ),
    Question(
        id="routine_depth",
        prompt="How much of a routine do you have now?",
        multi=False,
        help_text="This sets how many steps we recommend. No judgement either way.",
        options=(
            Option("none", "Nothing regular", {"gentle": 2}, "Water, maybe soap"),
            Option("minimal", "Minimal", {"gentle": 1}, "Cleanser and moisturiser"),
            Option("moderate", "Moderate", {}, "Three or four steps"),
            Option("advanced", "Advanced", {"anti-aging": 1, "exfoliating": 1},
                   "Five or more, including actives"),
        ),
    ),
    Question(
        id="sun_habits",
        prompt="How often do you wear SPF?",
        multi=False,
        options=(
            Option("daily", "Every day", {}),
            Option("occasional", "Sometimes", {"spf": 2}),
            Option("rarely", "Rarely or never",
                   {"spf": 4, "brightening": 1, "anti-aging": 1}),
        ),
    ),
    Question(
        id="age_band",
        prompt="Which age range are you in?",
        multi=False,
        help_text="Used to weight prevention against repair.",
        options=(
            Option("under_25", "Under 25", {"acne-fighting": 1}),
            Option("25_35", "25–35", {"anti-aging": 1, "brightening": 1}),
            Option("35_50", "35–50", {"anti-aging": 2, "hydrating": 1}),
            Option("over_50", "Over 50",
                   {"anti-aging": 3, "hydrating": 2, "barrier-repair": 1}),
        ),
    ),
    Question(
        id="ingredient_experience",
        prompt="Which of these have you used before?",
        multi=True,
        help_text="So we don't start you on something too strong.",
        options=(
            Option("retinol", "Retinol", {"anti-aging": 1}),
            Option("aha_bha", "AHAs or BHAs", {"exfoliating": 1}),
            Option("niacinamide", "Niacinamide", {"brightening": 1}),
            Option("vitamin_c", "Vitamin C", {"brightening": 1}),
            Option("none", "None of these", {"gentle": 2}),
        ),
    ),
    Question(
        id="goal_timeline",
        prompt="What are you optimising for?",
        multi=False,
        options=(
            Option("quick", "Visible change in a few weeks",
                   {"exfoliating": 1, "brightening": 1}),
            Option("long_term", "Long-term skin health",
                   {"anti-aging": 2, "barrier-repair": 1}),
        ),
    ),
)

QUESTIONS_BY_ID = {q.id: q for q in QUESTIONS}


# ── Routine skeletons ─────────────────────────────────────────────────────────

# Steps in application order, per routine depth. Someone with no routine gets
# three steps they will actually do; recommending eight is how you get someone
# to do none of them.
_ROUTINE_STEPS: dict[str, tuple[str, ...]] = {
    "none":     ("cleanser", "moisturiser", "sunscreen"),
    "minimal":  ("cleanser", "treatment", "moisturiser", "sunscreen"),
    "moderate": ("cleanser", "treatment", "serum", "moisturiser", "sunscreen"),
    "advanced": ("cleanser", "exfoliant", "treatment", "serum",
                 "eye cream", "moisturiser", "sunscreen"),
}

# Tags that make a step worth adding regardless of stated routine depth.
_STEP_TRIGGERS: dict[str, tuple[str, int]] = {
    # step -> (tag, minimum score to force it in)
    "exfoliant": ("exfoliating", 4),
    "eye cream": ("anti-aging", 4),
}

# Above this, we treat the user as reactive and hold back strong actives.
_SENSITIVITY_THRESHOLD = 4


@dataclass(frozen=True)
class QuizResult:
    """Deterministic output of the quiz, before any product is chosen."""
    tag_scores: dict[str, int]
    top_tags: tuple[str, ...]
    routine_steps: tuple[str, ...]
    sensitive: bool
    beginner: bool
    # Human-readable, per top tag: which answers produced it. Powers the
    # "we picked this because you said..." copy on the results page.
    rationale: dict[str, tuple[str, ...]]


def score(answers: dict[str, object]) -> QuizResult:
    """Turn raw quiz answers into a tag profile and a routine skeleton.

    *answers* maps question id -> option value (str) or values (list of str)
    for multi-select questions. Unknown question ids and unknown option values
    are ignored rather than raising: a stale client should get a slightly worse
    recommendation, not a 500.
    """
    tag_scores: dict[str, int] = {tag: 0 for tag in TAGS}
    rationale: dict[str, list[str]] = {tag: [] for tag in TAGS}

    for question_id, raw in answers.items():
        question = QUESTIONS_BY_ID.get(question_id)
        if question is None:
            continue

        selected = raw if isinstance(raw, list) else [raw]
        by_value = {opt.value: opt for opt in question.options}

        for value in selected:
            option = by_value.get(value) if isinstance(value, str) else None
            if option is None:
                continue
            for tag, weight in option.weights.items():
                tag_scores[tag] += weight
                rationale[tag].append(option.label)

    ranked = sorted(tag_scores.items(), key=lambda kv: (-kv[1], kv[0]))
    top_tags = tuple(tag for tag, value in ranked if value > 0)[:5]

    depth = answers.get("routine_depth")
    steps = list(_ROUTINE_STEPS.get(depth if isinstance(depth, str) else "", ())
                 or _ROUTINE_STEPS["minimal"])

    sensitive = tag_scores["gentle"] >= _SENSITIVITY_THRESHOLD
    beginner = depth in ("none", "minimal")

    # Promote steps the scores argue for even if the stated depth omitted them —
    # unless the user is reactive, where adding an acid is the wrong call.
    for step, (tag, minimum) in _STEP_TRIGGERS.items():
        if step in steps or tag_scores[tag] < minimum:
            continue
        if step == "exfoliant" and sensitive:
            continue
        steps = _insert_step(steps, step)

    return QuizResult(
        tag_scores=tag_scores,
        top_tags=top_tags,
        routine_steps=tuple(steps),
        sensitive=sensitive,
        beginner=beginner,
        rationale={
            tag: tuple(dict.fromkeys(reasons))
            for tag, reasons in rationale.items()
            if reasons and tag in top_tags
        },
    )


# Canonical application order, used to slot a promoted step into the right place
# rather than appending it after sunscreen.
_STEP_ORDER = (
    "cleanser", "exfoliant", "toner", "treatment", "serum",
    "eye cream", "moisturiser", "sunscreen",
)


def _insert_step(steps: list[str], step: str) -> list[str]:
    """Insert *step* into *steps* at its correct position in application order."""
    combined = set(steps) | {step}
    return [s for s in _STEP_ORDER if s in combined]
