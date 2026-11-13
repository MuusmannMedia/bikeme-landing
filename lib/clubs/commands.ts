import type { SupabaseClient } from "@supabase/supabase-js";
import { createClubReadApi } from "./api";
import { createClubMembershipApi } from "./membership-api";
import { ClubError, allowedMemberActions, type ClubCommand } from "./membership-types";
import { isClubId } from "./types";

const actions = ["invite", "proposeMember", "resolveProposal", "respondInvite", "cancelInvite", "leave", "memberAction", "proposeOwnership", "respondOwnership", "cancelOwnership"];
export function parseClubCommand(value: unknown): ClubCommand {
  if (!value || typeof value !== "object") throw new ClubError("invalid");
  const v = value as Record<string, unknown>;
  const uuid = (key: string) => typeof v[key] === "string" && isClubId(v[key] as string);
  if (Object.keys(v).some(key => !["actorId", "requestId", "action", "clubId", "targetId", "id", "decision", "accept"].includes(key)) ||
      !uuid("actorId") || !uuid("requestId") || !actions.includes(String(v.action))) throw new ClubError("invalid");
  if (["invite", "proposeMember", "leave", "memberAction", "proposeOwnership", "resolveProposal"].includes(String(v.action)) && !uuid("clubId")) throw new ClubError("invalid");
  if (["invite", "proposeMember", "memberAction", "proposeOwnership"].includes(String(v.action)) && !uuid("targetId")) throw new ClubError("invalid");
  if (["resolveProposal", "respondInvite", "cancelInvite", "respondOwnership", "cancelOwnership"].includes(String(v.action)) && !uuid("id")) throw new ClubError("invalid");
  if (["respondInvite", "respondOwnership"].includes(String(v.action)) && typeof v.accept !== "boolean") throw new ClubError("invalid");
  if (v.action === "resolveProposal" && !["approve", "reject", "cancel"].includes(String(v.decision))) throw new ClubError("invalid");
  if (v.action === "memberAction" && !["make_admin", "make_member", "remove"].includes(String(v.decision))) throw new ClubError("invalid");
  return { ...v } as ClubCommand;
}

// Uses a request-local, verified actor, never a role supplied by the browser.
// The RPC checks authority again under its transaction's club lock.
export async function executeClubCommand(client: SupabaseClient, userId: string, input: unknown) {
  const c = parseClubCommand(input);
  if (c.actorId !== userId) throw new ClubError("auth");
  const api = createClubMembershipApi(client, userId);
  if (["invite", "proposeMember", "leave", "memberAction", "proposeOwnership", "resolveProposal"].includes(c.action)) {
    const club = await createClubReadApi(client, userId).detail(c.clubId!);
    if (c.action === "invite" && club.role === "member") throw new ClubError("access");
    if (c.action === "proposeMember" && club.role !== "member") throw new ClubError("access");
    if (c.action === "leave" && club.role === "owner") throw new ClubError("ownerMustTransfer");
    if (c.action === "proposeOwnership") {
      if (club.role !== "owner") throw new ClubError("access");
      if (!club.members.some(m => m.user_id === c.targetId && m.role === "admin")) throw new ClubError("targetMustBeAdmin");
    }
    if (c.action === "memberAction") {
      const target = club.members.find(m => m.user_id === c.targetId);
      if (target ? !allowedMemberActions(club, userId, target).includes(c.decision as "remove") : c.decision !== "remove" || club.role === "member") throw new ClubError("access");
    }
    if (c.action === "resolveProposal" && c.decision !== "cancel" && club.role === "member") throw new ClubError("access");
  }
  switch (c.action) {
    case "invite": return api.invite(c.clubId!, c.targetId!, c.requestId);
    case "proposeMember": return api.proposeMember(c.clubId!, c.targetId!, c.requestId);
    case "resolveProposal": return api.resolveProposal(c.id!, c.decision as "approve" | "reject" | "cancel");
    case "respondInvite": return api.respond(c.id!, c.accept!);
    case "cancelInvite": return api.cancelInvitation(c.id!);
    case "leave": return api.leave(c.clubId!);
    case "memberAction": return api.memberAction(c.clubId!, c.targetId!, c.decision as "make_admin" | "make_member" | "remove");
    case "proposeOwnership": return api.proposeOwnership(c.clubId!, c.targetId!);
    case "respondOwnership": return api.respondOwnership(c.id!, c.accept!);
    case "cancelOwnership": return api.cancelOwnership(c.id!);
  }
}
