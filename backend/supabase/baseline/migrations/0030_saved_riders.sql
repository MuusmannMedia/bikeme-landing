-- Saved riders: per-user saved rider relations for the Riders screen.

BEGIN;

CREATE TABLE IF NOT EXISTS public.saved_riders (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rider_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, rider_id),
  CONSTRAINT saved_riders_no_self CHECK (user_id <> rider_id)
);

CREATE INDEX IF NOT EXISTS idx_saved_riders_rider_id
  ON public.saved_riders(rider_id);

ALTER TABLE public.saved_riders ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.saved_riders FROM PUBLIC;
REVOKE ALL ON TABLE public.saved_riders FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.saved_riders TO authenticated;
GRANT ALL ON TABLE public.saved_riders TO service_role;

DROP POLICY IF EXISTS "Users can read their saved riders" ON public.saved_riders;
CREATE POLICY "Users can read their saved riders"
  ON public.saved_riders
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can save riders" ON public.saved_riders;
CREATE POLICY "Users can save riders"
  ON public.saved_riders
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND user_id <> rider_id
  );

DROP POLICY IF EXISTS "Users can remove their saved riders" ON public.saved_riders;
CREATE POLICY "Users can remove their saved riders"
  ON public.saved_riders
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read profiles for saved riders" ON public.profiles;
CREATE POLICY "Users can read profiles for saved riders"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.saved_riders sr
      WHERE sr.user_id = auth.uid()
        AND sr.rider_id = profiles.id
    )
  );

COMMIT;
