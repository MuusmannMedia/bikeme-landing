BEGIN;
-- Exempt actual safety transitions, not endless no-op receipts under fresh keys.
CREATE FUNCTION club_private.visit_record(p_club uuid,p_key uuid,p_payload jsonb,p_result jsonb,p_safety boolean) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE op text:=p_payload->>0;BEGIN
 IF op<>'publishWeb' AND NOT COALESCE(p_safety,false) THEN PERFORM club_private.visit_meter(p_club,'write');END IF;
 IF op IN('publish','ridePublish') THEN PERFORM club_private.visit_meter(p_club,'publish');END IF;
 INSERT INTO club_private.visit_intents(actor,key,club_id,payload,result,payload_hash) VALUES(auth.uid(),p_key,p_club,p_payload,p_result,encode(sha256(convert_to(p_payload::text,'UTF8')),'hex'));
 RETURN p_result;
END$$;
CREATE OR REPLACE FUNCTION club_private.visit_record(p_club uuid,p_key uuid,p_payload jsonb,p_result jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN RETURN club_private.visit_record(p_club,p_key,p_payload,p_result,false);END$$;
REVOKE ALL ON FUNCTION club_private.visit_record(uuid,uuid,jsonb,jsonb,boolean) FROM PUBLIC,anon,authenticated,service_role;
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
 RETURN club_private.visit_record(p_club,p_key,payload,jsonb_build_object('revision',p_revision+1),v.published);
END$$;
CREATE OR REPLACE FUNCTION public.club_ride_visit_unpublish(p_club uuid,p_ride uuid,p_revision bigint,p_key uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE r jsonb;payload jsonb:=jsonb_build_array('rideUnpublish',p_club,p_ride,p_revision);was_published boolean;
BEGIN
 PERFORM club_private.visit_pilot_require(p_club);

 PERFORM club_private.visit_require('rides');PERFORM club_private.lock_club(p_club);
 IF COALESCE(club_private.my_role(p_club),'') NOT IN('owner','admin') THEN RAISE EXCEPTION 'CLUB_FORBIDDEN' USING ERRCODE='42501';END IF;
 r:=club_private.visit_replay(p_key,payload);IF r IS NOT NULL THEN RETURN r;END IF;
 SELECT published INTO was_published FROM club_private.visit_rides WHERE club_id=p_club AND ride_id=p_ride;
 UPDATE club_private.visit_rides SET published=false,revision=revision+1 WHERE club_id=p_club AND ride_id=p_ride AND revision=p_revision;
 IF NOT FOUND THEN RAISE EXCEPTION 'CLUB_VISIT_CHANGED' USING ERRCODE='PT409';END IF;
 RETURN club_private.visit_record(p_club,p_key,payload,jsonb_build_object('revision',p_revision+1),COALESCE(was_published,false));
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
 RETURN club_private.visit_record(v.club_id,p_key,payload,jsonb_build_object('id',p_id,'status',s),true);
END$$;
CREATE OR REPLACE FUNCTION public.club_application_restrict(p_club uuid,p_applicant uuid,p_restrict boolean,p_key uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE r jsonb;payload jsonb:=jsonb_build_array('restrictApplication',p_club,p_applicant,p_restrict);was_restricted boolean;BEGIN
 PERFORM club_private.visit_pilot_require(p_club);

 PERFORM club_private.visit_require('applications');PERFORM club_private.lock_club(p_club);
 IF COALESCE(club_private.my_role(p_club),'') NOT IN('owner','admin') THEN RAISE EXCEPTION 'CLUB_FORBIDDEN' USING ERRCODE='42501';END IF;
 IF p_applicant IS NULL OR p_restrict IS NULL OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_applicant) THEN RAISE EXCEPTION 'CLUB_INVALID_INPUT' USING ERRCODE='22023';END IF;
 r:=club_private.visit_replay(p_key,payload);IF r IS NOT NULL THEN RETURN r;END IF;
 was_restricted:=EXISTS(SELECT 1 FROM club_private.visit_restrictions WHERE club_id=p_club AND applicant=p_applicant);
 IF p_restrict THEN INSERT INTO club_private.visit_restrictions VALUES(p_club,p_applicant) ON CONFLICT DO NOTHING;
 ELSE DELETE FROM club_private.visit_restrictions WHERE club_id=p_club AND applicant=p_applicant;END IF;
 RETURN club_private.visit_record(p_club,p_key,payload,jsonb_build_object('restricted',p_restrict),p_restrict AND NOT was_restricted);
END$$;
COMMIT;
