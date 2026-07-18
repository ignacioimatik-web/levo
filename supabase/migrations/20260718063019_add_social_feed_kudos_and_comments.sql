alter table public.activities
add column route_preview jsonb not null default '[]'::jsonb
check (jsonb_typeof(route_preview) = 'array');

create policy "Anyone can read public profiles"
on public.profiles for select
to anon, authenticated
using (true);

create policy "Anyone can read public activities"
on public.activities for select
to anon, authenticated
using (privacy = 'public');

create table public.activity_kudos (
  activity_id uuid not null references public.activities(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (activity_id, user_id)
);

create index activity_kudos_activity_idx on public.activity_kudos (activity_id, created_at desc);
alter table public.activity_kudos enable row level security;

create policy "Anyone can read kudos on public activities"
on public.activity_kudos for select
to anon, authenticated
using (exists (
  select 1 from public.activities
  where activities.id = activity_kudos.activity_id
    and (activities.privacy = 'public' or activities.user_id = (select auth.uid()))
));

create policy "Users can give own kudos"
on public.activity_kudos for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.activities
    where activities.id = activity_kudos.activity_id
      and activities.privacy = 'public'
  )
);

create policy "Users can remove own kudos"
on public.activity_kudos for delete
to authenticated
using ((select auth.uid()) = user_id);

create table public.activity_comments (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index activity_comments_activity_idx on public.activity_comments (activity_id, created_at asc);
alter table public.activity_comments enable row level security;

create policy "Anyone can read comments on public activities"
on public.activity_comments for select
to anon, authenticated
using (exists (
  select 1 from public.activities
  where activities.id = activity_comments.activity_id
    and (activities.privacy = 'public' or activities.user_id = (select auth.uid()))
));

create policy "Users can add own comments"
on public.activity_comments for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.activities
    where activities.id = activity_comments.activity_id
      and activities.privacy = 'public'
  )
);

create policy "Users can update own comments"
on public.activity_comments for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete own comments"
on public.activity_comments for delete
to authenticated
using ((select auth.uid()) = user_id);

create trigger activity_comments_set_updated_at
before update on public.activity_comments
for each row execute function public.set_updated_at();
