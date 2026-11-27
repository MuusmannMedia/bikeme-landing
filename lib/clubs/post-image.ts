import { CLUB_IMAGE_MAX_ZOOM, clubImageGeometry, type ClubImageFrame, type ImageDimensions } from "./image-frame";

export const postImageSize = { width: 960, height: 540 };
export const postImageLimit = 448 * 1024;
export const postImageRequestLimit = Math.ceil(postImageLimit / 3) * 4 + 100_000;
export type PostImageFrame = Omit<ClubImageFrame, "whole">;
export type PostImageUpload = { source: string; frame: PostImageFrame };
export type PostImageChoice = PostImageUpload & { dimensions: ImageDimensions };
export type PostImageInfo = { revision: string; frame: PostImageFrame };

export function isPostImageFrame(value: unknown): value is PostImageFrame {
  if (!value || typeof value !== "object") return false;
  const { zoom, x, y } = value as PostImageFrame;
  return Number.isFinite(zoom) && zoom >= 1 && zoom <= CLUB_IMAGE_MAX_ZOOM &&
    Number.isFinite(x) && Math.abs(x) <= 1 && Number.isFinite(y) && Math.abs(y) <= 1;
}

export function postImageCrop(image: ImageDimensions, frame: PostImageFrame) {
  const { width, height, left, top } = clubImageGeometry(postImageSize, image, { ...frame, whole: false });
  const cropWidth = Math.max(1, Math.min(image.width, Math.round(postImageSize.width * image.width / width)));
  const cropHeight = Math.max(1, Math.min(image.height, Math.round(postImageSize.height * image.height / height)));
  return {
    width: cropWidth,
    height: cropHeight,
    left: Math.max(0, Math.min(image.width - cropWidth, Math.round(-left * image.width / width))),
    top: Math.max(0, Math.min(image.height - cropHeight, Math.round(-top * image.height / height))),
  };
}

export function postImageUrl(clubId: string, postId: string, revision: string, source = false) {
  const query = new URLSearchParams({ clubId, postId, revision });
  if (source) query.set("source", "true");
  return `/api/clubs/content/image?${query}`;
}
