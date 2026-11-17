import { ClubReadError, type Club, type ClubMember } from "./types";
export type ClubPerson = { id: string; display_name: string | null; avatar_url: string | null; is_member?: boolean; has_invitation?: boolean; has_proposal?: boolean };
export type ClubMemberProposal = { id: string; invitee_id: string; invitee_name: string | null; invitee_avatar: string | null; proposer_id: string; proposer_name: string | null; created_at: string; expires_at: string };
export type ClubInvitation = { invite_id: string; club_id: string; club_name: string; club_description: string | null; inviter_name: string | null; expires_at: string };
export type PendingClubInvitation = { invite_id: string; invitee_id: string; invitee_name: string | null; created_at: string; expires_at: string };
export type ClubMemberAction = "make_admin" | "make_member" | "remove";
export type ClubOwnershipTransfer = { id: string; club_id: string; club_name: string; from_owner_id: string; to_admin_id: string; expires_at: string };
export type ClubErrorKind = "image" | "unavailable" | "auth" | "access" | "invalid" | "network" | "expired" | "closed" | "alreadyMember" | "ownerMustTransfer" | "conflict" | "transferExpired" | "transferClosed" | "transferPending" | "targetMustBeAdmin" | "notMember" | "rideUnavailable" | "rideInviteProcessed" | "proposalClosed" | "proposalPending" | "proposalExpired";
export class ClubError extends Error {
  constructor(public readonly kind: ClubErrorKind) { super(kind); }
}

export function clubError(error: unknown): ClubError {
  if (error instanceof ClubError) return error;
  if (error instanceof ClubReadError) return new ClubError(error.kind==="quota"?"network":error.kind);
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  const message = typeof error === "object" && error && "message" in error ? String(error.message) : "";
  if (message === "CLUB_INVALID_IMAGE") return new ClubError("image");
  if (message === "CLUB_RIDE_INVITE_UNAVAILABLE") return new ClubError("rideUnavailable");
  if (message === "CLUB_RIDE_INVITE_PROCESSED") return new ClubError("rideInviteProcessed");
  if (message === "CLUB_PROPOSAL_EXPIRED") return new ClubError("proposalExpired");
  if (message === "CLUB_PROPOSAL_CLOSED") return new ClubError("proposalClosed");
  if (["CLUB_PROPOSAL_PENDING", "CLUB_INVITATION_PENDING"].includes(message)) return new ClubError("proposalPending");
  if (message === "CLUB_INVITE_EXPIRED") return new ClubError("expired");
  if (message === "CLUB_INVITE_CLOSED") return new ClubError("closed");
  if (message === "CLUB_ALREADY_MEMBER") return new ClubError("alreadyMember");
  if (message === "CLUB_OWNER_MUST_TRANSFER") return new ClubError("ownerMustTransfer");
  if (message === "CLUB_TRANSFER_EXPIRED") return new ClubError("transferExpired");
  if (message === "CLUB_TRANSFER_CLOSED") return new ClubError("transferClosed");
  if (message === "CLUB_TRANSFER_PENDING") return new ClubError("transferPending");
  if (message === "CLUB_TARGET_MUST_BE_ADMIN") return new ClubError("targetMustBeAdmin");
  if (message === "CLUB_NOT_MEMBER") return new ClubError("notMember");
  if (message === "CLUB_PROFILE_CHANGED" || ["40001", "40P01"].includes(code)) return new ClubError("conflict");
  if (["42P01", "42883", "PGRST202", "PGRST205"].includes(code)) return new ClubError("unavailable");
  if (["28000", "PGRST301", "PGRST302"].includes(code)) return new ClubError("auth");
  if (code === "42501") return new ClubError("access");
  if (code === "22023") return new ClubError("invalid");
  return new ClubError("network");
}


export function allowedMemberActions(club: Club, actor: string, target: ClubMember): ClubMemberAction[] {
  if (actor === target.user_id || target.role === "owner") return [];
  if (club.role === "owner") return [target.role === "admin" ? "make_member" : "make_admin", "remove"];
  return club.role === "admin" && target.role === "member" ? ["remove"] : [];
}
export type ClubMembershipData = { invitations: ClubInvitation[]; pending: PendingClubInvitation[]; proposals: ClubMemberProposal[]; transfers: ClubOwnershipTransfer[] };
export type ClubCommand = { actorId: string; requestId: string; action: "invite" | "proposeMember" | "resolveProposal" | "respondInvite" | "cancelInvite" | "leave" | "memberAction" | "proposeOwnership" | "respondOwnership" | "cancelOwnership"; clubId?: string; targetId?: string; id?: string; decision?: string; accept?: boolean };

// Unknown intermediary/gateway error payloads are uncertain outcomes, never a
// confirmed business rejection that could release the request identity.
export function clubResponseError(value: unknown): ClubError {
  const known: readonly string[] = ["unavailable","auth","access","invalid","network","expired","closed","alreadyMember","ownerMustTransfer","conflict","transferExpired","transferClosed","transferPending","targetMustBeAdmin","notMember","proposalClosed","proposalPending","proposalExpired"];
  return new ClubError(typeof value === "string" && known.includes(value) ? value as ClubErrorKind : "network");
}
