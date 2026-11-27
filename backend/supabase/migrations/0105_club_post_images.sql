BEGIN;

CREATE TABLE club_private.post_images (
  post_id uuid PRIMARY KEY REFERENCES public.club_posts(id) ON DELETE CASCADE,
  revision uuid NOT NULL,
  source_jpeg bytea NOT NULL CHECK (octet_length(source_jpeg) BETWEEN 1 AND 458752),
  cropped_jpeg bytea NOT NULL CHECK (octet_length(cropped_jpeg) BETWEEN 1 AND 458752),
  frame jsonb NOT NULL
);

CREATE TABLE club_private.post_image_saves (
  post_id uuid NOT NULL REFERENCES public.club_posts(id) ON DELETE CASCADE,
  request_id uuid NOT NULL,
  digest text NOT NULL,
  version integer NOT NULL,
  expected_version integer,
  PRIMARY KEY (post_id, request_id)
);

REVOKE ALL ON club_private.post_images, club_private.post_image_saves
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.club_post_image_index(p_club uuid, p_posts uuid[])
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE
  actor uuid := club_private.content_member(p_club);
  images jsonb;
BEGIN
  IF p_posts IS NULL OR cardinality(p_posts) > 42 THEN
    RAISE EXCEPTION 'CLUB_CONTENT_INVALID' USING ERRCODE = '22023';
  END IF;

  SELECT coalesce(jsonb_object_agg(i.post_id, jsonb_build_object('revision', i.revision, 'frame', i.frame)), '{}'::jsonb)
    INTO images
  FROM club_private.post_images i
  JOIN public.club_posts p ON p.id = i.post_id
  WHERE p.club_id = p_club AND p.id = ANY(p_posts) AND p.deleted_at IS NULL
    AND club_private.block_visible(p.author_id);
  RETURN images;
END;
$$;

CREATE FUNCTION public.club_post_image_read(p_club uuid, p_post uuid, p_revision uuid, p_source boolean)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE
  actor uuid := club_private.content_member(p_club);
  image bytea;
BEGIN
  SELECT CASE WHEN p_source IS TRUE THEN i.source_jpeg ELSE i.cropped_jpeg END INTO image
  FROM club_private.post_images i
  JOIN public.club_posts p ON p.id = i.post_id
  WHERE p.club_id = p_club AND p.id = p_post AND p.deleted_at IS NULL AND i.revision = p_revision
    AND (p_source IS NOT TRUE OR p.author_id = actor)
    AND club_private.block_visible(p.author_id);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'CLUB_CONTENT_UNAVAILABLE' USING ERRCODE = 'P0002';
  END IF;
  RETURN encode(image, 'base64');
END;
$$;

