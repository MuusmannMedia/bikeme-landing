-- Phase 1 freemium access control (manual from Supabase).

CREATE TABLE IF NOT EXISTS public.user_access (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  access_level TEXT NOT NULL DEFAULT 'basic',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_access
  ADD COLUMN IF NOT EXISTS access_level TEXT NOT NULL DEFAULT 'basic';

ALTER TABLE public.user_access
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.user_access
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.user_access
  ALTER COLUMN access_level SET DEFAULT 'basic';

UPDATE public.user_access
SET access_level = 'basic'
WHERE access_level IS NULL;

ALTER TABLE public.user_access
  ALTER COLUMN access_level SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_access_access_level_check'
  ) THEN
    ALTER TABLE public.user_access
      ADD CONSTRAINT user_access_access_level_check
      CHECK (access_level IN ('basic', 'premium', 'tester_premium'));
  END IF;
END
$$;

DROP TRIGGER IF EXISTS set_user_access_updated_at ON public.user_access;
CREATE TRIGGER set_user_access_updated_at
  BEFORE UPDATE ON public.user_access
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

ALTER TABLE public.user_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read own user access" ON public.user_access;
CREATE POLICY "Read own user access"
  ON public.user_access
  FOR SELECT
  USING (auth.uid() = user_id);

INSERT INTO public.user_access (user_id, access_level)
-- Backfill from auth.users (not profiles) so every existing auth account gets a row.
SELECT id, 'basic'
FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.ensure_user_access_row()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_access (user_id, access_level)
  VALUES (NEW.id, 'basic')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ensure_profile_has_user_access ON public.profiles;
CREATE TRIGGER ensure_profile_has_user_access
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.ensure_user_access_row();
