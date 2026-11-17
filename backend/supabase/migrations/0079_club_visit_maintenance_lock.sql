BEGIN;
-- Operator maintenance has no end-user JWT; use the same row lock without requiring a session.
CREATE OR REPLACE FUNCTION club_private.visit_prune_images(p_club uuid,p_now timestamptz) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE n bigint;BEGIN
 PERFORM 1 FROM public.clubs WHERE id=p_club FOR UPDATE;
 DELETE FROM club_private.visit_image_payloads i WHERE i.club_id=p_club AND NOT EXISTS(SELECT 1 FROM club_private.visit_profiles v WHERE v.club_id=i.club_id AND i.source_path IN(v.cover_path,v.logo_path)) AND ((NOT i.ever_referenced AND i.created_at<=p_now-interval '24 hours') OR (i.ever_referenced AND i.unreferenced_at<=p_now-interval '7 days'));
 GET DIAGNOSTICS n=ROW_COUNT;RETURN n;
END$$;
CREATE OR REPLACE FUNCTION club_private.visit_image_capacity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE victim text;BEGIN
 PERFORM 1 FROM public.clubs WHERE id=NEW.club_id FOR UPDATE;
 IF EXISTS(SELECT 1 FROM club_private.visit_image_payloads WHERE club_id=NEW.club_id AND source_path=NEW.source_path) THEN RETURN NULL;END IF;
 PERFORM club_private.visit_prune_images(NEW.club_id,clock_timestamp());
 WHILE (SELECT count(*)>=6 OR COALESCE(sum(octet_length(bytes)),0)+octet_length(NEW.bytes)>18874368 FROM club_private.visit_image_payloads WHERE club_id=NEW.club_id) LOOP
  SELECT i.source_path INTO victim FROM club_private.visit_image_payloads i WHERE i.club_id=NEW.club_id AND NOT EXISTS(SELECT 1 FROM club_private.visit_profiles v WHERE v.club_id=i.club_id AND i.source_path IN(v.cover_path,v.logo_path)) ORDER BY i.created_at,i.source_path LIMIT 1;
  IF victim IS NULL THEN RAISE EXCEPTION 'CLUB_VISIT_IMAGE_CAPACITY' USING ERRCODE='PT429';END IF;
  DELETE FROM club_private.visit_image_payloads WHERE club_id=NEW.club_id AND source_path=victim;
 END LOOP;
 IF auth.uid() IS NOT NULL THEN PERFORM club_private.visit_meter(NEW.club_id,'upload');END IF;
 RETURN NEW;
END$$;
COMMIT;
