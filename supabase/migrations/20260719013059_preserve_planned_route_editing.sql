alter table public.saved_routes
  add column routing_mode text not null default 'manual'
    check (routing_mode in ('mtb', 'ebike', 'manual')),
  add column control_points jsonb not null default '[]'::jsonb
    check (
      jsonb_typeof(control_points) = 'array'
      and jsonb_array_length(control_points) <= 2000
    ),
  add column reference jsonb
    check (reference is null or jsonb_typeof(reference) = 'object');

comment on column public.saved_routes.routing_mode is
  'Routing profile used to create an editable private route.';
comment on column public.saved_routes.control_points is
  'Bounded editable waypoints; the full routed geometry remains in route_points.';
comment on column public.saved_routes.reference is
  'Optional private personal-ride reference used for ghost pacing.';
