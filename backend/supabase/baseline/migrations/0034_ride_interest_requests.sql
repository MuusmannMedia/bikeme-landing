-- One-to-one ride interest requests between accepted rider connections.
-- Mutations are service-only and must go through the atomic RPCs below.
-- Account deletion intentionally removes request and notification history.
-- These rows are not a permanent audit ledger, and deleted requests no longer
-- contribute to historical rate-limit counting.

BEGIN;

CREATE TABLE public.ride_interest_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  idempotency_key UUID NOT NULL,
  time_option TEXT NOT NULL,
  window_start_date DATE NOT NULL,
  window_end_date DATE NOT NULL,
  timezone TEXT NOT NULL,
  response_status TEXT NOT NULL DEFAULT 'pending',
  responded_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ride_interest_requests_sender_recipient_check
    CHECK (sender_user_id <> recipient_user_id),
  CONSTRAINT ride_interest_requests_time_option_check
    CHECK (time_option IN ('today', 'tomorrow', 'this_weekend', 'custom_date')),
  CONSTRAINT ride_interest_requests_response_status_check
    CHECK (response_status IN ('pending', 'interested', 'maybe', 'declined', 'cancelled')),
  CONSTRAINT ride_interest_requests_window_order_check
    CHECK (window_end_date >= window_start_date),
  CONSTRAINT ride_interest_requests_window_shape_check
    CHECK (
      (
        time_option IN ('today', 'tomorrow', 'custom_date')
        AND window_start_date = window_end_date
      )
      OR (
        time_option = 'this_weekend'
        AND (window_end_date - window_start_date) BETWEEN 0 AND 1
      )
    ),
  CONSTRAINT ride_interest_requests_timezone_length_check
    CHECK (char_length(trim(timezone)) BETWEEN 1 AND 100),
  CONSTRAINT ride_interest_requests_lifecycle_check
    CHECK (
      (
        response_status = 'pending'
        AND responded_at IS NULL
        AND cancelled_at IS NULL
      )
      OR (
        response_status IN ('interested', 'maybe', 'declined')
        AND responded_at IS NOT NULL
        AND responded_at >= created_at
        AND responded_at < expires_at
        AND cancelled_at IS NULL
      )
      OR (
        response_status = 'cancelled'
        AND responded_at IS NULL
        AND cancelled_at IS NOT NULL
        AND cancelled_at >= created_at
        AND cancelled_at < expires_at
      )
    ),
  CONSTRAINT ride_interest_requests_expiration_check
    CHECK (expires_at > created_at),
  CONSTRAINT ride_interest_requests_updated_at_check
    CHECK (updated_at >= created_at)
);

CREATE INDEX idx_ride_interest_requests_sender_created_at
  ON public.ride_interest_requests(sender_user_id, created_at DESC);

CREATE INDEX idx_ride_interest_requests_recipient_status_created_at
  ON public.ride_interest_requests(recipient_user_id, response_status, created_at DESC);

CREATE INDEX idx_ride_interest_requests_pending_expires_at
  ON public.ride_interest_requests(expires_at)
  WHERE response_status = 'pending';

CREATE INDEX idx_ride_interest_requests_sender_recipient_window
  ON public.ride_interest_requests(
    sender_user_id,
    recipient_user_id,
    window_start_date,
    window_end_date
  );

CREATE UNIQUE INDEX idx_ride_interest_requests_sender_idempotency
  ON public.ride_interest_requests(sender_user_id, idempotency_key);

-- All service-role request creation must use create_ride_interest_request().
-- Direct inserts bypass the advisory-lock-backed active-duplicate invariant.

DROP TRIGGER IF EXISTS set_ride_interest_requests_updated_at ON public.ride_interest_requests;
CREATE TRIGGER set_ride_interest_requests_updated_at
  BEFORE UPDATE ON public.ride_interest_requests
  FOR EACH ROW
  WHEN (NEW.updated_at IS NOT DISTINCT FROM OLD.updated_at)
  EXECUTE PROCEDURE public.set_updated_at();

