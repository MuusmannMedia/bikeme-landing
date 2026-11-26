"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

import type { Locale } from "@/lib/locales";
import { messagesEntryFromSearch } from "@/lib/messages/entry";

export const LazyMessagesBoundary = dynamic(() => import("./boundary").then(module => module.MessagesBoundary));

type OpenConversation = (id: string) => void;
type ChatTarget = { id: string; message?: string };

const FloatingMessagesContext = createContext<OpenConversation | null>(null);

export function useFloatingMessages() {
  const open = useContext(FloatingMessagesContext);
  if (!open) throw new Error("Missing floating messages provider");
  return open;
}

export function FloatingMessages({ actor, locale, children }: {
  actor: string;
  locale: Locale;
  children: ReactNode;
}) {
  return (
    <FloatingMessagesSession key={`${actor}:${locale}`} actor={actor} locale={locale}>
      {children}
    </FloatingMessagesSession>
  );
}

function FloatingMessagesSession({ actor, locale, children }: {
  actor: string;
  locale: Locale;
  children: ReactNode;
}) {
  const entry = messagesEntryFromSearch(useSearchParams());
  const linkedId = entry?.kind === "conversation" ? entry.id : null;
  const linkedMessage = entry?.kind === "conversation" ? entry.message : undefined;
  const [conversation, setConversation] = useState<ChatTarget | null>(null);
  const [minimized, setMinimized] = useState(false);
  const open = useCallback((id: string) => {
    setConversation(current => current?.id === id ? current : { id });
    setMinimized(false);
  }, []);

  useEffect(() => {
    if (!linkedId) return;
    const frame = requestAnimationFrame(() => {
      setConversation({ id: linkedId, message: linkedMessage });
      setMinimized(false);
    });
    return () => cancelAnimationFrame(frame);
  }, [linkedId, linkedMessage]);

  function close() {
    setConversation(null);
    const triggers = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-messages-trigger]"));
    triggers.find(trigger => trigger.getClientRects().length > 0)?.focus({ preventScroll: true });
  }

  return (
    <FloatingMessagesContext.Provider value={open}>
      {children}
      {conversation && (
        <LazyMessagesBoundary
          key={`${conversation.id}:${conversation.message ?? ""}`}
          userId={actor}
          locale={locale}
          view={{
            kind: "floating",
            conversationId: conversation.id,
            initialMessage: conversation.message,
            minimized,
            close,
            toggle: () => setMinimized(value => !value),
          }}
        />
      )}
    </FloatingMessagesContext.Provider>
  );
}
