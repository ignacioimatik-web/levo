-- Private five-rider beta: keep the social schema for a reversible future
-- launch, but remove it from the Data API and make every ride owner-only.

update public.activities
set privacy = 'private'
where privacy <> 'private';

revoke all on table
  public.activity_kudos,
  public.activity_comments,
  public.user_follows,
  public.notifications
from public, anon, authenticated;

revoke all on table public.profiles from public, anon, authenticated;
grant select, insert, update on table public.profiles to authenticated;

drop policy if exists "Anyone can read public profiles" on public.profiles;
drop policy if exists "Users can read own profile" on public.profiles;

create policy "Users can read own profile"
on public.profiles for select
to authenticated
using ((select auth.uid()) = user_id);

revoke all on table public.activities from public, anon, authenticated;
grant select, insert, update, delete on table public.activities to authenticated;

drop policy if exists "Anyone can read public activities" on public.activities;
drop policy if exists "Anonymous riders can read public activities" on public.activities;
drop policy if exists "Authenticated riders can read visible activities" on public.activities;
drop policy if exists "Users can read own activities" on public.activities;

create policy "Users can read own activities"
on public.activities for select
to authenticated
using ((select auth.uid()) = user_id);

revoke all on table public.segment_efforts from public, anon, authenticated;
grant select, insert, delete on table public.segment_efforts to authenticated;

drop policy if exists "Public activity efforts or own efforts are visible"
  on public.segment_efforts;
drop policy if exists "Anonymous riders can read public segment efforts"
  on public.segment_efforts;
drop policy if exists "Authenticated riders can read visible segment efforts"
  on public.segment_efforts;

create policy "Users can read own segment efforts"
on public.segment_efforts for select
to authenticated
using ((select auth.uid()) = user_id);