ALTER TABLE public.ride_interest_requests ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.ride_interest_requests FROM PUBLIC;
REVOKE ALL ON TABLE public.ride_interest_requests FROM anon;
REVOKE ALL ON TABLE public.ride_interest_requests FROM authenticated;
GRANT SELECT ON TABLE public.ride_interest_requests TO authenticated;
GRANT ALL ON TABLE public.ride_interest_requests TO service_role;

DROP POLICY IF EXISTS "Participants can read their ride interest requests"
  ON public.ride_interest_requests;
CREATE POLICY "Participants can read their ride interest requests"
  ON public.ride_interest_requests
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = sender_user_id
    OR auth.uid() = recipient_user_id
  );

ALTER TABLE public.notification_log
  ALTER COLUMN ride_id DROP NOT NULL;

ALTER TABLE public.notification_log
  ADD COLUMN ride_interest_request_id UUID;

ALTER TABLE public.notification_log
  ADD COLUMN delivery_claimed_at TIMESTAMPTZ,
  ADD COLUMN delivery_claim_id UUID;

ALTER TABLE public.notification_log
  ADD CONSTRAINT notification_log_delivery_claim_check
  CHECK (
    (
      delivery_claimed_at IS NULL
      AND delivery_claim_id IS NULL
    )
    OR (
      delivery_claimed_at IS NOT NULL
      AND delivery_claim_id IS NOT NULL
      AND status IN ('queued', 'error')
    )
  );

ALTER TABLE public.notification_log
  ADD CONSTRAINT notification_log_ride_interest_request_id_fkey
  FOREIGN KEY (ride_interest_request_id)
  REFERENCES public.ride_interest_requests(id)
  ON DELETE CASCADE;

CREATE INDEX idx_notification_log_ride_interest_request_id
  ON public.notification_log(ride_interest_request_id)
  WHERE ride_interest_request_id IS NOT NULL;

ALTER TABLE public.notification_log
  ADD CONSTRAINT notification_log_exactly_one_subject_check
  CHECK (num_nonnulls(ride_id, ride_interest_request_id) = 1)
  NOT VALID;

ALTER TABLE public.notification_log
  VALIDATE CONSTRAINT notification_log_exactly_one_subject_check;

CREATE OR REPLACE FUNCTION public.create_ride_interest_request(
  p_sender_user_id UUID,
  p_recipient_user_id UUID,
  p_idempotency_key UUID,
  p_time_option TEXT,
  p_custom_date DATE,
  p_timezone TEXT
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
    'pending',
    v_expires_at,
    v_now,
    v_now
  )
  RETURNING * INTO v_created_request;

  RETURN v_created_request;
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_ride_interest_request(
  p_recipient_user_id UUID,
  p_request_id UUID,
  p_response_status TEXT
)
RETURNS public.ride_interest_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_now TIMESTAMPTZ;
  v_response_status TEXT := btrim(p_response_status);
  v_existing_request public.ride_interest_requests;
  v_updated_request public.ride_interest_requests;
  v_connection_id UUID;
  v_profile_id UUID;
  v_profile_count INTEGER := 0;
