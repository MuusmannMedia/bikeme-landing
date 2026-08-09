"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { localeLabels, locales, type Locale } from "@/lib/locales";

export function AppLanguageSwitcher({ locale, label }: { locale: Locale; label: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  return (
    <label className="bike-app-language">
      <span className="sr-only">{label}</span>
      <select
        value={locale}
        aria-label={label}
        onChange={(event) => {
          const nextLocale = event.target.value;
          const segments = pathname.split("/");
          segments[1] = nextLocale;
          const search = searchParams.toString();
          router.push(`${segments.join("/")}${search ? `?${search}` : ""}`);
        }}
      >
        {locales.map((code) => (
          <option key={code} value={code}>{localeLabels[code]}</option>
        ))}
      </select>
    </label>
  );
}
