/* 
====================================================================
FILE 1: 01_users.sql
PURPOSE: Creates the 'users' table and automatically syncs it with Supabase Authentication (auth.users) so that every time someone registers, their profile is saved here.
==================================================================== 
*/

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT UNIQUE,
  aadhaar TEXT UNIQUE,
  occupation TEXT,
  image_url TEXT UNIQUE,
  role TEXT DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to read users" ON public.users;
CREATE POLICY "Allow authenticated users to read users" ON public.users
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow users to insert their own profile" ON public.users;
CREATE POLICY "Allow users to insert their own profile" ON public.users
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow users to update their own profile" ON public.users;
CREATE POLICY "Allow users to update their own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- Automatic User Sync Trigger
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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();



/* 
====================================================================
FILE 2: 02_events_masjids.sql
PURPOSE: Creates the tables for Events and Masjids so admins can add upcoming events and list registered mosques.
==================================================================== 
*/

-- Masjids Table
CREATE TABLE IF NOT EXISTS public.masjids (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  address TEXT,
  timings_json JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL
);

ALTER TABLE public.masjids ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to read masjids" ON public.masjids;
CREATE POLICY "Allow authenticated users to read masjids" ON public.masjids FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow master admins to manage masjids" ON public.masjids;
CREATE POLICY "Allow master admins to manage masjids" ON public.masjids FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND (role = 'master_admin' OR role = 'admin'))
);

-- Create events table
CREATE TABLE IF NOT EXISTS public.events (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  speaker_name TEXT,
  description TEXT,
  date_time TIMESTAMP WITH TIME ZONE NOT NULL,
  image_url TEXT,
  masjid_id UUID REFERENCES public.masjids(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to read events" ON public.events;
CREATE POLICY "Allow authenticated users to read events" ON public.events FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow admins to manage events" ON public.events;
CREATE POLICY "Allow admins to manage events" ON public.events FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND (role = 'admin' OR role = 'master_admin'))
);

-- Cache Refresh
NOTIFY pgrst, 'reload schema';



/* 
====================================================================
FILE 3: 03_donations_settings.sql
PURPOSE: Creates tables to store app settings (like Bank details) and tracks the user donations along with their screenshots.
==================================================================== 
*/

-- App Settings Table
CREATE TABLE IF NOT EXISTS public.app_settings (
  id TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default settings
INSERT INTO public.app_settings (id, value) VALUES 
('donation_details', '{"qr_url": "", "bank_name": "", "account_no": "", "ifsc": ""}'::jsonb)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to read settings" ON public.app_settings;
CREATE POLICY "Allow authenticated users to read settings" ON public.app_settings
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow master admins to manage settings" ON public.app_settings;
CREATE POLICY "Allow master admins to manage settings" ON public.app_settings
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'master_admin'));

-- Donations Table
CREATE TABLE IF NOT EXISTS public.donations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL,
  transaction_id TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, verified, rejected
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;

-- Users can insert their own donations
DROP POLICY IF EXISTS "Allow users to insert their own donations" ON public.donations;
CREATE POLICY "Allow users to insert their own donations" ON public.donations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can read their own donations
DROP POLICY IF EXISTS "Allow users to read their own donations" ON public.donations;
CREATE POLICY "Allow users to read their own donations" ON public.donations
  FOR SELECT USING (auth.uid() = user_id);

-- Master Admins can read/update all donations
DROP POLICY IF EXISTS "Allow master admins to manage donations" ON public.donations;
CREATE POLICY "Allow master admins to manage donations" ON public.donations
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'master_admin'));



/* 
====================================================================
FILE 4: 04_questions.sql
PURPOSE: Creates the table for the Q&A feature where users can ask questions and admins can reply (now supports images too!).
==================================================================== 
*/

CREATE TABLE IF NOT EXISTS public.questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  text TEXT NOT NULL,
  "askedBy" UUID REFERENCES public.users(id) ON DELETE CASCADE,
  answer TEXT,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add column if it doesn't exist (for existing tables)
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS image_url TEXT;

ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read questions
DROP POLICY IF EXISTS "Allow authenticated users to read questions" ON public.questions;
CREATE POLICY "Allow authenticated users to read questions" ON public.questions
  FOR SELECT USING (true);