CREATE FUNCTION public.club_post_image_save(
  p_club uuid, p_post uuid, p_request uuid, p_version integer, p_payload text, p_mac text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE
  actor uuid := club_private.content_member(p_club, true);
  signing_key bytea;
  expected_mac bytea;
  secret_hex text;
  payload jsonb;
  image jsonb;
  result jsonb;
  saved club_private.post_image_saves;
  post public.club_posts;
  saved_version integer;
BEGIN
  IF p_post IS NULL OR p_request IS NULL OR p_payload IS NULL OR octet_length(p_payload) > 1250000
     OR p_mac IS NULL OR p_mac !~ '^[a-f0-9]{64}$' OR p_version < 1
     OR (p_version IS NULL AND p_request <> p_post) THEN
    RAISE EXCEPTION 'CLUB_CONTENT_INVALID' USING ERRCODE = '22023';
  END IF;

  SELECT CASE WHEN count(*) = 1 THEN max(decrypted_secret) END INTO secret_hex
  FROM vault.decrypted_secrets WHERE name = 'club_gallery_upload_commit_hmac';
  IF secret_hex IS NULL OR secret_hex !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'CLUB_POST_IMAGE_UNAVAILABLE' USING ERRCODE = 'PT503';
  END IF;

  signing_key := decode(secret_hex, 'hex');
  -- Separate the signed message from gallery uploads even though they share a key.
  expected_mac := extensions.hmac(convert_to(concat_ws(chr(10), 'bikeme:club-post-image:v1', actor::text,
    p_club::text, p_post::text, p_request::text, coalesce(p_version::text, '-'), p_payload), 'UTF8'),
    signing_key, 'sha256');
  IF extensions.hmac(expected_mac, signing_key, 'sha256') IS DISTINCT FROM
     extensions.hmac(decode(p_mac, 'hex'), signing_key, 'sha256') THEN
    RAISE EXCEPTION 'CLUB_FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  payload := p_payload::jsonb;
  image := payload->'attachment';
  IF p_version IS NULL AND (image IS NULL OR image = 'null'::jsonb) THEN
    RAISE EXCEPTION 'CLUB_CONTENT_INVALID' USING ERRCODE = '22023';
  END IF;

  -- Serialize retries and compare the live post version before any change.
  PERFORM pg_advisory_xact_lock(hashtextextended('club-post-image:' || p_post::text, 0));
  SELECT * INTO post FROM public.club_posts WHERE id = p_post FOR UPDATE;
  IF FOUND THEN
    IF post.club_id IS DISTINCT FROM p_club OR post.author_id IS DISTINCT FROM actor THEN
      RAISE EXCEPTION 'CLUB_FORBIDDEN' USING ERRCODE = '42501';
    END IF;
    IF post.deleted_at IS NOT NULL THEN
      RAISE EXCEPTION 'CLUB_CONTENT_UNAVAILABLE' USING ERRCODE = 'P0002';
    END IF;

    SELECT * INTO saved FROM club_private.post_image_saves WHERE post_id = p_post AND request_id = p_request;
    IF FOUND THEN
      IF saved.digest IS DISTINCT FROM payload->>'digest' OR saved.expected_version IS DISTINCT FROM p_version THEN
        RAISE EXCEPTION 'CLUB_CONTENT_CONFLICT' USING ERRCODE = 'PT409';
      END IF;
      RETURN jsonb_build_object('id', p_post, 'version', saved.version);
    END IF;
    IF post.version IS DISTINCT FROM p_version THEN
      RAISE EXCEPTION 'CLUB_CONTENT_CONFLICT' USING ERRCODE = 'PT409';
    END IF;
  ELSIF p_version IS NOT NULL THEN
    RAISE EXCEPTION 'CLUB_CONTENT_UNAVAILABLE' USING ERRCODE = 'P0002';
  END IF;

  IF p_version IS NULL THEN
    -- Reserve the ID through the existing content API. Check that the insert
    -- succeeded here even if a legacy text writer used the same ID concurrently.
    INSERT INTO public.club_posts(id, club_id, author_id, body)
      VALUES (p_post, p_club, actor, btrim(payload->>'body'))
      ON CONFLICT (id) DO NOTHING;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'CLUB_CONTENT_CONFLICT' USING ERRCODE = 'PT409';
    END IF;
    result := public.club_content_create(p_club, p_post, payload->>'body', NULL);
    saved_version := (result->>'version')::integer;
  ELSE
    PERFORM public.club_content_change(p_club, 'post', p_post, 'edit', payload->>'body', p_version);
    SELECT version INTO saved_version FROM public.club_posts WHERE id = p_post;
  END IF;

  IF image = 'null'::jsonb THEN
    DELETE FROM club_private.post_images WHERE post_id = p_post;
  ELSE
    INSERT INTO club_private.post_images(post_id, revision, source_jpeg, cropped_jpeg, frame)
      VALUES (p_post, p_request, decode(image->>'source', 'base64'), decode(image->>'crop', 'base64'), image->'frame')
    ON CONFLICT (post_id) DO UPDATE SET revision = excluded.revision, source_jpeg = excluded.source_jpeg,
      cropped_jpeg = excluded.cropped_jpeg, frame = excluded.frame;
  END IF;

  INSERT INTO club_private.post_image_saves(post_id, request_id, digest, version, expected_version)
    VALUES (p_post, p_request, payload->>'digest', saved_version, p_version);
  RETURN jsonb_build_object('id', p_post, 'version', saved_version);
END;
$$;

CREATE FUNCTION club_private.delete_post_image() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
  DELETE FROM club_private.post_images WHERE post_id = new.id;
  DELETE FROM club_private.post_image_saves WHERE post_id = new.id;
  RETURN new;
END;
$$;

CREATE TRIGGER club_post_image_delete AFTER UPDATE OF deleted_at ON public.club_posts
FOR EACH ROW WHEN (old.deleted_at IS NULL AND new.deleted_at IS NOT NULL)
EXECUTE FUNCTION club_private.delete_post_image();

REVOKE ALL ON FUNCTION club_private.delete_post_image(),
  public.club_post_image_index(uuid, uuid[]), public.club_post_image_read(uuid, uuid, uuid, boolean),
  public.club_post_image_save(uuid, uuid, uuid, integer, text, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.club_post_image_index(uuid, uuid[]), public.club_post_image_read(uuid, uuid, uuid, boolean),
  public.club_post_image_save(uuid, uuid, uuid, integer, text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
