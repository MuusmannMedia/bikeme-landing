BEGIN;
CREATE FUNCTION public.club_application_submit(p_club uuid,p_body text,p_key uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a uuid:=club_private.visit_require('applications');c public.clubs;r jsonb;payload jsonb:=jsonb_build_array('apply',p_club,p_body);v club_private.visit_applications;invite uuid;
BEGIN
 c:=club_private.lock_club(p_club);PERFORM pg_advisory_xact_lock(hashtextextended('visit-applications:'||a::text,0));PERFORM dm_private.lock_block_pair(a,c.owner_id);
 IF NOT club_private.visit_can_read(p_club) OR NOT EXISTS(SELECT 1 FROM club_private.visit_profiles WHERE club_id=p_club AND applications_open) OR EXISTS(SELECT 1 FROM club_private.visit_restrictions WHERE club_id=p_club AND applicant=a) THEN RAISE EXCEPTION 'CLUB_APPLICATION_UNAVAILABLE' USING ERRCODE='42501';END IF;
 IF char_length(COALESCE(p_body,''))>500 THEN RAISE EXCEPTION 'CLUB_INVALID_INPUT' USING ERRCODE='22023';END IF;
 r:=club_private.visit_replay(p_key,payload);IF r IS NOT NULL THEN RETURN r;END IF;
 IF club_private.my_role(p_club) IS NOT NULL THEN RAISE EXCEPTION 'CLUB_ALREADY_MEMBER' USING ERRCODE='22023';END IF;
 SELECT id INTO invite FROM public.club_invites WHERE club_id=p_club AND invitee_id=a AND status='pending' AND expires_at>clock_timestamp() AND club_private.role_for(p_club,inviter_id) IN('owner','admin');
 IF invite IS NOT NULL THEN RETURN club_private.visit_record(p_club,p_key,payload,jsonb_build_object('status','invited','invite_id',invite));END IF;
 UPDATE club_private.visit_applications SET status='expired',resolved_at=clock_timestamp() WHERE club_id=p_club AND applicant=a AND status='pending' AND expires_at<=clock_timestamp();
 SELECT * INTO v FROM club_private.visit_applications WHERE club_id=p_club AND applicant=a AND status='pending';
 IF FOUND THEN RETURN club_private.visit_record(p_club,p_key,payload,jsonb_build_object('id',v.id,'status',v.status,'expires_at',v.expires_at));END IF;
 IF EXISTS(SELECT 1 FROM club_private.visit_applications WHERE club_id=p_club AND applicant=a AND status='rejected' AND resolved_at>clock_timestamp()-interval '7 days') THEN RAISE EXCEPTION 'CLUB_APPLICATION_COOLDOWN' USING ERRCODE='22023';END IF;
 IF (SELECT count(*) FROM club_private.visit_applications WHERE applicant=a AND created_at>clock_timestamp()-interval '1 day')>=5 OR (SELECT count(*) FROM club_private.visit_applications WHERE applicant=a AND status='pending' AND expires_at>clock_timestamp())>=20 THEN RAISE EXCEPTION 'CLUB_APPLICATION_RATE_LIMIT' USING ERRCODE='22023';END IF;
 INSERT INTO club_private.visit_applications(club_id,applicant,body) VALUES(p_club,a,btrim(COALESCE(p_body,''))) RETURNING * INTO v;
 RETURN club_private.visit_record(p_club,p_key,payload,jsonb_build_object('id',v.id,'status',v.status,'expires_at',v.expires_at));
END$$;
CREATE FUNCTION public.club_applications_mine() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a uuid:=club_private.visit_require('applications');BEGIN
 RETURN COALESCE((SELECT jsonb_agg(jsonb_build_object('id',id,'club_id',club_id,'status',CASE WHEN status='pending' AND expires_at<=statement_timestamp() THEN 'expired' ELSE status END,'body',body,'created_at',created_at,'expires_at',expires_at,'resolved_at',resolved_at) ORDER BY created_at DESC) FROM club_private.visit_applications WHERE applicant=a),'[]');
END$$;
CREATE FUNCTION public.club_applications_review(p_club uuid,p_after uuid DEFAULT NULL,p_limit integer DEFAULT 30) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a uuid:=club_private.visit_require('applications');BEGIN
 IF COALESCE(club_private.my_role(p_club),'') NOT IN('owner','admin') THEN RAISE EXCEPTION 'CLUB_FORBIDDEN' USING ERRCODE='42501';END IF;
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'CLUB_INVALID_INPUT' USING ERRCODE='22023';END IF;
 RETURN COALESCE((SELECT jsonb_agg(to_jsonb(q) ORDER BY id) FROM(SELECT v.id,v.applicant,p.display_name,p.avatar_url,v.body,v.created_at,v.expires_at FROM club_private.visit_applications v JOIN public.profiles p ON p.id=v.applicant WHERE v.club_id=p_club AND v.status='pending' AND v.expires_at>statement_timestamp() AND NOT dm_private.blocked_pair(a,v.applicant) AND (p_after IS NULL OR v.id>p_after) ORDER BY v.id LIMIT p_limit)q),'[]');
END$$;
CREATE FUNCTION public.club_application_cancel(p_id uuid,p_key uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a uuid:=club_private.visit_require('applications');v club_private.visit_applications;r jsonb;payload jsonb:=jsonb_build_array('cancelApplication',p_id);s text;
BEGIN
 SELECT * INTO v FROM club_private.visit_applications WHERE id=p_id AND applicant=a;
 IF NOT FOUND THEN RAISE EXCEPTION 'CLUB_FORBIDDEN' USING ERRCODE='42501';END IF;
 PERFORM club_private.lock_club(v.club_id);SELECT * INTO v FROM club_private.visit_applications WHERE id=p_id FOR UPDATE;
 r:=club_private.visit_replay(p_key,payload);IF r IS NOT NULL THEN RETURN r;END IF;
 IF v.status<>'pending' THEN RAISE EXCEPTION 'CLUB_APPLICATION_CLOSED' USING ERRCODE='22023';END IF;
 s:=CASE WHEN v.expires_at<=clock_timestamp() THEN 'expired' ELSE 'cancelled' END;
 UPDATE club_private.visit_applications SET status=s,resolved_at=clock_timestamp(),resolved_by=a WHERE id=p_id;
 RETURN club_private.visit_record(v.club_id,p_key,payload,jsonb_build_object('id',p_id,'status',s));
END$$;
CREATE FUNCTION public.club_application_resolve(p_id uuid,p_accept boolean,p_key uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a uuid:=club_private.visit_require('applications');v club_private.visit_applications;c public.clubs;r jsonb;payload jsonb:=jsonb_build_array('resolveApplication',p_id,p_accept);s text;peer uuid;
BEGIN
 SELECT * INTO v FROM club_private.visit_applications WHERE id=p_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'CLUB_FORBIDDEN' USING ERRCODE='42501';END IF;
 c:=club_private.lock_club(v.club_id);
 IF COALESCE(club_private.my_role(v.club_id),'') NOT IN('owner','admin') THEN RAISE EXCEPTION 'CLUB_FORBIDDEN' USING ERRCODE='42501';END IF;
 FOR peer IN SELECT DISTINCT x FROM unnest(ARRAY[a,c.owner_id]) x ORDER BY x LOOP PERFORM dm_private.lock_block_pair(v.applicant,peer);END LOOP;
 IF dm_private.blocked_pair(a,v.applicant) OR dm_private.blocked_pair(c.owner_id,v.applicant) OR EXISTS(SELECT 1 FROM club_private.visit_restrictions WHERE club_id=v.club_id AND applicant=v.applicant) THEN RAISE EXCEPTION 'CLUB_APPLICATION_UNAVAILABLE' USING ERRCODE='42501';END IF;
 IF p_accept IS NULL THEN RAISE EXCEPTION 'CLUB_INVALID_INPUT' USING ERRCODE='22023';END IF;
 r:=club_private.visit_replay(p_key,payload);IF r IS NOT NULL THEN RETURN r;END IF;
 SELECT * INTO v FROM club_private.visit_applications WHERE id=p_id FOR UPDATE;
 IF v.status<>'pending' THEN RAISE EXCEPTION 'CLUB_APPLICATION_CLOSED' USING ERRCODE='22023';END IF;
 s:=CASE WHEN v.expires_at<=clock_timestamp() THEN 'expired' WHEN p_accept THEN 'accepted' ELSE 'rejected' END;
 UPDATE club_private.visit_applications SET status=s,resolved_at=clock_timestamp(),resolved_by=a WHERE id=p_id;
 IF s='accepted' THEN INSERT INTO public.club_members(club_id,user_id,role) VALUES(v.club_id,v.applicant,'member') ON CONFLICT(club_id,user_id) DO NOTHING;END IF;
 RETURN club_private.visit_record(v.club_id,p_key,payload,jsonb_build_object('id',p_id,'status',s));
END$$;
CREATE FUNCTION public.club_application_restrict(p_club uuid,p_applicant uuid,p_restrict boolean,p_key uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE r jsonb;payload jsonb:=jsonb_build_array('restrictApplication',p_club,p_applicant,p_restrict);BEGIN
 PERFORM club_private.visit_require('applications');PERFORM club_private.lock_club(p_club);
 IF COALESCE(club_private.my_role(p_club),'') NOT IN('owner','admin') THEN RAISE EXCEPTION 'CLUB_FORBIDDEN' USING ERRCODE='42501';END IF;
 IF p_applicant IS NULL OR p_restrict IS NULL OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_applicant) THEN RAISE EXCEPTION 'CLUB_INVALID_INPUT' USING ERRCODE='22023';END IF;
 r:=club_private.visit_replay(p_key,payload);IF r IS NOT NULL THEN RETURN r;END IF;
 IF p_restrict THEN INSERT INTO club_private.visit_restrictions VALUES(p_club,p_applicant) ON CONFLICT DO NOTHING;
 ELSE DELETE FROM club_private.visit_restrictions WHERE club_id=p_club AND applicant=p_applicant;END IF;
 RETURN club_private.visit_record(p_club,p_key,payload,jsonb_build_object('restricted',p_restrict));
END$$;
-- Legacy invite acceptance and new approval converge on the same existing club lock.
CREATE FUNCTION club_private.visit_joined() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 UPDATE club_private.visit_applications SET status='accepted',resolved_at=clock_timestamp() WHERE club_id=NEW.club_id AND applicant=NEW.user_id AND status='pending';
 UPDATE public.club_invites SET status='accepted',responded_at=clock_timestamp() WHERE club_id=NEW.club_id AND invitee_id=NEW.user_id AND status='pending';
 RETURN NULL;
END$$;
CREATE TRIGGER visit_joined AFTER INSERT ON public.club_members FOR EACH ROW EXECUTE FUNCTION club_private.visit_joined();
-- Explicit privilege allowlist. No grants to anon/service_role or private tables.
DO $$DECLARE f record;BEGIN
 FOR f IN SELECT p.oid::regprocedure signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE (n.nspname='club_private' AND p.proname LIKE 'visit_%') OR(n.nspname='public' AND p.proname IN('club_visit_settings','club_visit_publish','club_visit_unpublish','club_visit_profile','club_visit_watch','club_ride_visit_publish','club_ride_visit_unpublish','club_visit_rides','club_application_submit','club_applications_mine','club_applications_review','club_application_cancel','club_application_resolve','club_application_restrict')) LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',f.signature);
 IF f.signature::text LIKE 'club_visit_%' OR f.signature::text LIKE 'club_ride_visit_%' OR f.signature::text LIKE 'club_application%' THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f.signature); END IF;
 END LOOP;
END$$;
GRANT EXECUTE ON FUNCTION club_private.visit_image_allowed(text) TO authenticated;
COMMIT;
