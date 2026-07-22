-- Create a security definer function to query bike_profiles bypassing RLS
CREATE OR REPLACE FUNCTION get_my_bike_profiles()
RETURNS SETOF bike_profiles
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM bike_profiles WHERE user_id = auth.uid() ORDER BY updated_at DESC;
$$;

-- Insert bike profile (bypasses RLS for INSERT)
CREATE OR REPLACE FUNCTION insert_bike_profile(
  p_profile_name TEXT,
  p_rider_weight_kg NUMERIC,
  p_bike_weight_kg NUMERIC,
  p_bike_model TEXT,
  p_wheel_front TEXT,
  p_wheel_rear TEXT,
  p_tire_model_front TEXT,
  p_tire_model_rear TEXT,
  p_tire_width_front_inch NUMERIC,
  p_tire_width_rear_inch NUMERIC,
  p_initial_pressure_front_bar NUMERIC,
  p_initial_pressure_rear_bar NUMERIC,
  p_tubeless BOOLEAN
)
RETURNS SETOF bike_profiles
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO bike_profiles (
    user_id, profile_name, rider_weight_kg, bike_weight_kg, bike_model,
    wheel_front, wheel_rear, tire_model_front, tire_model_rear,
    tire_width_front_inch, tire_width_rear_inch,
    initial_pressure_front_bar, initial_pressure_rear_bar, tubeless
  ) VALUES (
    auth.uid(), p_profile_name, p_rider_weight_kg, p_bike_weight_kg, p_bike_model,
    p_wheel_front, p_wheel_rear, p_tire_model_front, p_tire_model_rear,
    p_tire_width_front_inch, p_tire_width_rear_inch,
    p_initial_pressure_front_bar, p_initial_pressure_rear_bar, p_tubeless
  )
  RETURNING *;
$$;

-- Update bike profile (bypasses RLS for UPDATE)
CREATE OR REPLACE FUNCTION update_bike_profile(
  p_id UUID,
  p_profile_name TEXT,
  p_rider_weight_kg NUMERIC,
  p_bike_weight_kg NUMERIC,
  p_bike_model TEXT,
  p_wheel_front TEXT,
  p_wheel_rear TEXT,
  p_tire_model_front TEXT,
  p_tire_model_rear TEXT,
  p_tire_width_front_inch NUMERIC,
  p_tire_width_rear_inch NUMERIC,
  p_initial_pressure_front_bar NUMERIC,
  p_initial_pressure_rear_bar NUMERIC,
  p_tubeless BOOLEAN
)
RETURNS SETOF bike_profiles
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE bike_profiles SET
    profile_name = p_profile_name,
    rider_weight_kg = p_rider_weight_kg,
    bike_weight_kg = p_bike_weight_kg,
    bike_model = p_bike_model,
    wheel_front = p_wheel_front,
    wheel_rear = p_wheel_rear,
    tire_model_front = p_tire_model_front,
    tire_model_rear = p_tire_model_rear,
    tire_width_front_inch = p_tire_width_front_inch,
    tire_width_rear_inch = p_tire_width_rear_inch,
    initial_pressure_front_bar = p_initial_pressure_front_bar,
    initial_pressure_rear_bar = p_initial_pressure_rear_bar,
    tubeless = p_tubeless,
    updated_at = now()
  WHERE id = p_id AND user_id = auth.uid()
  RETURNING *;
$$;

-- Delete bike profile (bypasses RLS for DELETE)
CREATE OR REPLACE FUNCTION delete_bike_profile(p_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM bike_profiles WHERE id = p_id AND user_id = auth.uid();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count > 0;
END;
$$;