BEGIN
  IF p_recipient_user_id IS NULL OR p_request_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_INPUT';
  END IF;

  IF v_response_status IS NULL
     OR v_response_status NOT IN ('interested', 'maybe', 'declined') THEN
    RAISE EXCEPTION 'INVALID_INPUT';
  END IF;

  SELECT request_row.*
  INTO v_existing_request
  FROM public.ride_interest_requests request_row
  WHERE request_row.id = p_request_id;

  v_now := clock_timestamp();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'REQUEST_NOT_FOUND';
  END IF;

  IF v_existing_request.recipient_user_id <> p_recipient_user_id THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  IF v_existing_request.response_status = 'cancelled'
     OR v_existing_request.cancelled_at IS NOT NULL THEN
    RAISE EXCEPTION 'REQUEST_ALREADY_CANCELLED';
  END IF;

  IF v_existing_request.response_status <> 'pending'
     OR v_existing_request.responded_at IS NOT NULL THEN
    RAISE EXCEPTION 'REQUEST_ALREADY_RESPONDED';
  END IF;

  IF v_existing_request.expires_at <= v_now THEN
    RAISE EXCEPTION 'REQUEST_EXPIRED';
  END IF;

  -- Match create's deterministic profile-lock prefix so account-deletion
  -- cascades cannot invert the later connection/request lock order.
  FOR v_profile_id IN
    SELECT profile.id
    FROM public.profiles profile
    WHERE profile.id IN (
      v_existing_request.sender_user_id,
      v_existing_request.recipient_user_id
    )
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
        connection.requester_id = v_existing_request.sender_user_id
        AND connection.receiver_id = v_existing_request.recipient_user_id
      )
      OR (
        connection.requester_id = v_existing_request.recipient_user_id
        AND connection.receiver_id = v_existing_request.sender_user_id
      )
    )
  LIMIT 1
  FOR SHARE;

  IF v_connection_id IS NULL THEN
    RAISE EXCEPTION 'CONNECTION_NOT_ACCEPTED';
  END IF;

  IF v_response_status = 'declined' THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        'ride_interest_recipient_cooldown:'
          || v_existing_request.sender_user_id::TEXT || ':'
          || v_existing_request.recipient_user_id::TEXT,
        0::BIGINT
      )
    );
  END IF;

  -- Lock and re-read the request after every potentially blocking eligibility
  -- lock, then classify expiry and stamp the mutation from a fresh clock.
  SELECT request_row.*
  INTO v_existing_request
  FROM public.ride_interest_requests request_row
  WHERE request_row.id = p_request_id
  FOR UPDATE;

  v_now := clock_timestamp();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'REQUEST_NOT_FOUND';
  ELSIF v_existing_request.recipient_user_id <> p_recipient_user_id THEN
    RAISE EXCEPTION 'FORBIDDEN';
  ELSIF v_existing_request.response_status = 'cancelled'
        OR v_existing_request.cancelled_at IS NOT NULL THEN
    RAISE EXCEPTION 'REQUEST_ALREADY_CANCELLED';
  ELSIF v_existing_request.response_status <> 'pending'
        OR v_existing_request.responded_at IS NOT NULL THEN
    RAISE EXCEPTION 'REQUEST_ALREADY_RESPONDED';
  ELSIF v_existing_request.expires_at <= v_now THEN
    RAISE EXCEPTION 'REQUEST_EXPIRED';
  END IF;

  v_now := clock_timestamp();

  UPDATE public.ride_interest_requests request_row
  SET
    response_status = v_response_status,
    responded_at = v_now,
    cancelled_at = NULL,
    updated_at = v_now
  WHERE request_row.id = p_request_id
    AND request_row.recipient_user_id = p_recipient_user_id
    AND request_row.response_status = 'pending'
    AND request_row.responded_at IS NULL
    AND request_row.cancelled_at IS NULL
    AND request_row.expires_at > v_now
  RETURNING request_row.* INTO v_updated_request;

  IF FOUND THEN
    RETURN v_updated_request;
  END IF;

  v_now := clock_timestamp();

  SELECT request_row.*
  INTO v_existing_request
  FROM public.ride_interest_requests request_row
  WHERE request_row.id = p_request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'REQUEST_NOT_FOUND';
  ELSIF v_existing_request.recipient_user_id <> p_recipient_user_id THEN
    RAISE EXCEPTION 'FORBIDDEN';
  ELSIF v_existing_request.response_status = 'cancelled'
        OR v_existing_request.cancelled_at IS NOT NULL THEN
    RAISE EXCEPTION 'REQUEST_ALREADY_CANCELLED';
  ELSIF v_existing_request.response_status <> 'pending'
        OR v_existing_request.responded_at IS NOT NULL THEN
    RAISE EXCEPTION 'REQUEST_ALREADY_RESPONDED';
  ELSIF v_existing_request.expires_at <= v_now THEN
    RAISE EXCEPTION 'REQUEST_EXPIRED';
  END IF;

  RAISE EXCEPTION 'INTERNAL_ERROR';
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_ride_interest_request(
  p_sender_user_id UUID,
  p_request_id UUID
)
RETURNS public.ride_interest_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_now TIMESTAMPTZ;
  v_existing_request public.ride_interest_requests;
  v_updated_request public.ride_interest_requests;
