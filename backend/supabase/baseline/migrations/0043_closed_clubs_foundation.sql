-- REVIEW ONLY: additive club foundation. Never apply the archived migration set
-- wholesale: live is at 0042 and archived 0021 has a different identity.
-- No existing table, policy, authentication flow, ride, or access level is changed.
BEGIN;

CREATE SCHEMA club_private;
REVOKE ALL ON SCHEMA club_private FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA club_private TO authenticated;

CREATE TABLE public.clubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (name = btrim(name) AND char_length(name) BETWEEN 2 AND 80),
  description TEXT CHECK (description = btrim(description) AND char_length(description) BETWEEN 1 AND 1000),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  creation_key UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (created_by, creation_key)
);

CREATE TABLE public.club_members (
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- Ownership has one source of truth: clubs.owner_id. The owner is also a member.
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (club_id, user_id)
);
CREATE INDEX club_members_user_idx ON public.club_members(user_id, club_id);

ALTER TABLE public.clubs ADD CONSTRAINT clubs_owner_is_member
  FOREIGN KEY (id, owner_id) REFERENCES public.club_members(club_id, user_id)
  DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE public.club_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  inviter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invitee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  request_key UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled', 'expired')),
  created_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  responded_at TIMESTAMPTZ,
  UNIQUE (club_id, inviter_id, request_key),
  CHECK (inviter_id <> invitee_id),
  CHECK (expires_at = created_at + INTERVAL '168 hours'),
  CHECK (
    (status IN ('pending', 'expired') AND responded_at IS NULL)
    OR (status IN ('accepted', 'declined', 'cancelled') AND responded_at IS NOT NULL AND responded_at >= created_at)
  ),
  CHECK (status NOT IN ('accepted', 'declined') OR responded_at < expires_at)
);
CREATE UNIQUE INDEX club_invites_one_pending_idx
  ON public.club_invites(club_id, invitee_id) WHERE status = 'pending';
CREATE INDEX club_invites_recipient_idx ON public.club_invites(invitee_id, created_at DESC);

CREATE TABLE public.club_ownership_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  from_owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  to_admin_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled', 'expired')),
  created_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  responded_at TIMESTAMPTZ,
  CHECK (from_owner_id <> to_admin_id),
  CHECK (expires_at = created_at + INTERVAL '168 hours'),
  CHECK (
    (status IN ('pending', 'expired') AND responded_at IS NULL)
    OR (status IN ('accepted', 'declined', 'cancelled') AND responded_at IS NOT NULL AND responded_at >= created_at)
  ),
  CHECK (status NOT IN ('accepted', 'declined') OR responded_at < expires_at)
);
CREATE UNIQUE INDEX club_ownership_one_pending_idx
  ON public.club_ownership_transfers(club_id) WHERE status = 'pending';
CREATE INDEX club_ownership_recipient_idx ON public.club_ownership_transfers(to_admin_id);

-- Helpers are outside the exposed public API. Only my_role is executable by a
-- client role, for RLS, and can reveal only that caller's own membership.
CREATE FUNCTION club_private.require_user() RETURNS UUID
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE v_user UUID := auth.uid();
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'CLUB_UNAUTHENTICATED' USING ERRCODE = '28000'; END IF;
  RETURN v_user;
END;
$$;

CREATE FUNCTION club_private.role_for(p_club UUID, p_user UUID) RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
  SELECT CASE WHEN c.owner_id = m.user_id THEN 'owner' ELSE m.role END
  FROM public.club_members m JOIN public.clubs c ON c.id = m.club_id
  WHERE m.club_id = p_club AND m.user_id = p_user;
$$;

CREATE FUNCTION club_private.my_role(p_club UUID) RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
  SELECT club_private.role_for(p_club, auth.uid());
$$;

