"use client";

import { useEffect, useRef, useState } from "react";

import { getAppDictionary } from "@/lib/app-i18n";
import { formatDateTime } from "@/lib/app-format";
import { validateContent } from "@/lib/clubs/content-contract";
import { contentText } from "@/lib/clubs/content-i18n";
import { galleryErrorKind, galleryResponse } from "@/lib/clubs/gallery-client";
import type { GalleryComment, GalleryDiscussion, GalleryErrorCode, GalleryPage } from "@/lib/clubs/gallery-contract";
import { galleryText, type GalleryTextKey } from "@/lib/clubs/gallery-i18n";
import type { Locale } from "@/lib/locales";

type Command = { type: "like"; liked: boolean } |
  { type: "comment"; commentId: string; body: string } |
  { type: "removeComment"; commentId: string };

export function ClubGalleryDiscussion({ endpoint, photoId, locale, userId, galleryVersion, locked, onReport }: {
  endpoint: string;
  photoId: string;
  locale: Locale;
  userId: string;
  galleryVersion: GalleryPage | null;
  locked: boolean;
  onReport: (comment: GalleryComment) => void;
}) {
  const t = getAppDictionary(locale);
  const ct = (key: Parameters<typeof contentText>[1]) => contentText(locale, key);
  const text = (key: GalleryTextKey) => galleryText(locale, key);
  const [discussion, setDiscussion] = useState<GalleryDiscussion | null>(null);
  const [pageCount, setPageCount] = useState(1);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [readError, setReadError] = useState<GalleryErrorCode | null>(null);
  const [writeError, setWriteError] = useState<GalleryErrorCode | null>(null);
  const [draft, setDraft] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const mutation = useRef<AbortController | null>(null);
  const pendingComment = useRef<{ commentId: string; body: string } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(20_000)]);
    async function load() {
      setLoading(true);
      const read = async (cursor?: GalleryDiscussion["next"]) => {
        const query = new URLSearchParams({ id: photoId, variant: "discussion" });
        if (cursor) {
          query.set("beforeTime", cursor.time);
          query.set("beforeId", cursor.id);
        }
        return galleryResponse<GalleryDiscussion>(await fetch(`${endpoint}&${query}`, { signal, cache: "no-store" }), userId);
      };
      try {
        let view = await read();
        for (let index = 1; index < pageCount && view.next; index++) {
          const next = await read(view.next);
          view = { ...next, comments: [...view.comments, ...next.comments] };
        }
        if (!controller.signal.aborted) {
          setDiscussion(view);
          setReadError(null);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setDiscussion(null);
          setReadError(galleryErrorKind(error));
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    queueMicrotask(() => { if (!controller.signal.aborted) void load(); });
    return () => controller.abort();
  }, [endpoint, galleryVersion, pageCount, photoId, revision, userId]);

  useEffect(() => () => mutation.current?.abort(), []);

  function errorText(error: GalleryErrorCode) {
    if (error === "auth" || error === "access") return ct("access");
    if (error === "invalid" || error === "unavailable" || error === "contentRejected" || error === "conflict") return ct(error);
    return ct("network");
  }

  async function send(command: Command) {
    if (locked || loading || mutation.current) return;
    const controller = new AbortController();
    mutation.current = controller;
    setSaving(true);
    setWriteError(null);
    try {
      const response = await fetch(endpoint, {
        method: "POST", cache: "no-store",
        headers: { "Content-Type": "application/json", "X-Gallery-Actor": userId },
        body: JSON.stringify({ ...command, id: photoId }),
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20_000)]),
      });
      await galleryResponse(response, userId);
      if (controller.signal.aborted) return;
      if (command.type === "comment") {
        pendingComment.current = null;
        setDraft("");
      }
      if (command.type === "removeComment") setConfirmId(null);
      setLoading(true);
      setRevision(value => value + 1);
    } catch (error) {
      if (!controller.signal.aborted) {
        const kind = galleryErrorKind(error);
        setWriteError(kind);
        if (kind === "auth" || kind === "access" || kind === "unavailable") {
          setDiscussion(null);
          setReadError(kind);
        }
      }
    } finally {
      mutation.current = null;
      if (!controller.signal.aborted) setSaving(false);
    }
  }

  let body = "";
  try { body = validateContent(draft, "comment"); } catch { /* Keep invalid drafts editable. */ }
  const disabled = locked || loading || saving;
  return <section className="bike-app-gallery-discussion" aria-label={text("comments")}>
    <div className="bike-app-gallery-discussion-heading">
      <h3>{text("comments")}</h3>
      {discussion ? <div className="bike-app-gallery-like">
        <button type="button" className="bike-app-button bike-app-button-secondary"
          aria-pressed={discussion.liked} disabled={disabled}
          onClick={() => void send({ type: "like", liked: !discussion.liked })}>
          <span aria-hidden="true">{discussion.liked ? "♥" : "♡"}</span> {text("like")}
        </button>
        <span aria-live="polite" aria-label={`${text("like")}: ${discussion.likeCount}`}>{discussion.likeCount}</span>
      </div> : null}
    </div>
    {readError ? <div>
      <p role="alert">{errorText(readError)}</p>
      <button type="button" className="bike-app-button bike-app-button-secondary" disabled={loading}
        onClick={() => setRevision(value => value + 1)}>{t("common.retry")}</button>
    </div> : null}
    {loading && !discussion ? <p role="status">{text("loadingComments")}</p> : null}
    {writeError && writeError !== readError ? <p role="alert">{errorText(writeError)}</p> : null}
    {discussion ? <>
      <form className="bike-app-gallery-comment-form" onSubmit={event => {
        event.preventDefault();
        if (disabled || !body) return;
        if (pendingComment.current?.body !== body) pendingComment.current = { body, commentId: crypto.randomUUID() };
        void send({ type: "comment", ...pendingComment.current });
      }}>
        <label className="bike-app-field">
          <span>{ct("comment")}</span>
          <textarea rows={2} value={draft} disabled={locked || saving}
            onChange={event => setDraft(event.target.value)} />
        </label>
        <button type="submit" className="bike-app-button" disabled={disabled || !body}>{text("sendComment")}</button>
      </form>
      {discussion.comments.length ? <ul className="bike-app-gallery-comments">
        {discussion.comments.map(comment => <li key={comment.id}>
          <div className="bike-app-gallery-comment-meta">
            <strong>{comment.author ?? ct("deletedAuthor")}</strong>
            <time dateTime={comment.createdAt}>{formatDateTime(locale, comment.createdAt)}</time>
          </div>
          <p className="bike-app-content-body">{comment.body}</p>
          <div className="bike-app-actions">
            {comment.reportable && confirmId !== comment.id ? <button type="button"
              className="bike-app-button bike-app-button-secondary" disabled={disabled}
              onClick={() => onReport(comment)}>{text("reportComment")}</button> : null}
            {comment.removable ? confirmId === comment.id ? <>
              <button type="button" className="bike-app-button bike-app-button-danger" disabled={disabled}
                onClick={() => void send({ type: "removeComment", commentId: comment.id })}>{text("deleteComment")}</button>
              <button type="button" className="bike-app-button bike-app-button-secondary" disabled={saving}
                onClick={() => setConfirmId(null)}>{t("common.cancel")}</button>
            </> : <button type="button" className="bike-app-button bike-app-button-secondary" disabled={disabled}
              onClick={() => setConfirmId(comment.id)}>{text("deleteComment")}</button> : null}
          </div>
        </li>)}
      </ul> : <p className="bike-app-muted">{text("noComments")}</p>}
      {discussion.next ? <button type="button" className="bike-app-button bike-app-button-secondary" disabled={disabled}
        onClick={() => setPageCount(value => value + 1)}>{text("moreComments")}</button> : null}
    </> : null}
  </section>;
}
