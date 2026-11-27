"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { imageSourceDimensions, normalizeImageForBrowser } from "@/lib/clubs/image-browser";
import { CLUB_IMAGE_SOURCE_LIMIT } from "@/lib/clubs/image-contract";
import { CLUB_IMAGE_MAX_ZOOM } from "@/lib/clubs/image-frame";
import { imageText } from "@/lib/clubs/image-i18n";
import { postImageCrop, postImageLimit, postImageUrl, type PostImageChoice, type PostImageFrame } from "@/lib/clubs/post-image";
import { postImageText } from "@/lib/clubs/post-image-i18n";
import type { ContentDraft, ContentItem } from "@/lib/clubs/content-contract";
import type { Locale } from "@/lib/locales";

const initialFrame: PostImageFrame = { zoom: 1, x: 0, y: 0 };

export function ClubPostImage({ item, locale }: { item: ContentItem; locale: Locale }) {
  if (!item.image) return null;
  return <Image unoptimized className="bike-app-post-image" alt={postImageText(locale, "image")} width={960} height={540}
    src={postImageUrl(item.club_id, item.id, item.image.revision)} loading="lazy" decoding="async"/>;
}

async function readChoice(blob: Blob, frame: PostImageFrame, signal: AbortSignal): Promise<PostImageChoice> {
  if (blob.size > postImageLimit || blob.type !== "image/jpeg") throw new Error("image");
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const dimensions = imageSourceDimensions(bytes);
  const reader = new FileReader();
  const url = await new Promise<string>((resolve, reject) => {
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(Error("image"));
    reader.onerror = () => reject(Error("image"));
    reader.readAsDataURL(blob);
  });
  signal.throwIfAborted();
  return { dimensions, frame, source: url.slice(url.indexOf(",") + 1) };
}

export function ClubPostImageEditor({ draft, item, locale, locked, onChange, onBusy }: {
  draft: ContentDraft;
  item: ContentItem | undefined;
  locale: Locale;
  locked: boolean;
  onChange: (choice: PostImageChoice | null | undefined) => void;
  onBusy: (busy: boolean) => void;
}) {
  const [working, setWorking] = useState(false);
  const [error, setError] = useState(false);
  const work = useRef<AbortController>();
  const chooser = useRef<HTMLInputElement>(null);
  useEffect(() => () => {
    work.current?.abort();
    onBusy(false);
  }, [onBusy]);

  const choice = draft.image;
  const existing = item?.image;
  const showingSaved = choice === undefined && !!existing;
  const text = (key: Parameters<typeof postImageText>[1]) => postImageText(locale, key);
  const change = (value: PostImageChoice | null | undefined) => {
    setError(false);
    onChange(value);
  };

  async function prepare(load: (signal: AbortSignal) => Promise<Blob>, frame: PostImageFrame) {
    if (locked || work.current) return;
    const operation = new AbortController();
    work.current = operation;
    setWorking(true);
    onBusy(true);
    setError(false);
    try {
      const blob = await load(operation.signal);
      const selected = await readChoice(blob, frame, operation.signal);
      change(selected);
    } catch {
      if (!operation.signal.aborted) setError(true);
    } finally {
      work.current = undefined;
      if (!operation.signal.aborted) {
        setWorking(false);
        onBusy(false);
      }
    }
  }

  const chooseFile = (file: File) => prepare(signal => {
    if (file.size > CLUB_IMAGE_SOURCE_LIMIT) throw new Error("image");
    return normalizeImageForBrowser(file, "cover", signal, {
      maxBytes: postImageLimit, maxEdge: 1600, maxSourcePixels: 50_000_000,
    });
  }, initialFrame);

  const editSaved = () => {
    if (!item || !existing) return;
    void prepare(async signal => {
      const response = await fetch(postImageUrl(item.club_id, item.id, existing.revision, true), {
        credentials: "same-origin", cache: "no-store", signal,
      });
      if (!response.ok) throw new Error("image");
      return response.blob();
    }, existing.frame);
  };

  const crop = choice && postImageCrop(choice.dimensions, choice.frame);
  const fields = [["zoom", "zoom"], ["x", "horizontal"], ["y", "vertical"]] as const;
  return <fieldset className="bike-app-post-image-editor" disabled={locked || working}>
    <div className="bike-app-actions">
      <input ref={chooser} type="file" accept="image/jpeg,image/png,.jpg,.jpeg,.png" hidden onChange={event => {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = "";
        if (file) void chooseFile(file);
      }}/>
      <button type="button" className="bike-app-button bike-app-button-secondary" onClick={() => chooser.current?.click()}>
        {choice || showingSaved ? text("replace") : text("add")}
      </button>
      {showingSaved && <button type="button" className="bike-app-button bike-app-button-secondary" onClick={editSaved}>
        {imageText(locale, "crop")}
      </button>}
      {(choice || showingSaved) && <button type="button" className="bike-app-button bike-app-button-secondary"
        onClick={() => change(existing ? null : undefined)}>{text("remove")}</button>}
      {existing && choice !== undefined && <button type="button" className="bike-app-button bike-app-button-secondary"
        onClick={() => change(undefined)}>{text("restore")}</button>}
    </div>
    {!choice && !showingSaved && <p className="bike-app-muted">{text("limit")}</p>}
    {working && <p role="status">{imageText(locale, "preparing")}</p>}
    {error && <p role="alert">{imageText(locale, "invalid")}</p>}
    {showingSaved && item && <ClubPostImage item={item} locale={locale}/>}
    {choice && crop && <>
      <div className="bike-app-post-image bike-app-post-image-preview">
        <Image unoptimized width={choice.dimensions.width} height={choice.dimensions.height}
          alt={imageText(locale, "preview")} src={`data:image/jpeg;base64,${choice.source}`} style={{
          width: `${choice.dimensions.width / crop.width * 100}%`,
          height: `${choice.dimensions.height / crop.height * 100}%`,
          left: `${-crop.left / crop.width * 100}%`,
          top: `${-crop.top / crop.height * 100}%`,
        }}/>
      </div>
      <div className="bike-app-post-image-controls">
        {fields.map(([field, label]) => <label className="bike-app-field" key={field}>
          <span>{imageText(locale, label)}</span>
          <input type="range" min={field === "zoom" ? 1 : -1} max={field === "zoom" ? CLUB_IMAGE_MAX_ZOOM : 1}
            step={0.01} value={choice.frame[field]} onChange={event => change({
              ...choice, frame: { ...choice.frame, [field]: Number(event.currentTarget.value) },
            })}/>
        </label>)}
      </div>
      <div><button type="button" className="bike-app-button bike-app-button-secondary bike-app-button-small"
        onClick={() => change({ ...choice, frame: initialFrame })}>{text("reset")}</button></div>
    </>}
  </fieldset>;
}
