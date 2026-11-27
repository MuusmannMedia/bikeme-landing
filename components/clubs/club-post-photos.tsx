"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import { getAppDictionary } from "@/lib/app-i18n";
import type { ContentItem } from "@/lib/clubs/content-contract";
import { galleryErrorKind, galleryResponse } from "@/lib/clubs/gallery-client";
import { GalleryError, galleryLimits, type GalleryErrorCode } from "@/lib/clubs/gallery-contract";
import { galleryText } from "@/lib/clubs/gallery-i18n";
import { normalizeImageForBrowser } from "@/lib/clubs/image-browser";
import { postAttachmentsUrl, type PostAttachment } from "@/lib/clubs/post-attachments";
import { postImageText } from "@/lib/clubs/post-image-i18n";
import { postImageSize, postImageUrl } from "@/lib/clubs/post-image";
import type { Locale } from "@/lib/locales";

export function ClubPostPhotos({ item, actor, locale, supportsAttachments, canUpload, concealed, onChanged }: {
  item: ContentItem;
  actor: string;
  locale: Locale;
  supportsAttachments: boolean;
  canUpload: boolean;
  concealed: boolean;
  onChanged: () => void;
}) {
  const text = (key: Parameters<typeof galleryText>[1]) => galleryText(locale, key);
  const postText = (key: Parameters<typeof postImageText>[1]) => postImageText(locale, key);
  const t = getAppDictionary(locale);
  const dialogId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const operation = useRef<AbortController>();
  const retryBody = useRef<FormData>();
  const lastPhoto = useRef<string>();
  const [mode, setMode] = useState<"view" | "upload" | null>(null);
  const [attachments, setAttachments] = useState<PostAttachment[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<GalleryErrorCode | null>(null);
  const [uploaded, setUploaded] = useState(false);
  const [readAttempt, setReadAttempt] = useState(0);
  const url = postAttachmentsUrl(item.club_id, item.id);

  useEffect(() => () => operation.current?.abort(), []);
  useEffect(() => {
    if (mode && !dialog.current?.open) dialog.current?.showModal();
  }, [mode]);
  useEffect(() => {
    if (mode !== "view" || !supportsAttachments || concealed) return;
    const controller = new AbortController();
    void fetch(url, { signal: controller.signal, cache: "no-store" })
      .then(response => galleryResponse<{ photos: PostAttachment[] }>(response, actor))
      .then(result => {
        if (controller.signal.aborted) return;
        if (!Array.isArray(result.photos)) throw new GalleryError("network");
        setAttachments(result.photos);
      })
      .catch(error => { if (!controller.signal.aborted) setError(galleryErrorKind(error)); });
    return () => controller.abort();
  }, [actor, concealed, mode, readAttempt, supportsAttachments, url]);

  useEffect(() => {
    if (mode === "view" && !selected && lastPhoto.current) {
      dialog.current?.querySelector<HTMLButtonElement>(`[data-post-photo="${lastPhoto.current}"]`)?.focus();
    }
  }, [mode, selected]);

  const cover = item.image && {
    id: "cover",
    ...postImageSize,
    full: postImageUrl(item.club_id, item.id, item.image.revision),
    thumb: postImageUrl(item.club_id, item.id, item.image.revision),
  };
  const photos = [
    ...(cover ? [cover] : []),
    ...(attachments ?? []).map(photo => ({
      ...photo,
      full: postAttachmentsUrl(item.club_id, item.id, photo.id),
      thumb: postAttachmentsUrl(item.club_id, item.id, photo.id, "thumbnail"),
    })),
  ];
  const index = photos.findIndex(photo => photo.id === selected);
  const active = photos[index];

  function open(next: "view" | "upload") {
    setError(null);
    setSelected(null);
    lastPhoto.current = undefined;
    setAttachments(supportsAttachments ? null : []);
    setMode(next);
  }

  function changeSelection(next: File[]) {
    retryBody.current = undefined;
    setError(next.length > galleryLimits.batch ? "invalid" : null);
    setFiles(next.length > galleryLimits.batch ? [] : next);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canUpload || concealed || operation.current || !files.length) return;
    const controller = new AbortController();
    operation.current = controller;
    setBusy(true);
    setError(null);
    setUploaded(false);
    try {
      let form = retryBody.current;
      if (!form) {
        form = new FormData();
        form.set("requestId", crypto.randomUUID());
        for (const file of files) {
          const image = await normalizeImageForBrowser(file, "cover", controller.signal, {
            maxBytes: galleryLimits.browserInput, maxSourcePixels: galleryLimits.browserSourcePixels, maxEdge: galleryLimits.browserEdge,
          }).catch(error => { throw new GalleryError(error instanceof GalleryError ? error.kind : "image"); });
          form.append("photo", image, "photo.jpg");
        }
        retryBody.current = form;
      }
      const response = await fetch(url, {
        method: "POST", body: form, headers: { "x-gallery-actor": actor }, signal: controller.signal,
      });
      await galleryResponse(response, actor);
      if (controller.signal.aborted) return;
      retryBody.current = undefined;
      setFiles([]);
      setUploaded(true);
      dialog.current?.close();
      onChanged();
    } catch (error) {
      if (!controller.signal.aborted) setError(galleryErrorKind(error));
    } finally {
      operation.current = undefined;
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!canUpload || concealed || id === "cover" || operation.current || !window.confirm(postText("removeConfirm"))) return;
    const controller = new AbortController();
    operation.current = controller;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(postAttachmentsUrl(item.club_id, item.id, id), {
        method: "DELETE", headers: { "x-gallery-actor": actor }, signal: controller.signal,
      });
      await galleryResponse(response, actor);
      if (controller.signal.aborted) return;
      setAttachments(previous => previous?.filter(photo => photo.id !== id) ?? []);
      setSelected(null);
      onChanged();
    } catch (error) {
      if (!controller.signal.aborted) setError(galleryErrorKind(error));
    } finally {
      operation.current = undefined;
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  const errorText = error === "capacity" ? postText("full")
    : error === "image" || error === "invalid" || error === "size" || error === "uploadUnavailable" ? text(error)
    : error === "unavailable" ? text("unreadable") : t("clubs.unavailable");

  return <>
    <div className="bike-app-actions">
      <button type="button" aria-haspopup="dialog" className="bike-app-button bike-app-button-secondary" onClick={() => open("view")}>
        {postText("view")}
      </button>
      {canUpload && <button type="button" aria-haspopup="dialog" className="bike-app-button bike-app-button-secondary" onClick={() => open("upload")}>
        {text("add")}
      </button>}
    </div>
    {uploaded && <p role="status">{text("uploaded")}</p>}
    <dialog ref={dialog} className="bike-app-club-dialog bike-app-gallery-dialog"
      aria-labelledby={dialogId} data-gallery-concealed={concealed || undefined} inert={concealed}
      onClose={() => { setMode(null); changeSelection([]); }}
      onCancel={event => { if (busy) event.preventDefault(); }}>
      {mode && <div className="bike-app-gallery-dialog-content">
        <div className="bike-app-gallery-dialog-header">
          <h2 id={dialogId}>{mode === "view" ? postText("view") : text("add")}</h2>
          <button type="button" className="bike-app-button bike-app-button-secondary" disabled={busy}
            onClick={() => dialog.current?.close()}>{text("close")}</button>
        </div>
        {error && <p role="alert">{errorText}</p>}
        {mode === "upload" ? <form onSubmit={submit} className="bike-app-gallery-form">
          <label className="bike-app-field">
            <span>{text("choose")}</span>
            <input type="file" accept="image/jpeg,image/png,.jpg,.jpeg,.png" multiple disabled={busy}
              onChange={event => {
                const images = Array.from(event.currentTarget.files ?? []);
                if (images.length > galleryLimits.batch) event.currentTarget.value = "";
                changeSelection(images);
              }}/>
          </label>
          <button type="submit" className="bike-app-button" disabled={busy || !files.length}>
            {busy ? text("uploading") : text("add")}
          </button>
        </form> : <>
          {active ? <>
            <Image unoptimized src={active.full} width={active.width} height={active.height}
              alt={`${text("photo")} ${index + 1}`} className="bike-app-gallery-full" key={active.id}/>
            <div className="bike-app-actions bike-app-section-gap">
              <button autoFocus type="button" className="bike-app-button bike-app-button-secondary" disabled={busy}
                onClick={() => setSelected(null)}>{postText("back")}</button>
              {photos.length > 1 && <>
                <button type="button" className="bike-app-button bike-app-button-secondary" disabled={busy || index === 0}
                  onClick={() => setSelected(photos[index - 1].id)}>{text("previousPhoto")}</button>
                <button type="button" className="bike-app-button bike-app-button-secondary" disabled={busy || index === photos.length - 1}
                  onClick={() => setSelected(photos[index + 1].id)}>{text("nextPhoto")}</button>
              </>}
              {canUpload && active.id !== "cover" && <button type="button" className="bike-app-button bike-app-button-secondary"
                disabled={busy} onClick={() => void remove(active.id)}>{text("remove")}</button>}
            </div>
          </> : photos.length ? <ul className="bike-app-gallery-grid">
            {photos.map((photo, position) => <li key={photo.id}>
              <button type="button" className="bike-app-gallery-tile" aria-label={`${text("photo")} ${position + 1}`}
                data-post-photo={photo.id} onClick={() => { lastPhoto.current = photo.id; setSelected(photo.id); }}>
                <Image unoptimized src={photo.thumb} alt="" width={photo.width} height={photo.height} loading="lazy"/>
              </button>
            </li>)}
          </ul> : null}
          {!attachments ? error ? <button type="button" className="bike-app-button bike-app-button-secondary" onClick={() => {
            setError(null);
            setReadAttempt(previous => previous + 1);
          }}>{t("common.retry")}</button> : <p role="status">{text("loading")}</p>
            : !photos.length ? <p>{text("empty")}</p> : null}
        </>}
      </div>}
    </dialog>
  </>;
}
