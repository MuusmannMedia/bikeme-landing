-- Explicit thread deletion. Legacy chat delete remains a single-message operation.
BEGIN;
DO $baseline$ BEGIN
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid=to_regprocedure('club_private.change_content(uuid,text,uuid,text,text,integer,boolean)')) IS DISTINCT FROM '0d9802a25bb651d2210b4b09eee85f23' THEN RAISE EXCEPTION 'CLUB_THREAD_BASELINE_CHANGED'; END IF;
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid=to_regprocedure('club_private.chat_change(uuid,uuid,text,text,integer)')) IS DISTINCT FROM '5fbdc26010b7dfcc9c5ca687cb0451cb' THEN RAISE EXCEPTION 'CLUB_THREAD_BASELINE_CHANGED'; END IF;
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid=to_regprocedure('club_private.member_content_json(uuid,text,uuid)')) IS DISTINCT FROM '11b3cf1c210fb0665dccace32aa36d6b' THEN RAISE EXCEPTION 'CLUB_THREAD_BASELINE_CHANGED'; END IF;
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid=to_regprocedure('club_private.member_chat_json(uuid,uuid,boolean)')) IS DISTINCT FROM '9dca3ae134a74334e6ea4524a572eb25' THEN RAISE EXCEPTION 'CLUB_THREAD_BASELINE_CHANGED'; END IF;
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid=to_regprocedure('club_private.content_report_json(uuid)')) IS DISTINCT FROM 'a380e9626cf0138d3f1bfdda913fe22a' THEN RAISE EXCEPTION 'CLUB_THREAD_BASELINE_CHANGED'; END IF;
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid=to_regprocedure('public.club_support_resolve(uuid,text,text,text)')) IS DISTINCT FROM 'ae1984a9c88e639af152316d213ba4e5' THEN RAISE EXCEPTION 'CLUB_THREAD_BASELINE_CHANGED'; END IF;
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid=to_regprocedure('public.club_report_to_bike_me(uuid,text,uuid,text,text)')) IS DISTINCT FROM '144f524958bce51c389bbab75a7df531' THEN RAISE EXCEPTION 'CLUB_THREAD_BASELINE_CHANGED'; END IF;
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid=to_regprocedure('club_private.scrub_bike_me_report()')) IS DISTINCT FROM '13cad0e63ae6294d5e2221bc49b1151d' THEN RAISE EXCEPTION 'CLUB_THREAD_BASELINE_CHANGED'; END IF;
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid=to_regprocedure('club_private.erase_account_content()')) IS DISTINCT FROM 'b8f8194d505d2dba651c917b7580297d' THEN RAISE EXCEPTION 'CLUB_THREAD_BASELINE_CHANGED'; END IF;
 IF (SELECT count(*) FROM pg_trigger WHERE tgname='content_body_filter' AND tgenabled='O' AND tgrelid IN ('public.club_posts'::regclass,'public.club_comments'::regclass,'public.club_chat_messages'::regclass,'dm_private.messages'::regclass)) <> 4 THEN RAISE EXCEPTION 'CLUB_CONTENT_FILTER_REQUIRED'; END IF;
END $baseline$;

