-- Bike Me MVP hardening migration
-- Safe to run on a fresh Supabase project.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  CREATE TYPE ride_type AS ENUM ('PING', 'EVENT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE discipline_type AS ENUM ('ROAD', 'GRAVEL', 'MTB', 'CITY');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE participant_role AS ENUM ('HOST', 'RIDER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE ride_status AS ENUM ('ACTIVE', 'CANCELLED', 'COMPLETED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  display_name TEXT,
  avatar_url TEXT,
  bike_type TEXT[] DEFAULT '{}',
  level_desc TEXT,
  home_region TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.rides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type ride_type NOT NULL,
  status ride_status NOT NULL DEFAULT 'ACTIVE',
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  discipline discipline_type NOT NULL DEFAULT 'ROAD',
  pace_text TEXT,
  distance_km NUMERIC(5,1),
  route_link TEXT,
  max_participants INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT rides_title_length CHECK (char_length(title) BETWEEN 3 AND 120),
  CONSTRAINT rides_expiry_after_start CHECK (expires_at > start_time),
  CONSTRAINT rides_ping_expiry_window CHECK (
    type <> 'PING' OR expires_at <= (start_time + INTERVAL '8 hours')
  ),
  CONSTRAINT rides_latitude_range CHECK (latitude BETWEEN -90 AND 90),
  CONSTRAINT rides_longitude_range CHECK (longitude BETWEEN -180 AND 180),
  CONSTRAINT rides_distance_range CHECK (distance_km IS NULL OR (distance_km >= 0 AND distance_km <= 500)),
  CONSTRAINT rides_max_participants_range CHECK (
    max_participants IS NULL OR (max_participants BETWEEN 2 AND 200)
  )
);

CREATE TABLE IF NOT EXISTS public.participants (
  ride_id UUID NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role participant_role NOT NULL DEFAULT 'RIDER',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (ride_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_rides_status_expires_at ON public.rides(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_rides_start_time ON public.rides(start_time);
CREATE INDEX IF NOT EXISTS idx_rides_type_start_time ON public.rides(type, start_time);
CREATE INDEX IF NOT EXISTS idx_rides_lat_lng ON public.rides(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_participants_user_id ON public.participants(user_id);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

DROP TRIGGER IF EXISTS set_rides_updated_at ON public.rides;
CREATE TRIGGER set_rides_updated_at
  BEFORE UPDATE ON public.rides
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email, 'Rytter'))
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

CREATE OR REPLACE FUNCTION public.ensure_host_participant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.participants (ride_id, user_id, role)
  VALUES (NEW.id, NEW.host_id, 'HOST')
  ON CONFLICT (ride_id, user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS add_host_to_participants ON public.rides;
CREATE TRIGGER add_host_to_participants
  AFTER INSERT ON public.rides
  FOR EACH ROW EXECUTE PROCEDURE public.ensure_host_participant();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public read rides" ON public.rides;
DROP POLICY IF EXISTS "Public read participants" ON public.participants;
DROP POLICY IF EXISTS "Insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Insert rides" ON public.rides;
DROP POLICY IF EXISTS "Update own rides" ON public.rides;
DROP POLICY IF EXISTS "Delete own rides" ON public.rides;
DROP POLICY IF EXISTS "Join rides" ON public.participants;
DROP POLICY IF EXISTS "Leave rides" ON public.participants;

CREATE POLICY "Public read profiles"
  ON public.profiles
  FOR SELECT
  USING (true);

CREATE POLICY "Insert own profile"
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Public read rides"
  ON public.rides
  FOR SELECT
  USING (true);

CREATE POLICY "Insert rides"
  ON public.rides
  FOR INSERT
  WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Update own rides"
  ON public.rides
  FOR UPDATE
  USING (auth.uid() = host_id);

CREATE POLICY "Delete own rides"
  ON public.rides
  FOR DELETE
  USING (auth.uid() = host_id);

CREATE POLICY "Public read participants"
  ON public.participants
  FOR SELECT
  USING (true);

CREATE POLICY "Join rides"
  ON public.participants
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (
      role = 'RIDER'
      OR EXISTS (
        SELECT 1 FROM public.rides r
        WHERE r.id = ride_id AND r.host_id = auth.uid()
      )
    )
  );

CREATE POLICY "Leave rides"
  ON public.participants
  FOR DELETE
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.rides r
      WHERE r.id = ride_id AND r.host_id = auth.uid()
    )
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'rides'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.rides;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'participants'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.participants;
  END IF;
END;
$$;