BEGIN
  IF p_sender_user_id IS NULL OR p_request_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_INPUT';
  END IF;

  SELECT request_row.*
  INTO v_existing_request
  FROM public.ride_interest_requests request_row
  WHERE request_row.id = p_request_id
  FOR UPDATE;

  v_now := clock_timestamp();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'REQUEST_NOT_FOUND';
  END IF;

  IF v_existing_request.sender_user_id <> p_sender_user_id THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  IF v_existing_request.response_status = 'cancelled'
     OR v_existing_request.cancelled_at IS NOT NULL THEN
    RAISE EXCEPTION 'REQUEST_ALREADY_CANCELLED';
  END IF;

  IF v_existing_request.response_status <> 'pending'
     OR v_existing_request.responded_at IS NOT NULL THEN
    RAISE EXCEPTION 'REQUEST_ALREADY_RESPONDED';
  END IF;

  IF v_existing_request.expires_at <= v_now THEN
    RAISE EXCEPTION 'REQUEST_EXPIRED';
  END IF;

  v_now := clock_timestamp();

  UPDATE public.ride_interest_requests request_row
  SET
    response_status = 'cancelled',
    cancelled_at = v_now,
    responded_at = NULL,
    updated_at = v_now
  WHERE request_row.id = p_request_id
    AND request_row.sender_user_id = p_sender_user_id
    AND request_row.response_status = 'pending'
    AND request_row.responded_at IS NULL
    AND request_row.cancelled_at IS NULL
    AND request_row.expires_at > v_now
  RETURNING request_row.* INTO v_updated_request;

  IF FOUND THEN
    RETURN v_updated_request;
  END IF;

  v_now := clock_timestamp();

  SELECT request_row.*
  INTO v_existing_request
  FROM public.ride_interest_requests request_row
  WHERE request_row.id = p_request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'REQUEST_NOT_FOUND';
  ELSIF v_existing_request.sender_user_id <> p_sender_user_id THEN
    RAISE EXCEPTION 'FORBIDDEN';
  ELSIF v_existing_request.response_status = 'cancelled'
        OR v_existing_request.cancelled_at IS NOT NULL THEN
    RAISE EXCEPTION 'REQUEST_ALREADY_CANCELLED';
  ELSIF v_existing_request.response_status <> 'pending'
        OR v_existing_request.responded_at IS NOT NULL THEN
    RAISE EXCEPTION 'REQUEST_ALREADY_RESPONDED';
  ELSIF v_existing_request.expires_at <= v_now THEN
    RAISE EXCEPTION 'REQUEST_EXPIRED';
  END IF;

  RAISE EXCEPTION 'INTERNAL_ERROR';
END;
$$;

REVOKE ALL ON FUNCTION public.create_ride_interest_request(UUID, UUID, UUID, TEXT, DATE, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_ride_interest_request(UUID, UUID, UUID, TEXT, DATE, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.create_ride_interest_request(UUID, UUID, UUID, TEXT, DATE, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_ride_interest_request(UUID, UUID, UUID, TEXT, DATE, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.respond_ride_interest_request(UUID, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.respond_ride_interest_request(UUID, UUID, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.respond_ride_interest_request(UUID, UUID, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.respond_ride_interest_request(UUID, UUID, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.cancel_ride_interest_request(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_ride_interest_request(UUID, UUID) FROM anon;
REVOKE ALL ON FUNCTION public.cancel_ride_interest_request(UUID, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_ride_interest_request(UUID, UUID) TO service_role;

COMMIT;
