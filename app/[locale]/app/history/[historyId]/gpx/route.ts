import { NextResponse } from "next/server";

import { loadRideHistoryDetail, loadViewer } from "@/lib/app-data";
import { buildGpx } from "@/lib/gpx";
import { isLocale } from "@/lib/locales";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(_request: Request, { params }: { params: Promise<{ locale: string; historyId: string }> }) {
  const { locale, historyId } = await params;
  if (!isLocale(locale)) return new NextResponse(null, { status: 404 });
  try {
    const client = await createClient();
    const viewer = await loadViewer(client);
    if (!viewer.access.hasPro) return new NextResponse(null, { status: 403 });
    const ride = await loadRideHistoryDetail(client, viewer.userId, historyId);
    const gpx = buildGpx(ride.title, ride.route);
    if (!gpx) return new NextResponse(null, { status: 404 });
    return new NextResponse(gpx, {
      status: 200,
      headers: {
        "Content-Type": "application/gpx+xml; charset=utf-8",
        "Content-Disposition": "attachment; filename=\"bike-me-ride.gpx\"",
        "Cache-Control": "private, no-store, max-age=0",
        Pragma: "no-cache",
        "X-Robots-Tag": "noindex, nofollow, noarchive"
      }
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
