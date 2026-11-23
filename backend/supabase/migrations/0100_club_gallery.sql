BEGIN;

CREATE TABLE club_private.gallery_uploads (
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id uuid NOT NULL,
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  digest text NOT NULL CHECK (digest ~ '^[a-f0-9]{64}$'),
  photo_count smallint NOT NULL CHECK (photo_count BETWEEN 1 AND 5),
  attempt uuid NOT NULL,
  expires_at timestamptz NOT NULL,
  admitted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  committed_at timestamptz,
  PRIMARY KEY (actor_id, request_id)
);
CREATE INDEX gallery_uploads_club ON club_private.gallery_uploads(club_id);
CREATE INDEX gallery_uploads_actor_committed ON club_private.gallery_uploads(actor_id, committed_at);

-- A full image can outlive its thumbnail only while an authorized case holds it.
CREATE TABLE club_private.gallery_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  image bytea NOT NULL CHECK (octet_length(image) BETWEEN 3 AND 500000),
  UNIQUE (club_id, id)
);
CREATE TABLE club_private.gallery_photos (
  id uuid PRIMARY KEY,
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  caption text NOT NULL CHECK (char_length(caption) <= 280),
  width integer NOT NULL CHECK (width BETWEEN 1 AND 1600),
  height integer NOT NULL CHECK (height BETWEEN 1 AND 1600),
  thumbnail bytea NOT NULL CHECK (octet_length(thumbnail) BETWEEN 3 AND 90000),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY (club_id, id) REFERENCES club_private.gallery_images(club_id, id) ON DELETE CASCADE
);
CREATE INDEX gallery_photos_page ON club_private.gallery_photos(club_id, created_at DESC, id DESC);
CREATE INDEX gallery_photos_author ON club_private.gallery_photos(author_id);
CREATE INDEX gallery_images_club ON club_private.gallery_images(club_id);
CREATE INDEX gallery_images_author ON club_private.gallery_images(author_id);

ALTER TABLE club_private.content_reports DROP CONSTRAINT content_reports_target_kind_check;
ALTER TABLE club_private.content_reports ADD CONSTRAINT content_reports_target_kind_check
  CHECK (target_kind IN ('post', 'comment', 'chat', 'photo'));
ALTER TABLE club_private.content_reports DROP CONSTRAINT content_reports_target_shape;
ALTER TABLE club_private.content_reports ADD CONSTRAINT content_reports_target_shape CHECK (
  (target_kind='chat' AND chat_message_id IS NOT NULL AND chat_message_id=target_id AND post_id IS NULL AND comment_id IS NULL) OR
  (target_kind='post' AND post_id IS NOT NULL AND post_id=target_id AND chat_message_id IS NULL AND comment_id IS NULL) OR
  (target_kind='comment' AND comment_id IS NOT NULL AND comment_id=target_id AND post_id IS NOT NULL AND chat_message_id IS NULL) OR
  (target_kind='photo' AND post_id IS NULL AND comment_id IS NULL AND chat_message_id IS NULL)
);
ALTER TABLE club_private.bike_me_reports DROP CONSTRAINT bike_me_reports_target_kind_check;
ALTER TABLE club_private.bike_me_reports ADD CONSTRAINT bike_me_reports_target_kind_check
  CHECK (target_kind IN ('post', 'comment', 'chat', 'photo'));

-- IDs are stored in separate queues. A club role never authorizes support evidence.
CREATE TABLE club_private.gallery_club_evidence (
  report_id uuid PRIMARY KEY REFERENCES club_private.content_reports(id) ON DELETE CASCADE,
  photo_id uuid NOT NULL REFERENCES club_private.gallery_images(id) ON DELETE CASCADE
);
CREATE TABLE club_private.gallery_support_evidence (
  report_id uuid PRIMARY KEY REFERENCES club_private.bike_me_reports(id) ON DELETE CASCADE,
  photo_id uuid NOT NULL REFERENCES club_private.gallery_images(id) ON DELETE CASCADE
);
CREATE INDEX gallery_club_evidence_photo ON club_private.gallery_club_evidence(photo_id);
CREATE INDEX gallery_support_evidence_photo ON club_private.gallery_support_evidence(photo_id);

