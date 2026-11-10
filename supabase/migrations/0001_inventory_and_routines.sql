-- Tinted: makeup inventory, routines, and shareable looks.
--
-- Run this once in the Supabase SQL editor (Dashboard → SQL → New query).
--
-- Design notes
-- ------------
-- * Inventory rows are snapshots, not references to a catalogue. A user's
--   "MAC Face and Body in N4" has to keep its name and price even if our
--   recommendation data changes, so the text is denormalised on purpose.
-- * Prices are integer cents. Storing money as float invites rounding drift the
--   moment you sum a routine.
-- * Sharing is per-routine and opt-in. A share link exposes the routine and the
--   items in it — never the rest of someone's inventory.

-- ── Inventory ────────────────────────────────────────────────────────────────

create table if not exists public.inventory_items (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,

  brand        text not null,
  product      text not null,
  shade        text,
  category     text,               -- foundation, lip, blush, ... free text
  hex          text,               -- swatch colour, when known
  url          text,

  -- Integer cents, so summing a routine is exact.
  price_cents  integer check (price_cents is null or price_cents >= 0),
  currency     text not null default 'USD',

  notes        text,
  is_finished  boolean not null default false,   -- used up, kept for history

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists inventory_items_user_idx
  on public.inventory_items (user_id, created_at desc);

-- gen_random_bytes comes from pgcrypto, which Supabase installs in the
-- "extensions" schema. Migrations do not have that schema on their search
-- path, so the call is qualified and the extension is ensured here.
create extension if not exists pgcrypto with schema extensions;

-- ── Routines ─────────────────────────────────────────────────────────────────

create table if not exists public.routines (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,

  title        text not null,
  description  text,
  occasion     text,               -- "going out", "everyday", ...

  is_public    boolean not null default false,
  -- Random, not sequential: a guessable slug would let anyone enumerate
  -- other people's looks.
  share_slug   text unique default encode(extensions.gen_random_bytes(9), 'base64'),

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists routines_user_idx on public.routines (user_id, created_at desc);
create index if not exists routines_share_idx on public.routines (share_slug) where is_public;

-- ── Routine steps ────────────────────────────────────────────────────────────

create table if not exists public.routine_items (
  id                uuid primary key default gen_random_uuid(),
  routine_id        uuid not null references public.routines (id) on delete cascade,
  -- Deleting a product from inventory empties the step rather than silently
  -- removing it, so the routine still reads as complete.
  inventory_item_id uuid references public.inventory_items (id) on delete set null,

  step_order        integer not null default 0,
  note              text,

  created_at        timestamptz not null default now()
);

create index if not exists routine_items_routine_idx
  on public.routine_items (routine_id, step_order);

-- ── Row level security ───────────────────────────────────────────────────────
-- Without this every table is world-readable through the anon key.

alter table public.inventory_items enable row level security;
alter table public.routines        enable row level security;
alter table public.routine_items   enable row level security;

-- Inventory is private, always. It is never exposed by a share link.
drop policy if exists "own inventory" on public.inventory_items;
create policy "own inventory" on public.inventory_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own routines" on public.routines;
create policy "own routines" on public.routines
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Anyone may read a routine the owner has published.
drop policy if exists "public routines are readable" on public.routines;
create policy "public routines are readable" on public.routines
  for select using (is_public);

drop policy if exists "own routine items" on public.routine_items;
create policy "own routine items" on public.routine_items
  for all
  using (exists (
    select 1 from public.routines r
    where r.id = routine_id and r.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.routines r
    where r.id = routine_id and r.user_id = auth.uid()
  ));

drop policy if exists "items of public routines are readable" on public.routine_items;
create policy "items of public routines are readable" on public.routine_items
  for select using (exists (
    select 1 from public.routines r
    where r.id = routine_id and r.is_public
  ));

-- ── Shared view for public routines ──────────────────────────────────────────
-- A share page needs the product details of the items in a routine, but the
-- owner's inventory table is private. This view exposes exactly the columns a
-- shared look needs and nothing else — no user_id, no notes, no purchase date.

create or replace view public.shared_routine_items as
  select
    ri.routine_id,
    ri.step_order,
    ri.note,
    ii.brand,
    ii.product,
    ii.shade,
    ii.category,
    ii.hex,
    ii.url,
    ii.price_cents,
    ii.currency
  from public.routine_items ri
  join public.routines r on r.id = ri.routine_id and r.is_public
  left join public.inventory_items ii on ii.id = ri.inventory_item_id;

-- Views run with the definer's rights by default, which would bypass RLS on
-- the underlying tables. security_invoker keeps the caller's permissions.
alter view public.shared_routine_items set (security_invoker = on);

-- ── updated_at ───────────────────────────────────────────────────────────────

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists inventory_items_touch on public.inventory_items;
create trigger inventory_items_touch before update on public.inventory_items
  for each row execute function public.touch_updated_at();

drop trigger if exists routines_touch on public.routines;
create trigger routines_touch before update on public.routines
  for each row execute function public.touch_updated_at();
