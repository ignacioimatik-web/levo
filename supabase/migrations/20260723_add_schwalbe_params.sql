-- Add new columns for Schwalbe-inspired pressure calculation
ALTER TABLE bike_profiles 
  ADD COLUMN IF NOT EXISTS rim_width_mm INTEGER DEFAULT 30,
  ADD COLUMN IF NOT EXISTS riding_style TEXT DEFAULT 'moderado',
  ADD COLUMN IF NOT EXISTS rider_experience TEXT DEFAULT 'intermedio',
  ADD COLUMN IF NOT EXISTS terrain_type TEXT DEFAULT 'mixto',
  ADD COLUMN IF NOT EXISTS ground_condition TEXT DEFAULT 'mixto',
  ADD COLUMN IF NOT EXISTS casing_type TEXT DEFAULT 'estandar';
