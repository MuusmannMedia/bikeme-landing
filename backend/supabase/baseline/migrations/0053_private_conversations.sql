-- Existing isolated TEST bcskqapoagflshewvzzc only. No club messages are moved.
BEGIN;
CREATE SCHEMA dm_private;
REVOKE ALL ON SCHEMA dm_private FROM PUBLIC,anon,authenticated,service_role;
CREATE SEQUENCE dm_private.changes;
CREATE TABLE dm_private.conversations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), low_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 high_id uuid REFERENCES auth.users(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 activity_seq bigint NOT NULL DEFAULT nextval('dm_private.changes'), guard_version bigint NOT NULL DEFAULT 1,
 UNIQUE(low_id,high_id), CHECK(low_id IS NULL OR high_id IS NULL OR low_id<high_id)
);
CREATE INDEX dm_inbox_low ON dm_private.conversations(low_id,activity_seq DESC);
CREATE INDEX dm_inbox_high ON dm_private.conversations(high_id,activity_seq DESC);
CREATE TABLE dm_private.blocks (
 blocker uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, blocked uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), PRIMARY KEY(blocker,blocked), CHECK(blocker<>blocked)
);
CREATE TABLE dm_private.messages (
 id uuid PRIMARY KEY, conversation_id uuid NOT NULL REFERENCES dm_private.conversations(id) ON DELETE CASCADE,
 seq bigint GENERATED ALWAYS AS IDENTITY UNIQUE, change_seq bigint NOT NULL DEFAULT nextval('dm_private.changes'),
 author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL, body text NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 edited_at timestamptz, version integer NOT NULL DEFAULT 1 CHECK(version>0), deleted_at timestamptz, reply_to_id uuid,
 UNIQUE(conversation_id,id), FOREIGN KEY(conversation_id,reply_to_id) REFERENCES dm_private.messages(conversation_id,id),
 CHECK(reply_to_id IS NULL OR reply_to_id<>id),
 CHECK((deleted_at IS NULL AND char_length(btrim(body)) BETWEEN 1 AND 1500 AND body ~ '[^[:space:]]') OR (deleted_at IS NOT NULL AND body=''))
);
CREATE INDEX dm_message_page ON dm_private.messages(conversation_id,seq DESC);
CREATE INDEX dm_message_changes ON dm_private.messages(conversation_id,change_seq);
CREATE INDEX dm_reply_reference ON dm_private.messages(conversation_id,reply_to_id) WHERE reply_to_id IS NOT NULL;
CREATE TABLE dm_private.reports (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), request_id uuid NOT NULL UNIQUE,
 reporter_id uuid REFERENCES auth.users(id) ON DELETE SET NULL, conversation_id uuid REFERENCES dm_private.conversations(id) ON DELETE SET NULL,
 target_id uuid NOT NULL, message_version integer NOT NULL, snapshot jsonb NOT NULL,
 reason text NOT NULL CHECK(reason IN('spam','harassment','unsafe','other')), detail text NOT NULL CHECK(char_length(detail)<=500),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','dismissed','removed')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), resolved_at timestamptz, operator_label text, resolution text,
 UNIQUE(reporter_id,target_id,message_version)
);
CREATE INDEX dm_report_queue ON dm_private.reports(status,created_at,id);
CREATE TABLE public.private_message_signals (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, revision bigint NOT NULL DEFAULT 1
);
ALTER TABLE dm_private.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE dm_private.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE dm_private.blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE dm_private.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.private_message_signals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA dm_private FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA dm_private FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON public.private_message_signals FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.private_message_signals TO authenticated;
CREATE POLICY dm_signal_self ON public.private_message_signals FOR SELECT TO authenticated USING(user_id=auth.uid());
ALTER PUBLICATION supabase_realtime ADD TABLE public.private_message_signals;

CREATE FUNCTION dm_private.uid() RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE u uuid:=auth.uid(); BEGIN
 IF u IS NULL OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=u) THEN RAISE EXCEPTION 'DM_AUTH_REQUIRED' USING ERRCODE='28000'; END IF;
 RETURN u;
