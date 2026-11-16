-- TEST bcskqapoagflshewvzzc only. Expected-version conflicts must not trigger PostgREST transaction retries.
-- Existing club locks and genuine PostgreSQL serialization failures are unchanged.
BEGIN;
CREATE OR REPLACE FUNCTION public.club_content_change(p_club uuid,p_kind text,p_id uuid,p_action text,
 p_body text DEFAULT NULL,p_version integer DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE u uuid:=club_private.content_member(p_club,true); item jsonb; author uuid; v integer; removed timestamptz;
 is_mod boolean:=club_private.role_for(p_club,u) IN ('owner','admin'); old_body text; pinned boolean; parent uuid;
BEGIN
 IF p_kind='post' THEN
  SELECT author_id,version,deleted_at,body,is_pinned,id INTO author,v,removed,old_body,pinned,parent FROM public.club_posts WHERE id=p_id AND club_id=p_club;
 ELSIF p_kind='comment' THEN
  SELECT c.author_id,c.version,c.deleted_at,c.body,c.post_id INTO author,v,removed,old_body,parent FROM public.club_comments c
  JOIN public.club_posts p ON p.id=c.post_id WHERE c.id=p_id AND c.club_id=p_club AND p.deleted_at IS NULL;
 ELSE RAISE EXCEPTION 'CLUB_CONTENT_INVALID' USING ERRCODE='22023'; END IF;
 IF v IS NULL THEN RAISE EXCEPTION 'CLUB_CONTENT_UNAVAILABLE' USING ERRCODE='P0002'; END IF;
 IF p_action='edit' THEN
  IF author IS DISTINCT FROM u THEN RAISE EXCEPTION 'CLUB_FORBIDDEN' USING ERRCODE='42501'; END IF;
  IF removed IS NOT NULL THEN RAISE EXCEPTION 'CLUB_CONTENT_UNAVAILABLE' USING ERRCODE='P0002'; END IF;
  IF p_body IS NULL OR p_body !~ '[^[:space:]]' OR char_length(btrim(p_body)) NOT BETWEEN 1 AND (CASE WHEN p_kind='post' THEN 4000 ELSE 1500 END) THEN RAISE EXCEPTION 'CLUB_CONTENT_INVALID' USING ERRCODE='22023'; END IF;
  IF v=p_version+1 AND old_body=btrim(p_body) THEN RETURN jsonb_build_object('id',p_id,'version',v); END IF;
  IF p_version IS DISTINCT FROM v THEN RAISE EXCEPTION 'CLUB_CONTENT_CONFLICT' USING ERRCODE='PT409'; END IF;
  IF p_kind='post' THEN UPDATE public.club_posts SET body=btrim(p_body),edited_at=clock_timestamp(),version=version+1 WHERE id=p_id;
  ELSE UPDATE public.club_comments SET body=btrim(p_body),edited_at=clock_timestamp(),version=version+1 WHERE id=p_id; END IF;
 ELSIF p_action IN ('pin','unpin') THEN
  IF NOT is_mod OR p_kind<>'post' THEN RAISE EXCEPTION 'CLUB_FORBIDDEN' USING ERRCODE='42501'; END IF;
  IF removed IS NOT NULL THEN RAISE EXCEPTION 'CLUB_CONTENT_UNAVAILABLE' USING ERRCODE='P0002'; END IF;
  IF pinned IS DISTINCT FROM (p_action='pin') THEN
   UPDATE public.club_posts SET is_pinned=(p_action='pin'),version=version+1 WHERE id=p_id;
   INSERT INTO club_private.content_actions(club_id,actor_id,target_kind,target_id,action) VALUES(p_club,u,p_kind,p_id,p_action);
  END IF;
 ELSIF p_action='delete' THEN
  IF author IS DISTINCT FROM u AND NOT is_mod THEN RAISE EXCEPTION 'CLUB_FORBIDDEN' USING ERRCODE='42501'; END IF;
  IF removed IS NULL THEN
   IF p_kind='post' THEN
    UPDATE public.club_posts SET body='',deleted_at=clock_timestamp(),deleted_by=u,is_pinned=false,version=version+1 WHERE id=p_id;
    UPDATE public.club_comments SET body='',deleted_at=clock_timestamp(),deleted_by=u,version=version+1 WHERE post_id=p_id AND deleted_at IS NULL;
   ELSE UPDATE public.club_comments SET body='',deleted_at=clock_timestamp(),deleted_by=u,version=version+1 WHERE id=p_id; END IF;
   INSERT INTO club_private.content_actions(club_id,actor_id,target_kind,target_id,action) VALUES(p_club,u,p_kind,p_id,CASE WHEN author=u THEN 'author_delete' ELSE 'moderator_remove' END);
  END IF;
  IF is_mod THEN UPDATE club_private.content_reports SET status='removed',resolved_at=clock_timestamp(),moderator_id=u
   WHERE club_id=p_club AND status='pending' AND (target_id=p_id OR (p_kind='post' AND post_id=p_id)); END IF;
 ELSE RAISE EXCEPTION 'CLUB_CONTENT_INVALID' USING ERRCODE='22023'; END IF;
 RETURN jsonb_build_object('id',p_id,'changed',true);
END; $$;
REVOKE ALL ON FUNCTION public.club_content_change(uuid,text,uuid,text,text,integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.club_content_change(uuid,text,uuid,text,text,integer) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
