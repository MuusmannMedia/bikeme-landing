BEGIN;

ALTER TABLE public.clubs
  ADD COLUMN cover_path text,
  ADD COLUMN logo_path text,
  ADD COLUMN profile_revision integer NOT NULL DEFAULT 0;

CREATE FUNCTION club_private.bump_profile_revision() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  NEW.profile_revision := OLD.profile_revision + 1;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION club_private.bump_profile_revision() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER club_profile_revision BEFORE UPDATE OF name, description, cover_path, logo_path ON public.clubs
FOR EACH ROW WHEN ((OLD.name, OLD.description, OLD.cover_path, OLD.logo_path)
    IS DISTINCT FROM (NEW.name, NEW.description, NEW.cover_path, NEW.logo_path))
EXECUTE FUNCTION club_private.bump_profile_revision();

CREATE INDEX clubs_cover_path_idx ON public.clubs (cover_path) WHERE cover_path IS NOT NULL;
CREATE INDEX clubs_logo_path_idx ON public.clubs (logo_path) WHERE logo_path IS NOT NULL;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('club-profile-images', 'club-profile-images', false, 3145728, ARRAY['image/jpeg','image/png']);

CREATE FUNCTION club_private.can_read_profile_image(p_path text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clubs c
    WHERE (c.cover_path = p_path OR c.logo_path = p_path)
      AND club_private.my_role(c.id) IS NOT NULL
  );
$$;

CREATE FUNCTION club_private.can_upload_profile_image(p_path text) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE parts text[] := string_to_array(p_path, '/');
DECLARE actor uuid := auth.uid();
BEGIN
  IF actor IS NULL OR array_length(parts, 1) IS DISTINCT FROM 4
      OR parts[2] IS DISTINCT FROM actor::text
      OR parts[3] !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
      OR parts[4] !~ '^(cover-[0-9a-f-]{36}\.jpg|logo-[0-9a-f-]{36}\.png)$' THEN
    RETURN false;
  END IF;
  IF parts[1] = 'create' THEN
    RETURN EXISTS (SELECT 1 FROM public.profiles WHERE id = actor)
      AND NOT EXISTS (SELECT 1 FROM public.clubs WHERE created_by = actor AND creation_key = parts[3]::uuid);
  END IF;
  IF parts[1] = 'edit' THEN
    RETURN COALESCE(club_private.my_role(parts[3]::uuid) IN ('owner', 'admin'), false);
  END IF;
  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION club_private.can_read_profile_image(text), club_private.can_upload_profile_image(text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION club_private.can_read_profile_image(text), club_private.can_upload_profile_image(text)
  TO authenticated;

CREATE POLICY club_profile_image_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'club-profile-images' AND club_private.can_read_profile_image(name));
CREATE POLICY club_profile_image_upload ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'club-profile-images' AND club_private.can_upload_profile_image(name));

-- Keep this bucket private even if unrelated permissive policies are added.
CREATE POLICY club_profile_image_read_boundary ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated
  USING (bucket_id <> 'club-profile-images' OR club_private.can_read_profile_image(name));
CREATE POLICY club_profile_image_upload_boundary ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (bucket_id <> 'club-profile-images' OR club_private.can_upload_profile_image(name));
CREATE POLICY club_profile_image_immutable ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated, anon
  USING (bucket_id <> 'club-profile-images') WITH CHECK (bucket_id <> 'club-profile-images');
CREATE POLICY club_profile_image_no_client_delete ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated, anon
  USING (bucket_id <> 'club-profile-images');
CREATE POLICY club_profile_image_no_anonymous_read ON storage.objects AS RESTRICTIVE FOR SELECT TO anon
  USING (bucket_id <> 'club-profile-images');
CREATE POLICY club_profile_image_no_anonymous_upload ON storage.objects AS RESTRICTIVE FOR INSERT TO anon
  WITH CHECK (bucket_id <> 'club-profile-images');