END; $$;
CREATE FUNCTION dm_private.signal(p_user uuid) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog AS $$
 INSERT INTO public.private_message_signals(user_id) SELECT id FROM auth.users WHERE id=p_user
 ON CONFLICT(user_id) DO UPDATE SET revision=public.private_message_signals.revision+1;
$$;
CREATE FUNCTION dm_private.conversation_changed() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE u uuid; BEGIN
 IF TG_OP='INSERT' OR OLD.activity_seq IS DISTINCT FROM NEW.activity_seq OR OLD.low_id IS DISTINCT FROM NEW.low_id OR OLD.high_id IS DISTINCT FROM NEW.high_id THEN
  FOR u IN SELECT v FROM unnest(ARRAY[NEW.low_id,NEW.high_id])v WHERE v IS NOT NULL ORDER BY v LOOP PERFORM dm_private.signal(u); END LOOP;
 END IF;
 RETURN NULL;
END; $$;
CREATE TRIGGER dm_conversation_signal AFTER INSERT OR UPDATE ON dm_private.conversations FOR EACH ROW EXECUTE FUNCTION dm_private.conversation_changed();
CREATE FUNCTION dm_private.lock_conversation(p_id uuid) RETURNS dm_private.conversations LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE u uuid:=dm_private.uid(); c dm_private.conversations; BEGIN
 -- Serializes send/block/edit and forces stale repeatable-read snapshots to retry.
 UPDATE dm_private.conversations SET guard_version=guard_version+1 WHERE id=p_id AND (low_id=u OR high_id=u) RETURNING * INTO c;
 IF c.id IS NULL THEN RAISE EXCEPTION 'DM_FORBIDDEN' USING ERRCODE='42501'; END IF;
 RETURN c;
