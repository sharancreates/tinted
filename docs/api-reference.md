# API reference

## Product analysis and lookup

The FastAPI API is rooted at the configured `NEXT_PUBLIC_API_URL`.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Liveness |
| `POST` | `/analyze` | Analyze an uploaded photo and return matches |
| `POST` | `/analyze-stream` | Stream analysis stages as SSE |
| `POST` | `/match-foundation` | Find equivalents for a known foundation shade |
| `GET` | `/skincare-quiz/questions` | Return quiz questions |
| `POST` | `/skincare-quiz` | Score quiz answers and recommend products |
| `POST` | `/routines/suggest` | Suggest AM/PM ordering for shelf products |
| `POST` | `/product-lookup` | Search product names for shelf entry |
| `POST` | `/product-shades` | Look up shades for a selected product |
| `POST` | `/product-images` | Resolve product photos in a batch |
| `POST` | `/search-product` | Search for one product image |

Example product lookup:

```http
POST /product-lookup
Content-Type: application/json

{"query":"elf halo glow"}
```

Example routine suggestion request:

```http
POST /routines/suggest
Content-Type: application/json

{"products":[{"id":"product-uuid","brand":"CeraVe","product":"Hydrating Cleanser","category":"cleanser"}]}
```

The response contains ordered `morning` and `evening` arrays. Each suggested
step includes a shelf `product_id`, a step name, and brief reasoning. IDs not
present in the request are discarded. This Claude call uses the existing
per-IP search limit and daily spend cap.

Example response:

```json
{
  "morning": [
    {"product_id":"product-uuid","step_name":"Cleanser","reason":"Cleanses before leave-on products."}
  ],
  "evening": [
    {"product_id":"product-uuid","step_name":"Cleanser","reason":"Removes the day's buildup."}
  ],
  "reasoning":"Apply light leave-on products before moisturizer."
}
```

The response contains candidate product names, categories, shade hints, colour
hex values, and typical retail prices in integer cents where available. Results
are suggestions and remain editable before saving.

## Shelf operations

Shelf CRUD is performed by the web client with the user's Supabase session.
There are no FastAPI `/shelf` routes in this implementation. The Supabase
`inventory_items` table is protected by RLS, which scopes all operations to
`auth.uid() = user_id`.

The client supports listing, inserting, updating, and deleting inventory items.
New rows can include `brand`, `product`, `shade`, `category`, `hex`, `url`,
`price_cents`, `status`, `image_url`, `purchase_price_cents`, `purchase_date`,
`opened_date`, `notes`, and `is_repurchase`. Status is one of `using`,
`backup`, `wishlist`, `panning`, `finished`, or `destash`.

Shade-match and skincare quiz result cards insert a product with status `using`.
Users can change its status and other shelf metadata from `/vanity`.

## Routine operations

Routine data is read and written through Supabase. Existing shareable looks
remain supported. The `/routine` page creates `morning`, `evening`, and
`weekly` routine rows and manages ordered `routine_items` with either a shelf
product link or a custom `step_name`.

Replenishment flags are stored in `replenishment_alerts`, scoped to the owner by
RLS. On the shelf, the flag cycles from normal to running low to empty and back
to normal. The shelf filter can show flagged products. Category lifespan values
are client-side starting estimates and can trigger a gentle nudge from an
opened date. Users can override the estimate in the product editor; the value
is stored in `replenishment_alerts.estimated_lifespan_days`.

## Public profiles

`/profile` updates the signed-in user's `public_profiles` row and `/u/{username}`
is publicly readable without authentication. The page reads only from
`public_profile_details`, `public_profile_products`, and
`public_profile_routine_steps`. RLS keeps the base profile and inventory tables
private; the database views project only explicitly public data.

The web client can save a visible profile product to the current user's shelf
with status `wishlist`. Profile setup, product visibility changes, routine
visibility changes, and wishlist saves require a valid Supabase session.
