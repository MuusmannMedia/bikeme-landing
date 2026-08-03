import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { loadViewer } from "@/lib/app-data";
import { getAppDictionary } from "@/lib/app-i18n";
import { buildLoginPath } from "@/lib/auth";
import { getAuthDictionary } from "@/lib/auth-i18n";
import { isLocale } from "@/lib/locales";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false, noimageindex: true }
  }
};

export default async function AuthenticatedAppLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: localeParam } = await params;
  if (!isLocale(localeParam)) notFound();
  const locale = localeParam;
  const client = await createClient();
  let viewer;
  try {
    viewer = await loadViewer(client);
  } catch {
    redirect(buildLoginPath(locale, `/${locale}/app`, "expired"));
  }
  const t = getAppDictionary(locale);
  const displayName = viewer.profile.displayName ?? getAuthDictionary(locale).neutralUserNameFallback;
  return <AppShell locale={locale} viewer={viewer} displayName={displayName} t={t}>{children}</AppShell>;
}
