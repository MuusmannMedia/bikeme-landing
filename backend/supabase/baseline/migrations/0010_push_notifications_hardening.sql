-- Harden push token registration and lock down notification logs for client roles.

CREATE OR REPLACE FUNCTION public.upsert_push_token(
  p_expo_push_token TEXT,
  p_platform TEXT DEFAULT NULL,
  p_device_id TEXT DEFAULT NULL,
  p_last_seen_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_expo_push_token IS NULL OR length(trim(p_expo_push_token)) = 0 THEN
    RAISE EXCEPTION 'expo_push_token is required';
  END IF;

  INSERT INTO public.push_tokens (
    user_id,
    expo_push_token,
    platform,
    device_id,
    is_active,
    last_seen_at
  )
  VALUES (
    v_user_id,
    trim(p_expo_push_token),
    p_platform,
    p_device_id,
    TRUE,
    COALESCE(p_last_seen_at, NOW())
  )
  ON CONFLICT (expo_push_token)
  DO UPDATE SET
    user_id = EXCLUDED.user_id,
    platform = EXCLUDED.platform,
    device_id = EXCLUDED.device_id,
    is_active = TRUE,
    last_seen_at = EXCLUDED.last_seen_at;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_push_token(TEXT, TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_push_token(TEXT, TEXT, TEXT, TIMESTAMPTZ) TO authenticated;

ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.notification_log FROM anon, authenticated;
