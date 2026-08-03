import Link from "next/link";

import { getAppText, type AppTextKey } from "@/lib/app-i18n";
import type { Locale } from "@/lib/locales";

export function AppPageHeader({
  eyebrow,
  title,
  intro,
  action
}: {
  eyebrow?: string;
  title: string;
  intro: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="bike-app-page-header">
      <div>
        {eyebrow ? <p className="bike-app-eyebrow">{eyebrow}</p> : null}
        <h1>{title}</h1>
        <p>{intro}</p>
      </div>
      {action ? <div className="bike-app-page-action">{action}</div> : null}
    </header>
  );
}

export function AppPanel({
  title,
  children,
  action,
  className = ""
}: {
  title?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`bike-app-panel ${className}`.trim()}>
      {title || action ? (
        <header className="bike-app-panel-header">
          {title ? <h2>{title}</h2> : <span />}
          {action}
        </header>
      ) : null}
      {children}
    </section>
  );
}

export function AppEmpty({ children }: { children: React.ReactNode }) {
  return <p className="bike-app-empty">{children}</p>;
}

export function AppNotice({ locale, code }: { locale: Locale; code?: string | null }) {
  if (!code) return null;
  const keyByCode: Record<string, AppTextKey> = {
    saved: "message.saved",
    created: "message.created",
    updated: "message.updated",
    done: "message.cancelled",
    invalid: "message.invalid",
    forbidden: "message.forbidden",
    search: "message.searchError",
    data: "message.dataError",
    error: "message.error"
  };
  const key = keyByCode[code];
  if (!key) return null;
  const isError = ["invalid", "forbidden", "search", "data", "error"].includes(code);
  return <div className="bike-app-notice" data-kind={isError ? "error" : "success"} role="status">{getAppText(locale, key)}</div>;
}

export function ProGate({ locale }: { locale: Locale }) {
  return (
    <div className="bike-app-pro-gate">
      <span>{getAppText(locale, "common.pro")}</span>
      <h2>{getAppText(locale, "access.lockedTitle")}</h2>
      <p>{getAppText(locale, "access.lockedBody")}</p>
      <p className="bike-app-muted">{getAppText(locale, "access.noCheckout")}</p>
      <Link className="bike-app-button bike-app-button-secondary" href={`/${locale}/app/profile`}>
        {getAppText(locale, "nav.profile")}
      </Link>
    </div>
  );
}
