import { GalleryError, type GalleryErrorCode } from "./gallery-contract";

const galleryErrors = new Set<string>(["access", "auth", "invalid", "image", "size", "quota",
  "capacity", "busy", "conflict", "unavailable", "network", "contentRejected"]);

export function galleryErrorKind(error: unknown): GalleryErrorCode {
  return error instanceof GalleryError ? error.kind : "network";
}

export async function galleryResponse<T>(response: Response, actor: string): Promise<T> {
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    if (galleryErrors.has(body?.error)) throw new GalleryError(body.error);
    throw new GalleryError(response.status === 413 ? "size" : "network");
  }
  if (body?.userId !== actor) throw new GalleryError("auth");
  return body;
}
