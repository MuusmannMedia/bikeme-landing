-- Use the existing directional DM blocks for ordinary club visibility.
-- Keep the evidence projections and report queues separate from member projections.
BEGIN;

-- 0065 is present in the club test catalog even when it has no ledger entry.
DO $$
BEGIN
  IF to_regclass('club_private.bike_me_reports') IS NULL
     OR to_regprocedure('public.club_report_to_bike_me(uuid,text,uuid,text,text)') IS NULL
     OR to_regprocedure('public.club_support_reports(timestamptz,uuid,integer)') IS NULL
     OR to_regprocedure('public.club_support_resolve(uuid,text,text,text)') IS NULL THEN
    RAISE EXCEPTION 'CLUB_CONFIDENTIAL_REPORTS_REQUIRED';
  END IF;
END;
$$;

-- The guard serializes operations even before a block exists. Updating it also
-- makes an old REPEATABLE READ snapshot fail instead of accepting a stale target.
CREATE TABLE dm_private.block_pair_guards (
  low_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  high_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  PRIMARY KEY (low_id, high_id),
  CHECK (low_id < high_id)
);
CREATE INDEX block_pair_guards_high_idx ON dm_private.block_pair_guards(high_id);
ALTER TABLE dm_private.block_pair_guards ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON dm_private.block_pair_guards FROM PUBLIC, anon, authenticated, service_role;

ALTER TABLE public.club_chat_signals ADD COLUMN visibility_revision bigint NOT NULL DEFAULT 0;

