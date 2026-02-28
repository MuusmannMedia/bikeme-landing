import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getDictionary } from "@/lib/i18n";
import {
  isLocale,
  localeLabels,
  locales,
  type Locale
} from "@/lib/locales";
import {
  CANONICAL_DOMAIN,
  CONTACT_EMAIL,
  PRIVACY_URL,
  TERMS_URL,
  TESTFLIGHT_URL
} from "@/lib/site-config";

type LocalePageProps = {
  params: {
    locale: string;
  };
};

const openGraphLocales: Record<Locale, string> = {
  en: "en_US",
  da: "da_DK",
  de: "de_DE",
  es: "es_ES",
  it: "it_IT",
  fr: "fr_FR",
  nl: "nl_NL"
};

const languageAlternates = locales.reduce<Record<string, string>>((acc, locale) => {
  acc[locale] = `/${locale}`;
  return acc;
}, {});

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export function generateMetadata({ params }: LocalePageProps): Metadata {
  const locale: Locale = isLocale(params.locale) ? params.locale : "en";
  const dictionary = getDictionary(locale);

  return {
    title: dictionary.meta.title,
    description: dictionary.meta.description,
    alternates: {
      canonical: `/${locale}`,
      languages: languageAlternates
    },
    openGraph: {
      title: dictionary.meta.title,
      description: dictionary.meta.description,
      url: `${CANONICAL_DOMAIN}/${locale}`,
      siteName: "Bike Me",
      locale: openGraphLocales[locale],
      type: "website",
      images: [
        {
          url: "/opengraph-image",
          width: 1200,
          height: 630,
          alt: "Bike Me preview"
        }
      ]
    }
  };
}

