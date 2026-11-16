-- 0062: own saved rider OR current shared club; blocks always win.
-- No history, participant, profile grants or client changes.
BEGIN;
CREATE OR REPLACE FUNCTION dm_private.recipient_allowed(p_user uuid,p_peer uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT p_user IS NOT NULL AND p_peer IS NOT NULL AND p_user<>p_peer
 AND NOT EXISTS(SELECT 1 FROM dm_private.blocks WHERE (blocker=p_user AND blocked=p_peer) OR (blocker=p_peer AND blocked=p_user))
 AND (EXISTS(SELECT 1 FROM public.saved_riders WHERE user_id=p_user AND rider_id=p_peer)
 OR EXISTS(SELECT 1 FROM public.club_members a JOIN public.club_members b ON b.club_id=a.club_id WHERE a.user_id=p_user AND b.user_id=p_peer));
$$;
-- Lock the exact eligibility rows, not profiles or unrelated users. Revocation
-- serializes with sends; stale repeatable-read row versions must retry.
CREATE FUNCTION dm_private.require_recipient(p_user uuid,p_peer uuid) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE shared uuid; BEGIN
 PERFORM 1 FROM public.saved_riders WHERE user_id=p_user AND rider_id=p_peer FOR SHARE;
 IF NOT FOUND THEN
  SELECT a.club_id INTO shared FROM public.club_members a JOIN public.club_members b ON b.club_id=a.club_id
   WHERE a.user_id=p_user AND b.user_id=p_peer ORDER BY a.club_id LIMIT 1;
  IF shared IS NOT NULL THEN
   PERFORM 1 FROM public.club_members WHERE club_id=shared AND user_id IN(p_user,p_peer) ORDER BY user_id FOR SHARE;
  END IF;
 END IF;
 IF EXISTS(SELECT 1 FROM dm_private.blocks WHERE (blocker=p_user AND blocked=p_peer) OR (blocker=p_peer AND blocked=p_user)) THEN
  RAISE EXCEPTION 'DM_BLOCKED' USING ERRCODE='PT423';
 END IF;
 IF NOT dm_private.recipient_allowed(p_user,p_peer) THEN RAISE EXCEPTION 'DM_RECIPIENT_REQUIRED' USING ERRCODE='42501'; END IF;
END; $$;
REVOKE ALL ON FUNCTION dm_private.require_recipient(uuid,uuid) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.dm_start(p_peer uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE u uuid:=dm_private.uid(); lo uuid:=least(u,p_peer); hi uuid:=greatest(u,p_peer); cid uuid; shared uuid; BEGIN
 IF p_peer IS NULL OR p_peer=u THEN RAISE EXCEPTION 'DM_INVALID' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(lo::text||':'||hi::text,0));
 PERFORM dm_private.require_recipient(u,p_peer);
 SELECT id INTO cid FROM dm_private.conversations WHERE low_id=lo AND high_id=hi;
 IF cid IS NULL THEN
  INSERT INTO dm_private.conversations(low_id,high_id) VALUES(lo,hi) ON CONFLICT(low_id,high_id) DO NOTHING RETURNING id INTO cid;
  IF cid IS NULL THEN PERFORM dm_private.require_recipient(u,p_peer);
 SELECT id INTO cid FROM dm_private.conversations WHERE low_id=lo AND high_id=hi; END IF;
  IF cid IS NULL THEN RAISE EXCEPTION 'DM_RETRY' USING ERRCODE='40001'; END IF;
 END IF;
 PERFORM dm_private.lock_conversation(cid);
 IF NOT dm_private.recipient_allowed(u,p_peer) THEN RAISE EXCEPTION 'DM_RECIPIENT_REQUIRED' USING ERRCODE='42501'; END IF;
 RETURN dm_private.conversation_json(cid,u);
END; $function$
;
CREATE OR REPLACE FUNCTION public.dm_send(p_conversation uuid, p_id uuid, p_body text, p_reply_to uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE u uuid:=dm_private.uid(); c dm_private.conversations; peer uuid; m dm_private.messages; BEGIN
 SELECT * INTO c FROM dm_private.conversations WHERE id=p_conversation AND (low_id=u OR high_id=u);
 IF c.id IS NULL THEN RAISE EXCEPTION 'DM_FORBIDDEN' USING ERRCODE='42501'; END IF;
 peer:=CASE WHEN c.low_id=u THEN c.high_id ELSE c.low_id END;
 PERFORM dm_private.require_recipient(u,peer);
 c:=dm_private.lock_conversation(p_conversation);
 IF dm_private.is_blocked(c) THEN RAISE EXCEPTION 'DM_BLOCKED' USING ERRCODE='PT423'; END IF;
 IF p_id IS NULL OR p_id=p_reply_to OR p_body IS NULL OR p_body !~ '[^[:space:]]' OR char_length(btrim(p_body)) NOT BETWEEN 1 AND 1500 THEN RAISE EXCEPTION 'DM_INVALID' USING ERRCODE='22023'; END IF;
 SELECT * INTO m FROM dm_private.messages WHERE id=p_id;
 IF m.id IS NULL THEN
  IF dm_private.is_blocked(c) THEN RAISE EXCEPTION 'DM_BLOCKED' USING ERRCODE='PT423'; END IF;
  IF p_reply_to IS NOT NULL AND NOT EXISTS(SELECT 1 FROM dm_private.messages WHERE id=p_reply_to AND conversation_id=p_conversation AND deleted_at IS NULL) THEN RAISE EXCEPTION 'DM_REPLY_UNAVAILABLE' USING ERRCODE='PT410'; END IF;
  INSERT INTO dm_private.messages(id,conversation_id,author_id,body,reply_to_id) VALUES(p_id,p_conversation,u,btrim(p_body),p_reply_to) ON CONFLICT(id) DO NOTHING;
  SELECT * INTO m FROM dm_private.messages WHERE id=p_id;
 END IF;
 IF m.conversation_id IS DISTINCT FROM p_conversation OR m.author_id IS DISTINCT FROM u THEN RAISE EXCEPTION 'DM_FORBIDDEN' USING ERRCODE='42501'; END IF;
 IF m.reply_to_id IS DISTINCT FROM p_reply_to THEN RAISE EXCEPTION 'DM_CONFLICT' USING ERRCODE='PT409'; END IF;
 IF m.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'DM_UNAVAILABLE' USING ERRCODE='P0002'; END IF;
 RETURN dm_private.message_json(m.id);
END; $function$
;
NOTIFY pgrst,'reload schema';
COMMIT;
