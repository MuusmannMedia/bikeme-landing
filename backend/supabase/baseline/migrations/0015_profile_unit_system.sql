ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS unit_system TEXT;

UPDATE public.profiles
SET unit_system = 'metric'
WHERE unit_system IS NULL;

ALTER TABLE public.profiles
ALTER COLUMN unit_system SET DEFAULT 'metric',
ALTER COLUMN unit_system SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_unit_system_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_unit_system_check
    CHECK (unit_system IN ('metric', 'imperial'));
  END IF;
END
$$;
