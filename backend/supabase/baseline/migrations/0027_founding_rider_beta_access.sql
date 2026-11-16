-- Founding Rider beta access model.
-- Replaces the hardcoded tester_premium default with a database-controlled
-- beta grant path while preserving existing tester_premium users.

BEGIN;

ALTER TABLE public.user_access
  ADD COLUMN IF NOT EXISTS access_expires_at TIMESTAMPTZ;

ALTER TABLE public.user_access
  ADD COLUMN IF NOT EXISTS access_source TEXT;

ALTER TABLE public.user_access
  ADD COLUMN IF NOT EXISTS granted_at TIMESTAMPTZ DEFAULT NOW();

UPDATE public.user_access
SET granted_at = COALESCE(granted_at, created_at, NOW())
WHERE granted_at IS NULL;

ALTER TABLE public.user_access
  ALTER COLUMN access_level SET DEFAULT 'basic';

ALTER TABLE public.user_access
  DROP CONSTRAINT IF EXISTS user_access_access_level_check;

ALTER TABLE public.user_access
  ADD CONSTRAINT user_access_access_level_check
  CHECK (access_level IN ('basic', 'premium', 'tester_premium', 'founding_rider'));

CREATE TABLE IF NOT EXISTS public.founding_riders (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  pro_starts_at TIMESTAMPTZ,
  pro_expires_at TIMESTAMPTZ,
  source TEXT NOT NULL DEFAULT 'testflight_beta',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_founding_riders_pro_expires_at
  ON public.founding_riders(pro_expires_at);

CREATE INDEX IF NOT EXISTS idx_founding_riders_source
  ON public.founding_riders(source);

CREATE INDEX IF NOT EXISTS idx_founding_riders_granted_at
  ON public.founding_riders(granted_at);

DROP TRIGGER IF EXISTS set_founding_riders_updated_at ON public.founding_riders;
CREATE TRIGGER set_founding_riders_updated_at
  BEFORE UPDATE ON public.founding_riders
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

ALTER TABLE public.founding_riders ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.founding_riders FROM anon, authenticated;
GRANT SELECT ON public.founding_riders TO authenticated;

DROP POLICY IF EXISTS "Read own founding rider access" ON public.founding_riders;
CREATE POLICY "Read own founding rider access"
  ON public.founding_riders
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.beta_access_config (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE,
  beta_grants_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  launch_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT beta_access_config_singleton CHECK (id = TRUE)
);

INSERT INTO public.beta_access_config (id, beta_grants_enabled, launch_date)
VALUES (TRUE, TRUE, NULL)
ON CONFLICT (id) DO NOTHING;

DROP TRIGGER IF EXISTS set_beta_access_config_updated_at ON public.beta_access_config;
CREATE TRIGGER set_beta_access_config_updated_at
  BEFORE UPDATE ON public.beta_access_config
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

ALTER TABLE public.beta_access_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.beta_access_config FROM anon, authenticated;

UPDATE public.user_access
SET
  access_source = COALESCE(access_source, 'testflight_beta'),
  granted_at = COALESCE(granted_at, created_at, NOW())
WHERE access_level = 'tester_premium';

INSERT INTO public.founding_riders (
  user_id,
  email,
  display_name,
  granted_at,
  pro_starts_at,
  pro_expires_at,
  source
)
SELECT
  ua.user_id,
  au.email,
  p.display_name,
  COALESCE(ua.granted_at, ua.created_at, NOW()),
  bac.launch_date,
  CASE
    WHEN bac.launch_date IS NOT NULL THEN bac.launch_date + INTERVAL '12 months'
    ELSE NULL
  END,
  COALESCE(ua.access_source, 'testflight_beta')
FROM public.user_access ua
LEFT JOIN auth.users au ON au.id = ua.user_id
LEFT JOIN public.profiles p ON p.id = ua.user_id
CROSS JOIN public.beta_access_config bac
WHERE ua.access_level = 'tester_premium'
  AND bac.id = TRUE
ON CONFLICT (user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.grant_founding_rider_access(p_target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_beta_grants_enabled BOOLEAN := FALSE;
  v_launch_date TIMESTAMPTZ;
  v_email TEXT;
  v_display_name TEXT;
  v_pro_expires_at TIMESTAMPTZ;
BEGIN
  IF p_target_user_id IS NULL THEN
    RETURN;
  END IF;

  SELECT bac.beta_grants_enabled, bac.launch_date
  INTO v_beta_grants_enabled, v_launch_date
  FROM public.beta_access_config bac
  WHERE bac.id = TRUE;

  IF COALESCE(v_beta_grants_enabled, FALSE) IS NOT TRUE THEN
    INSERT INTO public.user_access (user_id, access_level)
    VALUES (p_target_user_id, 'basic')
    ON CONFLICT (user_id) DO NOTHING;

    RETURN;
  END IF;

  SELECT au.email
  INTO v_email
  FROM auth.users au
  WHERE au.id = p_target_user_id;

  SELECT p.display_name
  INTO v_display_name
  FROM public.profiles p
  WHERE p.id = p_target_user_id;

  v_pro_expires_at := CASE
    WHEN v_launch_date IS NOT NULL THEN v_launch_date + INTERVAL '12 months'
    ELSE NULL
  END;

  INSERT INTO public.founding_riders (
    user_id,
    email,
    display_name,
    pro_starts_at,
    pro_expires_at,
    source
  )
  VALUES (
    p_target_user_id,
    v_email,
    v_display_name,
    v_launch_date,
    v_pro_expires_at,
    'testflight_beta'
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    email = COALESCE(EXCLUDED.email, public.founding_riders.email),
    display_name = COALESCE(EXCLUDED.display_name, public.founding_riders.display_name),
    pro_starts_at = EXCLUDED.pro_starts_at,
    pro_expires_at = EXCLUDED.pro_expires_at,
    source = EXCLUDED.source,
    updated_at = NOW();

  INSERT INTO public.user_access (
    user_id,
    access_level,
    access_expires_at,
    access_source,
    granted_at
  )
  VALUES (
    p_target_user_id,
    'founding_rider',
    v_pro_expires_at,
    'testflight_beta',
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    access_level = EXCLUDED.access_level,
    access_expires_at = EXCLUDED.access_expires_at,
    access_source = EXCLUDED.access_source,
    granted_at = COALESCE(public.user_access.granted_at, EXCLUDED.granted_at),
    updated_at = NOW()
  WHERE public.user_access.access_level NOT IN ('premium', 'tester_premium');
END;
$$;

REVOKE ALL ON FUNCTION public.grant_founding_rider_access(UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.ensure_user_access_row()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.grant_founding_rider_access(NEW.id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ensure_profile_has_user_access ON public.profiles;
CREATE TRIGGER ensure_profile_has_user_access
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.ensure_user_access_row();

DROP VIEW IF EXISTS public.user_access_overview;
CREATE VIEW public.user_access_overview AS
SELECT
  au.id AS user_id,
  au.email,
  p.display_name,
  COALESCE(ua.access_level, 'basic') AS access_level,
  ua.access_expires_at,
  ua.access_source,
  ua.granted_at,
  ua.created_at AS access_created_at,
  ua.updated_at AS access_updated_at,
  fr.pro_starts_at,
  fr.pro_expires_at,
  fr.source AS founding_source,
  fr.granted_at AS founding_granted_at
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
LEFT JOIN public.user_access ua ON ua.user_id = au.id
LEFT JOIN public.founding_riders fr ON fr.user_id = au.id;

ALTER VIEW public.user_access_overview SET (security_invoker = true);
REVOKE ALL ON public.user_access_overview FROM anon, authenticated;

COMMIT;
