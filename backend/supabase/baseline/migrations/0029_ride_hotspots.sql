-- Ride Hotspots: Supabase-managed fixed meeting places for planned EVENT rides.
-- Hotspot departures remain normal rides; rides.hotspot_id is optional metadata.

BEGIN;

CREATE TABLE IF NOT EXISTS public.ride_hotspots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  address TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  region_label TEXT NOT NULL,
  default_discipline TEXT,
  default_distance_km NUMERIC,
  default_speed_kmh NUMERIC,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ride_hotspots_name_length CHECK (char_length(trim(name)) BETWEEN 2 AND 140),
  CONSTRAINT ride_hotspots_region_label_length CHECK (char_length(trim(region_label)) BETWEEN 2 AND 120),
  CONSTRAINT ride_hotspots_latitude_range CHECK (latitude BETWEEN -90 AND 90),
  CONSTRAINT ride_hotspots_longitude_range CHECK (longitude BETWEEN -180 AND 180),
  CONSTRAINT ride_hotspots_default_discipline_check CHECK (
    default_discipline IS NULL OR default_discipline IN ('ROAD', 'GRAVEL', 'MTB', 'CITY')
  ),
  CONSTRAINT ride_hotspots_default_distance_range CHECK (
    default_distance_km IS NULL OR (default_distance_km > 0 AND default_distance_km <= 1000)
  ),
  CONSTRAINT ride_hotspots_default_speed_range CHECK (
    default_speed_kmh IS NULL OR (default_speed_kmh > 0 AND default_speed_kmh <= 120)
  )
);

CREATE INDEX IF NOT EXISTS idx_ride_hotspots_is_active
  ON public.ride_hotspots(is_active);

CREATE INDEX IF NOT EXISTS idx_ride_hotspots_region_label
  ON public.ride_hotspots(region_label);

CREATE INDEX IF NOT EXISTS idx_ride_hotspots_sort_order
  ON public.ride_hotspots(sort_order);

CREATE INDEX IF NOT EXISTS idx_ride_hotspots_lat_lng
  ON public.ride_hotspots(latitude, longitude);

DROP TRIGGER IF EXISTS set_ride_hotspots_updated_at ON public.ride_hotspots;
CREATE TRIGGER set_ride_hotspots_updated_at
  BEFORE UPDATE ON public.ride_hotspots
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

ALTER TABLE public.ride_hotspots ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.ride_hotspots FROM PUBLIC;
REVOKE ALL ON TABLE public.ride_hotspots FROM anon, authenticated;
GRANT SELECT ON TABLE public.ride_hotspots TO authenticated;
GRANT ALL ON TABLE public.ride_hotspots TO service_role;

DROP POLICY IF EXISTS "Authenticated users read active ride hotspots" ON public.ride_hotspots;
CREATE POLICY "Authenticated users read active ride hotspots"
  ON public.ride_hotspots
  FOR SELECT
  TO authenticated
  USING (is_active = TRUE);

ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS hotspot_id UUID REFERENCES public.ride_hotspots(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_rides_hotspot_id
  ON public.rides(hotspot_id);

COMMIT;
