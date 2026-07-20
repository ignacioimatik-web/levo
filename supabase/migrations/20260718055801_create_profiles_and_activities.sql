create extension if not exists pgcrypto;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  bike_name text,
  battery_capacity_wh integer check (battery_capacity_wh is null or battery_capacity_wh between 100 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null,
  title text not null check (char_length(title) between 1 and 120),
  sport_type text not null default 'ebike' check (sport_type in ('ebike', 'mtb')),
  started_at timestamptz not null,
  ended_at timestamptz not null,
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  moving_seconds integer not null default 0 check (moving_seconds >= 0),
  distance_m double precision not null default 0 check (distance_m >= 0),
  elevation_gain_m double precision not null default 0 check (elevation_gain_m >= 0),
  average_speed_kmh double precision not null default 0 check (average_speed_kmh >= 0),
  max_speed_kmh double precision not null default 0 check (max_speed_kmh >= 0),
  battery_start smallint check (battery_start is null or battery_start between 0 and 100),
  battery_end smallint check (battery_end is null or battery_end between 0 and 100),
  battery_capacity_wh integer check (battery_capacity_wh is null or battery_capacity_wh between 100 and 2000),
  assist_mode text check (assist_mode is null or assist_mode in ('eco', 'trail', 'turbo', 'smart')),
  energy_used_wh double precision check (energy_used_wh is null or energy_used_wh >= 0),
  route jsonb not null default '[]'::jsonb check (jsonb_typeof(route) = 'array'),
  privacy text not null default 'private' check (privacy in ('private', 'followers', 'public')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, client_id)
);

create index activities_user_started_idx on public.activities (user_id, started_at desc);

alter table public.profiles enable row level security;
alter table public.activities enable row level security;

create policy "Users can read own profile"
on public.profiles for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert own profile"
on public.profiles for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update own profile"
on public.profiles for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can read own activities"
on public.activities for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert own activities"
on public.activities for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update own activities"
on public.activities for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete own activities"
on public.activities for delete
to authenticated
using ((select auth.uid()) = user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger activities_set_updated_at
before update on public.activities
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
