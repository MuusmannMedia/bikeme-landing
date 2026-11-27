import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { readClubSession } from "@/lib/clubs/server";
import { isClubId } from "@/lib/clubs/types";
import { isLocale } from "@/lib/locales";

export default async function ClubLayout({ children, params }: {
  children: ReactNode;
  params: Promise<{ locale: string; clubId: string }>;
}) {
  const { locale, clubId } = await params;
  if (!isLocale(locale) || !isClubId(clubId)) notFound();
  const session = await readClubSession();
  if (!session) return children;
  return <div key={session.userId + clubId} className="bike-app-club-page">{children}</div>;
}
