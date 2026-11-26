"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

import { getAppDictionary } from "@/lib/app-i18n";
import type { Locale } from "@/lib/locales";
import { dmText } from "@/lib/messages/i18n";

import { AppAvatar } from "../app-avatar";

export function FloatingMessageWindow({ locale, conversation, name, actions, minimized, toggle, close, children }: {
  locale: Locale;
  conversation: string;
  name: string | null;
  actions: ReactNode;
  minimized: boolean;
  toggle: () => void;
  close: () => void;
  children: ReactNode;
}) {
  const id = useId();
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    function adjustViewport() {
      if (!viewport) return;
      const bottom = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      panel.current?.style.setProperty("--message-visible-height", `${viewport.height}px`);
      panel.current?.style.setProperty("--message-keyboard-offset", `${bottom}px`);
    }

    adjustViewport();
    viewport.addEventListener("resize", adjustViewport);
    viewport.addEventListener("scroll", adjustViewport);
    return () => {
      viewport.removeEventListener("resize", adjustViewport);
      viewport.removeEventListener("scroll", adjustViewport);
    };
  }, []);
  const title = name ?? dmText(locale, "entry");

  return (
    <section ref={panel} className="bike-message-window" data-minimized={minimized} aria-labelledby={`${id}-title`}
      onKeyDown={event => {
        if (event.key === "Escape" && !event.defaultPrevented && !document.querySelector("dialog[open]")) {
          event.preventDefault();
          close();
        }
      }}>
      <header className="bike-message-window-header">
        <AppAvatar name={name} size="small" />
        <h2 id={`${id}-title`} title={title}>{title}</h2>
        {actions}
        {!minimized && name && (
          <a className="bike-message-window-control" href={`/${locale}/app/messages/${conversation}`}
            aria-label={dmText(locale, "full")} title={dmText(locale, "full")}>↗</a>
        )}
        <button autoFocus type="button" className="bike-message-window-control" aria-expanded={!minimized}
          aria-controls={`${id}-body`} aria-label={dmText(locale, minimized ? "restore" : "minimize")} onClick={toggle}>
          {minimized ? "+" : "−"}
        </button>
        <button type="button" className="bike-message-window-control"
          aria-label={getAppDictionary(locale)("common.close")} onClick={close}>×</button>
      </header>
      <div id={`${id}-body`} className="bike-message-window-body" hidden={minimized}>
        {children}
      </div>
    </section>
  );
}
