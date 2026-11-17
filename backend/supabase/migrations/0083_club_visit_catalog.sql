BEGIN;
-- Additive catalogue contracts; original image bytes and legacy RPCs stay intact.
CREATE TABLE club_private.catalog_config(singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),enabled boolean NOT NULL DEFAULT false, signing_key bytea CHECK(octet_length(signing_key)>=32));
INSERT INTO club_private.catalog_config DEFAULT VALUES;
CREATE TABLE club_private.catalog_variants(club_id uuid NOT NULL,source_path text NOT NULL,slot text NOT NULL CHECK(slot IN('cover','logo')),version text NOT NULL CHECK(version='webp-v1'),source_hash text NOT NULL,media_revision text NOT NULL,bytes bytea NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),PRIMARY KEY(club_id,source_path,slot),FOREIGN KEY(club_id,source_path) REFERENCES club_private.visit_image_payloads(club_id,source_path) ON DELETE CASCADE,CHECK(octet_length(bytes) BETWEEN 1 AND CASE WHEN slot='cover' THEN 98304 ELSE 12288 END));
CREATE TABLE club_private.catalog_usage(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,actor uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,kind text NOT NULL CHECK(kind IN('manifest','media','binding')),amount bigint NOT NULL CHECK(amount>0),at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE INDEX catalog_usage_actor ON club_private.catalog_usage(actor,kind,at);
CREATE TABLE public.club_visit_catalog_signals(user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,revision bigint NOT NULL DEFAULT 1);
ALTER TABLE public.club_visit_catalog_signals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.club_visit_catalog_signals FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.club_visit_catalog_signals TO authenticated;
CREATE POLICY catalog_own_signal ON public.club_visit_catalog_signals FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()));
ALTER PUBLICATION supabase_realtime ADD TABLE public.club_visit_catalog_signals;
CREATE FUNCTION club_private.catalog_signal(p_actor uuid) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog AS $$
 INSERT INTO public.club_visit_catalog_signals(user_id) SELECT id FROM auth.users WHERE id=p_actor ON CONFLICT(user_id) DO UPDATE SET revision=club_visit_catalog_signals.revision+1;
$$;
CREATE FUNCTION club_private.catalog_notify() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a uuid;c uuid;b uuid;d uuid;BEGIN
 IF TG_TABLE_NAME IN('visit_flags','catalog_config') THEN
  FOR a IN SELECT DISTINCT actor FROM club_private.visit_watchers LOOP PERFORM club_private.catalog_signal(a);END LOOP;
 ELSIF TG_TABLE_NAME='blocks' THEN
  b:=COALESCE(NEW.blocker,OLD.blocker);d:=COALESCE(NEW.blocked,OLD.blocked);
  PERFORM club_private.catalog_signal(b);PERFORM club_private.catalog_signal(d);
 ELSE
  c:=CASE WHEN TG_TABLE_NAME='clubs' THEN COALESCE(NEW.id,OLD.id) ELSE COALESCE(NEW.club_id,OLD.club_id) END;
  IF TG_TABLE_NAME='club_members' THEN
   PERFORM club_private.catalog_signal(COALESCE(NEW.user_id,OLD.user_id));
   IF NOT EXISTS(SELECT 1 FROM club_private.visit_profiles WHERE club_id=c AND show_member_count) THEN RETURN NULL;END IF;
  END IF;
  FOR a IN SELECT DISTINCT actor FROM club_private.visit_watchers WHERE club_id=c AND touched_at>clock_timestamp()-interval '30 days' LOOP PERFORM club_private.catalog_signal(a);END LOOP;
 END IF;RETURN NULL;
