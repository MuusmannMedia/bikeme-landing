import type { SupabaseClient } from "@supabase/supabase-js";
import { ClubError, clubError, type ClubInvitation, type PendingClubInvitation, type ClubMemberProposal, type ClubPerson, type ClubOwnershipTransfer } from "./membership-types";

export function createClubMembershipApi(client: SupabaseClient, userId: string) {
  async function authorization() {
    const {data,error}=await client.auth.getSession();
    if(error||!data.session||data.session.user.id!==userId)throw new ClubError("auth");
    return `Bearer ${data.session.access_token}`;
  }
  async function bounded<T>(query:(signal:AbortSignal)=>PromiseLike<T>):Promise<T>{
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),20000);
    try{return await query(controller.signal)}catch(e){throw clubError(e)}finally{clearTimeout(timer)}
  }
  async function pages<T>(query:(offset:number)=>PromiseLike<{data:unknown;error:unknown}>):Promise<T[]>{
    const rows:T[]=[];for(let offset=0;;offset+=200){const {data,error}=await query(offset);if(error)throw clubError(error);if(!Array.isArray(data))throw new ClubError("network");rows.push(...data);if(data.length<200)return rows}
  }
  async function mutation(name:string,args:Record<string,unknown>){const header=await authorization();const {data,error}=await bounded(signal=>client.rpc(name,args).setHeader("Authorization",header).abortSignal(signal));if(error)throw clubError(error);return data}
  return {
    async invitations() {
      const header = await authorization();
      return pages<ClubInvitation>(offset => bounded(signal => client.rpc("club_list_my_invitations")
        .setHeader("Authorization", header).range(offset, offset + 199).abortSignal(signal)));
    },
    async pendingInvitations(clubId: string) {
      const header = await authorization();
      return pages<PendingClubInvitation>(offset => bounded(signal => client.rpc("club_list_pending_invitations", { p_club_id: clubId })
        .setHeader("Authorization", header).range(offset, offset + 199).abortSignal(signal)));
    },
    async proposals(clubId: string) {
      const header = await authorization();
      return pages<ClubMemberProposal>(offset => bounded(signal => client.rpc("club_list_member_proposals", { p_club_id: clubId })
        .setHeader("Authorization", header).range(offset, offset + 199).abortSignal(signal)));
    },
    async proposeMember(clubId: string, personId: string, key: string) {
      const data = await mutation("club_propose_member", { p_club_id: clubId, p_invitee_id: personId, p_request_key: key });
      if (data?.status === "expired") throw new ClubError("proposalExpired");
      if (data?.status !== "pending") throw new ClubError("proposalClosed");
    },
    async resolveProposal(proposalId: string, action: "approve" | "reject" | "cancel") {
      const data = await mutation("club_resolve_member_proposal", { p_proposal_id: proposalId, p_action: action });
      if (data?.status !== ({ approve: "approved", reject: "rejected", cancel: "cancelled" }[action])) throw new ClubError("closed");
    },
    async searchPeople(query: string, clubId: string) {
      const search = query.trim();
      if (Array.from(search).length < 3) return [];
      const header = await authorization();
      const { data, error } = await bounded(signal => client.rpc("club_search_invitees", { p_club_id: clubId, p_query: search })
        .setHeader("Authorization", header).abortSignal(signal));
      if (error) throw clubError(error);
      if (!Array.isArray(data)) throw new ClubError("network");
      return data.map((p: ClubPerson) => ({id:p.id,display_name:p.display_name,avatar_url:p.avatar_url,is_member:p.is_member,has_invitation:p.has_invitation,has_proposal:p.has_proposal}));
    },
    async invite(clubId: string, personId: string, key: string) {
      const id = await mutation("club_invite", { p_club_id: clubId, p_invitee_id: personId, p_request_key: key });
      if (typeof id !== "string") throw new ClubError("network");
      // An idempotent retry may return an old, already processed invitation.
      // Verify its current state instead of reporting a new invitation as sent.
      const header = await authorization();
      const { data, error } = await bounded(signal => client.from("club_invites").select("status,expires_at")
        .eq("id", id).setHeader("Authorization", header).abortSignal(signal).maybeSingle());
      if (error) throw clubError(error);
      if (!data || data.status !== "pending") throw new ClubError("closed");
      if (Date.parse(data.expires_at) <= Date.now()) throw new ClubError("expired");
    },
    async respond(inviteId: string, accept: boolean) {
      await mutation("club_respond_invite", { p_invite_id: inviteId, p_accept: accept });
    },
    async cancelInvitation(inviteId: string) {
      await mutation("club_cancel_invite", { p_invite_id: inviteId });
    },
    async leave(clubId: string) {
      await mutation("club_member_action", { p_club_id: clubId, p_user_id: userId, p_action: "leave" });
    },
    async memberAction(clubId: string, memberId: string, action: "make_admin" | "make_member" | "remove") {
      await mutation("club_member_action", { p_club_id: clubId, p_user_id: memberId, p_action: action });
    },
    async ownershipTransfers() {
      const header = await authorization();
      // Existing party-only RLS and member-only club RLS apply to this join.
      // Names come from clubs, not a wider profiles grant. Expired rows remain
      // visible as information; only the server decides whether an action is valid.
      const rows = await pages<ClubOwnershipTransfer & { clubs: { name: string } }>(offset => bounded(signal =>
        client.from("club_ownership_transfers").select("id,club_id,from_owner_id,to_admin_id,expires_at,clubs!inner(name)")
          .eq("status", "pending").order("created_at", { ascending: false }).order("id")
          .range(offset, offset + 199).setHeader("Authorization", header).abortSignal(signal)));
      return rows.map(({ clubs, ...row }) => ({ ...row, club_name: clubs.name }));
    },
    async proposeOwnership(clubId: string, adminId: string) {
      const id = await mutation("club_propose_ownership", { p_club_id: clubId, p_admin_id: adminId });
      if (typeof id !== "string") throw new ClubError("network");
      const header = await authorization();
      const { data, error } = await bounded(signal => client.from("club_ownership_transfers").select("status,expires_at")
        .eq("id", id).eq("club_id", clubId).eq("from_owner_id", userId).eq("to_admin_id", adminId)
        .setHeader("Authorization", header).abortSignal(signal).maybeSingle());
      if (error) throw clubError(error);
      if (!data || data.status !== "pending") throw new ClubError("transferClosed");
      if (Date.parse(data.expires_at) <= Date.now()) throw new ClubError("transferExpired");
    },
    async respondOwnership(transferId: string, accept: boolean) {
      await mutation("club_respond_ownership", { p_transfer_id: transferId, p_accept: accept });
    },
    async cancelOwnership(transferId: string) {
      await mutation("club_cancel_ownership", { p_transfer_id: transferId });
    }
  };
}
