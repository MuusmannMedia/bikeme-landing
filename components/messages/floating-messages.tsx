"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { createContext, useContext, useState, type ReactNode } from "react";

import type { Locale } from "@/lib/locales";

export const LazyMessagesBoundary = dynamic(() => import("./boundary").then(module => module.MessagesBoundary));

const FloatingMessagesContext = createContext<((id: string) => void) | null>(null);

export function useFloatingMessages() {
  return useContext(FloatingMessagesContext);
}

export function FloatingMessages({ actor, locale, children }: {
  actor: string;
  locale: Locale;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const inboxPath = `/${locale}/app/messages`;
  const fullPage = pathname === inboxPath || pathname.startsWith(`${inboxPath}/`);
  return (
    <FloatingMessagesSession key={`${actor}:${locale}:${fullPage}`} actor={actor} locale={locale} fullPage={fullPage}>
      {children}
    </FloatingMessagesSession>
  );
}

function FloatingMessagesSession({ actor, locale, fullPage, children }: {
  actor: string;
  locale: Locale;
  fullPage: boolean;
  children: ReactNode;
}) {
  const [conversation, setConversation] = useState<string | null>(null);
  const [minimized, setMinimized] = useState(false);
  const open = (id: string) => {
    setConversation(id);
    setMinimized(false);
  };
  const close = () => {
    setConversation(null);
    const triggers = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-messages-trigger]"));
    triggers.find(trigger => trigger.getClientRects().length > 0)?.focus({ preventScroll: true });
  };

  return (
    <FloatingMessagesContext.Provider value={fullPage ? null : open}>
      {children}
      {!fullPage && conversation && (
        <LazyMessagesBoundary
          key={conversation}
          userId={actor}
          locale={locale}
          conversationId={conversation}
          peer={null}
          view={{ kind: "floating", minimized, close, toggle: () => setMinimized(value => !value) }}
        />
      )}
    </FloatingMessagesContext.Provider>
  );
}
