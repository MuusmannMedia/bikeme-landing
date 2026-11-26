"use client";

import { useEffect, useId, useRef } from "react";

import { getAppDictionary } from "@/lib/app-i18n";
import { contentText } from "@/lib/clubs/content-i18n";
import type { Locale } from "@/lib/locales";
import { dmText } from "@/lib/messages/i18n";

import { MessageActionIcon } from "../messaging/message-action-icon";

export function ConversationBlock({ locale, blocked, disabled, onChange }: {
  locale: Locale;
  blocked: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
}) {
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const title = dmText(locale, blocked ? "unblock" : "block");

  useEffect(() => {
    if (disabled) dialog.current?.close();
  }, [disabled]);

  return (
    <>
      <button type="button" className="bike-message-window-control"
        disabled={disabled} aria-label={title} title={title}
        aria-haspopup="dialog" onClick={() => dialog.current?.showModal()}>
        <MessageActionIcon name={blocked ? "unblock" : "block"} />
      </button>
      <dialog ref={dialog} className="bike-app-club-dialog" aria-labelledby={titleId}>
        <h2 id={titleId}>{title}</h2>
        <p>{dmText(locale, blocked ? "unblockBody" : "blockBody")}</p>
        <div className="bike-app-actions">
          <button type="button" autoFocus className="bike-app-button bike-app-button-secondary" onClick={() => dialog.current?.close()}>
            {getAppDictionary(locale)("common.cancel")}
          </button>
          <button type="button" className="bike-app-button bike-app-button-danger" disabled={disabled} onClick={() => {
            dialog.current?.close();
            onChange(!blocked);
          }}>
            {contentText(locale, "confirm")}
          </button>
        </div>
      </dialog>
    </>
  );
}
