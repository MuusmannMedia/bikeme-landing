import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AndroidTesterSection } from "@/components/android-tester-section";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { getDictionary } from "@/lib/i18n";
import { isLocale, locales, type Locale } from "@/lib/locales";
import { CANONICAL_DOMAIN } from "@/lib/site-config";

type AndroidTestPageProps = {
  params: Promise<{
    locale: string;
  }>;
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
  acc[locale] = `/${locale}/android-test`;
  return acc;
}, {});

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: AndroidTestPageProps): Promise<Metadata> {
  const { locale: localeParam } = await params;
  const locale: Locale = isLocale(localeParam) ? localeParam : "en";
  const copy = getDictionary(locale).androidTester.page;

  return {
    title: copy.metaTitle,
    description: copy.metaDescription,
    alternates: {
      canonical: `/${locale}/android-test`,
      languages: languageAlternates
    },
    openGraph: {
      title: copy.metaTitle,
      description: copy.metaDescription,
      url: `${CANONICAL_DOMAIN}/${locale}/android-test`,
      siteName: "Bike Me",
      locale: openGraphLocales[locale],
      type: "website",
      images: [
        {
          url: "/opengraph-image",
          width: 1200,
          height: 630,
          alt: copy.openGraphImageAlt
        }
      ]
    }
  };
}

export default async function AndroidTestPage({ params }: AndroidTestPageProps) {
  const { locale: localeParam } = await params;

  if (!isLocale(localeParam)) {
    notFound();
  }

  const locale = localeParam as Locale;
  const dictionary = getDictionary(locale);
  const copy = dictionary.androidTester;

  return (
    <div className="bike-public pb-12">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#060b16]/80 backdrop-blur-xl supports-[backdrop-filter]:bg-[#060b16]/70">
        <div className="section-shell flex min-h-20 flex-wrap items-center justify-between gap-x-3 gap-y-3 py-3 sm:flex-nowrap">
          <Link href={`/${locale}`} aria-label="Bike Me" className="order-1 flex items-center">
            <Image
              src="/brand/bike-me-logo-white.png"
              alt=""
              width={1024}
              height={1024}
              className="h-11 w-auto md:h-14"
              priority
            />
          </Link>

          <div className="order-3 w-full min-w-0 sm:order-2 sm:w-auto">
            <LocaleSwitcher
              locale={locale}
              ariaLabel={dictionary.nav.languageSwitcherLabel}
              pathSuffix="/android-test"
              className="w-full max-w-full sm:w-auto"
            />
          </div>

          <Link
            href={`/${locale}`}
            className="order-2 inline-flex min-h-11 shrink-0 items-center rounded-full border border-white/20 bg-white/[0.03] px-4 py-2 text-sm font-medium text-[var(--ink-soft)] transition-colors hover:border-white/40 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(209,161,255)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#060b16] sm:order-3 sm:px-5"
          >
            {copy.page.backToHome}
          </Link>
        </div>
      </header>

      <main className="pt-10 md:pt-14">
        <AndroidTesterSection locale={locale} copy={copy} />
      </main>
    </div>
  );
}
