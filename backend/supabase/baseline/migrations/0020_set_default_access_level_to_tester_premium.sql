-- Early adopter mode: new users should default to tester_premium access.

BEGIN;

ALTER TABLE public.user_access
  ALTER COLUMN access_level SET DEFAULT 'tester_premium';

CREATE OR REPLACE FUNCTION public.ensure_user_access_row()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_access (user_id, access_level)
  VALUES (NEW.id, 'tester_premium')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

COMMIT;