CREATE FUNCTION club_private.lock_club(p_club UUID) RETURNS public.clubs
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE v_club public.clubs;
BEGIN
  PERFORM club_private.require_user();
  -- Every mutation touches the same row, including membership-only changes.
  -- Besides serializing READ COMMITTED callers this forces stale REPEATABLE READ
  -- callers to retry with a fresh snapshot instead of reusing revoked authority.
  UPDATE public.clubs SET updated_at = clock_timestamp()
  WHERE id = p_club RETURNING * INTO v_club;
  IF NOT FOUND THEN RAISE EXCEPTION 'CLUB_FORBIDDEN' USING ERRCODE = '42501'; END IF;
  RETURN v_club;
END;
$$;

CREATE FUNCTION club_private.revoke_authority(p_club UUID, p_user UUID) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
  -- Caller must already hold the club lock. Invites cannot survive demotion,
  -- removal, or departure of the admin who issued them.
  UPDATE public.club_invites SET status = 'cancelled', responded_at = clock_timestamp()
  WHERE club_id = p_club AND inviter_id = p_user AND status = 'pending';
  UPDATE public.club_ownership_transfers SET status = 'cancelled', responded_at = clock_timestamp()
  WHERE club_id = p_club AND to_admin_id = p_user AND status = 'pending';
END;
$$;

ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_ownership_transfers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.clubs, public.club_members, public.club_invites,
  public.club_ownership_transfers FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.clubs, public.club_members, public.club_invites,
  public.club_ownership_transfers TO authenticated, service_role;

CREATE POLICY clubs_member_read ON public.clubs FOR SELECT TO authenticated
  USING (club_private.my_role(id) IS NOT NULL);
CREATE POLICY club_members_member_read ON public.club_members FOR SELECT TO authenticated
  USING (club_private.my_role(club_id) IS NOT NULL);
CREATE POLICY club_invites_party_read ON public.club_invites FOR SELECT TO authenticated
  USING (invitee_id = auth.uid() OR club_private.my_role(club_id) IN ('owner', 'admin'));
CREATE POLICY club_ownership_party_read ON public.club_ownership_transfers FOR SELECT TO authenticated
  USING (auth.uid() IN (from_owner_id, to_admin_id));

CREATE FUNCTION public.club_create(p_request_key UUID, p_name TEXT, p_description TEXT DEFAULT NULL)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE v_user UUID := club_private.require_user(); v_id UUID;
BEGIN
  IF p_request_key IS NULL OR p_name IS NULL OR char_length(btrim(p_name)) NOT BETWEEN 2 AND 80
     OR char_length(btrim(COALESCE(p_description, ''))) > 1000 THEN
    RAISE EXCEPTION 'CLUB_INVALID_INPUT' USING ERRCODE = '22023';
  END IF;
  PERFORM 1 FROM public.profiles WHERE id = v_user FOR KEY SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CLUB_UNAUTHENTICATED' USING ERRCODE = '28000'; END IF;
  INSERT INTO public.clubs(name, description, owner_id, created_by, creation_key)
  VALUES (btrim(p_name), NULLIF(btrim(p_description), ''), v_user, v_user, p_request_key)
  ON CONFLICT (created_by, creation_key) DO NOTHING RETURNING id INTO v_id;
  IF v_id IS NULL THEN
    SELECT id INTO v_id FROM public.clubs WHERE created_by = v_user AND creation_key = p_request_key;
    RETURN v_id;
  END IF;
  INSERT INTO public.club_members(club_id, user_id, role) VALUES (v_id, v_user, 'admin');
  RETURN v_id;
END;
$$;

