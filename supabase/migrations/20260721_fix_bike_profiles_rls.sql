-- Fix RLS policies for bike_profiles
-- Run this in Supabase SQL Editor if migration doesn't apply automatically

-- First ensure RLS is enabled
ALTER TABLE bike_profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (safe to run multiple times)
DROP POLICY IF EXISTS "Users can view own bike profiles" ON bike_profiles;
DROP POLICY IF EXISTS "Users can insert own bike profiles" ON bike_profiles;
DROP POLICY IF EXISTS "Users can update own bike profiles" ON bike_profiles;
DROP POLICY IF EXISTS "Users can delete own bike profiles" ON bike_profiles;
DROP POLICY IF EXISTS "Enable read for own profiles" ON bike_profiles;
DROP POLICY IF EXISTS "Enable insert for own profiles" ON bike_profiles;
DROP POLICY IF EXISTS "Enable update for own profiles" ON bike_profiles;
DROP POLICY IF EXISTS "Enable delete for own profiles" ON bike_profiles;

-- Grant base table permissions (required even with RLS — policies further restrict)
GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON bike_profiles TO authenticated;
GRANT SELECT ON bike_profiles TO anon;

-- Recreate with simpler, more explicit names
CREATE POLICY "Enable read for own profiles"
  ON bike_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Enable insert for own profiles"
  ON bike_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Enable update for own profiles"
  ON bike_profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Enable delete for own profiles"
  ON bike_profiles FOR DELETE
  USING (auth.uid() = user_id);
