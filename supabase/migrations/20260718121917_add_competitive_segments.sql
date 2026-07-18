create table if not exists public.segments (
  id text primary key,
  name text not null check (char_length(name) between 1 and 80),
  route_name text not null check (char_length(route_name) between 1 and 120),
  route_slug text not null check (char_length(route_slug) between 1 and 120),
  region text not null check (char_length(region) between 1 and 120),
  type text not null check (type in ('climb', 'descent')),
  distance_m integer not null check (distance_m between 100 and 20000),
  elevation_delta_m integer not null,
  average_grade_pct numeric(5, 1) not null check (average_grade_pct between -60 and 60),
  checkpoints jsonb not null check (
    jsonb_typeof(checkpoints) = 'array'
    and jsonb_array_length(checkpoints) between 3 and 20
  ),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.segments enable row level security;

create policy "Active segments are public"
on public.segments for select
to anon, authenticated
using (active = true);

grant select on public.segments to anon, authenticated;

create table if not exists public.segment_efforts (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  segment_id text not null references public.segments(id) on delete restrict,
  sport_type text not null check (sport_type in ('ebike', 'mtb')),
  elapsed_seconds integer not null check (elapsed_seconds between 10 and 7200),
  started_at timestamptz not null,
  ended_at timestamptz not null check (ended_at > started_at),
  distance_m integer not null check (distance_m between 100 and 20000),
  average_speed_kmh numeric(5, 1) not null check (average_speed_kmh > 0 and average_speed_kmh <= 100),
  match_quality numeric(3, 2) not null check (match_quality between 0 and 1),
  created_at timestamptz not null default now(),
  unique (activity_id, segment_id)
);

create index segment_efforts_user_id_idx
  on public.segment_efforts(user_id);

create index segment_efforts_leaderboard_idx
  on public.segment_efforts(segment_id, sport_type, elapsed_seconds, started_at);

alter table public.segment_efforts enable row level security;

create policy "Public activity efforts or own efforts are visible"
on public.segment_efforts for select
to anon, authenticated
using (
  (select auth.uid()) = user_id
  or exists (
    select 1
    from public.activities
    where activities.id = segment_efforts.activity_id
      and activities.privacy = 'public'
  )
);

create policy "Riders can insert efforts for their activities"
on public.segment_efforts for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.activities
    where activities.id = segment_efforts.activity_id
      and activities.user_id = (select auth.uid())
  )
);

create policy "Riders can delete efforts from their activities"
on public.segment_efforts for delete
to authenticated
using (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.activities
    where activities.id = segment_efforts.activity_id
      and activities.user_id = (select auth.uid())
  )
);

grant select on public.segment_efforts to anon, authenticated;
grant insert, delete on public.segment_efforts to authenticated;

insert into public.segments (
  id, name, route_name, route_slug, region, type, distance_m,
  elevation_delta_m, average_grade_pct, checkpoints
)
values
  (
    'garumba-gigante-west-descent', 'Gigante Oeste', 'Garumba Gigante',
    'garumba-gigante', 'Morella · Garumba', 'descent', 1403, -252, -17.9,
    '[{"latitude":40.648394,"longitude":-0.164286},{"latitude":40.646118,"longitude":-0.168837},{"latitude":40.644075,"longitude":-0.173592}]'::jsonb
  ),
  (
    'garumba-gigante-final-climb', 'Muro de Garumba', 'Garumba Gigante',
    'garumba-gigante', 'Morella · Garumba', 'climb', 1411, 225, 15.9,
    '[{"latitude":40.649303,"longitude":-0.191672},{"latitude":40.646467,"longitude":-0.190116},{"latitude":40.642334,"longitude":-0.187091}]'::jsonb
  ),
  (
    'coronel-perdido-vertical', 'Coronel Vertical', 'Coronel Perdido',
    'coronel-perdido', 'Els Ports · Perdido', 'descent', 1402, -241, -17.2,
    '[{"latitude":40.574189,"longitude":0.07309},{"latitude":40.58039,"longitude":0.068957},{"latitude":40.582723,"longitude":0.069173}]'::jsonb
  ),
  (
    'coronel-perdido-approach', 'Aproximación al Coronel', 'Coronel Perdido',
    'coronel-perdido', 'Els Ports · Perdido', 'climb', 1416, 152, 10.7,
    '[{"latitude":40.60304,"longitude":0.02794},{"latitude":40.601089,"longitude":0.021656},{"latitude":40.599256,"longitude":0.013841}]'::jsonb
  ),
  (
    'santets-gegants-east-descent', 'Gegants Este', 'Santets Gegants',
    'santets-gegants', 'Morella · Santets', 'descent', 1412, -180, -12.8,
    '[{"latitude":40.639931,"longitude":-0.107349},{"latitude":40.637917,"longitude":-0.108488},{"latitude":40.633249,"longitude":-0.103594}]'::jsonb
  ),
  (
    'hard-pertxos-wall', 'Muro Pertxòs', 'Hard Pertxòs',
    'hard-pertxos', 'Els Ports · Pertxòs', 'climb', 1404, 222, 15.8,
    '[{"latitude":40.556796,"longitude":-0.223541},{"latitude":40.558502,"longitude":-0.230861},{"latitude":40.560692,"longitude":-0.236159}]'::jsonb
  ),
  (
    'hard-pertxos-north-descent', 'Pertxòs Norte', 'Hard Pertxòs',
    'hard-pertxos', 'Els Ports · Pertxòs', 'descent', 1409, -215, -15.3,
    '[{"latitude":40.564373,"longitude":-0.237221},{"latitude":40.569806,"longitude":-0.233714},{"latitude":40.574176,"longitude":-0.229499}]'::jsonb
  ),
  (
    'todo-perdido-south-climb', 'Sur del Perdido', 'Todo Perdido',
    'todo-perdido', 'Els Ports · Perdido', 'climb', 1402, 165, 11.8,
    '[{"latitude":40.612167,"longitude":0.046217},{"latitude":40.615134,"longitude":0.042834},{"latitude":40.617467,"longitude":0.038433}]'::jsonb
  )
on conflict (id) do update set
  name = excluded.name,
  route_name = excluded.route_name,
  route_slug = excluded.route_slug,
  region = excluded.region,
  type = excluded.type,
  distance_m = excluded.distance_m,
  elevation_delta_m = excluded.elevation_delta_m,
  average_grade_pct = excluded.average_grade_pct,
  checkpoints = excluded.checkpoints,
  active = true;