-- Users can insert their own questions
DROP POLICY IF EXISTS "Allow users to insert questions" ON public.questions;
CREATE POLICY "Allow users to insert questions" ON public.questions
  FOR INSERT WITH CHECK (auth.uid()::text = "askedBy"::text);

-- Admins can update questions (to add answers)
DROP POLICY IF EXISTS "Allow admins to update questions" ON public.questions;
CREATE POLICY "Allow admins to update questions" ON public.questions
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.users WHERE id::text = auth.uid()::text AND (role = 'admin' OR role = 'master_admin'))
  );

-- Admins can delete questions
DROP POLICY IF EXISTS "Allow admins to delete questions" ON public.questions;
CREATE POLICY "Allow admins to delete questions" ON public.questions
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.users WHERE id::text = auth.uid()::text AND (role = 'admin' OR role = 'master_admin'))
  );

NOTIFY pgrst, 'reload schema';



/* 
====================================================================
FILE 5: 05_password_requests.sql
PURPOSE: Creates a table to handle "Forgot Password" requests from Admins when they are logged out. Master Admin resolves these requests.
==================================================================== 
*/

CREATE TABLE IF NOT EXISTS public.admin_password_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  photo_url TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'resolved'
  request_type TEXT DEFAULT 'password_reset',
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.admin_password_requests ENABLE ROW LEVEL SECURITY;

-- Anyone can insert a request
DROP POLICY IF EXISTS "Allow anyone to insert requests" ON public.admin_password_requests;
CREATE POLICY "Allow anyone to insert requests" ON public.admin_password_requests
  FOR INSERT WITH CHECK (true);

-- Only master_admin can view requests
DROP POLICY IF EXISTS "Allow master admins to read requests" ON public.admin_password_requests;
CREATE POLICY "Allow master admins to read requests" ON public.admin_password_requests
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'master_admin')
  );

-- Only master_admin can update requests
DROP POLICY IF EXISTS "Allow master admins to update requests" ON public.admin_password_requests;
CREATE POLICY "Allow master admins to update requests" ON public.admin_password_requests
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'master_admin')
  );



/* 
====================================================================
FILE 6: 06_storage.sql
PURPOSE: Sets up the Supabase Storage Bucket ('images') allowing users to upload event banners, donation screenshots, etc.
==================================================================== 
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'images', 
  'images', 
  true, 
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET 
  public = true,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
-- (storage.objects already has RLS enabled by default)
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'images' );

DROP POLICY IF EXISTS "Authenticated users can upload images" ON storage.objects;
CREATE POLICY "Authenticated users can upload images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'images' );

DROP POLICY IF EXISTS "Authenticated users can update images" ON storage.objects;
CREATE POLICY "Authenticated users can update images"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'images' );

DROP POLICY IF EXISTS "Authenticated users can delete images" ON storage.objects;
CREATE POLICY "Authenticated users can delete images"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'images' );



/* 
====================================================================
FILES 7 & 8: 07_masjid_committee.sql & 08_masjid_image.sql
PURPOSE: Adds 'committee_json' and 'image_url' columns to existing masjids table so users can see mosque committees and photos.
==================================================================== 
*/

ALTER TABLE public.masjids 
ADD COLUMN IF NOT EXISTS committee_json JSONB DEFAULT '{}'::jsonb;

ALTER TABLE public.masjids 
ADD COLUMN IF NOT EXISTS image_url TEXT;



/* 
====================================================================
FILE 9: 09_app_settings.sql
PURPOSE: Master App Settings table where the Master Admin can change the App Name and the Logo Image from the UI.
==================================================================== 
*/

ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS app_name TEXT DEFAULT 'Jamait App';
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Insert default row (id is TEXT from earlier schema)
INSERT INTO public.app_settings (id, app_name, logo_url, value) 
VALUES ('1', 'Jamait App', '', '{}'::jsonb) 
ON CONFLICT (id) DO NOTHING;

