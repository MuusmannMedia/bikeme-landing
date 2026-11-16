BEGIN;
CREATE FUNCTION public.club_visit_settings(p_club uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 PERFORM club_private.visit_require('visits');
 IF COALESCE(club_private.my_role(p_club),'') NOT IN('owner','admin') THEN RAISE EXCEPTION 'CLUB_FORBIDDEN' USING ERRCODE='42501'; END IF;
 RETURN COALESCE((SELECT to_jsonb(v) FROM club_private.visit_profiles v WHERE club_id=p_club),jsonb_build_object('club_id',p_club,'revision',0,'published',false,'applications_open',false));
END$$;
-- Image booleans publish an exact snapshot of currently authorized profile references.
CREATE FUNCTION public.club_visit_publish(p_club uuid,p_revision bigint,p_body text,p_cover boolean,p_logo boolean,p_applications boolean,p_key uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE c public.clubs; a uuid; r jsonb; payload jsonb; v club_private.visit_profiles;
BEGIN
 a:=club_private.visit_require('visits'); c:=club_private.lock_club(p_club);
 IF COALESCE(club_private.my_role(p_club),'') NOT IN('owner','admin') THEN RAISE EXCEPTION 'CLUB_FORBIDDEN' USING ERRCODE='42501';END IF;
 IF p_cover IS NULL OR p_logo IS NULL OR p_applications IS NULL OR p_revision IS NULL OR char_length(COALESCE(p_body,''))>1000 THEN RAISE EXCEPTION 'CLUB_INVALID_INPUT' USING ERRCODE='22023';END IF;
 IF p_cover OR p_logo THEN PERFORM club_private.visit_require('images'); END IF;
 IF p_applications THEN PERFORM club_private.visit_require('applications');END IF;
 payload:=jsonb_build_array('publish',p_club,p_revision,p_body,p_cover,p_logo,p_applications);
 r:=club_private.visit_replay(p_key,payload);IF r IS NOT NULL THEN RETURN r;END IF;
 SELECT * INTO v FROM club_private.visit_profiles WHERE club_id=p_club;
 IF COALESCE(v.revision,0)<>p_revision THEN RAISE EXCEPTION 'CLUB_VISIT_CHANGED' USING ERRCODE='PT409';END IF;
 INSERT INTO club_private.visit_profiles(club_id,revision,published,applications_open,name,body,cover_path,logo_path,cover_frame,logo_frame,published_by)
 VALUES(p_club,p_revision+1,true,p_applications,c.name,btrim(COALESCE(p_body,'')),CASE WHEN p_cover THEN c.cover_path END,CASE WHEN p_logo THEN c.logo_path END,CASE WHEN p_cover THEN c.cover_frame END,CASE WHEN p_logo THEN c.logo_frame END,a)
 ON CONFLICT(club_id) DO UPDATE SET revision=excluded.revision,published=true,applications_open=excluded.applications_open,name=excluded.name,body=excluded.body,cover_path=excluded.cover_path,logo_path=excluded.logo_path,cover_frame=excluded.cover_frame,logo_frame=excluded.logo_frame,published_by=a;
 RETURN club_private.visit_record(p_club,p_key,payload,jsonb_build_object('revision',p_revision+1));
END$$;
CREATE FUNCTION public.club_visit_unpublish(p_club uuid,p_revision bigint,p_key uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE r jsonb;payload jsonb:=jsonb_build_array('unpublish',p_club,p_revision);v club_private.visit_profiles;
BEGIN
 PERFORM club_private.visit_require('visits');PERFORM club_private.lock_club(p_club);
 IF COALESCE(club_private.my_role(p_club),'') NOT IN('owner','admin') THEN RAISE EXCEPTION 'CLUB_FORBIDDEN' USING ERRCODE='42501';END IF;
 r:=club_private.visit_replay(p_key,payload);IF r IS NOT NULL THEN RETURN r;END IF;
 SELECT * INTO v FROM club_private.visit_profiles WHERE club_id=p_club;
 IF NOT FOUND OR v.revision IS DISTINCT FROM p_revision THEN RAISE EXCEPTION 'CLUB_VISIT_CHANGED' USING ERRCODE='PT409';END IF;
 UPDATE club_private.visit_profiles SET published=false,applications_open=false,revision=revision+1 WHERE club_id=p_club;
 RETURN club_private.visit_record(p_club,p_key,payload,jsonb_build_object('revision',p_revision+1));
END$$;
CREATE FUNCTION public.club_visit_profile(p_club uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v club_private.visit_profiles; f club_private.visit_flags;
BEGIN
 PERFORM club_private.visit_require('visits');
 IF NOT club_private.visit_can_read(p_club) THEN RAISE EXCEPTION 'CLUB_VISIT_UNAVAILABLE' USING ERRCODE='42501';END IF;
 SELECT * INTO v FROM club_private.visit_profiles WHERE club_id=p_club;SELECT * INTO f FROM club_private.visit_flags WHERE singleton;
 RETURN jsonb_build_object('id',p_club,'name',v.name,'description',v.body,'revision',v.revision,'applications_open',v.applications_open AND f.applications,
 'cover_path',CASE WHEN f.images THEN v.cover_path END,'logo_path',CASE WHEN f.images THEN v.logo_path END,'cover_frame',CASE WHEN f.images THEN v.cover_frame END,'logo_frame',CASE WHEN f.images THEN v.logo_frame END);
END$$;
CREATE FUNCTION public.club_visit_watch(p_club uuid) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a uuid:=club_private.visit_require('visits');r bigint;
BEGIN
 IF NOT club_private.visit_can_read(p_club) AND club_private.my_role(p_club) IS NULL THEN RAISE EXCEPTION 'CLUB_VISIT_UNAVAILABLE' USING ERRCODE='42501';END IF;
 INSERT INTO club_private.visit_watchers(actor,club_id) VALUES(a,p_club) ON CONFLICT(actor,club_id) DO UPDATE SET touched_at=clock_timestamp();
 PERFORM club_private.chat_signal(a);SELECT revision INTO r FROM public.club_chat_signals WHERE user_id=a;RETURN r;
END$$;
CREATE FUNCTION club_private.visit_image_allowed(p_path text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT EXISTS(SELECT 1 FROM club_private.visit_flags f,club_private.visit_profiles v WHERE f.singleton AND f.images AND club_private.visit_can_read(v.club_id) AND(p_path=v.cover_path OR p_path=v.logo_path));
$$;
-- Keep legacy member access exactly, OR the precise enabled visitor authorization.
ALTER POLICY club_profile_image_read_boundary ON storage.objects USING(bucket_id<>'club-profile-images' OR club_private.can_read_profile_image(name) OR club_private.visit_image_allowed(name));
CREATE POLICY club_visit_image_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='club-profile-images' AND club_private.visit_image_allowed(name));
CREATE FUNCTION public.club_ride_visit_publish(p_club uuid,p_ride uuid,p_revision bigint,p_title text,p_body text,p_area text,p_key uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a uuid:=club_private.visit_require('rides');r jsonb;payload jsonb:=jsonb_build_array('ridePublish',p_club,p_ride,p_revision,p_title,p_body,p_area);v club_private.visit_rides;
BEGIN
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
CREATE FUNCTION public.club_ride_visit_unpublish(p_club uuid,p_ride uuid,p_revision bigint,p_key uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE r jsonb;payload jsonb:=jsonb_build_array('rideUnpublish',p_club,p_ride,p_revision);
BEGIN
 PERFORM club_private.visit_require('rides');PERFORM club_private.lock_club(p_club);
 IF COALESCE(club_private.my_role(p_club),'') NOT IN('owner','admin') THEN RAISE EXCEPTION 'CLUB_FORBIDDEN' USING ERRCODE='42501';END IF;
 r:=club_private.visit_replay(p_key,payload);IF r IS NOT NULL THEN RETURN r;END IF;
 UPDATE club_private.visit_rides SET published=false,revision=revision+1 WHERE club_id=p_club AND ride_id=p_ride AND revision=p_revision;
 IF NOT FOUND THEN RAISE EXCEPTION 'CLUB_VISIT_CHANGED' USING ERRCODE='PT409';END IF;
 RETURN club_private.visit_record(p_club,p_key,payload,jsonb_build_object('revision',p_revision+1));
END$$;
CREATE FUNCTION public.club_visit_rides(p_club uuid,p_after uuid DEFAULT NULL,p_limit integer DEFAULT 20) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 PERFORM club_private.visit_require('rides');IF NOT club_private.visit_can_read(p_club) THEN RAISE EXCEPTION 'CLUB_VISIT_UNAVAILABLE' USING ERRCODE='42501';END IF;
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'CLUB_INVALID_INPUT' USING ERRCODE='22023';END IF;
 RETURN COALESCE((SELECT jsonb_agg(to_jsonb(q) ORDER BY id) FROM(SELECT r.id,v.title,v.body description,v.area,r.start_time,r.discipline,r.distance_km,r.status,v.revision FROM club_private.visit_rides v JOIN public.rides r ON r.id=v.ride_id WHERE v.club_id=p_club AND r.club_id=p_club AND v.published AND r.club_closed_at IS NULL AND r.status='ACTIVE' AND r.type='EVENT' AND r.visibility='private' AND r.start_time>statement_timestamp() AND (p_after IS NULL OR r.id>p_after) AND NOT dm_private.blocked_pair(auth.uid(),r.host_id) ORDER BY r.id LIMIT p_limit)q),'[]');
END$$;
CREATE FUNCTION club_private.visit_ride_changed() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN IF OLD.club_id IS NOT NULL AND EXISTS(SELECT 1 FROM club_private.visit_rides WHERE ride_id=OLD.id) THEN PERFORM club_private.visit_signal(OLD.club_id);END IF;RETURN NULL;END$$;
CREATE TRIGGER visit_ride_lifecycle AFTER UPDATE OR DELETE ON public.rides FOR EACH ROW EXECUTE FUNCTION club_private.visit_ride_changed();
COMMIT;
