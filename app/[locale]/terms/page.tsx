import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Fragment } from "react";

import { isLocale, locales, type Locale } from "@/lib/locales";

type LocalePageProps = {
  params: {
    locale: string;
  };
};

type TermsSection = {
  heading: string;
  paragraphs?: string[];
  list?: string[];
};

type TermsContent = {
  intro: string[];
  sections: TermsSection[];
};

const metadataByLocale: Partial<Record<Locale, { title: string; description: string }>> = {
  en: {
    title: "Terms | Bike Me",
    description: "Terms for using Bike Me."
  },
  da: {
    title: "Vilkår | Bike Me",
    description: "Vilkår for brug af Bike Me."
  }
};

const uiByLocale: Partial<Record<Locale, { pageTitle: string; lastUpdated: string; backToHome: string }>> = {
  en: {
    pageTitle: "Terms for Bike Me",
    lastUpdated: "Last updated: July 2026",
    backToHome: "Back to home"
  },
  da: {
    pageTitle: "Bike Me vilkår",
    lastUpdated: "Senest opdateret: juli 2026",
    backToHome: "Tilbage til forsiden"
  }
};

const termsContentByLocale: Partial<Record<Locale, TermsContent>> = {
  en: {
    intro: [
      "These terms apply when you use the Bike Me app and related services.",
      "Bike Me helps cyclists create, find and join bike rides. The app is a tool for planning and coordinating rides, but you are always responsible for your own choices and safety."
    ],
    sections: [
      {
        heading: "Your safety and participation",
        paragraphs: [
          "You are responsible for your own safety, compliance with traffic laws, route choices and participation in rides.",
          "Always assess weather, traffic, your equipment, your fitness level and the people you choose to ride with before joining or starting a ride."
        ]
      },
      {
        heading: "Information from other users",
        paragraphs: [
          "Bike Me cannot guarantee that information created or shared by other users is correct, complete or up to date. This includes ride descriptions, meeting points, routes, participation details and other user-generated content."
        ]
      },
      {
        heading: "Acceptable use",
        paragraphs: ["You may not misuse the app or use it in a way that harms others."],
        list: [
          "Do not create false or misleading rides.",
          "Do not harass, threaten or abuse other users.",
          "Do not share illegal, harmful, offensive or unsafe content.",
          "Do not attempt to disrupt, misuse or gain unauthorized access to the service."
        ]
      },
      {
        heading: "Routes, GPX and ride data",
        paragraphs: [
          "GPX routes, maps, meeting points and ride data are guidance only. You must always assess whether a route is safe and suitable before and during a ride."
        ]
      },
      {
        heading: "Location and tracking",
        paragraphs: [
          "Location is used for maps, nearby rides and active tracking. Tracking is only used when you actively choose to start and record a ride in the app."
        ]
      },
      {
        heading: "Account deletion",
        paragraphs: [
          "You can delete your account in the app under Profile -> Settings. If you need help, contact us at info@bikeme.one."
        ]
      },
      {
        heading: "Changes and contact",
        paragraphs: [
          "We may update these terms from time to time. The latest version will be available on our website.",
          "Contact: info@bikeme.one"
        ]
      }
    ]
  },
  da: {
    intro: [
      "Disse vilkår gælder, når du bruger Bike Me-appen og tilhørende tjenester.",
      "Bike Me hjælper cyklister med at oprette, finde og deltage i cykelture. Appen er et værktøj til planlægning og koordinering af ture, men du er altid selv ansvarlig for dine valg og din sikkerhed."
    ],
    sections: [
      {
        heading: "Din sikkerhed og deltagelse",
        paragraphs: [
          "Du er selv ansvarlig for egen sikkerhed, for at overholde færdselsloven, for dit rutevalg og for din deltagelse i ture.",
          "Vurder altid vejr, trafik, udstyr, dit niveau og de personer, du vælger at køre med, før du deltager i eller starter en tur."
        ]
      },
      {
        heading: "Oplysninger fra andre brugere",
        paragraphs: [
          "Bike Me kan ikke garantere, at oplysninger oprettet eller delt af andre brugere er korrekte, komplette eller opdaterede. Det gælder blandt andet turbeskrivelser, mødesteder, ruter, deltageroplysninger og andet brugerindhold."
        ]
      },
      {
        heading: "Acceptabel brug",
        paragraphs: ["Du må ikke misbruge appen eller bruge den på en måde, der skader andre."],
        list: [
          "Opret ikke falske eller vildledende ture.",
          "Chikanér, tru eller misbrug ikke andre brugere.",
          "Del ikke ulovligt, skadeligt, krænkende eller usikkert indhold.",
          "Forsøg ikke at forstyrre, misbruge eller få uautoriseret adgang til tjenesten."
        ]
      },
      {
        heading: "Ruter, GPX og turdata",
        paragraphs: [
          "GPX-ruter, kort, mødesteder og turdata er vejledende. Du skal altid selv vurdere, om en rute er sikker og egnet før og under en tur."
        ]
      },
      {
        heading: "Lokation og tracking",
        paragraphs: [
          "Lokation bruges til kort, ture i nærheden og aktiv tracking. Tracking bruges kun, når du aktivt vælger at starte og registrere en cykeltur i appen."
        ]
      },
      {
        heading: "Sletning af konto",
        paragraphs: [
          "Du kan slette din konto i appen under Profil -> Indstillinger. Hvis du har brug for hjælp, kan du kontakte os på info@bikeme.one."
        ]
      },
      {
        heading: "Ændringer og kontakt",
        paragraphs: [
          "Vi kan opdatere disse vilkår fra tid til anden. Den nyeste version vil være tilgængelig på vores hjemmeside.",
          "Kontakt: info@bikeme.one"
        ]
      }
    ]
  }
};

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export function generateMetadata({ params }: LocalePageProps): Metadata {
  const locale: Locale = isLocale(params.locale) ? params.locale : "en";
  const fallback = metadataByLocale.en!;
  const meta = metadataByLocale[locale] ?? fallback;

  return {
    title: meta.title,
    description: meta.description
  };
}

