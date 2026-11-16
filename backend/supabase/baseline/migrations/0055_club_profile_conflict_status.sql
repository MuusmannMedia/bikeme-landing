-- A stale edit is a business conflict. The gateway retries SQLSTATE 40001.
CREATE OR REPLACE FUNCTION public.club_save_profile(p_club_id uuid, p_revision integer, p_name text,
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
      RAISE EXCEPTION 'CLUB_PROFILE_CHANGED' USING ERRCODE = 'PT409';
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
