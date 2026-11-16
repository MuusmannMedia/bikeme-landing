-- Harden participant RLS so authenticated users can safely join rides for themselves.
-- This fixes join failures where INSERT/UPSERT is rejected by stricter drifted policies.

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
  );

DROP POLICY IF EXISTS "Participants can update own membership" ON public.participants;
CREATE POLICY "Participants can update own membership"
  ON public.participants
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
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
  );
