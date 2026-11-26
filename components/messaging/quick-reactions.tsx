"use client";

import { useEffect, useId, useImperativeHandle, useRef, useState, type Ref } from "react";

import type { Locale } from "@/lib/locales";
import { reactionText } from "@/lib/messages/web-i18n";

import { MessageActionIcon } from "./message-action-icon";

export type QuickReactionsHandle = { open: () => void };

export function QuickReactions({ handle, locale, disabled, emojis, selected, onChoose, onMore, onFallback }: {
  handle: Ref<QuickReactionsHandle>;
  emojis: readonly string[];
  locale: Locale;
  disabled: boolean;
  selected?: string;
  onChoose: (emoji: string) => void;
  onMore?: () => void;
  onFallback: () => void;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const label = reactionText(locale, "reactions.choose");

  useEffect(() => {
    const element = panel.current;
    if (!element || typeof element.hidePopover !== "function") return;

    function sync(event: Event) {
      setExpanded((event as ToggleEvent).newState === "open");
    }

    element.addEventListener("toggle", sync);
    return () => element.removeEventListener("toggle", sync);
  }, []);

  useEffect(() => {
    const element = panel.current;
    if (!expanded || !element) return;
    const dismiss = () => element.hidePopover();

    window.addEventListener("scroll", dismiss, true);
    window.addEventListener("resize", dismiss);
    return () => {
      window.removeEventListener("scroll", dismiss, true);
      window.removeEventListener("resize", dismiss);
    };
  }, [expanded]);

  useEffect(() => {
    if (disabled && expanded) panel.current?.hidePopover();
  }, [disabled, expanded]);

  function open() {
    const button = trigger.current;
    const picker = panel.current;
    if (!button || !picker || disabled) return;
    if (typeof picker.showPopover !== "function") {
      onFallback();
      return;
    }
    if (picker.matches(":popover-open")) return;

    picker.showPopover();
    const anchor = button.getBoundingClientRect();
    const bubble = button.closest(".bike-message-bubble")?.getBoundingClientRect() ?? anchor;
    const { width, height } = picker.getBoundingClientRect();
    const frame = button.closest(".bike-message-window")?.getBoundingClientRect();
    const minLeft = Math.max(8, (frame?.left ?? 0) + 6);
    const maxLeft = Math.min(window.innerWidth - 8, (frame?.right ?? window.innerWidth) - 6) - width;
    const left = Math.max(minLeft, Math.min(anchor.left + anchor.width / 2 - width / 2, maxLeft));
    const above = bubble.top - height - 7;
    const minTop = Math.max(8, (frame?.top ?? 0) + 6);
    const maxTop = Math.min(window.innerHeight - 8, (frame?.bottom ?? window.innerHeight) - 6) - height;
    const top = above >= minTop ? above : Math.max(minTop, Math.min(bubble.bottom + 7, maxTop));

    picker.style.left = `${left}px`;
    picker.style.top = `${top}px`;
    (picker.querySelector<HTMLButtonElement>('button[aria-pressed="true"]') ?? picker.querySelector("button"))
      ?.focus({ preventScroll: true });
  }

  useImperativeHandle(handle, () => ({ open }));

  function dismissToTrigger() {
    panel.current?.hidePopover();
    trigger.current?.focus({ preventScroll: true });
  }

  return (
    <>
      <button ref={trigger} type="button" className="bike-message-reaction-trigger" aria-expanded={expanded}
        aria-controls={id} aria-label={label} title={label} disabled={disabled} onClick={() => {
          if (expanded) dismissToTrigger();
          else open();
        }}>
        <MessageActionIcon name="emoji" />
      </button>
      <div {...{ popover: "auto" }} ref={panel} id={id} className="bike-message-quick-popover" role="group"
        aria-label={label} onKeyDown={event => {
          if (event.key === "Escape") {
            event.preventDefault();
            dismissToTrigger();
          } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("button:enabled")];
            const focused = buttons.indexOf(document.activeElement as HTMLButtonElement);
            const direction = getComputedStyle(event.currentTarget).direction === "rtl" ? -1 : 1;
            const step = event.key === "ArrowRight" ? direction : -direction;
            if (focused < 0) return;
            event.preventDefault();
            buttons[(focused + step + buttons.length) % buttons.length]?.focus({ preventScroll: true });
          }
        }}>
        {emojis.map(emoji => (
          <button key={emoji} type="button" aria-pressed={selected === emoji} disabled={disabled}
            aria-label={reactionText(locale, "reactions.chooseEmoji", { emoji })} onClick={() => {
              dismissToTrigger();
              onChoose(emoji);
            }}>{emoji}</button>
        ))}
        {onMore && (
          <button type="button" className="bike-message-more-emoji" aria-label={reactionText(locale, "reactions.more")} disabled={disabled} onClick={() => {
            dismissToTrigger();
            onMore();
          }}>+</button>
        )}
      </div>
    </>
  );
}
