"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { flushSync } from "react-dom";

import { AppEmpty, AppPanel } from "@/components/app-ui";
import { getAppDictionary } from "@/lib/app-i18n";
import { CLUB_AUTH_EVENT, clubAuthPhase } from "@/lib/clubs/auth-events";
import { contentText } from "@/lib/clubs/content-i18n";
import {
  GalleryError, galleryCaption, galleryImageUrl, galleryLimits,
  type GalleryComment, type GalleryCursor, type GalleryErrorCode, type GalleryPage, type GalleryPhoto,
} from "@/lib/clubs/gallery-contract";
import { galleryErrorKind, galleryResponse } from "@/lib/clubs/gallery-client";
import { galleryText, type GalleryTextKey } from "@/lib/clubs/gallery-i18n";
import { normalizeImageForBrowser } from "@/lib/clubs/image-browser";
import type { Club } from "@/lib/clubs/types";
import type { Locale } from "@/lib/locales";
import { subscribeOwnSignals } from "@/lib/realtime/own-signals";
import { createClient } from "@/lib/supabase/client";

import { ClubGalleryDiscussion } from "./club-gallery-discussion";
import { ClubReportForm, type ClubReportFields } from "./club-report-form";
import { ClubAccessDenied, ClubHeader } from "./club-ui";

type Snapshot = GalleryPage;
type UploadForm = { files: File[]; captions: string[] };
type GalleryDialogMode = "view" | "report" | "remove";
const emptyUpload: UploadForm = { files: [], captions: [] };

