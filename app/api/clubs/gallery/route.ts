import { NextRequest, NextResponse } from "next/server";

import { validateContent, validateReportDetail } from "@/lib/clubs/content-contract";
import { GalleryError, galleryLimits, type GalleryPhoto, type GalleryDiscussion, type GalleryErrorCode } from "@/lib/clubs/gallery-contract";
import { galleryBody, galleryRpc, saveGalleryUpload } from "@/lib/clubs/gallery-server";
import { isClubRequestOrigin } from "@/lib/clubs/request-origin";
import { isClubId, type ClubRole } from "@/lib/clubs/types";
import { preventAuthCaching } from "@/lib/supabase/proxy";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const status: Record<GalleryErrorCode, number> = {
  auth: 401, access: 403, invalid: 400, image: 422, size: 413, quota: 429,
  capacity: 413, conflict: 409, busy: 409, unavailable: 404, network: 503, contentRejected: 422,
};
const json = (body: object, code = 200) => preventAuthCaching(NextResponse.json(body, { status: code }));
function failure(error: unknown) {
  const kind = error instanceof GalleryError ? error.kind : "network";
  return json({ error: kind }, status[kind]);
}

async function context(request: NextRequest) {
  const clubId = request.nextUrl.searchParams.get("clubId") ?? "";
  if (!isClubId(clubId)) throw new GalleryError("invalid");
  const client = await createClient();
  const { data, error } = await client.auth.getUser();
  if (error && ![400, 401, 403].includes(error.status ?? 401)) throw new GalleryError("network");
  if (!data.user) throw new GalleryError("auth");
  return { client, userId: data.user.id, clubId };
}

function cursor(query: URLSearchParams) {
  const time = query.get("beforeTime");
  const id = query.get("beforeId");
  if (Boolean(time) !== Boolean(id) ||
      (time && (time.length > 45 || !Number.isFinite(Date.parse(time)))) ||
      (id && !isClubId(id))) throw new GalleryError("invalid");
  return { p_before_time: time, p_before_id: id };
}

export async function GET(request: NextRequest) {
  try {
    const { client, userId, clubId } = await context(request);
    const query = request.nextUrl.searchParams;
    const id = query.get("id");
    const variant = query.get("variant");
    if (variant === "discussion") {
      if (!id || !isClubId(id)) throw new GalleryError("invalid");
      const { liked, likeCount, comments: rows } = await galleryRpc<Omit<GalleryDiscussion, "next">>(
        client, "club_gallery_discussion", { p_club: clubId, p_photo: id, ...cursor(query) },
      );
      const comments = rows.slice(0, galleryLimits.commentsPerPage);
      const tail = comments.at(-1);
      const next = tail && rows.length > comments.length ? { time: tail.createdAt, id: tail.id } : null;
      return json({ userId, liked, likeCount, comments, next });
    }
    if (id || variant) {
      if (!id || !isClubId(id) || !["thumbnail", "full", "evidence"].includes(variant ?? "")) throw new GalleryError("invalid");
      const encoded = variant === "evidence"
        ? await galleryRpc<string>(client, "club_gallery_evidence", { p_club: clubId, p_report: id })
        : await galleryRpc<string>(client, "club_gallery_image", { p_club: clubId, p_photo: id, p_thumbnail: variant === "thumbnail" });
      if (!encoded) throw new GalleryError("unavailable");
      return preventAuthCaching(new NextResponse(new Uint8Array(Buffer.from(encoded, "base64")), {
        headers: { "Content-Type": "image/jpeg", "X-Content-Type-Options": "nosniff", "Cross-Origin-Resource-Policy": "same-origin" },
      }));
    }

    const { items: rows, role } = await galleryRpc<{ items: GalleryPhoto[]; role: ClubRole }>(client, "club_gallery_page", {
      p_club: clubId, ...cursor(query),
    });
    const photos = rows.slice(0, galleryLimits.page);
    const tail = photos.at(-1);
    return json({ userId, role, photos, next: tail && rows.length > photos.length ? { time: tail.createdAt, id: tail.id } : null });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: NextRequest) {
  if (!isClubRequestOrigin(request.headers.get("origin"), request.headers.get("x-forwarded-host") ?? request.headers.get("host"),
    request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.slice(0, -1))) return failure(new GalleryError("access"));
  try {
    const { client, userId, clubId } = await context(request);
    // A delayed request from a prior account must never upload or report as the new account.
    if (request.headers.get("x-gallery-actor") !== userId) throw new GalleryError("auth");
    const mime = request.headers.get("content-type") ?? "";
    if (mime.startsWith("multipart/form-data;")) {
      await saveGalleryUpload(request, userId, clubId, mime);
    } else if (mime.startsWith("application/json")) {
      const body = await galleryBody(request, 12_000);
      const command = await new Response(body).json().catch(() => null);
      if (!command || typeof command.id !== "string" || !isClubId(command.id)) throw new GalleryError("invalid");
      const target = { p_club: clubId, p_photo: command.id };
      if (command.type === "remove") await galleryRpc(client, "club_gallery_remove", target);
      else if (command.type === "like") {
        if (typeof command.liked !== "boolean") throw new GalleryError("invalid");
        await galleryRpc(client, "club_gallery_set_like", { ...target, p_liked: command.liked });
      } else if (command.type === "comment" || command.type === "removeComment") {
        if (typeof command.commentId !== "string" || !isClubId(command.commentId)) throw new GalleryError("invalid");
        const comment = { ...target, p_comment: command.commentId };
        if (command.type === "comment") {
          let text: string;
          try { text = validateContent(command.body, "comment"); } catch { throw new GalleryError("invalid"); }
          await galleryRpc(client, "club_gallery_add_comment", { ...comment, p_body: text });
        } else await galleryRpc(client, "club_gallery_remove_comment", comment);
      } else if (command.type === "report" || command.type === "reportComment") {
        if (!["club", "bikeMe"].includes(command.destination) || !["spam", "harassment", "unsafe", "other"].includes(command.reason)) {
          throw new GalleryError("invalid");
        }
        let detail: string;
        try { detail = validateReportDetail(command.detail); } catch { throw new GalleryError("invalid"); }
        const report = { ...target, p_destination: command.destination, p_reason: command.reason, p_detail: detail };
        if (command.type === "reportComment") {
          if (typeof command.commentId !== "string" || !isClubId(command.commentId)) throw new GalleryError("invalid");
          await galleryRpc(client, "club_gallery_report_comment", { ...report, p_comment: command.commentId });
        } else await galleryRpc(client, "club_gallery_report", report);
      } else throw new GalleryError("invalid");
    } else throw new GalleryError("invalid");
    return json({ ok: true, userId });
  } catch (error) {
    return failure(error);
  }
}
