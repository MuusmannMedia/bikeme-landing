import { createHash, createHmac } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { GalleryError, galleryLimits } from "@/lib/clubs/gallery-contract";
import { normalizeGalleryPhoto } from "@/lib/clubs/gallery-normalize";
import { galleryBody, galleryRpc, galleryUploadBytes, galleryUploadKey } from "@/lib/clubs/gallery-server";
import { isClubRequestOrigin } from "@/lib/clubs/request-origin";
import { isClubId } from "@/lib/clubs/types";
import { preventAuthCaching } from "@/lib/supabase/proxy";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const json = (body: object, status = 200) => preventAuthCaching(NextResponse.json(body, { status }));
const status = {
  auth: 401, access: 403, invalid: 400, image: 422, size: 413, capacity: 413, quota: 429,
  conflict: 409, busy: 409, unavailable: 404, uploadUnavailable: 503, network: 503, contentRejected: 422,
};
function failure(error: unknown) {
  const kind = error instanceof GalleryError ? error.kind : "network";
  return json({ error: kind }, status[kind]);
}

async function context(request: NextRequest, writing = false) {
  const query = request.nextUrl.searchParams;
  const club = query.get("clubId") ?? "", post = query.get("postId") ?? "";
  const photo = query.get("id");
  if (!isClubId(club) || !isClubId(post) || (photo !== null && !isClubId(photo))) throw new GalleryError("invalid");
  if (writing && !isClubRequestOrigin(request.headers.get("origin"), request.headers.get("x-forwarded-host") ?? request.headers.get("host"),
    request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.slice(0, -1))) throw new GalleryError("access");
  const client = await createClient();
  const { data, error } = await client.auth.getUser();
  if (error && ![400, 401, 403].includes(error.status ?? 401)) throw new GalleryError("network");
  const actor = data.user?.id;
  if (!actor || (writing && request.headers.get("x-gallery-actor") !== actor)) throw new GalleryError("auth");
  return { client, actor, club: club.toLowerCase(), post: post.toLowerCase(), photo };
}

export async function GET(request: NextRequest) {
  try {
    const { client, actor, club, post, photo } = await context(request);
    const args = { p_club: club, p_post: post };
    if (!photo) return json({ userId: actor, photos: await galleryRpc(client, "club_post_attachments", args) });
    const size = request.nextUrl.searchParams.get("size");
    if (size !== "thumbnail" && size !== "full") throw new GalleryError("invalid");
    const bytes = await galleryRpc<string | null>(client, "club_post_attachment_image", {
      ...args, p_photo: photo, p_thumbnail: size === "thumbnail",
    });
    if (!bytes) throw new GalleryError("unavailable");
    return preventAuthCaching(new NextResponse(new Uint8Array(Buffer.from(bytes, "base64")), {
      headers: { "Content-Type": "image/jpeg", "X-Content-Type-Options": "nosniff", "Cross-Origin-Resource-Policy": "same-origin" },
    }));
  } catch (error) { return failure(error); }
}

export async function POST(request: NextRequest) {
  try {
    const { client, actor, club, post, photo } = await context(request, true);
    const mime = request.headers.get("content-type") ?? "";
    if (photo || !mime.startsWith("multipart/form-data;")) throw new GalleryError("invalid");
    const args = { p_club: club, p_post: post };
    const entry = await galleryRpc<{ author_id?: string }>(client, "club_content_item", {
      p_club: club, p_id: post, p_kind: "post",
    });
    if (entry.author_id !== actor) throw new GalleryError("access");
    const key = galleryUploadKey();
    const raw = await galleryBody(request, galleryLimits.batch * galleryLimits.browserInput + 16_384);
    const form = await new Response(raw, { headers: { "Content-Type": mime } }).formData().catch(() => {
      throw new GalleryError("invalid");
    });
    const id = form.get("requestId");
    const files = form.getAll("photo");
    if (typeof id !== "string" || !isClubId(id) || !files.length || files.length > galleryLimits.batch ||
        !files.every((file): file is File => file instanceof File)) throw new GalleryError("invalid");
    const bytes = await galleryUploadBytes(files, true);
    const hashes = bytes.map(file => createHash("sha256").update(file).digest("hex"));
    const digest = createHash("sha256").update(JSON.stringify(hashes)).digest("hex");
    const deadline = performance.now() + 24_000;
    const photos = [];
    for (const file of bytes) {
      if (request.signal.aborted) throw new GalleryError("network");
      const image = await normalizeGalleryPhoto(file, deadline);
      photos.push({ width: image.width, height: image.height, image: image.image.toString("base64"),
        thumbnail: image.thumbnail.toString("base64") });
    }
    if (request.signal.aborted) throw new GalleryError("network");
    const payload = JSON.stringify(photos);
    const requestId = id.toLowerCase();
    const mac = createHmac("sha256", key).update(
      ["bikeme:club-post-attachments:v1", actor, club, post, requestId, digest, payload].join("\n"),
    ).digest("hex");
    await galleryRpc(client, "club_post_attachments_commit", {
      ...args, p_request: requestId, p_digest: digest, p_payload: payload, p_mac: mac,
    });
    return json({ userId: actor, ok: true });
  } catch (error) { return failure(error); }
}

export async function DELETE(request: NextRequest) {
  try {
    const { client, actor, club, post, photo } = await context(request, true);
    if (!photo) throw new GalleryError("invalid");
    await galleryRpc(client, "club_post_attachment_remove", { p_club: club, p_post: post, p_photo: photo });
    return json({ userId: actor, ok: true });
  } catch (error) { return failure(error); }
}
