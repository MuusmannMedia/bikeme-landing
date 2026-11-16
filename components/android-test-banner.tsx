import Link from "next/link";

import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/locales";

type AndroidTestBannerProps = {
  locale: Locale;
  copy: Dictionary["androidTester"]["banner"];
};

export function AndroidTestBanner({ locale, copy }: AndroidTestBannerProps) {
  return (
    <section id="android-test" className="section-shell scroll-mt-28 pb-20 md:pb-24" aria-labelledby="android-test-banner-title">
      <div className="bike-inset glass-panel relative overflow-hidden rounded-3xl border px-5 py-7 shadow-[0_28px_70px_-48px_rgba(128,39,130,0.9)] sm:px-7 md:py-8 lg:flex lg:items-center lg:justify-between lg:gap-10 lg:px-9">
        <div className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full bg-[#802782]/20 blur-3xl" />
        <div className="relative max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[rgb(147,171,255)]">
            {copy.eyebrow}
          </p>
          <h2 id="android-test-banner-title" className="mt-3 font-display text-2xl font-semibold leading-tight text-[var(--ink)] sm:text-3xl">
            {copy.title}
          </h2>
          <p className="mt-2 leading-relaxed text-[var(--ink-soft)] sm:text-lg">{copy.body}</p>
        </div>

        <Link
          href={`/${locale}/android-test`}
          className="relative mt-6 inline-flex min-h-12 w-full shrink-0 items-center justify-center rounded-full border-2 border-[rgba(143,168,255,0.75)] bg-[linear-gradient(135deg,rgba(94,127,255,0.9),rgba(128,39,130,0.85))] px-6 py-3 text-center text-sm font-semibold text-white shadow-[0_18px_45px_-24px_rgba(128,39,130,0.95)] transition hover:scale-[1.01] hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(209,161,255)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#081022] sm:w-auto lg:mt-0"
        >
          {copy.cta}
        </Link>
      </div>
    </section>
  );
}
