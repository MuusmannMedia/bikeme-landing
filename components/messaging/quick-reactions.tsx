"use client";

import { useEffect, useId, useRef, useState } from "react";

import type { Locale } from "@/lib/locales";
import { reactionEmojis } from "@/lib/messages/reactions";
import { reactionText } from "@/lib/messages/web-i18n";

import { MessageActionIcon } from "./message-action-icon";

export function QuickReactions({ locale, disabled, selected, onChoose, onMore, onFallback }: {
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

  function toggle() {
    const button = trigger.current;
    const picker = panel.current;
    if (!button || !picker || disabled) return;
    if (typeof picker.showPopover !== "function") {
      onFallback();
      return;
    }
    if (picker.matches(":popover-open")) {
      picker.hidePopover();
      return;
    }

    picker.showPopover();
    const anchor = button.getBoundingClientRect();
    const { width, height } = picker.getBoundingClientRect();
    const frame = button.closest(".bike-message-window")?.getBoundingClientRect();
    const minLeft = Math.max(8, (frame?.left ?? 0) + 6);
    const maxLeft = Math.min(window.innerWidth - 8, (frame?.right ?? window.innerWidth) - 6) - width;
    const left = Math.max(minLeft, Math.min(anchor.left + anchor.width / 2 - width / 2, maxLeft));
    const above = anchor.top - height - 7;
    const minTop = Math.max(8, (frame?.top ?? 0) + 6);
    const maxTop = Math.min(window.innerHeight - 8, (frame?.bottom ?? window.innerHeight) - 6) - height;
    const top = above >= minTop ? above : Math.max(minTop, Math.min(anchor.bottom + 7, maxTop));

    picker.style.left = `${left}px`;
    picker.style.top = `${top}px`;
    picker.querySelector("button")?.focus({ preventScroll: true });
  }

  function dismissToTrigger() {
    panel.current?.hidePopover();
    trigger.current?.focus({ preventScroll: true });
  }

  return (
    <>
      <button ref={trigger} type="button" className="bike-message-reaction-trigger" aria-expanded={expanded}
        aria-controls={id} aria-label={label} title={label} disabled={disabled} onClick={toggle}>
        <MessageActionIcon name="emoji" />
      </button>
      <div {...{ popover: "auto" }} ref={panel} id={id} className="bike-message-quick-popover" role="group"
        aria-label={label} onKeyDown={event => {
          if (event.key === "Escape") {
            event.preventDefault();
            dismissToTrigger();
          }
        }}>
        {reactionEmojis.map(emoji => (
          <button key={emoji} type="button" aria-pressed={selected === emoji} disabled={disabled}
            aria-label={reactionText(locale, "reactions.chooseEmoji", { emoji })} onClick={() => {
              dismissToTrigger();
              onChoose(emoji);
            }}>{emoji}</button>
        ))}
        {onMore && (
          <button type="button" aria-label={reactionText(locale, "reactions.more")} disabled={disabled} onClick={() => {
            dismissToTrigger();
            onMore();
          }}>+</button>
        )}
      </div>
    </>
  );
}
