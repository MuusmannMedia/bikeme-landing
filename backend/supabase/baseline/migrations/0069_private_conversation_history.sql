-- Personal conversation deletion; peer messages and report evidence remain intact.
BEGIN;
DO $baseline$ BEGIN
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid=to_regprocedure('dm_private.conversation_json(uuid,uuid)')) IS DISTINCT FROM 'caba76887c214a86cd3870473348199d' THEN RAISE EXCEPTION 'DM_HISTORY_BASELINE_CHANGED';END IF;
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid=to_regprocedure('dm_inbox(bigint,integer)')) IS DISTINCT FROM 'fc709f47c4f2bea4be8adea8bbd49a0d' THEN RAISE EXCEPTION 'DM_HISTORY_BASELINE_CHANGED';END IF;
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid=to_regprocedure('dm_page(uuid,bigint,bigint,integer)')) IS DISTINCT FROM 'c95c29c9a75229c92e3805e0fbac7dda' THEN RAISE EXCEPTION 'DM_HISTORY_BASELINE_CHANGED';END IF;
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid=to_regprocedure('dm_message(uuid,uuid)')) IS DISTINCT FROM '592e840194460834194ed1e31da654b6' THEN RAISE EXCEPTION 'DM_HISTORY_BASELINE_CHANGED';END IF;
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid=to_regprocedure('dm_send(uuid,uuid,text,uuid)')) IS DISTINCT FROM 'e9f2fc121f5cc9c7d76d357d7b9f1377' THEN RAISE EXCEPTION 'DM_HISTORY_BASELINE_CHANGED';END IF;
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid=to_regprocedure('dm_change(uuid,uuid,text,text,integer)')) IS DISTINCT FROM '734561de4dbcc1af130bf5ae1bc8207d' THEN RAISE EXCEPTION 'DM_HISTORY_BASELINE_CHANGED';END IF;
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid=to_regprocedure('dm_report(uuid,uuid,uuid,text,text)')) IS DISTINCT FROM '2983d9071a11e60bd05c8070d8383d5d' THEN RAISE EXCEPTION 'DM_HISTORY_BASELINE_CHANGED';END IF;
END $baseline$;
CREATE TABLE dm_private.history_features(id boolean PRIMARY KEY DEFAULT true CHECK(id),enabled boolean NOT NULL);
INSERT INTO dm_private.history_features VALUES(true,true);
CREATE TABLE dm_private.history_state(
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 conversation_id uuid NOT NULL REFERENCES dm_private.conversations(id) ON DELETE CASCADE,
 cutoff_seq bigint NOT NULL CHECK(cutoff_seq>=0), revision bigint NOT NULL, PRIMARY KEY(user_id,conversation_id)
);
-- Per-viewer, text-free catch-up events preserve the scalar cursor contract of old clients.
CREATE TABLE dm_private.history_removals(
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 conversation_id uuid NOT NULL REFERENCES dm_private.conversations(id) ON DELETE CASCADE,
 message_id uuid NOT NULL REFERENCES dm_private.messages(id) ON DELETE CASCADE,
 message_seq bigint NOT NULL, change_seq bigint NOT NULL UNIQUE, removed_at timestamptz NOT NULL,
 PRIMARY KEY(user_id,message_id)
);
CREATE INDEX dm_history_removal_cursor ON dm_private.history_removals(user_id,conversation_id,change_seq);
CREATE TABLE dm_private.history_deletions(
 request_id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 conversation_id uuid NOT NULL REFERENCES dm_private.conversations(id) ON DELETE CASCADE,result jsonb NOT NULL
);
ALTER TABLE dm_private.history_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE dm_private.history_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE dm_private.history_removals ENABLE ROW LEVEL SECURITY;
ALTER TABLE dm_private.history_deletions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON dm_private.history_features,dm_private.history_state,dm_private.history_removals,dm_private.history_deletions FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE public.private_message_signals ADD COLUMN history_revision bigint NOT NULL DEFAULT 0;

