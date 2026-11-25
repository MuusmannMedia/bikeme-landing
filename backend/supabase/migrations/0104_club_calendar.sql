BEGIN;

CREATE TABLE public.club_calendar_events (
  id uuid PRIMARY KEY,
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) <= 70 AND title ~ '[^[:space:]]'),
  starts_at timestamptz NOT NULL CHECK (isfinite(starts_at)),
  place text NOT NULL CHECK (char_length(place) <= 70 AND place ~ '[^[:space:]]'),
  description text CHECK (char_length(description) <= 280)
);

CREATE INDEX club_calendar_events_day_idx ON public.club_calendar_events (club_id, starts_at, id);

ALTER TABLE public.club_calendar_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.club_calendar_events FROM PUBLIC, anon, authenticated, service_role;
-- The read function runs as the member. Direct reads are subject to the same policy.
GRANT SELECT (id, club_id, title, starts_at, place, description) ON public.club_calendar_events TO authenticated;
CREATE POLICY club_calendar_events_read ON public.club_calendar_events FOR SELECT TO authenticated
  USING (club_private.my_role(club_id) IS NOT NULL);

CREATE FUNCTION public.club_calendar_entries(p_club uuid, p_from timestamptz, p_to timestamptz)
RETURNS TABLE (
  id uuid, kind text, title text, starts_at timestamptz, place text, distance_km double precision, description text
)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = pg_catalog AS $$
BEGIN
  IF club_private.my_role(p_club) IS NULL THEN
    RAISE EXCEPTION 'CLUB_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF p_from IS NULL OR p_to IS NULL OR NOT isfinite(p_from) OR NOT isfinite(p_to)
     OR p_to <= p_from OR p_to - p_from > interval '44 days' THEN
    RAISE EXCEPTION 'CLUB_CALENDAR_RANGE' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
    SELECT r.id, 'ride'::text, r.title::text, r.start_time, r.meeting_address::text,
           r.distance_km::double precision, NULL::text
      FROM public.rides r
      WHERE r.club_id = p_club AND r.club_closed_at IS NULL AND r.status IN ('ACTIVE', 'COMPLETED')
        AND r.start_time >= p_from AND r.start_time < p_to
    UNION ALL
    SELECT e.id, 'event'::text, e.title, e.starts_at, e.place, NULL::double precision, e.description
      FROM public.club_calendar_events e
      WHERE e.club_id = p_club AND e.starts_at >= p_from AND e.starts_at < p_to;
END;
$$;

CREATE FUNCTION public.club_calendar_create_event(
  p_club uuid, p_id uuid, p_title text, p_starts_at timestamptz, p_place text, p_description text
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_title text := btrim(p_title);
  v_place text := btrim(p_place);
  v_description text := nullif(btrim(p_description), '');
BEGIN
  IF v_actor IS NULL OR club_private.my_role(p_club) IS NULL THEN
    RAISE EXCEPTION 'CLUB_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  -- Use the same lock as ride creation and membership changes.
  PERFORM club_private.lock_club(p_club);
  IF club_private.my_role(p_club) IS NULL THEN
    RAISE EXCEPTION 'CLUB_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF p_id IS NULL OR p_starts_at IS NULL OR NOT isfinite(p_starts_at)
     OR v_title IS NULL OR char_length(v_title) > 70 OR v_title !~ '[^[:space:]]'
     OR v_place IS NULL OR char_length(v_place) > 70 OR v_place !~ '[^[:space:]]'
     OR char_length(v_description) > 280 THEN
    RAISE EXCEPTION 'CLUB_CALENDAR_INVALID' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.club_calendar_events (id, club_id, created_by, title, starts_at, place, description)
    VALUES (p_id, p_club, v_actor, v_title, p_starts_at, v_place, v_description)
    ON CONFLICT (id) DO NOTHING;
  IF NOT FOUND AND NOT EXISTS (
    SELECT 1 FROM public.club_calendar_events e
    WHERE e.id = p_id AND e.club_id = p_club AND e.created_by = v_actor
      AND e.title = v_title AND e.starts_at = p_starts_at AND e.place = v_place
      AND e.description IS NOT DISTINCT FROM v_description
  ) THEN
    RAISE EXCEPTION 'CLUB_CALENDAR_CONFLICT' USING ERRCODE = '23505';
  END IF;
  RETURN p_id;
END;
$$;

REVOKE ALL ON FUNCTION public.club_calendar_entries(uuid, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.club_calendar_entries(uuid, timestamptz, timestamptz) TO authenticated;
REVOKE ALL ON FUNCTION public.club_calendar_create_event(uuid, uuid, text, timestamptz, text, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.club_calendar_create_event(uuid, uuid, text, timestamptz, text, text) TO authenticated;

COMMIT;
