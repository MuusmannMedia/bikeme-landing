-- 0060: private recipients from existing riders; no message/data migration.
BEGIN;
-- New eligibility is restricted to an existing saved rider, an accepted connection,
-- or a current shared club. No public profile grants or message RLS changes.
CREATE FUNCTION dm_private.recipient_allowed(p_user uuid,p_peer uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT p_user IS NOT NULL AND p_peer IS NOT NULL AND p_user<>p_peer
 AND NOT EXISTS(SELECT 1 FROM dm_private.blocks WHERE (blocker=p_user AND blocked=p_peer) OR (blocker=p_peer AND blocked=p_user))
 AND (EXISTS(SELECT 1 FROM public.saved_riders WHERE user_id=p_user AND rider_id=p_peer)
 OR EXISTS(SELECT 1 FROM public.rider_connections WHERE status='accepted' AND ((requester_id=p_user AND receiver_id=p_peer) OR (requester_id=p_peer AND receiver_id=p_user)))
 OR EXISTS(SELECT 1 FROM public.club_members a JOIN public.club_members b ON b.club_id=a.club_id WHERE a.user_id=p_user AND b.user_id=p_peer));
$$;
REVOKE ALL ON FUNCTION dm_private.recipient_allowed(uuid,uuid) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.dm_recipients(p_after uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 30, p_query text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE u uuid:=dm_private.uid(); result jsonb; BEGIN
 IF p_limit NOT BETWEEN 1 AND 30 OR p_limit IS NULL OR p_query IS NULL OR char_length(p_query)>80 THEN RAISE EXCEPTION 'DM_INVALID' USING ERRCODE='22023'; END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.id),'[]') INTO result FROM(
  SELECT p.id,p.display_name,p.avatar_url FROM public.profiles p WHERE p.id<>u AND (p_after IS NULL OR p.id>p_after)
  AND dm_private.recipient_allowed(u,p.id)
  AND (p_query='' OR strpos(lower(coalesce(p.display_name,'')),lower(btrim(p_query)))>0) ORDER BY p.id LIMIT p_limit)q;
 RETURN result;
END; $function$;

CREATE OR REPLACE FUNCTION public.dm_start(p_peer uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE u uuid:=dm_private.uid(); lo uuid:=least(u,p_peer); hi uuid:=greatest(u,p_peer); cid uuid; shared uuid; BEGIN
 IF p_peer IS NULL OR p_peer=u THEN RAISE EXCEPTION 'DM_INVALID' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(lo::text||':'||hi::text,0));
 SELECT id INTO cid FROM dm_private.conversations WHERE low_id=lo AND high_id=hi;
 IF cid IS NULL THEN
  -- Lock existing eligibility rows so deletion/status changes serialize with creation.
  -- A stale REPEATABLE READ snapshot of a changed/deleted row must retry.
  PERFORM 1 FROM public.saved_riders WHERE user_id=u AND rider_id=p_peer FOR SHARE;
  PERFORM 1 FROM public.rider_connections WHERE status='accepted' AND
   ((requester_id=u AND receiver_id=p_peer) OR (requester_id=p_peer AND receiver_id=u)) FOR SHARE;
  SELECT a.club_id INTO shared FROM public.club_members a JOIN public.club_members b ON b.club_id=a.club_id
   WHERE a.user_id=u AND b.user_id=p_peer ORDER BY a.club_id LIMIT 1;
  IF shared IS NOT NULL THEN PERFORM club_private.lock_club(shared); END IF;
  IF NOT dm_private.recipient_allowed(u,p_peer) THEN RAISE EXCEPTION 'DM_RECIPIENT_REQUIRED' USING ERRCODE='42501'; END IF;
  INSERT INTO dm_private.conversations(low_id,high_id) VALUES(lo,hi) ON CONFLICT(low_id,high_id) DO NOTHING RETURNING id INTO cid;
  IF cid IS NULL THEN SELECT id INTO cid FROM dm_private.conversations WHERE low_id=lo AND high_id=hi; END IF;
  IF cid IS NULL THEN RAISE EXCEPTION 'DM_RETRY' USING ERRCODE='40001'; END IF;
 END IF;
 PERFORM dm_private.lock_conversation(cid);
 RETURN dm_private.conversation_json(cid,u);
END; $function$;

NOTIFY pgrst,'reload schema';
COMMIT;
