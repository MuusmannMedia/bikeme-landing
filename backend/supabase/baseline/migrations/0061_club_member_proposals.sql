-- Additive member suggestions. Existing club_invite/accept remains authoritative.
BEGIN;
CREATE TABLE club_private.member_proposals (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
 proposer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 invitee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 request_key uuid NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','approved','rejected','cancelled','expired')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 expires_at timestamptz NOT NULL DEFAULT (clock_timestamp()+interval '168 hours'),
 resolved_at timestamptz, resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 invitation_id uuid REFERENCES public.club_invites(id) ON DELETE SET NULL,
 UNIQUE(club_id,proposer_id,request_key), CHECK(proposer_id<>invitee_id)
);
CREATE UNIQUE INDEX member_proposal_pending ON club_private.member_proposals(club_id,invitee_id) WHERE status='pending';
ALTER TABLE club_private.member_proposals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON club_private.member_proposals FROM PUBLIC,anon,authenticated;

CREATE FUNCTION club_private.cancel_member_proposals() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 UPDATE club_private.member_proposals SET status='cancelled',resolved_at=clock_timestamp()
 WHERE club_id=OLD.club_id AND proposer_id=OLD.user_id AND status='pending';
 RETURN OLD;
END $$;
CREATE TRIGGER cancel_member_proposals AFTER DELETE ON public.club_members FOR EACH ROW EXECUTE FUNCTION club_private.cancel_member_proposals();

-- Direct invitations and approvals converge on the same invitation. No push.
CREATE FUNCTION club_private.resolve_invited_proposals() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF NEW.status='pending' THEN
  UPDATE club_private.member_proposals SET status='approved',resolved_at=clock_timestamp(),resolved_by=NEW.inviter_id,invitation_id=NEW.id
  WHERE club_id=NEW.club_id AND invitee_id=NEW.invitee_id AND status='pending' AND expires_at>clock_timestamp()
   AND club_private.role_for(club_id,proposer_id) IS NOT NULL;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER resolve_invited_proposals AFTER INSERT ON public.club_invites FOR EACH ROW EXECUTE FUNCTION club_private.resolve_invited_proposals();

CREATE FUNCTION public.club_search_invitees(p_club_id uuid,p_query text)
 RETURNS TABLE(id uuid,display_name text,avatar_url text,is_member boolean,has_invitation boolean,has_proposal boolean)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 PERFORM club_private.require_user();
 IF club_private.my_role(p_club_id) IS NULL THEN RAISE EXCEPTION 'CLUB_FORBIDDEN' USING ERRCODE='42501'; END IF;
 IF char_length(btrim(coalesce(p_query,'')))<3 THEN RETURN; END IF;
 RETURN QUERY SELECT r.id,r.display_name,r.avatar_url,
 club_private.role_for(p_club_id,r.id) IS NOT NULL,
 EXISTS(SELECT 1 FROM public.club_invites i WHERE i.club_id=p_club_id AND i.invitee_id=r.id AND i.status='pending' AND i.expires_at>statement_timestamp() AND club_private.role_for(i.club_id,i.inviter_id) IN('owner','admin')),
 EXISTS(SELECT 1 FROM club_private.member_proposals s WHERE s.club_id=p_club_id AND s.invitee_id=r.id AND s.status='pending' AND s.expires_at>statement_timestamp() AND club_private.role_for(s.club_id,s.proposer_id) IS NOT NULL)
 FROM public.search_riders(btrim(p_query),20) r;
END $$;

CREATE FUNCTION public.club_list_member_proposals(p_club_id uuid)
 RETURNS TABLE(id uuid,invitee_id uuid,invitee_name text,invitee_avatar text,proposer_id uuid,proposer_name text,created_at timestamptz,expires_at timestamptz)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_actor uuid:=club_private.require_user(); v_role text:=club_private.my_role(p_club_id);
BEGIN
 IF v_role IS NULL THEN RAISE EXCEPTION 'CLUB_FORBIDDEN' USING ERRCODE='42501'; END IF;
 RETURN QUERY SELECT s.id,s.invitee_id,t.display_name,t.avatar_url,s.proposer_id,p.display_name,s.created_at,s.expires_at
 FROM club_private.member_proposals s JOIN public.profiles t ON t.id=s.invitee_id JOIN public.profiles p ON p.id=s.proposer_id
 WHERE s.club_id=p_club_id AND s.status='pending' AND s.expires_at>statement_timestamp()
 AND club_private.role_for(s.club_id,s.proposer_id) IS NOT NULL
 AND (v_role IN('owner','admin') OR s.proposer_id=v_actor)
 ORDER BY s.created_at DESC,s.id;
END $$;