ALTER TABLE club_private.gallery_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_private.gallery_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_private.gallery_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_private.gallery_club_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_private.gallery_support_evidence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON club_private.gallery_uploads, club_private.gallery_images, club_private.gallery_photos,
  club_private.gallery_club_evidence, club_private.gallery_support_evidence FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION club_private.gallery_collect_image() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE photo uuid := CASE WHEN TG_TABLE_NAME='gallery_photos' THEN to_jsonb(OLD)->>'id' ELSE to_jsonb(OLD)->>'photo_id' END;
BEGIN
  PERFORM 1 FROM club_private.gallery_images WHERE id=photo FOR UPDATE;
  DELETE FROM club_private.gallery_images i WHERE i.id=photo
    AND NOT EXISTS (SELECT 1 FROM club_private.gallery_photos p WHERE p.id=i.id)
    AND NOT EXISTS (SELECT 1 FROM club_private.gallery_club_evidence e WHERE e.photo_id=i.id)
    AND NOT EXISTS (SELECT 1 FROM club_private.gallery_support_evidence e WHERE e.photo_id=i.id);
  RETURN OLD;
END;
$$;

CREATE FUNCTION club_private.gallery_erase_author() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
  -- The existing account-erasure flow redacts report text. Erase the associated
  -- photo bytes as well, including when auth.users is deleted directly.
  DELETE FROM club_private.gallery_images WHERE id=NEW.id;
  RETURN NULL;
END;
$$;

CREATE TRIGGER gallery_collect_photo AFTER DELETE ON club_private.gallery_photos
  FOR EACH ROW EXECUTE FUNCTION club_private.gallery_collect_image();
CREATE TRIGGER gallery_collect_club_evidence AFTER DELETE ON club_private.gallery_club_evidence
  FOR EACH ROW EXECUTE FUNCTION club_private.gallery_collect_image();
CREATE TRIGGER gallery_collect_support_evidence AFTER DELETE ON club_private.gallery_support_evidence
  FOR EACH ROW EXECUTE FUNCTION club_private.gallery_collect_image();
CREATE TRIGGER gallery_author_erasure AFTER UPDATE OF author_id ON club_private.gallery_images
  FOR EACH ROW WHEN (OLD.author_id IS NOT NULL AND NEW.author_id IS NULL)
  EXECUTE FUNCTION club_private.gallery_erase_author();

