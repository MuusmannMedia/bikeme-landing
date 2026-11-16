-- Store a readable meeting point (street + number) for map pings/events.
ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS meeting_address TEXT;
