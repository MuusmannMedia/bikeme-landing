-- Club test backend only. Match the metrics columns used by Bike Me 1.0.11.
-- Existing ride_history policies and grants continue to govern these columns.
BEGIN;

ALTER TABLE public.ride_history
  ADD COLUMN elevation_gain numeric DEFAULT 0,
  ADD COLUMN average_watts numeric,
  ADD COLUMN max_watts numeric,
  ADD COLUMN zone_distribution jsonb DEFAULT '{"z1":0,"z2":0,"z3":0,"z4":0,"z5":0,"z6":0,"z7":0}'::jsonb;

NOTIFY pgrst, 'reload schema';

COMMIT;
