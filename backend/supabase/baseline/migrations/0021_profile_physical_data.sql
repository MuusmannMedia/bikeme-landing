ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS height_cm NUMERIC(5,1),
  ADD COLUMN IF NOT EXISTS weight_kg NUMERIC(5,1);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_height_cm_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_height_cm_check
      CHECK (height_cm IS NULL OR (height_cm >= 30 AND height_cm <= 300));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_weight_kg_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_weight_kg_check
      CHECK (weight_kg IS NULL OR (weight_kg >= 20 AND weight_kg <= 400));
  END IF;
END
$$;
