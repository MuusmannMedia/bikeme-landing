"use client";

import { useState } from "react";

import { formatDateTime } from "@/lib/app-format";
import { chatText } from "@/lib/clubs/chat-i18n";
import { contentText } from "@/lib/clubs/content-i18n";
import type { Locale } from "@/lib/locales";
import { dmText } from "@/lib/messages/i18n";
import type { MessagesStore, State } from "@/lib/messages/store";

import { AppAvatar } from "../app-avatar";
import { MessageActionIcon } from "../messaging/message-action-icon";
import { UnreadBadge } from "../messaging/unread-provider";

export function MessagePopoverList({ actor, locale, state, store, peer, clearPeer, openConversation }: {
  actor: string;
  locale: Locale;
  state: State;
  store: MessagesStore;
  peer: string | null;
  clearPeer: () => void;
  openConversation: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const selecting = state.pick || !!peer;
  const ready = state.status === "ready" && !!state.data;
  const locked = !ready || state.busy || !!state.pending;
  const searchValid = Array.from(query).length <= 80;

  function start(recipient: string | null) {
    if (recipient && !locked) void store.run({ actorId: actor, type: "start", peer: recipient });
  }

  function back() {
    setQuery("");
    if (peer) clearPeer();
    else store.pick(null);
  }

  return (
    <>
      <div className="bike-message-popover-actions">
        {selecting ? (
          <button className="bike-app-button bike-app-button-secondary" type="button"
            disabled={state.busy || !!state.pending} onClick={back}>{dmText(locale, "back")}</button>
        ) : (
          <button className="bike-app-button" type="button" disabled={locked} onClick={() => store.pick("")}>
            <MessageActionIcon name="edit" />
            {dmText(locale, "new")}
          </button>
        )}
      </div>
      <div className="bike-message-popover-list">
        {state.error && state.status !== "error" && state.error !== "network" && (
          <p role="alert" className="bike-message-popover-feedback">
            {state.error === "access" || state.error === "unavailable" ? dmText(locale, "noPeople") : contentText(locale, "invalid")}
          </p>
        )}
        {state.sendState === "unknown" && state.pending && (
          <div className="bike-message-popover-feedback">
            <p role="alert">{dmText(locale, "pending")}</p>
            <button type="button" className="bike-app-button bike-app-button-secondary" disabled={state.busy || !ready}
              onClick={() => void store.retry()}>{contentText(locale, "retryAction")}</button>
          </div>
        )}
        {state.pick && (
          <form className="bike-message-recipient-search" onSubmit={event => {
            event.preventDefault();
            if (searchValid && !locked) store.pick(query);
          }}>
            <label className="bike-app-field">
              <span>{dmText(locale, "search")}</span>
              <input value={query} onChange={event => setQuery(event.target.value)} />
            </label>
            <button className="bike-app-button bike-app-button-secondary"
              disabled={!searchValid || locked}>{dmText(locale, "search")}</button>
          </form>
        )}
        {state.status === "ready" && state.data ? (
          selecting ? (
            <>
              {state.data.people.length ? (
                <ul>
                  {state.data.people.map(person => {
                    const name = person.display_name ?? dmText(locale, "deletedUser");
                    return (
                      <li key={person.id}>
                        <button type="button" className="bike-message-popover-row"
                          disabled={!person.id || locked || (!!peer && !state.data?.canSend)} onClick={() => start(person.id)}>
                          <AppAvatar name={name} size="small" />
                          <span className="bike-message-popover-copy"><strong>{name}</strong></span>
                          <MessageActionIcon name="dm" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : <p className="bike-message-popover-feedback">{dmText(locale, "noPeople")}</p>}
              {state.data.peopleMore && (
                <button className="bike-app-button bike-app-button-secondary" type="button"
                  disabled={state.moreLoading} onClick={() => void store.more()}>{dmText(locale, "morePeople")}</button>
              )}
            </>
          ) : (
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
                  onClick={() => void store.more()}>{dmText(locale, "more")}</button>
              )}
            </>
          )
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
    </>
  );
}
