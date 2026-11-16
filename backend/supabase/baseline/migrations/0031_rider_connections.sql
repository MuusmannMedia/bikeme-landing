-- Cycling-friend request flow. Keep saved_riders for compatibility, but move
-- app reads/writes to accepted rider_connections.

BEGIN;

CREATE TABLE IF NOT EXISTS public.rider_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT rider_connections_no_self CHECK (requester_id <> receiver_id),
  CONSTRAINT rider_connections_status_check CHECK (status IN ('pending', 'accepted', 'declined', 'blocked'))
);

CREATE UNIQUE INDEX IF NOT EXISTS rider_connections_unique_pair_idx
  ON public.rider_connections (
    LEAST(requester_id, receiver_id),
    GREATEST(requester_id, receiver_id)
  );

CREATE INDEX IF NOT EXISTS idx_rider_connections_requester_id
  ON public.rider_connections(requester_id);

CREATE INDEX IF NOT EXISTS idx_rider_connections_receiver_id
  ON public.rider_connections(receiver_id);

CREATE INDEX IF NOT EXISTS idx_rider_connections_status
  ON public.rider_connections(status);

DROP TRIGGER IF EXISTS set_rider_connections_updated_at ON public.rider_connections;

CREATE TRIGGER set_rider_connections_updated_at
  BEFORE UPDATE ON public.rider_connections
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

INSERT INTO public.rider_connections (
  requester_id,
  receiver_id,
  status,
  created_at,
  updated_at
)
SELECT
  LEAST(sr.user_id, sr.rider_id) AS requester_id,
  GREATEST(sr.user_id, sr.rider_id) AS receiver_id,
  'accepted' AS status,
  MIN(sr.created_at) AS created_at,
  MIN(sr.created_at) AS updated_at
FROM public.saved_riders sr
WHERE sr.user_id <> sr.rider_id
GROUP BY LEAST(sr.user_id, sr.rider_id), GREATEST(sr.user_id, sr.rider_id)
ON CONFLICT DO NOTHING;

ALTER TABLE public.rider_connections ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.rider_connections FROM PUBLIC;

REVOKE ALL ON TABLE public.rider_connections FROM anon, authenticated;

GRANT SELECT, INSERT, DELETE ON TABLE public.rider_connections TO authenticated;

GRANT UPDATE(status, updated_at) ON TABLE public.rider_connections TO authenticated;

GRANT ALL ON TABLE public.rider_connections TO service_role;

DROP POLICY IF EXISTS "Users can read their rider connections" ON public.rider_connections;

CREATE POLICY "Users can read their rider connections"
  ON public.rider_connections
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = requester_id
    OR auth.uid() = receiver_id
  );

DROP POLICY IF EXISTS "Users can request cycling friends" ON public.rider_connections;

CREATE POLICY "Users can request cycling friends"
  ON public.rider_connections
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = requester_id
    AND requester_id <> receiver_id
    AND status = 'pending'
  );

DROP POLICY IF EXISTS "Receivers can accept pending cycling friend requests" ON public.rider_connections;

CREATE POLICY "Receivers can accept pending cycling friend requests"
  ON public.rider_connections
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = receiver_id
    AND status = 'pending'
  )
  WITH CHECK (
    auth.uid() = receiver_id
    AND status = 'accepted'
  );

DROP POLICY IF EXISTS "Users can delete own rider connections" ON public.rider_connections;

CREATE POLICY "Users can delete own rider connections"
  ON public.rider_connections
  FOR DELETE
  TO authenticated
  USING (
    (
      auth.uid() = receiver_id
      AND status = 'pending'
    )
    OR (
      status = 'accepted'
      AND (
        auth.uid() = requester_id
        OR auth.uid() = receiver_id
      )
    )
  );

DROP POLICY IF EXISTS "Users can read profiles for rider connections" ON public.profiles;

CREATE POLICY "Users can read profiles for rider connections"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.rider_connections rc
      WHERE (
        rc.requester_id = auth.uid()
        AND rc.receiver_id = profiles.id
      )
      OR (
        rc.receiver_id = auth.uid()
        AND rc.requester_id = profiles.id
      )
    )
  );

COMMIT;
