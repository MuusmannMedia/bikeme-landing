-- Security Advisor warning cleanup:
-- 1) remove anon/public RLS policy access on core tables
-- 2) tighten storage.objects avatar policies
-- 3) set explicit function search_path for flagged functions

BEGIN;

-- ---------------------------------------------------------------------------
-- Function search_path hardening
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'has_tracking_premium'
      AND pg_get_function_identity_arguments(p.oid) = 'user_id uuid'
  ) THEN
    ALTER FUNCTION public.has_tracking_premium(UUID) SET search_path = public;
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'set_updated_at'
      AND pg_get_function_identity_arguments(p.oid) = ''
  ) THEN
    ALTER FUNCTION public.set_updated_at() SET search_path = public;
  END IF;
END
$$;

DO $$
DECLARE
  fn_signature regprocedure;
BEGIN
  FOR fn_signature IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'set_ride_planned_routes_upd'
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public', fn_signature);
  END LOOP;
END
$$;

-- ---------------------------------------------------------------------------
-- RLS hardening: remove anon/public policy access
-- ---------------------------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ride_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ride_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ride_planned_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_access ENABLE ROW LEVEL SECURITY;

-- profiles
DROP POLICY IF EXISTS "Public read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Read related profiles" ON public.profiles;
DROP POLICY IF EXISTS "Insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Update own profile" ON public.profiles;

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

CREATE POLICY "Insert own profile"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Update own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- rides
DROP POLICY IF EXISTS "Public read rides" ON public.rides;
DROP POLICY IF EXISTS "Insert rides" ON public.rides;
DROP POLICY IF EXISTS "Update own rides" ON public.rides;
DROP POLICY IF EXISTS "Delete own rides" ON public.rides;

CREATE POLICY "Public read rides"
  ON public.rides
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Insert rides"
  ON public.rides
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Update own rides"
  ON public.rides
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = host_id)
  WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Delete own rides"
  ON public.rides
  FOR DELETE
  TO authenticated
  USING (auth.uid() = host_id);

-- participants
DROP POLICY IF EXISTS "Public read participants" ON public.participants;
DROP POLICY IF EXISTS "Join rides" ON public.participants;
DROP POLICY IF EXISTS "Leave rides" ON public.participants;
DROP POLICY IF EXISTS "Participants can insert own membership" ON public.participants;
DROP POLICY IF EXISTS "Participants can update own membership" ON public.participants;

CREATE POLICY "Public read participants"
  ON public.participants
  FOR SELECT
  TO authenticated
  USING (true);

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

CREATE POLICY "Leave rides"
  ON public.participants
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1
      FROM public.rides r
      WHERE r.id = ride_id
        AND r.host_id = auth.uid()
    )
  );

-- push_tokens
DROP POLICY IF EXISTS "Users read own push tokens" ON public.push_tokens;
DROP POLICY IF EXISTS "Users insert own push tokens" ON public.push_tokens;
DROP POLICY IF EXISTS "Users update own push tokens" ON public.push_tokens;
DROP POLICY IF EXISTS "Users delete own push tokens" ON public.push_tokens;

CREATE POLICY "Users read own push tokens"
  ON public.push_tokens
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own push tokens"
  ON public.push_tokens
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own push tokens"
  ON public.push_tokens
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own push tokens"
  ON public.push_tokens
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ride_history
DROP POLICY IF EXISTS "Ride history owner select" ON public.ride_history;
DROP POLICY IF EXISTS "Ride history owner insert" ON public.ride_history;
DROP POLICY IF EXISTS "Ride history owner update" ON public.ride_history;
DROP POLICY IF EXISTS "Ride history owner delete" ON public.ride_history;

CREATE POLICY "Ride history owner select"
  ON public.ride_history
  FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_id);

CREATE POLICY "Ride history owner insert"
  ON public.ride_history
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Ride history owner update"
  ON public.ride_history
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Ride history owner delete"
  ON public.ride_history
  FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_id);

-- ride_invites
DROP POLICY IF EXISTS "Read own ride invites" ON public.ride_invites;
DROP POLICY IF EXISTS "Host creates ride invites" ON public.ride_invites;
DROP POLICY IF EXISTS "Host deletes ride invites" ON public.ride_invites;
DROP POLICY IF EXISTS "Invitee updates invite" ON public.ride_invites;

CREATE POLICY "Read own ride invites"
  ON public.ride_invites
  FOR SELECT
  TO authenticated
  USING (auth.uid() = host_id OR auth.uid() = invitee_id);

CREATE POLICY "Host creates ride invites"
  ON public.ride_invites
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = host_id
    AND EXISTS (
      SELECT 1
      FROM public.rides r
      WHERE r.id = ride_id
        AND r.host_id = auth.uid()
    )
  );

CREATE POLICY "Host deletes ride invites"
  ON public.ride_invites
  FOR DELETE
  TO authenticated
  USING (auth.uid() = host_id);

CREATE POLICY "Invitee updates invite"
  ON public.ride_invites
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = invitee_id)
  WITH CHECK (auth.uid() = invitee_id);

-- ride_planned_routes
DROP POLICY IF EXISTS "Read planned routes via ride access" ON public.ride_planned_routes;
DROP POLICY IF EXISTS "Host inserts planned routes" ON public.ride_planned_routes;
DROP POLICY IF EXISTS "Host updates planned routes" ON public.ride_planned_routes;
DROP POLICY IF EXISTS "Host deletes planned routes" ON public.ride_planned_routes;

CREATE POLICY "Read planned routes via ride access"
  ON public.ride_planned_routes
  FOR SELECT
  TO authenticated
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
  TO authenticated
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
  TO authenticated
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
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.rides r
      WHERE r.id = ride_planned_routes.ride_id
        AND r.host_id = auth.uid()
    )
  );

-- user_access
DROP POLICY IF EXISTS "Read own user access" ON public.user_access;

CREATE POLICY "Read own user access"
  ON public.user_access
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Storage hardening for avatars
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Avatar images are public" ON storage.objects;
DROP POLICY IF EXISTS "Avatar images read by authenticated users" ON storage.objects;
DROP POLICY IF EXISTS "Users upload own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users update own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users delete own avatar" ON storage.objects;

CREATE POLICY "Avatar images read by authenticated users"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'avatars');

CREATE POLICY "Users upload own avatar"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users update own avatar"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users delete own avatar"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

COMMIT;