export function ClubGallery({ club, locale, userId }: { club: Club; locale: Locale; userId: string }) {
  const t = getAppDictionary(locale);
  const text = (key: GalleryTextKey) => galleryText(locale, key);
  const ct = (key: Parameters<typeof contentText>[1]) => contentText(locale, key);
  const endpoint = `/api/clubs/gallery?clubId=${club.id}`;

  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [checking, setChecking] = useState(true);
  const [concealed, setConcealed] = useState(false);
  const [loadError, setLoadError] = useState<GalleryErrorCode | null>(null);
  const [upload, setUpload] = useState<UploadForm>(emptyUpload);
  const [task, setTask] = useState<"upload" | "report" | "remove" | null>(null);
  const [uploadRetry, setUploadRetry] = useState(false);
  const [feedback, setFeedback] = useState<GalleryErrorCode | null>(null);
  const [notice, setNotice] = useState<"upload" | "sentClub" | "sentBikeMe" | "removed" | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dialogMode, setDialogMode] = useState<GalleryDialogMode>("view");
  const [reportFields, setReportFields] = useState<ClubReportFields>({ destination: "club", reason: "spam", detail: "" });
  const [reportedComment, setReportedComment] = useState<GalleryComment | null>(null);

  const loadController = useRef<AbortController | null>(null);
  const actionController = useRef<AbortController | null>(null);
  const requestedPages = useRef(1);
  const confirmed = useRef(false);
  const retryBody = useRef<FormData | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const selectionVersion = useRef(0);

  const selectedIndex = snapshot?.photos.findIndex(photo => photo.id === selectedId) ?? -1;
  const selected = snapshot?.photos[selectedIndex];
  const previous = snapshot?.photos[selectedIndex - 1];
  const next = snapshot?.photos[selectedIndex + 1];
  const canGoNext = Boolean(next || (snapshot?.next && !checking));
  const canDisplay = Boolean(snapshot && !concealed && !loadError);

  const readPage = useCallback(async (cursor: GalleryCursor | null, signal: AbortSignal) => {
    const query = new URLSearchParams();
    if (cursor) {
      query.set("beforeTime", cursor.time);
      query.set("beforeId", cursor.id);
    }
    const response = await fetch(`${endpoint}&${query}`, { cache: "no-store", signal });
    return galleryResponse<Snapshot>(response, userId);
  }, [endpoint, userId]);

  const refresh = useCallback(async (more = false, advanceFrom?: string) => {
    if (loadController.current) return;
    const version = selectionVersion.current;
    const controller = new AbortController();
    loadController.current = controller;
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(30_000)]);
    setChecking(true);
    try {
      const count = requestedPages.current + (more ? 1 : 0);
      let view = await readPage(null, signal);
      for (let index = 1; index < count && view.next; index++) {
        const next = await readPage(view.next, signal);
        view = { ...next, photos: [...view.photos, ...next.photos] };
      }
      if (controller.signal.aborted) return;
      requestedPages.current = count;
      confirmed.current = true;
      setSnapshot(view);
      setLoadError(null);
      setConcealed(false);
      const shouldAdvance = advanceFrom !== undefined && version === selectionVersion.current;
      setSelectedId(id => {
        const index = view.photos.findIndex(photo => photo.id === id);
        if (index === -1) return null;
        return shouldAdvance && id === advanceFrom ? view.photos[index + 1]?.id ?? id : id;
      });
    } catch (error) {
      if (controller.signal.aborted) return;
      const kind = galleryErrorKind(error);
      confirmed.current = false;
      setSnapshot(null);
      setSelectedId(null);
      setLoadError(kind);
      if (kind === "auth" || kind === "access") {
        actionController.current?.abort();
        setUpload(emptyUpload);
        retryBody.current = null;
      }
    } finally {
      if (loadController.current === controller) {
        loadController.current = null;
        setChecking(false);
      }
    }
  }, [readPage]);

  useEffect(() => {
    const client = createClient();
    const pause = () => {
      loadController.current?.abort();
      loadController.current = null;
      if (confirmed.current) flushSync(() => setConcealed(true));
    };
    const verify = () => { if (document.visibilityState === "visible") void refresh(); };
    const invalidate = () => { pause(); verify(); };
    const show = () => document.visibilityState === "visible" ? verify() : pause();
    const onPageShow = (event: PageTransitionEvent) => { if (event.persisted) verify(); };
    const identityLost = () => {
      pause();
      actionController.current?.abort();
      retryBody.current = null;
      flushSync(() => {
        setSnapshot(null);
        setSelectedId(null);
        setUpload(emptyUpload);
        setLoadError("auth");
      });
    };
    const onAuth = (event: Event) => {
      const phase = (event as CustomEvent<string>).detail;
      if (phase) identityLost();
      if (phase === "settled") window.location.reload();
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key !== CLUB_AUTH_EVENT) return;
      const phase = clubAuthPhase(event.newValue);
      if (phase) identityLost();
      if (phase === "settled") window.location.reload();
    };
    const auth = client?.auth.onAuthStateChange((_event, session) => {
      if (session?.user.id !== userId) queueMicrotask(identityLost);
    }).data.subscription;
    const stop = subscribeOwnSignals(client, userId, `club-gallery-${crypto.randomUUID()}`, ["club_chat_signals"], {
      ready: verify, change: invalidate, unavailable: verify,
    });
    const poll = window.setInterval(verify, 30_000);
    window.addEventListener("focus", verify);
    window.addEventListener("online", verify);
    window.addEventListener("offline", pause);
    window.addEventListener("pagehide", pause);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("storage", onStorage);
    window.addEventListener(CLUB_AUTH_EVENT, onAuth);
    document.addEventListener("visibilitychange", show);
    let disposed = false;
    queueMicrotask(() => { if (!disposed) verify(); });
    return () => {
      disposed = true;
      stop();
      auth?.unsubscribe();
      clearInterval(poll);
      loadController.current?.abort();
      loadController.current = null;
      actionController.current?.abort();
      window.removeEventListener("focus", verify);
      window.removeEventListener("online", verify);
      window.removeEventListener("offline", pause);
      window.removeEventListener("pagehide", pause);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(CLUB_AUTH_EVENT, onAuth);
      document.removeEventListener("visibilitychange", show);
    };
  }, [refresh, userId]);

  useEffect(() => {
    const element = dialog.current;
    if (canDisplay && selected && element && !element.open) element.showModal();
    if ((!canDisplay || !selected) && element?.open) element.close();
  }, [canDisplay, selected]);

  function setFiles(files: File[]) {
    setFeedback(files.length > galleryLimits.batch ? "invalid" : null);
    setNotice(null);
    retryBody.current = null;
    setUploadRetry(false);
    setUpload(files.length > galleryLimits.batch ? emptyUpload : { files, captions: files.map(() => "") });
  }

  function showPhoto(photo: GalleryPhoto, button: HTMLButtonElement) {
    returnFocus.current = button;
    selectionVersion.current++;
    setDialogMode("view");
    setFeedback(null);
    setSelectedId(photo.id);
  }

  function browsePhoto(direction: -1 | 1) {
    if (!selected || dialogMode !== "view" || task) return;
    const target = direction === -1 ? previous : next;
    if (target) {
      selectionVersion.current++;
      setSelectedId(target.id);
    } else if (direction === 1 && canGoNext) {
      void refresh(true, selected.id);
    }
  }

  function openReport(comment: GalleryComment | null) {
    setFeedback(null);
    setReportedComment(comment);
    setReportFields({ destination: "club", reason: "spam", detail: "" });
    setDialogMode("report");
  }

  async function submit(kind: NonNullable<typeof task>, body: () => Promise<BodyInit>) {
    if (actionController.current || !canDisplay || checking) return;
    const controller = new AbortController();
    actionController.current = controller;
    setTask(kind);
    setFeedback(null);
    setNotice(null);
    try {
      const prepared = await body();
      const headers = new Headers({ "X-Gallery-Actor": userId });
      if (typeof prepared === "string") headers.set("Content-Type", "application/json");
      const response = await fetch(endpoint, {
        method: "POST", headers, body: prepared, cache: "no-store",
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(65_000)]),
      });
      await galleryResponse(response, userId);
      if (kind === "upload") {
        setUpload(emptyUpload);
        retryBody.current = null;
        setUploadRetry(false);
        if (fileInput.current) fileInput.current.value = "";
      } else {
        dialog.current?.close();
      }
      setNotice(kind === "report" ? reportFields.destination === "club" ? "sentClub" : "sentBikeMe" : kind === "remove" ? "removed" : "upload");
      if (kind !== "report") {
        loadController.current?.abort();
        loadController.current = null;
        await refresh();
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        const kind = galleryErrorKind(error);
        setFeedback(kind);
        if (retryBody.current !== null && (kind === "busy" || kind === "network")) setUploadRetry(true);
        if (["access", "auth", "unavailable"].includes(kind)) {
          loadController.current?.abort();
          loadController.current = null;
          await refresh();
        }
      }
    } finally {
      actionController.current = null;
      setTask(null);
    }
  }

  function uploadPhotos(event: FormEvent) {
    event.preventDefault();
    if (!upload.files.length) return;
    void submit("upload", async () => {
      if (retryBody.current) return retryBody.current;
      const form = new FormData();
      form.set("requestId", crypto.randomUUID());
      for (const [index, file] of upload.files.entries()) {
        const caption = galleryCaption(upload.captions[index]);
        const normalized = await normalizeImageForBrowser(file, "cover", actionController.current!.signal, {
          maxBytes: galleryLimits.browserInput,
          maxPixels: galleryLimits.pixels,
        }).catch(() => { throw new GalleryError("image"); });
        form.append("photo", normalized, "photo.jpg");
        form.append("caption", caption);
      }
      retryBody.current = form;
      return form;
    });
  }

  function errorMessage(error: GalleryErrorCode) {
    switch (error) {
      case "invalid": case "image": case "size": case "quota": case "capacity": case "busy": return text(error);
      case "access": case "auth": return ct("access");
      case "unavailable": return ct("unavailable");
      case "conflict": case "contentRejected": return ct(error);
      default: return ct("network");
    }
  }

  if (loadError === "access" || loadError === "auth") return <ClubAccessDenied locale={locale} />;

  return <>
    {canDisplay && snapshot ? <ClubHeader club={{ ...club, role: snapshot.role }} locale={locale} selected="gallery" /> : null}
    <AppPanel title={text("title")} className="bike-app-gallery">
      {canDisplay && snapshot?.role !== "member" ? <a className="bike-app-button bike-app-button-secondary"
        href={`/${locale}/app/clubs/${club.id}/posts/moderation`}>{ct("moderation")}</a> : null}
      {!canDisplay ? <div role={loadError ? "alert" : "status"}>
        <p>{loadError ? errorMessage(loadError) : text("loading")}</p>
        {loadError ? <button type="button" className="bike-app-button" onClick={() => void refresh()}>{t("common.retry")}</button> : null}
      </div> : <>
        <details className="bike-app-gallery-upload">
          <summary>{text("add")}</summary>
          <form onSubmit={uploadPhotos} className="bike-app-gallery-form">
            <label className="bike-app-field">
              <span>{text("choose")}</span>
              <input ref={fileInput} type="file" accept="image/jpeg,image/png,.jpg,.jpeg,.png" multiple
                disabled={Boolean(task) || uploadRetry} onChange={event => setFiles(Array.from(event.currentTarget.files ?? []))} />
            </label>
            {upload.files.map((file, index) => <label className="bike-app-field" key={index}>
              <span>{file.name} · {text("caption")}</span>
              <input value={upload.captions[index]} maxLength={galleryLimits.caption} disabled={Boolean(task) || uploadRetry}
                onChange={event => {
                  retryBody.current = null;
                  const caption = event.currentTarget.value;
                  setUpload(previous => ({ ...previous, captions: previous.captions.map((value, i) => i === index ? caption : value) }));
                }} />
            </label>)}
            <button type="submit" className="bike-app-button" disabled={!upload.files.length || Boolean(task) || checking}>
              {task === "upload" ? text("uploading") : text("add")}
            </button>
          </form>
        </details>
        {!selected && feedback ? <p role="alert">{errorMessage(feedback)}</p> : null}
        {notice ? <p role="status">{notice === "upload" ? text("uploaded") : ct(notice)}</p> : null}
        {snapshot?.photos.length ? <ul className="bike-app-gallery-grid">
          {snapshot.photos.map(photo => <li key={photo.id}>
            <button type="button" aria-haspopup="dialog" className="bike-app-gallery-tile"
              aria-label={photo.caption || `${text("photo")} · ${text("uploader").replace("{name}", photo.uploader ?? ct("deletedAuthor"))}`}
              onClick={event => showPhoto(photo, event.currentTarget)}>
              {/* Cookie-authenticated bytes stay out of the optimizer and shared caches. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={galleryImageUrl(club.id, photo.id, "thumbnail")} alt="" loading="lazy" decoding="async" />
            </button>
          </li>)}
        </ul> : <AppEmpty>{text("empty")}</AppEmpty>}
        {snapshot?.next ? <button type="button" className="bike-app-button bike-app-button-secondary"
          disabled={checking} onClick={() => void refresh(true)}>{checking ? text("loading") : text("more")}</button> : null}
      </>}
    </AppPanel>

    <dialog ref={dialog} className="bike-app-club-dialog bike-app-gallery-dialog" aria-labelledby="gallery-photo-title"
      onKeyDown={event => {
        if (dialogMode !== "view" || task || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        if (event.target instanceof HTMLElement && event.target.closest("input,textarea,select,[contenteditable]")) return;
        event.preventDefault();
        browsePhoto(event.key === "ArrowLeft" ? -1 : 1);
      }}
      onCancel={event => { if (task) event.preventDefault(); }}
      onClose={() => {
        selectionVersion.current++;
        setSelectedId(null);
        setReportedComment(null);
        setFeedback(null);
        requestAnimationFrame(() => returnFocus.current?.focus({ preventScroll: true }));
      }}>
      {selected && canDisplay ? <>
        <div className="bike-app-gallery-dialog-header">
          <h2 id="gallery-photo-title">{dialogMode === "report" ? text(reportedComment ? "reportComment" : "report") : dialogMode === "remove" ? text("remove") : text("photo")}</h2>
          <button type="button" ref={closeButton} className="bike-app-button bike-app-button-secondary" disabled={Boolean(task)}
            onClick={() => dialog.current?.close()}>{text("close")}</button>
        </div>
        {feedback ? <p role="alert">{errorMessage(feedback)}</p> : null}
        {dialogMode === "view" ? <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="bike-app-gallery-full" src={galleryImageUrl(club.id, selected.id, "full")}
            width={selected.width} height={selected.height} alt={selected.caption || text("photo")} />
          <div className="bike-app-gallery-browse">
            <button type="button" className="bike-app-button bike-app-button-secondary"
              aria-keyshortcuts="ArrowLeft" aria-label={text("previousPhoto")} aria-disabled={!previous}
              onClick={() => browsePhoto(-1)}>←</button>
            <p className="sr-only" aria-live="polite" aria-atomic="true">
              {text("photo")} {selectedIndex + 1}{selected.caption ? `: ${selected.caption}` : ""}
            </p>
            <button type="button" className="bike-app-button bike-app-button-secondary"
              aria-keyshortcuts="ArrowRight" aria-label={text("nextPhoto")} aria-disabled={!canGoNext}
              onClick={() => browsePhoto(1)}>→</button>
          </div>
          {selected.caption ? <p className="bike-app-content-body">{selected.caption}</p> : null}
          <p className="bike-app-muted">{text("uploader").replace("{name}", selected.uploader ?? ct("deletedAuthor"))}</p>
          <div className="bike-app-actions">
            {!selected.own ? <button type="button" className="bike-app-button bike-app-button-secondary" disabled={checking}
              onClick={() => openReport(null)}>{text("report")}</button> : null}
            {selected.own || snapshot?.role === "owner" || snapshot?.role === "admin" ? <button type="button" className="bike-app-button bike-app-button-danger" disabled={checking}
              onClick={() => { setDialogMode("remove"); closeButton.current?.focus(); }}>{text("remove")}</button> : null}
          </div>
          <ClubGalleryDiscussion key={selected.id} endpoint={endpoint} photoId={selected.id} locale={locale}
            userId={userId} galleryVersion={snapshot} locked={checking || Boolean(task)} onReport={openReport} />
        </> : dialogMode === "report" ? <>
          {reportedComment ? <blockquote className="bike-app-content-body">{reportedComment.body}</blockquote> : null}
          <ClubReportForm photo locale={locale} value={reportFields} locked={Boolean(task) || checking}
            onChange={setReportFields} onCancel={() => { setReportedComment(null); setDialogMode("view"); closeButton.current?.focus(); }}
            onSubmit={() => void submit("report", async () => JSON.stringify(reportedComment
              ? { type: "reportComment", id: selected.id, commentId: reportedComment.id, ...reportFields }
              : { type: "report", id: selected.id, ...reportFields }))} />
        </>
        : <>
          <p>{text("confirmRemove")}</p>
          <div className="bike-app-actions">
            <button type="button" className="bike-app-button bike-app-button-secondary" disabled={Boolean(task)}
              onClick={() => { setDialogMode("view"); closeButton.current?.focus(); }}>{t("common.cancel")}</button>
            <button type="button" className="bike-app-button bike-app-button-danger" disabled={Boolean(task) || checking}
              onClick={() => void submit("remove", async () => JSON.stringify({ type: "remove", id: selected.id }))}>{text("remove")}</button>
          </div>
        </>}
      </> : null}
    </dialog>
  </>;
}
