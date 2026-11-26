"use client";

import dynamic from "next/dynamic";
import { useEffect, useId, useRef, useState, type RefObject } from "react";

import type { Locale } from "@/lib/locales";
import { dmText } from "@/lib/messages/i18n";
import { messageText } from "@/lib/messages/web-i18n";

import { MessageActionIcon } from "../messaging/message-action-icon";

const EmojiPalette = dynamic(() => import("../messaging/emoji-palette"), { ssr: false });

export function ComposerEmoji({ locale, editor, disabled, onChange }: {
  locale: Locale;
  editor: RefObject<HTMLTextAreaElement>;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const title = dmText(locale, "emoji");

  useEffect(() => {
    if (disabled) dialog.current?.close();
  }, [disabled]);

  function insert(emoji: string) {
    const field = editor.current;
    if (!field || disabled) return;

    const { selectionStart, selectionEnd, value } = field;
    const caret = selectionStart + emoji.length;
    onChange(value.slice(0, selectionStart) + emoji + value.slice(selectionEnd));
    dialog.current?.close();
    requestAnimationFrame(() => {
      if (editor.current !== field || field.readOnly) return;
      field.focus({ preventScroll: true });
      field.setSelectionRange(caret, caret);
    });
  }

  return (
    <>
      <button type="button" className="bike-message-composer-emoji" disabled={disabled} aria-label={title} title={title}
        aria-haspopup="dialog" aria-expanded={open} aria-controls={id} onClick={() => {
          dialog.current?.showModal();
          setOpen(true);
        }}>
        <MessageActionIcon name="emoji" />
      </button>
      <dialog ref={dialog} id={id} className="bike-message-dialog" aria-label={title} onClose={() => setOpen(false)}
        onKeyDown={event => {
          if (event.key === "Enter" && event.target instanceof HTMLInputElement) event.preventDefault();
        }}>
        <button type="button" className="bike-message-close"
          onClick={() => dialog.current?.close()} aria-label={messageText(locale, "close")}>×</button>
        {open && <EmojiPalette locale={locale} disabled={disabled} onChoose={insert} />}
      </dialog>
    </>
  );
}
