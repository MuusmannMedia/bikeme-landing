"use client";

import {messageText} from "@/lib/messages/web-i18n";
import {removeBrowserPush} from "@/lib/web-push/browser";
import { useState } from "react";
import { announceClubAuthTransition } from "@/lib/clubs/auth-events";

import type { AuthDictionary } from "@/lib/auth-i18n";
import type { Locale } from "@/lib/locales";

type LogoutFormProps = {
  action: (formData: FormData) => Promise<void>;
  locale: Locale;
  translations: AuthDictionary;
};

export function LogoutForm({ action, locale, translations }: LogoutFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pushError,setPushError]=useState(false);

  return (
    <form action={async (data) => {
        try {await removeBrowserPush();setPushError(false);}catch{setPushError(true);setIsSubmitting(false);return;}
        announceClubAuthTransition("changing");
        try { await action(data); }
        finally { announceClubAuthTransition("settled"); }
      }} onSubmit={() => setIsSubmitting(true)}>
      {pushError?<p role="alert">{messageText(locale,"error")}</p>:null}
      <input type="hidden" name="locale" value={locale} />
      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex min-h-[52px] w-full items-center justify-center rounded-lg border border-white/24 bg-white/[0.05] px-5 text-base font-bold text-white transition hover:border-brand-purple/[.82] hover:bg-brand-purple/[.18] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple-light focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0f18] disabled:cursor-wait disabled:opacity-70"
      >
        {isSubmitting ? translations.loggingOut : translations.logOut}
      </button>
    </form>
  );
}
