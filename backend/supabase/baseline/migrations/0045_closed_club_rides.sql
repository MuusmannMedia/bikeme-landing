-- One existing ride and participant list, with an immutable closed club scope.
-- Apply separately to the verified test project; never use a bulk migration push.
BEGIN;

ALTER TABLE public.rides
  ADD COLUMN club_id uuid REFERENCES public.clubs(id) ON DELETE SET NULL,
  ADD COLUMN club_closed_at timestamptz;
ALTER TABLE public.rides ADD CONSTRAINT rides_club_private_check
  CHECK ((club_id IS NULL AND club_closed_at IS NULL) OR visibility = 'private');
CREATE INDEX rides_club_upcoming_idx ON public.rides(club_id, start_time)
  WHERE club_id IS NOT NULL AND status = 'ACTIVE';

CREATE OR REPLACE FUNCTION public.can_read_ride(target_ride_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.rides r WHERE r.id = target_ride_id AND
    CASE WHEN r.club_id IS NOT NULL OR r.club_closed_at IS NOT NULL THEN
      r.club_closed_at IS NULL AND club_private.my_role(r.club_id) IS NOT NULL
    ELSE
      COALESCE(r.visibility, 'public') = 'public' OR r.host_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.ride_invites i WHERE i.ride_id = r.id AND i.invitee_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.participants p WHERE p.ride_id = r.id AND p.user_id = auth.uid())
    END);
$$;

CREATE OR REPLACE FUNCTION public.can_join_ride(target_ride_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.rides r WHERE r.id = target_ride_id AND
    CASE WHEN r.club_id IS NOT NULL OR r.club_closed_at IS NOT NULL THEN
      r.club_closed_at IS NULL AND club_private.my_role(r.club_id) IS NOT NULL
      AND r.status = 'ACTIVE' AND r.start_time > clock_timestamp()
    ELSE
      COALESCE(r.visibility, 'public') = 'public' OR r.host_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.ride_invites i WHERE i.ride_id = r.id AND i.invitee_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.participants p WHERE p.ride_id = r.id AND p.user_id = auth.uid())
    END);
$$;

-- Restrictive AND policy also gates the separate permissive host-read policy.
-- Ordinary public/private rides retain all their existing policies.
CREATE POLICY rides_club_scope ON public.rides AS RESTRICTIVE FOR ALL TO authenticated
  USING ((club_id IS NULL AND club_closed_at IS NULL) OR
    (club_closed_at IS NULL AND club_private.my_role(club_id) IS NOT NULL))
  WITH CHECK ((club_id IS NULL AND club_closed_at IS NULL) OR
    (club_closed_at IS NULL AND club_private.my_role(club_id) IS NOT NULL));

CREATE FUNCTION club_private.guard_ride_scope() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- The FK action runs only after the parent has been deleted by club_dissolve.
    -- Retain a closed tombstone: it must never become an ordinary private ride.
    IF OLD.club_id IS NOT NULL AND NEW.club_id IS NULL AND pg_trigger_depth() > 1
       AND NOT EXISTS (SELECT 1 FROM public.clubs WHERE id = OLD.club_id) THEN
      NEW.club_closed_at := clock_timestamp();
      NEW.visibility := 'private';
      IF NEW.start_time > clock_timestamp() AND NEW.status = 'ACTIVE'
         AND NOT EXISTS (SELECT 1 FROM public.participants p WHERE p.ride_id = OLD.id AND p.status = 'active') THEN
        NEW.status := 'CANCELLED';
        NEW.cancel_reason := 'CLUB_DISSOLVED';
        NEW.cancelled_at := clock_timestamp();
      END IF;
      RETURN NEW;
    END IF;
    IF NEW.club_id IS DISTINCT FROM OLD.club_id OR NEW.club_closed_at IS DISTINCT FROM OLD.club_closed_at THEN
      RAISE EXCEPTION 'CLUB_RIDE_SCOPE_IMMUTABLE' USING ERRCODE = '42501';
    END IF;
  ELSIF NEW.club_closed_at IS NOT NULL THEN
    RAISE EXCEPTION 'CLUB_RIDE_SCOPE_IMMUTABLE' USING ERRCODE = '42501';
  END IF;
  IF NEW.club_id IS NULL THEN RETURN NEW; END IF;
  -- Only our nested membership cleanup may cancel a future ride while the
  -- account-deletion service has no end-user JWT. No public RPC can invoke it.
  IF TG_OP = 'UPDATE' AND pg_trigger_depth() > 1 AND NEW.status = 'CANCELLED'
     AND NEW.cancel_reason = 'CLUB_HOST_LEFT' AND NEW.visibility = 'private' AND NEW.type = 'EVENT' THEN
    RETURN NEW;
  END IF;
  -- Same serialization row as membership, ownership and dissolution. This writes
  -- the row so stale REPEATABLE READ snapshots must retry, not reuse membership.
  PERFORM club_private.lock_club(NEW.club_id);
  IF club_private.my_role(NEW.club_id) IS NULL THEN
    RAISE EXCEPTION 'CLUB_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF NEW.visibility <> 'private' OR NEW.type <> 'EVENT' THEN
    RAISE EXCEPTION 'CLUB_RIDE_PRIVATE_PLANNED_REQUIRED' USING ERRCODE = '22023';
  END IF;
  IF TG_OP = 'INSERT' AND (NEW.host_id IS DISTINCT FROM auth.uid() OR NEW.start_time <= clock_timestamp()) THEN
    RAISE EXCEPTION 'CLUB_RIDE_INVALID_CREATION' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_club_ride_scope BEFORE INSERT OR UPDATE ON public.rides
  FOR EACH ROW EXECUTE FUNCTION club_private.guard_ride_scope();