export default function LocalePage({ params }: LocalePageProps) {
  if (!isLocale(params.locale)) {
    notFound();
  }

  const locale = params.locale as Locale;
  const t = getDictionary(locale);

  const navLinks = [
    { id: "features", label: t.nav.features },
    { id: "how-it-works", label: t.nav.howItWorks },
    { id: "screenshots", label: t.nav.screenshots },
    { id: "faq", label: t.nav.faq }
  ];

  return (
    <div className="pb-10">
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/80 backdrop-blur-xl">
        <div className="section-shell flex h-20 items-center justify-between gap-4">
          <Link href={`/${locale}`} className="font-display text-xl font-semibold tracking-tight">
            Bike Me
          </Link>

          <nav className="hidden items-center gap-8 text-sm text-slate-700 lg:flex">
            {navLinks.map((link) => (
              <a key={link.id} href={`#${link.id}`} className="transition hover:text-slate-900">
                {link.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-3 md:gap-4">
            <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600">
              {locales.map((code) => (
                <Link
                  key={code}
                  href={`/${code}`}
                  className={`rounded-full px-2 py-1 transition ${
                    code === locale
                      ? "bg-slate-900 text-white"
                      : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                  aria-current={code === locale ? "page" : undefined}
                >
                  {localeLabels[code]}
                </Link>
              ))}
            </div>

            <a
              href={TESTFLIGHT_URL}
              target="_blank"
              rel="noreferrer"
              className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700"
            >
              {t.nav.joinTestFlight}
            </a>
          </div>
        </div>
        <div className="section-shell flex gap-4 overflow-x-auto pb-3 text-sm text-slate-700 lg:hidden">
          {navLinks.map((link) => (
            <a key={link.id} href={`#${link.id}`} className="whitespace-nowrap rounded-full px-1 py-1">
              {link.label}
            </a>
          ))}
        </div>
      </header>

      <main>
        <section className="section-shell grid gap-12 pb-20 pt-20 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:pb-28 lg:pt-24">
          <div className="max-w-2xl space-y-7">
            <div className="inline-flex items-center rounded-full border border-indigo-200/80 bg-indigo-50 px-4 py-1.5 text-xs font-medium uppercase tracking-[0.14em] text-indigo-700">
              Bike Me
            </div>

            <h1 className="animate-fade-up font-display text-4xl font-semibold leading-tight text-slate-950 md:text-6xl">
              {t.hero.headline}
            </h1>

            <p className="animate-fade-up text-lg leading-relaxed text-slate-600 [animation-delay:120ms] md:text-xl">
              {t.hero.subheadline}
            </p>

            <div className="animate-fade-up flex flex-wrap items-center gap-3 [animation-delay:220ms]">
              <a
                href={TESTFLIGHT_URL}
                target="_blank"
                rel="noreferrer"
                className="rounded-full bg-slate-900 px-7 py-3 text-sm font-medium text-white transition hover:bg-slate-700"
              >
                {t.hero.primaryCta}
              </a>
              <a
                href="#how-it-works"
                className="rounded-full border border-slate-300 px-7 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-white"
              >
                {t.hero.secondaryCta}
              </a>
            </div>
          </div>

          <div className="relative lg:pl-8">
            <div className="pointer-events-none absolute -left-6 -top-8 h-24 w-24 rounded-full bg-indigo-400/20 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-8 right-2 h-24 w-24 rounded-full bg-sky-400/20 blur-2xl" />

            <div className="animate-float gradient-outline glass-panel relative mx-auto max-w-sm rounded-[2.2rem] border border-white/60 p-4 shadow-[0_30px_70px_-30px_rgba(15,23,42,0.45)]">
              <div className="overflow-hidden rounded-[1.7rem] border border-slate-200 bg-white">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 text-xs text-slate-500">
                  <span>{t.hero.previewLabel}</span>
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">
                    Live
                  </span>
                </div>

                <div className="space-y-4 p-4">
                  <div className="placeholder-shimmer animate-shimmer rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-100/40 via-sky-100/60 to-indigo-100/40 p-4">
                    <div className="mb-4 h-3 w-28 rounded-full bg-white/80" />
                    <div className="grid grid-cols-3 gap-2">
                      {[1, 2, 3, 4, 5, 6].map((dot) => (
                        <div
                          key={dot}
                          className="h-12 rounded-xl border border-white/80 bg-white/70"
                        />
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    {[1, 2].map((item) => (
                      <div
                        key={item}
                        className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3"
                      >
                        <div className="mb-2 h-2.5 w-24 rounded-full bg-slate-300" />
                        <div className="h-2 w-40 rounded-full bg-slate-200" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="section-shell pb-20 md:pb-28">
          <div className="mb-10 max-w-2xl space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-indigo-700">
              {t.features.eyebrow}
            </p>
            <h2 className="font-display text-3xl font-semibold text-slate-950 md:text-4xl">
              {t.features.title}
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {t.features.items.map((feature, index) => (
              <article
                key={feature.title}
                className="animate-fade-up glass-panel rounded-3xl border border-slate-200/70 p-6 shadow-[0_20px_50px_-38px_rgba(15,23,42,0.6)]"
                style={{ animationDelay: `${index * 90}ms` }}
              >
                <div className="mb-4 inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-indigo-100 px-2 text-xs font-semibold text-indigo-700">
                  {String(index + 1).padStart(2, "0")}
                </div>
                <h3 className="mb-2 font-display text-xl font-semibold text-slate-900">
                  {feature.title}
                </h3>
                <p className="leading-relaxed text-slate-600">{feature.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="how-it-works" className="section-shell pb-20 md:pb-28">
          <div className="mb-10 max-w-2xl space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-indigo-700">
              {t.howItWorks.eyebrow}
            </p>
            <h2 className="font-display text-3xl font-semibold text-slate-950 md:text-4xl">
              {t.howItWorks.title}
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {t.howItWorks.steps.map((step, index) => (
              <article
                key={step.title}
                className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-[0_20px_50px_-42px_rgba(15,23,42,0.6)]"
              >
                <p className="mb-4 text-sm font-semibold text-slate-400">0{index + 1}</p>
                <h3 className="mb-2 font-display text-xl font-semibold text-slate-900">{step.title}</h3>
                <p className="leading-relaxed text-slate-600">{step.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="screenshots" className="section-shell pb-20 md:pb-28">
          <div className="mb-10 max-w-2xl space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-indigo-700">
              {t.screenshots.eyebrow}
            </p>
            <h2 className="font-display text-3xl font-semibold text-slate-950 md:text-4xl">
              {t.screenshots.title}
            </h2>
            <p className="text-slate-600">{t.screenshots.subtitle}</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {t.screenshots.items.map((title, index) => (
              <article
                key={title}
                className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_20px_50px_-40px_rgba(15,23,42,0.65)]"
              >
                <div className="placeholder-shimmer animate-shimmer aspect-[10/16] rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-slate-100 p-4">
                  <p className="mb-2 text-sm font-semibold text-slate-700">{title}</p>
                  <p className="text-xs text-slate-500">
                    {t.screenshots.replaceHint.replace("{n}", String(index + 1))}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="faq" className="section-shell pb-24 md:pb-28">
          <div className="mb-10 max-w-2xl space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-indigo-700">
              {t.faq.eyebrow}
            </p>
            <h2 className="font-display text-3xl font-semibold text-slate-950 md:text-4xl">
              {t.faq.title}
            </h2>
          </div>

          <div className="space-y-3">
            {t.faq.items.map((item) => (
              <details
                key={item.question}
                className="group rounded-2xl border border-slate-200 bg-white/90 p-5 open:border-indigo-200"
              >
                <summary className="cursor-pointer list-none pr-8 font-medium text-slate-900 marker:hidden">
                  {item.question}
                </summary>
                <p className="pt-3 leading-relaxed text-slate-600">{item.answer}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200/80 bg-white/70 py-8">
        <div className="section-shell flex flex-col gap-4 text-sm text-slate-600 md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} {t.footer.tagline}</p>
          <div className="flex flex-wrap items-center gap-4">
            <a href={PRIVACY_URL} className="transition hover:text-slate-900">
              {t.footer.privacy}
            </a>
            <a href={TERMS_URL} className="transition hover:text-slate-900">
              {t.footer.terms}
            </a>
            <a href={`mailto:${CONTACT_EMAIL}`} className="transition hover:text-slate-900">
              {t.footer.contact}
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
