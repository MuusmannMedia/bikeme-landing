-- Club ride invitations use the existing ride_invites and participants tables.
-- Apply separately only after verifying 0043–0045 and the target project.
BEGIN;

CREATE FUNCTION club_private.guard_club_ride_invite() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE v_ride public.rides; v_now timestamptz := clock_timestamp();
BEGIN
  SELECT * INTO v_ride FROM public.rides WHERE id = NEW.ride_id;
  IF TG_OP = 'UPDATE' AND EXISTS (
    SELECT 1 FROM public.rides WHERE id = OLD.ride_id AND (club_id IS NOT NULL OR club_closed_at IS NOT NULL)
  ) AND (NEW.ride_id IS DISTINCT FROM OLD.ride_id OR NEW.host_id IS DISTINCT FROM OLD.host_id
    OR NEW.invitee_id IS DISTINCT FROM OLD.invitee_id OR NEW.created_at IS DISTINCT FROM OLD.created_at) THEN
    RAISE EXCEPTION 'CLUB_RIDE_INVITE_IMMUTABLE' USING ERRCODE = '42501';
  END IF;
  IF v_ride.club_closed_at IS NOT NULL THEN RAISE EXCEPTION 'CLUB_FORBIDDEN' USING ERRCODE = '42501'; END IF;
  IF v_ride.club_id IS NULL THEN RETURN NEW; END IF;
  PERFORM club_private.lock_club(v_ride.club_id);
  SELECT * INTO v_ride FROM public.rides WHERE id = NEW.ride_id;
  v_now := clock_timestamp();
  IF auth.uid() IS NULL OR v_ride.club_id IS NULL OR v_ride.club_closed_at IS NOT NULL
     OR NEW.host_id IS DISTINCT FROM v_ride.host_id OR NEW.invitee_id = v_ride.host_id
     OR club_private.role_for(v_ride.club_id, v_ride.host_id) IS NULL
     OR club_private.role_for(v_ride.club_id, NEW.invitee_id) IS NULL THEN
    RAISE EXCEPTION 'CLUB_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF v_ride.status <> 'ACTIVE' OR v_ride.start_time <= v_now
     OR (v_ride.expires_at IS NOT NULL AND v_ride.expires_at <= v_now) THEN
    RAISE EXCEPTION 'CLUB_RIDE_INVITE_UNAVAILABLE' USING ERRCODE = '22023';
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF auth.uid() IS DISTINCT FROM v_ride.host_id OR NEW.accepted_at IS NOT NULL OR NEW.declined_at IS NOT NULL THEN
      RAISE EXCEPTION 'CLUB_FORBIDDEN' USING ERRCODE = '42501';
    END IF;
    IF EXISTS (SELECT 1 FROM public.participants WHERE ride_id = NEW.ride_id AND user_id = NEW.invitee_id) THEN
      RAISE EXCEPTION 'CLUB_RIDE_ALREADY_JOINED' USING ERRCODE = '22023';
    END IF;
    RETURN NEW;
  END IF;
  IF auth.uid() IS DISTINCT FROM NEW.invitee_id OR NEW.ride_id IS DISTINCT FROM OLD.ride_id
     OR NEW.host_id IS DISTINCT FROM OLD.host_id OR NEW.invitee_id IS DISTINCT FROM OLD.invitee_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'CLUB_RIDE_INVITE_IMMUTABLE' USING ERRCODE = '42501';
  END IF;
  -- A decided invitation cannot be reset/replayed to rejoin after leaving a ride.
  IF OLD.accepted_at IS NOT NULL OR OLD.declined_at IS NOT NULL THEN
    IF NEW.accepted_at IS DISTINCT FROM OLD.accepted_at OR NEW.declined_at IS DISTINCT FROM OLD.declined_at THEN
      RAISE EXCEPTION 'CLUB_RIDE_INVITE_PROCESSED' USING ERRCODE = '22023';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.accepted_at IS NOT NULL AND NEW.declined_at IS NOT NULL THEN
    RAISE EXCEPTION 'CLUB_RIDE_INVITE_PROCESSED' USING ERRCODE = '22023';
  END IF;
  IF NEW.accepted_at IS NOT NULL THEN
    NEW.accepted_at := v_now;
    -- Atomic with the existing invitation update, including direct API updates.
    INSERT INTO public.participants(ride_id,user_id,role,status,joined_at)
      VALUES(NEW.ride_id,NEW.invitee_id,'RIDER','joined',v_now)
      ON CONFLICT (ride_id,user_id) DO NOTHING;
  ELSIF NEW.declined_at IS NOT NULL THEN
    NEW.declined_at := v_now;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_club_ride_invite BEFORE INSERT OR UPDATE ON public.ride_invites
  FOR EACH ROW EXECUTE FUNCTION club_private.guard_club_ride_invite();
REVOKE ALL ON FUNCTION club_private.guard_club_ride_invite() FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.club_ride_invite_members(p_ride_id uuid, p_user_ids uuid[]) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE v_ride public.rides; v_user uuid; v_invite public.ride_invites;
  v_status text; v_inserted uuid; v_results jsonb := '[]'::jsonb;
