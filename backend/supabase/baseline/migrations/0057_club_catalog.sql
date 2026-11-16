BEGIN;

CREATE FUNCTION public.club_list_catalog()
RETURNS TABLE(id uuid, name text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'CLUB_AUTH_REQUIRED' USING ERRCODE = '28000';
  END IF;

  RETURN QUERY SELECT c.id, c.name FROM public.clubs AS c;
END;
$$;

REVOKE ALL ON FUNCTION public.club_list_catalog() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.club_list_catalog() TO authenticated;

COMMIT;
