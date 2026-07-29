import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { buildLoginPath, getSafeDisplayName } from "@/lib/auth";
import { getAuthDictionary } from "@/lib/auth-i18n";
import { isLocale, type Locale } from "@/lib/locales";
import { createClient } from "@/lib/supabase/server";

import { logoutAction } from "./actions";
import { LogoutForm } from "./logout-form";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ProtectedPageProps = {
  params: Promise<{
    locale: string;
  }>;
};

export async function generateMetadata({ params }: ProtectedPageProps): Promise<Metadata> {
  const { locale: localeParam } = await params;
  const locale: Locale = isLocale(localeParam) ? localeParam : "en";
  const translations = getAuthDictionary(locale);

  return {
    title: `${translations.myBikeMe} | Bike Me`,
    description: translations.signedInConfirmation,
    robots: {
      index: false,
      follow: false,
      nocache: true,
      googleBot: {
        index: false,
        follow: false,
        noimageindex: true
      }
    }
  };
}

export default async function ProtectedPage({ params }: ProtectedPageProps) {
  const { locale: localeParam } = await params;

  if (!isLocale(localeParam)) {
    notFound();
  }

  const locale = localeParam;
  const translations = getAuthDictionary(locale);
  let userMetadata: unknown = null;
  let hasVerifiedUser = false;

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error
    } = await supabase.auth.getUser();

    if (!error && user) {
      hasVerifiedUser = true;
      userMetadata = user.user_metadata;
    }
  } catch {
    hasVerifiedUser = false;
  }

  if (!hasVerifiedUser) {
    redirect(buildLoginPath(locale, `/${locale}/app`, "expired"));
  }

  const displayName =
    getSafeDisplayName(userMetadata) ?? translations.neutralUserNameFallback;

  return (
    <main className="section-shell flex min-h-screen items-center justify-center py-10 md:py-16">
      <section className="w-full max-w-[620px] rounded-xl border border-white/20 bg-[linear-gradient(135deg,rgba(27,45,76,0.84),rgba(10,18,32,0.94))] p-5 text-center shadow-[0_32px_90px_-45px_rgba(0,0,0,0.95)] sm:p-9">
        <Image
          src="/brand/bike-me-logo-white.png"
          alt="Bike Me logo"
          width={1024}
          height={1024}
          className="mx-auto h-28 w-28 rounded-full sm:h-32 sm:w-32"
          priority
        />
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.14em] text-[rgb(209,161,255)]">
          {translations.appEyebrow}
        </p>
        <h1 className="mt-3 font-display text-3xl font-bold text-[var(--ink)] sm:text-4xl">
          {translations.myBikeMe}
        </h1>
        <p className="mt-4 text-xl font-semibold text-white">{displayName}</p>
        <p className="mx-auto mt-3 max-w-md leading-relaxed text-[var(--ink-soft)]">
          {translations.signedInConfirmation}
        </p>

        <div className="mx-auto mt-8 max-w-sm space-y-3">
          <LogoutForm action={logoutAction} locale={locale} translations={translations} />
          <Link
            href={`/${locale}`}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-lg px-4 text-sm font-semibold text-[var(--ink-soft)] underline decoration-white/30 underline-offset-4 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(209,161,255)]"
          >
            {translations.backToBikeMe}
          </Link>
        </div>
      </section>
    </main>
  );
}