-- Allow Master Admin to update
DROP POLICY IF EXISTS "Allow master admin to update settings" ON public.app_settings;
CREATE POLICY "Allow master admin to update settings" ON public.app_settings
    FOR UPDATE USING (
      EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'master_admin')
    );



/* 
====================================================================
FILE 10: 10_system_logs.sql
PURPOSE: Tracks every action an admin takes (like deleting users, managing events) to keep the system secure and auditable.
==================================================================== 
*/

CREATE TABLE IF NOT EXISTS public.system_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  admin_email TEXT,
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow admins to insert logs" ON public.system_logs;
CREATE POLICY "Allow admins to insert logs" ON public.system_logs
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id::text = auth.uid()::text AND (role = 'admin' OR role = 'master_admin'))
  );

DROP POLICY IF EXISTS "Allow master_admin to read logs" ON public.system_logs;
CREATE POLICY "Allow master_admin to read logs" ON public.system_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id::text = auth.uid()::text AND role = 'master_admin')
  );



/* 
====================================================================
FILES 11 & 12: 11_donations_screenshot.sql & 12_add_image_url_to_events.sql
PURPOSE: Adds screenshot storage capabilities for the donations and event banners. (Cache gets reloaded here).
==================================================================== 
*/

ALTER TABLE public.donations 
ADD COLUMN IF NOT EXISTS screenshot_url TEXT;

ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS image_url TEXT;


/* 
====================================================================
FILE 13: 13_user_requests.sql
PURPOSE: Creates the 'user_requests' table so users can send requests (with images) to the master admin.
==================================================================== 
*/

CREATE TABLE IF NOT EXISTS public.user_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  image_url TEXT,
  status TEXT DEFAULT 'pending', -- 'pending', 'resolved', 'rejected'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.user_requests ENABLE ROW LEVEL SECURITY;

-- Users can read their own requests
DROP POLICY IF EXISTS "Allow users to read their own requests" ON public.user_requests;
CREATE POLICY "Allow users to read their own requests" ON public.user_requests
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own requests
DROP POLICY IF EXISTS "Allow users to insert their own requests" ON public.user_requests;
CREATE POLICY "Allow users to insert their own requests" ON public.user_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Master Admins can read/update all requests
DROP POLICY IF EXISTS "Allow master admins to manage requests" ON public.user_requests;
CREATE POLICY "Allow master admins to manage requests" ON public.user_requests
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'master_admin'));

NOTIFY pgrst, 'reload schema';



/* 
====================================================================
FILE 14: 14_admin_masjid_assignment.sql
PURPOSE: Assign a local Admin to a specific Masjid so they can only manage their assigned Masjid.
==================================================================== 
*/

ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS assigned_masjid_id UUID REFERENCES public.masjids(id) ON DELETE SET NULL;

-- Update RLS for masjids so local admins can only manage their assigned masjid
DROP POLICY IF EXISTS "Allow master admins to manage masjids" ON public.masjids;
DROP POLICY IF EXISTS "Allow admins to manage their assigned masjids" ON public.masjids;
CREATE POLICY "Allow admins to manage their assigned masjids" ON public.masjids FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'master_admin') 
  OR 
  (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin' AND assigned_masjid_id = masjids.id))
);

NOTIFY pgrst, 'reload schema';

/* 
====================================================================
FILE 15: 15_board_members.sql
PURPOSE: Creates the board_members table for dynamically managing the top slider (Ameer, Treasurer, Secretary, etc.)
==================================================================== 
*/

CREATE TABLE IF NOT EXISTS public.board_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  designation TEXT NOT NULL,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.board_members ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read board members
DROP POLICY IF EXISTS "Allow authenticated users to read board_members" ON public.board_members;
CREATE POLICY "Allow authenticated users to read board_members" ON public.board_members
  FOR SELECT USING (true);

