-- App Store review candidate. Apply separately after 0063 and pair with delete_account.
BEGIN;

CREATE TABLE club_private.account_deletions (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  club_paths text[] NOT NULL DEFAULT '{}'
);
ALTER TABLE club_private.account_deletions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON club_private.account_deletions FROM PUBLIC, anon, authenticated, service_role;

-- Keep a post shell only when another member's comments need their thread.
ALTER TABLE public.club_posts DROP CONSTRAINT club_posts_check;
ALTER TABLE public.club_posts ADD CONSTRAINT club_posts_check CHECK (
  (deleted_at IS NULL AND (char_length(btrim(body)) BETWEEN 1 AND 4000 OR (author_id IS NULL AND body = '' AND NOT is_pinned)))
  OR (deleted_at IS NOT NULL AND body = '')
);

CREATE FUNCTION club_private.account_media_path_user(p_bucket text, p_path text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = pg_catalog AS $$
  SELECT CASE
    WHEN p_bucket = 'club-profile-images'
      AND p_path ~ '^(create|edit)/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}/(cover-[0-9a-f-]{36}[.]jpg|logo-[0-9a-f-]{36}[.]png)$'
      THEN split_part(p_path, '/', 2)
    WHEN p_bucket = 'avatars'
      AND p_path ~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}/avatar-[0-9]+[.]jpg$'
      THEN split_part(p_path, '/', 1)
  END;
$$;

