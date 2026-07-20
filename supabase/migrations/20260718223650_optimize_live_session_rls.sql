drop policy if exists "Token holders can read one live session"
  on public.live_sessions;

drop policy if exists "Owners or token holders can read live sessions"
  on public.live_sessions;

create policy "Token holders can read one live session"
on public.live_sessions for select
to anon
using (
  share_token::text = coalesce(
    nullif(
      (select current_setting('request.headers', true)),
      ''
    )::jsonb ->> 'x-share-token',
    ''
  )
);

create policy "Owners or token holders can read live sessions"
on public.live_sessions for select
to authenticated
using (
  user_id = (select auth.uid())
  or share_token::text = coalesce(
    nullif(
      (select current_setting('request.headers', true)),
      ''
    )::jsonb ->> 'x-share-token',
    ''
  )
);
