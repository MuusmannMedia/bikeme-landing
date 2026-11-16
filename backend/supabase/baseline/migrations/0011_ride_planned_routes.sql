-- Planned route persistence for imported/reused routes on planned rides.

CREATE TABLE IF NOT EXISTS public.ride_planned_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id UUID NOT NULL UNIQUE REFERENCES public.rides(id) ON DELETE CASCADE,
  route_coordinates JSONB NOT NULL,
  point_count INTEGER NOT NULL,
  source_type TEXT NOT NULL,
  source_filename TEXT,
  source_size_bytes INTEGER,
  bounds JSONB,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ride_planned_routes_point_count_range CHECK (point_count >= 2),
  CONSTRAINT ride_planned_routes_source_size_non_negative CHECK (
    source_size_bytes IS NULL OR source_size_bytes >= 0
  ),
  CONSTRAINT ride_planned_routes_coordinates_json_array CHECK (
    jsonb_typeof(route_coordinates) = 'array'
  )
);

CREATE INDEX IF NOT EXISTS idx_ride_planned_routes_created_by
  ON public.ride_planned_routes(created_by);

DROP TRIGGER IF EXISTS set_ride_planned_routes_updated_at ON public.ride_planned_routes;
CREATE TRIGGER set_ride_planned_routes_updated_at
  BEFORE UPDATE ON public.ride_planned_routes
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

ALTER TABLE public.ride_planned_routes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read planned routes via ride access" ON public.ride_planned_routes;
DROP POLICY IF EXISTS "Host inserts planned routes" ON public.ride_planned_routes;
DROP POLICY IF EXISTS "Host updates planned routes" ON public.ride_planned_routes;
DROP POLICY IF EXISTS "Host deletes planned routes" ON public.ride_planned_routes;

CREATE POLICY "Read planned routes via ride access"
  ON public.ride_planned_routes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.rides r
      WHERE r.id = ride_planned_routes.ride_id
    )
  );

CREATE POLICY "Host inserts planned routes"
  ON public.ride_planned_routes
  FOR INSERT
  WITH CHECK (
    auth.uid() = created_by
    AND EXISTS (
      SELECT 1
      FROM public.rides r
      WHERE r.id = ride_planned_routes.ride_id
        AND r.host_id = auth.uid()
    )
  );

CREATE POLICY "Host updates planned routes"
  ON public.ride_planned_routes
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.rides r
      WHERE r.id = ride_planned_routes.ride_id
        AND r.host_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = created_by
    AND EXISTS (
      SELECT 1
      FROM public.rides r
      WHERE r.id = ride_planned_routes.ride_id
        AND r.host_id = auth.uid()
    )
  );

CREATE POLICY "Host deletes planned routes"
  ON public.ride_planned_routes
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.rides r
      WHERE r.id = ride_planned_routes.ride_id
        AND r.host_id = auth.uid()
    )
  );
