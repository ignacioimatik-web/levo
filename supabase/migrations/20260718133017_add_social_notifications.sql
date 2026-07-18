create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('follow', 'kudo', 'comment')),
  activity_id uuid null references public.activities(id) on delete cascade,
  comment_id uuid null references public.activity_comments(id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at timestamptz null,
  check (recipient_id <> actor_id),
  check (
    (type = 'follow' and activity_id is null and comment_id is null)
    or (type = 'kudo' and activity_id is not null and comment_id is null)
    or (type = 'comment' and activity_id is not null and comment_id is not null)
  )
);

create index notifications_recipient_created_idx
  on public.notifications(recipient_id, created_at desc);

create index notifications_recipient_unread_idx
  on public.notifications(recipient_id, created_at desc)
  where read_at is null;

alter table public.notifications enable row level security;

create policy "Riders can read their notifications"
on public.notifications for select
to authenticated
using ((select auth.uid()) = recipient_id);

create policy "Riders can mark their notifications"
on public.notifications for update
to authenticated
using ((select auth.uid()) = recipient_id)
with check ((select auth.uid()) = recipient_id);

create policy "Riders can delete their notifications"
on public.notifications for delete
to authenticated
using ((select auth.uid()) = recipient_id);

grant select, update, delete on public.notifications to authenticated;

create or replace function public.notify_new_follow()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications (recipient_id, actor_id, type)
  values (new.following_id, new.follower_id, 'follow');
  return new;
end;
$$;

create or replace function public.notify_new_kudo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  activity_owner uuid;
begin
  select activities.user_id
  into activity_owner
  from public.activities
  where activities.id = new.activity_id;

  if activity_owner is not null and activity_owner <> new.user_id then
    insert into public.notifications (
      recipient_id, actor_id, type, activity_id
    )
    values (
      activity_owner, new.user_id, 'kudo', new.activity_id
    );
  end if;
  return new;
end;
$$;

create or replace function public.notify_new_comment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  activity_owner uuid;
begin
  select activities.user_id
  into activity_owner
  from public.activities
  where activities.id = new.activity_id;

  if activity_owner is not null and activity_owner <> new.user_id then
    insert into public.notifications (
      recipient_id, actor_id, type, activity_id, comment_id
    )
    values (
      activity_owner, new.user_id, 'comment', new.activity_id, new.id
    );
  end if;
  return new;
end;
$$;

create trigger create_follow_notification
after insert on public.user_follows
for each row execute function public.notify_new_follow();

create trigger create_kudo_notification
after insert on public.activity_kudos
for each row execute function public.notify_new_kudo();

create trigger create_comment_notification
after insert on public.activity_comments
for each row execute function public.notify_new_comment();

do $$
begin
  if exists (
    select 1 from pg_catalog.pg_publication
    where pubname = 'supabase_realtime'
  ) and not exists (
    select 1 from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    execute 'alter publication supabase_realtime add table public.notifications';
  end if;
end;
$$;
