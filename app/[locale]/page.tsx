import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getDictionary } from "@/lib/i18n";
import { isLocale, localeLabels, locales, type Locale } from "@/lib/locales";
import { CANONICAL_DOMAIN, CONTACT_EMAIL, TERMS_URL, TESTFLIGHT_URL } from "@/lib/site-config";

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
    { id: "pricing", label: t.nav.pricing },
    { id: "faq", label: t.nav.faq }
  ];

  return (
    <div className="pb-10">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#060b16]/80 backdrop-blur-xl supports-[backdrop-filter]:bg-[#060b16]/70">
        <div className="section-shell flex h-20 items-center justify-between gap-4">
          <Link href={`/${locale}`} aria-label="Bike Me" className="flex items-center">
            <Image
              src="/brand/bike-me-logo-white.png"
              alt="Bike Me logo"
              width={1024}
              height={1024}
              className="h-11 w-auto md:h-14"
              priority
            />
          </Link>

          <nav className="hidden items-center gap-8 text-sm font-medium text-[var(--ink-soft)] lg:flex">
            {navLinks.map((link) => (
              <a
                key={link.id}
                href={`#${link.id}`}
                className="transition-colors hover:text-white"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="flex min-w-0 items-center">
            <div className="flex max-w-[64vw] items-center gap-1 overflow-x-auto rounded-full border border-white/15 bg-white/[0.04] px-2 py-1 text-xs [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden sm:max-w-none">
              {locales.map((code) => (
                <Link
                  key={code}
                  href={`/${code}`}
                  className={`shrink-0 rounded-full px-2 py-1 transition-colors ${
                    code === locale
                      ? "bg-[linear-gradient(135deg,rgba(94,127,255,0.9),rgba(128,39,130,0.85))] text-white"
                      : "text-[var(--ink-soft)] hover:bg-white/10 hover:text-white"
                  }`}
                  aria-current={code === locale ? "page" : undefined}
                >
                  {localeLabels[code]}
                </Link>
              ))}
            </div>
          </div>
        </div>
        <div className="section-shell flex gap-4 overflow-x-auto pb-3 text-sm text-[var(--ink-soft)] lg:hidden">
          {navLinks.map((link) => (
            <a
              key={link.id}
              href={`#${link.id}`}
              className="whitespace-nowrap rounded-full px-1 py-1 transition-colors hover:text-white"
            >
              {link.label}
            </a>
          ))}
        </div>
      </header>

      <main>
        <section className="section-shell grid gap-12 pb-20 pt-20 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:pb-28 lg:pt-24">
          <div className="max-w-2xl space-y-7">
            <div className="inline-flex items-center rounded-full border border-white/20 bg-white/[0.03] px-4 py-1.5 text-xs font-medium uppercase tracking-[0.14em] text-[var(--ink-soft)]">
              Bike Me
            </div>

            <h1 className="animate-fade-up max-w-[14ch] font-display text-4xl font-semibold leading-tight text-[var(--ink)] [text-wrap:balance] md:max-w-[18ch] md:text-6xl lg:max-w-[22ch]">
              {t.hero.headline}
            </h1>

            <p className="animate-fade-up text-lg leading-relaxed text-[var(--ink-soft)] [animation-delay:120ms] md:text-xl">
              {t.hero.subheadline}
            </p>

            <div className="animate-fade-up rounded-3xl border border-white/12 bg-white/[0.04] p-5 [animation-delay:180ms]">
              <p className="font-display text-2xl font-semibold text-[var(--ink)]">
                {t.hero.payoffTitle}
              </p>
              <p className="mt-2 leading-relaxed text-[var(--ink-soft)]">
                {t.hero.payoffText}
              </p>
            </div>
          </div>

          <div className="relative lg:pl-8">
            <div className="pointer-events-none absolute -left-6 -top-8 h-24 w-24 rounded-full bg-blue-500/20 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-8 right-2 h-24 w-24 rounded-full bg-fuchsia-500/20 blur-2xl" />

            <div className="animate-float gradient-outline glass-panel relative mx-auto max-w-sm rounded-[2.2rem] border p-4 shadow-[0_40px_90px_-45px_rgba(0,0,0,0.85)]">
              <div className="overflow-hidden rounded-[1.7rem] border border-white/10 bg-[#070d1b]">
                <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-xs text-[var(--ink-soft)]">
                  <span>{t.hero.previewLabel}</span>
                  <span className="rounded-full border border-emerald-300/35 bg-emerald-400/12 px-2 py-0.5 text-emerald-200">
                    Live
                  </span>
                </div>

                <div className="p-4">
                  <div className="relative h-[260px] overflow-hidden rounded-[1.7rem] border border-white/10 bg-[#0b1326] sm:h-[320px] lg:h-[420px]">
                    <Image
                      src="/hero/hero-photo.jpg"
                      alt="Bike ME app preview in the real world"
                      fill
                      priority
                      sizes="(max-width: 1024px) 90vw, 520px"
                      className="object-cover"
                    />
                    <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,rgba(4,8,18,0.45),rgba(4,8,18,0))]" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="section-shell pb-20 md:pb-24">
          <div className="glass-panel rounded-3xl border px-5 py-10 shadow-[0_32px_80px_-50px_rgba(0,0,0,0.9)] md:px-6 md:py-11 lg:px-7 lg:py-12">
            <div className="grid items-start gap-6 lg:grid-cols-[420px_minmax(0,1fr)] lg:gap-4">
              <div className="flex justify-center lg:-ml-2 lg:justify-start">
                <Image
                  src="/brand/bike-me-logo-white.png"
                  alt="Bike Me logo"
                  width={1024}
                  height={1024}
                  className="h-auto w-full max-w-[240px] md:max-w-[320px] lg:max-w-[380px]"
                  sizes="(max-width: 768px) 240px, (max-width: 1024px) 320px, 380px"
                />
              </div>

              <div className="space-y-4 text-[var(--ink-soft)] lg:pr-2">
                <p className="font-display text-2xl font-semibold leading-tight text-[var(--ink)] md:text-3xl">
                  {t.brand.intro}
                </p>
                <ul className="space-y-2.5 text-[var(--ink-soft)]">
                  {t.brand.bullets.map((bullet) => (
                    <li key={bullet} className="flex items-start gap-3">
                      <span className="mt-2 h-1.5 w-1.5 rounded-full bg-[rgb(147,171,255)]" />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <a
                    href="#how-it-works"
                    className="rounded-full border-2 border-[rgba(143,168,255,0.75)] bg-white/[0.02] px-7 py-3 text-sm font-medium text-[var(--ink)] transition-colors hover:border-[rgba(128,39,130,0.95)] hover:bg-[rgba(128,39,130,0.16)]"
                  >
                    {t.hero.secondaryCta}
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="section-shell pb-20 md:pb-28">
          <div className="mb-10 max-w-2xl space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[rgb(147,171,255)]">
              {t.features.eyebrow}
            </p>
            <h2 className="font-display text-3xl font-semibold text-[var(--ink)] md:text-4xl">
              {t.features.title}
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {t.features.items.map((feature, index) => (
              <article
                key={feature.title}
                className="animate-fade-up glass-panel rounded-3xl border p-6 shadow-[0_20px_60px_-40px_rgba(0,0,0,0.95)]"
                style={{ animationDelay: `${index * 90}ms` }}
              >
                <div className="mb-4 inline-flex h-8 min-w-8 items-center justify-center rounded-full border border-white/15 bg-white/[0.05] px-2 text-xs font-semibold text-[rgb(178,197,255)]">
                  {String(index + 1).padStart(2, "0")}
                </div>
                <h3 className="mb-2 font-display text-xl font-semibold text-[rgb(209,161,255)]">
                  {feature.title}
                </h3>
                <p className="leading-relaxed text-[var(--ink-soft)]">{feature.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="how-it-works" className="section-shell pb-20 md:pb-28">
          <div className="mb-10 max-w-2xl space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[rgb(147,171,255)]">
              {t.howItWorks.eyebrow}
            </p>
            <h2 className="font-display text-3xl font-semibold text-[var(--ink)] md:text-4xl">
              {t.howItWorks.title}
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {t.howItWorks.steps.map((step, index) => (
              <article
                key={step.title}
                className="glass-panel rounded-3xl border p-6 shadow-[0_20px_60px_-40px_rgba(0,0,0,0.95)]"
              >
                <p className="mb-4 text-sm font-semibold text-[rgb(147,171,255)]">0{index + 1}</p>
                <h3 className="mb-2 font-display text-xl font-semibold text-[rgb(209,161,255)]">
                  {step.title}
                </h3>
                <p className="leading-relaxed text-[var(--ink-soft)]">{step.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="screenshots" className="section-shell pb-20 md:pb-28">
          <div className="mb-10 max-w-2xl space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[rgb(147,171,255)]">
              {t.screenshots.eyebrow}
            </p>
            <h2 className="font-display text-3xl font-semibold text-[var(--ink)] md:text-4xl">
              {t.screenshots.title}
            </h2>
            <p className="text-[var(--ink-soft)]">{t.screenshots.subtitle}</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {t.screenshots.items.map((item) => (
              <article
                key={item.image}
                className="group relative overflow-hidden rounded-3xl border border-white/12 bg-[rgba(9,16,34,0.9)] p-4 shadow-[0_20px_50px_-35px_rgba(0,0,0,0.95)]"
              >
                <div className="overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(to_bottom,rgba(16,27,52,0.95),rgba(10,18,37,0.95))]">
                  <Image
                    src={item.image}
                    alt={item.title}
                    width={1125}
                    height={2436}
                    sizes="(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 340px"
                    className="h-auto w-full"
                  />
                </div>
                <div className="space-y-2 px-1 pt-4">
                  <h3 className="font-display text-lg font-semibold text-[rgb(209,161,255)]">
                    {item.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-[var(--ink-soft)]">
                    {item.description}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="pricing" className="section-shell pb-20 md:pb-28">
          <div className="mb-10 max-w-2xl space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[rgb(147,171,255)]">
              {t.pricing.eyebrow}
            </p>
            <h2 className="font-display text-3xl font-semibold text-[var(--ink)] md:text-4xl">
              {t.pricing.title}
            </h2>
            <p className="leading-relaxed text-[var(--ink-soft)]">{t.pricing.subtitle}</p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {t.pricing.plans.map((plan, index) => {
              const isPro = index === 1;

              return (
                <article
                  key={plan.name}
                  className={`glass-panel rounded-3xl border p-6 shadow-[0_24px_70px_-45px_rgba(0,0,0,0.95)] ${
                    isPro ? "border-[rgba(209,161,255,0.55)] bg-white/[0.055]" : ""
                  }`}
                >
                  <div className="mb-5 flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[rgb(147,171,255)]">
                        {plan.label}
                      </p>
                      <h3 className="mt-2 font-display text-2xl font-semibold text-[rgb(209,161,255)]">
                        {plan.name}
                      </h3>
                    </div>
                    {isPro ? (
                      <span className="rounded-full border border-[rgba(209,161,255,0.45)] bg-[rgba(128,39,130,0.2)] px-3 py-1 text-xs font-semibold text-[rgb(235,213,255)]">
                        Pro
                      </span>
                    ) : null}
                  </div>

                  <p className="min-h-[4rem] leading-relaxed text-[var(--ink-soft)]">
                    {plan.description}
                  </p>

                  <ul className="mt-6 space-y-3">
                    {plan.items.map((item) => (
                      <li key={item} className="flex gap-3 text-[var(--ink-soft)]">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[rgb(147,171,255)]" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>

          <div className="mt-8">
            <a
              href={TESTFLIGHT_URL}
              className="inline-flex rounded-full border-2 border-[rgba(143,168,255,0.75)] bg-[linear-gradient(135deg,rgba(94,127,255,0.9),rgba(128,39,130,0.85))] px-7 py-3 text-sm font-semibold text-white shadow-[0_18px_50px_-28px_rgba(128,39,130,0.9)] transition-transform hover:scale-[1.02]"
            >
              {t.pricing.cta}
            </a>
          </div>
        </section>

        <section id="faq" className="section-shell pb-24 md:pb-28">
          <div className="mb-10 max-w-2xl space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[rgb(147,171,255)]">
              {t.faq.eyebrow}
            </p>
            <h2 className="font-display text-3xl font-semibold text-[var(--ink)] md:text-4xl">
              {t.faq.title}
            </h2>
          </div>

          <div className="space-y-3">
            {t.faq.items.map((item) => (
              <details
                key={item.question}
                className="group rounded-2xl border border-white/12 bg-[rgba(8,15,31,0.9)] p-5 open:border-[rgba(151,177,255,0.45)]"
              >
                <summary className="cursor-pointer list-none pr-8 font-medium text-[rgb(209,161,255)] marker:hidden">
                  {item.question}
                </summary>
                <p className="pt-3 leading-relaxed text-[var(--ink-soft)]">{item.answer}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-[#050a15]/75 py-8 backdrop-blur-sm">
        <div className="section-shell flex flex-col gap-4 text-sm text-[var(--ink-soft)] md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} {t.footer.tagline}</p>
          <div className="flex flex-wrap items-center gap-4">
            <Link href={`/${locale}/privacy`} className="transition-colors hover:text-white">
              {t.footer.privacy}
            </Link>
            <a href={TERMS_URL} className="transition-colors hover:text-white">
              {t.footer.terms}
            </a>
            <a href={`mailto:${CONTACT_EMAIL}`} className="transition-colors hover:text-white">
              {t.footer.contact}
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
