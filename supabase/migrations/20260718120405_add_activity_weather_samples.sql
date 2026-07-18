alter table public.activities
  add column if not exists weather_samples jsonb not null default '[]'::jsonb;

alter table public.activities
  drop constraint if exists activities_weather_samples_array_check;

alter table public.activities
  add constraint activities_weather_samples_array_check
  check (
    jsonb_typeof(weather_samples) = 'array'
    and jsonb_array_length(weather_samples) <= 200
  );

comment on column public.activities.weather_samples is
  'Bounded AEMET-derived weather snapshots captured during a ride; inferred station data, not on-bike sensor readings.';
