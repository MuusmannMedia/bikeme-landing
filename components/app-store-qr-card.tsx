import Image from "next/image";

import type { Locale } from "@/lib/locales";

type AppStoreQrCardProps = {
  appStoreUrl: string;
  locale: Locale;
};

const qrCopy: Record<
  Locale,
  {
    title: string;
    availability: string;
    instruction: string;
  }
> = {
  en: {
    title: "Download Bike Me on the App Store",
    availability: "iPhone only",
    instruction: "Scan with your iPhone camera"
  },
  da: {
    title: "Download Bike Me i App Store",
    availability: "Kun til iPhone",
    instruction: "Scan med kameraet på din iPhone"
  },
  de: {
    title: "Bike Me im App Store laden",
    availability: "Nur für iPhone",
    instruction: "Mit der iPhone-Kamera scannen"
  },
  es: {
    title: "Descarga Bike Me en App Store",
    availability: "Solo para iPhone",
    instruction: "Escanea con la cámara de tu iPhone"
  },
  it: {
    title: "Scarica Bike Me dall’App Store",
    availability: "Solo per iPhone",
    instruction: "Scansiona con la fotocamera del tuo iPhone"
  },
  fr: {
    title: "Télécharger Bike Me dans l’App Store",
    availability: "Uniquement sur iPhone",
    instruction: "Scannez avec l’appareil photo de votre iPhone"
  },
  nl: {
    title: "Download Bike Me in de App Store",
    availability: "Alleen voor iPhone",
    instruction: "Scan met de camera van je iPhone"
  }
};

export function AppStoreQrCard({ appStoreUrl, locale }: AppStoreQrCardProps) {
  const copy = qrCopy[locale];

  return (
    <aside className="app-store-qr-card mx-auto w-full max-w-[22rem] rounded-[2rem] border border-white/15 bg-[#080f21]/95 p-5 shadow-[0_28px_70px_-38px_rgba(0,0,0,0.95)] sm:p-6 lg:mx-0">
      <div className="mb-5 flex items-center justify-between gap-3">
        <span className="inline-flex items-center rounded-full border border-[rgba(147,171,255,0.32)] bg-[rgba(94,127,255,0.13)] px-3 py-1.5 text-xs font-semibold text-[rgb(178,197,255)]">
          {copy.availability}
        </span>
        <span className="h-2.5 w-2.5 rounded-full bg-[rgb(209,161,255)] shadow-[0_0_18px_rgba(209,161,255,0.85)]" />
      </div>

      <a
        href={appStoreUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="app-store-qr-link block rounded-[1.45rem] bg-white p-3 shadow-[0_16px_45px_-25px_rgba(143,168,255,0.8)] transition-transform hover:scale-[1.015] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(209,161,255)] focus-visible:ring-offset-4 focus-visible:ring-offset-[#080f21]"
        aria-label={copy.title}
      >
        <Image
          src="/qr/bike-me-app-store.png"
          alt=""
          width={1060}
          height={1060}
          sizes="(max-width: 640px) 248px, 272px"
          className="app-store-qr-image h-auto w-full"
          unoptimized
        />
      </a>

      <p className="app-store-qr-instruction mt-4 text-center text-sm font-medium text-[var(--ink-soft)]">
        {copy.instruction}
      </p>

      <a
        href={appStoreUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="app-store-download-link mt-5 flex min-h-16 items-center gap-3 rounded-2xl border border-[rgba(143,168,255,0.45)] bg-[linear-gradient(135deg,rgba(94,127,255,0.88),rgba(128,39,130,0.82))] px-4 py-3 text-white shadow-[0_18px_50px_-30px_rgba(128,39,130,0.95)] transition-transform hover:scale-[1.015] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(209,161,255)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#080f21]"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white">
          <Image
            src="/apple-sign-in-logo-white-52@2x.png"
            alt=""
            width={104}
            height={104}
            className="h-7 w-7"
            aria-hidden="true"
          />
        </span>
        <span className="min-w-0">
          <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-white/75">
            Bike Me
          </span>
          <span className="mt-0.5 block text-sm font-semibold leading-tight">{copy.title}</span>
        </span>
      </a>
    </aside>
  );
}
