import { notFound, redirect } from "next/navigation";

import { isClubId } from "@/lib/clubs/types";
import { isLocale } from "@/lib/locales";
import { messagesEntryPath } from "@/lib/messages/entry";

export const dynamic = "force-dynamic";

export default async function MessagesRedirect({ params, searchParams }: {
  params: Promise<{ locale: string; conversationId?: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale, conversationId } = await params;
  if (!isLocale(locale) || (conversationId && !isClubId(conversationId))) notFound();
  const { peer, message } = await searchParams;
  if (conversationId) {
    redirect(messagesEntryPath(locale, {
      kind: "conversation",
      id: conversationId,
      message: typeof message === "string" && isClubId(message) ? message : undefined,
    }));
  }
  if (typeof peer === "string" && isClubId(peer)) {
    redirect(messagesEntryPath(locale, { kind: "recipient", peer }));
  }
  redirect(messagesEntryPath(locale, { kind: "inbox" }));
}
