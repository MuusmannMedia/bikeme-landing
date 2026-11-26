"use client";

import { formatDateTime } from "@/lib/app-format";
import { chatText } from "@/lib/clubs/chat-i18n";
import type { Locale } from "@/lib/locales";
import { dmText } from "@/lib/messages/i18n";
import type { MessagesStore, State } from "@/lib/messages/store";

import { AppAvatar } from "../app-avatar";
import { UnreadBadge } from "../messaging/unread-provider";

export function MessagePopoverList({ locale, state, store, openConversation }: {
  locale: Locale;
  state: State;
  store: MessagesStore;
  openConversation: (id: string) => void;
}) {
  const inbox = `/${locale}/app/messages`;

  return (
    <>
      <div className="bike-message-popover-list">
        {state.status === "ready" && state.data ? (
          <>
            {state.data.rows.length ? (
              <ul>
                {state.data.rows.map(row => {
                  const name = row.peer.display_name ?? dmText(locale, "deletedUser");
                  const timestamp = row.last_message?.edited_at ?? row.last_message?.created_at ?? row.created_at;

                  return (
                    <li key={row.id}>
                      <button type="button" className="bike-message-popover-row" onClick={() => openConversation(row.id)}>
                        <AppAvatar name={name} size="small" />
                        <span className="bike-message-popover-copy">
                          <strong>{name}</strong>
                          <span>{row.last_message?.body || dmText(locale, "noMessages")}</span>
                        </span>
                        <span className="bike-message-popover-meta">
                          <time dateTime={timestamp}>{formatDateTime(locale, timestamp)}</time>
                          <UnreadBadge locale={locale} conversation={row.id} />
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : <p className="bike-message-popover-feedback">{dmText(locale, "empty")}</p>}
            {state.data.hasMore && (
              <button className="bike-app-button bike-app-button-secondary" type="button" disabled={state.moreLoading}
                onClick={() => void store.more()}>
                {dmText(locale, "more")}
              </button>
            )}
          </>
        ) : (
          <div className="bike-message-popover-feedback">
            <p role={state.status === "error" ? "alert" : "status"}>
              {chatText(locale, state.status === "error" ? "offline" : "loading")}
            </p>
            {state.status === "error" && (
              <button type="button" className="bike-app-button bike-app-button-secondary" onClick={() => void store.sync(true)}>
                {chatText(locale, "retry")}
              </button>
            )}
          </div>
        )}
      </div>
      <a className="bike-app-nav-link bike-message-popover-footer" href={inbox}>{dmText(locale, "all")}</a>
    </>
  );
}
