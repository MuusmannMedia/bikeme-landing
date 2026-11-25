"use client";

import { useState } from "react";
import {messageText} from "@/lib/messages/web-i18n";
import {removeBrowserPush} from "@/lib/web-push/browser";
import { announceClubAuthTransition } from "@/lib/clubs/auth-events";

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
  const [pushError,setPushError]=useState(false);

  return (
    <form
      action={async (data) => {
        try {await removeBrowserPush();setPushError(false);}catch{setPushError(true);setIsSubmitting(false);return;}
        announceClubAuthTransition("changing");
        try { await action(data); }
        finally { announceClubAuthTransition("settled"); }
      }}
      className="grid gap-4"
      onSubmit={() => setIsSubmitting(true)}
    >
      {pushError?<p role="alert">{messageText(locale,"error")}</p>:null}
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
          className="min-h-[52px] w-full rounded-lg border border-white/20 bg-[rgba(6,10,20,0.82)] px-4 text-base text-[var(--ink)] outline-none transition placeholder:text-[var(--muted)] hover:border-white/30 focus-visible:border-brand-purple/[.95] focus-visible:ring-2 focus-visible:ring-brand-purple-light disabled:cursor-wait disabled:opacity-70"
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
          className="min-h-[52px] w-full rounded-lg border border-white/20 bg-[rgba(6,10,20,0.82)] px-4 text-base text-[var(--ink)] outline-none transition placeholder:text-[var(--muted)] hover:border-white/30 focus-visible:border-brand-purple/[.95] focus-visible:ring-2 focus-visible:ring-brand-purple-light disabled:cursor-wait disabled:opacity-70"
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
        className="inline-flex min-h-[52px] w-full items-center justify-center rounded-lg border border-brand-purple/[.9] bg-brand-purple px-5 text-base font-bold text-white shadow-[0_18px_50px_-28px_rgb(var(--brand-purple-rgb)/0.9)] transition hover:bg-brand-purple-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-light focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0f18] disabled:cursor-wait disabled:opacity-70"
      >
        {isSubmitting ? translations.submitting : translations.submit}
      </button>
    </form>
  );
}
