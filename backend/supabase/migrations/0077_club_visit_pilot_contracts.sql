BEGIN;

-- Explicit replacements of NEW visitor RPCs only; legacy signatures and grants unchanged.

CREATE OR REPLACE FUNCTION public.club_visit_settings(p_club uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 PERFORM club_private.visit_pilot_require(p_club);PERFORM club_private.visit_meter(p_club,'read');

 PERFORM club_private.visit_require('visits');
 IF COALESCE(club_private.my_role(p_club),'') NOT IN('owner','admin') THEN RAISE EXCEPTION 'CLUB_FORBIDDEN' USING ERRCODE='42501'; END IF;
 RETURN COALESCE((SELECT to_jsonb(v) FROM club_private.visit_profiles v WHERE club_id=p_club),jsonb_build_object('club_id',p_club,'revision',0,'published',false,'applications_open',false));
END$$;

CREATE OR REPLACE FUNCTION public.club_visit_publish(p_club uuid,p_revision bigint,p_body text,p_cover boolean,p_logo boolean,p_applications boolean,p_key uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE c public.clubs; a uuid; r jsonb; payload jsonb; v club_private.visit_profiles;
BEGIN
 PERFORM club_private.visit_pilot_require(p_club);

 a:=club_private.visit_require('visits'); c:=club_private.lock_club(p_club);
 IF COALESCE(club_private.my_role(p_club),'') NOT IN('owner','admin') THEN RAISE EXCEPTION 'CLUB_FORBIDDEN' USING ERRCODE='42501';END IF;
 IF p_cover IS NULL OR p_logo IS NULL OR p_applications IS NULL OR p_revision IS NULL OR char_length(COALESCE(p_body,''))>1000 THEN RAISE EXCEPTION 'CLUB_INVALID_INPUT' USING ERRCODE='22023';END IF;
 IF p_cover OR p_logo THEN PERFORM club_private.visit_require('images'); END IF;
 IF p_applications THEN PERFORM club_private.visit_require('applications');END IF;
 payload:=jsonb_build_array('publish',p_club,p_revision,p_body,p_cover,p_logo,p_applications);
 r:=club_private.visit_replay(p_key,payload);IF r IS NOT NULL THEN RETURN r;END IF;
 IF (p_cover AND c.cover_path IS NOT NULL AND NOT EXISTS(SELECT 1 FROM club_private.visit_image_payloads WHERE club_id=p_club AND source_path=c.cover_path)) OR (p_logo AND c.logo_path IS NOT NULL AND NOT EXISTS(SELECT 1 FROM club_private.visit_image_payloads WHERE club_id=p_club AND source_path=c.logo_path)) THEN RAISE EXCEPTION 'CLUB_VISIT_IMAGE_NOT_STAGED' USING ERRCODE='22023';END IF;
 SELECT * INTO v FROM club_private.visit_profiles WHERE club_id=p_club;
 IF COALESCE(v.revision,0)<>p_revision THEN RAISE EXCEPTION 'CLUB_VISIT_CHANGED' USING ERRCODE='PT409';END IF;
 INSERT INTO club_private.visit_profiles(club_id,revision,published,applications_open,name,body,cover_path,logo_path,cover_frame,logo_frame,published_by)
 VALUES(p_club,p_revision+1,true,p_applications,c.name,btrim(COALESCE(p_body,'')),CASE WHEN p_cover THEN c.cover_path END,CASE WHEN p_logo THEN c.logo_path END,CASE WHEN p_cover THEN c.cover_frame END,CASE WHEN p_logo THEN c.logo_frame END,a)
 ON CONFLICT(club_id) DO UPDATE SET revision=excluded.revision,published=true,applications_open=excluded.applications_open,name=excluded.name,body=excluded.body,cover_path=excluded.cover_path,logo_path=excluded.logo_path,cover_frame=excluded.cover_frame,logo_frame=excluded.logo_frame,published_by=a;
 RETURN club_private.visit_record(p_club,p_key,payload,jsonb_build_object('revision',p_revision+1));
END$$;

CREATE OR REPLACE FUNCTION public.club_visit_unpublish(p_club uuid,p_revision bigint,p_key uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE r jsonb;payload jsonb:=jsonb_build_array('unpublish',p_club,p_revision);v club_private.visit_profiles;
BEGIN
 PERFORM club_private.visit_pilot_require(p_club);

 PERFORM club_private.visit_require('visits');PERFORM club_private.lock_club(p_club);
 IF COALESCE(club_private.my_role(p_club),'') NOT IN('owner','admin') THEN RAISE EXCEPTION 'CLUB_FORBIDDEN' USING ERRCODE='42501';END IF;
 r:=club_private.visit_replay(p_key,payload);IF r IS NOT NULL THEN RETURN r;END IF;
 SELECT * INTO v FROM club_private.visit_profiles WHERE club_id=p_club;
 IF NOT FOUND OR v.revision IS DISTINCT FROM p_revision THEN RAISE EXCEPTION 'CLUB_VISIT_CHANGED' USING ERRCODE='PT409';END IF;
 UPDATE club_private.visit_profiles SET published=false,applications_open=false,revision=revision+1 WHERE club_id=p_club;
 RETURN club_private.visit_record(p_club,p_key,payload,jsonb_build_object('revision',p_revision+1));
END$$;

CREATE OR REPLACE FUNCTION public.club_visit_profile(p_club uuid) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v club_private.visit_profiles; f club_private.visit_flags;
BEGIN
 PERFORM club_private.visit_pilot_require(p_club);PERFORM club_private.visit_meter(p_club,'read');

 PERFORM club_private.visit_require('visits');
 IF NOT club_private.visit_can_read(p_club) THEN RAISE EXCEPTION 'CLUB_VISIT_UNAVAILABLE' USING ERRCODE='42501';END IF;
 SELECT * INTO v FROM club_private.visit_profiles WHERE club_id=p_club;SELECT * INTO f FROM club_private.visit_flags WHERE singleton;
 RETURN jsonb_build_object('id',p_club,'name',v.name,'description',v.body,'revision',v.revision,'applications_open',v.applications_open AND f.applications,
 'has_cover',f.images AND v.cover_path IS NOT NULL,'has_logo',f.images AND v.logo_path IS NOT NULL,
 'cover_frame',CASE WHEN f.images AND v.cover_path IS NOT NULL THEN v.cover_frame-'source' END,
 'logo_frame',CASE WHEN f.images AND v.logo_path IS NOT NULL THEN v.logo_frame-'source' END,
 'member_count',CASE WHEN v.show_member_count THEN (SELECT count(*) FROM public.club_members WHERE club_id=p_club) END);
END$$;

CREATE OR REPLACE FUNCTION public.club_ride_visit_publish(p_club uuid,p_ride uuid,p_revision bigint,p_title text,p_body text,p_area text,p_key uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a uuid:=club_private.visit_require('rides');r jsonb;payload jsonb:=jsonb_build_array('ridePublish',p_club,p_ride,p_revision,p_title,p_body,p_area);v club_private.visit_rides;
BEGIN
 PERFORM club_private.visit_pilot_require(p_club);

 PERFORM club_private.lock_club(p_club);
 IF COALESCE(club_private.my_role(p_club),'') NOT IN('owner','admin') THEN RAISE EXCEPTION 'CLUB_FORBIDDEN' USING ERRCODE='42501';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.rides WHERE id=p_ride AND club_id=p_club AND club_closed_at IS NULL AND status='ACTIVE' AND type='EVENT' AND visibility='private') THEN RAISE EXCEPTION 'CLUB_RIDE_UNAVAILABLE' USING ERRCODE='42501';END IF;
 IF p_revision IS NULL OR char_length(btrim(COALESCE(p_title,''))) NOT BETWEEN 2 AND 120 OR char_length(COALESCE(p_body,''))>1000 OR char_length(COALESCE(p_area,''))>100 THEN RAISE EXCEPTION 'CLUB_INVALID_INPUT' USING ERRCODE='22023';END IF;
 r:=club_private.visit_replay(p_key,payload);IF r IS NOT NULL THEN RETURN r;END IF;
 SELECT * INTO v FROM club_private.visit_rides WHERE ride_id=p_ride;
 IF COALESCE(v.revision,0)<>p_revision THEN RAISE EXCEPTION 'CLUB_VISIT_CHANGED' USING ERRCODE='PT409';END IF;
 INSERT INTO club_private.visit_rides(ride_id,club_id,revision,published,title,body,area,published_by) VALUES(p_ride,p_club,p_revision+1,true,btrim(p_title),btrim(COALESCE(p_body,'')),btrim(COALESCE(p_area,'')),a)
 ON CONFLICT(ride_id) DO UPDATE SET revision=excluded.revision,published=true,title=excluded.title,body=excluded.body,area=excluded.area,published_by=a;
 RETURN club_private.visit_record(p_club,p_key,payload,jsonb_build_object('revision',p_revision+1));
END$$;

CREATE OR REPLACE FUNCTION public.club_ride_visit_unpublish(p_club uuid,p_ride uuid,p_revision bigint,p_key uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE r jsonb;payload jsonb:=jsonb_build_array('rideUnpublish',p_club,p_ride,p_revision);
BEGIN
 PERFORM club_private.visit_pilot_require(p_club);

 PERFORM club_private.visit_require('rides');PERFORM club_private.lock_club(p_club);
 IF COALESCE(club_private.my_role(p_club),'') NOT IN('owner','admin') THEN RAISE EXCEPTION 'CLUB_FORBIDDEN' USING ERRCODE='42501';END IF;
 r:=club_private.visit_replay(p_key,payload);IF r IS NOT NULL THEN RETURN r;END IF;
 UPDATE club_private.visit_rides SET published=false,revision=revision+1 WHERE club_id=p_club AND ride_id=p_ride AND revision=p_revision;
 IF NOT FOUND THEN RAISE EXCEPTION 'CLUB_VISIT_CHANGED' USING ERRCODE='PT409';END IF;
 RETURN club_private.visit_record(p_club,p_key,payload,jsonb_build_object('revision',p_revision+1));
END$$;

CREATE OR REPLACE FUNCTION public.club_visit_rides(p_club uuid,p_after uuid DEFAULT NULL,p_limit integer DEFAULT 20) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 PERFORM club_private.visit_pilot_require(p_club);PERFORM club_private.visit_meter(p_club,'read');

 PERFORM club_private.visit_require('rides');IF NOT club_private.visit_can_read(p_club) THEN RAISE EXCEPTION 'CLUB_VISIT_UNAVAILABLE' USING ERRCODE='42501';END IF;
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'CLUB_INVALID_INPUT' USING ERRCODE='22023';END IF;
 RETURN COALESCE((SELECT jsonb_agg(to_jsonb(q) ORDER BY id) FROM(SELECT r.id,v.title,v.body description,v.area,r.start_time,r.discipline,r.distance_km,r.status,v.revision FROM club_private.visit_rides v JOIN public.rides r ON r.id=v.ride_id WHERE v.club_id=p_club AND r.club_id=p_club AND v.published AND r.club_closed_at IS NULL AND r.status='ACTIVE' AND r.type='EVENT' AND r.visibility='private' AND r.start_time>statement_timestamp() AND (p_after IS NULL OR r.id>p_after) AND NOT dm_private.blocked_pair(auth.uid(),r.host_id) ORDER BY r.id LIMIT p_limit)q),'[]');
END$$;

CREATE OR REPLACE FUNCTION public.club_application_submit(p_club uuid,p_body text,p_key uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a uuid:=club_private.visit_require('applications');c public.clubs;r jsonb;payload jsonb:=jsonb_build_array('apply',p_club,p_body);v club_private.visit_applications;invite uuid;
BEGIN
 PERFORM club_private.visit_pilot_require(p_club);

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

CREATE OR REPLACE FUNCTION public.club_applications_mine() RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a uuid:=club_private.visit_require('applications');BEGIN
 PERFORM club_private.visit_meter(NULL,'read');

 RETURN COALESCE((SELECT jsonb_agg(jsonb_build_object('id',id,'club_id',club_id,'status',CASE WHEN status='pending' AND expires_at<=statement_timestamp() THEN 'expired' ELSE status END,'body',body,'created_at',created_at,'expires_at',expires_at,'resolved_at',resolved_at) ORDER BY created_at DESC) FROM club_private.visit_applications WHERE applicant=a AND EXISTS(SELECT 1 FROM club_private.visit_pilot p WHERE p.club_id=visit_applications.club_id AND p.enabled)),'[]');
END$$;

CREATE OR REPLACE FUNCTION public.club_applications_review(p_club uuid,p_after uuid DEFAULT NULL,p_limit integer DEFAULT 30) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a uuid:=club_private.visit_require('applications');BEGIN
 PERFORM club_private.visit_pilot_require(p_club);PERFORM club_private.visit_meter(p_club,'read');

 IF COALESCE(club_private.my_role(p_club),'') NOT IN('owner','admin') THEN RAISE EXCEPTION 'CLUB_FORBIDDEN' USING ERRCODE='42501';END IF;
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'CLUB_INVALID_INPUT' USING ERRCODE='22023';END IF;
 RETURN COALESCE((SELECT jsonb_agg(to_jsonb(q) ORDER BY id) FROM(SELECT v.id,v.applicant,p.display_name,p.avatar_url,v.body,v.created_at,v.expires_at FROM club_private.visit_applications v JOIN public.profiles p ON p.id=v.applicant WHERE v.club_id=p_club AND v.status='pending' AND v.expires_at>statement_timestamp() AND NOT dm_private.blocked_pair(a,v.applicant) AND (p_after IS NULL OR v.id>p_after) ORDER BY v.id LIMIT p_limit)q),'[]');
END$$;

CREATE OR REPLACE FUNCTION public.club_application_cancel(p_id uuid,p_key uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a uuid:=club_private.visit_require('applications');v club_private.visit_applications;r jsonb;payload jsonb:=jsonb_build_array('cancelApplication',p_id);s text;
BEGIN
 PERFORM club_private.visit_pilot_require((SELECT club_id FROM club_private.visit_applications WHERE id=p_id));

 SELECT * INTO v FROM club_private.visit_applications WHERE id=p_id AND applicant=a;
 IF NOT FOUND THEN RAISE EXCEPTION 'CLUB_FORBIDDEN' USING ERRCODE='42501';END IF;
 PERFORM club_private.lock_club(v.club_id);SELECT * INTO v FROM club_private.visit_applications WHERE id=p_id FOR UPDATE;
 r:=club_private.visit_replay(p_key,payload);IF r IS NOT NULL THEN RETURN r;END IF;
 IF v.status<>'pending' THEN RAISE EXCEPTION 'CLUB_APPLICATION_CLOSED' USING ERRCODE='22023';END IF;
 s:=CASE WHEN v.expires_at<=clock_timestamp() THEN 'expired' ELSE 'cancelled' END;
 UPDATE club_private.visit_applications SET status=s,resolved_at=clock_timestamp(),resolved_by=a WHERE id=p_id;
 RETURN club_private.visit_record(v.club_id,p_key,payload,jsonb_build_object('id',p_id,'status',s));
END$$;

CREATE OR REPLACE FUNCTION public.club_application_resolve(p_id uuid,p_accept boolean,p_key uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a uuid:=club_private.visit_require('applications');v club_private.visit_applications;c public.clubs;r jsonb;payload jsonb:=jsonb_build_array('resolveApplication',p_id,p_accept);s text;peer uuid;
BEGIN
 PERFORM club_private.visit_pilot_require((SELECT club_id FROM club_private.visit_applications WHERE id=p_id));

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

CREATE OR REPLACE FUNCTION public.club_application_restrict(p_club uuid,p_applicant uuid,p_restrict boolean,p_key uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE r jsonb;payload jsonb:=jsonb_build_array('restrictApplication',p_club,p_applicant,p_restrict);BEGIN
 PERFORM club_private.visit_pilot_require(p_club);

 PERFORM club_private.visit_require('applications');PERFORM club_private.lock_club(p_club);
 IF COALESCE(club_private.my_role(p_club),'') NOT IN('owner','admin') THEN RAISE EXCEPTION 'CLUB_FORBIDDEN' USING ERRCODE='42501';END IF;
 IF p_applicant IS NULL OR p_restrict IS NULL OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_applicant) THEN RAISE EXCEPTION 'CLUB_INVALID_INPUT' USING ERRCODE='22023';END IF;
 r:=club_private.visit_replay(p_key,payload);IF r IS NOT NULL THEN RETURN r;END IF;
 IF p_restrict THEN INSERT INTO club_private.visit_restrictions VALUES(p_club,p_applicant) ON CONFLICT DO NOTHING;
 ELSE DELETE FROM club_private.visit_restrictions WHERE club_id=p_club AND applicant=p_applicant;END IF;
 RETURN club_private.visit_record(p_club,p_key,payload,jsonb_build_object('restricted',p_restrict));
END$$;

CREATE OR REPLACE FUNCTION public.club_visit_image_stage(p_club uuid,p_slot text,p_source text,p_data text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE c public.clubs;b bytea;m jsonb;expected text;BEGIN
 PERFORM club_private.visit_pilot_require(p_club);

 PERFORM club_private.visit_require('images');c:=club_private.lock_club(p_club);
 IF COALESCE(club_private.my_role(p_club),'') NOT IN('owner','admin') THEN RAISE EXCEPTION 'CLUB_FORBIDDEN' USING ERRCODE='42501';END IF;
 IF p_slot IS NULL OR p_slot NOT IN('cover','logo') OR p_source IS NULL OR p_source IS DISTINCT FROM (CASE WHEN p_slot='cover' THEN c.cover_path ELSE c.logo_path END) OR p_data IS NULL OR char_length(p_data)>4194304 THEN RAISE EXCEPTION 'CLUB_INVALID_IMAGE' USING ERRCODE='22023';END IF;
 BEGIN b:=decode(p_data,'base64');EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'CLUB_INVALID_IMAGE' USING ERRCODE='22023';END;
 SELECT metadata INTO m FROM storage.objects WHERE bucket_id='club-profile-images' AND name=p_source;
 expected:=CASE WHEN p_slot='cover' THEN 'image/jpeg' ELSE 'image/png' END;
 IF m IS NULL OR m->>'mimetype'<>expected OR octet_length(b) NOT BETWEEN 1 AND 3145728 OR (m->>'size')::bigint<>octet_length(b) OR trim(both '"' from m->>'eTag') IS DISTINCT FROM md5(b) OR (p_slot='cover' AND substring(b from 1 for 3)<>decode('ffd8ff','hex')) OR (p_slot='logo' AND substring(b from 1 for 8)<>decode('89504e470d0a1a0a','hex')) THEN RAISE EXCEPTION 'CLUB_INVALID_IMAGE' USING ERRCODE='22023';END IF;
 INSERT INTO club_private.visit_image_payloads VALUES(p_club,p_source,expected,b) ON CONFLICT(club_id,source_path) DO NOTHING;
END$$;

CREATE OR REPLACE FUNCTION public.club_visit_publish_web(p_club uuid,p_revision bigint,p_body text,p_cover boolean,p_logo boolean,p_applications boolean,p_show_member_count boolean,p_key uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE payload jsonb:=jsonb_build_array('publishWeb',p_club,p_revision,p_body,p_cover,p_logo,p_applications,p_show_member_count);r jsonb;BEGIN
 PERFORM club_private.visit_pilot_require(p_club);

 PERFORM club_private.visit_require('visits');PERFORM club_private.lock_club(p_club);
 IF COALESCE(club_private.my_role(p_club),'') NOT IN('owner','admin') THEN RAISE EXCEPTION 'CLUB_FORBIDDEN' USING ERRCODE='42501';END IF;
 IF p_show_member_count IS NULL THEN RAISE EXCEPTION 'CLUB_INVALID_INPUT' USING ERRCODE='22023';END IF;
 r:=club_private.visit_replay(p_key,payload);IF r IS NOT NULL THEN RETURN r;END IF;
 r:=public.club_visit_publish(p_club,p_revision,p_body,p_cover,p_logo,p_applications,md5(p_key::text||':profile')::uuid);
 UPDATE club_private.visit_profiles SET show_member_count=p_show_member_count WHERE club_id=p_club;
 RETURN club_private.visit_record(p_club,p_key,payload,r);
END$$;

CREATE OR REPLACE FUNCTION public.club_ride_visit_settings(p_club uuid,p_after uuid DEFAULT NULL,p_limit integer DEFAULT 30) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 PERFORM club_private.visit_pilot_require(p_club);PERFORM club_private.visit_meter(p_club,'read');

 PERFORM club_private.visit_require('rides');
 IF COALESCE(club_private.my_role(p_club),'') NOT IN('owner','admin') THEN RAISE EXCEPTION 'CLUB_FORBIDDEN' USING ERRCODE='42501';END IF;
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'CLUB_INVALID_INPUT' USING ERRCODE='22023';END IF;
 RETURN COALESCE((SELECT jsonb_agg(to_jsonb(q) ORDER BY ride_id) FROM(SELECT ride_id,revision,published,title,body,area FROM club_private.visit_rides WHERE club_id=p_club AND (p_after IS NULL OR ride_id>p_after) ORDER BY ride_id LIMIT p_limit)q),'[]');
END$$;

CREATE OR REPLACE FUNCTION public.club_visit_watch(p_club uuid) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a uuid:=club_private.visit_require('visits');r bigint;old timestamptz;BEGIN
 PERFORM club_private.visit_pilot_require(p_club);
 IF NOT club_private.visit_can_read(p_club) AND club_private.my_role(p_club) IS NULL THEN RAISE EXCEPTION 'CLUB_VISIT_UNAVAILABLE' USING ERRCODE='42501';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('visit-watch:'||a::text,0));
 SELECT touched_at INTO old FROM club_private.visit_watchers WHERE actor=a AND club_id=p_club;
 IF old IS NULL THEN PERFORM club_private.visit_meter(p_club,'watch');END IF;
 IF old IS NULL OR old<=clock_timestamp()-interval '5 minutes' THEN
  INSERT INTO club_private.visit_watchers(actor,club_id) VALUES(a,p_club) ON CONFLICT(actor,club_id) DO UPDATE SET touched_at=clock_timestamp();
  PERFORM club_private.chat_signal(a);
 END IF;
 SELECT revision INTO r FROM public.club_chat_signals WHERE user_id=a;RETURN COALESCE(r,0);
END$$;

CREATE OR REPLACE FUNCTION public.club_visit_image(p_club uuid,p_slot text,p_revision bigint) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v club_private.visit_profiles;path text;result jsonb;BEGIN
 PERFORM club_private.visit_pilot_require(p_club);
 PERFORM club_private.visit_require('images');
 IF NOT club_private.visit_can_read(p_club) OR p_slot IS NULL OR p_slot NOT IN('cover','logo') THEN RAISE EXCEPTION 'CLUB_VISIT_UNAVAILABLE' USING ERRCODE='42501';END IF;
 SELECT * INTO v FROM club_private.visit_profiles WHERE club_id=p_club;
 IF v.revision IS DISTINCT FROM p_revision THEN RAISE EXCEPTION 'CLUB_VISIT_CHANGED' USING ERRCODE='PT409';END IF;
 path:=CASE WHEN p_slot='cover' THEN v.cover_path ELSE v.logo_path END;
 SELECT jsonb_build_object('mime',mime,'data',encode(bytes,'base64'),'revision',v.revision) INTO result FROM club_private.visit_image_payloads WHERE club_id=p_club AND source_path=path;
 IF result IS NULL THEN RAISE EXCEPTION 'CLUB_VISIT_UNAVAILABLE' USING ERRCODE='42501';END IF;
 PERFORM club_private.visit_meter(p_club,'image',(SELECT octet_length(bytes) FROM club_private.visit_image_payloads WHERE club_id=p_club AND source_path=path));
 PERFORM set_config('response.headers','[{"Cache-Control":"private, no-store, max-age=0"},{"Pragma":"no-cache"},{"X-Content-Type-Options":"nosniff"}]',true);
 RETURN result;
END$$;

COMMIT;