CREATE FUNCTION dm_private.lock_block_pair(p_user uuid, p_peer uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog AS $$
  INSERT INTO dm_private.block_pair_guards(low_id, high_id)
  SELECT least(p_user, p_peer), greatest(p_user, p_peer)
  WHERE p_user IS NOT NULL AND p_peer IS NOT NULL AND p_user <> p_peer
  ON CONFLICT (low_id, high_id) DO UPDATE SET low_id = EXCLUDED.low_id;
$$;

CREATE FUNCTION dm_private.blocked_pair(p_user uuid, p_peer uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
  SELECT EXISTS (
    SELECT 1 FROM dm_private.blocks
    WHERE (blocker = p_user AND blocked = p_peer) OR (blocker = p_peer AND blocked = p_user)
  );
$$;

CREATE FUNCTION dm_private.write_block(p_user uuid, p_peer uuid, p_block boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE changed boolean;
BEGIN
  IF p_block THEN
    INSERT INTO dm_private.blocks(blocker, blocked) VALUES (p_user, p_peer) ON CONFLICT DO NOTHING;
    changed := FOUND;
  ELSE
    DELETE FROM dm_private.blocks WHERE blocker = p_user AND blocked = p_peer;
    changed := FOUND;
  END IF;
  IF NOT changed THEN RETURN; END IF;

  -- The caller holds the pair guard. The conversation trigger signals existing
  -- threads. Without a thread, refresh the recipient pickers directly.
  UPDATE dm_private.conversations SET activity_seq = nextval('dm_private.changes')
  WHERE low_id = least(p_user, p_peer) AND high_id = greatest(p_user, p_peer);
  IF NOT FOUND THEN
    PERFORM dm_private.signal(least(p_user, p_peer));
    PERFORM dm_private.signal(greatest(p_user, p_peer));
  END IF;

  INSERT INTO public.club_chat_signals(user_id, visibility_revision)
  SELECT id, 1 FROM auth.users WHERE id IN (p_user, p_peer) ORDER BY id
  ON CONFLICT (user_id) DO UPDATE
  SET revision = club_chat_signals.revision + 1,
      visibility_revision = club_chat_signals.visibility_revision + 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.dm_set_block(p_conversation uuid, p_block boolean) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE actor uuid := dm_private.uid(); peer uuid; current_peer uuid; c dm_private.conversations;
BEGIN
  SELECT CASE WHEN low_id = actor THEN high_id ELSE low_id END INTO peer
  FROM dm_private.conversations WHERE id = p_conversation AND actor IN (low_id, high_id);
  IF NOT FOUND THEN RAISE EXCEPTION 'DM_FORBIDDEN' USING ERRCODE = '42501'; END IF;
  IF peer IS NULL OR p_block IS NULL THEN RAISE EXCEPTION 'DM_UNAVAILABLE' USING ERRCODE = 'P0002'; END IF;

  PERFORM dm_private.lock_block_pair(actor, peer);
  c := dm_private.lock_conversation(p_conversation);
  current_peer := CASE WHEN c.low_id = actor THEN c.high_id ELSE c.low_id END;
  IF current_peer IS DISTINCT FROM peer THEN RAISE EXCEPTION 'DM_UNAVAILABLE' USING ERRCODE = 'P0002'; END IF;
  PERFORM dm_private.write_block(actor, peer, p_block);
  RETURN dm_private.conversation_json(p_conversation, actor);
END;
$$;

CREATE FUNCTION public.club_block_user(p_club uuid, p_kind text, p_id uuid) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE actor uuid := club_private.content_member(p_club, true); item jsonb; peer uuid;
BEGIN
  IF p_kind IS NULL OR p_kind NOT IN ('post', 'comment', 'chat', 'member') OR p_id IS NULL THEN
    RAISE EXCEPTION 'CLUB_CONTENT_INVALID' USING ERRCODE = '22023';
  END IF;
  IF p_kind = 'member' THEN
    SELECT user_id INTO peer FROM public.club_members WHERE club_id = p_club AND user_id = p_id;
  ELSE
    item := club_private.content_json(p_kind, p_id);
    IF item->>'club_id' = p_club::text THEN peer := (item->>'author_id')::uuid; END IF;
  END IF;
  IF peer IS NULL OR peer = actor THEN
    RAISE EXCEPTION 'CLUB_CONTENT_UNAVAILABLE' USING ERRCODE = 'P0002';
  END IF;
  -- The source remains valid even if the peer already blocked the actor or left
  -- the club. This also permits retrying the same confirmed command.
  PERFORM dm_private.lock_block_pair(actor, peer);
  PERFORM dm_private.write_block(actor, peer, true);
  RETURN (SELECT visibility_revision FROM public.club_chat_signals WHERE user_id = actor);
END;
$$;

CREATE FUNCTION public.club_unblock_user(p_peer uuid) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE actor uuid := dm_private.uid();
BEGIN
  IF p_peer IS NULL OR p_peer = actor THEN RAISE EXCEPTION 'CLUB_CONTENT_INVALID' USING ERRCODE = '22023'; END IF;
  IF EXISTS (SELECT 1 FROM dm_private.blocks WHERE blocker = actor AND blocked = p_peer) THEN
    PERFORM dm_private.lock_block_pair(actor, p_peer);
    PERFORM dm_private.write_block(actor, p_peer, false);
  END IF;
  RETURN coalesce((SELECT visibility_revision FROM public.club_chat_signals WHERE user_id = actor), 0);
END;
$$;

CREATE FUNCTION public.club_blocked_users() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE actor uuid := dm_private.uid();
BEGIN
  RETURN (
    SELECT coalesce(jsonb_agg(jsonb_build_object('id', b.blocked, 'display_name', p.display_name)
                              ORDER BY b.created_at DESC, b.blocked), '[]')
    FROM dm_private.blocks b LEFT JOIN public.profiles p ON p.id = b.blocked
    WHERE b.blocker = actor
  );
END;
$$;

CREATE FUNCTION club_private.block_visible(p_author uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
  SELECT NOT dm_private.blocked_pair(auth.uid(), p_author);
$$;

-- Raw chat rows cannot mask one column. Withhold a raw reply if it would
-- expose a hidden original's ID. Member RPCs still return its visible text.
CREATE FUNCTION club_private.chat_reference_visible(p_club uuid, p_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
  SELECT p_id IS NULL OR EXISTS (
    SELECT 1 FROM public.club_chat_messages m
    WHERE m.club_id = p_club AND m.id = p_id AND club_private.block_visible(m.author_id)
  );
$$;

ALTER POLICY chat_member_read ON public.club_chat_messages USING (
  club_private.my_role(club_id) IS NOT NULL AND club_private.block_visible(author_id)
  AND club_private.chat_reference_visible(club_id, reply_to_id)
);
ALTER POLICY club_posts_member_read ON public.club_posts USING (
  deleted_at IS NULL AND club_private.my_role(club_id) IS NOT NULL AND club_private.block_visible(author_id)
);
ALTER POLICY club_comments_member_read ON public.club_comments USING (
  deleted_at IS NULL AND club_private.my_role(club_id) IS NOT NULL AND club_private.block_visible(author_id)
  AND EXISTS (
    SELECT 1 FROM public.club_posts p
    WHERE p.id = post_id AND p.club_id = club_comments.club_id AND p.deleted_at IS NULL
  )
);

CREATE FUNCTION club_private.member_chat_json(p_club uuid, p_id uuid, p_deleted boolean DEFAULT false) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
  SELECT CASE WHEN m.deleted_at IS NULL AND NOT club_private.chat_reference_visible(m.club_id, m.reply_to_id)
    THEN (club_private.chat_json(m.id, p_deleted) - 'reply_to_id' - 'reply') || '{"reply_unavailable":true}'::jsonb
    ELSE club_private.chat_json(m.id, p_deleted)
  END
  FROM public.club_chat_messages m
  WHERE m.club_id = p_club AND m.id = p_id AND club_private.block_visible(m.author_id);
$$;

CREATE FUNCTION club_private.member_content_json(p_club uuid, p_kind text, p_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
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
  SELECT club_private.member_chat_json(p_club, p_id) WHERE p_kind = 'chat';
$$;

CREATE FUNCTION club_private.require_visible_target(p_actor uuid, p_author uuid, p_error text, p_code text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
  PERFORM dm_private.lock_block_pair(p_actor, p_author);
  IF dm_private.blocked_pair(p_actor, p_author) THEN
    RAISE EXCEPTION '%', p_error USING ERRCODE = p_code;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION dm_private.require_recipient(p_user uuid,p_peer uuid) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE shared uuid; BEGIN
 PERFORM dm_private.lock_block_pair(p_user,p_peer);
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

CREATE OR REPLACE FUNCTION public.club_chat_page(p_club uuid,p_before bigint DEFAULT NULL,p_after_change bigint DEFAULT NULL,p_limit integer DEFAULT 20) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE u uuid:=club_private.content_member(p_club,true); items jsonb; more boolean; cursor bigint;
BEGIN
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 20 OR (p_before IS NOT NULL AND p_after_change IS NOT NULL) OR p_before<1 OR p_after_change<0 THEN RAISE EXCEPTION 'CLUB_CONTENT_INVALID' USING ERRCODE='22023'; END IF;
 IF p_after_change IS NOT NULL THEN
  SELECT coalesce(jsonb_agg(club_private.member_chat_json(p_club,q.id,true) ORDER BY q.change_seq),'[]'),coalesce(max(q.change_seq),p_after_change) INTO items,cursor
  FROM (SELECT id,change_seq FROM public.club_chat_messages WHERE club_id=p_club AND club_private.block_visible(author_id) AND change_seq>p_after_change ORDER BY change_seq LIMIT p_limit)q;
  SELECT EXISTS(SELECT 1 FROM public.club_chat_messages WHERE club_id=p_club AND club_private.block_visible(author_id) AND change_seq>cursor) INTO more;
 ELSE
  SELECT coalesce(jsonb_agg(club_private.member_chat_json(p_club,q.id) ORDER BY q.seq DESC),'[]') INTO items
  FROM (SELECT id,seq FROM public.club_chat_messages WHERE club_id=p_club AND club_private.block_visible(author_id) AND deleted_at IS NULL AND (p_before IS NULL OR seq<p_before) ORDER BY seq DESC LIMIT p_limit)q;
  SELECT EXISTS(SELECT 1 FROM public.club_chat_messages WHERE club_id=p_club AND club_private.block_visible(author_id) AND deleted_at IS NULL AND seq<(SELECT min((v->>'seq')::bigint) FROM jsonb_array_elements(items)v)) INTO more;
  SELECT coalesce(max(change_seq),0) INTO cursor FROM public.club_chat_messages WHERE club_id=p_club AND club_private.block_visible(author_id);
 END IF;
 RETURN jsonb_build_object('role',club_private.role_for(p_club,u),'items',items,'cursor',cursor,'has_more',more);
END; $$;

CREATE OR REPLACE FUNCTION public.club_chat_send(p_club uuid,p_id uuid,p_body text,p_reply_to uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE u uuid:=club_private.content_member(p_club,true); m public.club_chat_messages; target_author uuid;
BEGIN
 IF p_id IS NULL OR p_id=p_reply_to OR p_body IS NULL OR p_body !~ '[^[:space:]]' OR char_length(btrim(p_body)) NOT BETWEEN 1 AND 1500 THEN
  RAISE EXCEPTION 'CLUB_CONTENT_INVALID' USING ERRCODE='22023'; END IF;
 SELECT * INTO m FROM public.club_chat_messages WHERE id=p_id;
 IF m.id IS NULL THEN
  IF p_reply_to IS NOT NULL THEN
   SELECT author_id INTO target_author FROM public.club_chat_messages WHERE id=p_reply_to AND club_id=p_club AND deleted_at IS NULL;
   IF NOT FOUND THEN RAISE EXCEPTION 'CLUB_CHAT_REPLY_UNAVAILABLE' USING ERRCODE='PT410'; END IF;
   PERFORM club_private.require_visible_target(u,target_author,'CLUB_CHAT_REPLY_UNAVAILABLE','PT410');
  END IF;
  INSERT INTO public.club_chat_messages(id,club_id,author_id,body,reply_to_id)
  VALUES(p_id,p_club,u,btrim(p_body),p_reply_to) ON CONFLICT(id) DO NOTHING;
  SELECT * INTO m FROM public.club_chat_messages WHERE id=p_id;
 END IF;
 IF m.club_id IS DISTINCT FROM p_club OR m.author_id IS DISTINCT FROM u THEN RAISE EXCEPTION 'CLUB_FORBIDDEN' USING ERRCODE='42501'; END IF;
 IF m.reply_to_id IS DISTINCT FROM p_reply_to THEN RAISE EXCEPTION 'CLUB_CONTENT_CONFLICT' USING ERRCODE='PT409'; END IF;
 IF m.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'CLUB_CONTENT_UNAVAILABLE' USING ERRCODE='P0002'; END IF;
 -- A saved reply remains idempotent even if its original was deleted later.
 RETURN club_private.member_chat_json(p_club,m.id);
END; $$;

CREATE OR REPLACE FUNCTION public.club_chat_message(p_club uuid,p_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE u uuid:=club_private.content_member(p_club,true);
item jsonb;
BEGIN
 item := club_private.member_chat_json(p_club,p_id,true);
 IF item IS NULL THEN
  RAISE EXCEPTION 'CLUB_CONTENT_UNAVAILABLE' USING ERRCODE='P0002'; END IF;
 RETURN item;
END; $$;

CREATE OR REPLACE FUNCTION public.club_chat_search(p_club uuid, p_query text, p_before bigint DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE
  needle text := lower(btrim(p_query, E' \t\n\r'));
  result jsonb;
BEGIN
  PERFORM club_private.content_member(p_club, true);
  IF needle IS NULL OR char_length(needle) NOT BETWEEN 1 AND 100 OR p_before < 1 THEN
    RAISE EXCEPTION 'CLUB_CONTENT_INVALID' USING ERRCODE = '22023';
  END IF;

  WITH hits AS MATERIALIZED (
    SELECT m.id, m.seq, m.author_id, m.created_at, m.body, strpos(lower(m.body), needle) AS match_at
    FROM public.club_chat_messages m
    WHERE m.club_id = p_club AND m.deleted_at IS NULL AND club_private.block_visible(m.author_id)
      AND (p_before IS NULL OR m.seq < p_before)
      AND strpos(lower(m.body), needle) > 0
    ORDER BY m.seq DESC
    LIMIT 21
  ), page AS (
    SELECT * FROM hits ORDER BY seq DESC LIMIT 20
  )
  SELECT jsonb_build_object(
    'items', coalesce(jsonb_agg(jsonb_build_object(
      'id', m.id, 'display_name', p.display_name, 'created_at', m.created_at,
      'excerpt', concat(
        CASE WHEN m.match_at > 33 THEN '…' END,
        substr(m.body, greatest(1, m.match_at - 32), 155),
        CASE WHEN char_length(m.body) >= greatest(1, m.match_at - 32) + 155 THEN '…' END
      )
    ) ORDER BY m.seq DESC), '[]'::jsonb),
    'next_before', CASE WHEN (SELECT count(*) FROM hits) > 20 THEN min(m.seq) END
  ) INTO result
  FROM page m LEFT JOIN public.profiles p ON p.id = m.author_id;
  RETURN result;
END; $$;

CREATE OR REPLACE FUNCTION public.club_chat_context(p_club uuid, p_message uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE
  result jsonb;
BEGIN
  PERFORM club_private.content_member(p_club, true);
  WITH target AS (
    SELECT id, seq FROM public.club_chat_messages
    WHERE id = p_message AND club_id = p_club AND deleted_at IS NULL AND club_private.block_visible(author_id)
  ), context AS (
    SELECT * FROM target
    UNION ALL
    (SELECT m.id, m.seq FROM public.club_chat_messages m
     WHERE m.club_id = p_club AND m.deleted_at IS NULL AND club_private.block_visible(m.author_id) AND m.seq < (SELECT seq FROM target)
     ORDER BY m.seq DESC LIMIT 5)
    UNION ALL
    (SELECT m.id, m.seq FROM public.club_chat_messages m
     WHERE m.club_id = p_club AND m.deleted_at IS NULL AND club_private.block_visible(m.author_id) AND m.seq > (SELECT seq FROM target)
     ORDER BY m.seq LIMIT 5)
  )
  SELECT jsonb_agg(club_private.member_chat_json(p_club,id) ORDER BY seq) INTO result FROM context;
  IF result IS NULL THEN
    RAISE EXCEPTION 'CLUB_CONTENT_UNAVAILABLE' USING ERRCODE = 'P0002';
  END IF;
  RETURN result;
END; $$;

CREATE OR REPLACE FUNCTION public.club_posts_page(p_club uuid,p_before_time timestamptz DEFAULT NULL,p_before_id uuid DEFAULT NULL,
 p_before_pinned boolean DEFAULT NULL,p_limit integer DEFAULT 20) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE u uuid:=club_private.content_member(p_club); items jsonb;
BEGIN
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 20 OR num_nonnulls(p_before_time,p_before_id,p_before_pinned) NOT IN (0,3) THEN RAISE EXCEPTION 'CLUB_CONTENT_INVALID' USING ERRCODE='22023'; END IF;
 SELECT coalesce(jsonb_agg(club_private.member_content_json(p_club,'post',q.id) ORDER BY q.is_pinned DESC,q.created_at DESC,q.id DESC),'[]') INTO items
 FROM (SELECT p.* FROM public.club_posts p WHERE p.club_id=p_club AND p.deleted_at IS NULL AND club_private.block_visible(p.author_id) AND
 (p_before_id IS NULL OR (p.is_pinned,p.created_at,p.id)<(p_before_pinned,p_before_time,p_before_id))
 ORDER BY p.is_pinned DESC,p.created_at DESC,p.id DESC LIMIT p_limit) q;
 RETURN jsonb_build_object('role',club_private.role_for(p_club,u),'items',items);
END; $$;

CREATE OR REPLACE FUNCTION public.club_post_thread(p_club uuid,p_post uuid,p_after_time timestamptz DEFAULT NULL,
 p_after_id uuid DEFAULT NULL,p_limit integer DEFAULT 20) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE u uuid:=club_private.content_member(p_club); item jsonb; comments jsonb;
BEGIN
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 20 OR num_nonnulls(p_after_time,p_after_id) NOT IN (0,2) THEN RAISE EXCEPTION 'CLUB_CONTENT_INVALID' USING ERRCODE='22023'; END IF;
 item := club_private.member_content_json(p_club,'post',p_post);
 IF item IS NULL THEN RAISE EXCEPTION 'CLUB_CONTENT_UNAVAILABLE' USING ERRCODE='P0002'; END IF;
 SELECT coalesce(jsonb_agg(club_private.member_content_json(p_club,'comment',q.id) ORDER BY q.created_at,q.id),'[]') INTO comments
 FROM (SELECT c.* FROM public.club_comments c WHERE c.club_id=p_club AND c.post_id=p_post AND c.deleted_at IS NULL AND club_private.block_visible(c.author_id)
 AND (p_after_id IS NULL OR (c.created_at,c.id)>(p_after_time,p_after_id)) ORDER BY c.created_at,c.id LIMIT p_limit) q;
 RETURN jsonb_build_object('role',club_private.role_for(p_club,u),'post',item,'items',comments);
END; $$;

CREATE OR REPLACE FUNCTION public.club_content_item(p_club uuid,p_kind text,p_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE u uuid:=club_private.content_member(p_club); item jsonb:=club_private.member_content_json(p_club,p_kind,p_id);
BEGIN
 IF item IS NULL OR item->>'club_id' IS DISTINCT FROM p_club::text THEN RAISE EXCEPTION 'CLUB_CONTENT_UNAVAILABLE' USING ERRCODE='P0002'; END IF;
 RETURN item;
END; $$;

CREATE OR REPLACE FUNCTION public.club_content_create(p_club uuid,p_id uuid,p_body text,p_post uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE u uuid:=club_private.content_member(p_club,true); existing_author uuid; existing_club uuid; existing_post uuid;
 target_author uuid; v integer; removed timestamptz; max_len integer:=CASE WHEN p_post IS NULL THEN 4000 ELSE 1500 END;
BEGIN
 IF p_id IS NULL OR p_body IS NULL OR p_body !~ '[^[:space:]]' OR char_length(btrim(p_body)) NOT BETWEEN 1 AND max_len THEN
 RAISE EXCEPTION 'CLUB_CONTENT_INVALID' USING ERRCODE='22023'; END IF;
 IF p_post IS NULL THEN
  INSERT INTO public.club_posts(id,club_id,author_id,body) VALUES(p_id,p_club,u,btrim(p_body)) ON CONFLICT(id) DO NOTHING;
  SELECT author_id,club_id,version,deleted_at INTO existing_author,existing_club,v,removed FROM public.club_posts WHERE id=p_id;
 ELSE
  SELECT author_id INTO target_author FROM public.club_posts WHERE id=p_post AND club_id=p_club AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'CLUB_CONTENT_UNAVAILABLE' USING ERRCODE='P0002'; END IF;
  PERFORM club_private.require_visible_target(u,target_author,'CLUB_CONTENT_UNAVAILABLE','P0002');
  INSERT INTO public.club_comments(id,club_id,post_id,author_id,body) VALUES(p_id,p_club,p_post,u,btrim(p_body)) ON CONFLICT(id) DO NOTHING;
  SELECT author_id,club_id,post_id,version,deleted_at INTO existing_author,existing_club,existing_post,v,removed FROM public.club_comments WHERE id=p_id;
  IF existing_post IS DISTINCT FROM p_post THEN RAISE EXCEPTION 'CLUB_FORBIDDEN' USING ERRCODE='42501'; END IF;
 END IF;
 IF existing_author IS DISTINCT FROM u OR existing_club IS DISTINCT FROM p_club THEN RAISE EXCEPTION 'CLUB_FORBIDDEN' USING ERRCODE='42501'; END IF;
 IF removed IS NOT NULL THEN RAISE EXCEPTION 'CLUB_CONTENT_UNAVAILABLE' USING ERRCODE='P0002'; END IF;
 RETURN jsonb_build_object('id',p_id,'version',v);
END; $$;

-- Only the report resolver may bypass ordinary visibility for removal.
CREATE FUNCTION club_private.change_content(p_club uuid,p_kind text,p_id uuid,p_action text,
 p_body text,p_version integer,p_from_report boolean) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
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

CREATE OR REPLACE FUNCTION public.club_content_change(p_club uuid,p_kind text,p_id uuid,p_action text,
 p_body text DEFAULT NULL,p_version integer DEFAULT NULL) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT club_private.change_content(p_club,p_kind,p_id,p_action,p_body,p_version,false);
$$;

CREATE OR REPLACE FUNCTION public.club_content_resolve(p_club uuid,p_report uuid,p_action text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE u uuid:=club_private.content_member(p_club,true); r club_private.content_reports;
BEGIN
 IF club_private.role_for(p_club,u) NOT IN ('owner','admin') THEN RAISE EXCEPTION 'CLUB_FORBIDDEN' USING ERRCODE='42501'; END IF;
 IF p_action IS NULL OR p_action NOT IN ('remove','dismiss') THEN RAISE EXCEPTION 'CLUB_CONTENT_INVALID' USING ERRCODE='22023'; END IF;
 SELECT * INTO r FROM club_private.content_reports WHERE id=p_report AND club_id=p_club;
 IF r.id IS NULL THEN RAISE EXCEPTION 'CLUB_CONTENT_UNAVAILABLE' USING ERRCODE='P0002'; END IF;
 IF r.status<>'pending' THEN RETURN jsonb_build_object('id',r.id,'status',r.status,'already_handled',true); END IF;
 IF p_action='remove' AND club_private.content_json(r.target_kind,r.target_id) IS NOT NULL THEN
  PERFORM club_private.change_content(p_club,r.target_kind,r.target_id,'delete',NULL,NULL,true);
 END IF;
 UPDATE club_private.content_reports SET status=CASE WHEN p_action='remove' THEN 'removed' ELSE 'dismissed' END,
 resolved_at=clock_timestamp(),moderator_id=u WHERE id=p_report;
 INSERT INTO club_private.content_actions(club_id,actor_id,target_kind,target_id,action,report_id)
 VALUES(p_club,u,r.target_kind,r.target_id,'report_'||p_action,p_report);
 RETURN jsonb_build_object('id',r.id,'status',CASE WHEN p_action='remove' THEN 'removed' ELSE 'dismissed' END,'already_handled',false);
END; $$;

REVOKE ALL ON FUNCTION dm_private.lock_block_pair(uuid,uuid), dm_private.blocked_pair(uuid,uuid),
  dm_private.write_block(uuid,uuid,boolean), club_private.block_visible(uuid),
  club_private.chat_reference_visible(uuid,uuid), club_private.member_chat_json(uuid,uuid,boolean),
  club_private.member_content_json(uuid,text,uuid), club_private.require_visible_target(uuid,uuid,text,text),
  club_private.change_content(uuid,text,uuid,text,text,integer,boolean),
  public.club_block_user(uuid,text,uuid), public.club_unblock_user(uuid), public.club_blocked_users()
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION club_private.block_visible(uuid), club_private.chat_reference_visible(uuid,uuid),
  public.club_block_user(uuid,text,uuid), public.club_unblock_user(uuid), public.club_blocked_users()
  TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
