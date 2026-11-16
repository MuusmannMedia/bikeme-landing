BEGIN;

-- Keep support cases independent of the club, including when an owner dissolves it.
CREATE TABLE club_private.bike_me_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL,
  target_kind text NOT NULL CHECK (target_kind IN ('post', 'comment', 'chat')),
  target_id uuid NOT NULL,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  reason text NOT NULL CHECK (reason IN ('spam', 'harassment', 'unsafe', 'other')),
  detail text NOT NULL CHECK (char_length(detail) <= 500),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'removed', 'dismissed')),
  resolved_at timestamptz,
  operator_label text,
  resolution text,
  UNIQUE (club_id, target_kind, target_id, reporter_id)
);
CREATE INDEX bike_me_reports_pending_idx ON club_private.bike_me_reports(created_at, id) WHERE status = 'pending';
CREATE INDEX bike_me_reports_author_idx ON club_private.bike_me_reports(author_id);
CREATE INDEX bike_me_reports_reporter_idx ON club_private.bike_me_reports(reporter_id);
ALTER TABLE club_private.bike_me_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON club_private.bike_me_reports FROM PUBLIC, anon, authenticated, service_role;

-- Match account erasure for the existing support queues. The foreign key
-- also scrubs reports about content that disappeared with a dissolved club.
CREATE FUNCTION club_private.scrub_bike_me_report() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  NEW.body := '';
  NEW.detail := '';
  NEW.resolution := NULL;
  RETURN NEW;
END;
$$;
CREATE TRIGGER scrub_bike_me_report BEFORE UPDATE OF author_id ON club_private.bike_me_reports
FOR EACH ROW WHEN (OLD.author_id IS NOT NULL AND NEW.author_id IS NULL)
EXECUTE FUNCTION club_private.scrub_bike_me_report();

CREATE FUNCTION public.club_report_to_bike_me(
  p_club uuid, p_kind text, p_id uuid, p_reason text, p_detail text DEFAULT ''
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
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
  PERFORM 1 FROM public.clubs WHERE id = p_club FOR UPDATE;
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
$$;

CREATE FUNCTION public.club_support_reports(
  p_before_time timestamptz DEFAULT NULL, p_before_id uuid DEFAULT NULL, p_limit integer DEFAULT 20
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 20 OR num_nonnulls(p_before_time, p_before_id) NOT IN (0, 2) THEN
    RAISE EXCEPTION 'CLUB_CONTENT_INVALID' USING ERRCODE = '22023';
  END IF;
  RETURN (
    SELECT coalesce(jsonb_agg(to_jsonb(page) ORDER BY page.created_at, page.id), '[]')
    FROM (
      SELECT * FROM club_private.bike_me_reports
      WHERE status = 'pending' AND (p_before_id IS NULL OR (created_at, id) > (p_before_time, p_before_id))
      ORDER BY created_at, id LIMIT p_limit
    ) page
  );
END;
$$;

CREATE FUNCTION public.club_support_resolve(p_report uuid, p_action text, p_operator text, p_note text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
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
  PERFORM 1 FROM public.clubs WHERE id = report.club_id FOR UPDATE;
  SELECT * INTO report FROM club_private.bike_me_reports WHERE id = p_report FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CLUB_CONTENT_UNAVAILABLE' USING ERRCODE = 'P0002'; END IF;
  IF report.status <> 'pending' THEN
    RETURN jsonb_build_object('id', report.id, 'status', report.status, 'already_handled', true);
  END IF;

  IF p_action = 'remove' THEN
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

  UPDATE club_private.bike_me_reports
  SET status = CASE WHEN p_action = 'remove' THEN 'removed' ELSE 'dismissed' END,
      resolved_at = stamp, operator_label = btrim(p_operator), resolution = btrim(p_note)
  WHERE id = p_report
  RETURNING * INTO report;
  RETURN jsonb_build_object('id', report.id, 'status', report.status, 'already_handled', false);
END;
$$;

REVOKE ALL ON FUNCTION club_private.scrub_bike_me_report(), public.club_report_to_bike_me(uuid, text, uuid, text, text),
  public.club_support_reports(timestamptz, uuid, integer), public.club_support_resolve(uuid, text, text, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.club_report_to_bike_me(uuid, text, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.club_support_reports(timestamptz, uuid, integer),
  public.club_support_resolve(uuid, text, text, text) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
