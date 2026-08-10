"use client";

import { useState } from "react";

import type { AuthDictionary } from "@/lib/auth-i18n";
import type { Locale } from "@/lib/locales";

type LoginFormProps = {
  action: (formData: FormData) => Promise<void>;
  errorMessage: string | null;
  locale: Locale;
  returnTo: string;
  translations: AuthDictionary;
};

export function LoginForm({
  action,
  errorMessage,
  locale,
  returnTo,
  translations
}: LoginFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  return (
    <form
      action={action}
      className="grid gap-4"
      onSubmit={() => setIsSubmitting(true)}
    >
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="returnTo" value={returnTo} />

      <div className="space-y-2">
        <label htmlFor="email" className="block text-sm font-semibold text-[var(--ink)]">
          {translations.email}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          disabled={isSubmitting}
          aria-describedby={errorMessage ? "login-error" : undefined}
          className="min-h-[52px] w-full rounded-lg border border-white/20 bg-[rgba(6,10,20,0.82)] px-4 text-base text-[var(--ink)] outline-none transition placeholder:text-[var(--muted)] hover:border-white/30 focus-visible:border-[rgba(128,39,130,0.95)] focus-visible:ring-2 focus-visible:ring-[rgba(209,161,255,0.82)] disabled:cursor-wait disabled:opacity-70"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="password" className="block text-sm font-semibold text-[var(--ink)]">
          {translations.password}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          disabled={isSubmitting}
          aria-describedby={errorMessage ? "login-error" : undefined}
          className="min-h-[52px] w-full rounded-lg border border-white/20 bg-[rgba(6,10,20,0.82)] px-4 text-base text-[var(--ink)] outline-none transition placeholder:text-[var(--muted)] hover:border-white/30 focus-visible:border-[rgba(128,39,130,0.95)] focus-visible:ring-2 focus-visible:ring-[rgba(209,161,255,0.82)] disabled:cursor-wait disabled:opacity-70"
        />
      </div>

      {errorMessage ? (
        <div id="login-error" aria-live="polite">
          <p className="rounded-lg border border-[rgba(255,142,154,0.42)] bg-[rgba(92,24,34,0.28)] px-4 py-3 text-sm leading-relaxed text-[#ffc3ca]">
            {errorMessage}
          </p>
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex min-h-[52px] w-full items-center justify-center rounded-lg border border-[rgba(128,39,130,0.9)] bg-[#802782] px-5 text-base font-bold text-white shadow-[0_18px_50px_-28px_rgba(128,39,130,0.9)] transition hover:bg-[#8d3290] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(209,161,255)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0f18] disabled:cursor-wait disabled:opacity-70"
      >
        {isSubmitting ? translations.submitting : translations.submit}
      </button>
    </form>
  );
}
