import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { isLocale, locales, type Locale } from "@/lib/locales";

type LocalePageProps = {
  params: {
    locale: string;
  };
};

const metadataByLocale: Partial<Record<Locale, { title: string; description: string }>> = {
  en: {
    title: "Privacy Policy | Bike Me",
    description: "Privacy Policy for Bike Me."
  },
  da: {
    title: "Privatlivspolitik | Bike ME",
    description: "Privatlivspolitik for Bike ME."
  },
  de: {
    title: "Datenschutzerklärung | Bike Me",
    description: "Datenschutzerklärung für Bike Me."
  },
  es: {
    title: "Política de privacidad | Bike Me",
    description: "Política de privacidad de Bike Me."
  },
  it: {
    title: "Informativa sulla privacy | Bike Me",
    description: "Informativa sulla privacy di Bike Me."
  },
  fr: {
    title: "Politique de confidentialité | Bike Me",
    description: "Politique de confidentialité de Bike Me."
  },
  nl: {
    title: "Privacybeleid | Bike Me",
    description: "Privacybeleid van Bike Me."
  }
};

const uiByLocale: Partial<Record<Locale, { pageTitle: string; lastUpdated: string; backToHome: string }>> = {
  en: {
    pageTitle: "Privacy Policy for Bike ME",
    lastUpdated: "Last updated: February 28, 2026",
    backToHome: "Back to home"
  },
  da: {
    pageTitle: "Privatlivspolitik for Bike ME",
    lastUpdated: "Senest opdateret: 28. februar 2026",
    backToHome: "Tilbage til forsiden"
  },
  de: {
    pageTitle: "Datenschutzerklärung für Bike ME",
    lastUpdated: "Zuletzt aktualisiert: 28. Februar 2026",
    backToHome: "Zur Startseite"
  },
  es: {
    pageTitle: "Política de privacidad de Bike ME",
    lastUpdated: "Última actualización: 28 de febrero de 2026",
    backToHome: "Volver al inicio"
  },
  it: {
    pageTitle: "Informativa sulla privacy di Bike ME",
    lastUpdated: "Ultimo aggiornamento: 28 febbraio 2026",
    backToHome: "Torna alla home"
  },
  fr: {
    pageTitle: "Politique de confidentialité de Bike ME",
    lastUpdated: "Dernière mise à jour : 28 février 2026",
    backToHome: "Retour à l'accueil"
  },
  nl: {
    pageTitle: "Privacybeleid voor Bike ME",
    lastUpdated: "Laatst bijgewerkt: 28 februari 2026",
    backToHome: "Terug naar home"
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

export default function PrivacyPage({ params }: LocalePageProps) {
  if (!isLocale(params.locale)) {
    notFound();
  }

  const locale = params.locale as Locale;
  const fallback = uiByLocale.en!;
  const ui = uiByLocale[locale] ?? fallback;

  return (
    <div className="pb-12">
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/80 backdrop-blur-xl">
        <div className="section-shell flex h-20 items-center justify-between gap-4">
          <Link href={`/${locale}`} aria-label="Bike Me" className="flex items-center">
            <Image
              src="/brand/bike-me-logo.png"
              alt="Bike Me logo"
              width={1024}
              height={1024}
              className="h-11 w-auto md:h-14"
              priority
            />
          </Link>

          <Link
            href={`/${locale}`}
            className="rounded-full border border-[var(--brand-blue)] px-5 py-2 text-sm font-medium text-[var(--brand-blue)] transition hover:border-[var(--brand-purple)] hover:bg-white hover:text-[var(--brand-purple)]"
          >
            {ui.backToHome}
          </Link>
        </div>
      </header>

      <main className="section-shell pt-10 md:pt-14">
        <article className="glass-panel rounded-3xl border border-slate-200/80 px-6 py-8 text-slate-700 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.6)] md:px-10 md:py-10">
          <h1 className="font-display text-3xl font-semibold leading-tight text-slate-950 md:text-4xl">
            {ui.pageTitle}
          </h1>
          <p className="mt-3 text-sm text-slate-500">{ui.lastUpdated}</p>

          <div className="mt-8 space-y-7 leading-relaxed">
            <section className="space-y-4">
              <p>
                Denne privatlivspolitik beskriver, hvordan Bike ME ("vi", "os" eller "vores")
                behandler personoplysninger i forbindelse med din brug af Bike ME-appen og
                tilhørende tjenester (samlet kaldet "Tjenesten").
              </p>
              <p>
                Vi beskytter dit privatliv og behandler personoplysninger i overensstemmelse med
                gældende databeskyttelseslovgivning, herunder databeskyttelsesforordningen (GDPR).
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-display text-2xl font-semibold text-slate-900">Dataansvarlig</h2>
              <p>Dataansvarlig for behandlingen af dine personoplysninger er:</p>
              <p>
                Bike ME (udvikler: Morten Muusmann)
                <br />
                E-mail: kontakt@bikeme.one
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-display text-2xl font-semibold text-slate-900">
                Hvilke oplysninger vi indsamler
              </h2>
              <p>
                Når du bruger Bike ME, kan vi behandle følgende kategorier af personoplysninger:
              </p>
              <ul className="list-disc space-y-2 pl-6">
                <li>
                  <strong>Kontodata:</strong> navn og e-mailadresse i forbindelse med oprettelse og
                  brug af konto (login håndteres via vores autentificeringsløsning).
                </li>
                <li>
                  <strong>Profil- og appdata:</strong> oplysninger du selv udfylder i din profil (fx
                  niveau, cykeltype, hjemmeregion og "lidt om mig").
                </li>
                <li>
                  <strong>Turdata (indhold du opretter):</strong> turens titel, beskrivelse,
                  disciplin, tidspunkt, varighed, distance (hvis relevant), mødested/startsted og
                  andre oplysninger, du vælger at tilføje. Oplysninger om deltagelse (fx hvem der
                  har tilmeldt sig en tur).
                </li>
                <li>
                  <strong>Rute-link (valgfrit):</strong> hvis du indsætter et link til en
                  Strava-rute (eller andet rutelink), gemmer vi linket sammen med turen, så andre
                  kan åbne det fra turdetaljer.
                </li>
                <li>
                  <strong>Lokationsdata:</strong> din lokation, når du aktivt giver appen
                  tilladelse. Lokation bruges til kortfunktioner, fx visning af ture i nærheden og
                  valg/visning af startsted. Du kan til enhver tid slå lokation fra i dine
                  enhedsindstillinger.
                </li>
                <li>
                  <strong>Push-notifikationer:</strong> hvis du giver tilladelse til push, gemmer
                  vi en push-token (enheds-id til notifikationer) for at kunne sende vigtige
                  beskeder om ture, fx ændringer eller når værten ikke kan alligevel. Du kan slå
                  push fra i appens indstillinger/profil eller i telefonens indstillinger.
                </li>
                <li>
                  <strong>Tekniske data:</strong> enhedstype, operativsystem, app-version samt
                  logdata/fejlrapporter (i nødvendigt omfang). Dette bruges til drift, fejlfinding
                  og forbedring af Tjenesten.
                </li>
                <li>
                  <strong>Kommunikation og support:</strong> henvendelser du sender til os via
                  e-mail, samt relevante oplysninger, du deler i forbindelse med support.
                </li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="font-display text-2xl font-semibold text-slate-900">
                Formål og behandlingsgrundlag
              </h2>
              <p>Vi behandler dine personoplysninger til følgende formål:</p>
              <ul className="list-disc space-y-2 pl-6">
                <li>
                  a) Oprettelse og drift af din konto og profil — GDPR art. 6, stk. 1, litra b.
                </li>
                <li>b) Oprettelse, visning og administration af ture — GDPR art. 6, stk. 1, litra b.</li>
                <li>
                  c) Lokationsbaserede funktioner — GDPR art. 6, stk. 1, litra b og/eller f.
                </li>
                <li>
                  d) Push-notifikationer om vigtige turændringer — GDPR art. 6, stk. 1, litra b
                  og/eller f. (Notifikationstilladelse styres af enheden.)
                </li>
                <li>e) Drift, sikkerhed og forbedring — GDPR art. 6, stk. 1, litra f.</li>
                <li>
                  f) Kommunikation og support — GDPR art. 6, stk. 1, litra b og/eller f.
                </li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="font-display text-2xl font-semibold text-slate-900">
                Modtagere og brug af databehandlere
              </h2>
              <p>
                Vi deler ikke dine personoplysninger med andre virksomheder til deres egen
                markedsføring.
              </p>
              <p>
                Vi benytter udvalgte databehandlere til drift af Tjenesten, fx:
              </p>
              <ul className="list-disc space-y-2 pl-6">
                <li>hosting- og databaseleverandør</li>
                <li>leverandør af push-notifikationer</li>
                <li>fejl-/logningsværktøjer (hvis anvendt)</li>
              </ul>
              <p>
                Databehandlere må kun behandle oplysninger på vores vegne og efter instruks.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-display text-2xl font-semibold text-slate-900">
                Overførsel til tredjelande
              </h2>
              <p>
                Nogle databehandlere kan være placeret uden for EU/EØS. I sådanne tilfælde sikrer
                vi et gyldigt overførselsgrundlag, fx EU-Kommissionens standardkontraktbestemmelser
                (SCC).
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-display text-2xl font-semibold text-slate-900">Opbevaringsperiode</h2>
              <p>
                Vi opbevarer personoplysninger, så længe det er nødvendigt for de formål, de er
                indsamlet til, eller så længe vi er retligt forpligtet hertil.
              </p>
              <p>
                Hvis du sletter din konto, vil vi slette eller anonymisere dine persondata inden
                for 30 dage, medmindre vi er retligt forpligtet til at gemme dem længere.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-display text-2xl font-semibold text-slate-900">Dine rettigheder</h2>
              <p>
                Du har ret til: indsigt, berigtigelse, sletning, begrænsning, indsigelse,
                dataportabilitet.
              </p>
              <p>
                Kontakt: kontakt@bikeme.one
                <br />
                Du kan klage til Datatilsynet.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-display text-2xl font-semibold text-slate-900">
                Børns brug af Tjenesten
              </h2>
              <p>
                Bike ME er målrettet brugere over 18 år. Hvis vi bliver opmærksomme på, at vi har
                indsamlet personoplysninger om et barn, vil vi slette oplysningerne hurtigst
                muligt.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-display text-2xl font-semibold text-slate-900">
                Ændringer i denne privatlivspolitik
              </h2>
              <p>
                Vi kan opdatere denne privatlivspolitik fra tid til anden. Den seneste version vil
                altid være tilgængelig i appen og/eller på vores website. Ved væsentlige ændringer
                vil vi, så vidt muligt, give tydelig besked.
              </p>
            </section>
          </div>
        </article>
      </main>
    </div>
  );
}
