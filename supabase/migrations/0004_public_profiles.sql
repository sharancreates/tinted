-- Username based profiles. Public reads go through narrow views so profile
-- and inventory base rows remain owner-only, including their internal IDs.
create table if not exists public.public_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  username text not null unique check (username = lower(username) and username ~ '^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$'),
  display_name text not null,
  bio text check (bio is null or char_length(bio) <= 160),
  monk_tone smallint check (monk_tone is null or monk_tone between 1 and 10),
  undertone text,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.inventory_items
  add column if not exists is_public boolean not null default false;

alter table public.public_profiles enable row level security;
drop policy if exists "own public profile" on public.public_profiles;
create policy "own public profile" on public.public_profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop trigger if exists public_profiles_touch on public.public_profiles;
create trigger public_profiles_touch before update on public.public_profiles
  for each row execute function public.touch_updated_at();

-- Existing public routine policies exposed full base rows through the anon
-- API. Replace them with curated views for both old look links and profiles.
drop policy if exists "public routines are readable" on public.routines;
drop policy if exists "items of public routines are readable" on public.routine_items;

create or replace view public.shared_routines
with (security_barrier = true, security_invoker = false) as
  select id, title, description, occasion, is_public, share_slug, created_at
  from public.routines
  where is_public;

create or replace view public.shared_routine_items
with (security_barrier = true, security_invoker = false) as
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

create or replace view public.public_profile_details
with (security_barrier = true, security_invoker = false) as
  select username, display_name, bio, monk_tone, undertone
  from public.public_profiles
  where is_public;

create or replace view public.public_profile_products
with (security_barrier = true, security_invoker = false) as
  select
    pp.username,
    i.brand,
    i.product,
    i.shade,
    i.category,
    i.hex,
    i.image_url,
    i.url
  from public.public_profiles pp
  join public.inventory_items i on i.user_id = pp.user_id and i.is_public
  where pp.is_public;

create or replace view public.public_profile_routine_steps
with (security_barrier = true, security_invoker = false) as
  select
    pp.username,
    r.id as routine_id,
    r.title as routine_title,
    r.routine_type,
    ri.step_order,
    coalesce(ri.step_name, i.category, 'Product') as step_name,
    case when i.is_public then i.brand end as brand,
    case when i.is_public then i.product end as product,
    case when i.is_public then i.shade end as shade,
    case when i.is_public then i.category end as category,
    case when i.is_public then i.hex end as hex,
    case when i.is_public then i.image_url end as image_url
  from public.public_profiles pp
  join public.routines r on r.user_id = pp.user_id and r.is_public
  join public.routine_items ri on ri.routine_id = r.id
  left join public.inventory_items i on i.id = ri.inventory_item_id
  where pp.is_public;

grant select on public.shared_routines, public.shared_routine_items,
  public.public_profile_details, public.public_profile_products,
  public.public_profile_routine_steps to anon, authenticated;
