alter table public.profiles
  add column if not exists rider_weight_kg numeric(5,2)
    check (rider_weight_kg is null or rider_weight_kg between 30 and 250),
  add column if not exists bike_weight_kg numeric(5,2)
    check (bike_weight_kg is null or bike_weight_kg between 5 and 60),
  add column if not exists wheel_size text
    check (wheel_size is null or char_length(wheel_size) between 2 and 20),
  add column if not exists front_tire_model text
    check (front_tire_model is null or char_length(front_tire_model) <= 120),
  add column if not exists rear_tire_model text
    check (rear_tire_model is null or char_length(rear_tire_model) <= 120),
  add column if not exists front_tire_pressure_bar numeric(4,2)
    check (front_tire_pressure_bar is null or front_tire_pressure_bar between 0.5 and 5),
  add column if not exists rear_tire_pressure_bar numeric(4,2)
    check (rear_tire_pressure_bar is null or rear_tire_pressure_bar between 0.5 and 5);

comment on column public.profiles.front_tire_pressure_bar is 'Initial pressure in bar before a ride.';
comment on column public.profiles.rear_tire_pressure_bar is 'Initial pressure in bar before a ride.';