CREATE FUNCTION club_private.gallery_lock_upload(p_actor uuid, p_club uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
  -- The actor lock also serializes the 24-hour quota across different clubs.
  PERFORM club_private.require_account_not_deleting(p_actor);
  PERFORM 1 FROM public.clubs WHERE id=p_club FOR UPDATE;
  IF NOT FOUND OR club_private.role_for(p_club,p_actor) IS NULL THEN
    RAISE EXCEPTION 'GALLERY_ACCESS' USING ERRCODE='42501';
  END IF;
END;
$$;

CREATE FUNCTION public.club_gallery_reserve(p_actor uuid, p_club uuid, p_request uuid, p_digest text, p_count integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE
  prior club_private.gallery_uploads;
  stamp timestamptz;
  attempt_id uuid := gen_random_uuid();
  used_bytes bigint;
BEGIN
  IF p_actor IS NULL OR p_club IS NULL OR p_request IS NULL
    OR p_digest IS NULL OR p_digest !~ '^[a-f0-9]{64}$' OR p_count IS NULL OR p_count NOT BETWEEN 1 AND 5 THEN
    RAISE EXCEPTION 'GALLERY_INPUT' USING ERRCODE='22023';
  END IF;
  PERFORM club_private.gallery_lock_upload(p_actor,p_club);
  stamp := clock_timestamp();
  SELECT * INTO prior FROM club_private.gallery_uploads WHERE actor_id=p_actor AND request_id=p_request;
  IF FOUND THEN
    IF prior.club_id<>p_club OR prior.digest<>p_digest OR prior.photo_count<>p_count THEN
      RAISE EXCEPTION 'GALLERY_CONFLICT' USING ERRCODE='PT409';
    END IF;
    IF prior.committed_at IS NOT NULL THEN RETURN jsonb_build_object('status','committed'); END IF;
    IF prior.expires_at>stamp THEN RAISE EXCEPTION 'GALLERY_BUSY' USING ERRCODE='PT409'; END IF;
  END IF;
  DELETE FROM club_private.gallery_uploads WHERE actor_id=p_actor AND committed_at IS NULL
    AND expires_at<stamp-interval '7 days' AND request_id<>p_request;
  IF NOT EXISTS (SELECT 1 FROM club_private.gallery_uploads WHERE actor_id=p_actor AND request_id=p_request)
    AND (SELECT count(*) FROM club_private.gallery_uploads WHERE actor_id=p_actor AND admitted_at>stamp-interval '24 hours' AND committed_at IS NULL)>=40 THEN
    RAISE EXCEPTION 'GALLERY_QUOTA' USING ERRCODE='PT429';
  END IF;
  IF (SELECT coalesce(sum(photo_count),0) FROM club_private.gallery_uploads WHERE actor_id=p_actor
    AND (committed_at>stamp-interval '24 hours' OR (committed_at IS NULL AND expires_at>stamp)))+p_count>20 THEN
    RAISE EXCEPTION 'GALLERY_QUOTA' USING ERRCODE='PT429';
  END IF;
  SELECT
    (SELECT coalesce(sum(octet_length(image)),0) FROM club_private.gallery_images WHERE club_id=p_club)
    + (SELECT coalesce(sum(octet_length(thumbnail)),0) FROM club_private.gallery_photos WHERE club_id=p_club)
    + (SELECT coalesce(sum(photo_count),0)*590000 FROM club_private.gallery_uploads
       WHERE club_id=p_club AND committed_at IS NULL AND expires_at>stamp)
  INTO used_bytes;
  IF used_bytes + p_count::bigint*590000 > 268435456 THEN
    RAISE EXCEPTION 'GALLERY_CAPACITY' USING ERRCODE='PT413';
  END IF;
  INSERT INTO club_private.gallery_uploads(actor_id,request_id,club_id,digest,photo_count,attempt,expires_at)
  VALUES(p_actor,p_request,p_club,p_digest,p_count,attempt_id,stamp+interval '90 seconds')
  ON CONFLICT(actor_id,request_id) DO UPDATE SET attempt=excluded.attempt,expires_at=excluded.expires_at;
  RETURN jsonb_build_object('status','reserved','attempt',attempt_id);
END;
$$;

CREATE FUNCTION public.club_gallery_commit(p_actor uuid, p_club uuid, p_request uuid, p_attempt uuid, p_photos jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE
  reservation club_private.gallery_uploads;
  photo jsonb;
  image_bytes bytea;
  thumbnail_bytes bytea;
  photo_id uuid;
BEGIN
  PERFORM club_private.gallery_lock_upload(p_actor,p_club);
  SELECT * INTO reservation FROM club_private.gallery_uploads WHERE actor_id=p_actor AND club_id=p_club AND request_id=p_request;
  IF NOT FOUND OR reservation.attempt IS DISTINCT FROM p_attempt THEN RAISE EXCEPTION 'GALLERY_CONFLICT' USING ERRCODE='PT409'; END IF;
  IF reservation.committed_at IS NOT NULL THEN RETURN; END IF;
  IF reservation.expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'GALLERY_CONFLICT' USING ERRCODE='PT409'; END IF;
  IF jsonb_typeof(p_photos) IS DISTINCT FROM 'array' OR jsonb_array_length(p_photos)<>reservation.photo_count THEN
    RAISE EXCEPTION 'GALLERY_INPUT' USING ERRCODE='22023';
  END IF;
  FOR photo IN SELECT value FROM jsonb_array_elements(p_photos) LOOP
    image_bytes := decode(photo->>'image','base64');
    thumbnail_bytes := decode(photo->>'thumbnail','base64');
    IF substring(image_bytes FOR 3) IS DISTINCT FROM decode('ffd8ff','hex')
      OR substring(thumbnail_bytes FOR 3) IS DISTINCT FROM decode('ffd8ff','hex') THEN
      RAISE EXCEPTION 'GALLERY_INPUT' USING ERRCODE='22023';
    END IF;
    INSERT INTO club_private.gallery_images(club_id,author_id,image) VALUES(p_club,p_actor,image_bytes) RETURNING id INTO photo_id;
    INSERT INTO club_private.gallery_photos(id,club_id,author_id,caption,width,height,thumbnail)
    VALUES(photo_id,p_club,p_actor,photo->>'caption',(photo->>'width')::int,(photo->>'height')::int,thumbnail_bytes);
  END LOOP;
  UPDATE club_private.gallery_uploads SET committed_at=clock_timestamp() WHERE actor_id=p_actor AND request_id=p_request;
END;
$$;

CREATE FUNCTION public.club_gallery_release(p_actor uuid, p_request uuid, p_attempt uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog AS $$
  UPDATE club_private.gallery_uploads SET expires_at=least(expires_at,clock_timestamp())
    WHERE actor_id=p_actor AND request_id=p_request AND attempt=p_attempt AND committed_at IS NULL;
$$;

CREATE FUNCTION public.club_gallery_page(p_club uuid, p_before_time timestamptz DEFAULT NULL, p_before_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE actor uuid := club_private.content_member(p_club);
BEGIN
  IF num_nonnulls(p_before_time,p_before_id) NOT IN (0,2) THEN RAISE EXCEPTION 'GALLERY_INPUT' USING ERRCODE='22023'; END IF;
  RETURN (
    SELECT jsonb_build_object('role',club_private.role_for(p_club,actor),'items',coalesce(jsonb_agg(jsonb_build_object('id',p.id,'createdAt',p.created_at,'caption',p.caption,
      'uploader',profile.display_name,'own',p.author_id=actor,'width',p.width,'height',p.height)
      ORDER BY p.created_at DESC,p.id DESC),'[]'::jsonb))
    FROM (SELECT id,created_at,caption,author_id,width,height FROM club_private.gallery_photos
      WHERE club_id=p_club AND club_private.block_visible(author_id)
        AND (p_before_id IS NULL OR (created_at,id)<(p_before_time,p_before_id))
      ORDER BY created_at DESC,id DESC LIMIT 25) p
    LEFT JOIN public.profiles profile ON profile.id=p.author_id
  );
END;
$$;

CREATE FUNCTION public.club_gallery_image(p_club uuid, p_photo uuid, p_thumbnail boolean)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE actor uuid := club_private.content_member(p_club); encoded text;
BEGIN
  SELECT replace(encode(CASE WHEN p_thumbnail THEN p.thumbnail ELSE i.image END,'base64'), E'\n','') INTO encoded
  FROM club_private.gallery_photos p JOIN club_private.gallery_images i ON i.id=p.id
  WHERE p.club_id=p_club AND p.id=p_photo AND club_private.block_visible(p.author_id);
  IF NOT FOUND THEN RAISE EXCEPTION 'GALLERY_UNAVAILABLE' USING ERRCODE='P0002'; END IF;
  RETURN encoded;
END;
$$;

CREATE FUNCTION public.club_gallery_remove(p_club uuid, p_photo uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE actor uuid := club_private.content_member(p_club,true); author uuid;
BEGIN
  SELECT author_id INTO author FROM club_private.gallery_photos WHERE club_id=p_club AND id=p_photo;
  IF NOT FOUND THEN RETURN; END IF;
  IF author<>actor AND club_private.role_for(p_club,actor) NOT IN ('owner','admin') THEN
    RAISE EXCEPTION 'GALLERY_ACCESS' USING ERRCODE='42501';
  END IF;
  IF author<>actor THEN PERFORM club_private.require_visible_target(actor,author,'GALLERY_UNAVAILABLE','P0002'); END IF;
  DELETE FROM club_private.gallery_photos WHERE id=p_photo;
  INSERT INTO club_private.content_actions(club_id,actor_id,target_kind,target_id,action)
  VALUES(p_club,actor,'photo',p_photo,CASE WHEN author=actor THEN 'author_delete' ELSE 'moderator_remove' END);
END;
$$;

CREATE FUNCTION public.club_gallery_report(p_club uuid, p_photo uuid, p_destination text, p_reason text, p_detail text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE actor uuid := club_private.content_member(p_club,true); photo club_private.gallery_photos; report uuid;
BEGIN
  IF p_destination IS NULL OR p_destination NOT IN ('club','bikeMe') OR p_reason IS NULL
    OR p_reason NOT IN ('spam','harassment','unsafe','other') OR char_length(coalesce(p_detail,''))>500 THEN
    RAISE EXCEPTION 'GALLERY_INPUT' USING ERRCODE='22023';
  END IF;
  IF p_destination='club' THEN
    IF EXISTS(SELECT 1 FROM club_private.content_reports WHERE club_id=p_club AND target_kind='photo' AND target_id=p_photo AND reporter_id=actor) THEN RETURN; END IF;
  ELSE
    IF EXISTS(SELECT 1 FROM club_private.bike_me_reports WHERE club_id=p_club AND target_kind='photo' AND target_id=p_photo AND reporter_id=actor) THEN RETURN; END IF;
  END IF;
  SELECT * INTO photo FROM club_private.gallery_photos WHERE club_id=p_club AND id=p_photo;
  IF NOT FOUND THEN RAISE EXCEPTION 'GALLERY_UNAVAILABLE' USING ERRCODE='P0002'; END IF;
  IF photo.author_id=actor THEN RAISE EXCEPTION 'GALLERY_ACCESS' USING ERRCODE='42501'; END IF;
  PERFORM club_private.require_visible_target(actor,photo.author_id,'GALLERY_UNAVAILABLE','P0002');
  IF p_destination='club' THEN
    INSERT INTO club_private.content_reports(club_id,reporter_id,target_kind,target_id,reason,detail,snapshot)
    VALUES(p_club,actor,'photo',p_photo,p_reason,btrim(coalesce(p_detail,'')),
      jsonb_build_object('kind','photo','id',p_photo,'club_id',p_club,'author_id',photo.author_id,
      'body',photo.caption,'created_at',photo.created_at,'version',1,
      'display_name',(SELECT display_name FROM public.profiles WHERE id=photo.author_id)))
    RETURNING id INTO report;
    INSERT INTO club_private.gallery_club_evidence VALUES(report,p_photo);
  ELSE
    INSERT INTO club_private.bike_me_reports(club_id,target_kind,target_id,author_id,reporter_id,body,reason,detail)
    VALUES(p_club,'photo',p_photo,photo.author_id,actor,photo.caption,p_reason,btrim(coalesce(p_detail,'')))
    RETURNING id INTO report;
    INSERT INTO club_private.gallery_support_evidence VALUES(report,p_photo);
  END IF;
END;
$$;

CREATE FUNCTION public.club_gallery_evidence(p_club uuid,p_report uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE actor uuid := club_private.content_member(p_club); encoded text;
BEGIN
  IF club_private.role_for(p_club,actor) NOT IN ('owner','admin') THEN RAISE EXCEPTION 'GALLERY_ACCESS' USING ERRCODE='42501'; END IF;
  SELECT replace(encode(i.image,'base64'), E'\n','') INTO encoded
    FROM club_private.content_reports r JOIN club_private.gallery_club_evidence e ON e.report_id=r.id
    JOIN club_private.gallery_images i ON i.id=e.photo_id
    WHERE r.id=p_report AND r.club_id=p_club AND r.target_kind='photo';
  IF NOT FOUND THEN RAISE EXCEPTION 'GALLERY_UNAVAILABLE' USING ERRCODE='P0002'; END IF;
  RETURN encoded;
END;
$$;

CREATE FUNCTION public.club_support_gallery_evidence(p_report uuid)
RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog AS $$
  SELECT replace(encode(i.image,'base64'), E'\n','') FROM club_private.gallery_support_evidence e
  JOIN club_private.gallery_images i ON i.id=e.photo_id WHERE e.report_id=p_report;
$$;

-- Keep the existing queue and cursor format. The legacy app contract keeps
-- its original set of target kinds; web moderation sees the same queue plus photos.
CREATE FUNCTION club_private.gallery_moderation_page(
  p_club uuid, p_closed boolean, p_before_time timestamptz, p_before_id uuid, p_limit integer, p_include_photos boolean
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
    SELECT coalesce(jsonb_agg(club_private.content_report_json(q.id) ORDER BY q.created_at DESC,q.id DESC),'[]')
    FROM (SELECT r.id,r.created_at FROM club_private.content_reports r
      WHERE r.club_id=p_club AND (r.status<>'pending')=p_closed
        AND (p_include_photos OR r.target_kind<>'photo')
        AND (p_before_id IS NULL OR (r.created_at,r.id)<(p_before_time,p_before_id))
      ORDER BY r.created_at DESC,r.id DESC LIMIT p_limit) q
  ));
END;
$$;

CREATE OR REPLACE FUNCTION public.club_content_reports_page(
  p_club uuid, p_closed boolean DEFAULT false, p_before_time timestamptz DEFAULT NULL,
  p_before_id uuid DEFAULT NULL, p_limit integer DEFAULT 20
) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog AS $$
  SELECT club_private.gallery_moderation_page(p_club,p_closed,p_before_time,p_before_id,p_limit,false);
$$;

CREATE FUNCTION public.club_gallery_moderation_page(
  p_club uuid, p_closed boolean DEFAULT false, p_before_time timestamptz DEFAULT NULL,
  p_before_id uuid DEFAULT NULL, p_limit integer DEFAULT 20
) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog AS $$
  SELECT club_private.gallery_moderation_page(p_club,p_closed,p_before_time,p_before_id,p_limit,true);
$$;

REVOKE ALL ON FUNCTION club_private.gallery_moderation_page(uuid,boolean,timestamptz,uuid,integer,boolean),
  public.club_gallery_moderation_page(uuid,boolean,timestamptz,uuid,integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.club_gallery_moderation_page(uuid,boolean,timestamptz,uuid,integer) TO authenticated;

-- The existing resolvers decide who may resolve a case and write the status.
-- Photo removal then follows the same transaction, without a support audit entry in the club.
CREATE FUNCTION club_private.gallery_resolve_remove() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
  DELETE FROM club_private.gallery_photos WHERE club_id=NEW.club_id AND id=NEW.target_id;
  RETURN NEW;
END;
$$;
CREATE TRIGGER gallery_club_resolve AFTER UPDATE OF status ON club_private.content_reports FOR EACH ROW
  WHEN (OLD.status='pending' AND NEW.status='removed' AND NEW.target_kind='photo') EXECUTE FUNCTION club_private.gallery_resolve_remove();
CREATE TRIGGER gallery_support_resolve AFTER UPDATE OF status ON club_private.bike_me_reports FOR EACH ROW
  WHEN (OLD.status='pending' AND NEW.status='removed' AND NEW.target_kind='photo') EXECUTE FUNCTION club_private.gallery_resolve_remove();

-- Preserve the installed support resolver verbatim except for the photo branch.
-- Fail if the contract configured in the target database has changed.
DO $migration$
DECLARE definition text := pg_get_functiondef('public.club_support_resolve(uuid,text,text,text)'::regprocedure);
BEGIN
  IF cardinality(string_to_array(definition,E'      WHEN ''chat'' THEN\n'))<>2
    OR position('CASE report.target_kind' IN definition)=0
    OR position('UPDATE club_private.bike_me_reports' IN definition)=0 THEN
    RAISE EXCEPTION 'GALLERY_SUPPORT_BASELINE_CHANGED';
  END IF;
  EXECUTE replace(definition,E'      WHEN ''chat'' THEN\n',E'      WHEN ''photo'' THEN NULL;\n      WHEN ''chat'' THEN\n');
END;
$migration$;

REVOKE ALL ON FUNCTION
  club_private.gallery_collect_image(),club_private.gallery_erase_author(),club_private.gallery_lock_upload(uuid,uuid),
  club_private.gallery_resolve_remove(),
  public.club_gallery_reserve(uuid,uuid,uuid,text,integer),public.club_gallery_commit(uuid,uuid,uuid,uuid,jsonb),
  public.club_gallery_release(uuid,uuid,uuid),public.club_gallery_page(uuid,timestamptz,uuid),
  public.club_gallery_image(uuid,uuid,boolean),public.club_gallery_remove(uuid,uuid),
  public.club_gallery_report(uuid,uuid,text,text,text),public.club_gallery_evidence(uuid,uuid),
  public.club_support_gallery_evidence(uuid)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.club_gallery_page(uuid,timestamptz,uuid),public.club_gallery_image(uuid,uuid,boolean),
  public.club_gallery_remove(uuid,uuid),public.club_gallery_report(uuid,uuid,text,text,text),
  public.club_gallery_evidence(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.club_gallery_reserve(uuid,uuid,uuid,text,integer),
  public.club_gallery_commit(uuid,uuid,uuid,uuid,jsonb),public.club_gallery_release(uuid,uuid,uuid),
  public.club_support_gallery_evidence(uuid) TO service_role;

NOTIFY pgrst,'reload schema';
COMMIT;
