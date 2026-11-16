-- Store estimated ride calories for history entries.
ALTER TABLE public.ride_history
  ADD COLUMN IF NOT EXISTS calories_kcal INTEGER;
