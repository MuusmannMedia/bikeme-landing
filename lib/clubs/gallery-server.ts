import "server-only";

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";

import { GalleryError, galleryCaption, galleryLimits } from "./gallery-contract";
import { normalizeGalleryPhoto } from "./gallery-normalize";
import { imageSourceDimensions, requireCompleteStaticImage } from "./image-browser";
import { isClubId } from "./types";
import { signGalleryUpload } from "./gallery-upload-signature";

export function galleryUploadKey() {
  const key = process.env.BIKE_ME_GALLERY_UPLOAD_HMAC_KEY?.trim();
  if (!key || !/^[a-f0-9]{64}$/.test(key)) throw new GalleryError("uploadUnavailable");
  return Buffer.from(key, "hex");
}

export async function galleryRpc<T>(client: SupabaseClient, fn: string, params: Record<string, unknown>): Promise<T> {
  const { data, error } = await client.rpc(fn, params).abortSignal(AbortSignal.timeout(8000));
  if (error) {
    if (error.message === "GALLERY_BUSY") throw new GalleryError("busy");
    if (error.message === "BIKEME_CONTENT_REJECTED") throw new GalleryError("contentRejected");
    const kinds = {
      "42501": "access", "28000": "auth", "55000": "access", "22023": "invalid",
      PT503: "uploadUnavailable", PT409: "conflict", PT429: "quota", PT413: "capacity", P0002: "unavailable",
      PGRST202: "unavailable", PGRST301: "auth",
    } as const;
    throw new GalleryError(kinds[error.code as keyof typeof kinds] ?? "network");
  }
  return data as T;
}

export async function galleryBody(request: NextRequest, limit: number) {
  if (Number(request.headers.get("content-length") ?? 0) > limit) throw new GalleryError("size");
  if (!request.body) throw new GalleryError("invalid");
  const reader = request.body.getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let total = 0;
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(12_000)]);
  const cancel = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener("abort", cancel, { once: true });
  try {
    while (!signal.aborted) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) {
        cancel();
        throw new GalleryError("size");
      }
      chunks.push(new Uint8Array(value));
    }
    if (signal.aborted) throw new GalleryError("network");
    return new Blob(chunks);
  } finally {
    signal.removeEventListener("abort", cancel);
    reader.releaseLock();
  }
}

export async function galleryUploadBytes(files: File[], web: boolean) {
  if (!files.every(file => file instanceof File && file.size > 0)) throw new GalleryError("image");
  if (web && files.some(file => file.size > galleryLimits.browserInput)) throw new GalleryError("size");
  if (files.reduce((sum, file) => sum + file.size, 0) > galleryLimits.input) throw new GalleryError("size");

  const bytes = await Promise.all(files.map(async file => new Uint8Array(await file.arrayBuffer())));
  for (const file of bytes) {
    try {
      const size = imageSourceDimensions(file);
      requireCompleteStaticImage(file);
      if (!size.width || !size.height || size.width * size.height > galleryLimits.pixels) throw new GalleryError("image");
      if (web && Math.max(size.width, size.height) > galleryLimits.browserEdge) throw new GalleryError("size");
    } catch (error) {
      if (error instanceof GalleryError) throw error;
      throw new GalleryError("image");
    }
  }
  return bytes;
}

export async function saveGalleryUpload(
  request: NextRequest, client: SupabaseClient, actor: string, clubId: string, mime: string, source: "web" | "mobile",
) {
  const web = source === "web";
  const signingKey = galleryUploadKey();
  const body = await galleryBody(request, web
    ? galleryLimits.batch * galleryLimits.browserInput + 16_384
    : galleryLimits.request);
  const form = await new Response(body, { headers: { "Content-Type": mime } }).formData().catch(() => {
    throw new GalleryError("invalid");
  });
  const requestId = form.get("requestId");
  const photoEntries = form.getAll("photo");
  const files = photoEntries.filter((entry): entry is File => entry instanceof File);
  if (files.length !== photoEntries.length) throw new GalleryError("image");
  const captions = form.getAll("caption").map(galleryCaption);
  if (typeof requestId !== "string" || !isClubId(requestId) || !files.length ||
      files.length > galleryLimits.batch || files.length !== captions.length) throw new GalleryError("invalid");
  const bytes = await galleryUploadBytes(files, web);
  const fingerprint = JSON.stringify(bytes.map((file, index) => [
    captions[index], createHash("sha256").update(file).digest("hex"),
  ]));
  const key = { p_club: clubId, p_request: requestId };
  const reservation = await galleryRpc<{ status: "reserved"; attempt: string } | { status: "committed" }>(
    client, "club_gallery_upload_reserve", {
      ...key, p_count: files.length, p_digest: createHash("sha256").update(fingerprint).digest("hex"),
    },
  );
  if (reservation.status === "committed") return;

  const attempt = { ...key, p_attempt: reservation.attempt };
  try {
    const photos = [];
    const deadline = performance.now() + 24_000;
    for (const [index, file] of bytes.entries()) {
      if (request.signal.aborted) throw new GalleryError("network");
      const photo = await normalizeGalleryPhoto(file, deadline);
      photos.push({
        caption: captions[index], width: photo.width, height: photo.height,
        image: photo.image.toString("base64"), thumbnail: photo.thumbnail.toString("base64"),
      });
    }
    if (request.signal.aborted) throw new GalleryError("network");
    const payload = JSON.stringify(photos);
    const mac = signGalleryUpload({ actor, club: clubId, request: requestId, attempt: reservation.attempt }, payload, signingKey);
    await galleryRpc(client, "club_gallery_upload_commit", { ...attempt, p_payload: payload, p_mac: mac });
  } catch (error) {
    // If the response was lost after commit this update does nothing.
    // An interrupted process also leaves no files, and its hold expires.
    await galleryRpc(client, "club_gallery_upload_release", {
      p_request: requestId, p_attempt: reservation.attempt,
    }).catch(() => {});
    throw error;
  }
}