END; $$;
CREATE FUNCTION dm_private.is_blocked(c dm_private.conversations) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT c.low_id IS NULL OR c.high_id IS NULL OR EXISTS(SELECT 1 FROM dm_private.blocks b WHERE (b.blocker=c.low_id AND b.blocked=c.high_id) OR (b.blocker=c.high_id AND b.blocked=c.low_id));
$$;
CREATE FUNCTION dm_private.quote(p_conversation uuid,p_id uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('id',m.id,'seq',m.seq,'change_seq',m.change_seq,'deleted',m.deleted_at IS NOT NULL,
 'author_id',CASE WHEN m.deleted_at IS NULL THEN m.author_id END,'display_name',CASE WHEN m.deleted_at IS NULL THEN p.display_name END,
 'body',CASE WHEN m.deleted_at IS NULL THEN left(m.body,200) END)
 FROM dm_private.messages m LEFT JOIN public.profiles p ON p.id=m.author_id WHERE m.id=p_id AND m.conversation_id=p_conversation;
$$;
CREATE FUNCTION dm_private.message_json(p_id uuid,p_deleted boolean DEFAULT false) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('id',m.id,'conversation_id',m.conversation_id,'seq',m.seq,'change_seq',m.change_seq,
 'author_id',CASE WHEN m.deleted_at IS NULL THEN m.author_id END,'display_name',CASE WHEN m.deleted_at IS NULL THEN p.display_name END,
 'avatar_url',CASE WHEN m.deleted_at IS NULL THEN p.avatar_url END,'body',m.body,'created_at',m.created_at,'edited_at',m.edited_at,
 'version',m.version,'deleted_at',m.deleted_at,'reply_to_id',CASE WHEN m.deleted_at IS NULL THEN m.reply_to_id END,
 'reply',CASE WHEN m.deleted_at IS NULL AND m.reply_to_id IS NOT NULL THEN dm_private.quote(m.conversation_id,m.reply_to_id) END)
 FROM dm_private.messages m LEFT JOIN public.profiles p ON p.id=m.author_id WHERE m.id=p_id AND (p_deleted OR m.deleted_at IS NULL);
$$;
CREATE FUNCTION dm_private.conversation_json(p_id uuid,p_user uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('id',c.id,'activity_seq',c.activity_seq,'created_at',c.created_at,
 'peer',jsonb_build_object('id',p.id,'display_name',p.display_name,'avatar_url',p.avatar_url),
 'blocked_by_me',EXISTS(SELECT 1 FROM dm_private.blocks WHERE blocker=p_user AND blocked=p.id),
 'messaging_blocked',dm_private.is_blocked(c),
 'last_message',(SELECT dm_private.message_json(m.id) FROM dm_private.messages m WHERE m.conversation_id=c.id AND m.deleted_at IS NULL ORDER BY m.seq DESC LIMIT 1))
 FROM dm_private.conversations c LEFT JOIN public.profiles p ON p.id=CASE WHEN c.low_id=p_user THEN c.high_id ELSE c.low_id END
 WHERE c.id=p_id AND (c.low_id=p_user OR c.high_id=p_user);
$$;
CREATE FUNCTION dm_private.message_touch() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN NEW.change_seq:=nextval('dm_private.changes'); RETURN NEW; END; $$;
CREATE TRIGGER dm_message_touch BEFORE UPDATE ON dm_private.messages FOR EACH ROW EXECUTE FUNCTION dm_private.message_touch();
CREATE FUNCTION dm_private.message_changed() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 UPDATE dm_private.conversations SET activity_seq=greatest(activity_seq,NEW.change_seq) WHERE id=NEW.conversation_id;
 IF TG_OP='UPDATE' AND (OLD.body IS DISTINCT FROM NEW.body OR OLD.deleted_at IS DISTINCT FROM NEW.deleted_at OR OLD.author_id IS DISTINCT FROM NEW.author_id) THEN
  UPDATE dm_private.messages SET change_seq=change_seq WHERE conversation_id=NEW.conversation_id AND reply_to_id=NEW.id AND deleted_at IS NULL;
 END IF;
 RETURN NULL;
END; $$;
CREATE TRIGGER dm_message_signal AFTER INSERT OR UPDATE ON dm_private.messages FOR EACH ROW EXECUTE FUNCTION dm_private.message_changed();

CREATE FUNCTION public.dm_recipients(p_after uuid DEFAULT NULL,p_limit integer DEFAULT 30,p_query text DEFAULT '') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE u uuid:=dm_private.uid(); result jsonb; BEGIN
 IF p_limit NOT BETWEEN 1 AND 30 OR p_limit IS NULL OR p_query IS NULL OR char_length(p_query)>80 THEN RAISE EXCEPTION 'DM_INVALID' USING ERRCODE='22023'; END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.id),'[]') INTO result FROM(
  SELECT p.id,p.display_name,p.avatar_url FROM public.profiles p WHERE p.id<>u AND (p_after IS NULL OR p.id>p_after)
  AND EXISTS(SELECT 1 FROM public.club_members a JOIN public.club_members b ON b.club_id=a.club_id WHERE a.user_id=u AND b.user_id=p.id)
  AND (p_query='' OR strpos(lower(coalesce(p.display_name,'')),lower(btrim(p_query)))>0) ORDER BY p.id LIMIT p_limit)q;
 RETURN result;
END; $$;
CREATE FUNCTION public.dm_start(p_peer uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE u uuid:=dm_private.uid(); lo uuid:=least(u,p_peer); hi uuid:=greatest(u,p_peer); cid uuid; shared uuid; BEGIN
 IF p_peer IS NULL OR p_peer=u THEN RAISE EXCEPTION 'DM_INVALID' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(lo::text||':'||hi::text,0));
 SELECT id INTO cid FROM dm_private.conversations WHERE low_id=lo AND high_id=hi;
 IF cid IS NULL THEN
  SELECT a.club_id INTO shared FROM public.club_members a JOIN public.club_members b ON b.club_id=a.club_id WHERE a.user_id=u AND b.user_id=p_peer ORDER BY a.club_id LIMIT 1;
  IF shared IS NULL THEN RAISE EXCEPTION 'DM_SHARED_CLUB_REQUIRED' USING ERRCODE='42501'; END IF;
  PERFORM club_private.lock_club(shared);
  IF NOT EXISTS(SELECT 1 FROM public.club_members a JOIN public.club_members b ON b.club_id=a.club_id WHERE a.club_id=shared AND a.user_id=u AND b.user_id=p_peer) THEN RAISE EXCEPTION 'DM_SHARED_CLUB_REQUIRED' USING ERRCODE='42501'; END IF;
  INSERT INTO dm_private.conversations(low_id,high_id) VALUES(lo,hi) ON CONFLICT(low_id,high_id) DO NOTHING RETURNING id INTO cid;
  IF cid IS NULL THEN SELECT id INTO cid FROM dm_private.conversations WHERE low_id=lo AND high_id=hi; END IF;
  IF cid IS NULL THEN RAISE EXCEPTION 'DM_RETRY' USING ERRCODE='40001'; END IF;
 END IF;
 PERFORM dm_private.lock_conversation(cid);
 RETURN dm_private.conversation_json(cid,u);
