-- Nearby ride notification settings and notification log deduplication support.

BEGIN;

CREATE TABLE IF NOT EXISTS public.user_notification_settings (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  nearby_rides_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  nearby_rides_radius_km INTEGER NOT NULL DEFAULT 10,
  nearby_rides_latitude DOUBLE PRECISION,
  nearby_rides_longitude DOUBLE PRECISION,
  nearby_rides_location_label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_notification_settings_nearby_radius_check
    CHECK (nearby_rides_radius_km IN (5, 10, 25, 50)),
  CONSTRAINT user_notification_settings_nearby_latitude_range
    CHECK (nearby_rides_latitude IS NULL OR nearby_rides_latitude BETWEEN -90 AND 90),
  CONSTRAINT user_notification_settings_nearby_longitude_range
    CHECK (nearby_rides_longitude IS NULL OR nearby_rides_longitude BETWEEN -180 AND 180),
  CONSTRAINT user_notification_settings_nearby_coordinate_pair
    CHECK ((nearby_rides_latitude IS NULL) = (nearby_rides_longitude IS NULL))
);

DROP TRIGGER IF EXISTS set_user_notification_settings_updated_at ON public.user_notification_settings;
CREATE TRIGGER set_user_notification_settings_updated_at
  BEFORE UPDATE ON public.user_notification_settings
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

ALTER TABLE public.user_notification_settings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.user_notification_settings FROM PUBLIC;
REVOKE ALL ON TABLE public.user_notification_settings FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.user_notification_settings TO authenticated;
GRANT ALL ON TABLE public.user_notification_settings TO service_role;

DROP POLICY IF EXISTS "Users can read their notification settings" ON public.user_notification_settings;
CREATE POLICY "Users can read their notification settings"
  ON public.user_notification_settings
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their notification settings" ON public.user_notification_settings;
CREATE POLICY "Users can insert their notification settings"
  ON public.user_notification_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their notification settings" ON public.user_notification_settings;
CREATE POLICY "Users can update their notification settings"
  ON public.user_notification_settings
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.notification_log
  ADD COLUMN IF NOT EXISTS notification_type TEXT,
  ADD COLUMN IF NOT EXISTS dedupe_key TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB;

UPDATE public.notification_log
SET notification_type = 'legacy'
WHERE notification_type IS NULL;

UPDATE public.notification_log
SET metadata = '{}'::jsonb
WHERE metadata IS NULL;

ALTER TABLE public.notification_log
  ALTER COLUMN notification_type SET DEFAULT 'legacy',
  ALTER COLUMN notification_type SET NOT NULL,
  ALTER COLUMN metadata SET DEFAULT '{}'::jsonb,
  ALTER COLUMN metadata SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_log_dedupe_key_unique
  ON public.notification_log(dedupe_key)
  WHERE dedupe_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notification_log_type_recipient_created_at
  ON public.notification_log(notification_type, recipient_user_id, created_at DESC);

COMMIT;
