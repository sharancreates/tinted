# Sharing architecture

## Public profile and look links

Tinted supports opt-in public profiles and individual look links. A profile is
configured at `/profile` and published at `/u/{username}`. A routine can also
be made public from `/vanity/looks`; its random `share_slug` is used at
`/r/[slug]`. Profile links use a URL-safe username. Sharing is opt-in and can
be disabled at profile or routine level.

Public pages read through narrow security-barrier views. `shared_routines` and
`shared_routine_items` return only fields needed to render a shared look.
`public_profile_details` returns presentation fields. The
`public_profile_products` view includes only products marked public when the
profile is public. `public_profile_routine_steps` returns public routines and
reveals linked product details only for products also marked public. These
views run with their owner's privileges to project public rows while the base
tables remain private to their owners.

## Privacy boundary

- Inventory is private by default and protected by owner-scoped RLS.
- A product appears on a profile only if both the profile and product are
  public.
- A profile routine appears only when both the profile and routine are public.
- Profile routine steps show linked product details only if that product is
  public.
- A shared look exposes its title, description, occasion, ordered steps, and
  limited product snapshot fields needed to identify the products.
- Inventory notes, purchase dates, and the owner's wider private shelf are not
  exposed by the profile views.
- There is no feed, follower graph, like, or comment system.

`public_profiles` and `inventory_items` do not have anonymous read policies.
The profile views are the public projection, so queries cannot request private
columns such as `user_id`, inventory notes, or purchase history. When sharing
is disabled, the views stop returning the profile's rows.
