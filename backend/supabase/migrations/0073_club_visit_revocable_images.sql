BEGIN;
-- Direct Storage/CDN authorization can outlive revocation until JWT expiry.
-- Visitors therefore receive only freshly authorized RPC bytes, never Storage grants.
DROP POLICY club_visit_image_read ON storage.objects;
ALTER POLICY club_profile_image_read_boundary ON storage.objects USING(bucket_id<>'club-profile-images' OR club_private.can_read_profile_image(name));
REVOKE EXECUTE ON FUNCTION club_private.visit_image_allowed(text) FROM authenticated;
CREATE TABLE club_private.visit_image_payloads (
 club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
 source_path text NOT NULL, mime text NOT NULL CHECK(mime IN('image/jpeg','image/png')),
 bytes bytea NOT NULL CHECK(octet_length(bytes) BETWEEN 1 AND 3145728),
 PRIMARY KEY(club_id,source_path)
);
ALTER TABLE club_private.visit_image_payloads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON club_private.visit_image_payloads FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.club_visit_image_stage(p_club uuid,p_slot text,p_source text,p_data text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE c public.clubs;b bytea;m jsonb;expected text;BEGIN
 PERFORM club_private.visit_require('images');c:=club_private.lock_club(p_club);
 IF COALESCE(club_private.my_role(p_club),'') NOT IN('owner','admin') THEN RAISE EXCEPTION 'CLUB_FORBIDDEN' USING ERRCODE='42501';END IF;
 IF p_slot IS NULL OR p_slot NOT IN('cover','logo') OR p_source IS NULL OR p_source IS DISTINCT FROM (CASE WHEN p_slot='cover' THEN c.cover_path ELSE c.logo_path END) OR p_data IS NULL OR char_length(p_data)>4194304 THEN RAISE EXCEPTION 'CLUB_INVALID_IMAGE' USING ERRCODE='22023';END IF;
 BEGIN b:=decode(p_data,'base64');EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'CLUB_INVALID_IMAGE' USING ERRCODE='22023';END;
 SELECT metadata INTO m FROM storage.objects WHERE bucket_id='club-profile-images' AND name=p_source;
 expected:=CASE WHEN p_slot='cover' THEN 'image/jpeg' ELSE 'image/png' END;
 IF m IS NULL OR m->>'mimetype'<>expected OR octet_length(b) NOT BETWEEN 1 AND 3145728 OR (m->>'size')::bigint<>octet_length(b) OR trim(both '"' from m->>'eTag') IS DISTINCT FROM md5(b) OR (p_slot='cover' AND substring(b from 1 for 3)<>decode('ffd8ff','hex')) OR (p_slot='logo' AND substring(b from 1 for 8)<>decode('89504e470d0a1a0a','hex')) THEN RAISE EXCEPTION 'CLUB_INVALID_IMAGE' USING ERRCODE='22023';END IF;
 INSERT INTO club_private.visit_image_payloads VALUES(p_club,p_source,expected,b) ON CONFLICT(club_id,source_path) DO NOTHING;
END$$;
CREATE FUNCTION public.club_visit_image(p_club uuid,p_slot text,p_revision bigint) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v club_private.visit_profiles;path text;result jsonb;BEGIN
 PERFORM club_private.visit_require('images');
 IF NOT club_private.visit_can_read(p_club) OR p_slot IS NULL OR p_slot NOT IN('cover','logo') THEN RAISE EXCEPTION 'CLUB_VISIT_UNAVAILABLE' USING ERRCODE='42501';END IF;
 SELECT * INTO v FROM club_private.visit_profiles WHERE club_id=p_club;
 IF v.revision IS DISTINCT FROM p_revision THEN RAISE EXCEPTION 'CLUB_VISIT_CHANGED' USING ERRCODE='PT409';END IF;
 path:=CASE WHEN p_slot='cover' THEN v.cover_path ELSE v.logo_path END;
 SELECT jsonb_build_object('mime',mime,'data',encode(bytes,'base64'),'revision',v.revision) INTO result FROM club_private.visit_image_payloads WHERE club_id=p_club AND source_path=path;
 IF result IS NULL THEN RAISE EXCEPTION 'CLUB_VISIT_UNAVAILABLE' USING ERRCODE='42501';END IF;
 PERFORM set_config('response.headers','[{"Cache-Control":"private, no-store, max-age=0"},{"Pragma":"no-cache"},{"X-Content-Type-Options":"nosniff"}]',true);
 RETURN result;
END$$;
REVOKE ALL ON FUNCTION public.club_visit_image_stage(uuid,text,text,text),public.club_visit_image(uuid,text,bigint) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.club_visit_image_stage(uuid,text,text,text),public.club_visit_image(uuid,text,bigint) TO authenticated;
CREATE OR REPLACE FUNCTION public.club_visit_publish(p_club uuid,p_revision bigint,p_body text,p_cover boolean,p_logo boolean,p_applications boolean,p_key uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE c public.clubs; a uuid; r jsonb; payload jsonb; v club_private.visit_profiles;
BEGIN
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
CREATE FUNCTION club_private.visit_check_text(p_body text) RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE
  normalized text;
  token_boundary constant text := '[^[:alnum:]_À-ÖØ-öø-ÿĀ-ſ]';
BEGIN
  -- NFKC composes combining characters and folds compatibility forms such as
  -- fullwidth Latin letters. Keep Danish letters in the deterministic C locale.
  normalized := lower(translate(normalize(p_body, NFKC), 'ÆØÅ', 'æøå') COLLATE "C");
  normalized := translate(normalized, U&'\2018\2019\02BC', repeat(chr(39), 3));
  normalized := regexp_replace(normalized,
    U&'[\00AD\034F\061C\180E\200B-\200F\202A-\202E\2060-\206F\FE00-\FE0F\FEFF]', '', 'g');
  normalized := regexp_replace(normalized, U&'[\0085\2028\2029]', ' ', 'g');
  normalized := regexp_replace(normalized COLLATE "C", '[[:space:]]+', ' ', 'g');

  -- Each rule is literal and matches whole tokens. Spaces can be inserted
  -- between letters, while the spaces between words in threats remain required.
  IF EXISTS (
    SELECT 1
    FROM unnest(ARRAY[
      'jeg dræber dig', 'jeg vil dræbe dig', 'jeg kommer og dræber dig',
      'jeg slår dig ihjel', 'jeg vil slå dig ihjel',
      'jeg skyder dig', 'jeg vil skyde dig',
      'jeg stikker dig ned', 'jeg vil stikke dig ned',
      'i will kill you', 'i''ll kill you', 'i am going to kill you', 'i''m going to kill you',
      'i will shoot you', 'i''ll shoot you', 'i am going to shoot you', 'i''m going to shoot you',
      'i will stab you', 'i''ll stab you', 'i will murder you', 'i''ll murder you',
      'nigger', 'niggers', 'nigga', 'niggas', 'faggot', 'faggots', 'jewboy', 'jewboys',
      'perker', 'perkere', 'perkersvin', 'negersvin', 'jødesvin', 'homosvin'
    ]) AS rules(phrase)
    WHERE normalized COLLATE "C" ~ (
      '(^|' || token_boundary || ')' ||
      regexp_replace(phrase, '([^ ])(?=[^ ])', '\1 *', 'g') ||
      '($|' || token_boundary || ')'
    )
  ) THEN
    -- Older clients treat 22023 as validation and let the user edit the draft.
    RAISE EXCEPTION 'BIKEME_CONTENT_REJECTED' USING ERRCODE = '22023';
  END IF;

  RETURN;
END;
$$;
CREATE FUNCTION club_private.visit_check_fields() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF TG_TABLE_NAME='visit_profiles' THEN PERFORM club_private.visit_check_text(NEW.name);
 ELSIF TG_TABLE_NAME='visit_rides' THEN PERFORM club_private.visit_check_text(NEW.title);PERFORM club_private.visit_check_text(NEW.area);END IF;RETURN NULL;
END$$;
CREATE TRIGGER visit_profile_field_filter AFTER INSERT OR UPDATE ON club_private.visit_profiles FOR EACH ROW EXECUTE FUNCTION club_private.visit_check_fields();
CREATE TRIGGER visit_ride_field_filter AFTER INSERT OR UPDATE ON club_private.visit_rides FOR EACH ROW EXECUTE FUNCTION club_private.visit_check_fields();
REVOKE ALL ON FUNCTION club_private.visit_check_text(text),club_private.visit_check_fields() FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
