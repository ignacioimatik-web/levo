-- Create bike_profiles table for Alerta Presión
-- Run this in your Supabase SQL editor (Dashboard > SQL Editor)

CREATE TABLE IF NOT EXISTS bike_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rider_weight_kg NUMERIC(5,1) NOT NULL,
  bike_weight_kg NUMERIC(5,1) NOT NULL,
  bike_model TEXT DEFAULT '',
  wheel_type TEXT DEFAULT '29' CHECK (wheel_type IN ('29', '27.5', '29-front-27.5-rear', '26')),
  tire_model_front TEXT DEFAULT '',
  tire_model_rear TEXT DEFAULT '',
  tire_width_front_mm NUMERIC(4,1) DEFAULT 60,
  tire_width_rear_mm NUMERIC(4,1) DEFAULT 60,
  initial_pressure_front_bar NUMERIC(4,2) DEFAULT 1.8,
  initial_pressure_rear_bar NUMERIC(4,2) DEFAULT 2.0,
  tubeless BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable Row Level Security
ALTER TABLE bike_profiles ENABLE ROW LEVEL SECURITY;

-- Policy: users can only see their own profile
CREATE POLICY "Users can view own bike profile"
  ON bike_profiles FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: users can insert their own profile
CREATE POLICY "Users can insert own bike profile"
  ON bike_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: users can update their own profile
CREATE POLICY "Users can update own bike profile"
  ON bike_profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy: users can delete their own profile
CREATE POLICY "Users can delete own bike profile"
  ON bike_profiles FOR DELETE
  USING (auth.uid() = user_id);
