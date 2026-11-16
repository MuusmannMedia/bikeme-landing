-- Search and contextual history for the shared club chat.
BEGIN;

CREATE FUNCTION public.club_chat_search(p_club uuid, p_query text, p_before bigint DEFAULT NULL)
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
    WHERE m.club_id = p_club AND m.deleted_at IS NULL
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

CREATE FUNCTION public.club_chat_context(p_club uuid, p_message uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE
  result jsonb;
BEGIN
  PERFORM club_private.content_member(p_club, true);
  WITH target AS (
    SELECT id, seq FROM public.club_chat_messages
    WHERE id = p_message AND club_id = p_club AND deleted_at IS NULL
  ), context AS (
    SELECT * FROM target
    UNION ALL
    (SELECT m.id, m.seq FROM public.club_chat_messages m
     WHERE m.club_id = p_club AND m.deleted_at IS NULL AND m.seq < (SELECT seq FROM target)
     ORDER BY m.seq DESC LIMIT 5)
    UNION ALL
    (SELECT m.id, m.seq FROM public.club_chat_messages m
     WHERE m.club_id = p_club AND m.deleted_at IS NULL AND m.seq > (SELECT seq FROM target)
     ORDER BY m.seq LIMIT 5)
  )
  SELECT jsonb_agg(club_private.chat_json(id) ORDER BY seq) INTO result FROM context;
  IF result IS NULL THEN
    RAISE EXCEPTION 'CLUB_CONTENT_UNAVAILABLE' USING ERRCODE = 'P0002';
  END IF;
  RETURN result;
END; $$;

REVOKE ALL ON FUNCTION public.club_chat_search(uuid,text,bigint), public.club_chat_context(uuid,uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.club_chat_search(uuid,text,bigint), public.club_chat_context(uuid,uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
