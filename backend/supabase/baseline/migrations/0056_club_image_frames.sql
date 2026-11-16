BEGIN;

ALTER TABLE public.clubs ADD COLUMN cover_frame jsonb, ADD COLUMN logo_frame jsonb;

CREATE FUNCTION club_private.valid_image_frame(frame jsonb, image_path text, allow_whole boolean)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path = pg_catalog AS $$
BEGIN
  IF frame IS NULL THEN RETURN true; END IF;
  IF image_path IS NULL OR jsonb_typeof(frame) <> 'object'
     OR frame - ARRAY['source', 'zoom', 'x', 'y', 'whole'] <> '{}'::jsonb
     OR frame->>'source' IS DISTINCT FROM image_path
     OR jsonb_typeof(frame->'zoom') IS DISTINCT FROM 'number'
     OR jsonb_typeof(frame->'x') IS DISTINCT FROM 'number'
     OR jsonb_typeof(frame->'y') IS DISTINCT FROM 'number'
     OR jsonb_typeof(frame->'whole') IS DISTINCT FROM 'boolean' THEN
    RETURN false;
  END IF;
  RETURN (frame->>'zoom')::numeric BETWEEN 1 AND 4
    AND (frame->>'x')::numeric BETWEEN -1 AND 1
    AND (frame->>'y')::numeric BETWEEN -1 AND 1
    AND (NOT (frame->>'whole')::boolean OR (allow_whole
      AND (frame->>'zoom')::numeric = 1 AND (frame->>'x')::numeric = 0 AND (frame->>'y')::numeric = 0));
END;
$$;
REVOKE ALL ON FUNCTION club_private.valid_image_frame(jsonb,text,boolean) FROM PUBLIC, anon, authenticated, service_role;

ALTER TABLE public.clubs
  ADD CONSTRAINT club_cover_frame_valid CHECK (club_private.valid_image_frame(cover_frame, cover_path, false)),
  ADD CONSTRAINT club_logo_frame_valid CHECK (club_private.valid_image_frame(logo_frame, logo_path, true));

-- Reset stale framing when a previous app version replaces a source.
-- The trigger also gives frame-only changes the same revision protection.
CREATE OR REPLACE FUNCTION club_private.bump_profile_revision() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  IF NEW.cover_path IS DISTINCT FROM OLD.cover_path AND NEW.cover_frame IS NOT DISTINCT FROM OLD.cover_frame THEN
    NEW.cover_frame := NULL;
  END IF;
  IF NEW.logo_path IS DISTINCT FROM OLD.logo_path AND NEW.logo_frame IS NOT DISTINCT FROM OLD.logo_frame THEN
    NEW.logo_frame := NULL;
  END IF;
  IF (NEW.name, NEW.description, NEW.cover_path, NEW.logo_path, NEW.cover_frame, NEW.logo_frame)
     IS DISTINCT FROM (OLD.name, OLD.description, OLD.cover_path, OLD.logo_path, OLD.cover_frame, OLD.logo_frame) THEN
    NEW.profile_revision := OLD.profile_revision + 1;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER club_profile_revision ON public.clubs;
CREATE TRIGGER club_profile_revision BEFORE UPDATE OF name, description, cover_path, logo_path, cover_frame, logo_frame
ON public.clubs FOR EACH ROW EXECUTE FUNCTION club_private.bump_profile_revision();

CREATE FUNCTION public.club_create_framed_profile(p_request_key uuid, p_name text, p_description text,
  p_cover_path text, p_logo_path text, p_cover_frame jsonb, p_logo_frame jsonb)
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

  IF NOT club_private.valid_image_frame(p_cover_frame, p_cover_path, false)
      OR NOT club_private.valid_image_frame(p_logo_frame, p_logo_path, true) THEN
    RAISE EXCEPTION 'CLUB_INVALID_IMAGE' USING ERRCODE = '22023';
  END IF;

  PERFORM club_private.check_profile_image(p_cover_path, prefix, 'cover', 'jpg', 'image/jpeg');
  PERFORM club_private.check_profile_image(p_logo_path, prefix, 'logo', 'png', 'image/png');
  INSERT INTO public.clubs(name, description, owner_id, created_by, creation_key, cover_path, logo_path, cover_frame, logo_frame)
  VALUES (btrim(p_name), NULLIF(btrim(p_description), ''), actor, actor, p_request_key, p_cover_path, p_logo_path, p_cover_frame, p_logo_frame)
  ON CONFLICT (created_by, creation_key) DO NOTHING RETURNING id INTO club;
  IF club IS NULL THEN
    SELECT id INTO club FROM public.clubs WHERE created_by = actor AND creation_key = p_request_key;
  ELSE
    INSERT INTO public.club_members(club_id, user_id, role) VALUES (club, actor, 'admin');
  END IF;
  RETURN club;
END;
$$;

CREATE FUNCTION public.club_save_framed_profile(p_club_id uuid, p_revision integer, p_name text,
  p_description text, p_cover_path text, p_logo_path text, p_cover_frame jsonb, p_logo_frame jsonb)
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
  IF NOT club_private.valid_image_frame(p_cover_frame, p_cover_path, false)
      OR NOT club_private.valid_image_frame(p_logo_frame, p_logo_path, true) THEN
    RAISE EXCEPTION 'CLUB_INVALID_IMAGE' USING ERRCODE = '22023';
  END IF;

  -- An identical retry after a lost response succeeds without another write.
  IF (current_club.name, current_club.description, current_club.cover_path, current_club.logo_path, current_club.cover_frame, current_club.logo_frame)
      IS DISTINCT FROM (p_name, p_description, p_cover_path, p_logo_path, p_cover_frame, p_logo_frame) THEN
    IF current_club.profile_revision <> p_revision THEN
      RAISE EXCEPTION 'CLUB_PROFILE_CHANGED' USING ERRCODE = 'PT409';
    END IF;
    IF current_club.cover_path IS DISTINCT FROM p_cover_path THEN
      PERFORM club_private.check_profile_image(p_cover_path, prefix, 'cover', 'jpg', 'image/jpeg');
    END IF;
    IF current_club.logo_path IS DISTINCT FROM p_logo_path THEN
      PERFORM club_private.check_profile_image(p_logo_path, prefix, 'logo', 'png', 'image/png');
    END IF;
    UPDATE public.clubs SET name = p_name, description = p_description,
      cover_path = p_cover_path, logo_path = p_logo_path, cover_frame = p_cover_frame, logo_frame = p_logo_frame
    WHERE id = p_club_id RETURNING * INTO current_club;
  END IF;
  RETURN jsonb_build_object('id', current_club.id, 'name', current_club.name,
    'description', current_club.description, 'cover_path', current_club.cover_path,
    'logo_path', current_club.logo_path, 'profile_revision', current_club.profile_revision,
    'cover_frame', current_club.cover_frame, 'logo_frame', current_club.logo_frame);
END;
$$;

REVOKE ALL ON FUNCTION public.club_create_framed_profile(uuid,text,text,text,text,jsonb,jsonb),
  public.club_save_framed_profile(uuid,integer,text,text,text,text,jsonb,jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.club_create_framed_profile(uuid,text,text,text,text,jsonb,jsonb),
  public.club_save_framed_profile(uuid,integer,text,text,text,text,jsonb,jsonb) TO authenticated;

COMMIT;
