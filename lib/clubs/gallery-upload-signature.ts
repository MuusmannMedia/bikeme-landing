import { createHmac } from "node:crypto";

export type GalleryUploadBinding = {
  actor: string;
  club: string;
  request: string;
  attempt: string;
};

export function signGalleryUpload(binding: GalleryUploadBinding, payload: string, key: Uint8Array) {
  const message = [
    "bikeme:club-gallery:commit:v1",
    binding.actor.toLowerCase(),
    binding.club.toLowerCase(),
    binding.request.toLowerCase(),
    binding.attempt.toLowerCase(),
    payload,
  ].join("\n");
  return createHmac("sha256", key).update(message, "utf8").digest("hex");
}
