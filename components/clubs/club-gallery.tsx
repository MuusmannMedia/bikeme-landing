"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { flushSync } from "react-dom";

import { AppEmpty, AppPanel } from "@/components/app-ui";
import { getAppDictionary } from "@/lib/app-i18n";
import { CLUB_AUTH_EVENT, clubAuthPhase } from "@/lib/clubs/auth-events";
import { contentText } from "@/lib/clubs/content-i18n";
import {
  GalleryError, galleryCaption, galleryImageUrl, galleryLimits, galleryViewSize,
  type GalleryComment, type GalleryCursor, type GalleryErrorCode, type GalleryPage, type GalleryPhoto, type GalleryViewSize,
} from "@/lib/clubs/gallery-contract";
import { galleryErrorKind, galleryResponse } from "@/lib/clubs/gallery-client";
import { galleryText, type GalleryTextKey } from "@/lib/clubs/gallery-i18n";
import { createGalleryPhotoCache } from "@/lib/clubs/gallery-photo-cache";
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

function createGalleryViewer(clubId: string, userId: string) {
  let viewSize: GalleryViewSize | undefined;
  let expandedSize: GalleryViewSize | undefined;
  let supportsAvif: Promise<boolean> | undefined;

  const sizeFor = (expanded: boolean) => galleryViewSize(innerWidth, innerHeight, devicePixelRatio, expanded);
  function cacheFor(expanded: boolean) {
    return createGalleryPhotoCache({
      async read(id, signal, background) {
        const size = (expanded ? expandedSize : viewSize) ?? sizeFor(expanded);
        supportsAvif ??= typeof ImageDecoder === "undefined" ? Promise.resolve(false) :
          ImageDecoder.isTypeSupported("image/avif").catch(() => false);
        const format = await supportsAvif ? "&format=avif" : "";
        signal.throwIfAborted();
        const response = await fetch(`${galleryImageUrl(clubId, id, "full")}&view=${size.width}x${size.height}${format}`, {
          cache: "no-store", credentials: "same-origin", signal,
          priority: background ? "low" : "high",
          headers: { "X-Gallery-Actor": userId },
        });
        if (!response.ok) {
          await galleryResponse(response, userId);
          throw new GalleryError("network");
        }
        const blob = await response.blob();
        if (!["image/jpeg", "image/webp", "image/avif"].includes(blob.type) || !blob.size || blob.size > galleryLimits.full) throw new GalleryError("image");
        return blob;
      },
    });
  }

  const photoCache = cacheFor(false);
  const expandedCache = cacheFor(true);
  return {
    photoCache,
    expandedCache,
    resizeView() {
      function grow(previous: GalleryViewSize | undefined, cache: typeof photoCache, expanded: boolean) {
        const size = sizeFor(expanded);
        if (!previous) return size;
        if (size.width <= previous.width && size.height <= previous.height) return previous;
        cache.clear();
        return { width: Math.max(size.width, previous.width), height: Math.max(size.height, previous.height) };
      }
      viewSize = grow(viewSize, photoCache, false);
      expandedSize = grow(expandedSize, expandedCache, true);
    },
  };
}

