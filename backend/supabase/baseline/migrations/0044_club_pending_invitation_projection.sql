-- Additive, administrator-only projection. No profile policy/grant changes.
BEGIN;
CREATE FUNCTION public.club_list_pending_invitations(p_club_id UUID)
RETURNS TABLE (invite_id UUID, invitee_id UUID, invitee_name TEXT,
  created_at TIMESTAMPTZ, expires_at TIMESTAMPTZ)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
  IF club_private.my_role(p_club_id) IS NULL
     OR club_private.my_role(p_club_id) NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'CLUB_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT i.id, i.invitee_id, p.display_name, i.created_at, i.expires_at
  FROM public.club_invites i JOIN public.profiles p ON p.id = i.invitee_id
  WHERE i.club_id = p_club_id AND i.status = 'pending'
    AND i.expires_at > statement_timestamp()
    AND club_private.role_for(i.club_id, i.inviter_id) IN ('owner', 'admin')
  ORDER BY i.created_at DESC, i.id;
END;
$$;
REVOKE ALL ON FUNCTION public.club_list_pending_invitations(UUID)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.club_list_pending_invitations(UUID) TO authenticated;
COMMIT;