CREATE FUNCTION club_private.check_profile_image(p_path text, p_prefix text, p_slot text, p_extension text, p_mime text)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
  IF p_path IS NULL THEN RETURN; END IF;
  IF left(p_path, length(p_prefix)) <> p_prefix
      OR substr(p_path, length(p_prefix) + 1) !~ ('^' || p_slot || '-[0-9a-f-]{36}[.]' || p_extension || '$')
      OR NOT EXISTS (
        SELECT 1 FROM storage.objects WHERE bucket_id = 'club-profile-images' AND name = p_path
          AND metadata->>'mimetype' = p_mime
          AND CASE WHEN metadata->>'size' ~ '^[0-9]{1,10}$'
                   THEN (metadata->>'size')::bigint BETWEEN 1 AND 3145728 ELSE false END
      ) THEN
    RAISE EXCEPTION 'CLUB_INVALID_IMAGE' USING ERRCODE = '22023';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION club_private.check_profile_image(text,text,text,text,text)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.club_create_profile(p_request_key uuid, p_name text, p_description text,
  p_cover_path text, p_logo_path text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE actor uuid := club_private.require_user();
DECLARE club uuid;
DECLARE prefix text := 'create/' || actor || '/' || p_request_key || '/';
BEGIN
  SELECT id INTO club FROM public.clubs WHERE created_by = actor AND creation_key = p_request_key;
  IF FOUND THEN RETURN club; END IF;
  IF p_request_key IS NULL OR p_name IS NULL OR char_length(btrim(p_name)) NOT BETWEEN 2 AND 80
      OR char_length(btrim(COALESCE(p_description, ''))) > 1000 THEN
    RAISE EXCEPTION 'CLUB_INVALID_INPUT' USING ERRCODE = '22023';
  END IF;
  PERFORM 1 FROM public.profiles WHERE id = actor FOR KEY SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CLUB_UNAUTHENTICATED' USING ERRCODE = '28000'; END IF;

  PERFORM club_private.check_profile_image(p_cover_path, prefix, 'cover', 'jpg', 'image/jpeg');
  PERFORM club_private.check_profile_image(p_logo_path, prefix, 'logo', 'png', 'image/png');
  INSERT INTO public.clubs(name, description, owner_id, created_by, creation_key, cover_path, logo_path)
  VALUES (btrim(p_name), NULLIF(btrim(p_description), ''), actor, actor, p_request_key, p_cover_path, p_logo_path)
  ON CONFLICT (created_by, creation_key) DO NOTHING RETURNING id INTO club;
  IF club IS NULL THEN
    SELECT id INTO club FROM public.clubs WHERE created_by = actor AND creation_key = p_request_key;
  ELSE
    INSERT INTO public.club_members(club_id, user_id, role) VALUES (club, actor, 'admin');
  END IF;
  RETURN club;
END;
$$;

CREATE FUNCTION public.club_save_profile(p_club_id uuid, p_revision integer, p_name text,
  p_description text, p_cover_path text, p_logo_path text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE current_club public.clubs;
DECLARE actor uuid := club_private.require_user();
DECLARE prefix text := 'edit/' || actor || '/' || p_club_id || '/';
BEGIN
  current_club := club_private.lock_club(p_club_id);
  IF COALESCE(club_private.my_role(p_club_id), '') NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'CLUB_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  p_name := btrim(p_name);
  p_description := NULLIF(btrim(p_description), '');
  IF p_name IS NULL OR char_length(p_name) NOT BETWEEN 2 AND 80
      OR char_length(COALESCE(p_description, '')) > 1000 OR p_revision IS NULL THEN
    RAISE EXCEPTION 'CLUB_INVALID_INPUT' USING ERRCODE = '22023';
  END IF;
  -- An identical retry after a lost response succeeds without another write.
  IF (current_club.name, current_club.description, current_club.cover_path, current_club.logo_path)
      IS DISTINCT FROM (p_name, p_description, p_cover_path, p_logo_path) THEN
    IF current_club.profile_revision <> p_revision THEN
      RAISE EXCEPTION 'CLUB_PROFILE_CHANGED' USING ERRCODE = '40001';
    END IF;
    IF current_club.cover_path IS DISTINCT FROM p_cover_path THEN
      PERFORM club_private.check_profile_image(p_cover_path, prefix, 'cover', 'jpg', 'image/jpeg');
    END IF;
    IF current_club.logo_path IS DISTINCT FROM p_logo_path THEN
      PERFORM club_private.check_profile_image(p_logo_path, prefix, 'logo', 'png', 'image/png');
    END IF;
    UPDATE public.clubs SET name = p_name, description = p_description,
      cover_path = p_cover_path, logo_path = p_logo_path
    WHERE id = p_club_id RETURNING * INTO current_club;
  END IF;
  RETURN jsonb_build_object('id', current_club.id, 'name', current_club.name,
    'description', current_club.description, 'cover_path', current_club.cover_path,
    'logo_path', current_club.logo_path, 'profile_revision', current_club.profile_revision);
END;
$$;

REVOKE ALL ON FUNCTION public.club_create_profile(uuid,text,text,text,text),
  public.club_save_profile(uuid,integer,text,text,text,text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.club_create_profile(uuid,text,text,text,text),
  public.club_save_profile(uuid,integer,text,text,text,text) TO authenticated;

COMMIT;
