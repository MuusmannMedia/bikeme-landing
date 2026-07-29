"use client";

import { useState } from "react";

import type { AuthDictionary } from "@/lib/auth-i18n";
import type { Locale } from "@/lib/locales";

type LogoutFormProps = {
  action: (formData: FormData) => Promise<void>;
  locale: Locale;
  translations: AuthDictionary;
};

export function LogoutForm({ action, locale, translations }: LogoutFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  return (
    <form action={action} onSubmit={() => setIsSubmitting(true)}>
      <input type="hidden" name="locale" value={locale} />
      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex min-h-[52px] w-full items-center justify-center rounded-lg border border-white/24 bg-white/[0.05] px-5 text-base font-bold text-white transition hover:border-[rgba(128,39,130,0.82)] hover:bg-[rgba(128,39,130,0.18)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(209,161,255)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0f18] disabled:cursor-wait disabled:opacity-70"
      >
        {isSubmitting ? translations.loggingOut : translations.logOut}
      </button>
    </form>
  );
}