CREATE FUNCTION club_private.account_media(p_user uuid) RETURNS TABLE(bucket text, path text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
  SELECT o.bucket_id, o.name FROM storage.objects o
  WHERE o.bucket_id IN ('club-profile-images', 'avatars')
    AND COALESCE(NULLIF(o.owner_id, ''), o.owner::text, club_private.account_media_path_user(o.bucket_id, o.name)) = p_user::text;
$$;

-- Shared by deletion preparation, ownership changes, and Storage writes. The
-- Storage trigger also covers uploads that reach Storage while a retry is pending.
CREATE FUNCTION club_private.lock_account_deletion(p_user uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog AS $$
  SELECT pg_advisory_xact_lock(hashtextextended('bikeme:account-delete:' || p_user::text, 0));
$$;

CREATE FUNCTION club_private.require_account_not_deleting(p_user uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
  PERFORM club_private.lock_account_deletion(p_user);
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user)
     OR EXISTS (SELECT 1 FROM club_private.account_deletions WHERE user_id = p_user) THEN
    RAISE EXCEPTION 'ACCOUNT_DELETE_PENDING' USING ERRCODE = '55000';
  END IF;
END;
$$;

CREATE FUNCTION club_private.guard_account_deletion_ownership() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
  IF TG_OP = 'INSERT' OR OLD.owner_id IS DISTINCT FROM NEW.owner_id THEN
    PERFORM club_private.require_account_not_deleting(NEW.owner_id);
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER club_account_deletion_ownership BEFORE INSERT OR UPDATE OF owner_id ON public.clubs
FOR EACH ROW EXECUTE FUNCTION club_private.guard_account_deletion_ownership();

CREATE FUNCTION club_private.guard_account_deletion_media() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE actor text;
BEGIN
  IF NEW.bucket_id IN ('club-profile-images', 'avatars') THEN
    actor := COALESCE(NULLIF(NEW.owner_id, ''), NEW.owner::text, club_private.account_media_path_user(NEW.bucket_id, NEW.name));
    IF actor ~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' THEN
      PERFORM club_private.require_account_not_deleting(actor::uuid);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER club_account_deletion_media BEFORE INSERT OR UPDATE ON storage.objects
FOR EACH ROW EXECUTE FUNCTION club_private.guard_account_deletion_media();

CREATE FUNCTION public.account_deletion_prepare(p_user uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE files jsonb; paths text[];
BEGIN
  PERFORM club_private.lock_account_deletion(p_user);
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user) THEN
    RAISE EXCEPTION 'ACCOUNT_DELETE_AUTH_REQUIRED' USING ERRCODE = '28000';
  END IF;
  IF EXISTS (SELECT 1 FROM public.clubs WHERE owner_id = p_user) THEN
    RAISE EXCEPTION 'ACCOUNT_DELETE_CLUB_OWNERSHIP_REQUIRED' USING ERRCODE = '23503';
  END IF;
  SELECT COALESCE(jsonb_agg(to_jsonb(batch)), '[]'), COALESCE(array_agg(path) FILTER (WHERE bucket = 'club-profile-images'), '{}')
  INTO files, paths FROM (SELECT * FROM club_private.account_media(p_user) ORDER BY bucket, path LIMIT 100) batch;
  INSERT INTO club_private.account_deletions AS pending(user_id, club_paths) VALUES (p_user, paths)
  ON CONFLICT (user_id) DO UPDATE SET club_paths =
    ARRAY(SELECT DISTINCT unnest(pending.club_paths || EXCLUDED.club_paths));
  RETURN files;
END;
$$;

CREATE FUNCTION club_private.erase_account_content() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE actor uuid := OLD.id; stamp timestamptz := clock_timestamp(); paths text[]; locked_id uuid;
BEGIN
  PERFORM club_private.lock_account_deletion(actor);
  IF EXISTS (SELECT 1 FROM public.clubs WHERE owner_id = actor) THEN
    RAISE EXCEPTION 'ACCOUNT_DELETE_CLUB_OWNERSHIP_REQUIRED' USING ERRCODE = '23503';
  END IF;
  IF EXISTS (SELECT 1 FROM club_private.account_media(actor)) THEN
    RAISE EXCEPTION 'ACCOUNT_DELETE_MEDIA_REMAINING' USING ERRCODE = '55000';
  END IF;

  -- Use the same club/conversation rows as the write RPCs, so a report cannot
  -- save an old snapshot while its source is erased. An aborted transaction is retryable.
  FOR locked_id IN SELECT c.id FROM public.clubs c WHERE c.id IN (
    SELECT club_id FROM public.club_posts WHERE author_id = actor
    UNION SELECT club_id FROM public.club_comments WHERE author_id = actor
    UNION SELECT club_id FROM public.club_chat_messages WHERE author_id = actor
    UNION SELECT club_id FROM club_private.content_reports
      WHERE reporter_id = actor OR snapshot->>'author_id' = actor::text OR snapshot#>>'{reply,author_id}' = actor::text
  ) ORDER BY c.id FOR UPDATE LOOP
    UPDATE public.clubs SET updated_at = updated_at WHERE id = locked_id;
  END LOOP;
  FOR locked_id IN SELECT c.id FROM dm_private.conversations c WHERE actor IN (low_id, high_id)
  ORDER BY c.id FOR UPDATE LOOP
    UPDATE dm_private.conversations SET guard_version = guard_version + 1 WHERE id = locked_id;
  END LOOP;

  -- Remove free text written by this reporter. For reports by others, retain
  -- only case metadata when the subject is erased. Scrub embedded quotes too.
  DELETE FROM club_private.content_reports WHERE reporter_id = actor;
  DELETE FROM dm_private.reports WHERE reporter_id = actor;
  UPDATE club_private.content_reports SET detail = '', snapshot =
    (snapshot - ARRAY['author_id','display_name','avatar_url','reply','reply_to_id']) || '{"body":""}'::jsonb
  WHERE snapshot->>'author_id' = actor::text
     OR (target_kind = 'post' AND post_id IN (SELECT id FROM public.club_posts WHERE author_id = actor))
     OR comment_id IN (SELECT id FROM public.club_comments WHERE author_id = actor)
     OR chat_message_id IN (SELECT id FROM public.club_chat_messages WHERE author_id = actor);
  UPDATE club_private.content_reports SET snapshot = snapshot - 'reply'
  WHERE snapshot#>>'{reply,author_id}' = actor::text;
  UPDATE dm_private.reports SET detail = '', resolution = NULL, snapshot =
    (snapshot - ARRAY['author_id','reply_to_id']) || '{"body":""}'::jsonb
  WHERE snapshot->>'author_id' = actor::text
     OR target_id IN (SELECT id FROM dm_private.messages WHERE author_id = actor);

  UPDATE public.club_comments SET body = '', author_id = NULL, deleted_at = stamp, version = version + 1
  WHERE author_id = actor AND deleted_at IS NULL;
  UPDATE public.club_posts p SET body = '', author_id = NULL, is_pinned = false, version = version + 1,
    deleted_at = CASE WHEN EXISTS (SELECT 1 FROM public.club_comments c WHERE c.post_id = p.id AND c.deleted_at IS NULL) THEN NULL ELSE stamp END
  WHERE p.author_id = actor AND p.deleted_at IS NULL;
  UPDATE public.club_chat_messages SET body = '', author_id = NULL, deleted_at = stamp, version = version + 1
  WHERE author_id = actor AND deleted_at IS NULL;
  UPDATE dm_private.messages SET body = '', author_id = NULL, deleted_at = stamp, version = version + 1
  WHERE author_id = actor AND deleted_at IS NULL;

  SELECT club_paths INTO paths FROM club_private.account_deletions WHERE user_id = actor;
  -- Include old, already missing objects with the canonical path. An existing
  -- object attributed to another uploader is left intact.
  UPDATE public.clubs c SET cover_path = NULL, cover_frame = NULL
  WHERE (c.cover_path = ANY(paths) OR club_private.account_media_path_user('club-profile-images', c.cover_path) = actor::text)
    AND NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'club-profile-images' AND o.name = c.cover_path);
  UPDATE public.clubs c SET logo_path = NULL, logo_frame = NULL
  WHERE (c.logo_path = ANY(paths) OR club_private.account_media_path_user('club-profile-images', c.logo_path) = actor::text)
    AND NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'club-profile-images' AND o.name = c.logo_path);
  RETURN OLD;
END;
$$;
CREATE TRIGGER bikeme_erase_account_content BEFORE DELETE ON auth.users
FOR EACH ROW EXECUTE FUNCTION club_private.erase_account_content();

REVOKE ALL ON FUNCTION
  club_private.account_media_path_user(text,text), club_private.account_media(uuid), club_private.lock_account_deletion(uuid),
  club_private.require_account_not_deleting(uuid), club_private.guard_account_deletion_ownership(),
  club_private.guard_account_deletion_media(), club_private.erase_account_content(), public.account_deletion_prepare(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.account_deletion_prepare(uuid) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
