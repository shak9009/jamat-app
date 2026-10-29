-- ==============================================================
-- SQL MIGRATION: Add occupation column to public.users table
-- Run this in your Supabase Dashboard > SQL Editor:
-- ==============================================================

-- 1. Add occupation column to public.users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS occupation TEXT;

-- 2. Update trigger to automatically sync occupation on registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, phone, aadhaar, occupation, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    NULLIF(COALESCE(NEW.raw_user_meta_data->>'phone', ''), ''),
    NULLIF(COALESCE(NEW.raw_user_meta_data->>'aadhaar', ''), ''),
    NULLIF(COALESCE(NEW.raw_user_meta_data->>'occupation', ''), ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'user')
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    phone = EXCLUDED.phone,
    aadhaar = EXCLUDED.aadhaar,
    occupation = EXCLUDED.occupation;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
