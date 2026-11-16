-- Correct coordinates for existing Sjælland ride hotspots.
-- Fixed UUIDs are preserved; this migration does not insert new hotspots.

BEGIN;

UPDATE public.ride_hotspots
SET latitude = 55.777350, longitude = 12.587579
WHERE id = 'b1c00000-0000-4000-8000-000000000100';

UPDATE public.ride_hotspots
SET latitude = 55.731747, longitude = 12.567691
WHERE id = 'b1c00000-0000-4000-8000-000000000110';

UPDATE public.ride_hotspots
SET latitude = 55.744553, longitude = 12.585440
WHERE id = 'b1c00000-0000-4000-8000-000000000120';

UPDATE public.ride_hotspots
SET latitude = 55.811832, longitude = 12.373721
WHERE id = 'b1c00000-0000-4000-8000-000000000130';

UPDATE public.ride_hotspots
SET name = 'Bagsværd Station', latitude = 55.761273, longitude = 12.452588
WHERE id = 'b1c00000-0000-4000-8000-000000000140';

UPDATE public.ride_hotspots
SET latitude = 55.927341, longitude = 12.310989
WHERE id = 'b1c00000-0000-4000-8000-000000000150';

UPDATE public.ride_hotspots
SET latitude = 56.033786, longitude = 12.614642
WHERE id = 'b1c00000-0000-4000-8000-000000000160';

UPDATE public.ride_hotspots
SET latitude = 55.649255, longitude = 12.078781
WHERE id = 'b1c00000-0000-4000-8000-000000000170';

UPDATE public.ride_hotspots
SET latitude = 55.457582, longitude = 12.187933
WHERE id = 'b1c00000-0000-4000-8000-000000000180';

UPDATE public.ride_hotspots
SET latitude = 55.719607, longitude = 11.722606
WHERE id = 'b1c00000-0000-4000-8000-000000000190';

UPDATE public.ride_hotspots
SET latitude = 55.230832, longitude = 11.767031
WHERE id = 'b1c00000-0000-4000-8000-000000000200';

UPDATE public.ride_hotspots
SET latitude = 55.419808, longitude = 11.571041
WHERE id = 'b1c00000-0000-4000-8000-000000000210';

COMMIT;
