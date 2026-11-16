-- Phase 1 caveat fix: close INSERT bypass for tracking-like participant writes.
-- Keep join/leave flows intact while requiring neutral join-state on INSERT.

BEGIN;

ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants can insert own membership" ON public.participants;
CREATE POLICY "Participants can insert own membership"
  ON public.participants
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
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

COMMIT;
