-- Existing isolated TEST backend bcskqapoagflshewvzzc. One shared chat per club.
-- Realtime publishes only a per-user invalidation, NEVER message text or club IDs.
-- All content is fetched through current-member RPCs. No push is generated.
BEGIN;
CREATE SEQUENCE club_private.chat_changes;
CREATE TABLE public.club_chat_messages (
 id uuid PRIMARY KEY, club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
 seq bigint GENERATED ALWAYS AS IDENTITY UNIQUE, change_seq bigint NOT NULL DEFAULT nextval('club_private.chat_changes'),
 author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL, body text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), edited_at timestamptz, version integer NOT NULL DEFAULT 1 CHECK(version>0),
 deleted_at timestamptz, deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 CHECK((deleted_at IS NULL AND char_length(btrim(body)) BETWEEN 1 AND 1500 AND body ~ '[^[:space:]]') OR (deleted_at IS NOT NULL AND body=''))
);
CREATE INDEX club_chat_page_idx ON public.club_chat_messages(club_id,seq DESC);
CREATE INDEX club_chat_changes_idx ON public.club_chat_messages(club_id,change_seq);
CREATE TABLE public.club_chat_signals (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 revision bigint NOT NULL DEFAULT 1
);
ALTER TABLE public.club_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_chat_signals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.club_chat_messages,public.club_chat_signals FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.club_chat_messages,public.club_chat_signals TO authenticated;
CREATE POLICY chat_member_read ON public.club_chat_messages FOR SELECT TO authenticated USING(club_private.my_role(club_id) IS NOT NULL);
CREATE POLICY chat_signal_own_read ON public.club_chat_signals FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE FUNCTION club_private.chat_signal(p_user uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog AS $$
 INSERT INTO public.club_chat_signals(user_id) SELECT id FROM auth.users WHERE id=p_user
 ON CONFLICT(user_id) DO UPDATE SET revision=public.club_chat_signals.revision+1;
$$;
CREATE FUNCTION club_private.chat_invalidate() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE u uuid;
BEGIN
 IF TG_TABLE_NAME='club_members' THEN
  IF TG_OP='DELETE' THEN PERFORM club_private.chat_signal(OLD.user_id);
  ELSE PERFORM club_private.chat_signal(NEW.user_id); END IF;
 ELSE
  -- Deterministic user order prevents cross-club fan-out deadlocks.
  FOR u IN SELECT user_id FROM public.club_members WHERE club_id=NEW.club_id ORDER BY user_id LOOP
   PERFORM club_private.chat_signal(u);
  END LOOP;
 END IF;
 RETURN NULL;
END; $$;
CREATE TRIGGER chat_membership_signal AFTER INSERT OR UPDATE OR DELETE ON public.club_members FOR EACH ROW EXECUTE FUNCTION club_private.chat_invalidate();
CREATE FUNCTION club_private.chat_touch() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN NEW.change_seq:=nextval('club_private.chat_changes'); RETURN NEW; END; $$;
CREATE TRIGGER chat_message_touch BEFORE UPDATE ON public.club_chat_messages FOR EACH ROW EXECUTE FUNCTION club_private.chat_touch();
CREATE TRIGGER chat_message_signal AFTER INSERT OR UPDATE ON public.club_chat_messages FOR EACH ROW EXECUTE FUNCTION club_private.chat_invalidate();
INSERT INTO public.club_chat_signals(user_id) SELECT DISTINCT user_id FROM public.club_members ON CONFLICT DO NOTHING;
ALTER PUBLICATION supabase_realtime ADD TABLE public.club_chat_signals;

CREATE FUNCTION club_private.chat_json(p_id uuid,p_deleted boolean DEFAULT false) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('kind','chat','id',m.id,'club_id',m.club_id,'post_id',m.id,'seq',m.seq,'change_seq',m.change_seq,
 'author_id',CASE WHEN m.deleted_at IS NULL THEN m.author_id END,'display_name',CASE WHEN m.deleted_at IS NULL THEN a.display_name END,
 'avatar_url',CASE WHEN m.deleted_at IS NULL THEN a.avatar_url END,'body',m.body,'created_at',m.created_at,'edited_at',m.edited_at,
 'version',m.version,'is_pinned',false,'comment_count',0,'deleted_at',m.deleted_at)
 FROM public.club_chat_messages m LEFT JOIN public.profiles a ON a.id=m.author_id WHERE m.id=p_id AND (p_deleted OR m.deleted_at IS NULL);
$$;
CREATE FUNCTION public.club_chat_page(p_club uuid,p_before bigint DEFAULT NULL,p_after_change bigint DEFAULT NULL,p_limit integer DEFAULT 20) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE u uuid:=club_private.content_member(p_club,true); items jsonb; more boolean; cursor bigint;
BEGIN
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 20 OR (p_before IS NOT NULL AND p_after_change IS NOT NULL) OR p_before<1 OR p_after_change<0 THEN RAISE EXCEPTION 'CLUB_CONTENT_INVALID' USING ERRCODE='22023'; END IF;
 IF p_after_change IS NOT NULL THEN
  SELECT coalesce(jsonb_agg(club_private.chat_json(q.id,true) ORDER BY q.change_seq),'[]'),coalesce(max(q.change_seq),p_after_change) INTO items,cursor
  FROM (SELECT id,change_seq FROM public.club_chat_messages WHERE club_id=p_club AND change_seq>p_after_change ORDER BY change_seq LIMIT p_limit)q;
  SELECT EXISTS(SELECT 1 FROM public.club_chat_messages WHERE club_id=p_club AND change_seq>cursor) INTO more;
 ELSE
  SELECT coalesce(jsonb_agg(club_private.chat_json(q.id) ORDER BY q.seq DESC),'[]') INTO items
  FROM (SELECT id,seq FROM public.club_chat_messages WHERE club_id=p_club AND deleted_at IS NULL AND (p_before IS NULL OR seq<p_before) ORDER BY seq DESC LIMIT p_limit)q;
  SELECT EXISTS(SELECT 1 FROM public.club_chat_messages WHERE club_id=p_club AND deleted_at IS NULL AND seq<(SELECT min((v->>'seq')::bigint) FROM jsonb_array_elements(items)v)) INTO more;
  SELECT coalesce(max(change_seq),0) INTO cursor FROM public.club_chat_messages WHERE club_id=p_club;
 END IF;
 RETURN jsonb_build_object('role',club_private.role_for(p_club,u),'items',items,'cursor',cursor,'has_more',more);
END; $$;
CREATE FUNCTION public.club_chat_send(p_club uuid,p_id uuid,p_body text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE u uuid:=club_private.content_member(p_club,true); m public.club_chat_messages;
BEGIN
 IF p_id IS NULL OR p_body IS NULL OR p_body !~ '[^[:space:]]' OR char_length(btrim(p_body)) NOT BETWEEN 1 AND 1500 THEN RAISE EXCEPTION 'CLUB_CONTENT_INVALID' USING ERRCODE='22023'; END IF;
 INSERT INTO public.club_chat_messages(id,club_id,author_id,body) VALUES(p_id,p_club,u,btrim(p_body)) ON CONFLICT(id) DO NOTHING;
 SELECT * INTO m FROM public.club_chat_messages WHERE id=p_id;
 IF m.club_id IS DISTINCT FROM p_club OR m.author_id IS DISTINCT FROM u THEN RAISE EXCEPTION 'CLUB_FORBIDDEN' USING ERRCODE='42501'; END IF;
 IF m.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'CLUB_CONTENT_UNAVAILABLE' USING ERRCODE='P0002'; END IF;
 RETURN club_private.chat_json(m.id);
END; $$;
CREATE FUNCTION club_private.chat_change(p_club uuid,p_id uuid,p_action text,p_body text,p_version integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
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
   UPDATE public.club_chat_messages SET body='',deleted_at=clock_timestamp(),deleted_by=u,version=version+1,change_seq=nextval('club_private.chat_changes') WHERE id=p_id;
   INSERT INTO club_private.content_actions(club_id,actor_id,target_kind,target_id,action) VALUES(p_club,u,'chat',p_id,CASE WHEN m.author_id=u THEN 'author_delete' ELSE 'moderator_remove' END);
  END IF;
  IF is_mod THEN UPDATE club_private.content_reports SET status='removed',resolved_at=clock_timestamp(),moderator_id=u WHERE club_id=p_club AND target_kind='chat' AND target_id=p_id AND status='pending'; END IF;
 ELSE RAISE EXCEPTION 'CLUB_FORBIDDEN' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('id',p_id,'changed',true);
END; $$;
ALTER TABLE club_private.content_reports ALTER COLUMN post_id DROP NOT NULL;
ALTER TABLE club_private.content_reports ADD COLUMN chat_message_id uuid REFERENCES public.club_chat_messages(id) ON DELETE CASCADE;
ALTER TABLE club_private.content_reports DROP CONSTRAINT content_reports_target_kind_check;
ALTER TABLE club_private.content_reports ADD CONSTRAINT content_reports_target_kind_check CHECK(target_kind IN('post','comment','chat'));
ALTER TABLE club_private.content_reports ADD CONSTRAINT content_reports_target_shape CHECK(
 (target_kind='chat' AND chat_message_id IS NOT NULL AND chat_message_id=target_id AND post_id IS NULL AND comment_id IS NULL) OR
 (target_kind='post' AND post_id IS NOT NULL AND post_id=target_id AND chat_message_id IS NULL AND comment_id IS NULL) OR
 (target_kind='comment' AND comment_id IS NOT NULL AND comment_id=target_id AND post_id IS NOT NULL AND chat_message_id IS NULL));

CREATE OR REPLACE FUNCTION club_private.content_json(p_kind text,p_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('kind','post','id',p.id,'club_id',p.club_id,'post_id',p.id,'author_id',p.author_id,
 'display_name',a.display_name,'avatar_url',a.avatar_url,'body',p.body,'created_at',p.created_at,'edited_at',p.edited_at,
 'version',p.version,'is_pinned',p.is_pinned,'comment_count',(SELECT count(*) FROM public.club_comments c WHERE c.post_id=p.id AND c.deleted_at IS NULL))
 FROM public.club_posts p LEFT JOIN public.profiles a ON a.id=p.author_id WHERE p_kind='post' AND p.id=p_id AND p.deleted_at IS NULL
 UNION ALL
 SELECT jsonb_build_object('kind','comment','id',c.id,'club_id',c.club_id,'post_id',c.post_id,'author_id',c.author_id,
 'display_name',a.display_name,'avatar_url',a.avatar_url,'body',c.body,'created_at',c.created_at,'edited_at',c.edited_at,
 'version',c.version,'is_pinned',false,'comment_count',0)
 FROM public.club_comments c JOIN public.club_posts p ON p.id=c.post_id LEFT JOIN public.profiles a ON a.id=c.author_id
 WHERE p_kind='comment' AND c.id=p_id AND c.deleted_at IS NULL AND p.deleted_at IS NULL
 UNION ALL SELECT club_private.chat_json(p_id) WHERE p_kind='chat';
$$;
CREATE OR REPLACE FUNCTION public.club_content_change(p_club uuid,p_kind text,p_id uuid,p_action text,
 p_body text DEFAULT NULL,p_version integer DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE u uuid:=club_private.content_member(p_club,true); item jsonb; author uuid; v integer; removed timestamptz;
 is_mod boolean:=club_private.role_for(p_club,u) IN ('owner','admin'); old_body text; pinned boolean; parent uuid;
BEGIN
 IF p_kind='chat' THEN RETURN club_private.chat_change(p_club,p_id,p_action,p_body,p_version); END IF;
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
CREATE OR REPLACE FUNCTION public.club_content_report(p_club uuid,p_kind text,p_id uuid,p_reason text,p_detail text DEFAULT '') RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE u uuid:=club_private.content_member(p_club,true); item jsonb; report_id uuid;
BEGIN
 IF p_reason IS NULL OR p_reason NOT IN ('spam','harassment','unsafe','other') OR char_length(coalesce(p_detail,''))>500 THEN RAISE EXCEPTION 'CLUB_CONTENT_INVALID' USING ERRCODE='22023'; END IF;
 SELECT id INTO report_id FROM club_private.content_reports WHERE club_id=p_club AND target_kind=p_kind AND target_id=p_id AND reporter_id=u;
 IF report_id IS NOT NULL THEN RETURN report_id; END IF;
 item:=club_private.content_json(p_kind,p_id);
 IF item IS NULL OR item->>'club_id' IS DISTINCT FROM p_club::text THEN RAISE EXCEPTION 'CLUB_CONTENT_UNAVAILABLE' USING ERRCODE='P0002'; END IF;
 IF p_kind='chat' AND item->>'author_id'=u::text THEN RAISE EXCEPTION 'CLUB_FORBIDDEN' USING ERRCODE='42501'; END IF;
 INSERT INTO club_private.content_reports(club_id,post_id,comment_id,reporter_id,target_kind,target_id,reason,detail,snapshot,chat_message_id)
 VALUES(p_club,CASE WHEN p_kind<>'chat' THEN (item->>'post_id')::uuid END,CASE WHEN p_kind='comment' THEN p_id END,u,p_kind,p_id,p_reason,btrim(coalesce(p_detail,'')),item,CASE WHEN p_kind='chat' THEN p_id END) RETURNING id INTO report_id;
 RETURN report_id;
END; $$;
CREATE OR REPLACE FUNCTION club_private.content_report_json(p_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('id',id,'club_id',club_id,'post_id',post_id,'target_kind',target_kind,'target_id',target_id,
 'reason',reason,'detail',detail,'status',status,'created_at',created_at,'resolved_at',resolved_at,
 'context',CASE WHEN target_kind='chat' THEN (SELECT coalesce(jsonb_agg(club_private.chat_json(q.id) ORDER BY q.seq),'[]') FROM ((SELECT m.id,m.seq FROM public.club_chat_messages m WHERE m.club_id=content_reports.club_id AND m.deleted_at IS NULL AND m.seq<=(SELECT seq FROM public.club_chat_messages WHERE id=content_reports.target_id) ORDER BY m.seq DESC LIMIT 3) UNION ALL (SELECT m.id,m.seq FROM public.club_chat_messages m WHERE m.club_id=content_reports.club_id AND m.deleted_at IS NULL AND m.seq>(SELECT seq FROM public.club_chat_messages WHERE id=content_reports.target_id) ORDER BY m.seq LIMIT 2))q) ELSE '[]'::jsonb END,'snapshot',snapshot,'content',club_private.content_json(target_kind,target_id)) FROM club_private.content_reports WHERE id=p_id;
$$;
REVOKE ALL ON SEQUENCE club_private.chat_changes,public.club_chat_messages_seq_seq FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION club_private.chat_signal(uuid),club_private.chat_touch(),club_private.chat_invalidate(),club_private.chat_json(uuid,boolean),club_private.chat_change(uuid,uuid,text,text,integer) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.club_chat_page(uuid,bigint,bigint,integer),public.club_chat_send(uuid,uuid,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.club_chat_page(uuid,bigint,bigint,integer),public.club_chat_send(uuid,uuid,text) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
