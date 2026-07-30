import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getAuthErrorCode, getSafeReturnPath } from "@/lib/auth";
import { getAuthDictionary } from "@/lib/auth-i18n";
import { isLocale, type Locale } from "@/lib/locales";

import { loginAction } from "./actions";
import { AppleLoginButton } from "./apple-login-button";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type LoginPageProps = {
  params: Promise<{
    locale: string;
  }>;
  searchParams: Promise<{
    error?: string | string[];
    returnTo?: string | string[];
  }>;
};

export async function generateMetadata({ params }: LoginPageProps): Promise<Metadata> {
  const { locale: localeParam } = await params;
  const locale: Locale = isLocale(localeParam) ? localeParam : "en";
  const translations = getAuthDictionary(locale);

  return {
    title: `${translations.loginTitle} | Bike Me`,
    description: translations.loginIntro,
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

export default async function LoginPage({ params, searchParams }: LoginPageProps) {
  const [{ locale: localeParam }, query] = await Promise.all([params, searchParams]);

  if (!isLocale(localeParam)) {
    notFound();
  }

  const locale = localeParam;
  const translations = getAuthDictionary(locale);
  const errorParam = Array.isArray(query.error) ? query.error[0] : query.error;
  const returnParam = Array.isArray(query.returnTo) ? query.returnTo[0] : query.returnTo;
  const errorCode = getAuthErrorCode(errorParam);
  const returnTo = getSafeReturnPath(locale, returnParam);
  const errorMessage =
    errorCode === "invalid"
      ? translations.invalidCredentials
      : errorCode === "expired"
        ? translations.sessionExpired
        : errorCode === "apple"
          ? translations.appleLoginError
          : errorCode === "generic"
            ? translations.genericError
            : null;

  return (
    <main className="section-shell flex min-h-screen items-center justify-center py-10 md:py-16">
      <section className="w-full max-w-[520px]">
        <div className="rounded-xl border border-white/20 bg-[linear-gradient(135deg,rgba(27,45,76,0.84),rgba(10,18,32,0.94))] p-5 shadow-[0_32px_90px_-45px_rgba(0,0,0,0.95)] sm:p-8">
          <div className="mb-7 flex flex-col items-center text-center">
            <Image
              src="/brand/bike-me-logo-white.png"
              alt="Bike Me logo"
              width={1024}
              height={1024}
              className="h-28 w-28 rounded-full sm:h-32 sm:w-32"
              priority
            />
            <p className="mt-5 text-xs font-semibold uppercase tracking-[0.14em] text-[rgb(209,161,255)]">
              {translations.loginEyebrow}
            </p>
            <h1 className="mt-3 font-display text-3xl font-bold text-[var(--ink)] sm:text-4xl">
              {translations.loginTitle}
            </h1>
            <p className="mt-3 max-w-sm leading-relaxed text-[var(--ink-soft)]">
              {translations.loginIntro}
            </p>
          </div>

          <LoginForm
            action={loginAction}
            errorMessage={errorMessage}
            locale={locale}
            returnTo={returnTo}
            translations={translations}
          />

          <AppleLoginButton
            locale={locale}
            returnTo={returnTo}
            translations={translations}
          />

          <Link
            href={`/${locale}`}
            className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-lg px-4 text-sm font-semibold text-[var(--ink-soft)] underline decoration-white/30 underline-offset-4 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(209,161,255)]"
          >
            {translations.backToBikeMe}
          </Link>
        </div>
      </section>
    </main>
  );
}
