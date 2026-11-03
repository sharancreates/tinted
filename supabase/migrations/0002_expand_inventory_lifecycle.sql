-- Extend the existing private inventory into a product shelf.
-- Existing rows remain valid and finished products retain their old state.

alter table public.inventory_items
  add column if not exists status text not null default 'using'
    check (status in ('using', 'backup', 'wishlist', 'finished', 'destash', 'panning')),
  add column if not exists image_url text,
  add column if not exists purchase_price_cents integer
    check (purchase_price_cents is null or purchase_price_cents >= 0),
  add column if not exists purchase_date date,
  add column if not exists opened_date date,
  add column if not exists is_repurchase boolean not null default false;

update public.inventory_items
set status = case when is_finished then 'finished' else 'using' end
where status = 'using' and is_finished;

create index if not exists inventory_items_user_status_idx
  on public.inventory_items (user_id, status, created_at desc);

-- Keep the legacy boolean in sync for older clients and the existing share UI.
create or replace function public.sync_inventory_finished_status()
returns trigger language plpgsql as $$
begin
  if new.status is distinct from old.status then
    new.is_finished := (new.status = 'finished');
  elsif new.is_finished is distinct from old.is_finished then
    new.status := case when new.is_finished then 'finished' else 'using' end;
  end if;
  return new;
end $$;

drop trigger if exists inventory_items_sync_finished on public.inventory_items;
create trigger inventory_items_sync_finished
  before update on public.inventory_items
  for each row execute function public.sync_inventory_finished_status();
