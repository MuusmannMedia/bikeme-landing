-- Phase 1 (P1): backend premium enforcement for tracking-related participant writes.
-- Keep scope minimal: tighten UPDATE path used by tracking live sync/check-in.

BEGIN;

CREATE OR REPLACE FUNCTION public.has_tracking_premium(user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_access ua
    WHERE ua.user_id = $1
      AND ua.access_level IN ('premium', 'tester_premium')
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_tracking_premium(UUID) TO authenticated;

ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants can update own membership" ON public.participants;
CREATE POLICY "Participants can update own membership"
  ON public.participants
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
    AND public.has_tracking_premium(auth.uid())
  )
  WITH CHECK (
    auth.uid() = user_id
    AND public.has_tracking_premium(auth.uid())
    AND (
      role = 'RIDER'
      OR EXISTS (
        SELECT 1
        FROM public.rides r
        WHERE r.id = ride_id
          AND r.host_id = auth.uid()
      )
    )
  );

COMMIT;
