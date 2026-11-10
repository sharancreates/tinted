# Tinted

**Foundation shade matching that works across the full range of skin tones,
plus a product shelf and skincare quiz.** Upload a photo and Tinted reads your depth
and undertone from your skin directly, matches you to real products, and
explains why each one was chosen. No camera, or don't want to upload your face?
A seven-question quiz gets you a routine instead.

> Shade matching is a genuinely hard problem that most tools solve badly for
> deep and neutral tones. Tinted samples many small skin patches, throws away
> the ones ruined by shadow or glare, and classifies the survivors against the
> [Monk Skin Tone scale](https://skintone.google/) — a 10-point scale built
> specifically to be more inclusive than the Fitzpatrick scale it replaced.

---

## How it works

```
photo
  │
  ├─ preprocess ............ white-balance correction
  ├─ face mesh ............. MediaPipe, 468 landmarks
  ├─ quality gate .......... blur / exposure / head angle, with a
  │                          specific reason when it rejects
  ├─ patch sampling ........ 17 landmark regions, outliers discarded
  ├─ aggregation ........... trimmed mean in Lab space
  ├─ classification ........ Monk Skin Tone level + undertone
  ├─ shade matching ........ LAB distance over the shade catalogue
  └─ recommendations ....... Claude picks real products per category
```

The `/analyze-stream` endpoint emits each stage as a server-sent event, so the
UI can narrate the pipeline instead of showing a spinner.

Signed-in users can also keep a private product shelf at `/vanity`, track each
item as using, backup, wishlist, panning, finished, or destash, and add products
from shade-match and skincare-quiz recommendations. Shelf data is stored in
Supabase and protected by Row Level Security. Product edits include notes,
purchase and opened dates, repurchase preference, and an optional product photo
URL. The `/vanity/looks` page groups shelf items into ordered looks that can be
shared individually. `/routine` provides AM, PM, and weekly skincare routines
with reorderable named steps, optional product links, and replenishment flags.
The signed-in `/profile` page controls an opt-in public profile at
`/u/[username]`, with per-product and per-routine visibility.

### Why a quality gate

Getting a confidently wrong answer is worse than getting no answer. Bad
lighting, motion blur and a turned head all corrupt the colour reading in ways
that are invisible in the final number. The gate rejects those inputs *before*
classification and says which problem it found, so the fix is actionable
("hold your phone steady") rather than generic ("no face detected").

Its thresholds are resolution-dependent and tunable via environment variables —
see `backend/quality_gate.py`.

### Why a range, not one shade

The classifier has real uncertainty, especially under mixed lighting. Tinted
shows a shade range with match scores and lets you override the detected Monk
level by hand. An automated result the user can't correct is worse than no
result.

---

## Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 16, React 19, Tailwind CSS v4, Framer Motion |
| Backend | FastAPI, Python 3.11 |
| CV | MediaPipe Face Mesh, OpenCV |
| Classification | LAB nearest neighbour against the ten Monk reference values |
| Matching | LAB colour distance over the shade catalogue |
| AI | Claude (Haiku 4.5) for product recommendations |
| Auth | Supabase |
| Deploy | Vercel (web) + Render (API) |

No neural network runs at request time, and the table says so deliberately —
an earlier version claimed PyTorch and CLIP. `ml/train.py` trains a classifier
offline and `ml/monk_classifier.pt` is committed, but nothing loads it; a CLIP
matcher existed and was imported by nothing, with `clip` neither installed nor
in `requirements.txt`, so it always fell through to the LAB path. The CLIP
module is gone, and torch moved to `requirements-train.txt` — it was adding
~543MB to every deploy for code that never ran.

Classification is ~15 lines of nearest neighbour. That is a defensible choice
and [the evaluation](docs/classifier-evaluation.md) says where it holds and
where it does not, which is more than the previous claim could.

---

## Running it locally

```bash
./scripts/dev.sh          # both halves, with preflight checks
```

The script refuses to start against a venv older than Python 3.10 and warns if
`ANTHROPIC_API_KEY` is missing. Both failures are otherwise silent: the web app
loads fine, the quiz just says it couldn't load and recommendations come back
empty, with nothing pointing at the backend.

First-time setup below.

### Backend

```bash
cd backend
python3.11 -m venv .venv          # 3.11 — routes.py uses PEP 604 unions
source .venv/bin/activate
pip install -r requirements.txt   # runtime only; -r requirements-dev.txt for tests
cp .env.example .env              # add ANTHROPIC_API_KEY
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local  # set NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev
```

### Tests

```bash
cd backend && python -m pytest tests/ -q     # 148 tests
```

---

## Evaluation

[**docs/classifier-evaluation.md**](docs/classifier-evaluation.md) — where the
classifier is fragile, measured rather than asserted.

The short version: the Monk reference values are not evenly spaced. MST 1 and 2
sit 5.48 apart in LAB, giving a safe radius of 2.74, while MST 6 and 7 get
14.57. Under isotropic noise at sigma 5, MST-2 is a coin flip while MST 6–8 are
still perfect, and every illuminant-induced misclassification is confined to
MST 1–4.

That result alone would mislead, so the write-up also models photon shot noise:
darker skin reflects fewer photons, and scaling sigma by 1/sqrt(L) drops MST
9–10 to 0.69–0.75. **Both ends of the scale are fragile, for opposite reasons** —
crowded references at the light end, noisier measurement at the deep end.

```bash
cd backend && python eval/classifier_eval.py
```

This characterises one stage. End-to-end accuracy from a photograph is
**unmeasured**: `eval/run_eval.py` is built and refuses to report a number
while the test set is placeholder images, because a fake accuracy figure is
worse than an absent one. `backend/eval/README.md` documents collecting real
labelled samples.

In between sits a **simulated lighting eval** (`eval/pipeline_sim.py`): 1,200
synthetic portraits with known skin colour under daylight, a warm bulb, cool
shade and low light, run through the production white balance, patch sampling
and classifier. It is published as an accuracy dashboard at
[tinted2.vercel.app/eval](https://tinted2.vercel.app/eval) with a confusion
matrix, per-level and per-lighting breakdowns, and a with/without white
balance comparison. It found a real bug (the exposure gate refused a third of
MST 1-3 faces), which is now fixed: daylight refusals fell from 12% to 2%.

**On real photographs** (`eval/mste_eval.py`, Google's Monk Skin Tone Examples:
1,356 photos of 19 people with expert labels), the pipeline lands within one
Monk level on 15% of photos (95% range 8 to 23%, bootstrapped by person) and
31% of the photos it accepts. Readings collapse toward the middle of the
scale: phone auto-exposure normalises face brightness, and the classifier
compares absolute colour, so pale skin reads 4 to 5 levels deep and deep skin
1 to 2 levels light. The simulation missed this because its virtual camera
exposed every face correctly. The planned fix, normalising exposure against
the whites of the eyes and classifying relative colour, is written up on the
dashboard. MST-E is evaluation-only and is never used for tuning.

---

## Deploying

**Backend — Render.** `render.yaml` is a Blueprint: New → Blueprint → point at
this repo. It builds `backend/Dockerfile` and health-checks `/health`.

Docker rather than Render's native Python runtime because MediaPipe depends on
`opencv-contrib-python` — the non-headless build — which needs `libGL` and
`glib` at import time. Pinning `opencv-python-headless` does not help: MediaPipe
pulls contrib in regardless, so the system libraries have to exist, and native
runtimes give no way to install them.

Two env vars are prompted for on first deploy and are not in the repo:

| Variable | Notes |
|---|---|
| `ANTHROPIC_API_KEY` | Without it, shade matching works but recommendations are empty |
| `ALLOWED_ORIGINS` | **Must** be your Vercel origin. Unset means dev mode — the API accepts any localhost origin and refuses the deployed site |

**Frontend — Vercel.** Set `NEXT_PUBLIC_API_URL` to the Render URL. Unset, it
falls back to `http://localhost:8000`, so every visitor's browser calls *their
own machine* and the site appears broken while the build reports success.

---

## API

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/health` | Liveness |
| `POST` | `/analyze` | Full pipeline, single JSON response |
| `POST` | `/analyze-stream` | Same pipeline, streamed per stage (SSE) |
| `POST` | `/match-foundation` | "I already wear X" → equivalents in other brands |
| `GET` | `/skincare-quiz/questions` | Question set (single source of truth for the UI) |
| `POST` | `/skincare-quiz` | Score answers → routine → products |
| `POST` | `/routines/suggest` | Suggest AM/PM order from shelf products |
| `POST` | `/product-images` | Batched, cached product photo lookup |
| `POST` | `/search-product` | Image search for a single product |
| `POST` | `/product-lookup` | Search product catalogue for shelf entry |
| `POST` | `/product-shades` | Look up shades for a product |

Shelf CRUD uses the authenticated Supabase client directly. Supabase RLS is the
authorization boundary; there are no duplicate FastAPI shelf endpoints.

### Cost and abuse controls

The paid upstreams (Claude, remove.bg) are protected by per-IP sliding-window
rate limits and a hard daily spend cap that fails closed at UTC midnight. Both
live in `backend/api/limits.py`. Counters are in-process, which is correct for
a single-instance deploy and documented as needing Redis if that ever changes.

---

## Design

Warm cream ground, near-black serif, coral accent — the visual language of
beauty editorial rather than of a dashboard.

The colour-accuracy constraint is still respected, but scoped correctly: it
applies to the *swatch surface*, not the whole interface. Anything whose colour
is being judged — shade chips, product photography — sits on plain white
(`--color-swatch-ground`) so nothing tints the assessment. The cream is chrome
around those surfaces, never behind them.

The Monk scale itself is the visual signature (`ToneRibbon`), recurring across
the welcome page, the analysing state and results. Most products in this space
decorate with stock beauty photography, which is why they look alike; here the
decoration is the data — those are the exact values the classifier targets.

Every text/surface pair is verified at WCAG AA for body text, with the measured
ratios recorded in `frontend/app/globals.css` so they can be re-checked.

Research behind the interface decisions is written up in
[`docs/frontend-research.md`](docs/frontend-research.md).

---

## Repository layout

```
tinted/
├── backend/
│   ├── api/            routes, rate limits, Claude calls, image lookup
│   ├── detection/      face mesh, patch sampling, Monk classifier
│   ├── eval/           offline accuracy harness
│   ├── tests/          pytest suite
│   ├── quality_gate.py pre-analysis input checks
│   └── skincare_quiz.py  question set + weighted tag scoring
├── frontend/
│   ├── app/            routes: /, /quiz, /match, /vanity, /vanity/looks, /routine, /profile, /u/[username], /r/[slug]
│   ├── components/     analysis, quiz, vanity, auth, and design-system UI
│   └── lib/api.ts      typed API client
├── supabase/migrations/ inventory, routines, and shelf migrations
└── docs/
```