export function ClubGallery({ club, locale, userId }: { club: Club; locale: Locale; userId: string }) {
  const t = getAppDictionary(locale);
  const text = (key: GalleryTextKey) => galleryText(locale, key);
  const ct = (key: Parameters<typeof contentText>[1]) => contentText(locale, key);
  const endpoint = `/api/clubs/gallery?clubId=${club.id}`;
  const { photoCache, expandedCache, resizeView } = useMemo(() => createGalleryViewer(club.id, userId), [club.id, userId]);
  const assets = useSyncExternalStore(photoCache.subscribe, photoCache.getSnapshot, photoCache.getServerSnapshot);
  const expandedAssets = useSyncExternalStore(expandedCache.subscribe, expandedCache.getSnapshot, expandedCache.getServerSnapshot);
  const [visiblePhotoIds, setVisiblePhotoIds] = useState<string[]>([]);
  const [firstThumbnailReady, setFirstThumbnailReady] = useState(false);

  useEffect(() => {
    resizeView();
    window.addEventListener("resize", resizeView);
    return () => window.removeEventListener("resize", resizeView);
  }, [resizeView]);

  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [paging, setPaging] = useState(false);
  const [concealed, setConcealed] = useState(false);
  const [accessVersion, setAccessVersion] = useState(0);
  const [discussionVersion, setDiscussionVersion] = useState(0);
  const [loadError, setLoadError] = useState<GalleryErrorCode | null>(null);
  const [upload, setUpload] = useState<UploadForm>(emptyUpload);
  const [task, setTask] = useState<"upload" | "report" | "remove" | null>(null);
  const [uploadRetry, setUploadRetry] = useState(false);
  const [feedback, setFeedback] = useState<GalleryErrorCode | null>(null);
  const [notice, setNotice] = useState<"upload" | "sentClub" | "sentBikeMe" | "removed" | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [heldPhotoId, setHeldPhotoId] = useState<string | null>(null);
  const [dialogMode, setDialogMode] = useState<GalleryDialogMode>("view");
  const [reportFields, setReportFields] = useState<ClubReportFields>({ destination: "club", reason: "spam", detail: "" });
  const [reportedComment, setReportedComment] = useState<GalleryComment | null>(null);

  const loadController = useRef<AbortController | null>(null);
  const actionController = useRef<AbortController | null>(null);
  const requestedPages = useRef(1);
  const confirmed = useRef(false);
  const identityInvalidated = useRef(false);
  const suspended = useRef(false);
  const retryBody = useRef<FormData | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLDivElement>(null);
  const photoGrid = useRef<HTMLUListElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const expandedCloseButton = useRef<HTMLButtonElement>(null);
  const expandedReturn = useRef<{ trigger: HTMLElement; scrollTop: number } | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const pausedFocus = useRef<HTMLElement | null>(null);
  const selectionVersion = useRef(0);
  const expandedSwipe = useRef<{ id: number; x: number; y: number; version: number } | null>(null);

  const selectedIndex = snapshot?.photos.findIndex(photo => photo.id === selectedId) ?? -1;
  const selected = snapshot?.photos[selectedIndex];
  const previous = snapshot?.photos[selectedIndex - 1];
  const next = snapshot?.photos[selectedIndex + 1];
  const expanded = Boolean(heldPhotoId && selected && dialogMode === "view");
  const standardAsset = selectedId ? assets.get(selectedId) : undefined;
  const expandedAsset = selectedId ? expandedAssets.get(selectedId) : undefined;
  const photoAsset = standardAsset?.status === "ready" || expandedAsset?.status !== "ready" ? standardAsset : expandedAsset;
  const heldPhoto = expanded ? snapshot?.photos.find(photo => photo.id === heldPhotoId) : undefined;
  const heldExpandedAsset = heldPhotoId ? expandedAssets.get(heldPhotoId) : undefined;
  const heldAsset = heldExpandedAsset?.status === "ready" || !heldPhotoId ? heldExpandedAsset : assets.get(heldPhotoId);
  const visibleExpandedPhoto = expandedAsset?.status === "ready" ? selected : heldPhoto;
  const visibleExpandedAsset = expandedAsset?.status === "ready" ? expandedAsset : heldAsset;
  const imageAuthFailure = [...assets.values(), ...expandedAssets.values()].find(asset => asset.status === "error" &&
    (asset.error === "auth" || asset.error === "access"));
  const canGoNext = Boolean(next || (snapshot?.next && !paging));
  const canDisplay = Boolean(snapshot && !concealed && !loadError && !imageAuthFailure);
  const dialogConcealed = concealed || Boolean(imageAuthFailure) || (dialogMode === "view" && accessVersion !== discussionVersion);

  const denyAccess = useCallback((kind: "auth" | "access") => {
    if (kind === "auth") identityInvalidated.current = true;
    photoCache.clear();
    expandedCache.clear();
    setHeldPhotoId(null);
    expandedReturn.current = null;
    confirmed.current = false;
    loadController.current?.abort();
    loadController.current = null;
    actionController.current?.abort();
    retryBody.current = null;
    pausedFocus.current = null;
    returnFocus.current = null;
    setSnapshot(null);
    setPaging(false);
    setSelectedId(null);
    setReportedComment(null);
    setUpload(emptyUpload);
    setLoadError(kind);
  }, [expandedCache, photoCache]);

  useEffect(() => {
    const subscribe = (cache: typeof photoCache) => cache.subscribe(() => {
      for (const asset of cache.getSnapshot().values()) {
        if (asset.status === "error" && (asset.error === "auth" || asset.error === "access")) {
          denyAccess(asset.error);
          break;
        }
      }
    });
    const stop = subscribe(photoCache);
    const stopExpanded = subscribe(expandedCache);
    return () => { stop(); stopExpanded(); };
  }, [denyAccess, expandedCache, photoCache]);

  const photos = snapshot?.photos;
  const observingGrid = canDisplay && selectedId === null;
  useEffect(() => {
    const grid = photoGrid.current;
    if (!observingGrid || !grid || !photos?.length || typeof IntersectionObserver === "undefined") return;
    const cards = [...grid.querySelectorAll<HTMLButtonElement>("[data-gallery-photo-id]")];
    const visible = new Set<Element>();
    const update = () => {
      const group = cards.filter(card => visible.has(card)).slice(0, 3);
      // Give the first visible photo a head start, with one low-priority transfer until its thumbnail paints.
      const thumbnail = group[0]?.querySelector("img");
      setFirstThumbnailReady(Boolean(thumbnail?.complete && thumbnail.naturalWidth));
      const ids = group.flatMap(card => card.dataset.galleryPhotoId ?? []);
      setVisiblePhotoIds(old => old.length === ids.length && old.every((id, i) => id === ids[i]) ? old : ids);
    };
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting && entry.intersectionRatio >= .15) visible.add(entry.target);
        else visible.delete(entry.target);
      }
      update();
    }, { threshold: .15 });
    grid.addEventListener("load", update, true);
    cards.forEach(card => observer.observe(card));
    return () => {
      grid.removeEventListener("load", update, true);
      observer.disconnect();
    };
  }, [observingGrid, photos]);

  useEffect(() => {
    if (!canDisplay || document.hidden) return;
    if (!selectedId) {
      photoCache.select(visiblePhotoIds);
      photoCache.warm(firstThumbnailReady ? 2 : 1);
      return;
    }
    if (dialogMode !== "view" || !photos || selectedIndex < 0) return;
    const cache = expanded ? expandedCache : photoCache;
    const available = expanded ? expandedAssets : assets;
    const offsets = expanded ? [1, -1] : [1, -1, 2, -2];
    const nearby = offsets.flatMap(offset => photos[selectedIndex + offset]?.id ?? []);
    const selectedReady = available.get(selectedId)?.status === "ready";
    // Pin the visible large image until its replacement has been decoded.
    if (expanded && !selectedReady && heldPhotoId && heldExpandedAsset?.status === "ready" &&
        heldPhotoId !== selectedId && !nearby.includes(heldPhotoId)) nearby.push(heldPhotoId);
    const pendingNeighbor = [next?.id, previous?.id].find(id => id && available.get(id)?.status === "loading");
    const keepLoading = pendingNeighbor ? [selectedId, pendingNeighbor] : [selectedId];
    cache.select([selectedId, ...nearby], selectedReady ? undefined : keepLoading);
    if (selectedReady) cache.warm();
    else void cache.load(selectedId);
  }, [assets, canDisplay, dialogMode, expanded, expandedAssets, expandedCache, firstThumbnailReady, heldExpandedAsset?.status,
    heldPhotoId, next?.id, photoCache, photos, previous?.id, selectedId, selectedIndex, visiblePhotoIds]);

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
    if (identityInvalidated.current || suspended.current || document.hidden) return;
    if (loadController.current) {
      if (!more) return;
      loadController.current.abort();
    }
    const version = selectionVersion.current;
    const controller = new AbortController();
    loadController.current = controller;
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(30_000)]);
    if (more) setPaging(true);
    try {
      const count = requestedPages.current + (more ? 1 : 0);
      let view = await readPage(null, signal);
      for (let index = 1; index < count && view.next; index++) {
        const next = await readPage(view.next, signal);
        view = { ...next, photos: [...view.photos, ...next.photos] };
      }
      if (controller.signal.aborted || document.hidden) return;
      requestedPages.current = count;
      confirmed.current = true;
      const authorized = new Set(view.photos.map(photo => photo.id));
      photoCache.reconcile(authorized);
      expandedCache.reconcile(authorized);
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
      if (kind === "auth" || kind === "access") {
        denyAccess(kind);
      } else {
        confirmed.current = false;
        photoCache.clear();
        expandedCache.clear();
        setHeldPhotoId(null);
        setSnapshot(null);
        setSelectedId(null);
        setLoadError(kind);
      }
    } finally {
      if (loadController.current === controller) {
        loadController.current = null;
        if (more) setPaging(false);
      }
    }
  }, [denyAccess, expandedCache, photoCache, readPage]);

  useEffect(() => {
    const client = createClient();
    const pause = () => {
      suspended.current = true;
      photoCache.pause();
      expandedCache.pause();
      loadController.current?.abort();
      loadController.current = null;
      if (!confirmed.current) return;
      const active = document.activeElement;
      if (active instanceof HTMLElement && (dialog.current?.contains(active) || gallery.current?.contains(active))) {
        pausedFocus.current = active;
      }
      flushSync(() => {
        setPaging(false);
        setConcealed(true);
        setAccessVersion(value => value + 1);
        // A pending report may quote a comment that is no longer visible on return.
        setDialogMode(mode => mode === "report" ? "view" : mode);
        setReportedComment(null);
      });
    };
    const verify = () => {
      if (document.hidden) return;
      suspended.current = false;
      void refresh();
    };
    const invalidate = () => { pause(); verify(); };
    const show = () => document.visibilityState === "visible" ? verify() : pause();
    const onPageShow = (event: PageTransitionEvent) => { if (event.persisted) verify(); };
    const identityLost = () => flushSync(() => denyAccess("auth"));
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
      photoCache.clear();
      expandedCache.clear();
      window.removeEventListener("focus", verify);
      window.removeEventListener("online", verify);
      window.removeEventListener("offline", pause);
      window.removeEventListener("pagehide", pause);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(CLUB_AUTH_EVENT, onAuth);
      document.removeEventListener("visibilitychange", show);
    };
  }, [denyAccess, expandedCache, photoCache, refresh, userId]);

  useLayoutEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (!selected) {
      if (element.open) element.close();
    } else {
      if (dialogConcealed) return;
      if (!element.open) element.showModal();
    }
    if (concealed) return;
    const active = pausedFocus.current;
    pausedFocus.current = null;
    if (active?.isConnected && (document.activeElement === document.body || document.activeElement === element)) {
      active.focus({ preventScroll: true });
    }
  }, [concealed, dialogConcealed, selected]);

  useLayoutEffect(() => {
    if (expanded) {
      expandedCloseButton.current?.focus({ preventScroll: true });
      return;
    }
    const saved = expandedReturn.current;
    expandedReturn.current = null;
    if (saved && dialog.current?.open) {
      dialog.current.scrollTop = saved.scrollTop;
      if (saved.trigger.isConnected) saved.trigger.focus({ preventScroll: true });
      else closeButton.current?.focus({ preventScroll: true });
    }
  }, [expanded]);

  const discussionReadFailed = useCallback((kind: GalleryErrorCode) => {
    if (kind === "auth" || kind === "access") denyAccess(kind);
    if (kind === "unavailable") {
      setHeldPhotoId(null);
      setSelectedId(null);
      void refresh();
    }
  }, [denyAccess, refresh]);

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
    setDiscussionVersion(accessVersion);
    setFeedback(null);
    setSelectedId(photo.id);
  }

  function showExpanded(trigger: HTMLElement) {
    if (!selected || dialogConcealed || photoAsset?.status !== "ready" || !dialog.current) return;
    expandedReturn.current = { trigger, scrollTop: dialog.current.scrollTop };
    photoCache.pause();
    setHeldPhotoId(selected.id);
  }

  function closeExpanded() {
    expandedCache.pause();
    selectionVersion.current++;
    if (visibleExpandedPhoto) setSelectedId(visibleExpandedPhoto.id);
    setHeldPhotoId(null);
  }

  function browsePhoto(direction: -1 | 1) {
    if (!selected || dialogMode !== "view" || dialogConcealed || task) return;
    const target = direction === -1 ? previous : next;
    if (expanded && visibleExpandedPhoto) setHeldPhotoId(visibleExpandedPhoto.id);
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
    if (actionController.current || !canDisplay) return;
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
        setPaging(false);
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
          setPaging(false);
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
          maxSourcePixels: galleryLimits.browserSourcePixels,
          maxEdge: galleryLimits.browserEdge,
        }).catch(error => {
          if (error instanceof GalleryError) throw error;
          throw new GalleryError("image");
        });
        form.append("photo", normalized, "photo.jpg");
        form.append("caption", caption);
      }
      retryBody.current = form;
      return form;
    });
  }

  function errorMessage(error: GalleryErrorCode) {
    switch (error) {
      case "invalid": case "image": case "size": case "quota": case "capacity": case "busy": case "uploadUnavailable": return text(error);
      case "access": case "auth": return ct("access");
      case "unavailable": return ct("unavailable");
      case "conflict": case "contentRejected": return ct(error);
      default: return ct("network");
    }
  }

  if (loadError === "access" || loadError === "auth") return <ClubAccessDenied locale={locale} />;

  return <>
    {/* Keep the mounted gallery and its scroll footprint while access is rechecked. */}
    <div ref={gallery} data-gallery-concealed={concealed || Boolean(imageAuthFailure) || undefined}
      inert={concealed || Boolean(imageAuthFailure)}>
      {snapshot ? <ClubHeader club={{ ...club, role: snapshot.role }} locale={locale} selected="gallery" /> : null}
      <AppPanel title={text("title")} className="bike-app-gallery">
        {snapshot && snapshot.role !== "member" ? <a className="bike-app-button bike-app-button-secondary"
          href={`/${locale}/app/clubs/${club.id}/posts/moderation`}>{ct("moderation")}</a> : null}
        {!snapshot ? <div role={loadError ? "alert" : "status"}>
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
              <button type="submit" className="bike-app-button" disabled={!upload.files.length || Boolean(task)}>
                {task === "upload" ? text("uploading") : text("add")}
              </button>
            </form>
          </details>
          {!selected && feedback ? <p role="alert">{errorMessage(feedback)}</p> : null}
          {notice ? <p role="status">{notice === "upload" ? text("uploaded") : ct(notice)}</p> : null}
          {snapshot?.photos.length ? <ul ref={photoGrid} className="bike-app-gallery-grid">
            {snapshot.photos.map(photo => <li key={photo.id}>
              <button type="button" aria-haspopup="dialog" className="bike-app-gallery-tile" data-gallery-photo-id={photo.id}
                aria-label={photo.caption || `${text("photo")} · ${text("uploader").replace("{name}", photo.uploader ?? ct("deletedAuthor"))}`}
                onClick={event => showPhoto(photo, event.currentTarget)}>
                {/* Cookie-authenticated bytes stay out of the optimizer and shared caches. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={galleryImageUrl(club.id, photo.id, "thumbnail")} alt="" loading="lazy" decoding="async" />
              </button>
            </li>)}
          </ul> : <AppEmpty>{text("empty")}</AppEmpty>}
          {snapshot?.next ? <button type="button" className="bike-app-button bike-app-button-secondary"
            disabled={paging} onClick={() => void refresh(true)}>{paging ? text("loading") : text("more")}</button> : null}
        </>}
      </AppPanel>
    </div>

    <dialog ref={dialog} className="bike-app-club-dialog bike-app-gallery-dialog" data-gallery-expanded={expanded || undefined}
      aria-labelledby={expanded ? "gallery-expanded-title" : "gallery-photo-title"}
      onKeyDown={event => {
        if (expanded && event.key === "Escape") {
          event.preventDefault();
          closeExpanded();
          return;
        }
        if (dialogMode !== "view" || task || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        if (event.target instanceof HTMLElement && event.target.closest("input,textarea,select,[contenteditable]")) return;
        event.preventDefault();
        browsePhoto(event.key === "ArrowLeft" ? -1 : 1);
      }}
      onCancel={event => {
        if (expanded) {
          event.preventDefault();
          closeExpanded();
        } else if (task) event.preventDefault();
      }}
      onClose={() => {
        photoCache.pause();
        expandedCache.pause();
        setHeldPhotoId(null);
        expandedReturn.current = null;
        selectionVersion.current++;
        setSelectedId(null);
        setReportedComment(null);
        setFeedback(null);
        requestAnimationFrame(() => returnFocus.current?.focus({ preventScroll: true }));
      }}>
      {selected ? <div className="bike-app-gallery-dialog-content"
        data-gallery-concealed={dialogConcealed || undefined} inert={dialogConcealed}>
        {expanded ? <div className="bike-app-gallery-expanded">
          <h2 id="gallery-expanded-title" className="sr-only">{text("photo")}</h2>
          <div className="bike-app-gallery-expanded-stage">
            {visibleExpandedPhoto && visibleExpandedAsset?.status === "ready" ? (
              // eslint-disable-next-line @next/next/no-img-element -- The private image stays in this tab.
              <img className="bike-app-gallery-expanded-image" src={visibleExpandedAsset.url}
                width={visibleExpandedPhoto.width} height={visibleExpandedPhoto.height}
                alt={visibleExpandedPhoto.caption || text("photo")}
                onPointerDown={event => {
                  if (event.pointerType !== "touch") return;
                  expandedSwipe.current = event.isPrimary && !dialogConcealed
                    ? { id: event.pointerId, x: event.clientX, y: event.clientY, version: selectionVersion.current }
                    : null;
                }}
                onPointerCancel={event => {
                  if (expandedSwipe.current?.id === event.pointerId) expandedSwipe.current = null;
                }}
                onPointerUp={event => {
                  const start = expandedSwipe.current;
                  if (!start || start.id !== event.pointerId) return;
                  expandedSwipe.current = null;
                  if (start.version !== selectionVersion.current) return;
                  const dx = event.clientX - start.x;
                  const dy = event.clientY - start.y;
                  if (Math.abs(dx) >= 40 && Math.abs(dx) >= 1.5 * Math.abs(dy)) {
                    browsePhoto(dx < 0 ? 1 : -1);
                  }
                }} />
            ) : null}
            {expandedAsset?.status === "error" ?
              <div className="bike-app-gallery-expanded-status">
                <p role="alert">{errorMessage(expandedAsset.error)}</p>
                <button type="button" className="bike-app-button bike-app-button-secondary"
                  onClick={() => void expandedCache.retry(selected.id)}>{t("common.retry")}</button>
              </div> : expandedAsset?.status !== "ready" ?
                <p className={visibleExpandedAsset?.status === "ready" ? "sr-only" : "bike-app-gallery-expanded-status"} role="status">{text("loading")}</p> :
                <p className="sr-only" aria-live="polite">{selected.caption || text("photo")}</p>}
          </div>
          <button type="button" ref={expandedCloseButton} className="bike-app-button bike-app-gallery-expanded-close"
            aria-label={text("closeLarge")} onClick={closeExpanded}>{text("close")}</button>
          <div className="bike-app-gallery-expanded-controls">
            <button type="button" className="bike-app-button bike-app-gallery-expanded-previous"
              aria-keyshortcuts="ArrowLeft" aria-label={text("previousPhoto")} aria-disabled={!previous}
              onClick={() => browsePhoto(-1)}>←</button>
            <button type="button" className="bike-app-button bike-app-gallery-expanded-next"
              aria-keyshortcuts="ArrowRight" aria-label={text("nextPhoto")} aria-disabled={!canGoNext}
              onClick={() => browsePhoto(1)}>→</button>
          </div>
        </div> : null}
        <div hidden={expanded}>
          <div className="bike-app-gallery-dialog-header">
            <h2 id="gallery-photo-title">{dialogMode === "report" ? text(reportedComment ? "reportComment" : "report") : dialogMode === "remove" ? text("remove") : text("photo")}</h2>
            <div className="bike-app-gallery-dialog-actions">
              {dialogMode === "view" ? <button type="button" className="bike-app-button bike-app-button-secondary"
                disabled={photoAsset?.status !== "ready"} onClick={event => showExpanded(event.currentTarget)}>
                {text("showLarge")}
              </button> : null}
              <button type="button" ref={closeButton} className="bike-app-button bike-app-button-secondary" disabled={Boolean(task)}
                onClick={() => dialog.current?.close()}>{text("close")}</button>
            </div>
          </div>
          {feedback ? <p role="alert">{errorMessage(feedback)}</p> : null}
          {dialogMode === "view" ? <>
            {photoAsset?.status === "ready" ? (
              <button type="button" className="bike-app-gallery-expand-image"
                aria-label={`${text("showLarge")} · ${selected.caption || text("photo")}`}
                onClick={event => showExpanded(event.currentTarget)}>
                {/* eslint-disable-next-line @next/next/no-img-element -- The private image stays in this tab. */}
                <img className="bike-app-gallery-full" src={photoAsset.url}
                  width={selected.width} height={selected.height} alt={selected.caption || text("photo")} />
              </button>
            ) : <div className="bike-app-gallery-photo-placeholder"
              style={{
                aspectRatio: selected.width / selected.height,
                width: `min(100%, ${selected.width}px, ${61 * selected.width / selected.height}dvh)`,
              }}>
              {photoAsset?.status === "error" ? <>
                <p role="alert">{errorMessage(photoAsset.error)}</p>
                <button type="button" className="bike-app-button bike-app-button-secondary"
                  onClick={() => void photoCache.retry(selected.id)}>{t("common.retry")}</button>
              </> : <p role="status">{text("loading")}</p>}
            </div>}
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
              {!selected.own ? <button type="button" className="bike-app-button bike-app-button-secondary"
                onClick={() => openReport(null)}>{text("report")}</button> : null}
              {selected.own || snapshot?.role === "owner" || snapshot?.role === "admin" ? <button type="button" className="bike-app-button bike-app-button-danger"
                onClick={() => { setDialogMode("remove"); closeButton.current?.focus(); }}>{text("remove")}</button> : null}
            </div>
            <ClubGalleryDiscussion key={selected.id} endpoint={endpoint} photoId={selected.id} locale={locale}
              userId={userId} galleryVersion={snapshot} concealed={concealed} accessVersion={accessVersion}
              onChecked={setDiscussionVersion} onReadFailed={discussionReadFailed}
              locked={dialogConcealed || Boolean(task)} onReport={openReport} />
          </> : dialogMode === "report" ? <>
            {reportedComment ? <blockquote className="bike-app-content-body">{reportedComment.body}</blockquote> : null}
            <ClubReportForm photo locale={locale} value={reportFields} locked={Boolean(task)}
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
              <button type="button" className="bike-app-button bike-app-button-danger" disabled={Boolean(task)}
                onClick={() => void submit("remove", async () => JSON.stringify({ type: "remove", id: selected.id }))}>{text("remove")}</button>
            </div>
          </>}
        </div>
      </div> : null}
      {selected && dialogConcealed ? <span className="sr-only" role="status">{text("loading")}</span> : null}
    </dialog>
  </>;
}