END; $$;
CREATE FUNCTION public.dm_inbox(p_before bigint DEFAULT NULL,p_limit integer DEFAULT 20) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE u uuid:=dm_private.uid(); result jsonb; BEGIN
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION 'DM_INVALID' USING ERRCODE='22023'; END IF;
 SELECT coalesce(jsonb_agg(dm_private.conversation_json(q.id,u) ORDER BY q.activity_seq DESC),'[]') INTO result FROM(
  SELECT id,activity_seq FROM dm_private.conversations WHERE (low_id=u OR high_id=u) AND (p_before IS NULL OR activity_seq<p_before) ORDER BY activity_seq DESC LIMIT p_limit)q;
 RETURN result;
END; $$;
CREATE FUNCTION public.dm_page(p_conversation uuid,p_before bigint DEFAULT NULL,p_after_change bigint DEFAULT NULL,p_limit integer DEFAULT 20) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE u uuid:=dm_private.uid(); c dm_private.conversations:=dm_private.lock_conversation(p_conversation); items jsonb; more boolean; cursor bigint; BEGIN
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 20 OR (p_before IS NOT NULL AND p_after_change IS NOT NULL) OR p_before<1 OR p_after_change<0 THEN RAISE EXCEPTION 'DM_INVALID' USING ERRCODE='22023'; END IF;
 IF p_after_change IS NOT NULL THEN
  SELECT coalesce(jsonb_agg(dm_private.message_json(q.id,true) ORDER BY q.change_seq),'[]'),coalesce(max(q.change_seq),p_after_change) INTO items,cursor FROM(SELECT id,change_seq FROM dm_private.messages WHERE conversation_id=p_conversation AND change_seq>p_after_change ORDER BY change_seq LIMIT p_limit)q;
  SELECT EXISTS(SELECT 1 FROM dm_private.messages WHERE conversation_id=p_conversation AND change_seq>cursor) INTO more;
 ELSE
  SELECT coalesce(jsonb_agg(dm_private.message_json(q.id) ORDER BY q.seq DESC),'[]') INTO items FROM(SELECT id,seq FROM dm_private.messages WHERE conversation_id=p_conversation AND deleted_at IS NULL AND (p_before IS NULL OR seq<p_before) ORDER BY seq DESC LIMIT p_limit)q;
  SELECT EXISTS(SELECT 1 FROM dm_private.messages WHERE conversation_id=p_conversation AND deleted_at IS NULL AND seq<(SELECT min((v->>'seq')::bigint) FROM jsonb_array_elements(items)v)) INTO more;
  SELECT coalesce(max(change_seq),0) INTO cursor FROM dm_private.messages WHERE conversation_id=p_conversation;
 END IF;
 RETURN jsonb_build_object('items',items,'cursor',cursor,'has_more',more,'conversation',dm_private.conversation_json(p_conversation,u));
