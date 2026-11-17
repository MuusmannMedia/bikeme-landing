BEGIN;
-- Reserve call/burst before byte access; settle shared raw-byte budget before encoding.
CREATE FUNCTION club_private.catalog_media_charge(p_ticket bigint,p_bytes bigint) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a uuid:=club_private.require_user();t timestamptz:=clock_timestamp();old_bytes bigint;catalog_bytes bigint;prior bigint;BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('visit-meter:'||a::text,0));
 SELECT amount INTO prior FROM club_private.catalog_usage WHERE id=p_ticket AND actor=a AND kind='media';
 IF prior IS NULL OR p_bytes NOT BETWEEN 1 AND 458752 THEN RAISE EXCEPTION 'CLUB_INVALID_INPUT' USING ERRCODE='22023';END IF;
 SELECT COALESCE(sum(amount),0) INTO old_bytes FROM club_private.visit_usage WHERE actor=a AND kind='image' AND at>t-interval '1 minute';
 SELECT COALESCE(sum(amount),0)-prior INTO catalog_bytes FROM club_private.catalog_usage WHERE actor=a AND kind='media' AND at>t-interval '1 minute';
 IF catalog_bytes+p_bytes>10485760 OR old_bytes+catalog_bytes+p_bytes>62914560 THEN RAISE EXCEPTION 'CLUB_VISIT_RATE_LIMIT' USING ERRCODE='PT429';END IF;
 UPDATE club_private.catalog_usage SET amount=p_bytes WHERE id=p_ticket;
END$$;
REVOKE ALL ON FUNCTION club_private.catalog_media_charge(bigint,bigint) FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.club_visit_catalog_media(p_items jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog SET statement_timeout='5s' AS $$
DECLARE a uuid:=club_private.catalog_require();item jsonb;p jsonb;c uuid;which_slot text;v club_private.visit_profiles;r jsonb:='[]';images jsonb;b bigint:=0;im club_private.catalog_variants;ticket bigint;payloads bytea[]:='{}';paths jsonb[]:='{}';i int;BEGIN
 PERFORM club_private.visit_require('images');
 IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 4 OR octet_length(p_items::text)>16384 OR(SELECT count(DISTINCT x->>'club_id') FROM jsonb_array_elements(p_items)x)<>jsonb_array_length(p_items) THEN RAISE EXCEPTION 'CLUB_INVALID_INPUT' USING ERRCODE='22023';END IF;
 PERFORM club_private.catalog_meter('media',1);
 SELECT id INTO ticket FROM club_private.catalog_usage WHERE actor=a AND kind='media' ORDER BY id DESC LIMIT 1;
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
    b:=b+octet_length(im.bytes);payloads:=array_append(payloads,im.bytes);paths:=array_append(paths,jsonb_build_array(jsonb_array_length(r),which_slot));images:=images||jsonb_build_object(which_slot,jsonb_build_object('mime','image/webp','media_revision',im.media_revision));
   END IF;
  END LOOP;r:=r||jsonb_build_array(jsonb_build_object('id',c,'revision',v.revision,'images',images));
 END LOOP;
 PERFORM club_private.catalog_media_charge(ticket,GREATEST(b,1));
 IF cardinality(payloads)>0 THEN FOR i IN 1..cardinality(payloads) LOOP r:=jsonb_set(r,ARRAY[paths[i]->>0,'images',paths[i]->>1,'data'],to_jsonb(encode(payloads[i],'base64')),true);END LOOP;END IF;
 r:=jsonb_build_object('userId',a,'items',r);
 IF octet_length(r::text)>655360 THEN RAISE EXCEPTION 'CLUB_INVALID_INPUT' USING ERRCODE='22023';END IF;
 PERFORM set_config('response.headers','[{"Cache-Control":"private, no-store, max-age=0"}]',true);RETURN r;
END$$;
COMMIT;
