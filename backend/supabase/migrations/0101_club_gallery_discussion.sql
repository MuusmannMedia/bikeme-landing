BEGIN;

CREATE TABLE club_private.gallery_likes (
  photo_id uuid NOT NULL REFERENCES club_private.gallery_photos(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  PRIMARY KEY (photo_id, actor_id)
);
CREATE INDEX gallery_likes_actor ON club_private.gallery_likes(actor_id);

CREATE TABLE club_private.gallery_comments (
  id uuid PRIMARY KEY,
  photo_id uuid NOT NULL REFERENCES club_private.gallery_photos(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  deleted_at timestamptz,
  CHECK ((deleted_at IS NULL AND char_length(body) BETWEEN 1 AND 1500 AND body ~ '[^[:space:]]')
         OR (deleted_at IS NOT NULL AND body = ''))
);
CREATE INDEX gallery_comments_page ON club_private.gallery_comments(photo_id, created_at DESC, id DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX gallery_comments_photo ON club_private.gallery_comments(photo_id);
CREATE INDEX gallery_comments_author ON club_private.gallery_comments(author_id);

ALTER TABLE club_private.gallery_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_private.gallery_comments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON club_private.gallery_likes, club_private.gallery_comments FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER gallery_comment_filter AFTER INSERT ON club_private.gallery_comments
  FOR EACH ROW EXECUTE FUNCTION club_private.check_content_body();

-- Write callers hold the same club lock as photo deletion and membership changes.
CREATE FUNCTION club_private.gallery_discussion_actor(p_club uuid, p_photo uuid, p_write boolean DEFAULT false)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE actor uuid; uploader uuid;
BEGIN
  IF p_write THEN
    PERFORM club_private.require_account_not_deleting(club_private.require_user());
  END IF;
  actor := club_private.content_member(p_club,p_write);
  SELECT author_id INTO uploader FROM club_private.gallery_photos WHERE club_id=p_club AND id=p_photo;
  IF NOT FOUND OR NOT club_private.block_visible(uploader) THEN
    RAISE EXCEPTION 'GALLERY_UNAVAILABLE' USING ERRCODE='P0002';
  END IF;
  IF p_write THEN PERFORM club_private.require_visible_target(actor,uploader,'GALLERY_UNAVAILABLE','P0002'); END IF;
  RETURN actor;
END;
$$;

CREATE FUNCTION public.club_gallery_discussion(
  p_club uuid, p_photo uuid, p_before_time timestamptz DEFAULT NULL, p_before_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE actor uuid := club_private.gallery_discussion_actor(p_club,p_photo); moderator boolean;
BEGIN
  IF num_nonnulls(p_before_time,p_before_id) NOT IN (0,2) THEN
    RAISE EXCEPTION 'GALLERY_INPUT' USING ERRCODE='22023';
  END IF;
  moderator := club_private.role_for(p_club,actor) IN ('owner','admin');
  RETURN jsonb_build_object(
    'liked', EXISTS(SELECT 1 FROM club_private.gallery_likes WHERE photo_id=p_photo AND actor_id=actor),
    'likeCount', (SELECT count(*) FROM club_private.gallery_likes WHERE photo_id=p_photo AND club_private.block_visible(actor_id)),
    'comments', (SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id',q.id,'body',q.body,'author',p.display_name,'createdAt',q.created_at,'removable',q.author_id=actor OR moderator
    ) ORDER BY q.created_at DESC,q.id DESC),'[]'::jsonb)
    FROM (SELECT c.id,c.body,c.author_id,c.created_at FROM club_private.gallery_comments c
      WHERE c.photo_id=p_photo AND c.deleted_at IS NULL AND club_private.block_visible(c.author_id)
        AND (p_before_id IS NULL OR (c.created_at,c.id)<(p_before_time,p_before_id))
      ORDER BY c.created_at DESC,c.id DESC LIMIT 21) q
    LEFT JOIN public.profiles p ON p.id=q.author_id)
  );
END;
$$;

CREATE FUNCTION public.club_gallery_set_like(p_club uuid, p_photo uuid, p_liked boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE actor uuid := club_private.gallery_discussion_actor(p_club,p_photo,true);
BEGIN
  IF p_liked IS NULL THEN RAISE EXCEPTION 'GALLERY_INPUT' USING ERRCODE='22023'; END IF;
  IF p_liked THEN
    INSERT INTO club_private.gallery_likes(photo_id,actor_id) VALUES(p_photo,actor) ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM club_private.gallery_likes WHERE photo_id=p_photo AND actor_id=actor;
  END IF;
END;
$$;

CREATE FUNCTION public.club_gallery_add_comment(p_club uuid, p_photo uuid, p_comment uuid, p_body text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE actor uuid := club_private.gallery_discussion_actor(p_club,p_photo,true); prior club_private.gallery_comments;
BEGIN
  IF p_comment IS NULL OR p_body IS NULL OR char_length(btrim(p_body)) NOT BETWEEN 1 AND 1500 OR btrim(p_body) !~ '[^[:space:]]' THEN
    RAISE EXCEPTION 'GALLERY_INPUT' USING ERRCODE='22023';
  END IF;
  INSERT INTO club_private.gallery_comments(id,photo_id,author_id,body)
    VALUES (p_comment,p_photo,actor,btrim(p_body)) ON CONFLICT DO NOTHING;
  IF FOUND THEN RETURN; END IF;
  SELECT * INTO prior FROM club_private.gallery_comments WHERE id=p_comment;
  IF prior.author_id IS DISTINCT FROM actor OR prior.photo_id IS DISTINCT FROM p_photo
     OR (prior.deleted_at IS NULL AND prior.body IS DISTINCT FROM btrim(p_body)) THEN
    RAISE EXCEPTION 'GALLERY_CONFLICT' USING ERRCODE='PT409';
  END IF;
END;
$$;

CREATE FUNCTION public.club_gallery_remove_comment(p_club uuid, p_photo uuid, p_comment uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE actor uuid := club_private.gallery_discussion_actor(p_club,p_photo,true); author uuid;
BEGIN
  SELECT author_id INTO author FROM club_private.gallery_comments WHERE photo_id=p_photo AND id=p_comment;
  IF NOT FOUND THEN RETURN; END IF;
  IF author<>actor AND club_private.role_for(p_club,actor) NOT IN ('owner','admin') THEN
    RAISE EXCEPTION 'GALLERY_ACCESS' USING ERRCODE='42501';
  END IF;
  IF author<>actor THEN PERFORM club_private.require_visible_target(actor,author,'GALLERY_UNAVAILABLE','P0002'); END IF;
  UPDATE club_private.gallery_comments SET body='',deleted_at=clock_timestamp()
    WHERE id=p_comment AND deleted_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION club_private.gallery_discussion_actor(uuid,uuid,boolean),
  public.club_gallery_discussion(uuid,uuid,timestamptz,uuid),public.club_gallery_set_like(uuid,uuid,boolean),
  public.club_gallery_add_comment(uuid,uuid,uuid,text),public.club_gallery_remove_comment(uuid,uuid,uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.club_gallery_discussion(uuid,uuid,timestamptz,uuid),
  public.club_gallery_set_like(uuid,uuid,boolean),public.club_gallery_add_comment(uuid,uuid,uuid,text),
  public.club_gallery_remove_comment(uuid,uuid,uuid) TO authenticated;

NOTIFY pgrst,'reload schema';
COMMIT;
