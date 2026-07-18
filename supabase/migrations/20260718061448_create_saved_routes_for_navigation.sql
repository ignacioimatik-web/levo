create table public.saved_routes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  track_ids text[] not null default '{}',
  distance_km double precision not null default 0 check (distance_km >= 0),
  elevation_gain_m double precision not null default 0 check (elevation_gain_m >= 0),
  elevation_loss_m double precision not null default 0 check (elevation_loss_m >= 0),
  estimated_time_min integer not null default 0 check (estimated_time_min >= 0),
  difficulty text not null default 'verde' check (difficulty in ('verde', 'azul', 'rojo', 'negro', 'doble-negro')),
  route_points jsonb not null default '[]'::jsonb check (jsonb_typeof(route_points) = 'array'),
  warnings text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index saved_routes_user_updated_idx on public.saved_routes (user_id, updated_at desc);
alter table public.saved_routes enable row level security;

create policy "Users can read own saved routes"
on public.saved_routes for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert own saved routes"
on public.saved_routes for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update own saved routes"
on public.saved_routes for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete own saved routes"
on public.saved_routes for delete to authenticated
using ((select auth.uid()) = user_id);

create trigger saved_routes_set_updated_at
before update on public.saved_routes
for each row execute function public.set_updated_at();
