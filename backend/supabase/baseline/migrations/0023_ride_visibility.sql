-- Add public/private visibility metadata for rides.
-- RLS is intentionally unchanged in this migration; private ride access is enforced in a later policy patch.

ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS visibility TEXT;

UPDATE public.rides
SET visibility = 'public'
WHERE visibility IS NULL;

ALTER TABLE public.rides
  ALTER COLUMN visibility SET DEFAULT 'public',
  ALTER COLUMN visibility SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'rides_visibility_check'
      AND conrelid = 'public.rides'::regclass
  ) THEN
    ALTER TABLE public.rides
      ADD CONSTRAINT rides_visibility_check
      CHECK (visibility IN ('public', 'private'));
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_rides_visibility
  ON public.rides(visibility);
