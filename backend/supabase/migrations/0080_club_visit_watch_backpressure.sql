BEGIN;
-- Avoid registration storms causing legitimate catalog images to hit read quotas.
CREATE OR REPLACE FUNCTION public.club_visit_watch(p_club uuid) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a uuid:=club_private.visit_require('visits');r bigint;old timestamptz;BEGIN
 PERFORM club_private.visit_pilot_require(p_club);
 IF NOT club_private.visit_can_read(p_club) AND club_private.my_role(p_club) IS NULL THEN RAISE EXCEPTION 'CLUB_VISIT_UNAVAILABLE' USING ERRCODE='42501';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('visit-watch:'||a::text,0));
 SELECT touched_at INTO old FROM club_private.visit_watchers WHERE actor=a AND club_id=p_club;
 IF old IS NULL OR old<=clock_timestamp()-interval '30 days' THEN PERFORM club_private.visit_meter(p_club,'watch');END IF;
 IF old IS NULL OR old<=clock_timestamp()-interval '5 minutes' THEN
  INSERT INTO club_private.visit_watchers(actor,club_id) VALUES(a,p_club) ON CONFLICT(actor,club_id) DO UPDATE SET touched_at=clock_timestamp();
  -- Registration is not a content change. Caller performs an authorized catch-up read.
 END IF;
 SELECT revision INTO r FROM public.club_chat_signals WHERE user_id=a;RETURN COALESCE(r,0);
END$$;
CREATE OR REPLACE FUNCTION public.club_visit_image(p_club uuid,p_slot text,p_revision bigint) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v club_private.visit_profiles;path text;result jsonb;size bigint;BEGIN
 PERFORM club_private.visit_pilot_require(p_club);PERFORM club_private.visit_require('images');
 IF NOT club_private.visit_can_read(p_club) OR p_slot IS NULL OR p_slot NOT IN('cover','logo') THEN RAISE EXCEPTION 'CLUB_VISIT_UNAVAILABLE' USING ERRCODE='42501';END IF;
 SELECT * INTO v FROM club_private.visit_profiles WHERE club_id=p_club;
 IF v.revision IS DISTINCT FROM p_revision THEN RAISE EXCEPTION 'CLUB_VISIT_CHANGED' USING ERRCODE='PT409';END IF;
 path:=CASE WHEN p_slot='cover' THEN v.cover_path ELSE v.logo_path END;
 SELECT octet_length(bytes) INTO size FROM club_private.visit_image_payloads WHERE club_id=p_club AND source_path=path;
 IF size IS NULL THEN RAISE EXCEPTION 'CLUB_VISIT_UNAVAILABLE' USING ERRCODE='42501';END IF;
 PERFORM club_private.visit_meter(p_club,'image',size);
 SELECT jsonb_build_object('mime',mime,'data',encode(bytes,'base64'),'revision',v.revision) INTO result FROM club_private.visit_image_payloads WHERE club_id=p_club AND source_path=path;
 PERFORM set_config('response.headers','[{"Cache-Control":"private, no-store, max-age=0"},{"Pragma":"no-cache"},{"X-Content-Type-Options":"nosniff"}]',true);
 RETURN result;
END$$;
CREATE TRIGGER visit_pilot_signal AFTER INSERT OR UPDATE OR DELETE ON club_private.visit_pilot FOR EACH ROW EXECUTE FUNCTION club_private.visit_notify();
COMMIT;
