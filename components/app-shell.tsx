import Image from "next/image";
import Link from "next/link";

import { logoutAction } from "@/app/[locale]/app/actions";
import { LogoutForm } from "@/app/[locale]/app/logout-form";
import type { AppTextKey } from "@/lib/app-i18n";
import type { Viewer } from "@/lib/app-model";
import { getAuthDictionary } from "@/lib/auth-i18n";
import type { Locale } from "@/lib/locales";
import { dmText } from "@/lib/messages/i18n";

import { AppAvatar } from "./app-avatar";
import { AppLanguageSwitcher } from "./app-language-switcher";
import { AppNav } from "./app-nav";
import { ClubNavScope } from "./clubs/visits/nav-scope";
import { UnreadProvider } from "./messaging/unread-provider";

type AppShellProps = {
  children: React.ReactNode;
  locale: Locale;
  viewer: Viewer;
  displayName: string;
  t: (key: AppTextKey) => string;
};

export function AppShell({ children, locale, viewer, displayName, t }: AppShellProps) {
  const base = `/${locale}/app`;
  const items = [
    { href: base, label: t("nav.overview") },
    { href: `${base}/rides`, label: t("nav.rides") },
    {
      id: "clubs",
      label: t("nav.clubs"),
      links: [
        { href: `${base}/clubs/mine`, label: t("clubs.mine") },
        { href: `${base}/clubs/all`, label: t("clubs.all") },
      ],
    },
    { href: `${base}/messages`, label: dmText(locale, "entry"), unread: true },
    {
      id: "riders",
      label: t("nav.riders"),
      links: [
        { href: `${base}/riders`, label: t("nav.riders") },
        { href: `${base}/requests`, label: t("nav.requests") },
      ],
    },
    {
      id: "activities",
      label: t("nav.activities"),
      links: [
        { href: `${base}/history`, label: t("nav.history") },
        { href: `${base}/status`, label: t("nav.status") },
      ],
    },
  ];
  const profileLinks = [
    { href: `${base}/profile`, label: t("nav.profile") },
    { href: `/${locale}`, label: t("nav.publicSite") },
  ];

  return (
    <UnreadProvider actor={viewer.profile.id}>
      <ClubNavScope>
        <div className="bike-app" lang={locale}>
          <AppNav
            locale={locale}
            menuLabel={t("shell.menu")}
            items={items}
            profileLabel={t("nav.profile")}
            profileLinks={profileLinks}
            brand={
              <Link href={base} className="bike-app-brand" aria-label="Bike Me">
                <Image src="/brand/bike-me-logo-white.png" alt="" width={46} height={46} priority />
                <strong>Bike Me</strong>
              </Link>
            }
            actions={
              <>
                <Link
                  aria-label={t("rides.create")}
                  className="bike-app-button bike-app-header-create"
                  href={`${base}/rides/new`}
                >
                  <span className="bike-app-create-icon" aria-hidden="true">+</span>
                  <span>{t("rides.create")}</span>
                </Link>
                <AppLanguageSwitcher locale={locale} label={t("shell.language")} />
              </>
            }
            avatar={
              <>
                <AppAvatar name={displayName} url={viewer.profile.avatarUrl} size="small" />
                <span className="bike-app-viewer-name">{displayName}</span>
              </>
            }
            logout={<LogoutForm action={logoutAction} locale={locale} translations={getAuthDictionary(locale)} />}
          />
          <main className="bike-app-content">{children}</main>
        </div>
      </ClubNavScope>
    </UnreadProvider>
  );
}
