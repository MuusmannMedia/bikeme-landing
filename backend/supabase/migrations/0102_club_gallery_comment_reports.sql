BEGIN;

ALTER TABLE club_private.content_reports DROP CONSTRAINT content_reports_target_kind_check;
ALTER TABLE club_private.content_reports ADD CONSTRAINT content_reports_target_kind_check
  CHECK (target_kind IN ('post', 'comment', 'chat', 'photo', 'photo_comment'));
ALTER TABLE club_private.content_reports DROP CONSTRAINT content_reports_target_shape;
ALTER TABLE club_private.content_reports ADD CONSTRAINT content_reports_target_shape CHECK (
  (target_kind='chat' AND chat_message_id IS NOT NULL AND chat_message_id=target_id AND post_id IS NULL AND comment_id IS NULL) OR
  (target_kind='post' AND post_id IS NOT NULL AND post_id=target_id AND chat_message_id IS NULL AND comment_id IS NULL) OR
  (target_kind='comment' AND comment_id IS NOT NULL AND comment_id=target_id AND post_id IS NOT NULL AND chat_message_id IS NULL) OR
  (target_kind IN ('photo','photo_comment') AND post_id IS NULL AND comment_id IS NULL AND chat_message_id IS NULL)
);
ALTER TABLE club_private.bike_me_reports DROP CONSTRAINT bike_me_reports_target_kind_check;
ALTER TABLE club_private.bike_me_reports ADD CONSTRAINT bike_me_reports_target_kind_check
  CHECK (target_kind IN ('post', 'comment', 'chat', 'photo', 'photo_comment'));

-- Gallery reports capture their context at submission. The chat/post trigger
-- would otherwise look them up in a thread table that cannot contain them.
DO $migration$
DECLARE definition text := pg_get_functiondef('club_private.capture_thread_report()'::regprocedure);
anchor text := 'NEW.evidence_context:=club_private.thread_evidence(NEW.club_id,NEW.target_kind,NEW.target_id);';
BEGIN
  IF cardinality(string_to_array(definition,anchor))<>2 THEN
    RAISE EXCEPTION 'GALLERY_THREAD_EVIDENCE_BASELINE_CHANGED';
  END IF;
  EXECUTE replace(definition,anchor,
    'IF NEW.target_kind NOT IN (''photo'',''photo_comment'') THEN '||anchor||' END IF;');
END;
$migration$;

CREATE OR REPLACE FUNCTION public.club_gallery_discussion(
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
      'id',q.id,'body',q.body,'author',p.display_name,'createdAt',q.created_at,'removable',q.author_id=actor OR moderator,
      'reportable',q.author_id<>actor
    ) ORDER BY q.created_at DESC,q.id DESC),'[]'::jsonb)
    FROM (SELECT c.id,c.body,c.author_id,c.created_at FROM club_private.gallery_comments c
      WHERE c.photo_id=p_photo AND c.deleted_at IS NULL AND club_private.block_visible(c.author_id)
        AND (p_before_id IS NULL OR (c.created_at,c.id)<(p_before_time,p_before_id))
      ORDER BY c.created_at DESC,c.id DESC LIMIT 21) q
    LEFT JOIN public.profiles p ON p.id=q.author_id)
  );
END;
$$;

