import type { ClubImageShape, ClubRole } from "./types";

export const galleryLimits = {
  page: 24,
  commentsPerPage: 20,
  batch: 5,
  caption: 280,
  full: 500_000,
  thumbnail: 90_000,
  input: 3_500_000,
  request: 4_000_000,
  browserInput: 700_000,
  pixels: 24_000_000,
} as const;

export type GalleryPhoto = {
  id: string;
  createdAt: string;
  uploader: string | null;
  caption: string;
  own: boolean;
  width: number;
  height: number;
};
export type GalleryCursor = { time: string; id: string };
export type GalleryPage = { role: ClubRole; photos: GalleryPhoto[]; next: GalleryCursor | null; profileRevision?: number; imageShape?: ClubImageShape };
export type GalleryComment = {
  id: string;
  author: string | null;
  body: string;
  createdAt: string;
  removable: boolean;
  reportable: boolean;
};
export type GalleryDiscussion = {
  liked: boolean;
  likeCount: number;
  comments: GalleryComment[];
  next: GalleryCursor | null;
};
export type GalleryErrorCode = "access" | "auth" | "invalid" | "image" | "size" | "quota" |
  "capacity" | "busy" | "conflict" | "unavailable" | "network" | "contentRejected" | "uploadUnavailable";

export class GalleryError extends Error {
  constructor(public readonly kind: GalleryErrorCode) { super(kind); }
}
export function galleryCaption(value: unknown) {
  if (typeof value !== "string" || value.includes("\0") || Array.from(value).length > galleryLimits.caption) {
    throw new GalleryError("invalid");
  }
  return value.trim();
}
export function galleryImageUrl(clubId: string, id: string, variant: "thumbnail" | "full" | "evidence") {
  return `/api/clubs/gallery?clubId=${clubId}&id=${id}&variant=${variant}`;
}
