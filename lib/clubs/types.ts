export type ClubRole = "owner" | "admin" | "member";

// The catalog deliberately has no descriptions, owners or member information.
export type ClubCatalogEntry = { id: string; name: string };
export type ClubRow = ClubCatalogEntry & { description: string | null; owner_id: string; cover_path?:string|null; logo_path?:string|null };
export type ClubMember = {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  role: ClubRole;
  joined_at: string;
};
export type ClubImageShape="cover"|"logo"|"none";
export type Club = Omit<ClubRow,"cover_path"|"logo_path"> & { imageShape?:ClubImageShape; members: ClubMember[]; memberCount: number; role: ClubRole };

export type ClubReadErrorKind = "auth" | "access" | "unavailable" | "network";
export class ClubReadError extends Error {
  constructor(public readonly kind: ClubReadErrorKind) {
    super(kind);
    this.name = "ClubReadError";
  }
}

export function clubReadError(error: unknown): ClubReadError {
  if (error instanceof ClubReadError) return error;
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  if (["28000", "PGRST301", "PGRST302"].includes(code)) return new ClubReadError("auth");
  if (code === "42501") return new ClubReadError("access");
  if (["42P01", "42883", "PGRST202", "PGRST205"].includes(code)) return new ClubReadError("unavailable");
  return new ClubReadError("network");
}

export function isClubId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

import type { ClubMembershipData } from "./membership-types";

export type ClubPageData =
  | { view: "directory"; mine: Club[]; catalog: ClubCatalogEntry[]; membership: ClubMembershipData }
  | { view: "rides"; club: Club; rides: import("./ride-api").ClubRideData }
  | { view: "club"; club: Club; profileEditing?: boolean; membership: ClubMembershipData };
