import sharp from "sharp";

import { GalleryError, galleryLimits } from "./gallery-contract";
import { decodeClubImage } from "./image-normalize";

const remainingSeconds = (deadline: number) => {
  const seconds = Math.floor((deadline - performance.now()) / 1000);
  if (seconds < 1) throw new GalleryError("image");
  return Math.min(seconds, 4);
};

export async function normalizeGalleryPhoto(bytes: Uint8Array, deadline = performance.now() + 12_000) {
  try {
    remainingSeconds(deadline);
    const { input } = await decodeClubImage(bytes, galleryLimits.input, galleryLimits.pixels);
    const { data, info } = await input.autoOrient().resize({
      width: 1600, height: 1600, fit: "inside", withoutEnlargement: true,
    }).flatten({ background: "#080e18" }).toColourspace("srgb").raw()
      .timeout({ seconds: remainingSeconds(deadline) }).toBuffer({ resolveWithObject: true });

    const encode = (size: number, quality: number) => sharp(data, {
      raw: { width: info.width, height: info.height, channels: info.channels },
    }).resize({ width: size, height: size, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality, mozjpeg: true }).timeout({ seconds: remainingSeconds(deadline) })
      .toBuffer({ resolveWithObject: true });

    let full = await encode(1600, 83);
    if (full.data.length > galleryLimits.full) full = await encode(1600, 64);
    if (full.data.length > galleryLimits.full) full = await encode(1280, 55);
    let thumb = await encode(galleryLimits.thumbnailEdge, 77);
    if (thumb.data.length > galleryLimits.thumbnail) thumb = await encode(224, 55);
    if (full.data.length > galleryLimits.full || thumb.data.length > galleryLimits.thumbnail) throw new GalleryError("size");
    remainingSeconds(deadline);
    return { image: full.data, thumbnail: thumb.data, width: full.info.width, height: full.info.height };
  } catch (error) {
    if (error instanceof GalleryError) throw error;
    throw new GalleryError("image");
  }
}