CREATE FUNCTION dm_private.history_cutoff(p_conversation uuid,p_user uuid) RETURNS bigint
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT coalesce((SELECT cutoff_seq FROM dm_private.history_state WHERE conversation_id=p_conversation AND user_id=p_user),0);
$$;
CREATE FUNCTION dm_private.inbox_hidden(p_conversation uuid,p_user uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT EXISTS(SELECT 1 FROM dm_private.history_state h WHERE h.conversation_id=p_conversation AND h.user_id=p_user
 AND NOT EXISTS(SELECT 1 FROM dm_private.messages m WHERE m.conversation_id=p_conversation AND m.seq>h.cutoff_seq));
$$;
CREATE FUNCTION dm_private.viewer_quote(p_conversation uuid,p_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT CASE WHEN m.seq>dm_private.history_cutoff(p_conversation,auth.uid()) THEN dm_private.quote(p_conversation,p_id)
 ELSE jsonb_build_object('id',p_id,'seq',0,'change_seq',coalesce((SELECT revision FROM dm_private.history_state WHERE conversation_id=p_conversation AND user_id=auth.uid()),0),
 'deleted',true,'history_unavailable',true,'author_id',NULL,'display_name',NULL,'body',NULL) END
 FROM dm_private.messages m JOIN dm_private.conversations c ON c.id=m.conversation_id
 WHERE m.id=p_id AND m.conversation_id=p_conversation AND auth.uid() IN(c.low_id,c.high_id);
$$;
CREATE FUNCTION dm_private.viewer_message(p_id uuid,p_deleted boolean DEFAULT false) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT dm_private.message_json(m.id,p_deleted)||jsonb_build_object('reply',CASE WHEN m.deleted_at IS NULL AND m.reply_to_id IS NOT NULL THEN dm_private.viewer_quote(m.conversation_id,m.reply_to_id) END)
 FROM dm_private.messages m JOIN dm_private.conversations c ON c.id=m.conversation_id
 WHERE m.id=p_id AND auth.uid() IN(c.low_id,c.high_id) AND m.seq>dm_private.history_cutoff(m.conversation_id,auth.uid()) AND (p_deleted OR m.deleted_at IS NULL);
$$;
CREATE FUNCTION dm_private.history_tombstone(p_user uuid,p_message uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('id',message_id,'conversation_id',conversation_id,'seq',message_seq,'change_seq',change_seq,
 'author_id',NULL,'display_name',NULL,'avatar_url',NULL,'body','','created_at',removed_at,'edited_at',NULL,'version',1,
 'deleted_at',removed_at,'reply_to_id',NULL,'reply',NULL)
 FROM dm_private.history_removals WHERE user_id=p_user AND message_id=p_message AND user_id=auth.uid();
$$;
CREATE FUNCTION public.dm_features() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN PERFORM dm_private.uid();RETURN jsonb_build_object('history_deletion',coalesce((SELECT enabled FROM dm_private.history_features WHERE id),false));END; $$;
CREATE FUNCTION public.dm_history_state() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE u uuid:=dm_private.uid();BEGIN
 RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object('conversation_id',h.conversation_id,'cutoff_seq',h.cutoff_seq,'revision',h.revision) ORDER BY h.conversation_id),'[]')
 FROM dm_private.history_state h JOIN dm_private.conversations c ON c.id=h.conversation_id WHERE h.user_id=u AND u IN(c.low_id,c.high_id));
