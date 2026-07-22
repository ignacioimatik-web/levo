-- Simple recreation of RPC functions (no new columns needed)
CREATE OR REPLACE FUNCTION insert_bike_profile(
  p_profile_name TEXT,
  p_rider_weight_kg NUMERIC,
  p_bike_weight_kg NUMERIC,
  p_bike_model TEXT DEFAULT '',
  p_wheel_front TEXT DEFAULT '27.5',
  p_wheel_rear TEXT DEFAULT '27.5',
  p_tire_model_front TEXT DEFAULT '',
  p_tire_model_rear TEXT DEFAULT '',
  p_tire_width_front_inch NUMERIC DEFAULT 2.3,
  p_tire_width_rear_inch NUMERIC DEFAULT 2.3,
  p_initial_pressure_front_bar NUMERIC DEFAULT 1.8,
  p_initial_pressure_rear_bar NUMERIC DEFAULT 2.0,
  p_tubeless BOOLEAN DEFAULT true
)
RETURNS SETOF bike_profiles
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  INSERT INTO bike_profiles (user_id, profile_name, rider_weight_kg, bike_weight_kg, bike_model, wheel_front, wheel_rear, tire_model_front, tire_model_rear, tire_width_front_inch, tire_width_rear_inch, initial_pressure_front_bar, initial_pressure_rear_bar, tubeless)
  VALUES (auth.uid(), p_profile_name, p_rider_weight_kg, p_bike_weight_kg, p_bike_model, p_wheel_front, p_wheel_rear, p_tire_model_front, p_tire_model_rear, p_tire_width_front_inch, p_tire_width_rear_inch, p_initial_pressure_front_bar, p_initial_pressure_rear_bar, p_tubeless)
  RETURNING *;
$$;

DROP FUNCTION IF EXISTS update_bike_profile;
CREATE OR REPLACE FUNCTION update_bike_profile(
  p_id UUID,
  p_profile_name TEXT DEFAULT NULL,
  p_rider_weight_kg NUMERIC DEFAULT NULL,
  p_bike_weight_kg NUMERIC DEFAULT NULL,
  p_bike_model TEXT DEFAULT NULL,
  p_wheel_front TEXT DEFAULT NULL,
  p_wheel_rear TEXT DEFAULT NULL,
  p_tire_model_front TEXT DEFAULT NULL,
  p_tire_model_rear TEXT DEFAULT NULL,
  p_tire_width_front_inch NUMERIC DEFAULT NULL,
  p_tire_width_rear_inch NUMERIC DEFAULT NULL,
  p_initial_pressure_front_bar NUMERIC DEFAULT NULL,
  p_initial_pressure_rear_bar NUMERIC DEFAULT NULL,
  p_tubeless BOOLEAN DEFAULT NULL
)
RETURNS SETOF bike_profiles
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE bike_profiles SET
    profile_name = COALESCE(p_profile_name, profile_name),
    rider_weight_kg = COALESCE(p_rider_weight_kg, rider_weight_kg),
    bike_weight_kg = COALESCE(p_bike_weight_kg, bike_weight_kg),
    bike_model = COALESCE(p_bike_model, bike_model),
    wheel_front = COALESCE(p_wheel_front, wheel_front),
    wheel_rear = COALESCE(p_wheel_rear, wheel_rear),
    tire_model_front = COALESCE(p_tire_model_front, tire_model_front),
    tire_model_rear = COALESCE(p_tire_model_rear, tire_model_rear),
    tire_width_front_inch = COALESCE(p_tire_width_front_inch, tire_width_front_inch),
    tire_width_rear_inch = COALESCE(p_tire_width_rear_inch, tire_width_rear_inch),
    initial_pressure_front_bar = COALESCE(p_initial_pressure_front_bar, initial_pressure_front_bar),
    initial_pressure_rear_bar = COALESCE(p_initial_pressure_rear_bar, initial_pressure_rear_bar),
    tubeless = COALESCE(p_tubeless, tubeless),
    updated_at = now()
  WHERE id = p_id AND user_id = auth.uid()
  RETURNING *;
$$;