END$$;
CREATE TRIGGER catalog_profile_signal AFTER INSERT OR UPDATE OR DELETE ON club_private.visit_profiles FOR EACH ROW EXECUTE FUNCTION club_private.catalog_notify();
CREATE TRIGGER catalog_flags_signal AFTER UPDATE ON club_private.visit_flags FOR EACH ROW EXECUTE FUNCTION club_private.catalog_notify();
CREATE TRIGGER catalog_config_signal AFTER UPDATE ON club_private.catalog_config FOR EACH ROW EXECUTE FUNCTION club_private.catalog_notify();
CREATE TRIGGER catalog_pilot_signal AFTER INSERT OR UPDATE OR DELETE ON club_private.visit_pilot FOR EACH ROW EXECUTE FUNCTION club_private.catalog_notify();
CREATE TRIGGER catalog_block_signal AFTER INSERT OR UPDATE OR DELETE ON dm_private.blocks FOR EACH ROW EXECUTE FUNCTION club_private.catalog_notify();
CREATE TRIGGER catalog_owner_signal AFTER UPDATE OF owner_id ON public.clubs FOR EACH ROW EXECUTE FUNCTION club_private.catalog_notify();
CREATE TRIGGER catalog_member_signal AFTER INSERT OR UPDATE OR DELETE ON public.club_members FOR EACH ROW EXECUTE FUNCTION club_private.catalog_notify();
CREATE FUNCTION club_private.catalog_require() RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a uuid:=club_private.visit_require('visits');BEGIN
 IF NOT EXISTS(SELECT 1 FROM club_private.catalog_config WHERE enabled) THEN RAISE EXCEPTION 'CLUB_VISIT_UNAVAILABLE' USING ERRCODE='42501';END IF;RETURN a;
END$$;
-- Shared actor lock and byte ceiling across scalar and catalogue delivery.
CREATE FUNCTION club_private.catalog_shared_meter() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a uuid:=NEW.actor;k text:=NEW.kind;t timestamptz:=clock_timestamp();old_bytes bigint;new_bytes bigint;bindings bigint;BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('visit-meter:'||a::text,0));
 IF k IN('image','media') THEN
  SELECT COALESCE(sum(amount),0) INTO old_bytes FROM club_private.visit_usage WHERE actor=a AND kind='image' AND at>t-interval '1 minute';
  SELECT COALESCE(sum(amount),0) INTO new_bytes FROM club_private.catalog_usage WHERE actor=a AND kind='media' AND at>t-interval '1 minute';
  IF old_bytes+new_bytes+NEW.amount>62914560 THEN RAISE EXCEPTION 'CLUB_VISIT_RATE_LIMIT' USING ERRCODE='PT429';END IF;
 ELSIF k IN('watch','binding') THEN
  SELECT count(*) INTO bindings FROM club_private.visit_usage WHERE actor=a AND kind='watch' AND at>t-interval '1 minute';
  SELECT bindings+COALESCE(sum(amount),0) INTO bindings FROM club_private.catalog_usage WHERE actor=a AND kind='binding' AND at>t-interval '1 minute';
  IF bindings+NEW.amount>20 THEN RAISE EXCEPTION 'CLUB_VISIT_RATE_LIMIT' USING ERRCODE='PT429';END IF;
 END IF;RETURN NEW;
END$$;
CREATE TRIGGER catalog_shared_old BEFORE INSERT ON club_private.visit_usage FOR EACH ROW EXECUTE FUNCTION club_private.catalog_shared_meter();
CREATE TRIGGER catalog_shared_new BEFORE INSERT ON club_private.catalog_usage FOR EACH ROW EXECUTE FUNCTION club_private.catalog_shared_meter();
CREATE FUNCTION club_private.catalog_meter(p_kind text,p_amount bigint DEFAULT 1) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a uuid:=club_private.require_user();n int;b bigint;burst int;t timestamptz:=clock_timestamp();wait int;BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('visit-meter:'||a::text,0));
 SELECT count(*),COALESCE(sum(amount),0),count(*) FILTER(WHERE at>t-interval '1 second') INTO n,b,burst FROM club_private.catalog_usage WHERE actor=a AND kind=p_kind AND at>t-interval '1 minute';
 IF (p_kind='manifest' AND(n>=12 OR burst>=2)) OR(p_kind='media' AND(n>=20 OR burst>=2 OR b+p_amount>10485760)) THEN
  SELECT GREATEST(1,ceil(extract(epoch FROM min(at)+interval '61 seconds'-t))::int) INTO wait FROM club_private.catalog_usage WHERE actor=a AND kind=p_kind AND at>t-interval '1 minute';
  PERFORM set_config('response.headers',jsonb_build_array(jsonb_build_object('Retry-After',COALESCE(wait,61)::text))::text,true);
  RAISE EXCEPTION 'CLUB_VISIT_RATE_LIMIT' USING ERRCODE='PT429';
 END IF;
 INSERT INTO club_private.catalog_usage(actor,kind,amount) VALUES(a,p_kind,p_amount);
