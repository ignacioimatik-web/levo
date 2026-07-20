create table public.maintenance_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null,
  name text not null check (char_length(name) between 1 and 80),
  category text not null check (category in ('drivetrain','brakes','suspension','tires','motor','other')),
  interval_km numeric(8,1) not null check (interval_km between 10 and 10000),
  last_service_odometer_km numeric(10,1) not null default 0 check (last_service_odometer_km >= 0),
  last_service_at timestamptz,
  service_count integer not null default 0 check (service_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, client_id)
);

alter table public.maintenance_items enable row level security;

create policy "Users can read own maintenance items"
on public.maintenance_items for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert own maintenance items"
on public.maintenance_items for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update own maintenance items"
on public.maintenance_items for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete own maintenance items"
on public.maintenance_items for delete
to authenticated
using ((select auth.uid()) = user_id);

create trigger maintenance_items_set_updated_at
before update on public.maintenance_items
for each row execute function public.set_updated_at();

revoke all on table public.maintenance_items from anon;
grant select, insert, update, delete on table public.maintenance_items to authenticated;
