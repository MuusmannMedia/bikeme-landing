-- Rider report storage for MVP moderation/reporting flows.

CREATE TABLE IF NOT EXISTS public.rider_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reported_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  ride_id UUID NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  reason_code TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT rider_reports_reporter_not_reported_check
    CHECK (reporter_user_id <> reported_user_id),
  CONSTRAINT rider_reports_status_check
    CHECK (status IN ('open', 'under_review', 'resolved', 'dismissed')),
  CONSTRAINT rider_reports_reason_code_check
    CHECK (
      reason_code IN (
        'boundary_crossing',
        'unsafe_behavior',
        'inappropriate_behavior',
        'harassment',
        'other'
      )
    ),
  CONSTRAINT rider_reports_description_length_check
    CHECK (description IS NULL OR char_length(description) <= 2000)
);

CREATE INDEX IF NOT EXISTS idx_rider_reports_reporter_user_id
  ON public.rider_reports(reporter_user_id);

CREATE INDEX IF NOT EXISTS idx_rider_reports_reported_user_id
  ON public.rider_reports(reported_user_id);

CREATE INDEX IF NOT EXISTS idx_rider_reports_ride_id
  ON public.rider_reports(ride_id);

CREATE INDEX IF NOT EXISTS idx_rider_reports_status_created_at
  ON public.rider_reports(status, created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'rider_reports_reporter_not_reported_check'
      AND conrelid = 'public.rider_reports'::regclass
  ) THEN
    ALTER TABLE public.rider_reports
      ADD CONSTRAINT rider_reports_reporter_not_reported_check
      CHECK (reporter_user_id <> reported_user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'rider_reports_status_check'
      AND conrelid = 'public.rider_reports'::regclass
  ) THEN
    ALTER TABLE public.rider_reports
      ADD CONSTRAINT rider_reports_status_check
      CHECK (status IN ('open', 'under_review', 'resolved', 'dismissed'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'rider_reports_reason_code_check'
      AND conrelid = 'public.rider_reports'::regclass
  ) THEN
    ALTER TABLE public.rider_reports
      ADD CONSTRAINT rider_reports_reason_code_check
      CHECK (
        reason_code IN (
          'boundary_crossing',
          'unsafe_behavior',
          'inappropriate_behavior',
          'harassment',
          'other'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'rider_reports_description_length_check'
      AND conrelid = 'public.rider_reports'::regclass
  ) THEN
    ALTER TABLE public.rider_reports
      ADD CONSTRAINT rider_reports_description_length_check
      CHECK (description IS NULL OR char_length(description) <= 2000);
  END IF;
END
$$;

DROP TRIGGER IF EXISTS set_rider_reports_updated_at ON public.rider_reports;
CREATE TRIGGER set_rider_reports_updated_at
  BEFORE UPDATE ON public.rider_reports
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

ALTER TABLE public.rider_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can insert rider reports" ON public.rider_reports;

CREATE POLICY "Authenticated users can insert rider reports"
  ON public.rider_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = reporter_user_id
    AND auth.uid() <> reported_user_id
    AND status = 'open'
    AND EXISTS (
      SELECT 1
      FROM public.rides r
      WHERE r.id = rider_reports.ride_id
        AND (
          r.host_id = reporter_user_id
          OR EXISTS (
            SELECT 1
            FROM public.participants p
            WHERE p.ride_id = r.id
              AND p.user_id = reporter_user_id
          )
        )
    )
    AND EXISTS (
      SELECT 1
      FROM public.rides r
      WHERE r.id = rider_reports.ride_id
        AND (
          r.host_id = reported_user_id
          OR EXISTS (
            SELECT 1
            FROM public.participants p
            WHERE p.ride_id = r.id
              AND p.user_id = reported_user_id
          )
        )
    )
  );
