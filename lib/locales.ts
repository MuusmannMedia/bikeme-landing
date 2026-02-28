export const locales = ["en", "da", "de", "es", "it", "fr", "nl"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

export const localeLabels: Record<Locale, string> = {
  en: "EN",
  da: "DA",
  de: "DE",
  es: "ES",
  it: "IT",
  fr: "FR",
  nl: "NL"
};

export function isLocale(value: string): value is Locale {
  return locales.includes(value as Locale);
}
