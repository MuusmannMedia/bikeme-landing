-- Enforce public/private ride visibility at the database layer.

BEGIN;

CREATE OR REPLACE FUNCTION public.can_read_ride(target_ride_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.rides r
      WHERE r.id = target_ride_id
        AND (
          COALESCE(r.visibility, 'public') = 'public'
          OR r.host_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.ride_invites ri
            WHERE ri.ride_id = r.id
              AND ri.invitee_id = auth.uid()
          )
          OR EXISTS (
            SELECT 1
            FROM public.participants p
            WHERE p.ride_id = r.id
              AND p.user_id = auth.uid()
          )
        )
    );
$$;

CREATE OR REPLACE FUNCTION public.can_join_ride(target_ride_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.rides r
      WHERE r.id = target_ride_id
        AND (
          COALESCE(r.visibility, 'public') = 'public'
          OR r.host_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.ride_invites ri
            WHERE ri.ride_id = r.id
              AND ri.invitee_id = auth.uid()
          )
          OR EXISTS (
            SELECT 1
            FROM public.participants p
            WHERE p.ride_id = r.id
              AND p.user_id = auth.uid()
          )
        )
    );
$$;

DROP POLICY IF EXISTS "Public read rides" ON public.rides;
DROP POLICY IF EXISTS "Read rides by visibility or relation" ON public.rides;
CREATE POLICY "Read rides by visibility or relation"
  ON public.rides
  FOR SELECT
  TO authenticated
  USING (public.can_read_ride(id));

DROP POLICY IF EXISTS "Public read participants" ON public.participants;
DROP POLICY IF EXISTS "Participants can read via ride access" ON public.participants;
CREATE POLICY "Participants can read via ride access"
  ON public.participants
  FOR SELECT
  TO authenticated
  USING (public.can_read_ride(ride_id));

DROP POLICY IF EXISTS "Participants can insert own membership" ON public.participants;
CREATE POLICY "Participants can insert own membership"
  ON public.participants
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND public.can_join_ride(ride_id)
    AND (
      role = 'RIDER'
      OR EXISTS (
        SELECT 1
        FROM public.rides r
        WHERE r.id = ride_id
          AND r.host_id = auth.uid()
      )
    )
    AND status = 'joined'
    AND checked_in_at IS NULL
    AND last_ping IS NULL
    AND last_location IS NULL
  );

DROP POLICY IF EXISTS "Read planned routes via ride access" ON public.ride_planned_routes;
CREATE POLICY "Read planned routes via ride access"
  ON public.ride_planned_routes
  FOR SELECT
  TO authenticated
  USING (public.can_read_ride(ride_id));

COMMIT;