-- Only master_admin can manage board members (Insert/Update/Delete)
DROP POLICY IF EXISTS "Allow master admins to manage board_members" ON public.board_members;
CREATE POLICY "Allow master admins to manage board_members" ON public.board_members
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'master_admin'));

-- Insert the default Ameer if the table is empty
INSERT INTO public.board_members (name, designation, image_url)
SELECT 'Khazi Muttahir Jamaie', 'Ameer of the Sheheri Jamat E Ahle Hadees', ''
WHERE NOT EXISTS (SELECT 1 FROM public.board_members LIMIT 1);

NOTIFY pgrst, 'reload schema';

/* 
====================================================================
FILE 16: 16_ulamas_bayans.sql
PURPOSE: Creates the tables for Ulamas and Bayans so admins can add Ulamas and their YouTube bayans.
==================================================================== 
*/

CREATE TABLE IF NOT EXISTS public.ulamas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.ulamas ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read ulamas
DROP POLICY IF EXISTS "Allow authenticated users to read ulamas" ON public.ulamas;
CREATE POLICY "Allow authenticated users to read ulamas" ON public.ulamas
  FOR SELECT USING (true);

-- Only admins can manage ulamas
DROP POLICY IF EXISTS "Allow admins to manage ulamas" ON public.ulamas;
CREATE POLICY "Allow admins to manage ulamas" ON public.ulamas
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND (role = 'admin' OR role = 'master_admin')));

-- Bayans Table
CREATE TABLE IF NOT EXISTS public.bayans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ulama_id UUID REFERENCES public.ulamas(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  youtube_link TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.bayans ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read bayans
DROP POLICY IF EXISTS "Allow authenticated users to read bayans" ON public.bayans;
CREATE POLICY "Allow authenticated users to read bayans" ON public.bayans
  FOR SELECT USING (true);

-- Only admins can manage bayans
DROP POLICY IF EXISTS "Allow admins to manage bayans" ON public.bayans;
CREATE POLICY "Allow admins to manage bayans" ON public.bayans
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND (role = 'admin' OR role = 'master_admin')));

NOTIFY pgrst, 'reload schema';
-- 14_chat_system.sql
-- Add approve/reject functionality to admin requests and create a chat messages table

-- 1. Add reject reason to admin requests
ALTER TABLE public.admin_password_requests ADD COLUMN IF NOT EXISTS reject_reason TEXT;

-- 2. Create Support Messages table for WhatsApp-style chat
CREATE TABLE IF NOT EXISTS public.support_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  text TEXT,
  image_url TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow users to read their own messages" ON public.support_messages;
DROP POLICY IF EXISTS "Allow users to send messages" ON public.support_messages;
DROP POLICY IF EXISTS "Allow admins to update messages" ON public.support_messages;

-- Users can read messages if they are the sender or the receiver
CREATE POLICY "Allow users to read their own messages" ON public.support_messages
  FOR SELECT USING (
    auth.uid()::text = sender_id::text OR auth.uid()::text = receiver_id::text
  );

-- Users can insert messages if they are the sender
CREATE POLICY "Allow users to send messages" ON public.support_messages
  FOR INSERT WITH CHECK (
    auth.uid()::text = sender_id::text
  );

-- Admins can update messages (to mark as read)
CREATE POLICY "Allow admins to update messages" ON public.support_messages
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.users WHERE id::text = auth.uid()::text AND (role = 'admin' OR role = 'master_admin'))
  );

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';



/*
====================================================================
FILE: OTPs
PURPOSE: Creates the table for OTP verification instead of using in-memory store.
====================================================================
*/

CREATE TABLE IF NOT EXISTS public.otps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone TEXT NOT NULL,
  otp TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.otps ENABLE ROW LEVEL SECURITY;

-- Admins can view/manage OTPs if needed, or backend service role
DROP POLICY IF EXISTS "Allow backend to manage OTPs" ON public.otps;
CREATE POLICY "Allow backend to manage OTPs" ON public.otps
  USING (true); -- Usually restricted to service role in practice

NOTIFY pgrst, 'reload schema';

