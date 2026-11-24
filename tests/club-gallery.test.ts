import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";
import sharp from "sharp";

import { GalleryError, galleryCaption, galleryLimits } from "../lib/clubs/gallery-contract";
import { normalizeGalleryPhoto } from "../lib/clubs/gallery-normalize";
import { requireCompleteStaticImage } from "../lib/clubs/image-browser";
import { galleryText } from "../lib/clubs/gallery-i18n";
import { createGalleryPhotoCache } from "../lib/clubs/gallery-photo-cache";
import { projectReport } from "../lib/clubs/content-contract";
import { locales } from "../lib/locales";

test("gallery normalizes orientation and produces bounded JPEGs without metadata", async () => {
  const source = await sharp({ create: { width: 2000, height: 1200, channels: 3, background: "#26356c" } })
    .jpeg().withMetadata({ orientation: 6, exif: { IFD0: { Artist: "test" } } }).toBuffer();
  const photo = await normalizeGalleryPhoto(source);
  const full = await sharp(photo.image).metadata();
  const thumbnail = await sharp(photo.thumbnail).metadata();
  assert.equal(full.height, 1600);
  assert.equal(full.width, 960);
  assert.equal(full.format, "jpeg");
  assert.equal(full.exif, undefined);
  assert.equal(full.orientation, undefined);
  assert.equal(thumbnail.height, galleryLimits.thumbnailEdge);
  assert.equal(thumbnail.exif, undefined);
  assert(photo.image.length <= galleryLimits.full);
  assert(photo.thumbnail.length <= galleryLimits.thumbnail);
});

test("gallery meets byte limits with high-entropy content", async () => {
  const raw = randomBytes(1600 * 1400 * 3);
  const source = await sharp(raw, { raw: { width: 1600, height: 1400, channels: 3 } }).jpeg({ quality: 95 }).toBuffer();
  const photo = await normalizeGalleryPhoto(source);
  assert(photo.image.length <= galleryLimits.full);
  assert(photo.thumbnail.length <= galleryLimits.thumbnail);
  assert(Math.max(photo.width, photo.height) <= 1600);
});

test("gallery rejects invalid, oversized, excessively large, truncated and timed-out inputs", async () => {
  const png = await sharp({ create: { width: 5000, height: 5000, channels: 3, background: "#26356c" } }).png().toBuffer();
  const jpeg = await sharp({ create: { width: 320, height: 160, channels: 3, background: "#26356c" } }).jpeg().toBuffer();
  const webp = await sharp(jpeg).webp().toBuffer();
  for (const bytes of [Buffer.alloc(galleryLimits.input + 1), Buffer.from("not an image"), jpeg.subarray(0, -30), png, webp]) {
    await assert.rejects(normalizeGalleryPhoto(bytes), GalleryError);
  }
  await assert.rejects(normalizeGalleryPhoto(jpeg, performance.now() - 1), GalleryError);
});

test("the browser rejects truncated input and animated PNG before converting it", async () => {
  const source = sharp({ create: { width: 30, height: 30, channels: 3, background: "#26356c" } });
  const [jpeg, png] = await Promise.all([source.clone().jpeg().toBuffer(), source.png().toBuffer()]);
  requireCompleteStaticImage(jpeg);
  requireCompleteStaticImage(png);
  assert.throws(() => requireCompleteStaticImage(jpeg.subarray(0, -2)));
  assert.throws(() => requireCompleteStaticImage(png.subarray(0, -12)));
  const animationControl = Buffer.from("000000086163544c000000020000000000000000", "hex");
  assert.throws(() => requireCompleteStaticImage(Buffer.concat([png.subarray(0, 33), animationControl, png.subarray(33)])));
});

test("captions and the gallery label use the existing language structure", () => {
  assert.equal(galleryCaption("  Prøve  "), "Prøve");
  assert.equal(Array.from(galleryCaption("🚴".repeat(280))).length, 280);
  assert.throws(() => galleryCaption("🚴".repeat(281)), GalleryError);
  assert.equal(galleryText("da", "title"), "Galleri");
  for (const locale of locales) assert(galleryText(locale, "reportSupport").trim());
});

test("gallery keeps nearby images and a bounded window of completed reads", async () => {
  const fetched: string[] = [];
  const revoked: string[] = [];
  let created = 0;
  const cache = createGalleryPhotoCache({
    read: async id => { fetched.push(id); return new Blob([id]); },
    createUrl: () => `blob:fixture-${++created}`,
    revokeUrl: url => revoked.push(url),
    decode: async () => {},
  });
  cache.select(["a", "b"]);
  await cache.load("a");
  await cache.load("b", true);
  cache.select(["b", "c", "a"]);
  await cache.load("b");
  await cache.load("c", true);
  cache.select(["c", "d", "b"]);
  await cache.load("d", true);
  cache.select(["d", "e", "c"]);
  await cache.load("e", true);
  cache.select(["e", "f", "d"]);
  await cache.load("f", true);
  await cache.load("outside", true);
  assert.deepEqual(fetched, ["a", "b", "c", "d", "e", "f"]);
  assert.equal(cache.getSnapshot().size, 5);
  assert.deepEqual(revoked, ["blob:fixture-1"]);
  cache.reconcile(new Set(["b", "c", "d"]));
  assert.equal(cache.getSnapshot().has("e"), false);
  cache.clear();
  assert.equal(cache.getSnapshot().size, 0);
  assert.equal(revoked.length, 6);
});

