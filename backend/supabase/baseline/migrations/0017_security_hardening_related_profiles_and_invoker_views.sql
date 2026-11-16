-- Critical hardening: close profile data leakage and remove SECURITY DEFINER-style view exposure.

BEGIN;

-- Ensure compatibility/security advisory compliance for views that must respect caller RLS.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'participant_live_locations'
      AND c.relkind = 'v'
  ) THEN
    ALTER VIEW public.participant_live_locations SET (security_invoker = true);
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'user_access_overview'
      AND c.relkind = 'v'
  ) THEN
    ALTER VIEW public.user_access_overview SET (security_invoker = true);
    REVOKE ALL ON public.user_access_overview FROM anon, authenticated;
  END IF;
END
$$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Read related profiles" ON public.profiles;

CREATE POLICY "Read related profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.ride_invites ri
      WHERE (ri.host_id = auth.uid() AND ri.invitee_id = profiles.id)
         OR (ri.invitee_id = auth.uid() AND ri.host_id = profiles.id)
    )
    OR EXISTS (
      SELECT 1
      FROM public.participants self_participant
      JOIN public.participants related_participant
        ON related_participant.ride_id = self_participant.ride_id
      WHERE self_participant.user_id = auth.uid()
        AND related_participant.user_id = profiles.id
    )
  );

COMMIT;