BEGIN
  SELECT * INTO v_ride FROM public.rides WHERE id = p_ride_id;
  IF auth.uid() IS NULL OR v_ride.club_id IS NULL OR v_ride.club_closed_at IS NOT NULL THEN
    RAISE EXCEPTION 'CLUB_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  PERFORM club_private.lock_club(v_ride.club_id);
  SELECT * INTO v_ride FROM public.rides WHERE id = p_ride_id;
  IF v_ride.host_id IS DISTINCT FROM auth.uid() OR v_ride.club_id IS NULL OR v_ride.club_closed_at IS NOT NULL
     OR club_private.my_role(v_ride.club_id) IS NULL THEN
    RAISE EXCEPTION 'CLUB_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF v_ride.status <> 'ACTIVE' OR v_ride.start_time <= clock_timestamp()
     OR (v_ride.expires_at IS NOT NULL AND v_ride.expires_at <= clock_timestamp()) THEN
    RAISE EXCEPTION 'CLUB_RIDE_INVITE_UNAVAILABLE' USING ERRCODE = '22023';
  END IF;
  IF cardinality(p_user_ids) IS NULL OR cardinality(p_user_ids) > 200 THEN
    RAISE EXCEPTION 'CLUB_RIDE_INVITE_INVALID_SELECTION' USING ERRCODE = '22023';
  END IF;
  FOR v_user IN SELECT DISTINCT value FROM unnest(p_user_ids) AS ids(value) WHERE value IS NOT NULL ORDER BY value LOOP
    IF v_user = auth.uid() THEN v_status := 'self';
    ELSIF club_private.role_for(v_ride.club_id,v_user) IS NULL THEN v_status := 'not_member';
    ELSIF EXISTS (SELECT 1 FROM public.participants WHERE ride_id = p_ride_id AND user_id = v_user) THEN v_status := 'joined';
    ELSE
      SELECT * INTO v_invite FROM public.ride_invites WHERE ride_id = p_ride_id AND invitee_id = v_user;
      IF FOUND THEN
        v_status := CASE WHEN v_invite.accepted_at IS NOT NULL THEN 'accepted'
          WHEN v_invite.declined_at IS NOT NULL THEN 'declined' ELSE 'pending' END;
      ELSE
        v_inserted := NULL;
        INSERT INTO public.ride_invites(ride_id,host_id,invitee_id) VALUES(p_ride_id,auth.uid(),v_user)
          ON CONFLICT (ride_id,invitee_id) DO NOTHING RETURNING invitee_id INTO v_inserted;
        v_status := CASE WHEN v_inserted IS NOT NULL THEN 'created' ELSE 'pending' END;
      END IF;
    END IF;
    v_results := v_results || jsonb_build_array(jsonb_build_object('user_id',v_user,'status',v_status));
  END LOOP;
  RETURN v_results;
END;
$$;

CREATE FUNCTION public.club_ride_respond_invite(p_ride_id uuid, p_accept boolean) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE v_ride public.rides; v_invite public.ride_invites;
BEGIN
  SELECT * INTO v_ride FROM public.rides WHERE id = p_ride_id;
  IF auth.uid() IS NULL OR p_accept IS NULL OR v_ride.club_id IS NULL OR v_ride.club_closed_at IS NOT NULL THEN
    RAISE EXCEPTION 'CLUB_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  PERFORM club_private.lock_club(v_ride.club_id);
  SELECT * INTO v_ride FROM public.rides WHERE id = p_ride_id;
  IF v_ride.club_id IS NULL OR v_ride.club_closed_at IS NOT NULL OR club_private.my_role(v_ride.club_id) IS NULL
     OR club_private.role_for(v_ride.club_id,v_ride.host_id) IS NULL THEN
    RAISE EXCEPTION 'CLUB_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF v_ride.status <> 'ACTIVE' OR v_ride.start_time <= clock_timestamp()
     OR (v_ride.expires_at IS NOT NULL AND v_ride.expires_at <= clock_timestamp()) THEN
    RAISE EXCEPTION 'CLUB_RIDE_INVITE_UNAVAILABLE' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_invite FROM public.ride_invites WHERE ride_id=p_ride_id AND invitee_id=auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CLUB_RIDE_INVITE_NOT_FOUND' USING ERRCODE = '42501'; END IF;
  IF v_invite.accepted_at IS NOT NULL THEN
    IF p_accept AND EXISTS(SELECT 1 FROM public.participants WHERE ride_id=p_ride_id AND user_id=auth.uid()) THEN RETURN 'accepted'; END IF;
    RAISE EXCEPTION 'CLUB_RIDE_INVITE_PROCESSED' USING ERRCODE = '22023';
  END IF;
  IF v_invite.declined_at IS NOT NULL THEN
    IF NOT p_accept THEN RETURN 'declined'; END IF;
    RAISE EXCEPTION 'CLUB_RIDE_INVITE_PROCESSED' USING ERRCODE = '22023';
  END IF;
  UPDATE public.ride_invites SET accepted_at=CASE WHEN p_accept THEN clock_timestamp() ELSE NULL END,
    declined_at=CASE WHEN NOT p_accept THEN clock_timestamp() ELSE NULL END
    WHERE ride_id=p_ride_id AND invitee_id=auth.uid();
  RETURN CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END;
END;
$$;
REVOKE ALL ON FUNCTION public.club_ride_invite_members(uuid,uuid[]), public.club_ride_respond_invite(uuid,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.club_ride_invite_members(uuid,uuid[]), public.club_ride_respond_invite(uuid,boolean) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
