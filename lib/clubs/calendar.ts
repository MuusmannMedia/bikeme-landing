export type CalendarKind = "ride" | "event";
export type CalendarFilter = CalendarKind | "all";
export type CalendarEntry = {
  id: string; kind: CalendarKind; title: string; starts_at: string; place: string | null;
  distance_km: number | null; description: string | null;
};
export type CalendarRange = { from: string; to: string };
export type CalendarEventDraft = { title: string; date: string; time: string; place: string; description: string };
export type CalendarEvent = { id: string; title: string; startsAt: string; place: string; description: string };

export function calendarDate(value: Date): string {
  return [value.getFullYear(), value.getMonth() + 1, value.getDate()].map((part, i) => String(part).padStart(i === 0 ? 4 : 2, "0")).join("-");
}

export function localCalendarDate(day: string, time = "12:00"): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const date = new Date(day + "T" + time + ":00");
  if (!Number.isFinite(date.getTime()) || calendarDate(date) !== day ||
      [date.getHours(), date.getMinutes()].map(n => String(n).padStart(2, "0")).join(":") !== time) return null;
  return date;
}

function shift(value: Date, days: number) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate() + days, 12);
}

export function weekDates(value: Date): Date[] {
  const first = shift(value, -((value.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, index) => shift(first, index));
}

export function monthDates(value: Date): Date[] {
  const first = new Date(value.getFullYear(), value.getMonth(), 1, 12);
  const count = new Date(value.getFullYear(), value.getMonth() + 1, 0).getDate();
  const start = weekDates(first)[0];
  return Array.from({ length: Math.ceil((count + (first.getDay() + 6) % 7) / 7) * 7 }, (_, i) => shift(start, i));
}

export function calendarRange(days: Date[]): CalendarRange {
  const first = days[0], last = days[days.length - 1];
  return { from: new Date(first.getFullYear(), first.getMonth(), first.getDate()).toISOString(),
    to: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1).toISOString() };
}

export function nextCalendarDate(day: Date, direction: number, week: boolean) {
  return week ? shift(day, direction * 7) : new Date(day.getFullYear(), day.getMonth() + direction, 1, 12);
}

export function groupCalendarEntries(entries: CalendarEntry[], filter: CalendarFilter) {
  const days = new Map<string, CalendarEntry[]>();
  for (const entry of entries) {
    if (filter !== "all" && filter !== entry.kind) continue;
    const day = calendarDate(new Date(entry.starts_at));
    const items = days.get(day);
    if (items) items.push(entry);
    else days.set(day, [entry]);
  }
  return days;
}

export function calendarEventInput(id: string, draft: CalendarEventDraft): CalendarEvent | null {
  const start = localCalendarDate(draft.date, draft.time);
  const title = draft.title.trim(), place = draft.place.trim(), description = draft.description.trim();
  if (!start || !title || !place || Array.from(title).length > 70 || Array.from(place).length > 70 ||
      Array.from(description).length > 280 || [title, place, description].some(value => value.includes("\0"))) return null;
  return { id, title, startsAt: start.toISOString(), place, description };
}
