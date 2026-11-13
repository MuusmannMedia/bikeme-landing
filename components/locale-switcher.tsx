import Link from "next/link";

import { localeLabels, localeNames, locales, type Locale } from "@/lib/locales";

type LocaleSwitcherProps = {
  locale: Locale;
  ariaLabel: string;
  pathSuffix?: string;
  className?: string;
};

export function LocaleSwitcher({
  locale,
  ariaLabel,
  pathSuffix = "",
  className = ""
}: LocaleSwitcherProps) {
  return (
    <nav
      aria-label={ariaLabel}
      className={`flex items-center gap-1 overflow-x-auto rounded-full border border-white/15 bg-white/[0.04] px-2 py-1 text-xs [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden ${className}`}
    >
      {locales.map((code) => (
        <Link
          key={code}
          href={`/${code}${pathSuffix}`}
          aria-label={localeNames[code]}
          aria-current={code === locale ? "page" : undefined}
          className={`shrink-0 rounded-full px-2 py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(209,161,255)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#060b16] ${
            code === locale
              ? "bg-[linear-gradient(135deg,rgba(94,127,255,0.9),rgba(128,39,130,0.85))] text-white"
              : "text-[var(--ink-soft)] hover:bg-white/10 hover:text-white"
          }`}
        >
          {localeLabels[code]}
        </Link>
      ))}
    </nav>
  );
}
