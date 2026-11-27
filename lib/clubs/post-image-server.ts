import { createHash, createHmac } from "node:crypto";
import { ContentError } from "./content-contract";
import { decodeClubImage } from "./image-normalize";
import { isPostImageFrame, postImageCrop, postImageLimit, postImageSize } from "./post-image";

const sha = (value: string) => createHash("sha256").update(value).digest("hex");

export function postImageUploadsEnabled() {
  return /^[a-f0-9]{64}$/.test(process.env.BIKE_ME_GALLERY_UPLOAD_HMAC_KEY?.trim() ?? "");
}

export async function signPostImage(
  actor: string, club: string, id: string, request: string, version: number | null,
  body: string, image: unknown,
) {
  const secret = process.env.BIKE_ME_GALLERY_UPLOAD_HMAC_KEY?.trim() ?? "";
  if (!/^[a-f0-9]{64}$/.test(secret)) throw new ContentError("unavailable");

  let attachment = null;
  let digest = sha(JSON.stringify([body, null]));
  if (image !== null) {
    if (!image || typeof image !== "object" || !("source" in image) || !("frame" in image) ||
      !isPostImageFrame(image.frame) || typeof image.source !== "string" ||
      image.source.length > Math.ceil(postImageLimit / 3) * 4 ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(image.source)) throw new ContentError("image");

    const { zoom, x, y } = image.frame;
    const frame = { zoom, x, y };
    try {
      const bytes = Buffer.from(image.source, "base64");
      const { input, m } = await decodeClubImage(bytes, postImageLimit, 1600 * 1600);
      if (m.format !== "jpeg" || (m.orientation ?? 1) !== 1 || m.width > 1600 || m.height > 1600) {
        throw new ContentError("image");
      }
      const crop = postImageCrop({ width: m.width, height: m.height }, frame);
      // Re-encode both representations so only decoded pixels leave this server.
      const source = await input.clone().jpeg({ quality: 82, mozjpeg: true }).timeout({ seconds: 3 }).toBuffer();
      const cropped = await input.extract(crop).resize(postImageSize).jpeg({ quality: 82, mozjpeg: true })
        .timeout({ seconds: 3 }).toBuffer();
      if (source.length > postImageLimit || cropped.length > postImageLimit) throw new ContentError("image");
      digest = sha(JSON.stringify([body, sha(image.source), frame]));
      attachment = { source: source.toString("base64"), crop: cropped.toString("base64"), frame };
    } catch {
      throw new ContentError("image");
    }
  }
  const payload = JSON.stringify({ body, digest, attachment });
  const message = ["bikeme:club-post-image:v1", actor, club.toLowerCase(), id.toLowerCase(), request.toLowerCase(), version ?? "-", payload].join("\n");
  const mac = createHmac("sha256", Buffer.from(secret, "hex")).update(message).digest("hex");
  return { p_club: club, p_post: id, p_request: request, p_version: version, p_payload: payload, p_mac: mac };
}
