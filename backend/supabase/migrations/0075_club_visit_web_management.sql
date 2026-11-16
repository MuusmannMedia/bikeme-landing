BEGIN;
-- Approved web-only contract additions; all legacy signatures stay unchanged.
ALTER TABLE club_private.visit_profiles ADD COLUMN show_member_count boolean NOT NULL DEFAULT false;
CREATE FUNCTION public.club_visit_publish_web(p_club uuid,p_revision bigint,p_body text,p_cover boolean,p_logo boolean,p_applications boolean,p_show_member_count boolean,p_key uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE payload jsonb:=jsonb_build_array('publishWeb',p_club,p_revision,p_body,p_cover,p_logo,p_applications,p_show_member_count);r jsonb;BEGIN
 PERFORM club_private.visit_require('visits');PERFORM club_private.lock_club(p_club);
 IF COALESCE(club_private.my_role(p_club),'') NOT IN('owner','admin') THEN RAISE EXCEPTION 'CLUB_FORBIDDEN' USING ERRCODE='42501';END IF;
 IF p_show_member_count IS NULL THEN RAISE EXCEPTION 'CLUB_INVALID_INPUT' USING ERRCODE='22023';END IF;
 r:=club_private.visit_replay(p_key,payload);IF r IS NOT NULL THEN RETURN r;END IF;
 r:=public.club_visit_publish(p_club,p_revision,p_body,p_cover,p_logo,p_applications,md5(p_key::text||':profile')::uuid);
 UPDATE club_private.visit_profiles SET show_member_count=p_show_member_count WHERE club_id=p_club;
 RETURN club_private.visit_record(p_club,p_key,payload,r);
END$$;
CREATE OR REPLACE FUNCTION public.club_visit_profile(p_club uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v club_private.visit_profiles; f club_private.visit_flags;
BEGIN
 PERFORM club_private.visit_require('visits');
 IF NOT club_private.visit_can_read(p_club) THEN RAISE EXCEPTION 'CLUB_VISIT_UNAVAILABLE' USING ERRCODE='42501';END IF;
 SELECT * INTO v FROM club_private.visit_profiles WHERE club_id=p_club;SELECT * INTO f FROM club_private.visit_flags WHERE singleton;
 RETURN jsonb_build_object('id',p_club,'name',v.name,'description',v.body,'revision',v.revision,'applications_open',v.applications_open AND f.applications,
 'has_cover',f.images AND v.cover_path IS NOT NULL,'has_logo',f.images AND v.logo_path IS NOT NULL,
 'cover_frame',CASE WHEN f.images AND v.cover_path IS NOT NULL THEN v.cover_frame-'source' END,
 'logo_frame',CASE WHEN f.images AND v.logo_path IS NOT NULL THEN v.logo_frame-'source' END,
 'member_count',CASE WHEN v.show_member_count THEN (SELECT count(*) FROM public.club_members WHERE club_id=p_club) END);
END$$;
CREATE FUNCTION public.club_ride_visit_settings(p_club uuid,p_after uuid DEFAULT NULL,p_limit integer DEFAULT 30) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 PERFORM club_private.visit_require('rides');
 IF COALESCE(club_private.my_role(p_club),'') NOT IN('owner','admin') THEN RAISE EXCEPTION 'CLUB_FORBIDDEN' USING ERRCODE='42501';END IF;
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'CLUB_INVALID_INPUT' USING ERRCODE='22023';END IF;
 RETURN COALESCE((SELECT jsonb_agg(to_jsonb(q) ORDER BY ride_id) FROM(SELECT ride_id,revision,published,title,body,area FROM club_private.visit_rides WHERE club_id=p_club AND (p_after IS NULL OR ride_id>p_after) ORDER BY ride_id LIMIT p_limit)q),'[]');
END$$;
CREATE TRIGGER visit_membership_count_signal AFTER INSERT OR DELETE ON public.club_members FOR EACH ROW EXECUTE FUNCTION club_private.visit_notify();
REVOKE ALL ON FUNCTION public.club_visit_publish_web(uuid,bigint,text,boolean,boolean,boolean,boolean,uuid),public.club_ride_visit_settings(uuid,uuid,integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.club_visit_publish_web(uuid,bigint,text,boolean,boolean,boolean,boolean,uuid),public.club_ride_visit_settings(uuid,uuid,integer) TO authenticated;
COMMIT;
