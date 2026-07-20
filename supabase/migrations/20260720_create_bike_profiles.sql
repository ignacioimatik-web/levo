-- Create bike_profiles table for Alerta Presión (v2: multiple profiles per user)
-- Run this in your Supabase SQL editor (Dashboard > SQL Editor)

-- Drop the old table if exists (data will be lost — backup first if needed)
-- If you have existing data, just run ALTER statements instead
DROP TABLE IF EXISTS bike_profiles;

CREATE TABLE bike_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_name TEXT DEFAULT 'Mi perfil',
  rider_weight_kg NUMERIC(5,1) NOT NULL,
  bike_weight_kg NUMERIC(5,1) NOT NULL DEFAULT 20,
  bike_model TEXT DEFAULT '',
  wheel_front TEXT DEFAULT '27.5' CHECK (wheel_front IN ('29', '27.5', '26')),
  wheel_rear TEXT DEFAULT '27.5' CHECK (wheel_rear IN ('29', '27.5', '26')),
  tire_model_front TEXT DEFAULT '',
  tire_model_rear TEXT DEFAULT '',
  tire_width_front_inch NUMERIC(3,1) DEFAULT 2.3,
  tire_width_rear_inch NUMERIC(3,1) DEFAULT 2.3,
  initial_pressure_front_bar NUMERIC(4,2) DEFAULT 1.8,
  initial_pressure_rear_bar NUMERIC(4,2) DEFAULT 2.0,
  tubeless BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast user-specific queries
CREATE INDEX idx_bike_profiles_user_id ON bike_profiles(user_id);

-- Enable Row Level Security
ALTER TABLE bike_profiles ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own bike profiles"
  ON bike_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own bike profiles"
  ON bike_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own bike profiles"
  ON bike_profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own bike profiles"
  ON bike_profiles FOR DELETE
  USING (auth.uid() = user_id);
