-- Phase 1 (P2): Schema parity for tracking runtime expectations.
-- Additive + idempotent only.

BEGIN;

-- participants parity used by tracking runtime writes/reads.
ALTER TABLE public.participants
  ADD COLUMN IF NOT EXISTS status TEXT,
  ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_ping TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_location TEXT;

UPDATE public.participants
SET status = 'joined'
WHERE status IS NULL;

ALTER TABLE public.participants
  ALTER COLUMN status SET DEFAULT 'joined',
  ALTER COLUMN status SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'participants_status_check'
      AND conrelid = 'public.participants'::regclass
  ) THEN
    ALTER TABLE public.participants
      ADD CONSTRAINT participants_status_check
      CHECK (status IN ('joined', 'checked_in', 'active', 'completed'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_participants_ride_last_ping
  ON public.participants(ride_id, last_ping DESC);

CREATE INDEX IF NOT EXISTS idx_participants_status
  ON public.participants(status);

-- Compatibility view consumed by useLiveParticipants().
CREATE OR REPLACE VIEW public.participant_live_locations AS
SELECT
  p.ride_id,
  p.user_id,
  p.status,
  p.last_ping,
  p.checked_in_at,
  CASE
    WHEN parsed.coords IS NULL THEN NULL
    ELSE (parsed.coords[2])::double precision
  END AS latitude,
  CASE
    WHEN parsed.coords IS NULL THEN NULL
    ELSE (parsed.coords[1])::double precision
  END AS longitude
FROM public.participants p
LEFT JOIN LATERAL (
  SELECT regexp_match(COALESCE(p.last_location::text, ''), 'POINT\(([-0-9.]+) ([-0-9.]+)\)') AS coords
) AS parsed ON TRUE;

GRANT SELECT ON public.participant_live_locations TO authenticated;

-- ride_history parity (runtime already reads/writes this object).
CREATE TABLE IF NOT EXISTS public.ride_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source_ride_id UUID REFERENCES public.rides(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  title TEXT NOT NULL,
  discipline discipline_type NOT NULL DEFAULT 'ROAD',
  start_address TEXT,
  start_latitude DOUBLE PRECISION,
  start_longitude DOUBLE PRECISION,
  distance_km NUMERIC(6, 2),
  duration_minutes INTEGER,
  notes TEXT,
  mood_key TEXT,
  route_link TEXT,
  participant_count INTEGER,
  route_coordinates JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.ride_history
  ADD COLUMN IF NOT EXISTS owner_id UUID,
  ADD COLUMN IF NOT EXISTS source_ride_id UUID,
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS discipline discipline_type DEFAULT 'ROAD',
  ADD COLUMN IF NOT EXISTS start_address TEXT,
  ADD COLUMN IF NOT EXISTS start_latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS start_longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS distance_km NUMERIC(6, 2),
  ADD COLUMN IF NOT EXISTS duration_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS mood_key TEXT,
  ADD COLUMN IF NOT EXISTS route_link TEXT,
  ADD COLUMN IF NOT EXISTS participant_count INTEGER,
  ADD COLUMN IF NOT EXISTS route_coordinates JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE public.ride_history
SET route_coordinates = '[]'::jsonb
WHERE route_coordinates IS NULL;

ALTER TABLE public.ride_history
  ALTER COLUMN route_coordinates SET DEFAULT '[]'::jsonb,
  ALTER COLUMN route_coordinates SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT NOW(),
  ALTER COLUMN updated_at SET DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_ride_history_owner_started_at
  ON public.ride_history(owner_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_ride_history_source_ride_id
  ON public.ride_history(source_ride_id);

DROP TRIGGER IF EXISTS set_ride_history_updated_at ON public.ride_history;
CREATE TRIGGER set_ride_history_updated_at
  BEFORE UPDATE ON public.ride_history
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

ALTER TABLE public.ride_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ride history owner select" ON public.ride_history;
DROP POLICY IF EXISTS "Ride history owner insert" ON public.ride_history;
DROP POLICY IF EXISTS "Ride history owner update" ON public.ride_history;
DROP POLICY IF EXISTS "Ride history owner delete" ON public.ride_history;

CREATE POLICY "Ride history owner select"
  ON public.ride_history
  FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_id);

CREATE POLICY "Ride history owner insert"
  ON public.ride_history
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Ride history owner update"
  ON public.ride_history
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Ride history owner delete"
  ON public.ride_history
  FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ride_history TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'ride_history'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ride_history;
  END IF;
END;
$$;

COMMIT;
