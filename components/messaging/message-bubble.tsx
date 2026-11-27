"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";

import type { Locale } from "@/lib/locales";
import { reactionEmojis } from "@/lib/messages/reactions";
import { messageText, reactionText } from "@/lib/messages/web-i18n";

import { MessageActionIcon } from "./message-action-icon";
import { QuickReactions, type QuickReactionsHandle } from "./quick-reactions";
import { useReactions } from "./reactions";

const EmojiPalette = dynamic(() => import("./emoji-palette"), { ssr: false });
const privateReactionEmojis = ["❤️", "😆", "😮", "😢", "😠", "👍"] as const;

export type MessageAction = {
  key: "edit" | "delete" | "reply" | "report" | "dm" | "block";
  label: string;
  run: () => void;
  disabled?: boolean;
  danger?: boolean;
};

export function MessageBubble({ id, own, body, locale, actions, disabled = false, actionIcons = false,
  quickActions = false, readOnlyReactions = false, menuId, children }: {
  id: string;
  own: boolean;
  body: string;
  locale: Locale;
  actions: MessageAction[];
  disabled?: boolean;
  actionIcons?: boolean;
  quickActions?: boolean;
  readOnlyReactions?: boolean;
  menuId?: string;
  children: ReactNode;
}) {
  const { store, state } = useReactions();
  const [open, setOpen] = useState(false);
  const [palette, setPalette] = useState(false);
  const [copied, setCopied] = useState(false);

  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const reactions = useRef<QuickReactionsHandle>(null);
  const entry = useRef<HTMLElement | null>(null);
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touch = useRef<{ id: number; x: number; y: number; held: boolean } | null>(null);
  const lastTap = useRef<{ time: number; x: number; y: number } | null>(null);

  const rows = state.messages[id];
  const mine = rows?.find(row => row.mine)?.emoji;
  const extended = state.emoji_version === "15.1";
  const emojis = quickActions && extended ? privateReactionEmojis : reactionEmojis;
  const canReact = !!rows && state.supported && !own && !disabled && !readOnlyReactions;
  const reactionLocked = state.busy || state.pending;
  const inlineReactions = quickActions && canReact;
  const reply = quickActions ? actions.find(action => action.key === "reply") : undefined;

  function close() {
    dialog.current?.close();
    setOpen(false);
    setPalette(false);
    requestAnimationFrame(() => {
      const target = entry.current;
      if (target?.isConnected) target.focus({ preventScroll: true });
      else trigger.current?.focus({ preventScroll: true });
    });
  }

  useEffect(() => {
    if (disabled || open && state.supported && !rows || palette && !extended) dialog.current?.close();
  }, [disabled, state.supported, palette, extended, rows, open]);

  useEffect(() => {
    if (open) dialog.current?.showModal();
  }, [open]);

  useEffect(() => () => {
    if (hold.current) clearTimeout(hold.current);
    hold.current = null;
    touch.current = null;
    lastTap.current = null;
  }, [disabled, id]);

  function show(extendedPalette = false) {
    if (disabled || window.getSelection()?.toString()) return;
    entry.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setOpen(true);
    setCopied(false);
    setPalette(extendedPalette);
  }

  function choose(emoji: string) {
    if (disabled || readOnlyReactions || reactionLocked || (!canReact && mine !== emoji)) return;
    if (!extended && mine !== emoji && !reactionEmojis.some(value => value === emoji)) return;
    if (open) close();
    void store?.set(id, mine === emoji ? null : emoji);
  }

  function openFromTouch() {
    if (inlineReactions && !reactionLocked) reactions.current?.open();
    else show();
  }

  function stopHold() {
    if (hold.current) clearTimeout(hold.current);
    hold.current = null;
  }

  function startPress(event: PointerEvent<HTMLDivElement>) {
    if (disabled || !event.isPrimary || event.pointerType === "mouse" ||
      (event.target as HTMLElement).closest("button,a")) return;
    const start = { id: event.pointerId, x: event.clientX, y: event.clientY, held: false };
    touch.current = start;
    hold.current = setTimeout(() => {
      hold.current = null;
      if (window.getSelection()?.toString()) return;
      start.held = true;
      lastTap.current = null;
      openFromTouch();
    }, 550);
  }

  function movePress(event: PointerEvent<HTMLDivElement>) {
    const start = touch.current;
    if (start?.id === event.pointerId && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8) {
      stopHold();
    }
  }

  function finishPress(event: PointerEvent<HTMLDivElement>) {
    const start = touch.current;
    if (start?.id !== event.pointerId) return;
    stopHold();
    touch.current = null;
    if (!quickActions || start.held || window.getSelection()?.toString()) return;

    const dx = event.clientX - start.x;
    const dy = Math.abs(event.clientY - start.y);
    const direction = getComputedStyle(event.currentTarget).direction === "rtl" ? -1 : 1;
    if (reply && !reply.disabled && !disabled && dx * direction >= 50 && dx * direction > dy * 2) {
      lastTap.current = null;
      reply.run();
      return;
    }
    if (!canReact || reactionLocked || Math.hypot(dx, dy) > 8) return;

    const tap = { time: event.timeStamp, x: event.clientX, y: event.clientY };
    const previous = lastTap.current;
    if (previous && tap.time - previous.time < 325 && Math.hypot(tap.x - previous.x, tap.y - previous.y) < 20) {
      lastTap.current = null;
      if (mine !== "❤️") choose("❤️");
    } else {
      lastTap.current = tap;
    }
  }

  return (
    <div className="bike-message-wrap" data-own={own} data-menu-open={open}
      data-action-count={1 + Number(inlineReactions) + Number(!!reply)}>
      <div className="bike-message-bubble" data-gestures={quickActions && !disabled}
        onPointerDown={startPress} onPointerMove={movePress} onPointerUp={finishPress}
        onPointerCancel={event => {
          if (touch.current?.id !== event.pointerId) return;
          stopHold();
          touch.current = null;
          lastTap.current = null;
        }}
        onContextMenu={event => {
          if (window.getSelection()?.toString() || (event.target as HTMLElement).closest("a,button")) return;
          event.preventDefault();
          if (!touch.current) show();
        }}>
        {children}
        <div className="bike-message-action-buttons">
          {inlineReactions && (
            <QuickReactions handle={reactions} locale={locale} disabled={reactionLocked} emojis={emojis}
              selected={mine} onChoose={choose}
              onMore={extended ? () => show(true) : undefined} onFallback={show} />
          )}
          {reply && (
            <button type="button" className="bike-message-reply-trigger" disabled={disabled || reply.disabled}
              aria-label={reply.label} title={reply.label} onClick={reply.run}>
              <MessageActionIcon name="reply" />
            </button>
          )}
          <button ref={trigger} id={menuId ?? `message-menu-${id}`} type="button"
            className="bike-message-menu-trigger" disabled={disabled} aria-label={messageText(locale, "menu")}
            title={actionIcons ? messageText(locale, "menu") : undefined}
            aria-haspopup="dialog" aria-expanded={open} onClick={() => show()}>
            {actionIcons ? <MessageActionIcon name="more" /> : "…"}
          </button>
        </div>
      </div>
      {!!rows?.length && (
        <div className="bike-reaction-chips">
          {rows.map(row => {
            const count = row.emoji + (row.count > 1 ? ` ${row.count}` : "");
            const label = reactionText(locale, "reactions.count", { emoji: row.emoji, count: row.count });
            return readOnlyReactions || own && !row.mine
              ? <span key={row.emoji} className="bike-reaction-chip" aria-label={label}>{count}</span>
              : <button key={row.emoji} type="button" className="bike-reaction-chip" aria-pressed={row.mine}
                  aria-label={label} disabled={disabled || reactionLocked} onClick={() => choose(row.emoji)}>{count}</button>;
          })}
        </div>
      )}
      {state.pending && state.error && state.pendingId === id && (
        <button type="button" className="bike-app-button bike-app-button-small" onClick={() => void store?.retry()}>
          {messageText(locale, "retry")}
        </button>
      )}
      {open && (
        <dialog ref={dialog} className="bike-message-dialog" aria-label={messageText(locale, "menu")}
          onCancel={event => { event.preventDefault(); close(); }} onClose={() => { setOpen(false); setPalette(false); }}>
          <button type="button" className="bike-message-close" onClick={close}
            aria-label={messageText(locale, "close")}>×</button>
          {palette && canReact && extended
            ? <EmojiPalette locale={locale} disabled={reactionLocked} onChoose={choose} onBack={() => setPalette(false)} />
            : <>
                {canReact && (
                  <div className="bike-quick-emoji">
                    {emojis.map(emoji => (
                      <button key={emoji} type="button" disabled={reactionLocked} aria-pressed={mine === emoji}
                        aria-label={reactionText(locale, "reactions.chooseEmoji", { emoji })}
                        onClick={() => choose(emoji)}>{emoji}</button>
                    ))}
                    {extended && (
                      <button type="button" aria-label={reactionText(locale, "reactions.more")}
                        onClick={() => setPalette(true)}>{quickActions ? "+" : "…"}</button>
                    )}
                  </div>
                )}
                <p className="bike-message-preview">{body}</p>
                <div className="bike-message-menu-actions">
                  {actions.map(action => (
                    <button key={action.key} type="button" disabled={action.disabled} data-danger={action.danger}
                      onClick={() => { close(); action.run(); }}>
                      {actionIcons && <MessageActionIcon name={action.key} />} {action.label}
                    </button>
                  ))}
                  <button type="button" onClick={() => {
                    void navigator.clipboard.writeText(body).then(() => setCopied(true)).catch(() => setCopied(false));
                  }}>
                    {actionIcons && <MessageActionIcon name="copy" />} {messageText(locale, "copy")}
                  </button>
                  {copied && <span role="status">{messageText(locale, "copied")}</span>}
                </div>
              </>}
        </dialog>
      )}
    </div>
  );
}
