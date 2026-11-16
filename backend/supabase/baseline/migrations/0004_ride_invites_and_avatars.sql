-- Add rider invitation support and profile avatar storage policies.

CREATE TABLE IF NOT EXISTS public.ride_invites (
  ride_id UUID NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  host_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invitee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  declined_at TIMESTAMPTZ,
  PRIMARY KEY (ride_id, invitee_id),
  CONSTRAINT ride_invites_host_not_invitee CHECK (host_id <> invitee_id)
);

CREATE INDEX IF NOT EXISTS idx_ride_invites_invitee_id ON public.ride_invites(invitee_id);
CREATE INDEX IF NOT EXISTS idx_ride_invites_host_id ON public.ride_invites(host_id);

ALTER TABLE public.ride_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read own ride invites" ON public.ride_invites;
DROP POLICY IF EXISTS "Host creates ride invites" ON public.ride_invites;
DROP POLICY IF EXISTS "Host deletes ride invites" ON public.ride_invites;
DROP POLICY IF EXISTS "Invitee updates invite" ON public.ride_invites;

CREATE POLICY "Read own ride invites"
  ON public.ride_invites
  FOR SELECT
  USING (auth.uid() = host_id OR auth.uid() = invitee_id);

CREATE POLICY "Host creates ride invites"
  ON public.ride_invites
  FOR INSERT
  WITH CHECK (
    auth.uid() = host_id
    AND EXISTS (
      SELECT 1
      FROM public.rides r
      WHERE r.id = ride_id
        AND r.host_id = auth.uid()
    )
  );

CREATE POLICY "Host deletes ride invites"
  ON public.ride_invites
  FOR DELETE
  USING (auth.uid() = host_id);

CREATE POLICY "Invitee updates invite"
  ON public.ride_invites
  FOR UPDATE
  USING (auth.uid() = invitee_id)
  WITH CHECK (auth.uid() = invitee_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'ride_invites'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ride_invites;
  END IF;
END;
$$;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public;

DROP POLICY IF EXISTS "Avatar images are public" ON storage.objects;
DROP POLICY IF EXISTS "Users upload own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users update own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users delete own avatar" ON storage.objects;

CREATE POLICY "Avatar images are public"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "Users upload own avatar"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users update own avatar"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users delete own avatar"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