END$$;
CREATE FUNCTION club_private.catalog_profile(p_club uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('id',v.club_id,'name',v.name,'description',v.body,'revision',v.revision,'applications_open',v.applications_open AND f.applications,'has_cover',f.images AND v.cover_path IS NOT NULL,'has_logo',f.images AND v.logo_path IS NOT NULL,'cover_frame',CASE WHEN f.images THEN v.cover_frame-'source' END,'logo_frame',CASE WHEN f.images THEN v.logo_frame-'source' END,'member_count',CASE WHEN v.show_member_count THEN(SELECT count(*) FROM public.club_members WHERE club_id=p_club) END,'cover_revision',CASE WHEN f.images THEN cover.media_revision END,'logo_revision',CASE WHEN f.images THEN logo.media_revision END)
 FROM club_private.visit_profiles v CROSS JOIN club_private.visit_flags f LEFT JOIN club_private.catalog_variants cover ON cover.club_id=v.club_id AND cover.source_path=v.cover_path AND cover.slot='cover' LEFT JOIN club_private.catalog_variants logo ON logo.club_id=v.club_id AND logo.source_path=v.logo_path AND logo.slot='logo' WHERE v.club_id=p_club AND f.singleton;
$$;
CREATE FUNCTION public.club_visit_catalog_manifest(p_ids uuid[],p_known jsonb DEFAULT '{}'::jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog SET statement_timeout='5s' AS $$
DECLARE a uuid:=club_private.catalog_require();c uuid;result jsonb:='{}';fresh int;allowed uuid[];BEGIN
 IF p_ids IS NULL OR cardinality(p_ids) NOT BETWEEN 1 AND 20 OR array_position(p_ids,NULL) IS NOT NULL OR (SELECT count(DISTINCT x) FROM unnest(p_ids)x)<>cardinality(p_ids) OR octet_length(COALESCE(p_known,'{}')::text)>16384 THEN RAISE EXCEPTION 'CLUB_INVALID_INPUT' USING ERRCODE='22023';END IF;
 PERFORM club_private.catalog_meter('manifest');
 PERFORM pg_advisory_xact_lock(hashtextextended('visit-watch:'||a::text,0));
 SELECT array_agg(x) INTO allowed FROM unnest(p_ids)x WHERE club_private.visit_can_read(x);
 SELECT count(*) INTO fresh FROM unnest(allowed)x LEFT JOIN club_private.visit_watchers w ON w.actor=a AND w.club_id=x WHERE w.actor IS NULL OR w.touched_at<=clock_timestamp()-interval '30 days';
 IF fresh>0 THEN PERFORM club_private.catalog_meter('binding',fresh);END IF;
 INSERT INTO club_private.visit_watchers(actor,club_id) SELECT a,x FROM unnest(allowed)x ON CONFLICT(actor,club_id) DO UPDATE SET touched_at=excluded.touched_at WHERE visit_watchers.touched_at<=clock_timestamp()-interval '5 minutes';
 FOREACH c IN ARRAY p_ids LOOP result:=result||jsonb_build_object(c::text,CASE WHEN c=ANY(allowed) THEN club_private.catalog_profile(c) ELSE NULL END);END LOOP;
 result:=jsonb_build_object('userId',a,'profiles',result,'revision',COALESCE((SELECT revision FROM public.club_visit_catalog_signals WHERE user_id=a),0));
 IF octet_length(result::text)>131072 THEN RAISE EXCEPTION 'CLUB_INVALID_INPUT' USING ERRCODE='22023';END IF;RETURN result;
END$$;
CREATE FUNCTION public.club_visit_catalog_media(p_items jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog SET statement_timeout='5s' AS $$
DECLARE a uuid:=club_private.catalog_require();item jsonb;p jsonb;c uuid;which_slot text;v club_private.visit_profiles;r jsonb:='[]';images jsonb;b bigint:=0;im club_private.catalog_variants;BEGIN
 PERFORM club_private.visit_require('images');
 IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 4 OR octet_length(p_items::text)>16384 OR(SELECT count(DISTINCT x->>'club_id') FROM jsonb_array_elements(p_items)x)<>jsonb_array_length(p_items) THEN RAISE EXCEPTION 'CLUB_INVALID_INPUT' USING ERRCODE='22023';END IF;
 FOR item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
  c:=(item->>'club_id')::uuid;
  IF NOT club_private.visit_can_read(c) THEN RAISE EXCEPTION 'CLUB_VISIT_UNAVAILABLE' USING ERRCODE='42501';END IF;
  SELECT * INTO v FROM club_private.visit_profiles WHERE club_id=c;p:=club_private.catalog_profile(c);
  IF (item->>'revision')::bigint IS DISTINCT FROM v.revision OR item->>'cover_revision' IS DISTINCT FROM p->>'cover_revision' OR item->>'logo_revision' IS DISTINCT FROM p->>'logo_revision' THEN RAISE EXCEPTION 'CLUB_VISIT_CHANGED' USING ERRCODE='PT409';END IF;
  images:='{}';
  FOREACH which_slot IN ARRAY ARRAY['cover','logo'] LOOP
   IF (which_slot='cover' AND v.cover_path IS NOT NULL) OR(which_slot='logo' AND v.logo_path IS NOT NULL) THEN
    SELECT * INTO im FROM club_private.catalog_variants WHERE club_id=c AND source_path=CASE WHEN which_slot='cover' THEN v.cover_path ELSE v.logo_path END AND catalog_variants.slot=which_slot;
    IF NOT FOUND THEN RAISE EXCEPTION 'CLUB_VISIT_IMAGE_NOT_STAGED' USING ERRCODE='22023';END IF;
    b:=b+octet_length(im.bytes);images:=images||jsonb_build_object(which_slot,jsonb_build_object('mime','image/webp','data',encode(im.bytes,'base64'),'media_revision',im.media_revision));
   END IF;
  END LOOP;r:=r||jsonb_build_array(jsonb_build_object('id',c,'revision',v.revision,'images',images));
 END LOOP;
 PERFORM club_private.catalog_meter('media',GREATEST(b,1));r:=jsonb_build_object('userId',a,'items',r);
 IF octet_length(r::text)>655360 THEN RAISE EXCEPTION 'CLUB_INVALID_INPUT' USING ERRCODE='22023';END IF;
 PERFORM set_config('response.headers','[{"Cache-Control":"private, no-store, max-age=0"}]',true);RETURN r;
END$$;
-- Attestation is preparation only; it never authorises catalogue delivery.
CREATE FUNCTION public.club_visit_catalog_stage(p_club uuid,p_slot text,p_source text,p_data text,p_source_hash text,p_width int,p_height int,p_expires bigint,p_signature text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a uuid:=club_private.visit_require('images');c public.clubs;b bytea;k bytea;h text;msg text;rev text;BEGIN
 PERFORM club_private.visit_pilot_require(p_club);c:=club_private.lock_club(p_club);
 IF COALESCE(club_private.my_role(p_club),'') NOT IN('owner','admin') THEN RAISE EXCEPTION 'CLUB_FORBIDDEN' USING ERRCODE='42501';END IF;
 IF p_slot IS NULL OR p_slot NOT IN('cover','logo') OR p_data IS NULL OR length(p_data)>131072 OR p_expires IS NULL OR p_expires<extract(epoch FROM clock_timestamp()) OR p_expires>extract(epoch FROM clock_timestamp())+120 OR p_width IS NULL OR p_height IS NULL OR p_width NOT BETWEEN 1 AND (CASE WHEN p_slot='cover' THEN 960 ELSE 128 END) OR p_height NOT BETWEEN 1 AND (CASE WHEN p_slot='cover' THEN 960 ELSE 128 END) THEN RAISE EXCEPTION 'CLUB_INVALID_IMAGE' USING ERRCODE='22023';END IF;
 IF p_source IS DISTINCT FROM (CASE WHEN p_slot='cover' THEN c.cover_path ELSE c.logo_path END) THEN RAISE EXCEPTION 'CLUB_INVALID_IMAGE' USING ERRCODE='22023';END IF;
 b:=decode(p_data,'base64');h:=encode(sha256(b),'hex');
 SELECT signing_key INTO k FROM club_private.catalog_config WHERE singleton;
 msg:=concat_ws('|','catalog-v1',a,p_club,p_slot,p_source_hash,h,p_width,p_height,p_expires);
 IF k IS NULL OR p_signature IS DISTINCT FROM encode(extensions.hmac(convert_to(msg,'UTF8'),k,'sha256'),'hex') OR substring(b FROM 1 FOR 4)<>convert_to('RIFF','UTF8') OR substring(b FROM 9 FOR 4)<>convert_to('WEBP','UTF8') OR octet_length(b)>(CASE WHEN p_slot='cover' THEN 98304 ELSE 12288 END) OR NOT EXISTS(SELECT 1 FROM club_private.visit_image_payloads WHERE club_id=p_club AND source_path=p_source AND encode(sha256(bytes),'hex')=p_source_hash) THEN RAISE EXCEPTION 'CLUB_INVALID_IMAGE' USING ERRCODE='22023';END IF;
 IF EXISTS(SELECT 1 FROM club_private.catalog_variants WHERE club_id=p_club AND source_path=p_source AND slot=p_slot AND source_hash=p_source_hash) THEN RETURN;END IF;
 IF (SELECT COALESCE(sum(octet_length(bytes)),0) FROM club_private.visit_image_payloads WHERE club_id=p_club)+(SELECT COALESCE(sum(octet_length(bytes)),0) FROM club_private.catalog_variants WHERE club_id=p_club)+octet_length(b)>18874368 THEN RAISE EXCEPTION 'CLUB_VISIT_IMAGE_CAPACITY' USING ERRCODE='PT429';END IF;
 rev:=encode(sha256(convert_to(p_source_hash||':webp-v1:'||h,'UTF8')),'hex');
 INSERT INTO club_private.catalog_variants(club_id,source_path,slot,version,source_hash,media_revision,bytes) VALUES(p_club,p_source,p_slot,'webp-v1',p_source_hash,rev,b);
END$$;
CREATE FUNCTION club_private.catalog_publication_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF NEW.published AND EXISTS(SELECT 1 FROM club_private.catalog_config WHERE enabled) AND ((NEW.cover_path IS NOT NULL AND NOT EXISTS(SELECT 1 FROM club_private.catalog_variants WHERE club_id=NEW.club_id AND source_path=NEW.cover_path AND slot='cover')) OR(NEW.logo_path IS NOT NULL AND NOT EXISTS(SELECT 1 FROM club_private.catalog_variants WHERE club_id=NEW.club_id AND source_path=NEW.logo_path AND slot='logo'))) THEN RAISE EXCEPTION 'CLUB_VISIT_IMAGE_NOT_STAGED' USING ERRCODE='22023';END IF;RETURN NEW;
END$$;
CREATE TRIGGER catalog_publication_guard BEFORE INSERT OR UPDATE ON club_private.visit_profiles FOR EACH ROW EXECUTE FUNCTION club_private.catalog_publication_guard();
CREATE FUNCTION club_private.catalog_capacity_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 PERFORM club_private.lock_club(NEW.club_id);
 IF NOT EXISTS(SELECT 1 FROM club_private.visit_image_payloads WHERE club_id=NEW.club_id AND source_path=NEW.source_path) AND (SELECT COALESCE(sum(octet_length(bytes)),0) FROM club_private.visit_image_payloads WHERE club_id=NEW.club_id)+(SELECT COALESCE(sum(octet_length(bytes)),0) FROM club_private.catalog_variants WHERE club_id=NEW.club_id)+octet_length(NEW.bytes)>18874368 THEN RAISE EXCEPTION 'CLUB_VISIT_IMAGE_CAPACITY' USING ERRCODE='PT429';END IF;RETURN NEW;
END$$;
CREATE TRIGGER zz_catalog_capacity BEFORE INSERT ON club_private.visit_image_payloads FOR EACH ROW EXECUTE FUNCTION club_private.catalog_capacity_guard();
DO $$DECLARE t text;f regprocedure;BEGIN
 FOREACH t IN ARRAY ARRAY['catalog_config','catalog_variants','catalog_usage'] LOOP EXECUTE format('ALTER TABLE club_private.%I ENABLE ROW LEVEL SECURITY',t);EXECUTE format('REVOKE ALL ON club_private.%I FROM PUBLIC,anon,authenticated,service_role',t);END LOOP;
 FOR f IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE (n.nspname='club_private' AND p.proname LIKE 'catalog_%') OR(n.nspname='public' AND p.proname LIKE 'club_visit_catalog_%') LOOP EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',f);IF f::text LIKE '%club_visit_catalog_%' THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f);END IF;END LOOP;
END$$;
SELECT cron.schedule('club-visit-catalog-usage-retention','19 * * * *',$$DELETE FROM club_private.catalog_usage WHERE at<clock_timestamp()-interval '8 days'$$);
COMMIT;
