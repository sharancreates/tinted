# GlowMatch Devlog

## [April 1 2026] — Project Kickoff

Starting GlowMatch from scratch. The idea is an AI makeup shade recommender 
that actually uses real computer vision instead of just wrapping a vision LLM.

**What I'm building:** Upload a photo, detect skin tone via MediaPipe + a 
fine-tuned Monk Skin Tone classifier, match to real foundation shades, and 
use Claude to generate a personalized recommendation.

**Why this stack:** Already comfortable with Next.js + FastAPI from previous 
projects. Monk Skin Tone scale is the current industry standard (used by Google) 
so it felt like the right call over rolling my own clustering approach.

**What I'm unsure about:** How accurate the HuggingFace Monk classifier will be 
on diverse lighting conditions. Might need to preprocess images (normalize 
brightness) before passing to the model. Also need to figure out the best way 
to curate the foundation shade dataset — might start with just Fenty since they 
have the most inclusive shade range.

**First milestone:** Running FastAPI server + MediaPipe pixel extraction working 
end to end.

## [April 1 2026] — Issue 1 Complete: FastAPI Skeleton

Server is running on port 8000. Health check and placeholder /analyze 
route are working. CORS set up with wildcard for now, will tighten later. 
Dependencies installed in .venv.

## [April 1 2026] — Issue 2 Complete: MediaPipe Face Mesh + Pixel Sampling

Pixel extraction working. Had to pin mediapipe==0.10.9 since 0.10.33 
dropped .solutions support. 21 landmark points sampled across cheeks 
and forehead using 7x7 patch averaging. Verified with real photo — 
getting clean RGB tuples back.

## [April 1 2026] — Issue 3 Complete: Monk Skin Tone Classifier

Monk classifier working. Uses Euclidean distance in RGB space against 
the 10 official Monk hex values. Undertone detection combines red/blue 
ratio + HSV hue for more robustness — ±0.12 neutral band avoids forcing 
everything into warm/cool. 422 returned when no face detected.

Smoke test results look reasonable across the tone range. One edge case: 
deep dark pixels with low saturation trend warm — worth revisiting later 
with more test images.

Known issue: warm lighting conditions skew undertone detection toward 
"warm" even for cool/neutral skin tones. Image preprocessing 
(white balance normalization) or switching to LAB color space for 
undertone detection would improve accuracy. Fix planned post-MVP.

## [April 6th 2026] 

Test results: MST detection accurate for medium-deep range. 
Fails on very fair skin — warm lighting + makeup skew results.
Webp format not supported. Needs content type fix.

## [November 3 2026] - Shelf expansion, first implementation

Extended the existing `inventory_items` table rather than introducing a second
products table. The vanity already stores user-owned product snapshots, and
reusing it avoids splitting a user's shelf across two schemas. Migration
`0002_expand_inventory_lifecycle.sql` adds product status, image URL, purchase
and opened dates, purchase price, and repurchase preference. Existing finished
rows are mapped to the `finished` status, with a trigger keeping the legacy
`is_finished` field synchronized for current looks code.

The shelf now groups products into expandable category sections, filters by
status and category, and supports editing shelf lifecycle details. Shade-match
recommendations and skincare quiz products can be saved directly to the shelf.
Shelf reads and writes continue through the authenticated Supabase client so
existing RLS policies remain the authorization boundary; no duplicate FastAPI
CRUD layer was added.

Tradeoff: the existing category field remains free text for backward
compatibility. A later migration can normalize legacy values before enforcing a
fixed category set. Applying the migration to the deployed Supabase project is
still required before the new shelf fields are available there. Routines,
replenishment alerts, and public user profiles remain future tiers.

## [November 3 2026] - Skincare routines and replenishment

Added `routine_type` to preserve existing shareable looks while supporting
morning, evening, and weekly skincare routines. Routine steps now accept a
custom step name and can optionally link to a shelf item. The `/routine` page
provides mobile tabs, desktop routine columns, drag reordering, and keyboard
accessible move controls.

Added owner-scoped replenishment records in migration
`0003_routines_and_replenishment.sql`. Shelf flags cycle through running low,
empty, and clear states. Category lifespan estimates provide a gentle
opened-date nudge, and the vanity navigation shows a badge when anything is
flagged. Users can override the category lifespan estimate from the product
editor. The feature continues to use Supabase RLS and
the current browser client rather than adding a separate API authorization
layer.

## [November 3 2026] - Public profiles

Added usernames, opt-in profile visibility, bios, and an optional Monk tone in
`public_profiles`. Products now have an explicit `is_public` toggle, while
routine visibility continues to use the existing routine flag. `/profile`
manages profile settings and `/u/[username]` renders a public profile with
selected products and routines. Visitors can save a public product to their
own wishlist.

Privacy decision: anonymous access is through narrow security-barrier views,
not direct public table reads. Public profile views omit user IDs, inventory
notes, and purchase history. Routine product details are shown only when both
the profile and product are public. The old shared-look route now queries a
similarly narrow view, and public read policies on the base routine tables were
removed. This avoids exposing entire rows through the Supabase data API.

## [November 3 2026] - Smart routine suggestions

Added `/routines/suggest`, a lightweight Claude Haiku call that proposes AM and
PM ordering from the user's shelf. The handler reuses the existing search
rate-limit bucket and daily spend cap. Product IDs returned by the model are
validated against the submitted shelf IDs before the frontend can save them.
The routine builder offers this suggestion when its AM and PM lists are empty,
then persists the selected products as ordered routine steps.

The dupe finder remains unimplemented. The checked-in shade catalogue contains
Fenty shade colours and names but no product-level alternative prices, so it
cannot reliably filter for a cheaper equivalent as specified. Adding that
feature needs a priced multi-brand shade catalogue rather than guessed prices.