CREATE FUNCTION public.club_update(p_club_id UUID, p_name TEXT, p_description TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
  PERFORM club_private.lock_club(p_club_id);
  IF club_private.my_role(p_club_id) IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'CLUB_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF p_name IS NULL OR char_length(btrim(p_name)) NOT BETWEEN 2 AND 80
     OR char_length(btrim(COALESCE(p_description, ''))) > 1000 THEN
    RAISE EXCEPTION 'CLUB_INVALID_INPUT' USING ERRCODE = '22023';
  END IF;
  UPDATE public.clubs SET name = btrim(p_name), description = NULLIF(btrim(p_description), '')
  WHERE id = p_club_id;
END;
$$;

CREATE FUNCTION public.club_invite(p_club_id UUID, p_invitee_id UUID, p_request_key UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE v_user UUID := club_private.require_user(); v_existing public.club_invites;
  v_id UUID; v_now TIMESTAMPTZ; v_role TEXT;
BEGIN
  PERFORM club_private.lock_club(p_club_id);
  v_role := club_private.my_role(p_club_id);
  IF v_role IS NULL OR v_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'CLUB_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF p_invitee_id IS NULL OR p_request_key IS NULL OR p_invitee_id = v_user THEN
    RAISE EXCEPTION 'CLUB_INVALID_INPUT' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_existing FROM public.club_invites
  WHERE club_id = p_club_id AND inviter_id = v_user AND request_key = p_request_key;
  IF FOUND THEN
    IF v_existing.invitee_id <> p_invitee_id THEN
      RAISE EXCEPTION 'CLUB_IDEMPOTENCY_CONFLICT' USING ERRCODE = '22023';
    END IF;
    RETURN v_existing.id;
  END IF;
  IF club_private.role_for(p_club_id, p_invitee_id) IS NOT NULL THEN
    RAISE EXCEPTION 'CLUB_ALREADY_MEMBER' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_invitee_id) THEN
    RAISE EXCEPTION 'CLUB_INVALID_INPUT' USING ERRCODE = '22023';
  END IF;
  v_now := clock_timestamp();
  UPDATE public.club_invites SET status = 'expired'
  WHERE club_id = p_club_id AND invitee_id = p_invitee_id AND status = 'pending' AND expires_at <= v_now;
  SELECT id INTO v_id FROM public.club_invites
  WHERE club_id = p_club_id AND invitee_id = p_invitee_id AND status = 'pending';
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  INSERT INTO public.club_invites(club_id, inviter_id, invitee_id, request_key, created_at, expires_at)
  VALUES (p_club_id, v_user, p_invitee_id, p_request_key, v_now, v_now + INTERVAL '168 hours')
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE FUNCTION public.club_respond_invite(p_invite_id UUID, p_accept BOOLEAN)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE v_user UUID := club_private.require_user(); v_club UUID; v_invite public.club_invites;
  v_now TIMESTAMPTZ; v_role TEXT;
BEGIN
  IF p_accept IS NULL THEN RAISE EXCEPTION 'CLUB_INVALID_INPUT' USING ERRCODE = '22023'; END IF;
  SELECT club_id INTO v_club FROM public.club_invites WHERE id = p_invite_id;
  PERFORM club_private.lock_club(v_club);
  SELECT * INTO v_invite FROM public.club_invites WHERE id = p_invite_id FOR UPDATE;
  IF NOT FOUND OR v_invite.invitee_id IS DISTINCT FROM v_user THEN
    RAISE EXCEPTION 'CLUB_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF p_accept AND v_invite.status = 'accepted' AND club_private.my_role(v_club) IS NOT NULL THEN RETURN; END IF;
  IF NOT p_accept AND v_invite.status = 'declined' THEN RETURN; END IF;
  v_now := clock_timestamp();
  IF v_invite.status <> 'pending' THEN RAISE EXCEPTION 'CLUB_INVITE_CLOSED' USING ERRCODE = '22023'; END IF;
  IF v_invite.expires_at <= v_now THEN RAISE EXCEPTION 'CLUB_INVITE_EXPIRED' USING ERRCODE = '22023'; END IF;
  v_role := club_private.role_for(v_club, v_invite.inviter_id);
  IF v_role IS NULL OR v_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'CLUB_INVITE_CLOSED' USING ERRCODE = '22023';
  END IF;
  IF p_accept THEN
    INSERT INTO public.club_members(club_id, user_id, role) VALUES (v_club, v_user, 'member')
    ON CONFLICT (club_id, user_id) DO NOTHING;
  END IF;
  UPDATE public.club_invites SET status = CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END,
    responded_at = v_now WHERE id = p_invite_id;
END;
$$;

CREATE FUNCTION public.club_cancel_invite(p_invite_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE v_club UUID; v_role TEXT; v_invite public.club_invites;
BEGIN
  SELECT club_id INTO v_club FROM public.club_invites WHERE id = p_invite_id;
  PERFORM club_private.lock_club(v_club);
  v_role := club_private.my_role(v_club);
  IF v_role IS NULL OR v_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'CLUB_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_invite FROM public.club_invites WHERE id = p_invite_id FOR UPDATE;
  IF v_invite.status = 'cancelled' THEN RETURN; END IF;
  IF v_invite.status <> 'pending' THEN RAISE EXCEPTION 'CLUB_INVITE_CLOSED' USING ERRCODE = '22023'; END IF;
  UPDATE public.club_invites SET status = 'cancelled', responded_at = clock_timestamp() WHERE id = p_invite_id;
END;
$$;

-- Deliberately small action set; no arbitrary role or row patches are accepted.
CREATE FUNCTION public.club_member_action(p_club_id UUID, p_user_id UUID, p_action TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE v_user UUID := club_private.require_user(); v_role TEXT; v_target TEXT;
BEGIN
  PERFORM club_private.lock_club(p_club_id);
  v_role := club_private.my_role(p_club_id);
  v_target := club_private.role_for(p_club_id, p_user_id);
  IF p_action IS NULL OR p_action NOT IN ('leave', 'remove', 'make_admin', 'make_member') OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'CLUB_INVALID_INPUT' USING ERRCODE = '22023';
  END IF;
  IF p_action = 'leave' THEN
    IF p_user_id IS DISTINCT FROM v_user OR v_role IS NULL THEN
      RAISE EXCEPTION 'CLUB_FORBIDDEN' USING ERRCODE = '42501';
    END IF;
    IF v_role = 'owner' THEN RAISE EXCEPTION 'CLUB_OWNER_MUST_TRANSFER' USING ERRCODE = '22023'; END IF;
  ELSE
    IF v_role IS NULL OR v_role NOT IN ('owner', 'admin') THEN
      RAISE EXCEPTION 'CLUB_FORBIDDEN' USING ERRCODE = '42501';
    END IF;
    IF p_user_id = v_user OR v_target = 'owner' THEN
      RAISE EXCEPTION 'CLUB_FORBIDDEN' USING ERRCODE = '42501';
    END IF;
    IF p_action IN ('make_admin', 'make_member') AND v_role <> 'owner' THEN
      RAISE EXCEPTION 'CLUB_FORBIDDEN' USING ERRCODE = '42501';
    END IF;
    IF v_role = 'admin' AND v_target = 'admin' THEN
      RAISE EXCEPTION 'CLUB_FORBIDDEN' USING ERRCODE = '42501';
    END IF;
    IF v_target IS NULL THEN
      IF p_action = 'remove' THEN RETURN; END IF;
      RAISE EXCEPTION 'CLUB_NOT_MEMBER' USING ERRCODE = '22023';
    END IF;
  END IF;
  IF p_action IN ('leave', 'remove') THEN
    PERFORM club_private.revoke_authority(p_club_id, p_user_id);
    DELETE FROM public.club_members WHERE club_id = p_club_id AND user_id = p_user_id;
  ELSE
    IF p_action = 'make_member' THEN PERFORM club_private.revoke_authority(p_club_id, p_user_id); END IF;
    UPDATE public.club_members SET role = CASE WHEN p_action = 'make_admin' THEN 'admin' ELSE 'member' END
    WHERE club_id = p_club_id AND user_id = p_user_id;
  END IF;
END;
$$;

CREATE FUNCTION public.club_propose_ownership(p_club_id UUID, p_admin_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE v_user UUID := club_private.require_user(); v_now TIMESTAMPTZ;
  v_transfer public.club_ownership_transfers; v_id UUID;
BEGIN
  PERFORM club_private.lock_club(p_club_id);
  IF club_private.my_role(p_club_id) IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'CLUB_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF club_private.role_for(p_club_id, p_admin_id) IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'CLUB_TARGET_MUST_BE_ADMIN' USING ERRCODE = '22023';
  END IF;
  v_now := clock_timestamp();
  UPDATE public.club_ownership_transfers SET status = 'expired'
  WHERE club_id = p_club_id AND status = 'pending' AND expires_at <= v_now;
  SELECT * INTO v_transfer FROM public.club_ownership_transfers WHERE club_id = p_club_id AND status = 'pending';
  IF FOUND THEN
    IF v_transfer.to_admin_id = p_admin_id THEN RETURN v_transfer.id; END IF;
    RAISE EXCEPTION 'CLUB_TRANSFER_PENDING' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.club_ownership_transfers(club_id, from_owner_id, to_admin_id, created_at, expires_at)
  VALUES (p_club_id, v_user, p_admin_id, v_now, v_now + INTERVAL '168 hours') RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE FUNCTION public.club_respond_ownership(p_transfer_id UUID, p_accept BOOLEAN)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE v_user UUID := club_private.require_user(); v_id UUID; v_club public.clubs;
  v_transfer public.club_ownership_transfers; v_now TIMESTAMPTZ;
BEGIN
  IF p_accept IS NULL THEN RAISE EXCEPTION 'CLUB_INVALID_INPUT' USING ERRCODE = '22023'; END IF;
  SELECT club_id INTO v_id FROM public.club_ownership_transfers WHERE id = p_transfer_id;
  v_club := club_private.lock_club(v_id);
  SELECT * INTO v_transfer FROM public.club_ownership_transfers WHERE id = p_transfer_id FOR UPDATE;
  IF NOT FOUND OR v_transfer.to_admin_id IS DISTINCT FROM v_user THEN
    RAISE EXCEPTION 'CLUB_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF (p_accept AND v_transfer.status = 'accepted') OR (NOT p_accept AND v_transfer.status = 'declined') THEN RETURN; END IF;
  IF v_transfer.status <> 'pending' THEN RAISE EXCEPTION 'CLUB_TRANSFER_CLOSED' USING ERRCODE = '22023'; END IF;
  v_now := clock_timestamp();
  IF v_transfer.expires_at <= v_now THEN RAISE EXCEPTION 'CLUB_TRANSFER_EXPIRED' USING ERRCODE = '22023'; END IF;
  IF v_club.owner_id <> v_transfer.from_owner_id
     OR club_private.my_role(v_id) IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'CLUB_TRANSFER_CLOSED' USING ERRCODE = '22023';
  END IF;
  IF p_accept THEN
    UPDATE public.clubs SET owner_id = v_user WHERE id = v_id;
    UPDATE public.club_members SET role = 'admin'
    WHERE club_id = v_id AND user_id IN (v_user, v_transfer.from_owner_id);
  END IF;
  UPDATE public.club_ownership_transfers
  SET status = CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END, responded_at = v_now
  WHERE id = p_transfer_id;
END;
$$;

CREATE FUNCTION public.club_cancel_ownership(p_transfer_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE v_id UUID; v_transfer public.club_ownership_transfers;
BEGIN
  SELECT club_id INTO v_id FROM public.club_ownership_transfers WHERE id = p_transfer_id;
  PERFORM club_private.lock_club(v_id);
  IF club_private.my_role(v_id) IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'CLUB_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_transfer FROM public.club_ownership_transfers WHERE id = p_transfer_id FOR UPDATE;
  IF v_transfer.status = 'cancelled' THEN RETURN; END IF;
  IF v_transfer.status <> 'pending' THEN RAISE EXCEPTION 'CLUB_TRANSFER_CLOSED' USING ERRCODE = '22023'; END IF;
  UPDATE public.club_ownership_transfers SET status = 'cancelled', responded_at = clock_timestamp()
  WHERE id = p_transfer_id;
END;
$$;

-- Separate, explicitly confirmed owner action. Account deletion never calls it.
CREATE FUNCTION public.club_dissolve(p_club_id UUID, p_confirm BOOLEAN)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
  PERFORM club_private.lock_club(p_club_id);
  IF club_private.my_role(p_club_id) IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'CLUB_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF p_confirm IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'CLUB_DISSOLUTION_CONFIRMATION_REQUIRED' USING ERRCODE = '22023';
  END IF;
  DELETE FROM public.clubs WHERE id = p_club_id;
END;
$$;

-- Minimal profile projection; no change to profiles grants or policies.
CREATE FUNCTION public.club_list_members(p_club_id UUID)
RETURNS TABLE (user_id UUID, display_name TEXT, avatar_url TEXT, role TEXT, joined_at TIMESTAMPTZ)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
  IF club_private.my_role(p_club_id) IS NULL THEN
    RAISE EXCEPTION 'CLUB_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT m.user_id, p.display_name, p.avatar_url,
    CASE WHEN c.owner_id = m.user_id THEN 'owner' ELSE m.role END, m.joined_at
  FROM public.club_members m JOIN public.profiles p ON p.id = m.user_id
  JOIN public.clubs c ON c.id = m.club_id WHERE m.club_id = p_club_id
  ORDER BY m.joined_at, m.user_id;
END;
$$;

CREATE FUNCTION public.club_list_my_invitations()
RETURNS TABLE (invite_id UUID, club_id UUID, club_name TEXT, club_description TEXT,
  inviter_name TEXT, expires_at TIMESTAMPTZ)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
  SELECT i.id, c.id, c.name, c.description, p.display_name, i.expires_at
  FROM public.club_invites i JOIN public.clubs c ON c.id = i.club_id
  JOIN public.profiles p ON p.id = i.inviter_id
  WHERE i.invitee_id = auth.uid() AND i.status = 'pending' AND i.expires_at > statement_timestamp()
    AND club_private.role_for(i.club_id, i.inviter_id) IN ('owner', 'admin')
  ORDER BY i.created_at DESC, i.id;
$$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA club_private FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION club_private.my_role(UUID) TO authenticated;

-- Revoke Supabase's default function grants only on this migration's new RPCs.
REVOKE ALL ON FUNCTION public.club_create(UUID, TEXT, TEXT),
  public.club_update(UUID, TEXT, TEXT), public.club_invite(UUID, UUID, UUID),
  public.club_respond_invite(UUID, BOOLEAN), public.club_cancel_invite(UUID),
  public.club_member_action(UUID, UUID, TEXT), public.club_propose_ownership(UUID, UUID),
  public.club_respond_ownership(UUID, BOOLEAN), public.club_cancel_ownership(UUID),
  public.club_dissolve(UUID, BOOLEAN), public.club_list_members(UUID), public.club_list_my_invitations()
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.club_create(UUID, TEXT, TEXT),
  public.club_update(UUID, TEXT, TEXT), public.club_invite(UUID, UUID, UUID),
  public.club_respond_invite(UUID, BOOLEAN), public.club_cancel_invite(UUID),
  public.club_member_action(UUID, UUID, TEXT), public.club_propose_ownership(UUID, UUID),
  public.club_respond_ownership(UUID, BOOLEAN), public.club_cancel_ownership(UUID),
  public.club_dissolve(UUID, BOOLEAN), public.club_list_members(UUID), public.club_list_my_invitations()
  TO authenticated;

COMMENT ON TABLE public.clubs IS 'Closed, invitation-only clubs. No relation to ride participation, friendship, or paid access.';
COMMENT ON CONSTRAINT clubs_owner_is_member ON public.clubs IS
  'Every committed club has exactly one non-null owner who is a member. Never disable for account deletion.';
COMMIT;
