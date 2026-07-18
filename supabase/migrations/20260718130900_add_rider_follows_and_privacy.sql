alter table public.profiles
  add column if not exists bio text null
    check (bio is null or char_length(bio) <= 240),
  add column if not exists home_region text null
    check (home_region is null or char_length(home_region) <= 80),
  add column if not exists rider_type text not null default 'both'
    check (rider_type in ('ebike', 'mtb', 'both'));

create table if not exists public.user_follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create index user_follows_following_id_idx
  on public.user_follows(following_id, created_at desc);

alter table public.user_follows enable row level security;

create policy "Follow relationships are public"
on public.user_follows for select
to anon, authenticated
using (true);

create policy "Riders can follow from their own account"
on public.user_follows for insert
to authenticated
with check ((select auth.uid()) = follower_id);

create policy "Riders can unfollow from their own account"
on public.user_follows for delete
to authenticated
using ((select auth.uid()) = follower_id);

grant select on public.user_follows to anon, authenticated;
grant insert, delete on public.user_follows to authenticated;

drop policy if exists "Anyone can read public activities" on public.activities;
drop policy if exists "Users can read own activities" on public.activities;

create policy "Anonymous riders can read public activities"
on public.activities for select
to anon
using (privacy = 'public');

create policy "Authenticated riders can read visible activities"
on public.activities for select
to authenticated
using (
  user_id = (select auth.uid())
  or privacy = 'public'
  or (
    privacy = 'followers'
    and exists (
      select 1
      from public.user_follows
      where user_follows.follower_id = (select auth.uid())
        and user_follows.following_id = activities.user_id
    )
  )
);

drop policy if exists "Anyone can read kudos on public activities" on public.activity_kudos;
drop policy if exists "Users can give own kudos" on public.activity_kudos;

create policy "Anonymous riders can read public kudos"
on public.activity_kudos for select
to anon
using (
  exists (
    select 1 from public.activities
    where activities.id = activity_kudos.activity_id
      and activities.privacy = 'public'
  )
);

create policy "Authenticated riders can read visible kudos"
on public.activity_kudos for select
to authenticated
using (
  exists (
    select 1 from public.activities
    where activities.id = activity_kudos.activity_id
      and (
        activities.user_id = (select auth.uid())
        or activities.privacy = 'public'
        or (
          activities.privacy = 'followers'
          and exists (
            select 1 from public.user_follows
            where user_follows.follower_id = (select auth.uid())
              and user_follows.following_id = activities.user_id
          )
        )
      )
  )
);

create policy "Riders can give kudos to visible activities"
on public.activity_kudos for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.activities
    where activities.id = activity_kudos.activity_id
      and (
        activities.user_id = (select auth.uid())
        or activities.privacy = 'public'
        or (
          activities.privacy = 'followers'
          and exists (
            select 1 from public.user_follows
            where user_follows.follower_id = (select auth.uid())
              and user_follows.following_id = activities.user_id
          )
        )
      )
  )
);

drop policy if exists "Anyone can read comments on public activities" on public.activity_comments;
drop policy if exists "Users can add own comments" on public.activity_comments;

create policy "Anonymous riders can read public comments"
on public.activity_comments for select
to anon
using (
  exists (
    select 1 from public.activities
    where activities.id = activity_comments.activity_id
      and activities.privacy = 'public'
  )
);

create policy "Authenticated riders can read visible comments"
on public.activity_comments for select
to authenticated
using (
  exists (
    select 1 from public.activities
    where activities.id = activity_comments.activity_id
      and (
        activities.user_id = (select auth.uid())
        or activities.privacy = 'public'
        or (
          activities.privacy = 'followers'
          and exists (
            select 1 from public.user_follows
            where user_follows.follower_id = (select auth.uid())
              and user_follows.following_id = activities.user_id
          )
        )
      )
  )
);

create policy "Riders can comment on visible activities"
on public.activity_comments for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.activities
    where activities.id = activity_comments.activity_id
      and (
        activities.user_id = (select auth.uid())
        or activities.privacy = 'public'
        or (
          activities.privacy = 'followers'
          and exists (
            select 1 from public.user_follows
            where user_follows.follower_id = (select auth.uid())
              and user_follows.following_id = activities.user_id
          )
        )
      )
  )
);

drop policy if exists "Public activity efforts or own efforts are visible"
  on public.segment_efforts;

create policy "Anonymous riders can read public segment efforts"
on public.segment_efforts for select
to anon
using (
  exists (
    select 1 from public.activities
    where activities.id = segment_efforts.activity_id
      and activities.privacy = 'public'
  )
);

create policy "Authenticated riders can read visible segment efforts"
on public.segment_efforts for select
to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1 from public.activities
    where activities.id = segment_efforts.activity_id
      and (
        activities.privacy = 'public'
        or (
          activities.privacy = 'followers'
          and exists (
            select 1 from public.user_follows
            where user_follows.follower_id = (select auth.uid())
              and user_follows.following_id = activities.user_id
          )
        )
      )
  )
);

drop policy if exists "Users can read own profile" on public.profiles;
