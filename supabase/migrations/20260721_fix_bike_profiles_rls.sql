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
