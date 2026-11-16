DO $$
BEGIN
  IF to_regclass('public.ride_history') IS NOT NULL THEN
    ALTER TABLE public.ride_history
      ADD COLUMN IF NOT EXISTS route_coordinates jsonb;
  END IF;
END;
$$;
