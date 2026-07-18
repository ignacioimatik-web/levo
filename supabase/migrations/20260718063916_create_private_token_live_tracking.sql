create table public.live_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  share_token uuid not null default gen_random_uuid() unique,
  title text not null default 'Salida en directo' check (char_length(title) between 1 and 120),
  status text not null default 'active' check (status in ('active', 'ended')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  latitude double precision,
  longitude double precision,
  elevation_m double precision,
  distance_m double precision not null default 0 check (distance_m >= 0),
  battery_percent smallint check (battery_percent is null or battery_percent between 0 and 100),
  updated_at timestamptz not null default now()
);

create index live_sessions_user_started_idx on public.live_sessions (user_id, started_at desc);
create index live_sessions_share_token_idx on public.live_sessions (share_token);
alter table public.live_sessions enable row level security;

create policy "Owners can read live sessions"
on public.live_sessions for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Owners can create live sessions"
on public.live_sessions for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "Owners can update live sessions"
on public.live_sessions for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Owners can delete live sessions"
on public.live_sessions for delete to authenticated
using ((select auth.uid()) = user_id);

create policy "Token holders can read one live session"
on public.live_sessions for select to anon, authenticated
using (
  share_token::text = coalesce(
    nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-share-token',
    ''
  )
);

create trigger live_sessions_set_updated_at
before update on public.live_sessions
for each row execute function public.set_updated_at();