CREATE TABLE club_private.thread_features (id boolean PRIMARY KEY DEFAULT true CHECK(id), enabled boolean NOT NULL);
INSERT INTO club_private.thread_features VALUES(true,true);
CREATE TABLE club_private.thread_deletions (
 request_id uuid PRIMARY KEY, actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 club_id uuid NOT NULL, kind text NOT NULL CHECK(kind IN ('post','chat')),
 root_id uuid NOT NULL, source text NOT NULL CHECK(source IN ('member','club_report','support')),
 report_id uuid, payload jsonb NOT NULL, result jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE club_private.thread_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_private.thread_deletions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON club_private.thread_features,club_private.thread_deletions FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE club_private.content_reports ADD COLUMN evidence_context jsonb NOT NULL DEFAULT '[]', ADD COLUMN evidence_captured boolean NOT NULL DEFAULT false;
ALTER TABLE club_private.bike_me_reports ADD COLUMN evidence_context jsonb NOT NULL DEFAULT '[]', ADD COLUMN evidence_captured boolean NOT NULL DEFAULT false;

CREATE FUNCTION club_private.thread_root(p_club uuid,p_kind text,p_id uuid) RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE current_id uuid:=p_id; parent uuid; visited uuid[]:='{}';
BEGIN
 IF p_kind='post' THEN SELECT id INTO current_id FROM public.club_posts WHERE club_id=p_club AND id=p_id;
 ELSIF p_kind='comment' THEN SELECT post_id INTO current_id FROM public.club_comments WHERE club_id=p_club AND id=p_id;
 ELSIF p_kind='chat' THEN
  LOOP
   IF current_id=ANY(visited) OR cardinality(visited)>=10000 THEN RAISE EXCEPTION 'CLUB_THREAD_INVALID' USING ERRCODE='22023'; END IF;
   visited:=array_append(visited,current_id);
   SELECT reply_to_id INTO parent FROM public.club_chat_messages WHERE club_id=p_club AND id=current_id;
   IF NOT FOUND THEN current_id:=NULL; EXIT; END IF;
   EXIT WHEN parent IS NULL;
   current_id:=parent;
  END LOOP;
 ELSE RAISE EXCEPTION 'CLUB_CONTENT_INVALID' USING ERRCODE='22023'; END IF;
 IF current_id IS NULL THEN RAISE EXCEPTION 'CLUB_CONTENT_UNAVAILABLE' USING ERRCODE='P0002'; END IF;
 RETURN current_id;
END; $$;

CREATE FUNCTION club_private.thread_meta(p_club uuid,p_kind text,p_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE root uuid; author uuid; u uuid:=auth.uid(); own boolean; role text;
BEGIN
 IF NOT coalesce((SELECT enabled FROM club_private.thread_features WHERE id),false) THEN RETURN NULL; END IF;
 role:=club_private.role_for(p_club,u);
 IF role IS NULL THEN RETURN NULL; END IF;
 root:=club_private.thread_root(p_club,p_kind,p_id);
 IF p_kind='chat' THEN SELECT author_id INTO author FROM public.club_chat_messages WHERE club_id=p_club AND id=root;
 ELSE SELECT author_id INTO author FROM public.club_posts WHERE club_id=p_club AND id=root; END IF;
 own:=author IS NOT DISTINCT FROM u;
 IF NOT own AND NOT club_private.block_visible(author) THEN RETURN NULL; END IF;
 RETURN jsonb_build_object('root_id',root,'own',own,'can_delete',own OR role IN ('owner','admin'));
END; $$;

CREATE FUNCTION public.club_thread_features() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 PERFORM club_private.require_user();
 RETURN jsonb_build_object('thread_deletion',coalesce((SELECT enabled FROM club_private.thread_features WHERE id),false));
END; $$;

CREATE FUNCTION club_private.thread_evidence(p_club uuid,p_kind text,p_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE root uuid; answer jsonb; target public.club_chat_messages;
BEGIN
 root:=club_private.thread_root(p_club,p_kind,p_id);
 IF p_kind='chat' THEN
  SELECT * INTO target FROM public.club_chat_messages WHERE id=p_id AND club_id=p_club;
  SELECT coalesce(jsonb_agg(club_private.chat_json(q.id,true) ORDER BY q.seq),'[]') INTO answer
  FROM (SELECT DISTINCT m.id,m.seq FROM public.club_chat_messages m WHERE m.club_id=p_club AND m.id IN (
   SELECT id FROM (SELECT id FROM public.club_chat_messages WHERE club_id=p_club AND seq<=target.seq ORDER BY seq DESC LIMIT 3) b
   UNION SELECT id FROM (SELECT id FROM public.club_chat_messages WHERE club_id=p_club AND seq>target.seq ORDER BY seq LIMIT 2) a
   UNION SELECT target.reply_to_id UNION SELECT root)) q;
 ELSE
  answer:=jsonb_build_array(club_private.content_json('post',root));
 END IF;
 RETURN coalesce(answer,'[]');
EXCEPTION WHEN no_data_found THEN RETURN '[]';
END; $$;

CREATE FUNCTION club_private.capture_thread_report() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 NEW.evidence_context:=club_private.thread_evidence(NEW.club_id,NEW.target_kind,NEW.target_id);
 NEW.evidence_captured:=true;
 RETURN NEW;
END; $$;
CREATE TRIGGER thread_report_evidence BEFORE INSERT ON club_private.content_reports FOR EACH ROW EXECUTE FUNCTION club_private.capture_thread_report();
CREATE TRIGGER thread_support_evidence BEFORE INSERT ON club_private.bike_me_reports FOR EACH ROW EXECUTE FUNCTION club_private.capture_thread_report();

CREATE FUNCTION club_private.preserve_thread_evidence(p_club uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 UPDATE club_private.content_reports SET evidence_context=club_private.thread_evidence(club_id,target_kind,target_id),evidence_captured=true
 WHERE club_id=p_club AND NOT evidence_captured;
 UPDATE club_private.bike_me_reports SET evidence_context=club_private.thread_evidence(club_id,target_kind,target_id),evidence_captured=true
 WHERE club_id=p_club AND NOT evidence_captured;
END; $$;

CREATE FUNCTION club_private.thread_invalidate(p_club uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog AS $$
 INSERT INTO public.club_chat_signals(user_id,visibility_revision)
 SELECT user_id,1 FROM public.club_members WHERE club_id=p_club ORDER BY user_id
 ON CONFLICT(user_id) DO UPDATE SET revision=club_chat_signals.revision+1,visibility_revision=club_chat_signals.visibility_revision+1;
$$;

CREATE FUNCTION club_private.scrub_thread_evidence(p_items jsonb,p_actor uuid) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
 SELECT coalesce(jsonb_agg(CASE WHEN item->>'author_id'=p_actor::text THEN
  (item-ARRAY['author_id','display_name','avatar_url','reply','reply_to_id'])||'{"body":""}'::jsonb
 WHEN item#>>'{reply,author_id}'=p_actor::text THEN item-'reply' ELSE item END ORDER BY ord),'[]')
 FROM jsonb_array_elements(p_items) WITH ORDINALITY AS e(item,ord);
$$;

CREATE FUNCTION club_private.delete_thread(p_club uuid,p_kind text,p_root uuid,p_actor uuid,p_source text,p_report uuid,p_request uuid,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE prior club_private.thread_deletions; ids uuid[]; result jsonb; stamp timestamptz:=clock_timestamp(); author uuid;
BEGIN
 PERFORM 1 FROM club_private.thread_features WHERE id FOR SHARE;
 IF NOT coalesce((SELECT enabled FROM club_private.thread_features WHERE id),false) THEN RAISE EXCEPTION 'CLUB_THREAD_DISABLED' USING ERRCODE='P0002'; END IF;
 IF p_request IS NULL OR p_kind NOT IN ('post','chat') THEN RAISE EXCEPTION 'CLUB_CONTENT_INVALID' USING ERRCODE='22023'; END IF;
 -- Serialise request identity even when a malicious retry changes the club.
 PERFORM pg_advisory_xact_lock(hashtextextended('bikeme:thread-delete:'||p_request::text,0));
 SELECT * INTO prior FROM club_private.thread_deletions WHERE request_id=p_request;
 IF FOUND THEN
  IF prior.actor_id IS DISTINCT FROM p_actor OR prior.club_id IS DISTINCT FROM p_club OR prior.kind IS DISTINCT FROM p_kind OR prior.root_id IS DISTINCT FROM p_root OR prior.source IS DISTINCT FROM p_source OR prior.report_id IS DISTINCT FROM p_report OR prior.payload IS DISTINCT FROM jsonb_build_object('sha256',encode(sha256(convert_to(p_payload::text,'UTF8')),'hex')) THEN
   RAISE EXCEPTION 'CLUB_CONTENT_CONFLICT' USING ERRCODE='PT409'; END IF;
  RETURN prior.result;
 END IF;
 IF club_private.thread_root(p_club,p_kind,p_root) IS DISTINCT FROM p_root THEN RAISE EXCEPTION 'CLUB_CONTENT_INVALID' USING ERRCODE='22023'; END IF;
 IF p_kind='post' THEN SELECT author_id INTO author FROM public.club_posts WHERE club_id=p_club AND id=p_root;
 ELSE SELECT author_id INTO author FROM public.club_chat_messages WHERE club_id=p_club AND id=p_root; END IF;
 PERFORM club_private.preserve_thread_evidence(p_club);
 IF p_kind='post' THEN
  UPDATE public.club_posts SET body='',deleted_at=coalesce(deleted_at,stamp),deleted_by=coalesce(deleted_by,p_actor),is_pinned=false,version=version+1 WHERE club_id=p_club AND id=p_root AND deleted_at IS NULL;
  UPDATE public.club_comments SET body='',deleted_at=stamp,deleted_by=p_actor,version=version+1 WHERE club_id=p_club AND post_id=p_root AND deleted_at IS NULL;
 ELSE
  -- UNION deduplicates visited IDs; deleted intermediates remain in the graph.
  WITH RECURSIVE tree(id) AS (SELECT p_root UNION SELECT m.id FROM public.club_chat_messages m JOIN tree t ON m.reply_to_id=t.id WHERE m.club_id=p_club)
  SELECT array_agg(id) INTO ids FROM tree;
  UPDATE public.club_chat_messages SET body='',deleted_at=stamp,deleted_by=p_actor,version=version+1 WHERE club_id=p_club AND id=ANY(ids) AND deleted_at IS NULL;
 END IF;
 PERFORM club_private.thread_invalidate(p_club);
 INSERT INTO club_private.content_actions(club_id,actor_id,target_kind,target_id,action,report_id)
 VALUES(p_club,p_actor,p_kind,p_root,CASE WHEN p_source<>'member' THEN 'report_thread_remove' WHEN author IS NOT DISTINCT FROM p_actor THEN 'author_thread_delete' ELSE 'moderator_thread_remove' END,CASE WHEN p_source='club_report' THEN p_report END);
 result:=jsonb_build_object('id',p_root,'kind',p_kind,'request_id',p_request,'changed',true);
 INSERT INTO club_private.thread_deletions(request_id,actor_id,club_id,kind,root_id,source,report_id,payload,result)
 VALUES(p_request,p_actor,p_club,p_kind,p_root,p_source,p_report,jsonb_build_object('sha256',encode(sha256(convert_to(p_payload::text,'UTF8')),'hex')),result);
 RETURN result;
END; $$;

CREATE FUNCTION public.club_content_delete_thread(p_club uuid,p_kind text,p_root uuid,p_request uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE u uuid:=club_private.content_member(p_club,true); author uuid;
BEGIN
 IF p_kind='post' THEN SELECT author_id INTO author FROM public.club_posts WHERE club_id=p_club AND id=p_root;
 ELSIF p_kind='chat' THEN SELECT author_id INTO author FROM public.club_chat_messages WHERE club_id=p_club AND id=p_root;
 ELSE RAISE EXCEPTION 'CLUB_CONTENT_INVALID' USING ERRCODE='22023'; END IF;
 IF NOT FOUND THEN RAISE EXCEPTION 'CLUB_CONTENT_UNAVAILABLE' USING ERRCODE='P0002'; END IF;
 IF author IS DISTINCT FROM u THEN
  IF club_private.role_for(p_club,u) NOT IN ('owner','admin') THEN RAISE EXCEPTION 'CLUB_FORBIDDEN' USING ERRCODE='42501'; END IF;
  PERFORM club_private.require_visible_target(u,author,'CLUB_CONTENT_UNAVAILABLE','P0002');
 END IF;
 RETURN club_private.delete_thread(p_club,p_kind,p_root,u,'member',NULL,p_request,'{}');
END; $$;

CREATE FUNCTION public.club_content_resolve_thread(p_club uuid,p_report uuid,p_request uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE u uuid:=club_private.content_member(p_club,true); r club_private.content_reports; root uuid; kind text; answer jsonb;
BEGIN
 IF club_private.role_for(p_club,u) NOT IN ('owner','admin') THEN RAISE EXCEPTION 'CLUB_FORBIDDEN' USING ERRCODE='42501'; END IF;
 SELECT * INTO r FROM club_private.content_reports WHERE id=p_report AND club_id=p_club;
 IF NOT FOUND THEN RAISE EXCEPTION 'CLUB_CONTENT_UNAVAILABLE' USING ERRCODE='P0002'; END IF;
 root:=club_private.thread_root(p_club,r.target_kind,r.target_id);kind:=CASE WHEN r.target_kind='chat' THEN 'chat' ELSE 'post' END;
 IF r.status<>'pending' AND NOT EXISTS(SELECT 1 FROM club_private.thread_deletions WHERE request_id=p_request AND report_id=p_report AND source='club_report') THEN RAISE EXCEPTION 'CLUB_CONTENT_CONFLICT' USING ERRCODE='PT409'; END IF;
 answer:=club_private.delete_thread(p_club,kind,root,u,'club_report',p_report,p_request,'{}');
 UPDATE club_private.content_reports SET status='removed',resolved_at=coalesce(resolved_at,clock_timestamp()),moderator_id=u WHERE id=p_report AND status='pending';
 RETURN (answer-'id')||jsonb_build_object('id',p_report,'status','removed');
END; $$;

CREATE FUNCTION public.club_support_resolve_thread(p_report uuid,p_request uuid,p_operator text,p_note text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE r club_private.bike_me_reports; root uuid; kind text; answer jsonb; club_exists boolean;
BEGIN
 IF p_operator IS NULL OR char_length(btrim(p_operator)) NOT BETWEEN 1 AND 120 OR p_note IS NULL OR char_length(btrim(p_note)) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'CLUB_CONTENT_INVALID' USING ERRCODE='22023'; END IF;
 SELECT * INTO r FROM club_private.bike_me_reports WHERE id=p_report;
 IF NOT FOUND THEN RAISE EXCEPTION 'CLUB_CONTENT_UNAVAILABLE' USING ERRCODE='P0002'; END IF;
 -- The same write guard as member RPCs, without impersonating a member.
 UPDATE public.clubs SET updated_at=clock_timestamp() WHERE id=r.club_id;
 club_exists:=FOUND;
 PERFORM 1 FROM club_private.thread_features WHERE id FOR SHARE;
 IF NOT coalesce((SELECT enabled FROM club_private.thread_features WHERE id),false) THEN RAISE EXCEPTION 'CLUB_THREAD_DISABLED' USING ERRCODE='P0002'; END IF;
 IF NOT club_exists THEN RETURN public.club_support_resolve(p_report,'remove',p_operator,p_note); END IF;
 SELECT * INTO r FROM club_private.bike_me_reports WHERE id=p_report FOR UPDATE;
 IF r.status<>'pending' AND NOT EXISTS(SELECT 1 FROM club_private.thread_deletions WHERE request_id=p_request AND report_id=p_report AND source='support') THEN RAISE EXCEPTION 'CLUB_CONTENT_CONFLICT' USING ERRCODE='PT409'; END IF;
 root:=club_private.thread_root(r.club_id,r.target_kind,r.target_id);kind:=CASE WHEN r.target_kind='chat' THEN 'chat' ELSE 'post' END;
 answer:=club_private.delete_thread(r.club_id,kind,root,NULL,'support',p_report,p_request,jsonb_build_object('operator',btrim(p_operator),'note',btrim(p_note)));
 UPDATE club_private.bike_me_reports SET status='removed',resolved_at=coalesce(resolved_at,clock_timestamp()),operator_label=btrim(p_operator),resolution=btrim(p_note) WHERE id=p_report AND status='pending';
 RETURN answer||jsonb_build_object('status','removed');
END; $$;


CREATE OR REPLACE FUNCTION club_private.change_content(p_club uuid, p_kind text, p_id uuid, p_action text, p_body text, p_version integer, p_from_report boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE u uuid:=club_private.content_member(p_club,true); author uuid; v integer; removed timestamptz;
 is_mod boolean:=club_private.role_for(p_club,u) IN ('owner','admin'); old_body text; pinned boolean; parent uuid; parent_author uuid; target_author uuid;
BEGIN
 IF p_kind='chat' THEN
  IF p_action='delete' AND is_mod AND NOT p_from_report THEN
   SELECT author_id INTO author FROM public.club_chat_messages WHERE id=p_id AND club_id=p_club;
   PERFORM club_private.require_visible_target(u,author,'CLUB_CONTENT_UNAVAILABLE','P0002');
  END IF;
  RETURN club_private.chat_change(p_club,p_id,p_action,p_body,p_version);
 END IF;
 IF p_kind='post' THEN
  SELECT author_id,version,deleted_at,body,is_pinned,id INTO author,v,removed,old_body,pinned,parent FROM public.club_posts WHERE id=p_id AND club_id=p_club;
 ELSIF p_kind='comment' THEN
  SELECT c.author_id,c.version,c.deleted_at,c.body,c.post_id,p.author_id INTO author,v,removed,old_body,parent,parent_author FROM public.club_comments c
  JOIN public.club_posts p ON p.id=c.post_id WHERE c.id=p_id AND c.club_id=p_club AND p.deleted_at IS NULL;
 ELSE RAISE EXCEPTION 'CLUB_CONTENT_INVALID' USING ERRCODE='22023'; END IF;
 IF v IS NULL THEN RAISE EXCEPTION 'CLUB_CONTENT_UNAVAILABLE' USING ERRCODE='P0002'; END IF;
 IF p_action='edit' THEN
  IF author IS DISTINCT FROM u THEN RAISE EXCEPTION 'CLUB_FORBIDDEN' USING ERRCODE='42501'; END IF;
  IF p_kind='comment' THEN
   PERFORM club_private.require_visible_target(u,parent_author,'CLUB_CONTENT_UNAVAILABLE','P0002');
  END IF;
  IF removed IS NOT NULL THEN RAISE EXCEPTION 'CLUB_CONTENT_UNAVAILABLE' USING ERRCODE='P0002'; END IF;
  IF p_body IS NULL OR p_body !~ '[^[:space:]]' OR char_length(btrim(p_body)) NOT BETWEEN 1 AND (CASE WHEN p_kind='post' THEN 4000 ELSE 1500 END) THEN RAISE EXCEPTION 'CLUB_CONTENT_INVALID' USING ERRCODE='22023'; END IF;
  IF v=p_version+1 AND old_body=btrim(p_body) THEN RETURN jsonb_build_object('id',p_id,'version',v); END IF;
  IF p_version IS DISTINCT FROM v THEN RAISE EXCEPTION 'CLUB_CONTENT_CONFLICT' USING ERRCODE='PT409'; END IF;
  IF p_kind='post' THEN UPDATE public.club_posts SET body=btrim(p_body),edited_at=clock_timestamp(),version=version+1 WHERE id=p_id;
  ELSE UPDATE public.club_comments SET body=btrim(p_body),edited_at=clock_timestamp(),version=version+1 WHERE id=p_id; END IF;
 ELSIF p_action IN ('pin','unpin') THEN
  IF NOT is_mod OR p_kind<>'post' THEN RAISE EXCEPTION 'CLUB_FORBIDDEN' USING ERRCODE='42501'; END IF;
  PERFORM club_private.require_visible_target(u,author,'CLUB_CONTENT_UNAVAILABLE','P0002');
  IF removed IS NOT NULL THEN RAISE EXCEPTION 'CLUB_CONTENT_UNAVAILABLE' USING ERRCODE='P0002'; END IF;
  IF pinned IS DISTINCT FROM (p_action='pin') THEN
   UPDATE public.club_posts SET is_pinned=(p_action='pin'),version=version+1 WHERE id=p_id;
   INSERT INTO club_private.content_actions(club_id,actor_id,target_kind,target_id,action) VALUES(p_club,u,p_kind,p_id,p_action);
  END IF;
 ELSIF p_action='delete' THEN
  IF author IS DISTINCT FROM u THEN
   IF NOT is_mod THEN RAISE EXCEPTION 'CLUB_FORBIDDEN' USING ERRCODE='42501'; END IF;
   IF NOT p_from_report THEN
    -- A comment can be hidden by either its author or its parent post.
    FOR target_author IN SELECT DISTINCT peer FROM unnest(ARRAY[author,parent_author]) AS authors(peer)
                         WHERE peer IS NOT NULL ORDER BY peer LOOP
     PERFORM club_private.require_visible_target(u,target_author,'CLUB_CONTENT_UNAVAILABLE','P0002');
    END LOOP;
   END IF;
  END IF;
  IF removed IS NULL THEN
   PERFORM club_private.preserve_thread_evidence(p_club);
   IF p_kind='post' THEN
    UPDATE public.club_posts SET body='',deleted_at=clock_timestamp(),deleted_by=u,is_pinned=false,version=version+1 WHERE id=p_id;
    UPDATE public.club_comments SET body='',deleted_at=clock_timestamp(),deleted_by=u,version=version+1 WHERE post_id=p_id AND deleted_at IS NULL;
   ELSE UPDATE public.club_comments SET body='',deleted_at=clock_timestamp(),deleted_by=u,version=version+1 WHERE id=p_id; END IF;
   INSERT INTO club_private.content_actions(club_id,actor_id,target_kind,target_id,action) VALUES(p_club,u,p_kind,p_id,CASE WHEN author=u THEN 'author_delete' ELSE 'moderator_remove' END);
   PERFORM club_private.thread_invalidate(p_club);
  END IF;

 ELSE RAISE EXCEPTION 'CLUB_CONTENT_INVALID' USING ERRCODE='22023'; END IF;
 RETURN jsonb_build_object('id',p_id,'changed',true);
END; $function$;

CREATE OR REPLACE FUNCTION club_private.chat_change(p_club uuid, p_id uuid, p_action text, p_body text, p_version integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE u uuid:=club_private.content_member(p_club,true); m public.club_chat_messages; is_mod boolean:=club_private.role_for(p_club,u) IN('owner','admin');
BEGIN
 SELECT * INTO m FROM public.club_chat_messages WHERE id=p_id AND club_id=p_club;
 IF m.id IS NULL THEN RAISE EXCEPTION 'CLUB_CONTENT_UNAVAILABLE' USING ERRCODE='P0002'; END IF;
 IF p_action='edit' THEN
  IF m.author_id IS DISTINCT FROM u THEN RAISE EXCEPTION 'CLUB_FORBIDDEN' USING ERRCODE='42501'; END IF;
  IF m.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'CLUB_CONTENT_UNAVAILABLE' USING ERRCODE='P0002'; END IF;
  IF p_body IS NULL OR p_body !~ '[^[:space:]]' OR char_length(btrim(p_body)) NOT BETWEEN 1 AND 1500 THEN RAISE EXCEPTION 'CLUB_CONTENT_INVALID' USING ERRCODE='22023'; END IF;
  IF m.version=p_version+1 AND m.body=btrim(p_body) THEN RETURN jsonb_build_object('id',m.id,'version',m.version); END IF;
  IF m.version IS DISTINCT FROM p_version THEN RAISE EXCEPTION 'CLUB_CONTENT_CONFLICT' USING ERRCODE='PT409'; END IF;
  UPDATE public.club_chat_messages SET body=btrim(p_body),edited_at=clock_timestamp(),version=version+1,change_seq=nextval('club_private.chat_changes') WHERE id=p_id;
 ELSIF p_action='delete' THEN
  IF m.author_id IS DISTINCT FROM u AND NOT is_mod THEN RAISE EXCEPTION 'CLUB_FORBIDDEN' USING ERRCODE='42501'; END IF;
  IF m.deleted_at IS NULL THEN
   PERFORM club_private.preserve_thread_evidence(p_club);
   UPDATE public.club_chat_messages SET body='',deleted_at=clock_timestamp(),deleted_by=u,version=version+1,change_seq=nextval('club_private.chat_changes') WHERE id=p_id;
   INSERT INTO club_private.content_actions(club_id,actor_id,target_kind,target_id,action) VALUES(p_club,u,'chat',p_id,CASE WHEN m.author_id=u THEN 'author_delete' ELSE 'moderator_remove' END);
   PERFORM club_private.thread_invalidate(p_club);
  END IF;

 ELSE RAISE EXCEPTION 'CLUB_FORBIDDEN' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('id',p_id,'changed',true);
END; $function$;

CREATE OR REPLACE FUNCTION club_private.member_content_json(p_club uuid, p_kind text, p_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
 SELECT payload || jsonb_build_object('thread',club_private.thread_meta(p_club,p_kind,p_id)) FROM (
SELECT club_private.content_json('post', p.id) || jsonb_build_object('comment_count', (
    SELECT count(*) FROM public.club_comments c
    WHERE c.post_id = p.id AND c.deleted_at IS NULL AND club_private.block_visible(c.author_id)
  ))
  FROM public.club_posts p
  WHERE p_kind = 'post' AND p.club_id = p_club AND p.id = p_id AND p.deleted_at IS NULL
    AND club_private.block_visible(p.author_id)
  UNION ALL
  SELECT club_private.content_json('comment', c.id)
  FROM public.club_comments c JOIN public.club_posts p ON p.id = c.post_id
  WHERE p_kind = 'comment' AND c.club_id = p_club AND c.id = p_id AND c.deleted_at IS NULL AND p.deleted_at IS NULL
    AND club_private.block_visible(c.author_id) AND club_private.block_visible(p.author_id)
  UNION ALL
  SELECT club_private.member_chat_json(p_club, p_id) WHERE p_kind = 'chat'
 ) AS original(payload);
$function$;

CREATE OR REPLACE FUNCTION club_private.member_chat_json(p_club uuid, p_id uuid, p_deleted boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
 SELECT payload || jsonb_build_object('thread',club_private.thread_meta(p_club,'chat',p_id)) FROM (
SELECT CASE WHEN m.deleted_at IS NULL AND NOT club_private.chat_reference_visible(m.club_id, m.reply_to_id)
    THEN (club_private.chat_json(m.id, p_deleted) - 'reply_to_id' - 'reply') || '{"reply_unavailable":true}'::jsonb
    ELSE club_private.chat_json(m.id, p_deleted)
  END
  FROM public.club_chat_messages m
  WHERE m.club_id = p_club AND m.id = p_id AND club_private.block_visible(m.author_id)
 ) AS original(payload);
$function$;

CREATE OR REPLACE FUNCTION club_private.content_report_json(p_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
 SELECT payload || jsonb_build_object('context',CASE WHEN (SELECT evidence_captured FROM club_private.content_reports WHERE id=p_id) THEN (SELECT evidence_context FROM club_private.content_reports WHERE id=p_id) ELSE payload->'context' END,'content_removed',payload->'content'='null'::jsonb) FROM (
SELECT jsonb_build_object('id',id,'club_id',club_id,'post_id',post_id,'target_kind',target_kind,'target_id',target_id,
 'reason',reason,'detail',detail,'status',status,'created_at',created_at,'resolved_at',resolved_at,
 'context',CASE WHEN target_kind='chat' THEN (SELECT coalesce(jsonb_agg(club_private.chat_json(q.id) ORDER BY q.seq),'[]') FROM ((SELECT m.id,m.seq FROM public.club_chat_messages m WHERE m.club_id=content_reports.club_id AND m.deleted_at IS NULL AND m.seq<=(SELECT seq FROM public.club_chat_messages WHERE id=content_reports.target_id) ORDER BY m.seq DESC LIMIT 3) UNION ALL (SELECT m.id,m.seq FROM public.club_chat_messages m WHERE m.club_id=content_reports.club_id AND m.deleted_at IS NULL AND m.seq>(SELECT seq FROM public.club_chat_messages WHERE id=content_reports.target_id) ORDER BY m.seq LIMIT 2))q) ELSE '[]'::jsonb END,'snapshot',snapshot,'content',club_private.content_json(target_kind,target_id)) FROM club_private.content_reports WHERE id=p_id
 ) AS original(payload);
$function$;

CREATE OR REPLACE FUNCTION public.club_support_resolve(p_report uuid, p_action text, p_operator text, p_note text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  report club_private.bike_me_reports;
  stamp timestamptz := clock_timestamp();
BEGIN
  IF p_action IS NULL OR p_action NOT IN ('dismiss', 'remove')
    OR p_operator IS NULL OR char_length(btrim(p_operator)) NOT BETWEEN 1 AND 120
    OR p_note IS NULL OR char_length(btrim(p_note)) NOT BETWEEN 1 AND 1000 THEN
    RAISE EXCEPTION 'CLUB_CONTENT_INVALID' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO report FROM club_private.bike_me_reports WHERE id = p_report;
  IF NOT FOUND THEN RAISE EXCEPTION 'CLUB_CONTENT_UNAVAILABLE' USING ERRCODE = 'P0002'; END IF;

  -- Lock the club first, as report submission does. A dissolved club's case can still be resolved.
  UPDATE public.clubs SET updated_at=clock_timestamp() WHERE id=report.club_id;
  SELECT * INTO report FROM club_private.bike_me_reports WHERE id = p_report FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CLUB_CONTENT_UNAVAILABLE' USING ERRCODE = 'P0002'; END IF;
  IF report.status <> 'pending' THEN
    RETURN jsonb_build_object('id', report.id, 'status', report.status, 'already_handled', true);
  END IF;

  IF p_action = 'remove' THEN
    PERFORM club_private.preserve_thread_evidence(report.club_id);
    -- Same removal semantics as club moderation. Do not create a club report or club audit entry.
    CASE report.target_kind
      WHEN 'post' THEN
        UPDATE public.club_posts SET body = '', deleted_at = stamp, is_pinned = false, version = version + 1
        WHERE id = report.target_id AND club_id = report.club_id AND deleted_at IS NULL;
        UPDATE public.club_comments SET body = '', deleted_at = stamp, version = version + 1
        WHERE post_id = report.target_id AND club_id = report.club_id AND deleted_at IS NULL;
      WHEN 'comment' THEN
        UPDATE public.club_comments SET body = '', deleted_at = stamp, version = version + 1
        WHERE id = report.target_id AND club_id = report.club_id AND deleted_at IS NULL;
      WHEN 'chat' THEN
        UPDATE public.club_chat_messages SET body = '', deleted_at = stamp, version = version + 1
        WHERE id = report.target_id AND club_id = report.club_id AND deleted_at IS NULL;
    END CASE;
  END IF;

  IF p_action='remove' THEN PERFORM club_private.thread_invalidate(report.club_id); END IF;
  UPDATE club_private.bike_me_reports
  SET status = CASE WHEN p_action = 'remove' THEN 'removed' ELSE 'dismissed' END,
      resolved_at = stamp, operator_label = btrim(p_operator), resolution = btrim(p_note)
  WHERE id = p_report
  RETURNING * INTO report;
  RETURN jsonb_build_object('id', report.id, 'status', report.status, 'already_handled', false);
END;
$function$;

CREATE OR REPLACE FUNCTION public.club_report_to_bike_me(p_club uuid, p_kind text, p_id uuid, p_reason text, p_detail text DEFAULT ''::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  reporter uuid;
  item jsonb;
  report_id uuid;
BEGIN
  IF p_club IS NULL OR p_id IS NULL OR p_kind IS NULL OR p_kind NOT IN ('post', 'comment', 'chat')
    OR p_reason IS NULL OR p_reason NOT IN ('spam', 'harassment', 'unsafe', 'other')
    OR char_length(coalesce(p_detail, '')) > 500 THEN
    RAISE EXCEPTION 'CLUB_CONTENT_INVALID' USING ERRCODE = '22023';
  END IF;

  -- Serialize with membership and content writes without touching the public club row.
  UPDATE public.clubs SET updated_at=clock_timestamp() WHERE id=p_club;
  reporter := club_private.content_member(p_club);
  SELECT id INTO report_id FROM club_private.bike_me_reports
  WHERE club_id = p_club AND target_kind = p_kind AND target_id = p_id AND reporter_id = reporter;
  IF FOUND THEN RETURN report_id; END IF;

  item := club_private.content_json(p_kind, p_id);
  IF item IS NULL OR item->>'club_id' IS DISTINCT FROM p_club::text
    OR item->>'author_id' IS NULL OR item->>'body' = '' THEN
    RAISE EXCEPTION 'CLUB_CONTENT_UNAVAILABLE' USING ERRCODE = 'P0002';
  END IF;
  IF item->>'author_id' = reporter::text THEN
    RAISE EXCEPTION 'CLUB_FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  INSERT INTO club_private.bike_me_reports (club_id, target_kind, target_id, author_id, reporter_id, body, reason, detail)
  VALUES (p_club, p_kind, p_id, (item->>'author_id')::uuid, reporter, item->>'body', p_reason, btrim(coalesce(p_detail, '')))
  RETURNING id INTO report_id;
  RETURN report_id;
END;
$function$;

CREATE OR REPLACE FUNCTION club_private.scrub_bike_me_report()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
BEGIN
  NEW.body := '';
  NEW.detail := '';
  NEW.resolution := NULL;
  NEW.evidence_context := '[]';
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION club_private.erase_account_content()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
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
    UNION SELECT club_id FROM club_private.content_reports WHERE evidence_context::text LIKE '%'||actor::text||'%'
    UNION SELECT club_id FROM club_private.bike_me_reports WHERE evidence_context::text LIKE '%'||actor::text||'%'
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
  UPDATE club_private.content_reports SET evidence_context=club_private.scrub_thread_evidence(evidence_context,actor) WHERE evidence_context::text LIKE '%'||actor::text||'%';
  UPDATE club_private.bike_me_reports SET evidence_context=club_private.scrub_thread_evidence(evidence_context,actor) WHERE evidence_context::text LIKE '%'||actor::text||'%';
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
$function$;


REVOKE ALL ON FUNCTION club_private.thread_root(uuid,text,uuid),club_private.thread_meta(uuid,text,uuid),
 club_private.thread_evidence(uuid,text,uuid),club_private.capture_thread_report(),club_private.preserve_thread_evidence(uuid),
 club_private.thread_invalidate(uuid),club_private.scrub_thread_evidence(jsonb,uuid),
 club_private.delete_thread(uuid,text,uuid,uuid,text,uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.club_thread_features(),public.club_content_delete_thread(uuid,text,uuid,uuid),
 public.club_content_resolve_thread(uuid,uuid,uuid),public.club_support_resolve_thread(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.club_thread_features(),public.club_content_delete_thread(uuid,text,uuid,uuid),public.club_content_resolve_thread(uuid,uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.club_support_resolve_thread(uuid,uuid,text,text) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
