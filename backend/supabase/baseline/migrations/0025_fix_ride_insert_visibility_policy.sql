-- Allow authenticated hosts to create both public and private rides.
-- Private ride read/join enforcement remains in 0024.

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
