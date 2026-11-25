import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { preventAuthCaching } from "@/lib/supabase/proxy";
import { CalendarError, calendarError, createCalendarApi } from "@/lib/clubs/calendar-api";
import { isClubRequestOrigin } from "@/lib/clubs/request-origin";
import { isClubId } from "@/lib/clubs/types";

export const dynamic = "force-dynamic";
const reply = (body: object, status = 200) => preventAuthCaching(NextResponse.json(body, { status }));

function reject(cause: unknown) {
  const { kind } = calendarError(cause);
  const code = { auth: 401, access: 403, invalid: 400, conflict: 409, network: 503 } as const;
  return reply({ error: kind }, code[kind]);
}

async function session(actor: string) {
  const client = await createClient();
  const { data, error } = await client.auth.getUser();
  if (error && ![400, 401, 403].includes(error.status ?? 0)) throw new CalendarError("network");
  if (!data.user || actor !== data.user.id) throw new CalendarError("auth");
  return createCalendarApi(client, data.user.id);
}

function instant(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const clubId = searchParams.get("clubId") ?? "", actorId = searchParams.get("actorId") ?? "";
  const from = searchParams.get("from"), to = searchParams.get("to");
  try {
    const api = await session(actorId);
    if (!isClubId(clubId) || !instant(from) || !instant(to)) throw new CalendarError("invalid");
    return reply({ userId: actorId, entries: await api.list(clubId, { from, to }, request.signal) });
  } catch (cause) { return reject(cause); }
}

export async function POST(request: NextRequest) {
  const protocol = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!isClubRequestOrigin(request.headers.get("origin"), host, protocol)) return reply({ error: "access" }, 403);
  try {
    if (Number(request.headers.get("content-length")) > 4096) throw new CalendarError("invalid");
    const raw = await request.text();
    if (raw.length > 4096) throw new CalendarError("invalid");
    const input = JSON.parse(raw);
    if (!input || typeof input.actorId !== "string") throw new CalendarError("invalid");
    const api = await session(input.actorId);
    const { clubId, event } = input;
    if (!isClubId(clubId) || !event || !isClubId(event.id) || !instant(event.startsAt) ||
        typeof event.title !== "string" || typeof event.place !== "string" || typeof event.description !== "string") throw new CalendarError("invalid");
    const id = await api.create(clubId, event, request.signal);
    return reply({ userId: input.actorId, id });
  } catch (cause) { return reject(cause instanceof SyntaxError ? new CalendarError("invalid") : cause); }
}
