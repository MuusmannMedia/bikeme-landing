import { isClubId } from "../clubs/types";
import type { Locale } from "../locales";

export type MessagesEntry =
  | { kind: "inbox" }
  | { kind: "recipient"; peer: string }
  | { kind: "conversation"; id: string; message?: string };

export function messagesEntryPath(locale: Locale, entry: MessagesEntry) {
  const params = new URLSearchParams();
  if (entry.kind === "conversation") {
    params.set("dm", entry.id);
    if (entry.message) params.set("dmMessage", entry.message);
  } else {
    params.set("dm", "inbox");
    if (entry.kind === "recipient") params.set("dmPeer", entry.peer);
  }
  return `/${locale}/app?${params}`;
}

export function messagesEntryFromSearch(params: Pick<URLSearchParams, "get">): MessagesEntry | null {
  const target = params.get("dm") ?? "";
  if (isClubId(target)) {
    const message = params.get("dmMessage") ?? "";
    return { kind: "conversation", id: target, message: isClubId(message) ? message : undefined };
  }
  if (target !== "inbox") return null;
  const peer = params.get("dmPeer") ?? "";
  return isClubId(peer) ? { kind: "recipient", peer } : { kind: "inbox" };
}
