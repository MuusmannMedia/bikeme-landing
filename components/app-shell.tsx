import Image from "next/image";
import Link from "next/link";

import type { AppTextKey } from "@/lib/app-i18n";
import type { Viewer } from "@/lib/app-model";
import type { Locale } from "@/lib/locales";

import { AppAvatar } from "./app-avatar";
import { AppLanguageSwitcher } from "./app-language-switcher";
import { AppNav } from "./app-nav";

type AppShellProps = {
  children: React.ReactNode;
  locale: Locale;
  viewer: Viewer;
  displayName: string;
  t: (key: AppTextKey) => string;
};

export function AppShell({ children, locale, viewer, displayName, t }: AppShellProps) {
  const base = `/${locale}/app`;
  const links = [
    [base, t("nav.overview"), t("nav.overview")],
    [`${base}/rides`, t("nav.rides"), t("nav.rides")],
    [`${base}/riders`, t("nav.riders"), t("nav.riders")],
    [`${base}/requests`, t("nav.requests"), t("nav.requests")],
    [`${base}/history`, t("nav.history"), t("nav.history")],
    [`${base}/status`, t("nav.status"), t("nav.status")],
    [`${base}/profile`, t("nav.profile"), t("nav.profile")]
  ].map(([href, label, shortLabel]) => ({ href, label, shortLabel }));

  return (
    <div className="bike-app" lang={locale}>
      <aside className="bike-app-sidebar">
        <Link href={base} className="bike-app-brand" aria-label="Bike Me">
          <Image
            src="/brand/bike-me-logo-white.png"
            alt=""
            width={1024}
            height={1024}
            className="bike-app-logo"
            priority
          />
          <span>
            <strong>Bike Me</strong>
            <small>{t("shell.eyebrow")}</small>
          </span>
        </Link>
        <AppNav links={links} />
        <Link className="bike-app-public-link" href={`/${locale}`}>{t("nav.publicSite")}</Link>
      </aside>

      <div className="bike-app-stage">
        <header className="bike-app-topbar">
          <Link href={base} className="bike-app-mobile-brand" aria-label="Bike Me">
            <Image src="/brand/bike-me-logo-white.png" alt="" width={1024} height={1024} priority />
            <span>Bike Me</span>
          </Link>
          <div className="bike-app-topbar-actions">
            <Link
              aria-label={t("rides.create")}
              className="bike-app-button bike-app-header-create"
              href={`${base}/rides/new`}
            >
              {t("rides.create")}
            </Link>
            <AppLanguageSwitcher locale={locale} label={t("shell.language")} />
            <Link href={`${base}/profile`} className="bike-app-viewer">
              <span>{displayName}</span>
              <AppAvatar name={displayName} url={viewer.profile.avatarUrl} size="small" />
            </Link>
          </div>
        </header>
        <div className="bike-app-mobile-nav"><AppNav links={links} /></div>
        <main className="bike-app-content">{children}</main>
      </div>
    </div>
  );
}