END; $$;
CREATE FUNCTION public.dm_delete_conversation(p_conversation uuid,p_request uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE u uuid:=dm_private.uid();c dm_private.conversations:=dm_private.lock_conversation(p_conversation);
 prior dm_private.history_deletions; boundary bigint; rev bigint; answer jsonb; stamp timestamptz:=clock_timestamp();
BEGIN
 IF p_request IS NULL THEN RAISE EXCEPTION 'DM_INVALID' USING ERRCODE='22023';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('dm:history-delete:'||p_request::text,0));
 SELECT * INTO prior FROM dm_private.history_deletions WHERE request_id=p_request;
 IF FOUND THEN
  IF prior.user_id IS DISTINCT FROM u OR prior.conversation_id IS DISTINCT FROM p_conversation THEN RAISE EXCEPTION 'DM_CONFLICT' USING ERRCODE='PT409';END IF;
  RETURN prior.result;
 END IF;
 PERFORM 1 FROM dm_private.history_features WHERE id FOR SHARE;
 IF NOT coalesce((SELECT enabled FROM dm_private.history_features WHERE id),false) THEN RAISE EXCEPTION 'DM_HISTORY_DISABLED' USING ERRCODE='P0002';END IF;
 SELECT greatest(coalesce(max(seq),0),dm_private.history_cutoff(p_conversation,u)) INTO boundary FROM dm_private.messages WHERE conversation_id=p_conversation;
 INSERT INTO dm_private.history_removals(user_id,conversation_id,message_id,message_seq,change_seq,removed_at)
 SELECT u,p_conversation,id,seq,nextval('dm_private.changes'),stamp FROM dm_private.messages WHERE conversation_id=p_conversation AND seq<=boundary ORDER BY seq
 ON CONFLICT(user_id,message_id) DO UPDATE SET change_seq=EXCLUDED.change_seq,removed_at=EXCLUDED.removed_at;
 rev:=nextval('dm_private.changes');
 INSERT INTO dm_private.history_state(user_id,conversation_id,cutoff_seq,revision) VALUES(u,p_conversation,boundary,rev)
 ON CONFLICT(user_id,conversation_id) DO UPDATE SET cutoff_seq=greatest(history_state.cutoff_seq,EXCLUDED.cutoff_seq),revision=EXCLUDED.revision;
 INSERT INTO public.private_message_signals(user_id,history_revision) VALUES(u,rev)
 ON CONFLICT(user_id) DO UPDATE SET revision=private_message_signals.revision+1,history_revision=EXCLUDED.history_revision;
 answer:=jsonb_build_object('conversation_id',p_conversation,'request_id',p_request,'cutoff_seq',boundary,'revision',rev);
 INSERT INTO dm_private.history_deletions VALUES(p_request,u,p_conversation,answer);
 RETURN answer;
END; $$;

