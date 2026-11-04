-- Product shade catalogue for /find-shade.
--
-- Public reference data: anyone may read it, nobody writes it from the
-- client. New products arrive through migrations like this one.
--
-- Seed: the 40 Fenty Beauty Pro Filt'r Soft Matte Longwear shades Tinted
-- already matches against (backend/data/shades.json). Those hex values are
-- approximations of the product colour, not manufacturer data, and the app
-- says so wherever it shows them.

create table if not exists public.product_shades (
  id uuid primary key default gen_random_uuid(),
  brand text not null check (length(brand) between 1 and 120),
  product_name text not null check (length(product_name) between 1 and 200),
  shade_name text not null check (length(shade_name) between 1 and 80),
  shade_hex text not null check (shade_hex ~ '^#[0-9a-f]{6}$'),
  undertone text check (undertone in ('warm', 'neutral', 'cool', 'olive')),
  created_at timestamptz not null default now(),
  unique (brand, product_name, shade_name)
);

create index if not exists product_shades_lookup
  on public.product_shades (lower(brand), lower(product_name));

alter table public.product_shades enable row level security;

drop policy if exists "product shades are public" on public.product_shades;
create policy "product shades are public"
  on public.product_shades for select
  to anon, authenticated
  using (true);

grant select on public.product_shades to anon, authenticated;

insert into public.product_shades (brand, product_name, shade_name, shade_hex, undertone) values
  ('Fenty Beauty', 'Pro Filt''r Soft Matte Longwear Foundation', '100W', '#f5d2ae', 'warm'),
  ('Fenty Beauty', 'Pro Filt''r Soft Matte Longwear Foundation', '100N', '#f4d4ba', 'neutral'),
  ('Fenty Beauty', 'Pro Filt''r Soft Matte Longwear Foundation', '105W', '#f2ceaa', 'warm'),
  ('Fenty Beauty', 'Pro Filt''r Soft Matte Longwear Foundation', '110N', '#f0caa8', 'neutral'),
  ('Fenty Beauty', 'Pro Filt''r Soft Matte Longwear Foundation', '110W', '#eec89e', 'warm'),
  ('Fenty Beauty', 'Pro Filt''r Soft Matte Longwear Foundation', '115N', '#edc6a2', 'neutral'),
  ('Fenty Beauty', 'Pro Filt''r Soft Matte Longwear Foundation', '120N', '#ebc4a0', 'neutral'),
  ('Fenty Beauty', 'Pro Filt''r Soft Matte Longwear Foundation', '120C', '#e8c4a6', 'cool'),
  ('Fenty Beauty', 'Pro Filt''r Soft Matte Longwear Foundation', '125N', '#e8bf96', 'neutral'),
  ('Fenty Beauty', 'Pro Filt''r Soft Matte Longwear Foundation', '130C', '#e4bca0', 'cool'),
  ('Fenty Beauty', 'Pro Filt''r Soft Matte Longwear Foundation', '130W', '#e0b888', 'warm'),
  ('Fenty Beauty', 'Pro Filt''r Soft Matte Longwear Foundation', '140N', '#dcb486', 'neutral'),
  ('Fenty Beauty', 'Pro Filt''r Soft Matte Longwear Foundation', '140W', '#d8ae80', 'warm'),
  ('Fenty Beauty', 'Pro Filt''r Soft Matte Longwear Foundation', '145N', '#d4a87a', 'neutral'),
  ('Fenty Beauty', 'Pro Filt''r Soft Matte Longwear Foundation', '150N', '#d0a478', 'neutral'),
  ('Fenty Beauty', 'Pro Filt''r Soft Matte Longwear Foundation', '150W', '#cca072', 'warm'),
  ('Fenty Beauty', 'Pro Filt''r Soft Matte Longwear Foundation', '155N', '#c89868', 'neutral'),
  ('Fenty Beauty', 'Pro Filt''r Soft Matte Longwear Foundation', '160N', '#c49464', 'neutral'),
  ('Fenty Beauty', 'Pro Filt''r Soft Matte Longwear Foundation', '165C', '#c29268', 'cool'),
  ('Fenty Beauty', 'Pro Filt''r Soft Matte Longwear Foundation', '185N', '#bc8860', 'neutral'),
  ('Fenty Beauty', 'Pro Filt''r Soft Matte Longwear Foundation', '190N', '#b27854', 'neutral'),
  ('Fenty Beauty', 'Pro Filt''r Soft Matte Longwear Foundation', '200W', '#ae7450', 'warm'),
  ('Fenty Beauty', 'Pro Filt''r Soft Matte Longwear Foundation', '200N', '#ac724e', 'neutral'),
  ('Fenty Beauty', 'Pro Filt''r Soft Matte Longwear Foundation', '210N', '#a46c48', 'neutral'),
  ('Fenty Beauty', 'Pro Filt''r Soft Matte Longwear Foundation', '220N', '#986240', 'neutral'),
  ('Fenty Beauty', 'Pro Filt''r Soft Matte Longwear Foundation', '220W', '#94603e', 'warm'),
  ('Fenty Beauty', 'Pro Filt''r Soft Matte Longwear Foundation', '240N', '#8a5a34', 'neutral'),
  ('Fenty Beauty', 'Pro Filt''r Soft Matte Longwear Foundation', '240W', '#885832', 'warm'),
  ('Fenty Beauty', 'Pro Filt''r Soft Matte Longwear Foundation', '260N', '#784c28', 'neutral'),
  ('Fenty Beauty', 'Pro Filt''r Soft Matte Longwear Foundation', '260W', '#744826', 'warm'),
  ('Fenty Beauty', 'Pro Filt''r Soft Matte Longwear Foundation', '290N', '#683e20', 'neutral'),
  ('Fenty Beauty', 'Pro Filt''r Soft Matte Longwear Foundation', '300N', '#60381a', 'neutral'),
  ('Fenty Beauty', 'Pro Filt''r Soft Matte Longwear Foundation', '300W', '#5c3216', 'warm'),
  ('Fenty Beauty', 'Pro Filt''r Soft Matte Longwear Foundation', '310N', '#562c10', 'neutral'),
  ('Fenty Beauty', 'Pro Filt''r Soft Matte Longwear Foundation', '310W', '#52280c', 'warm'),
  ('Fenty Beauty', 'Pro Filt''r Soft Matte Longwear Foundation', '370N', '#481e06', 'neutral'),
  ('Fenty Beauty', 'Pro Filt''r Soft Matte Longwear Foundation', '380N', '#3c1604', 'neutral'),
  ('Fenty Beauty', 'Pro Filt''r Soft Matte Longwear Foundation', '390N', '#361202', 'neutral'),
  ('Fenty Beauty', 'Pro Filt''r Soft Matte Longwear Foundation', '420N', '#2c1002', 'neutral'),
  ('Fenty Beauty', 'Pro Filt''r Soft Matte Longwear Foundation', '490N', '#221008', 'neutral')
on conflict (brand, product_name, shade_name) do nothing;
