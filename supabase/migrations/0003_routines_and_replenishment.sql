-- Add skincare routine semantics while preserving existing shareable looks.
alter table public.routines
  add column if not exists routine_type text not null default 'look'
    check (routine_type in ('look', 'morning', 'evening', 'weekly'));

alter table public.routine_items
  add column if not exists step_name text,
  add column if not exists notes text;

create table if not exists public.replenishment_alerts (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.inventory_items (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  estimated_lifespan_days integer check (estimated_lifespan_days is null or estimated_lifespan_days > 0),
  flagged_low boolean not null default false,
  flagged_empty boolean not null default false,
  flagged_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id)
);

create index if not exists replenishment_alerts_user_idx
  on public.replenishment_alerts (user_id, flagged_at desc);

alter table public.replenishment_alerts enable row level security;
drop policy if exists "own replenishment alerts" on public.replenishment_alerts;
create policy "own replenishment alerts" on public.replenishment_alerts
  for all using (
    auth.uid() = user_id and exists (
      select 1 from public.inventory_items i
      where i.id = product_id and i.user_id = auth.uid()
    )
  ) with check (
    auth.uid() = user_id and exists (
      select 1 from public.inventory_items i
      where i.id = product_id and i.user_id = auth.uid()
    )
  );

drop trigger if exists replenishment_alerts_touch on public.replenishment_alerts;
create trigger replenishment_alerts_touch before update on public.replenishment_alerts
  for each row execute function public.touch_updated_at();
