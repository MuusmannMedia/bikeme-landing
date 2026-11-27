BEGIN;

CREATE TABLE club_private.post_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.club_posts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  width integer NOT NULL CHECK (width BETWEEN 1 AND 1600),
  height integer NOT NULL CHECK (height BETWEEN 1 AND 1600),
  image bytea NOT NULL CHECK (octet_length(image) BETWEEN 3 AND 500000),
  thumbnail bytea NOT NULL CHECK (octet_length(thumbnail) BETWEEN 3 AND 45000)
);
CREATE INDEX post_attachments_order ON club_private.post_attachments(post_id, created_at, id);

CREATE TABLE club_private.post_attachment_uploads (
  post_id uuid NOT NULL REFERENCES public.club_posts(id) ON DELETE CASCADE,
  request_id uuid NOT NULL,
  digest text NOT NULL CHECK (digest ~ '^[a-f0-9]{64}$'),
  PRIMARY KEY (post_id, request_id)
);
REVOKE ALL ON club_private.post_attachments, club_private.post_attachment_uploads
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.club_post_image_index(p_club uuid, p_posts uuid[])
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE
  actor uuid := club_private.content_member(p_club);
  images jsonb;
BEGIN
  IF p_posts IS NULL OR cardinality(p_posts) > 42 THEN
    RAISE EXCEPTION 'CLUB_CONTENT_INVALID' USING ERRCODE = '22023';
  END IF;
  SELECT coalesce(jsonb_object_agg(p.id, jsonb_build_object('revision', i.revision, 'frame', i.frame, 'attachment', a.id)), '{}'::jsonb)
    INTO images
  FROM public.club_posts p
  LEFT JOIN club_private.post_images i ON i.post_id = p.id
  LEFT JOIN LATERAL (
    SELECT id FROM club_private.post_attachments WHERE post_id = p.id ORDER BY created_at, id LIMIT 1
  ) a ON true
  WHERE p.club_id = p_club AND p.id = ANY(p_posts) AND p.deleted_at IS NULL
    AND club_private.block_visible(p.author_id) AND (i.post_id IS NOT NULL OR a.id IS NOT NULL);
  RETURN images || '{"attachmentsSupported":true}'::jsonb;
END;
$$;

CREATE FUNCTION public.club_post_attachments(p_club uuid, p_post uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
  PERFORM public.club_content_item(p_club, 'post', p_post);
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id', id, 'width', width, 'height', height) ORDER BY created_at, id)
                   FROM club_private.post_attachments WHERE post_id = p_post), '[]'::jsonb);
END;
$$;

CREATE FUNCTION public.club_post_attachment_image(p_club uuid, p_post uuid, p_photo uuid, p_thumbnail boolean)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
  PERFORM public.club_content_item(p_club, 'post', p_post);
  RETURN (SELECT encode(CASE WHEN p_thumbnail THEN thumbnail ELSE image END, 'base64')
          FROM club_private.post_attachments WHERE post_id = p_post AND id = p_photo);
END;
$$;

