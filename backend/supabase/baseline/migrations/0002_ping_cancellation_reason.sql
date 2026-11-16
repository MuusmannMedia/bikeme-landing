-- Add cancellation message support so joined riders can see why a ride was cancelled.
ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS cancel_reason TEXT,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_rides_cancelled_at ON public.rides(cancelled_at);
