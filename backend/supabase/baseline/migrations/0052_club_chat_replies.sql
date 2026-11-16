-- Apply separately to existing TEST bcskqapoagflshewvzzc only.
-- References live content, never a client-supplied or persistent quote copy.
BEGIN;
ALTER TABLE public.club_chat_messages ADD COLUMN reply_to_id uuid;
ALTER TABLE public.club_chat_messages ADD CONSTRAINT chat_club_message_unique UNIQUE(club_id,id);
ALTER TABLE public.club_chat_messages ADD CONSTRAINT chat_reply_same_club
 FOREIGN KEY(club_id,reply_to_id) REFERENCES public.club_chat_messages(club_id,id);
ALTER TABLE public.club_chat_messages ADD CONSTRAINT chat_reply_not_self CHECK(reply_to_id IS NULL OR reply_to_id<>id);
CREATE INDEX chat_reply_reference_idx ON public.club_chat_messages(club_id,reply_to_id) WHERE reply_to_id IS NOT NULL;

CREATE FUNCTION club_private.chat_quote(p_club uuid,p_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('id',m.id,'seq',m.seq,'change_seq',m.change_seq,'deleted',m.deleted_at IS NOT NULL,
 'author_id',CASE WHEN m.deleted_at IS NULL THEN m.author_id END,
 'display_name',CASE WHEN m.deleted_at IS NULL THEN a.display_name END,
 'body',CASE WHEN m.deleted_at IS NULL THEN left(m.body,200) END)
 FROM public.club_chat_messages m LEFT JOIN public.profiles a ON a.id=m.author_id
 WHERE m.id=p_id AND m.club_id=p_club;
$$;
CREATE OR REPLACE FUNCTION club_private.chat_json(p_id uuid,p_deleted boolean DEFAULT false) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('kind','chat','id',m.id,'club_id',m.club_id,'post_id',m.id,'seq',m.seq,'change_seq',m.change_seq,
 'author_id',CASE WHEN m.deleted_at IS NULL THEN m.author_id END,'display_name',CASE WHEN m.deleted_at IS NULL THEN a.display_name END,
 'avatar_url',CASE WHEN m.deleted_at IS NULL THEN a.avatar_url END,'body',m.body,'created_at',m.created_at,'edited_at',m.edited_at,
 'version',m.version,'is_pinned',false,'comment_count',0,'deleted_at',m.deleted_at,
 'reply_to_id',CASE WHEN m.deleted_at IS NULL THEN m.reply_to_id END,
 'reply',CASE WHEN m.deleted_at IS NULL AND m.reply_to_id IS NOT NULL THEN club_private.chat_quote(m.club_id,m.reply_to_id) END)
 FROM public.club_chat_messages m LEFT JOIN public.profiles a ON a.id=m.author_id WHERE m.id=p_id AND (p_deleted OR m.deleted_at IS NULL);
$$;
CREATE FUNCTION club_private.chat_reply_refresh() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 -- Touch direct replies only. No quote text is stored, no recursive fan-out.
 -- Existing change cursor/signal machinery refreshes already open clients.
 UPDATE public.club_chat_messages SET change_seq=change_seq
 WHERE club_id=NEW.club_id AND reply_to_id=NEW.id AND deleted_at IS NULL;
 RETURN NULL;
END; $$;
CREATE TRIGGER chat_reply_source_changed AFTER UPDATE OF body,deleted_at,author_id ON public.club_chat_messages
 FOR EACH ROW WHEN (OLD.body IS DISTINCT FROM NEW.body OR OLD.deleted_at IS DISTINCT FROM NEW.deleted_at OR OLD.author_id IS DISTINCT FROM NEW.author_id)
 EXECUTE FUNCTION club_private.chat_reply_refresh();

-- Mandatory fourth argument avoids ambiguous defaults with the existing RPC.
CREATE FUNCTION public.club_chat_send(p_club uuid,p_id uuid,p_body text,p_reply_to uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE u uuid:=club_private.content_member(p_club,true); m public.club_chat_messages;
BEGIN
 IF p_id IS NULL OR p_id=p_reply_to OR p_body IS NULL OR p_body !~ '[^[:space:]]' OR char_length(btrim(p_body)) NOT BETWEEN 1 AND 1500 THEN
  RAISE EXCEPTION 'CLUB_CONTENT_INVALID' USING ERRCODE='22023'; END IF;
 SELECT * INTO m FROM public.club_chat_messages WHERE id=p_id;
 IF m.id IS NULL THEN
  IF p_reply_to IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.club_chat_messages WHERE id=p_reply_to AND club_id=p_club AND deleted_at IS NULL) THEN
   RAISE EXCEPTION 'CLUB_CHAT_REPLY_UNAVAILABLE' USING ERRCODE='PT410'; END IF;
  INSERT INTO public.club_chat_messages(id,club_id,author_id,body,reply_to_id)
  VALUES(p_id,p_club,u,btrim(p_body),p_reply_to) ON CONFLICT(id) DO NOTHING;
  SELECT * INTO m FROM public.club_chat_messages WHERE id=p_id;
 END IF;
 IF m.club_id IS DISTINCT FROM p_club OR m.author_id IS DISTINCT FROM u THEN RAISE EXCEPTION 'CLUB_FORBIDDEN' USING ERRCODE='42501'; END IF;
 IF m.reply_to_id IS DISTINCT FROM p_reply_to THEN RAISE EXCEPTION 'CLUB_CONTENT_CONFLICT' USING ERRCODE='PT409'; END IF;
 IF m.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'CLUB_CONTENT_UNAVAILABLE' USING ERRCODE='P0002'; END IF;
 -- A saved reply remains idempotent even if its original was deleted later.
 RETURN club_private.chat_json(m.id);
END; $$;
CREATE OR REPLACE FUNCTION public.club_chat_send(p_club uuid,p_id uuid,p_body text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN RETURN public.club_chat_send(p_club,p_id,p_body,NULL::uuid); END; $$;
CREATE FUNCTION public.club_chat_message(p_club uuid,p_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE u uuid:=club_private.content_member(p_club,true);
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.club_chat_messages WHERE id=p_id AND club_id=p_club) THEN
  RAISE EXCEPTION 'CLUB_CONTENT_UNAVAILABLE' USING ERRCODE='P0002'; END IF;
 RETURN club_private.chat_json(p_id,true);
END; $$;
REVOKE ALL ON FUNCTION club_private.chat_quote(uuid,uuid),club_private.chat_reply_refresh() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.club_chat_send(uuid,uuid,text,uuid),public.club_chat_message(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.club_chat_send(uuid,uuid,text,uuid),public.club_chat_message(uuid,uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