test("gallery warms only two visible photos at a time and frees the connection for a cold selection", async () => {
  const requests: { id: string; signal: AbortSignal; background: boolean }[] = [];
  const responses = new Map<string, (blob: Blob) => void>();
  const cache = createGalleryPhotoCache({
    read(id, signal, background) {
      requests.push({ id, signal, background });
      return new Promise(resolve => { responses.set(id, resolve); });
    },
    createUrl: () => "blob:fixture",
    revokeUrl: () => {},
    decode: async () => {},
  });
  cache.select(["a", "b", "c"]);
  cache.warm();
  cache.warm();
  assert.deepEqual(requests.map(request => request.id), ["a", "b"]);
  cache.select(["c", "b", "a"], true);
  assert(requests.every(request => request.signal.aborted));
  const selected = cache.load("c");
  assert.equal(requests.at(-1)?.background, false);
  responses.get("a")?.(new Blob());
  responses.get("b")?.(new Blob());
  responses.get("c")?.(new Blob());
  await selected;
  assert.equal(cache.getSnapshot().get("c")?.status, "ready");
  assert.equal(cache.getSnapshot().has("a"), false);
  cache.warm();
  assert.deepEqual(requests.slice(-2).map(request => request.id), ["b", "a"]);
  cache.clear();
});

test("a decode that returns after revocation cannot restore a private image", async () => {
  let finish = () => {};
  let start = () => {};
  const started = new Promise<void>(resolve => { start = resolve; });
  const revoked: string[] = [];
  const cache = createGalleryPhotoCache({
    read: async () => new Blob(["image"]),
    createUrl: () => "blob:fixture",
    revokeUrl: url => revoked.push(url),
    decode: () => new Promise<void>(resolve => { finish = resolve; start(); }),
  });
  cache.select(["visible"]);
  const loading = cache.load("visible");
  await started;
  cache.clear();
  finish();
  await loading;
  assert.equal(cache.getSnapshot().size, 0);
  assert.deepEqual(revoked, ["blob:fixture"]);
});

test("the club queue projects captions and author names without confidential fields", () => {
  const report = projectReport({
    id: "report", club_id: "club", target_kind: "photo", target_id: "photo", reason: "other", status: "pending",
    created_at: "2026-11-23", reporter_id: "reporter", support_case: "private",
    snapshot: { body: "caption", display_name: "public uploader", uploader_email: "private", photo_bytes: "private" },
  });
  assert.equal(report.target_kind, "photo");
  assert.deepEqual(report.snapshot, { text: "caption", author: "public uploader" });
  assert(!JSON.stringify(report).includes("private"));
});


test("club moderation receives the comment snapshot and evidence flag without support details", () => {
  const report = projectReport({
    id: "case", club_id: "club", target_kind: "photo_comment", target_id: "comment",
    reason: "other", status: "pending", created_at: "2026-11-23", has_image_evidence: true,
    snapshot: { body: "saved comment", display_name: "comment author", photo_id: "photo", reporter_id: "private" },
  });
  assert.equal(report.target_kind, "photo_comment");
  assert.equal(report.target_id, "comment");
  assert("hasImageEvidence" in report);
  assert.equal(report.hasImageEvidence, true);
  assert.deepEqual(report.snapshot, { text: "saved comment", author: "comment author" });
  assert(!JSON.stringify(report).includes("private"));
});

test("upload attestation binds the gallery, requester, lease and exact payload", async () => {
  const { signGalleryUpload } = await import("../lib/clubs/gallery-upload-signature");
  const key = Buffer.from("ab".repeat(32), "hex");
  const binding = {
    actor: "10000000-0000-4000-8000-000000000001",
    club: "20000000-0000-4000-8000-000000000002",
    request: "30000000-0000-4000-8000-000000000003",
    attempt: "40000000-0000-4000-A000-000000000004",
  };
  const payload = '[{"caption":"Rødgrød 🚴"}]';
  const mac = signGalleryUpload(binding, payload, key);
  assert.match(mac, /^[0-9a-f]{64}$/);
  assert.equal(signGalleryUpload({ ...binding, attempt: binding.attempt.toLowerCase() }, payload, key), mac);
  assert.notEqual(signGalleryUpload(binding, payload + " ", key), mac);
  for (const field of Object.keys(binding) as (keyof typeof binding)[]) {
    assert.notEqual(signGalleryUpload({ ...binding, [field]: "50000000-0000-4000-8000-000000000005" }, payload, key), mac);
  }
});
