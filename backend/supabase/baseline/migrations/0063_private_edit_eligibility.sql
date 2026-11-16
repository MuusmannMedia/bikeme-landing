-- 0063: prevent editing an old message from bypassing current sender access.
BEGIN;
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
  IF dm_private.is_blocked(c) THEN RAISE EXCEPTION 'DM_BLOCKED' USING ERRCODE='PT423'; END IF;
  IF m.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'DM_UNAVAILABLE' USING ERRCODE='P0002'; END IF;
  IF p_body IS NULL OR p_body !~ '[^[:space:]]' OR char_length(btrim(p_body)) NOT BETWEEN 1 AND 1500 THEN RAISE EXCEPTION 'DM_INVALID' USING ERRCODE='22023'; END IF;
  IF m.version=p_version+1 AND m.body=btrim(p_body) THEN RETURN dm_private.message_json(m.id); END IF;
  IF m.version IS DISTINCT FROM p_version THEN RAISE EXCEPTION 'DM_CONFLICT' USING ERRCODE='PT409'; END IF;
  UPDATE dm_private.messages SET body=btrim(p_body),edited_at=clock_timestamp(),version=version+1 WHERE id=p_id;
 ELSE RAISE EXCEPTION 'DM_INVALID' USING ERRCODE='22023'; END IF;
 RETURN jsonb_build_object('id',p_id,'changed',true);
END; $function$
;
NOTIFY pgrst,'reload schema';
COMMIT;
