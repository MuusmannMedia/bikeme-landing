-- Optional local wall-clock preference for ride interest requests.
-- Existing requests remain valid without a preferred time.

BEGIN;

ALTER TABLE public.ride_interest_requests
  ADD COLUMN preferred_time TIME WITHOUT TIME ZONE NULL;

COMMENT ON COLUMN public.ride_interest_requests.preferred_time IS
  'Optional local wall-clock preference interpreted with the existing timezone; not an absolute UTC timestamp.';

-- Replace the old signature instead of leaving an ambiguous RPC overload.
DROP FUNCTION public.create_ride_interest_request(UUID, UUID, UUID, TEXT, DATE, TEXT);

CREATE FUNCTION public.create_ride_interest_request(
  p_sender_user_id UUID,
  p_recipient_user_id UUID,
  p_idempotency_key UUID,
  p_time_option TEXT,
  p_custom_date DATE,
  p_timezone TEXT,
  p_preferred_time TIME WITHOUT TIME ZONE DEFAULT NULL
)
RETURNS public.ride_interest_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_now TIMESTAMPTZ;
  v_time_option TEXT := btrim(p_time_option);
  v_timezone TEXT := btrim(p_timezone);
  v_local_today DATE;
  v_local_today_after_lock DATE;
  v_iso_day INTEGER;
  v_window_start_date DATE;
  v_window_end_date DATE;
  v_expires_at TIMESTAMPTZ;
  v_connection_id UUID;
  v_profile_id UUID;
  v_profile_count INTEGER := 0;
  v_rate_count BIGINT;
  v_existing_request public.ride_interest_requests;
  v_created_request public.ride_interest_requests;