CREATE OR REPLACE FUNCTION dm_private.conversation_json(p_id uuid,p_user uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('id',c.id,'activity_seq',c.activity_seq,'created_at',c.created_at,
 'history_cutoff_seq',dm_private.history_cutoff(c.id,p_user),'history_revision',coalesce(h.revision,0),'inbox_hidden',dm_private.inbox_hidden(c.id,p_user),
 'peer',jsonb_build_object('id',p.id,'display_name',p.display_name,'avatar_url',p.avatar_url),
 'blocked_by_me',EXISTS(SELECT 1 FROM dm_private.blocks WHERE blocker=p_user AND blocked=p.id),'messaging_blocked',dm_private.is_blocked(c),
 'last_message',(SELECT dm_private.viewer_message(m.id) FROM dm_private.messages m WHERE m.conversation_id=c.id AND m.seq>dm_private.history_cutoff(c.id,p_user) AND m.deleted_at IS NULL ORDER BY m.seq DESC LIMIT 1))
 FROM dm_private.conversations c LEFT JOIN dm_private.history_state h ON h.conversation_id=c.id AND h.user_id=p_user
 LEFT JOIN public.profiles p ON p.id=CASE WHEN c.low_id=p_user THEN c.high_id ELSE c.low_id END
 WHERE c.id=p_id AND (c.low_id=p_user OR c.high_id=p_user) AND p_user=auth.uid();
$$;
CREATE OR REPLACE FUNCTION public.dm_inbox(p_before bigint DEFAULT NULL,p_limit integer DEFAULT 20) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE u uuid:=dm_private.uid();result jsonb;BEGIN
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION 'DM_INVALID' USING ERRCODE='22023';END IF;
 SELECT coalesce(jsonb_agg(dm_private.conversation_json(q.id,u) ORDER BY q.activity_seq DESC),'[]') INTO result FROM(
 SELECT id,activity_seq FROM dm_private.conversations WHERE (low_id=u OR high_id=u) AND NOT dm_private.inbox_hidden(id,u)
 AND (p_before IS NULL OR activity_seq<p_before) ORDER BY activity_seq DESC LIMIT p_limit)q;RETURN result;
END; $$;
CREATE OR REPLACE FUNCTION public.dm_page(p_conversation uuid,p_before bigint DEFAULT NULL,p_after_change bigint DEFAULT NULL,p_limit integer DEFAULT 20) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE u uuid:=dm_private.uid();c dm_private.conversations:=dm_private.lock_conversation(p_conversation);items jsonb;more boolean;cursor bigint;boundary bigint:=dm_private.history_cutoff(p_conversation,u);
BEGIN
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 20 OR (p_before IS NOT NULL AND p_after_change IS NOT NULL) OR p_before<1 OR p_after_change<0 THEN RAISE EXCEPTION 'DM_INVALID' USING ERRCODE='22023';END IF;
 IF p_after_change IS NOT NULL THEN
  WITH changes AS (
   SELECT m.id,m.change_seq,false AS erased FROM dm_private.messages m WHERE m.conversation_id=p_conversation AND m.seq>boundary AND m.change_seq>p_after_change
   UNION ALL SELECT message_id,change_seq,true FROM dm_private.history_removals WHERE user_id=u AND conversation_id=p_conversation AND change_seq>p_after_change
  ), page AS(SELECT * FROM changes ORDER BY change_seq LIMIT p_limit)
  SELECT coalesce(jsonb_agg(CASE WHEN erased THEN dm_private.history_tombstone(u,id) ELSE dm_private.viewer_message(id,true) END ORDER BY change_seq),'[]'),coalesce(max(change_seq),p_after_change) INTO items,cursor FROM page;
  SELECT EXISTS(SELECT 1 FROM dm_private.messages WHERE conversation_id=p_conversation AND seq>boundary AND change_seq>cursor)
   OR EXISTS(SELECT 1 FROM dm_private.history_removals WHERE user_id=u AND conversation_id=p_conversation AND change_seq>cursor) INTO more;
  IF NOT more THEN SELECT greatest(cursor,coalesce((SELECT revision FROM dm_private.history_state WHERE user_id=u AND conversation_id=p_conversation),0)) INTO cursor;END IF;
 ELSE
  SELECT coalesce(jsonb_agg(dm_private.viewer_message(q.id) ORDER BY q.seq DESC),'[]') INTO items FROM(
   SELECT id,seq FROM dm_private.messages WHERE conversation_id=p_conversation AND seq>boundary AND deleted_at IS NULL AND (p_before IS NULL OR seq<p_before) ORDER BY seq DESC LIMIT p_limit)q;
  SELECT EXISTS(SELECT 1 FROM dm_private.messages WHERE conversation_id=p_conversation AND seq>boundary AND deleted_at IS NULL AND seq<(SELECT min((v->>'seq')::bigint) FROM jsonb_array_elements(items)v)) INTO more;
  SELECT greatest(coalesce((SELECT max(change_seq) FROM dm_private.messages WHERE conversation_id=p_conversation AND seq>boundary),0),coalesce((SELECT revision FROM dm_private.history_state WHERE user_id=u AND conversation_id=p_conversation),0)) INTO cursor;
 END IF;
 RETURN jsonb_build_object('items',items,'cursor',cursor,'has_more',more,'conversation',dm_private.conversation_json(p_conversation,u));
END; $$;
CREATE OR REPLACE FUNCTION public.dm_message(p_conversation uuid,p_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE answer jsonb;BEGIN
 PERFORM dm_private.lock_conversation(p_conversation);
 IF NOT EXISTS(SELECT 1 FROM dm_private.messages WHERE id=p_id AND conversation_id=p_conversation AND seq>dm_private.history_cutoff(p_conversation,auth.uid())) THEN RAISE EXCEPTION 'DM_UNAVAILABLE' USING ERRCODE='P0002';END IF;
 answer:=dm_private.viewer_message(p_id,true);IF answer IS NULL THEN RAISE EXCEPTION 'DM_UNAVAILABLE' USING ERRCODE='P0002';END IF;RETURN answer;
END; $$;

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
  IF p_reply_to IS NOT NULL AND NOT EXISTS(SELECT 1 FROM dm_private.messages WHERE id=p_reply_to AND conversation_id=p_conversation AND deleted_at IS NULL AND seq>dm_private.history_cutoff(p_conversation,u)) THEN RAISE EXCEPTION 'DM_REPLY_UNAVAILABLE' USING ERRCODE='PT410'; END IF;
  INSERT INTO dm_private.messages(id,conversation_id,author_id,body,reply_to_id) VALUES(p_id,p_conversation,u,btrim(p_body),p_reply_to) ON CONFLICT(id) DO NOTHING;
  SELECT * INTO m FROM dm_private.messages WHERE id=p_id;
 END IF;
 IF m.conversation_id IS DISTINCT FROM p_conversation OR m.author_id IS DISTINCT FROM u THEN RAISE EXCEPTION 'DM_FORBIDDEN' USING ERRCODE='42501'; END IF;
 IF m.reply_to_id IS DISTINCT FROM p_reply_to THEN RAISE EXCEPTION 'DM_CONFLICT' USING ERRCODE='PT409'; END IF;
 IF m.deleted_at IS NOT NULL OR m.seq<=dm_private.history_cutoff(p_conversation,u) THEN RAISE EXCEPTION 'DM_UNAVAILABLE' USING ERRCODE='P0002'; END IF;
 RETURN dm_private.viewer_message(m.id);
END; $function$
;

CREATE OR REPLACE FUNCTION public.dm_change(p_conversation uuid, p_id uuid, p_action text, p_body text DEFAULT NULL::text, p_version integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE u uuid:=dm_private.uid(); c dm_private.conversations; peer uuid; m dm_private.messages; BEGIN
 -- Editing delivers new text, so it requires current sender eligibility too.
 -- Keep eligibility/conversation lock order identical to dm_send. Own deletion
 -- remains available after relation loss or blocking.
 IF p_action='edit' THEN
  SELECT * INTO c FROM dm_private.conversations WHERE id=p_conversation AND (low_id=u OR high_id=u);
  IF c.id IS NULL THEN RAISE EXCEPTION 'DM_FORBIDDEN' USING ERRCODE='42501'; END IF;
  peer:=CASE WHEN c.low_id=u THEN c.high_id ELSE c.low_id END;
  PERFORM dm_private.require_recipient(u,peer);
 END IF;
 c:=dm_private.lock_conversation(p_conversation);
 SELECT * INTO m FROM dm_private.messages WHERE id=p_id AND conversation_id=p_conversation;
 IF m.id IS NULL THEN RAISE EXCEPTION 'DM_UNAVAILABLE' USING ERRCODE='P0002'; END IF;
 IF m.author_id IS DISTINCT FROM u THEN RAISE EXCEPTION 'DM_FORBIDDEN' USING ERRCODE='42501'; END IF;
 IF p_action='delete' THEN
  IF m.deleted_at IS NULL THEN UPDATE dm_private.messages SET body='',deleted_at=clock_timestamp(),version=version+1 WHERE id=p_id; END IF;
 ELSIF p_action='edit' THEN
  IF m.seq<=dm_private.history_cutoff(p_conversation,u) THEN RAISE EXCEPTION 'DM_UNAVAILABLE' USING ERRCODE='P0002';END IF;
  IF dm_private.is_blocked(c) THEN RAISE EXCEPTION 'DM_BLOCKED' USING ERRCODE='PT423'; END IF;
  IF m.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'DM_UNAVAILABLE' USING ERRCODE='P0002'; END IF;
  IF p_body IS NULL OR p_body !~ '[^[:space:]]' OR char_length(btrim(p_body)) NOT BETWEEN 1 AND 1500 THEN RAISE EXCEPTION 'DM_INVALID' USING ERRCODE='22023'; END IF;
  IF m.version=p_version+1 AND m.body=btrim(p_body) THEN RETURN dm_private.viewer_message(m.id); END IF;
  IF m.version IS DISTINCT FROM p_version THEN RAISE EXCEPTION 'DM_CONFLICT' USING ERRCODE='PT409'; END IF;
  UPDATE dm_private.messages SET body=btrim(p_body),edited_at=clock_timestamp(),version=version+1 WHERE id=p_id;
 ELSE RAISE EXCEPTION 'DM_INVALID' USING ERRCODE='22023'; END IF;
 RETURN jsonb_build_object('id',p_id,'changed',true);
END; $function$
;

CREATE OR REPLACE FUNCTION public.dm_report(p_conversation uuid, p_id uuid, p_request uuid, p_reason text, p_detail text DEFAULT ''::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE u uuid:=dm_private.uid(); c dm_private.conversations:=dm_private.lock_conversation(p_conversation); m dm_private.messages; r dm_private.reports; BEGIN
 IF p_request IS NULL OR p_reason IS NULL OR p_reason NOT IN('spam','harassment','unsafe','other') OR p_detail IS NULL OR char_length(p_detail)>500 THEN RAISE EXCEPTION 'DM_INVALID' USING ERRCODE='22023'; END IF;
 SELECT * INTO r FROM dm_private.reports WHERE request_id=p_request;
 IF r.id IS NOT NULL THEN
  IF r.reporter_id IS DISTINCT FROM u OR r.conversation_id IS DISTINCT FROM p_conversation OR r.target_id IS DISTINCT FROM p_id THEN RAISE EXCEPTION 'DM_FORBIDDEN' USING ERRCODE='42501'; END IF;
  RETURN r.id;
 END IF;
 SELECT * INTO m FROM dm_private.messages WHERE id=p_id AND conversation_id=p_conversation AND deleted_at IS NULL AND seq>dm_private.history_cutoff(p_conversation,u);
 IF m.id IS NULL THEN RAISE EXCEPTION 'DM_UNAVAILABLE' USING ERRCODE='P0002'; END IF;
 IF m.author_id=u THEN RAISE EXCEPTION 'DM_FORBIDDEN' USING ERRCODE='42501'; END IF;
 INSERT INTO dm_private.reports(request_id,reporter_id,conversation_id,target_id,message_version,snapshot,reason,detail)
 VALUES(p_request,u,p_conversation,m.id,m.version,jsonb_build_object('message_id',m.id,'author_id',m.author_id,'body',m.body,'created_at',m.created_at,'version',m.version,'reply_to_id',m.reply_to_id),p_reason,btrim(p_detail))
 ON CONFLICT(reporter_id,target_id,message_version) DO NOTHING RETURNING * INTO r;
 IF r.id IS NULL THEN SELECT * INTO r FROM dm_private.reports WHERE reporter_id=u AND target_id=m.id AND message_version=m.version; END IF;
 RETURN r.id;
END; $function$
;

REVOKE ALL ON FUNCTION dm_private.history_cutoff(uuid,uuid),dm_private.inbox_hidden(uuid,uuid),dm_private.viewer_quote(uuid,uuid),dm_private.viewer_message(uuid,boolean),dm_private.history_tombstone(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.dm_features(),public.dm_history_state(),public.dm_delete_conversation(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.dm_features(),public.dm_history_state(),public.dm_delete_conversation(uuid,uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
