-- Re-assert private/public ride creation and make insert-returning safe for hosts.
-- The host SELECT policy does not broaden private ride access beyond the 0024 intent;
-- it only makes the host path explicit for .insert(...).select("id").

BEGIN;

DROP POLICY IF EXISTS "Insert rides" ON public.rides;
DROP POLICY IF EXISTS "Authenticated users can create own rides" ON public.rides;
DROP POLICY IF EXISTS "Authenticated users can create rides" ON public.rides;
DROP POLICY IF EXISTS "Hosts can create rides" ON public.rides;

CREATE POLICY "Insert rides"
  ON public.rides
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = host_id
    AND COALESCE(visibility, 'public') IN ('public', 'private')
  );

DROP POLICY IF EXISTS "Hosts can read own rides" ON public.rides;

CREATE POLICY "Hosts can read own rides"
  ON public.rides
  FOR SELECT
  TO authenticated
  USING (auth.uid() = host_id);

COMMIT;
