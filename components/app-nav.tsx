"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState, type ReactNode } from "react";

import { isAppNavActive } from "@/lib/clubs/navigation";
import { dmText } from "@/lib/messages/i18n";
import type { Locale } from "@/lib/locales";

import { useVisitorNav } from "./clubs/visits/nav-scope";
import { LazyMessagesBoundary, useFloatingMessages } from "./messages/floating-messages";
import { UnreadBadge } from "./messaging/unread-provider";

type NavigationLink = {
  href: string;
  label: string;
  unread?: boolean;
};

type NavigationGroup = {
  id: string;
  label: string;
  links: NavigationLink[];
};

type AppNavProps = {
  actor: string;
  locale: Locale;
  menuLabel: string;
  items: (NavigationLink | NavigationGroup)[];
  profileLabel: string;
  profileLinks: NavigationLink[];
  brand: ReactNode;
  actions: ReactNode;
  avatar: ReactNode;
  logout: ReactNode;
};

export function AppNav(props: AppNavProps) {
  const pathname = usePathname();
  return <NavigationBar key={pathname} pathname={pathname} {...props} />;
}

function NavigationBar({
  pathname, actor, locale, menuLabel, items, profileLabel, profileLinks, brand, actions, avatar, logout,
}: AppNavProps & { pathname: string }) {
  const visitor = useVisitorNav();
  const openConversation = useFloatingMessages();
  const messagesLink = items.find((item): item is NavigationLink => "href" in item && !!item.unread);
  const id = useId();
  const navId = `${id}-navigation`;
  const mobileButtonId = `${navId}-button`;
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openPanel, setOpenPanel] = useState<string | null>(null);
  const active = (link: NavigationLink) => isAppNavActive(pathname, link.href, visitor);

  useEffect(() => {
    if (!mobileOpen && !openPanel) return;

    function inside(elementId: string, target: EventTarget | null) {
      return target instanceof Node && document.getElementById(elementId)?.contains(target);
    }

    function dismissOutside(event: Event) {
      if (mobileOpen && !inside(navId, event.target) && !inside(mobileButtonId, event.target)) {
        setMobileOpen(false);
      }
      if (openPanel && !inside(openPanel, event.target) && !inside(`${openPanel}-button`, event.target)) {
        setOpenPanel(null);
      }
    }

    function dismissOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      if (openPanel) {
        setOpenPanel(null);
        document.getElementById(`${openPanel}-button`)?.focus();
      } else {
        setMobileOpen(false);
        document.getElementById(mobileButtonId)?.focus();
      }
    }

    document.addEventListener("pointerdown", dismissOutside);
    document.addEventListener("focusin", dismissOutside);
    document.addEventListener("keydown", dismissOnEscape);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside);
      document.removeEventListener("focusin", dismissOutside);
      document.removeEventListener("keydown", dismissOnEscape);
    };
  }, [mobileOpen, openPanel, navId, mobileButtonId]);

  function renderLink(link: NavigationLink) {
    const isActive = active(link);
    const props = {
      href: link.href,
      className: "bike-app-nav-link",
      "aria-current": isActive ? "page" as const : undefined,
      onClick: () => {
        setMobileOpen(false);
        setOpenPanel(null);
      },
      children: <>
        {link.label}
        {link.unread && <UnreadBadge locale={locale} total />}
      </>,
    };
    // Keep document navigation for private club and inbox routes.
    if (link.href.includes("/app/clubs/") || link.href.endsWith("/messages")) {
      return <a key={link.href} {...props} />;
    }
    return <Link key={link.href} {...props} />;
  }

  function renderMessages(link: NavigationLink, mobile = false) {
    if (!openConversation) return mobile ? null : renderLink(link);

    const panelId = `${id}-messages-${mobile ? "mobile" : "desktop"}`;
    const expanded = openPanel === panelId;

    return (
      <div key={link.href} className="bike-app-nav-group bike-message-nav" data-mobile={mobile}>
        <button
          type="button"
          id={`${panelId}-button`}
          className="bike-app-nav-trigger"
          data-messages-trigger
          data-mobile={mobile || undefined}
          aria-label={mobile ? link.label : undefined}
          aria-expanded={expanded}
          aria-controls={panelId}
          data-active={active(link)}
          onClick={() => {
            setMobileOpen(false);
            setOpenPanel(expanded ? null : panelId);
          }}
        >
          {mobile ? (
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-4 3v-3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"
                stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
            </svg>
          ) : link.label}
          <UnreadBadge locale={locale} privateTotal />
          {!mobile && <span className="bike-app-nav-chevron" aria-hidden="true" />}
        </button>
        <section id={panelId} className="bike-app-nav-panel bike-message-popover"
          aria-labelledby={`${panelId}-heading`} hidden={!expanded}>
          <h2 id={`${panelId}-heading`}>{dmText(locale, "title")}</h2>
          {expanded && (
            <LazyMessagesBoundary userId={actor} locale={locale} conversationId={null} peer={null}
              view={{ kind: "popover", openConversation: conversation => {
                setOpenPanel(null);
                openConversation(conversation);
              } }}
            />
          )}
        </section>
      </div>
    );
  }

  function renderGroup(group: NavigationGroup, trigger?: ReactNode, footer?: ReactNode) {
    const panelId = `${id}-${group.id}`;
    const expanded = openPanel === panelId;
    return (
      <div key={group.id} className="bike-app-nav-group" data-profile={group.id === "profile"}>
        <button
          type="button"
          id={`${panelId}-button`}
          className="bike-app-nav-trigger"
          aria-label={trigger ? group.label : undefined}
          aria-expanded={expanded}
          aria-controls={panelId}
          data-active={group.links.some(active)}
          onClick={() => setOpenPanel(expanded ? null : panelId)}
        >
          {trigger ?? group.label}
          <span className="bike-app-nav-chevron" aria-hidden="true" />
        </button>
        <div id={panelId} className="bike-app-nav-panel" hidden={!expanded}>
          {group.links.map(renderLink)}
          {footer}
        </div>
      </div>
    );
  }

  return (
    <header className="bike-app-topbar">
      <div className="bike-app-topbar-inner">
        {brand}
        <button
          type="button"
          id={mobileButtonId}
          className="bike-app-mobile-trigger"
          aria-label={menuLabel}
          aria-expanded={mobileOpen}
          aria-controls={navId}
          onClick={() => {
            setOpenPanel(null);
            setMobileOpen(!mobileOpen);
          }}
        >
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d={mobileOpen ? "M6 6l12 12M18 6L6 18" : "M4 6h16M4 12h16M4 18h16"}
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          {!mobileOpen && <UnreadBadge locale={locale} total />}
        </button>
        <nav id={navId} className="bike-app-nav" aria-label="Bike Me" data-mobile-open={mobileOpen}>
          {items.map(item => "href" in item ? item.unread ? renderMessages(item) : renderLink(item) : renderGroup(item))}
        </nav>
        {messagesLink && renderMessages(messagesLink, true)}
        <div className="bike-app-topbar-actions">
          {actions}
          {renderGroup({ id: "profile", label: profileLabel, links: profileLinks }, avatar, logout)}
        </div>
      </div>
    </header>
  );
}