END; $$;
CREATE FUNCTION public.dm_message(p_conversation uuid,p_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 PERFORM dm_private.lock_conversation(p_conversation);
 IF NOT EXISTS(SELECT 1 FROM dm_private.messages WHERE id=p_id AND conversation_id=p_conversation) THEN RAISE EXCEPTION 'DM_UNAVAILABLE' USING ERRCODE='P0002'; END IF;
 RETURN dm_private.message_json(p_id,true);
END; $$;
CREATE FUNCTION public.dm_send(p_conversation uuid,p_id uuid,p_body text,p_reply_to uuid DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE u uuid:=dm_private.uid(); c dm_private.conversations:=dm_private.lock_conversation(p_conversation); m dm_private.messages; BEGIN
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
END; $$;
CREATE FUNCTION public.dm_change(p_conversation uuid,p_id uuid,p_action text,p_body text DEFAULT NULL,p_version integer DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE u uuid:=dm_private.uid(); c dm_private.conversations:=dm_private.lock_conversation(p_conversation); m dm_private.messages; BEGIN
 SELECT * INTO m FROM dm_private.messages WHERE id=p_id AND conversation_id=p_conversation;
 IF m.id IS NULL THEN RAISE EXCEPTION 'DM_UNAVAILABLE' USING ERRCODE='P0002'; END IF;
 IF m.author_id IS DISTINCT FROM u THEN RAISE EXCEPTION 'DM_FORBIDDEN' USING ERRCODE='42501'; END IF;
 IF p_action='delete' THEN
  IF m.deleted_at IS NULL THEN UPDATE dm_private.messages SET body='',deleted_at=clock_timestamp(),version=version+1 WHERE id=p_id; END IF;
 ELSIF p_action='edit' THEN
  IF dm_private.is_blocked(c) THEN RAISE EXCEPTION 'DM_BLOCKED' USING ERRCODE='PT423'; END IF;
  IF m.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'DM_UNAVAILABLE' USING ERRCODE='P0002'; END IF;
  IF p_body IS NULL OR p_body !~ '[^[:space:]]' OR char_length(btrim(p_body)) NOT BETWEEN 1 AND 1500 THEN RAISE EXCEPTION 'DM_INVALID' USING ERRCODE='22023'; END IF;
  IF m.version=p_version+1 AND m.body=btrim(p_body) THEN RETURN dm_private.message_json(m.id); END IF;
  IF m.version IS DISTINCT FROM p_version THEN RAISE EXCEPTION 'DM_CONFLICT' USING ERRCODE='PT409'; END IF;
  UPDATE dm_private.messages SET body=btrim(p_body),edited_at=clock_timestamp(),version=version+1 WHERE id=p_id;
 ELSE RAISE EXCEPTION 'DM_INVALID' USING ERRCODE='22023'; END IF;
 RETURN jsonb_build_object('id',p_id,'changed',true);
END; $$;
CREATE FUNCTION public.dm_set_block(p_conversation uuid,p_block boolean) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE u uuid:=dm_private.uid(); c dm_private.conversations:=dm_private.lock_conversation(p_conversation); peer uuid:=CASE WHEN c.low_id=u THEN c.high_id ELSE c.low_id END; BEGIN
 IF p_block IS NULL OR peer IS NULL THEN RAISE EXCEPTION 'DM_UNAVAILABLE' USING ERRCODE='P0002'; END IF;
 IF p_block THEN INSERT INTO dm_private.blocks(blocker,blocked) VALUES(u,peer) ON CONFLICT DO NOTHING;
 ELSE DELETE FROM dm_private.blocks WHERE blocker=u AND blocked=peer; END IF;
 UPDATE dm_private.conversations SET activity_seq=nextval('dm_private.changes') WHERE id=p_conversation;
 RETURN dm_private.conversation_json(p_conversation,u);
END; $$;
CREATE FUNCTION public.dm_report(p_conversation uuid,p_id uuid,p_request uuid,p_reason text,p_detail text DEFAULT '') RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE u uuid:=dm_private.uid(); c dm_private.conversations:=dm_private.lock_conversation(p_conversation); m dm_private.messages; r dm_private.reports; BEGIN
 IF p_request IS NULL OR p_reason IS NULL OR p_reason NOT IN('spam','harassment','unsafe','other') OR p_detail IS NULL OR char_length(p_detail)>500 THEN RAISE EXCEPTION 'DM_INVALID' USING ERRCODE='22023'; END IF;
 SELECT * INTO r FROM dm_private.reports WHERE request_id=p_request;
 IF r.id IS NOT NULL THEN
  IF r.reporter_id IS DISTINCT FROM u OR r.conversation_id IS DISTINCT FROM p_conversation OR r.target_id IS DISTINCT FROM p_id THEN RAISE EXCEPTION 'DM_FORBIDDEN' USING ERRCODE='42501'; END IF;
  RETURN r.id;
 END IF;
 SELECT * INTO m FROM dm_private.messages WHERE id=p_id AND conversation_id=p_conversation AND deleted_at IS NULL;
 IF m.id IS NULL THEN RAISE EXCEPTION 'DM_UNAVAILABLE' USING ERRCODE='P0002'; END IF;
 IF m.author_id=u THEN RAISE EXCEPTION 'DM_FORBIDDEN' USING ERRCODE='42501'; END IF;
 INSERT INTO dm_private.reports(request_id,reporter_id,conversation_id,target_id,message_version,snapshot,reason,detail)
 VALUES(p_request,u,p_conversation,m.id,m.version,jsonb_build_object('message_id',m.id,'author_id',m.author_id,'body',m.body,'created_at',m.created_at,'version',m.version,'reply_to_id',m.reply_to_id),p_reason,btrim(p_detail))
 ON CONFLICT(reporter_id,target_id,message_version) DO NOTHING RETURNING * INTO r;
 IF r.id IS NULL THEN SELECT * INTO r FROM dm_private.reports WHERE reporter_id=u AND target_id=m.id AND message_version=m.version; END IF;
 RETURN r.id;
END; $$;
-- Only trusted Bike Me backend operators can list/resolve reports. Never app users or club roles.
CREATE FUNCTION public.dm_support_reports(p_before_time timestamptz DEFAULT NULL,p_before_id uuid DEFAULT NULL,p_limit integer DEFAULT 20) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION 'DM_INVALID' USING ERRCODE='22023'; END IF;
 RETURN (SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.created_at,q.id),'[]') FROM(SELECT * FROM dm_private.reports WHERE status='pending' AND (p_before_time IS NULL OR (created_at,id)>(p_before_time,p_before_id)) ORDER BY created_at,id LIMIT p_limit)q);
END; $$;
CREATE FUNCTION public.dm_support_resolve(p_report uuid,p_action text,p_operator text,p_note text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE r dm_private.reports; BEGIN
 IF p_action NOT IN('dismiss','remove') OR p_action IS NULL OR p_operator IS NULL OR char_length(btrim(p_operator)) NOT BETWEEN 1 AND 120 OR p_note IS NULL OR char_length(btrim(p_note)) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'DM_INVALID' USING ERRCODE='22023'; END IF;
 SELECT * INTO r FROM dm_private.reports WHERE id=p_report;
 IF r.id IS NULL THEN RAISE EXCEPTION 'DM_UNAVAILABLE' USING ERRCODE='P0002'; END IF;
 -- Same order as user mutations: conversation first, report second.
 PERFORM 1 FROM dm_private.conversations WHERE id=r.conversation_id FOR UPDATE;
 SELECT * INTO r FROM dm_private.reports WHERE id=p_report FOR UPDATE;
 IF r.status<>'pending' THEN RETURN jsonb_build_object('id',r.id,'already_resolved',true); END IF;
 IF p_action='remove' THEN UPDATE dm_private.messages SET body='',deleted_at=clock_timestamp(),version=version+1 WHERE id=r.target_id AND deleted_at IS NULL; END IF;
 UPDATE dm_private.reports SET status=CASE WHEN p_action='remove' THEN 'removed' ELSE 'dismissed' END,resolved_at=clock_timestamp(),operator_label=btrim(p_operator),resolution=btrim(p_note) WHERE id=p_report;
 RETURN jsonb_build_object('id',p_report,'stored',true);
END; $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA dm_private FROM PUBLIC,anon,authenticated,service_role;
DO $$ DECLARE f record; BEGIN
 FOR f IN SELECT oid::regprocedure AS signature FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN('dm_recipients','dm_start','dm_inbox','dm_page','dm_message','dm_send','dm_change','dm_set_block','dm_report') LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',f.signature);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f.signature);
 END LOOP;
END; $$;
REVOKE ALL ON FUNCTION public.dm_support_reports(timestamptz,uuid,integer),public.dm_support_resolve(uuid,text,text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.dm_support_reports(timestamptz,uuid,integer),public.dm_support_resolve(uuid,text,text,text) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