CREATE FUNCTION club_private.lock_post_attachment_owner(p_club uuid, p_post uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE
  actor uuid := club_private.content_member(p_club, true);
  post public.club_posts;
BEGIN
  SELECT * INTO post FROM public.club_posts WHERE club_id = p_club AND id = p_post FOR UPDATE;
  IF NOT FOUND OR post.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'CLUB_CONTENT_UNAVAILABLE' USING ERRCODE = 'P0002';
  END IF;
  IF post.author_id IS DISTINCT FROM actor THEN
    RAISE EXCEPTION 'CLUB_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  RETURN actor;
END;
$$;

CREATE FUNCTION public.club_post_attachments_commit(p_club uuid, p_post uuid, p_request uuid, p_digest text, p_payload text, p_mac text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE
  actor uuid := club_private.lock_post_attachment_owner(p_club, p_post);
  signing_key bytea;
  expected_mac bytea;
  secret_hex text;
  saved_digest text;
  photos jsonb;
BEGIN
  IF p_request IS NULL OR p_digest IS NULL OR p_digest !~ '^[a-f0-9]{64}$' OR p_payload IS NULL
    OR octet_length(p_payload) > 3700000 OR p_mac IS NULL OR p_mac !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'CLUB_CONTENT_INVALID' USING ERRCODE = '22023';
  END IF;

  SELECT CASE WHEN count(*) = 1 THEN max(decrypted_secret) END INTO secret_hex
  FROM vault.decrypted_secrets WHERE name = 'club_gallery_upload_commit_hmac';
  IF secret_hex IS NULL OR secret_hex !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'CLUB_POST_IMAGE_UNAVAILABLE' USING ERRCODE = 'PT503';
  END IF;
  signing_key := decode(secret_hex, 'hex');
  expected_mac := extensions.hmac(convert_to(concat_ws(chr(10), 'bikeme:club-post-attachments:v1',
    actor::text, p_club::text, p_post::text, p_request::text, p_digest, p_payload), 'UTF8'), signing_key, 'sha256');
  IF extensions.hmac(expected_mac, signing_key, 'sha256') IS DISTINCT FROM
     extensions.hmac(decode(p_mac, 'hex'), signing_key, 'sha256') THEN
    RAISE EXCEPTION 'CLUB_FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  SELECT digest INTO saved_digest FROM club_private.post_attachment_uploads WHERE post_id = p_post AND request_id = p_request;
  IF FOUND THEN
    IF saved_digest IS DISTINCT FROM p_digest THEN
      RAISE EXCEPTION 'CLUB_CONTENT_CONFLICT' USING ERRCODE = 'PT409';
    END IF;
    RETURN;
  END IF;
  photos := p_payload::jsonb;
  IF jsonb_typeof(photos) <> 'array' OR jsonb_array_length(photos) NOT BETWEEN 1 AND 5 THEN
    RAISE EXCEPTION 'CLUB_CONTENT_INVALID' USING ERRCODE = '22023';
  END IF;
  IF (SELECT count(*) FROM club_private.post_attachments WHERE post_id = p_post) + jsonb_array_length(photos) > 24 THEN
    RAISE EXCEPTION 'CLUB_POST_IMAGE_CAPACITY' USING ERRCODE = 'PT413';
  END IF;
  INSERT INTO club_private.post_attachments(post_id, width, height, image, thumbnail)
    SELECT p_post, (photo->>'width')::integer, (photo->>'height')::integer, decode(photo->>'image', 'base64'),
           decode(photo->>'thumbnail', 'base64')
    FROM jsonb_array_elements(photos) WITH ORDINALITY AS batch(photo, position) ORDER BY position;
  INSERT INTO club_private.post_attachment_uploads(post_id, request_id, digest)
    VALUES (p_post, p_request, p_digest);
END;
$$;

CREATE FUNCTION public.club_post_attachment_remove(p_club uuid, p_post uuid, p_photo uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
  PERFORM club_private.lock_post_attachment_owner(p_club, p_post);
  DELETE FROM club_private.post_attachments WHERE post_id = p_post AND id = p_photo;
END;
$$;

-- The existing soft-delete trigger also covers moderation and account deletion.
CREATE OR REPLACE FUNCTION club_private.delete_post_image() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
  DELETE FROM club_private.post_images WHERE post_id = new.id;
  DELETE FROM club_private.post_image_saves WHERE post_id = new.id;
  DELETE FROM club_private.post_attachments WHERE post_id = new.id;
  DELETE FROM club_private.post_attachment_uploads WHERE post_id = new.id;
  RETURN new;
END;
$$;

REVOKE ALL ON FUNCTION club_private.lock_post_attachment_owner(uuid, uuid),
  public.club_post_attachments(uuid, uuid), public.club_post_attachment_image(uuid, uuid, uuid, boolean),
  public.club_post_attachments_commit(uuid, uuid, uuid, text, text, text), public.club_post_attachment_remove(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.club_post_attachments(uuid, uuid),
  public.club_post_attachment_image(uuid, uuid, uuid, boolean), public.club_post_attachments_commit(uuid, uuid, uuid, text, text, text),
  public.club_post_attachment_remove(uuid, uuid, uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
