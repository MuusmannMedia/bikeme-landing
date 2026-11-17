BEGIN;
-- Only the new visitor contracts. No legacy/member/iOS definitions are replaced.
CREATE TABLE club_private.visit_pilot(club_id uuid PRIMARY KEY REFERENCES public.clubs(id) ON DELETE CASCADE,enabled boolean NOT NULL DEFAULT true,selected_at timestamptz NOT NULL DEFAULT clock_timestamp());
ALTER TABLE club_private.visit_pilot ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION club_private.visit_pilot_cap() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('visit-pilot-cap',0));
 IF NEW.enabled AND NOT EXISTS(SELECT 1 FROM club_private.visit_pilot WHERE club_id=NEW.club_id AND enabled) AND (SELECT count(*) FROM club_private.visit_pilot WHERE enabled)>=20 THEN RAISE EXCEPTION 'CLUB_VISIT_PILOT_FULL' USING ERRCODE='22023';END IF;
 RETURN NEW;
END$$;
CREATE TRIGGER visit_pilot_cap BEFORE INSERT OR UPDATE ON club_private.visit_pilot FOR EACH ROW EXECUTE FUNCTION club_private.visit_pilot_cap();
-- Deliberately no seed/autojoin: operator explicitly selects clubs in each environment.
CREATE FUNCTION club_private.visit_pilot_require(p_club uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 PERFORM club_private.visit_require('visits');
 IF NOT EXISTS(SELECT 1 FROM club_private.visit_pilot WHERE club_id=p_club AND enabled) THEN RAISE EXCEPTION 'CLUB_VISIT_UNAVAILABLE' USING ERRCODE='42501';END IF;
END$$;
CREATE TABLE club_private.visit_usage(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,actor uuid REFERENCES auth.users(id) ON DELETE CASCADE,club_id uuid REFERENCES public.clubs(id) ON DELETE CASCADE,kind text NOT NULL CHECK(kind IN('read','image','write','publish','upload','watch')),amount bigint NOT NULL DEFAULT 1 CHECK(amount>0),at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE INDEX visit_usage_actor ON club_private.visit_usage(actor,kind,at);
CREATE INDEX visit_usage_club ON club_private.visit_usage(club_id,kind,at);
ALTER TABLE club_private.visit_usage ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION club_private.visit_meter(p_club uuid,p_kind text,p_amount bigint DEFAULT 1) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a uuid:=club_private.require_user();n integer;recent integer;b bigint;t timestamptz:=clock_timestamp();BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('visit-meter:'||a::text,0));
 IF p_kind IN('publish','upload') THEN PERFORM pg_advisory_xact_lock(hashtextextended('visit-meter-club:'||p_club::text,0)); END IF;
 IF p_kind='publish' THEN
  SELECT count(*) INTO n FROM club_private.visit_usage WHERE club_id=p_club AND kind=p_kind AND at>t-interval '1 day';
  IF n>=10 THEN RAISE EXCEPTION 'CLUB_VISIT_RATE_LIMIT' USING ERRCODE='PT429';END IF;
 ELSIF p_kind='upload' THEN
  SELECT count(*) FILTER(WHERE at>t-interval '1 day'),count(*) INTO n,recent FROM club_private.visit_usage WHERE club_id=p_club AND kind=p_kind AND at>t-interval '7 days';
  IF n>=4 OR recent>=12 THEN RAISE EXCEPTION 'CLUB_VISIT_RATE_LIMIT' USING ERRCODE='PT429';END IF;
 ELSE
  SELECT count(*),count(*) FILTER(WHERE at>t-interval '1 second'),COALESCE(sum(amount),0) INTO n,recent,b FROM club_private.visit_usage WHERE actor=a AND kind=p_kind AND at>t-interval '1 minute';
  IF (p_kind='write' AND (n>=10 OR recent>=3)) OR (p_kind='read' AND n>=120) OR (p_kind='image' AND (n>=30 OR recent>=6 OR b+p_amount>62914560)) OR (p_kind='watch' AND n>=12) THEN RAISE EXCEPTION 'CLUB_VISIT_RATE_LIMIT' USING ERRCODE='PT429';END IF;
 END IF;
 INSERT INTO club_private.visit_usage(actor,club_id,kind,amount,at) VALUES(a,p_club,p_kind,p_amount,t);
END$$;
ALTER TABLE club_private.visit_intents ALTER COLUMN payload DROP NOT NULL,ALTER COLUMN result DROP NOT NULL,ADD COLUMN created_at timestamptz NOT NULL DEFAULT clock_timestamp(),ADD COLUMN payload_hash text,ADD COLUMN compacted_at timestamptz;
UPDATE club_private.visit_intents SET payload_hash=encode(sha256(convert_to(payload::text,'UTF8')),'hex');
ALTER TABLE club_private.visit_intents ALTER COLUMN payload_hash SET NOT NULL;
CREATE OR REPLACE FUNCTION club_private.visit_replay(p_key uuid,p_payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE r club_private.visit_intents;BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('visit-intent:'||auth.uid()::text,0));
 IF p_key IS NULL THEN RAISE EXCEPTION 'CLUB_INVALID_INPUT' USING ERRCODE='22023';END IF;
 SELECT * INTO r FROM club_private.visit_intents WHERE actor=auth.uid() AND key=p_key;
 IF FOUND THEN
  IF r.payload_hash IS DISTINCT FROM encode(sha256(convert_to(p_payload::text,'UTF8')),'hex') THEN RAISE EXCEPTION 'CLUB_IDEMPOTENCY_CONFLICT' USING ERRCODE='22023';END IF;
  IF r.compacted_at IS NOT NULL OR r.created_at<=clock_timestamp()-interval '7 days' THEN RAISE EXCEPTION 'CLUB_VISIT_RECEIPT_EXPIRED' USING ERRCODE='PT410';END IF;
  RETURN r.result;
 END IF;RETURN NULL;
END$$;
CREATE OR REPLACE FUNCTION club_private.visit_record(p_club uuid,p_key uuid,p_payload jsonb,p_result jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE op text:=p_payload->>0;BEGIN
 -- The web wrapper has an inner publish receipt; charge that logical action once.
 -- Safety withdrawals/cancellations/restrictions remain possible after write quota.
 IF op NOT IN('publishWeb','unpublish','rideUnpublish','cancelApplication','restrictApplication') THEN PERFORM club_private.visit_meter(p_club,'write');END IF;
 IF op IN('publish','ridePublish') THEN PERFORM club_private.visit_meter(p_club,'publish');END IF;
 INSERT INTO club_private.visit_intents(actor,key,club_id,payload,result,payload_hash) VALUES(auth.uid(),p_key,p_club,p_payload,p_result,encode(sha256(convert_to(p_payload::text,'UTF8')),'hex'));
 RETURN p_result;
END$$;
ALTER TABLE club_private.visit_image_payloads ADD COLUMN created_at timestamptz NOT NULL DEFAULT clock_timestamp(),ADD COLUMN ever_referenced boolean NOT NULL DEFAULT false,ADD COLUMN unreferenced_at timestamptz;
UPDATE club_private.visit_image_payloads i SET ever_referenced=true WHERE EXISTS(SELECT 1 FROM club_private.visit_profiles v WHERE v.club_id=i.club_id AND i.source_path IN(v.cover_path,v.logo_path));
CREATE FUNCTION club_private.visit_image_references() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 UPDATE club_private.visit_image_payloads i SET ever_referenced=true,unreferenced_at=NULL WHERE i.club_id=NEW.club_id AND i.source_path IN(NEW.cover_path,NEW.logo_path);
 UPDATE club_private.visit_image_payloads i SET unreferenced_at=clock_timestamp() WHERE i.club_id=NEW.club_id AND i.ever_referenced AND i.unreferenced_at IS NULL AND NOT(i.source_path=ANY(array_remove(ARRAY[NEW.cover_path,NEW.logo_path],NULL)));
 RETURN NULL;
END$$;
CREATE TRIGGER visit_image_references AFTER INSERT OR UPDATE OF cover_path,logo_path ON club_private.visit_profiles FOR EACH ROW EXECUTE FUNCTION club_private.visit_image_references();
CREATE FUNCTION club_private.visit_prune_images(p_club uuid,p_now timestamptz) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE n bigint;BEGIN
 PERFORM club_private.lock_club(p_club);
 DELETE FROM club_private.visit_image_payloads i WHERE i.club_id=p_club AND NOT EXISTS(SELECT 1 FROM club_private.visit_profiles v WHERE v.club_id=i.club_id AND i.source_path IN(v.cover_path,v.logo_path)) AND ((NOT i.ever_referenced AND i.created_at<=p_now-interval '24 hours') OR (i.ever_referenced AND i.unreferenced_at<=p_now-interval '7 days'));
 GET DIAGNOSTICS n=ROW_COUNT;RETURN n;
END$$;
CREATE FUNCTION club_private.visit_image_capacity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE victim text;BEGIN
 PERFORM club_private.lock_club(NEW.club_id);
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
CREATE TRIGGER visit_image_capacity BEFORE INSERT ON club_private.visit_image_payloads FOR EACH ROW EXECUTE FUNCTION club_private.visit_image_capacity();
CREATE OR REPLACE FUNCTION club_private.visit_can_read(p_club uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM club_private.visit_flags f,club_private.visit_pilot p,club_private.visit_profiles v JOIN public.clubs c ON c.id=v.club_id WHERE p.club_id=p_club AND p.enabled AND f.singleton AND f.visits AND v.club_id=p_club AND v.published AND NOT dm_private.blocked_pair(auth.uid(),c.owner_id));
$$;
CREATE FUNCTION club_private.visit_maintenance(p_now timestamptz DEFAULT clock_timestamp(),p_clubs uuid[] DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE c uuid;n bigint:=0;k bigint;redacted bigint;removed bigint;receipts bigint;BEGIN
 -- Operator-only. Tests may simulate time ONLY with an explicit disposable scope.
 IF p_now IS NULL OR (p_clubs IS NULL AND abs(extract(epoch FROM p_now-clock_timestamp()))>60) THEN RAISE EXCEPTION 'CLUB_INVALID_INPUT' USING ERRCODE='22023';END IF;
 FOR c IN SELECT id FROM public.clubs WHERE p_clubs IS NULL OR id=ANY(p_clubs) ORDER BY id LOOP n:=n+club_private.visit_prune_images(c,p_now);END LOOP;
 UPDATE club_private.visit_applications SET status='expired',resolved_at=expires_at WHERE status='pending' AND expires_at<=p_now AND (p_clubs IS NULL OR club_id=ANY(p_clubs));
 UPDATE club_private.visit_applications SET body='' WHERE status<>'pending' AND COALESCE(resolved_at,expires_at)<=p_now-interval '90 days' AND body<>'' AND (p_clubs IS NULL OR club_id=ANY(p_clubs));GET DIAGNOSTICS redacted=ROW_COUNT;
 DELETE FROM club_private.visit_applications WHERE status<>'pending' AND COALESCE(resolved_at,expires_at)<=p_now-interval '365 days' AND (p_clubs IS NULL OR club_id=ANY(p_clubs));GET DIAGNOSTICS removed=ROW_COUNT;
 UPDATE club_private.visit_intents SET payload=NULL,result=NULL,compacted_at=p_now WHERE compacted_at IS NULL AND created_at<=p_now-interval '7 days' AND (p_clubs IS NULL OR club_id=ANY(p_clubs));GET DIAGNOSTICS receipts=ROW_COUNT;
 DELETE FROM club_private.visit_watchers WHERE touched_at<=p_now-interval '31 days' AND (p_clubs IS NULL OR club_id=ANY(p_clubs));
 DELETE FROM club_private.visit_usage WHERE at<=p_now-interval '8 days' AND (p_clubs IS NULL OR club_id=ANY(p_clubs));
 RETURN jsonb_build_object('images',n,'application_texts',redacted,'applications',removed,'receipts',receipts);
END$$;
REVOKE ALL ON club_private.visit_pilot,club_private.visit_usage FROM PUBLIC,anon,authenticated,service_role;
DO $$DECLARE f regprocedure;BEGIN FOR f IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='club_private' AND p.proname IN('visit_pilot_cap','visit_pilot_require','visit_meter','visit_replay','visit_record','visit_image_references','visit_prune_images','visit_image_capacity','visit_maintenance') LOOP EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',f);END LOOP;END$$;
COMMIT;
