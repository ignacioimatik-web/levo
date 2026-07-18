-- Make Data API exposure explicit. RLS remains the row-level boundary, while
-- grants define the smallest operation set each client role can reach.
revoke all on table
  public.profiles,
  public.activities,
  public.saved_routes,
  public.activity_kudos,
  public.activity_comments,
  public.live_sessions,
  public.maintenance_items,
  public.segments,
  public.segment_efforts,
  public.user_follows,
  public.notifications
from public, anon, authenticated;

grant select on table public.profiles to anon;
grant select, insert, update on table public.profiles to authenticated;

grant select on table public.activities to anon;
grant select, insert, update, delete on table public.activities to authenticated;

grant select, insert, update, delete on table public.saved_routes to authenticated;

grant select on table public.activity_kudos to anon;
grant select, insert, delete on table public.activity_kudos to authenticated;

grant select on table public.activity_comments to anon;
grant select, insert, update, delete on table public.activity_comments to authenticated;

grant select on table public.live_sessions to anon;
grant select, insert, update, delete on table public.live_sessions to authenticated;

grant select, insert, update, delete on table public.maintenance_items to authenticated;

grant select on table public.segments to anon, authenticated;

grant select on table public.segment_efforts to anon;
grant select, insert, delete on table public.segment_efforts to authenticated;

grant select on table public.user_follows to anon;
grant select, insert, delete on table public.user_follows to authenticated;

grant select, update, delete on table public.notifications to authenticated;

revoke execute on function public.set_updated_at()
from public, anon, authenticated;

create index if not exists activity_comments_user_id_idx
  on public.activity_comments(user_id);

create index if not exists activity_kudos_user_id_idx
  on public.activity_kudos(user_id);

drop policy if exists "Owners can read live sessions"
  on public.live_sessions;

drop policy if exists "Token holders can read one live session"
  on public.live_sessions;

create policy "Token holders can read one live session"
on public.live_sessions for select
to anon
using (
  share_token::text = (
    select coalesce(
      nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-share-token',
      ''
    )
  )
);

create policy "Owners or token holders can read live sessions"
on public.live_sessions for select
to authenticated
using (
  user_id = (select auth.uid())
  or share_token::text = (
    select coalesce(
      nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-share-token',
      ''
    )
  )
);

-- New public objects stay private until a migration deliberately exposes them.
alter default privileges for role postgres in schema public
  revoke select, insert, update, delete, truncate, references, trigger
  on tables from anon, authenticated;

alter default privileges for role postgres in schema public
  revoke usage, select, update on sequences from anon, authenticated;

alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;