function renderWithLineBreaks(text: string) {
  return text.split("\n").map((line, index) => (
    <Fragment key={`${line}-${index}`}>
      {index > 0 ? <br /> : null}
      {line}
    </Fragment>
  ));
}

export default function TermsPage({ params }: LocalePageProps) {
  if (!isLocale(params.locale)) {
    notFound();
  }

  const locale = params.locale as Locale;
  const fallbackUi = uiByLocale.en!;
  const ui = uiByLocale[locale] ?? fallbackUi;
  const terms = termsContentByLocale[locale] ?? termsContentByLocale.en!;

  return (
    <div className="pb-12">
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

          <Link
            href={`/${locale}`}
            className="rounded-full border border-white/20 bg-white/[0.03] px-5 py-2 text-sm font-medium text-[var(--ink-soft)] transition-colors hover:border-white/40 hover:text-white"
          >
            {ui.backToHome}
          </Link>
        </div>
      </header>

      <main className="section-shell pt-10 md:pt-14">
        <article className="glass-panel rounded-3xl border px-6 py-8 text-[var(--ink-soft)] shadow-[0_30px_70px_-44px_rgba(0,0,0,0.9)] md:px-10 md:py-10">
          <h1 className="font-display text-3xl font-semibold leading-tight text-[var(--ink)] md:text-4xl">
            {ui.pageTitle}
          </h1>
          <p className="mt-3 text-sm text-[rgb(155,170,206)]">{ui.lastUpdated}</p>

          <div className="mt-8 space-y-7 leading-relaxed">
            <section className="space-y-4">
              {terms.intro.map((paragraph) => (
                <p key={paragraph}>{renderWithLineBreaks(paragraph)}</p>
              ))}
            </section>

            {terms.sections.map((section) => (
              <section key={section.heading} className="space-y-3">
                <h2 className="font-display text-2xl font-semibold text-[var(--ink)]">
                  {section.heading}
                </h2>
                {section.paragraphs?.map((paragraph) => (
                  <p key={paragraph}>{renderWithLineBreaks(paragraph)}</p>
                ))}
                {section.list ? (
                  <ul className="list-disc space-y-2 pl-6 marker:text-[rgb(147,171,255)]">
                    {section.list.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}
          </div>
        </article>
      </main>
    </div>
  );
}