CREATE FUNCTION public.club_gallery_report_comment(
  p_club uuid,p_photo uuid,p_comment uuid,p_destination text,p_reason text,p_detail text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE
  actor uuid := club_private.content_member(p_club,true);
  comment club_private.gallery_comments;
  uploader uuid;
  report uuid;
BEGIN
  IF p_photo IS NULL OR p_comment IS NULL OR p_destination IS NULL OR p_destination NOT IN ('club','bikeMe')
    OR p_reason IS NULL OR p_reason NOT IN ('spam','harassment','unsafe','other') OR char_length(coalesce(p_detail,''))>500 THEN
    RAISE EXCEPTION 'GALLERY_INPUT' USING ERRCODE='22023';
  END IF;

  -- An accepted submission can be retried after removal. It cannot create
  -- another case, and a former member still fails the membership check.
  IF p_destination='club' THEN
    IF EXISTS(SELECT 1 FROM club_private.content_reports
      WHERE club_id=p_club AND target_kind='photo_comment' AND target_id=p_comment AND reporter_id=actor) THEN RETURN; END IF;
  ELSE
    IF EXISTS(SELECT 1 FROM club_private.bike_me_reports
      WHERE club_id=p_club AND target_kind='photo_comment' AND target_id=p_comment AND reporter_id=actor) THEN RETURN; END IF;
  END IF;

  SELECT author_id INTO uploader FROM club_private.gallery_photos WHERE club_id=p_club AND id=p_photo;
  IF NOT FOUND THEN RAISE EXCEPTION 'GALLERY_UNAVAILABLE' USING ERRCODE='P0002'; END IF;
  PERFORM club_private.require_visible_target(actor,uploader,'GALLERY_UNAVAILABLE','P0002');
  SELECT * INTO comment FROM club_private.gallery_comments WHERE photo_id=p_photo AND id=p_comment AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'GALLERY_UNAVAILABLE' USING ERRCODE='P0002'; END IF;
  IF comment.author_id=actor THEN RAISE EXCEPTION 'GALLERY_ACCESS' USING ERRCODE='42501'; END IF;
  PERFORM club_private.require_visible_target(actor,comment.author_id,'GALLERY_UNAVAILABLE','P0002');

  IF p_destination='club' THEN
    INSERT INTO club_private.content_reports(club_id,reporter_id,target_kind,target_id,reason,detail,snapshot)
    VALUES(p_club,actor,'photo_comment',p_comment,p_reason,btrim(coalesce(p_detail,'')),
      jsonb_build_object('kind','photo_comment','id',p_comment,'club_id',p_club,'photo_id',p_photo,
        'author_id',comment.author_id,'body',comment.body,'created_at',comment.created_at,
        'display_name',(SELECT display_name FROM public.profiles WHERE id=comment.author_id)))
    RETURNING id INTO report;
    INSERT INTO club_private.gallery_club_evidence VALUES(report,p_photo);
  ELSE
    INSERT INTO club_private.bike_me_reports(club_id,target_kind,target_id,author_id,reporter_id,body,reason,detail,evidence_context)
    VALUES(p_club,'photo_comment',p_comment,comment.author_id,actor,comment.body,p_reason,btrim(coalesce(p_detail,'')),
      jsonb_build_array(jsonb_build_object('photo_id',p_photo,'comment_created_at',comment.created_at)))
    RETURNING id INTO report;
    INSERT INTO club_private.gallery_support_evidence VALUES(report,p_photo);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.club_gallery_evidence(p_club uuid,p_report uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE actor uuid := club_private.content_member(p_club); encoded text;
BEGIN
  IF club_private.role_for(p_club,actor) NOT IN ('owner','admin') THEN RAISE EXCEPTION 'GALLERY_ACCESS' USING ERRCODE='42501'; END IF;
  SELECT replace(encode(i.image,'base64'), E'\n','') INTO encoded
    FROM club_private.content_reports r JOIN club_private.gallery_club_evidence e ON e.report_id=r.id
    JOIN club_private.gallery_images i ON i.id=e.photo_id
    WHERE r.id=p_report AND r.club_id=p_club AND r.target_kind IN ('photo','photo_comment');
  IF NOT FOUND THEN RAISE EXCEPTION 'GALLERY_UNAVAILABLE' USING ERRCODE='P0002'; END IF;
  RETURN encoded;
END;
$$;

CREATE OR REPLACE FUNCTION club_private.gallery_moderation_page(
  p_club uuid,p_closed boolean,p_before_time timestamptz,p_before_id uuid,p_limit integer,p_include_photos boolean
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE actor uuid := club_private.content_member(p_club);
BEGIN
  IF club_private.role_for(p_club,actor) NOT IN ('owner','admin') THEN
    RAISE EXCEPTION 'CLUB_FORBIDDEN' USING ERRCODE='42501';
  END IF;
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 20 OR num_nonnulls(p_before_time,p_before_id) NOT IN (0,2) THEN
    RAISE EXCEPTION 'CLUB_CONTENT_INVALID' USING ERRCODE='22023';
  END IF;
  RETURN jsonb_build_object('items',(
    SELECT coalesce(jsonb_agg(
      club_private.content_report_json(q.id) ||
      CASE WHEN q.target_kind IN ('photo','photo_comment') THEN jsonb_build_object('has_image_evidence',
        EXISTS(SELECT 1 FROM club_private.gallery_club_evidence e WHERE e.report_id=q.id))
      ELSE '{}'::jsonb END
      ORDER BY q.created_at DESC,q.id DESC),'[]')
    FROM (SELECT r.id,r.created_at,r.target_kind FROM club_private.content_reports r
      WHERE r.club_id=p_club AND (r.status<>'pending')=p_closed
        AND (p_include_photos OR r.target_kind NOT IN ('photo','photo_comment'))
        AND (p_before_id IS NULL OR (r.created_at,r.id)<(p_before_time,p_before_id))
      ORDER BY r.created_at DESC,r.id DESC LIMIT p_limit) q
  ));
END;
$$;

-- Existing report resolvers still own the status transition, authorization
-- and audit. Resolving a comment never removes its parent photo.
CREATE FUNCTION club_private.gallery_resolve_comment() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
  UPDATE club_private.gallery_comments c SET body='',deleted_at=clock_timestamp()
  FROM club_private.gallery_photos p
  WHERE p.id=c.photo_id AND p.club_id=NEW.club_id AND c.id=NEW.target_id AND c.deleted_at IS NULL;
  RETURN NEW;
END;
$$;
CREATE TRIGGER gallery_club_resolve_comment AFTER UPDATE OF status ON club_private.content_reports FOR EACH ROW
  WHEN (OLD.status='pending' AND NEW.status='removed' AND NEW.target_kind='photo_comment') EXECUTE FUNCTION club_private.gallery_resolve_comment();
CREATE TRIGGER gallery_support_resolve_comment AFTER UPDATE OF status ON club_private.bike_me_reports FOR EACH ROW
  WHEN (OLD.status='pending' AND NEW.status='removed' AND NEW.target_kind='photo_comment') EXECUTE FUNCTION club_private.gallery_resolve_comment();

DO $migration$
DECLARE definition text := pg_get_functiondef('public.club_support_resolve(uuid,text,text,text)'::regprocedure);
BEGIN
  IF cardinality(string_to_array(definition,'WHEN ''photo'' THEN NULL;'))<>2 THEN
    RAISE EXCEPTION 'GALLERY_SUPPORT_BASELINE_CHANGED';
  END IF;
  EXECUTE replace(definition,'WHEN ''photo'' THEN NULL;',
    E'WHEN ''photo'' THEN NULL;\n      WHEN ''photo_comment'' THEN NULL;');
END;
$migration$;

CREATE OR REPLACE FUNCTION public.club_gallery_remove_comment(p_club uuid,p_photo uuid,p_comment uuid)
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
  IF FOUND THEN
    INSERT INTO club_private.content_actions(club_id,actor_id,target_kind,target_id,action)
    VALUES(p_club,actor,'photo_comment',p_comment,CASE WHEN author=actor THEN 'author_delete' ELSE 'moderator_remove' END);
  END IF;
END;
$$;

-- A reported comment's author can be erased while the photo belongs to
-- someone else. Drop that case's photo reference as part of the existing scrub.
CREATE FUNCTION club_private.gallery_scrub_comment_evidence() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
  IF TG_TABLE_NAME='content_reports' THEN
    DELETE FROM club_private.gallery_club_evidence WHERE report_id=NEW.id;
  ELSE
    DELETE FROM club_private.gallery_support_evidence WHERE report_id=NEW.id;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER gallery_club_scrub_comment_evidence AFTER UPDATE OF snapshot ON club_private.content_reports FOR EACH ROW
  WHEN (NEW.target_kind='photo_comment' AND OLD.snapshot->>'author_id' IS NOT NULL AND NEW.snapshot->>'author_id' IS NULL)
  EXECUTE FUNCTION club_private.gallery_scrub_comment_evidence();
CREATE TRIGGER gallery_support_scrub_comment_evidence AFTER UPDATE OF author_id ON club_private.bike_me_reports FOR EACH ROW
  WHEN (NEW.target_kind='photo_comment' AND OLD.author_id IS NOT NULL AND NEW.author_id IS NULL)
  EXECUTE FUNCTION club_private.gallery_scrub_comment_evidence();

REVOKE ALL ON FUNCTION public.club_gallery_report_comment(uuid,uuid,uuid,text,text,text),
  club_private.gallery_resolve_comment(),club_private.gallery_scrub_comment_evidence()
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.club_gallery_report_comment(uuid,uuid,uuid,text,text,text) TO authenticated;

NOTIFY pgrst,'reload schema';
COMMIT;
