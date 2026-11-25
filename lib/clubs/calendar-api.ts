import type { SupabaseClient } from "@supabase/supabase-js";
import type { CalendarEntry, CalendarEvent, CalendarRange } from "./calendar";

export type CalendarErrorKind = "auth" | "access" | "invalid" | "conflict" | "network";
export class CalendarError extends Error {
  constructor(public kind: CalendarErrorKind) { super(kind); }
}

export function calendarError(error: unknown): CalendarError {
  if (error instanceof CalendarError) return error;
  const code = (error as { code?: string } | null)?.code;
  return new CalendarError(code === "42501" ? "access" : code === "22023" || code === "22P02" ? "invalid" :
    code === "23505" ? "conflict" : code === "PGRST301" || code === "PGRST303" ? "auth" : "network");
}

export function createCalendarApi(client: SupabaseClient, actorId: string) {
  async function authorization() {
    const { data, error } = await client.auth.getSession();
    if (error || data.session?.user.id !== actorId) throw new CalendarError("auth");
    return "Bearer " + data.session.access_token;
  }

  return {
    async list(clubId: string, range: CalendarRange, signal: AbortSignal): Promise<CalendarEntry[]> {
      const token = await authorization();
      const entries: CalendarEntry[] = [];
      for (let offset = 0; ; offset += 200) {
        const { data, error } = await client.rpc("club_calendar_entries", { p_club: clubId, p_from: range.from, p_to: range.to })
          .setHeader("Authorization", token).abortSignal(signal)
          .order("starts_at").order("kind").order("id").range(offset, offset + 199);
        if (error) throw calendarError(error);
        const rows = (data ?? []) as CalendarEntry[];
        entries.push(...rows);
        if (rows.length < 200) break;
      }
      const member = await client.from("clubs").select("id").eq("id", clubId)
        .setHeader("Authorization", token).abortSignal(signal).maybeSingle();
      if (member.error) throw calendarError(member.error);
      if (!member.data) throw new CalendarError("access");
      await authorization();
      return entries;
    },
    async create(clubId: string, event: CalendarEvent, signal: AbortSignal) {
      const token = await authorization();
      const { data, error } = await client.rpc("club_calendar_create_event", {
        p_club: clubId, p_id: event.id, p_title: event.title, p_place: event.place,
        p_starts_at: event.startsAt, p_description: event.description,
      }).setHeader("Authorization", token).abortSignal(signal);
      if (error) throw calendarError(error);
      if (data !== event.id) throw new CalendarError("network");
      return data as string;
    },
  };
}