CREATE FUNCTION public.club_propose_member(p_club_id uuid,p_invitee_id uuid,p_request_key uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_actor uuid:=club_private.require_user(); s club_private.member_proposals; v_now timestamptz;
BEGIN
 PERFORM club_private.lock_club(p_club_id);
 IF club_private.my_role(p_club_id) IS DISTINCT FROM 'member' THEN RAISE EXCEPTION 'CLUB_FORBIDDEN' USING ERRCODE='42501'; END IF;
 IF p_request_key IS NULL OR p_invitee_id IS NULL OR p_invitee_id=v_actor OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_invitee_id) THEN RAISE EXCEPTION 'CLUB_INVALID_INPUT' USING ERRCODE='22023'; END IF;
 SELECT * INTO s FROM club_private.member_proposals WHERE club_id=p_club_id AND proposer_id=v_actor AND request_key=p_request_key;
 IF FOUND THEN
  IF s.invitee_id<>p_invitee_id THEN RAISE EXCEPTION 'CLUB_IDEMPOTENCY_CONFLICT' USING ERRCODE='22023'; END IF;
  RETURN jsonb_build_object('id',s.id,'status',CASE WHEN s.status='pending' AND s.expires_at<=clock_timestamp() THEN 'expired' ELSE s.status END);
 END IF;
 IF club_private.role_for(p_club_id,p_invitee_id) IS NOT NULL THEN RAISE EXCEPTION 'CLUB_ALREADY_MEMBER' USING ERRCODE='22023'; END IF;
 v_now:=clock_timestamp();
 IF EXISTS(SELECT 1 FROM public.club_invites i WHERE club_id=p_club_id AND invitee_id=p_invitee_id AND status='pending' AND expires_at>v_now AND club_private.role_for(i.club_id,i.inviter_id) IN('owner','admin')) THEN RAISE EXCEPTION 'CLUB_INVITATION_PENDING' USING ERRCODE='22023'; END IF;
 UPDATE club_private.member_proposals SET status='expired',resolved_at=v_now WHERE club_id=p_club_id AND status='pending' AND expires_at<=v_now;
 SELECT * INTO s FROM club_private.member_proposals WHERE club_id=p_club_id AND invitee_id=p_invitee_id AND status='pending';
 IF FOUND THEN
  IF s.proposer_id<>v_actor THEN RAISE EXCEPTION 'CLUB_PROPOSAL_PENDING' USING ERRCODE='22023'; END IF;
 ELSE
  INSERT INTO club_private.member_proposals(club_id,proposer_id,invitee_id,request_key,created_at,expires_at)
   VALUES(p_club_id,v_actor,p_invitee_id,p_request_key,v_now,v_now+interval '168 hours') RETURNING * INTO s;
 END IF;
 RETURN jsonb_build_object('id',s.id,'status',s.status);
END $$;

CREATE FUNCTION public.club_resolve_member_proposal(p_proposal_id uuid,p_action text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_actor uuid:=club_private.require_user(); v_club uuid; v_role text; s club_private.member_proposals; v_status text; v_invitation uuid;
BEGIN
 SELECT club_id INTO v_club FROM club_private.member_proposals WHERE id=p_proposal_id;
 PERFORM club_private.lock_club(v_club);
 v_role:=club_private.my_role(v_club);
 SELECT * INTO s FROM club_private.member_proposals WHERE id=p_proposal_id FOR UPDATE;
 IF v_role IS NULL OR (p_action='cancel' AND s.proposer_id<>v_actor) OR (p_action IN('approve','reject') AND v_role NOT IN('owner','admin')) THEN RAISE EXCEPTION 'CLUB_FORBIDDEN' USING ERRCODE='42501'; END IF;
 IF p_action IS NULL OR p_action NOT IN('approve','reject','cancel') THEN RAISE EXCEPTION 'CLUB_INVALID_INPUT' USING ERRCODE='22023'; END IF;
 v_status:=CASE p_action WHEN 'approve' THEN 'approved' WHEN 'reject' THEN 'rejected' ELSE 'cancelled' END;
 IF s.status=v_status THEN RETURN jsonb_build_object('status',s.status,'invitation_id',s.invitation_id); END IF;
 IF s.status<>'pending' THEN RAISE EXCEPTION 'CLUB_PROPOSAL_CLOSED' USING ERRCODE='22023'; END IF;
 IF s.expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'CLUB_PROPOSAL_EXPIRED' USING ERRCODE='22023'; END IF;
 IF club_private.role_for(s.club_id,s.proposer_id) IS NULL THEN RAISE EXCEPTION 'CLUB_PROPOSAL_CLOSED' USING ERRCODE='22023'; END IF;
 IF p_action='approve' THEN
  -- The approver is the authenticated inviter; existing restrictions/expiry apply.
  v_invitation:=public.club_invite(s.club_id,s.invitee_id,s.id);
 END IF;
 UPDATE club_private.member_proposals SET status=v_status,resolved_at=clock_timestamp(),resolved_by=v_actor,invitation_id=v_invitation WHERE id=s.id;
 RETURN jsonb_build_object('status',v_status,'invitation_id',v_invitation);
END $$;
REVOKE ALL ON FUNCTION club_private.cancel_member_proposals(),club_private.resolve_invited_proposals() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.club_search_invitees(uuid,text),public.club_list_member_proposals(uuid),public.club_propose_member(uuid,uuid,uuid),public.club_resolve_member_proposal(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.club_search_invitees(uuid,text),public.club_list_member_proposals(uuid),public.club_propose_member(uuid,uuid,uuid),public.club_resolve_member_proposal(uuid,text) TO authenticated;
COMMIT;
