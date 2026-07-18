create index notifications_actor_idx
  on public.notifications(actor_id);

create index notifications_activity_idx
  on public.notifications(activity_id)
  where activity_id is not null;

create index notifications_comment_idx
  on public.notifications(comment_id)
  where comment_id is not null;
