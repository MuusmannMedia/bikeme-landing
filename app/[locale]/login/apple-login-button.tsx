"use client";

import Image from "next/image";
import { useState } from "react";

import { startAppleOAuth } from "@/lib/apple-auth";
import type { AuthDictionary } from "@/lib/auth-i18n";
import type { Locale } from "@/lib/locales";
import { createClient } from "@/lib/supabase/client";

type AppleLoginButtonProps = {
  locale: Locale;
  returnTo: string;
  translations: AuthDictionary;
};

export function AppleLoginButton({
  locale,
  returnTo,
  translations
}: AppleLoginButtonProps) {
  const [isStarting, setIsStarting] = useState(false);
  const [hasError, setHasError] = useState(false);

  const handleAppleLogin = async () => {
    if (isStarting) {
      return;
    }

    setIsStarting(true);
    setHasError(false);

    const supabase = createClient();
    const started =
      supabase !== null &&
      (await startAppleOAuth(supabase, window.location.origin, locale, returnTo));

    if (!started) {
      setHasError(true);
      setIsStarting(false);
    }
  };

  return (
    <div className="mt-4">
      <div className="flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-white/15" />
        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
          {translations.authDivider}
        </span>
        <span className="h-px flex-1 bg-white/15" />
      </div>

      <button
        type="button"
        disabled={isStarting}
        aria-busy={isStarting}
        aria-label={
          isStarting ? translations.appleLoginLoading : translations.appleLogin
        }
        aria-describedby={hasError ? "apple-login-error" : undefined}
        onClick={() => void handleAppleLogin()}
        className="relative mt-4 inline-flex h-[52px] min-h-[52px] w-full items-center justify-center overflow-hidden rounded-lg border border-transparent bg-white px-3 font-[system-ui] text-[19px] font-medium leading-none text-black transition hover:bg-[#f2f2f2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0f18] disabled:cursor-wait disabled:opacity-65 sm:text-[22px]"
      >
        <span
          aria-hidden="true"
          className={`inline-flex items-center justify-center ${
            isStarting ? "opacity-0" : ""
          }`}
        >
          <Image
            src="/apple-sign-in-logo-white-52@2x.png"
            alt=""
            width={104}
            height={104}
            className="h-[52px] w-[52px] shrink-0"
          />
          <span className="whitespace-nowrap">{translations.appleLogin}</span>
        </span>
        {isStarting ? (
          <span
            aria-hidden="true"
            className="absolute h-5 w-5 animate-spin rounded-full border-2 border-black/25 border-t-black"
          />
        ) : null}
      </button>

      {hasError ? (
        <div id="apple-login-error" aria-live="polite" className="mt-3">
          <p className="text-sm leading-relaxed text-[#ffc3ca]">
            {translations.appleLoginError}
          </p>
        </div>
      ) : null}
    </div>
  );
}