CREATE FUNCTION club_private.guard_ride_participation() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE v_ride public.rides;
BEGIN
  SELECT * INTO v_ride FROM public.rides WHERE id = NEW.ride_id;
  IF TG_OP = 'UPDATE' THEN
    -- No new constraints on existing heartbeat/location writes. Moving a row
    -- between rides/users cannot be used to bypass the insert checks, however.
    IF NEW.ride_id IS NOT DISTINCT FROM OLD.ride_id AND NEW.user_id IS NOT DISTINCT FROM OLD.user_id THEN
      RETURN NEW;
    END IF;
    IF v_ride.club_id IS NOT NULL OR v_ride.club_closed_at IS NOT NULL
       OR EXISTS (SELECT 1 FROM public.rides WHERE id = OLD.ride_id AND (club_id IS NOT NULL OR club_closed_at IS NOT NULL)) THEN
      RAISE EXCEPTION 'CLUB_RIDE_SCOPE_IMMUTABLE' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;
  IF v_ride.club_closed_at IS NOT NULL THEN RAISE EXCEPTION 'CLUB_FORBIDDEN' USING ERRCODE = '42501'; END IF;
  IF v_ride.club_id IS NULL THEN RETURN NEW; END IF;
  PERFORM club_private.lock_club(v_ride.club_id);
  -- Re-read after the lock. The ride or membership may have changed while waiting.
  SELECT * INTO v_ride FROM public.rides WHERE id = NEW.ride_id;
  IF v_ride.club_id IS NULL OR v_ride.club_closed_at IS NOT NULL
     OR NEW.user_id IS DISTINCT FROM auth.uid()
     OR club_private.role_for(v_ride.club_id, NEW.user_id) IS NULL THEN
    RAISE EXCEPTION 'CLUB_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF v_ride.status <> 'ACTIVE' OR v_ride.start_time <= clock_timestamp() THEN
    RAISE EXCEPTION 'CLUB_RIDE_NOT_JOINABLE' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_club_ride_participation BEFORE INSERT OR UPDATE ON public.participants
  FOR EACH ROW EXECUTE FUNCTION club_private.guard_ride_participation();

-- A ride invitation remains a separate action, and cannot grant club access.
CREATE POLICY ride_invites_club_scope ON public.ride_invites AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.can_read_ride(ride_id))
  WITH CHECK (public.can_read_ride(ride_id) AND EXISTS (
    SELECT 1 FROM public.rides r WHERE r.id = ride_id
      AND (r.club_id IS NULL OR EXISTS (SELECT 1 FROM public.club_members m WHERE m.club_id = r.club_id AND m.user_id = invitee_id))));

CREATE FUNCTION club_private.release_future_rides() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
  -- Cascaded dissolution is handled by the FK/tombstone above.
  IF NOT EXISTS (SELECT 1 FROM public.clubs WHERE id = OLD.club_id) THEN RETURN OLD; END IF;
  UPDATE public.clubs SET updated_at = clock_timestamp() WHERE id = OLD.club_id;
  -- Membership is still present during BEFORE DELETE, and the club RPC already
  -- owns its serialization lock. Do not touch started rides or active recordings.
  UPDATE public.rides r SET status = 'CANCELLED', cancel_reason = 'CLUB_HOST_LEFT', cancelled_at = clock_timestamp()
    WHERE r.club_id = OLD.club_id AND r.host_id = OLD.user_id AND r.start_time > clock_timestamp()
      AND r.status = 'ACTIVE' AND NOT EXISTS (
        SELECT 1 FROM public.participants p WHERE p.ride_id = r.id AND p.status = 'active');
  DELETE FROM public.participants p USING public.rides r
    WHERE p.ride_id = r.id AND r.club_id = OLD.club_id AND p.user_id = OLD.user_id
      AND r.start_time > clock_timestamp() AND p.status = 'joined'
      AND NOT EXISTS (SELECT 1 FROM public.participants active WHERE active.ride_id = r.id AND active.status = 'active');
  RETURN OLD;
END;
$$;
CREATE TRIGGER release_future_club_rides BEFORE DELETE ON public.club_members
  FOR EACH ROW EXECUTE FUNCTION club_private.release_future_rides();

REVOKE ALL ON FUNCTION club_private.guard_ride_scope(), club_private.guard_ride_participation(),
  club_private.release_future_rides() FROM PUBLIC, anon, authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