BEGIN
  IF p_sender_user_id IS NULL
     OR p_recipient_user_id IS NULL
     OR p_idempotency_key IS NULL
     OR p_sender_user_id = p_recipient_user_id THEN
    RAISE EXCEPTION 'INVALID_INPUT';
  END IF;

  IF v_time_option IS NULL
     OR v_time_option NOT IN ('today', 'tomorrow', 'this_weekend', 'custom_date') THEN
    RAISE EXCEPTION 'INVALID_INPUT';
  END IF;

  IF v_timezone IS NULL
     OR char_length(v_timezone) = 0
     OR char_length(v_timezone) > 100
     OR NOT EXISTS (
       SELECT 1
       FROM pg_catalog.pg_timezone_names timezone_name
       WHERE timezone_name.name = v_timezone
     ) THEN
    RAISE EXCEPTION 'INVALID_INPUT';
  END IF;

  IF v_time_option = 'custom_date' THEN
    IF p_custom_date IS NULL THEN
      RAISE EXCEPTION 'INVALID_INPUT';
    END IF;
  ELSIF p_custom_date IS NOT NULL THEN
    RAISE EXCEPTION 'INVALID_INPUT';
  END IF;

  -- Serialize every send for one sender so concurrent requests cannot bypass
  -- rate limits or sender-scoped idempotency.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'ride_interest_sender_rate:' || p_sender_user_id::TEXT,
      0::BIGINT
    )
  );

  -- Check stable client intent before resolving a time-relative date window.
  -- This lets a legitimate retry crossing local midnight return the original
  -- request rather than resolving a different date.
  SELECT request_row.*
  INTO v_existing_request
  FROM public.ride_interest_requests request_row
  WHERE request_row.sender_user_id = p_sender_user_id
    AND request_row.idempotency_key = p_idempotency_key
  FOR SHARE;

  IF FOUND THEN
    IF v_existing_request.recipient_user_id <> p_recipient_user_id
       OR v_existing_request.time_option <> v_time_option
       OR v_existing_request.timezone <> v_timezone
       OR v_existing_request.preferred_time IS DISTINCT FROM p_preferred_time
       OR (
         v_time_option = 'custom_date'
         AND (
           v_existing_request.window_start_date <> p_custom_date
           OR v_existing_request.window_end_date <> p_custom_date
         )
       ) THEN
      RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT';
    END IF;

    RETURN v_existing_request;
  END IF;

  -- Lock both profile rows in deterministic UUID order before locking the
  -- connection row. This prevents profile-cascade/connection lock inversion.
  FOR v_profile_id IN
    SELECT profile.id
    FROM public.profiles profile
    WHERE profile.id IN (p_sender_user_id, p_recipient_user_id)
    ORDER BY profile.id
    FOR KEY SHARE
  LOOP
    v_profile_count := v_profile_count + 1;
  END LOOP;

  IF v_profile_count <> 2 THEN
    RAISE EXCEPTION 'RIDER_NOT_FOUND';
  END IF;

  SELECT connection.id
  INTO v_connection_id
  FROM public.rider_connections connection
  WHERE connection.status = 'accepted'
    AND (
      (
        connection.requester_id = p_sender_user_id
        AND connection.receiver_id = p_recipient_user_id
      )
      OR (
        connection.requester_id = p_recipient_user_id
        AND connection.receiver_id = p_sender_user_id
      )
    )
  LIMIT 1
  FOR SHARE;

  IF v_connection_id IS NULL THEN
    RAISE EXCEPTION 'CONNECTION_NOT_ACCEPTED';
  END IF;

  v_now := clock_timestamp();

  SELECT COUNT(*)
  INTO v_rate_count
  FROM public.ride_interest_requests request_row
  WHERE request_row.sender_user_id = p_sender_user_id
    AND request_row.created_at > v_now - INTERVAL '24 hours';

  IF v_rate_count >= 10 THEN
    RAISE EXCEPTION 'REQUEST_RATE_LIMITED';
  END IF;

  -- Serialize sends against a simultaneous decline for this directional pair,
  -- so a committed decline cannot be bypassed by a racing request.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'ride_interest_recipient_cooldown:'
        || p_sender_user_id::TEXT || ':'
        || p_recipient_user_id::TEXT,
      0::BIGINT
    )
  );

  v_now := clock_timestamp();

  IF EXISTS (
    SELECT 1
    FROM public.ride_interest_requests request_row
    WHERE request_row.sender_user_id = p_sender_user_id
      AND request_row.recipient_user_id = p_recipient_user_id
      AND request_row.response_status = 'declined'
      AND request_row.responded_at > v_now - INTERVAL '24 hours'
  ) THEN
    RAISE EXCEPTION 'RECIPIENT_COOLDOWN';
  END IF;

  -- Resolve and lock the authoritative window. Transaction advisory locks are
  -- retained, so if local midnight passes while waiting the loop safely takes
  -- the newly correct window lock before continuing.
  LOOP
    v_now := clock_timestamp();
    v_local_today := (v_now AT TIME ZONE v_timezone)::DATE;

    CASE v_time_option
      WHEN 'today' THEN
        v_window_start_date := v_local_today;
        v_window_end_date := v_local_today;
      WHEN 'tomorrow' THEN
        v_window_start_date := v_local_today + 1;
        v_window_end_date := v_window_start_date;
      WHEN 'this_weekend' THEN
        v_iso_day := EXTRACT(ISODOW FROM v_local_today)::INTEGER;
        IF v_iso_day BETWEEN 1 AND 5 THEN
          v_window_start_date := v_local_today + (6 - v_iso_day);
          v_window_end_date := v_window_start_date + 1;
        ELSIF v_iso_day = 6 THEN
          v_window_start_date := v_local_today;
          v_window_end_date := v_local_today + 1;
        ELSE
          v_window_start_date := v_local_today;
          v_window_end_date := v_local_today;
        END IF;
      WHEN 'custom_date' THEN
        v_window_start_date := p_custom_date;
        v_window_end_date := p_custom_date;
      ELSE
        RAISE EXCEPTION 'INVALID_INPUT';
    END CASE;

    IF v_window_start_date < v_local_today THEN
      RAISE EXCEPTION 'INVALID_INPUT';
    END IF;

    IF v_time_option = 'custom_date'
       AND v_window_start_date > v_local_today + 90 THEN
      RAISE EXCEPTION 'INVALID_INPUT';
    END IF;

    v_expires_at := ((v_window_end_date + 1)::TIMESTAMP AT TIME ZONE v_timezone);

    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        'ride_interest_duplicate:'
          || p_sender_user_id::TEXT || ':'
          || p_recipient_user_id::TEXT || ':'
          || v_window_start_date::TEXT || ':'
          || v_window_end_date::TEXT,
        0::BIGINT
      )
    );

    v_now := clock_timestamp();
    v_local_today_after_lock := (v_now AT TIME ZONE v_timezone)::DATE;
    IF v_local_today_after_lock <> v_local_today THEN
      CONTINUE;
    END IF;

    IF v_expires_at <= v_now THEN
      RAISE EXCEPTION 'INVALID_INPUT';
    END IF;

    EXIT;
  END LOOP;

  IF EXISTS (
    SELECT 1
    FROM public.ride_interest_requests request_row
    WHERE request_row.sender_user_id = p_sender_user_id
      AND request_row.recipient_user_id = p_recipient_user_id
      AND request_row.window_start_date = v_window_start_date
      AND request_row.window_end_date = v_window_end_date
      AND request_row.response_status = 'pending'
      AND request_row.expires_at > v_now
  ) THEN
    RAISE EXCEPTION 'REQUEST_DUPLICATE';
  END IF;

  INSERT INTO public.ride_interest_requests (
    sender_user_id,
    recipient_user_id,
    idempotency_key,
    time_option,
    window_start_date,
    window_end_date,
    timezone,
    preferred_time,
    response_status,
    expires_at,
    created_at,
    updated_at
  )
  VALUES (
    p_sender_user_id,
    p_recipient_user_id,
    p_idempotency_key,
    v_time_option,
    v_window_start_date,
    v_window_end_date,
    v_timezone,
    p_preferred_time,
    'pending',
    v_expires_at,
    v_now,
    v_now
  )
  RETURNING * INTO v_created_request;

  RETURN v_created_request;
END;
$$;

REVOKE ALL ON FUNCTION public.create_ride_interest_request(
  UUID,
  UUID,
  UUID,
  TEXT,
  DATE,
  TEXT,
  TIME WITHOUT TIME ZONE
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_ride_interest_request(
  UUID,
  UUID,
  UUID,
  TEXT,
  DATE,
  TEXT,
  TIME WITHOUT TIME ZONE
) FROM anon;
REVOKE ALL ON FUNCTION public.create_ride_interest_request(
  UUID,
  UUID,
  UUID,
  TEXT,
  DATE,
  TEXT,
  TIME WITHOUT TIME ZONE
) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_ride_interest_request(
  UUID,
  UUID,
  UUID,
  TEXT,
  DATE,
  TEXT,
  TIME WITHOUT TIME ZONE
) TO service_role;

COMMIT;
