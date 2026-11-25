"use client";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  calendarDate, calendarEventInput, calendarRange, groupCalendarEntries, localCalendarDate, monthDates, nextCalendarDate,
  type CalendarEntry, type CalendarEvent, type CalendarFilter, type CalendarKind,
} from "@/lib/clubs/calendar";
import { calendarText } from "@/lib/clubs/calendar-i18n";
import { clubRideHref } from "@/lib/clubs/ride-contract";
import type { Locale } from "@/lib/locales";

const iconPaths = {
  previous: "m15 18-6-6 6-6", next: "m9 18 6-6-6-6", plus: "M12 5v14M5 12h14",
  close: "m6 6 12 12M18 6 6 18",
  calendar: "M3 10h18M8 3v4m8-4v4M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z",
  bike: "M5 18a3 3 0 1 0 0 .01M19 18a3 3 0 1 0 0 .01M5 18l4-7 4 7h-8m4-7h7l3 7m-3-7-1-3h3M7 10h4",
  time: "M12 7v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z",
  lock: "M6 11V7a6 6 0 1 1 12 0v4M4 11h16v10H4Z",
  pin: "M12 22s7-6 7-13a7 7 0 1 0-14 0c0 7 7 13 7 13Zm0-10a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
};
function CalendarIcon({ icon, size = 16 }: { icon: keyof typeof iconPaths; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={iconPaths[icon]} /></svg>;
}
const filters = ["all", "ride", "event"] as const;
type Props = { clubId: string; userId: string; locale: Locale; miles: boolean; initialDay?: string; onAccessLost: (auth: boolean) => void };
type Read = { key: string; entries: CalendarEntry[]; error?: boolean };

export function ClubCalendar({ clubId, userId, locale, miles, initialDay, onAccessLost }: Props) {
  const s = calendarText(locale);
  const [day, setDay] = useState(() => (initialDay && localCalendarDate(initialDay)) || new Date());
  const [filter, setFilter] = useState<CalendarFilter>("all");
  const [state, setState] = useState<Read>();
  const [revision, setRevision] = useState(0);
  const [dialog, setDialog] = useState<"create" | { id: string } | null>(null);
  const [kind, setKind] = useState<CalendarKind>("ride");
  const [message, setMessage] = useState(false);
  const [busy, setBusy] = useState(false);
  const [issue, setIssue] = useState<"invalid" | "saveError" | "uncertain">();
  const panel = useRef<HTMLDialogElement>(null), origin = useRef<HTMLElement | null>(null);
  const attempt = useRef<CalendarEvent | null>(null), inflight = useRef<AbortController | null>(null);
  const dates = monthDates(day), { from, to } = calendarRange(dates);
  const key = `${clubId}:${userId}:${from}:${to}`, selected = calendarDate(day);
  const result = state?.key === key ? state : null;
  const entries = result?.entries ?? [];
  const grouped = groupCalendarEntries(entries, filter), agenda = grouped.get(selected) ?? [];
  const detail = typeof dialog === "object" && dialog ? entries.find(item => item.kind === "event" && item.id === dialog.id) : null;
  const refresh = useCallback(() => setRevision(value => value + 1), []);
  const labelDate = (value: Date, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale, options).format(value);
  const fullDate = (value: Date) => labelDate(value, { weekday: "long", month: "long", day: "numeric" });
  const time = (item: CalendarEntry) => labelDate(new Date(item.starts_at), { hour: "2-digit", minute: "2-digit" });
  const count = (n: number) => n === 1 ? s.one : s.many.replace("{count}", n.toLocaleString(locale));

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort("timeout"), 18000);
    let current = true;
    const query = new URLSearchParams({ clubId, actorId: userId, from, to });
    void (async () => {
      try {
        const r = await fetch("/api/clubs/calendar?" + query, { cache: "no-store", credentials: "same-origin", signal: controller.signal });
        if (!current) return;
        if (r.status === 403 || r.status === 401) { onAccessLost(r.status === 401); return; }
        const data = await r.json();
        if (!current) return;
        if (r.ok && data.userId !== userId) { onAccessLost(true); return; }
        if (!r.ok || !Array.isArray(data.entries)) throw Error();
        setState({ key, entries: data.entries });
      } catch {
        if (current) setState({ key, entries: [], error: true });
      } finally { window.clearTimeout(timeout); }
    })();
    return () => { current = false; controller.abort(); window.clearTimeout(timeout); };
  }, [key, clubId, userId, from, to, revision, onAccessLost]);
  useEffect(() => {
    const verify = () => { if (document.visibilityState === "visible") refresh(); };
    const timer = window.setInterval(verify, 30000);
    window.addEventListener("focus", verify);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", verify); inflight.current?.abort(); inflight.current = null; };
  }, [refresh]);
  useEffect(() => {
    if (!dialog) panel.current?.close();
    else if (dialog === "create" || detail) panel.current?.showModal();
    else { panel.current?.close(); setDialog(null); }
  }, [dialog, detail]);

  function open(value: NonNullable<typeof dialog>, trigger: HTMLElement) {
    origin.current = trigger;
    setKind("ride");
    setIssue(undefined);
    attempt.current = null;
    setDialog(value);
  }

  function close() {
    if (inflight.current) return;
    setDialog(null);
    origin.current?.focus();
  }

  async function submit(form: FormEvent<HTMLFormElement>) {
    form.preventDefault();
    if (inflight.current || kind !== "event") return;
    const data = new FormData(form.currentTarget);
    const value = (name: string) => String(data.get(name) ?? "");
    const event = attempt.current ?? calendarEventInput(crypto.randomUUID(), {
      title: value("title"), date: value("date"), time: value("time"), place: value("place"), description: value("description"),
    });
    if (!event) { setIssue("invalid"); return; }
    attempt.current = event;
    const controller = new AbortController();
    inflight.current = controller;
    setBusy(true);
    setIssue(undefined);
    const timer = window.setTimeout(() => controller.abort(), 18000);
    try {
      const r = await fetch("/api/clubs/calendar", {
        method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store", credentials: "same-origin",
        body: JSON.stringify({ clubId, actorId: userId, event }), signal: controller.signal,
      });
      if (inflight.current !== controller) return;
      if (r.status === 401 || r.status === 403) { onAccessLost(r.status === 401); return; }
      const data = await r.json();
      if (inflight.current !== controller) return;
      if (r.ok && data.userId !== userId) { onAccessLost(true); return; }
      if (!r.ok && [400, 409].includes(r.status)) { attempt.current = null; setIssue(r.status === 400 ? "invalid" : "saveError"); return; }
      if (!r.ok || data.id !== event.id) throw Error();
      setDay(new Date(event.startsAt));
      setFilter("all");
      setMessage(true);
      setDialog(null);
      refresh();
    } catch { if (inflight.current === controller) setIssue("uncertain"); }
    finally { window.clearTimeout(timer); if (inflight.current === controller) { inflight.current = null; setBusy(false); } }
  }

  function location(item: CalendarEntry) {
    const distance = item.distance_km == null ? "" : new Intl.NumberFormat(locale, { maximumFractionDigits: 1 })
      .format(item.distance_km * (miles ? 0.621371 : 1)) + (miles ? " mi" : " km");
    return [item.place, distance].filter(Boolean).join(" · ");
  }

  return <section className="club-calendar" aria-label={s.title}>
    <div className="club-calendar-header"><h2>{s.title}</h2>
      <button type="button" className="club-calendar-primary" disabled={!result || result.error}
        onClick={event => open("create", event.currentTarget)}><CalendarIcon icon="plus" size={17} />{s.create}</button>
    </div>
    <div className="club-calendar-toolbar">
      <div className="club-calendar-period">
        <button type="button" aria-label={s.previousMonth} onClick={() => setDay(nextCalendarDate(day, -1, false))}><CalendarIcon icon="previous" size={16}/></button>
        <h3>{labelDate(day, { month: "long", year: "numeric" })}</h3>
        <button type="button" aria-label={s.nextMonth} onClick={() => setDay(nextCalendarDate(day, 1, false))}><CalendarIcon icon="next" size={16}/></button>
      </div>
      <div className="club-calendar-filters" role="group" aria-label={s.title}>
        {filters.map(value => <button key={value} type="button" aria-pressed={value === filter} onClick={() => setFilter(value)}>
          {s[value === "all" ? "all" : value === "ride" ? "rides" : "events"]}
        </button>)}
      </div>
    </div>
    <div className="club-calendar-body">
      <div className="club-calendar-grid">
        {dates.slice(0, 7).map((date, i) => <span key={i} className="club-calendar-weekday" aria-hidden="true">{labelDate(date, { weekday: "short" })}</span>)}
        {dates.map(date => {
          const id = calendarDate(date), items = grouped.get(id) ?? [];
          return <button key={id} type="button" className="club-calendar-day" data-day={id} data-outside={date.getMonth() !== day.getMonth()}
            aria-label={fullDate(date) + ", " + count(items.length)} aria-pressed={id === selected}
            onClick={() => { setDay(date); setMessage(false); }}>
            <span className="club-calendar-number">{date.getDate()}</span>
            {items.slice(0, 2).map(item => <span className="club-calendar-mark" data-kind={item.kind} key={item.kind + item.id} aria-hidden="true">{item.title}</span>)}
            {items.length > 2 ? <span className="club-calendar-overflow">+{items.length - 2}</span> : null}
            <span className="club-calendar-dots" aria-hidden="true">{filters.slice(1).filter(k => items.some(i => i.kind === k)).map(k => <i data-kind={k} key={k} />)}</span>
          </button>;
        })}
      </div>
      <section className="club-calendar-agenda">
        <header><h3>{fullDate(day)}</h3>{result && !result.error ? <p>{count(agenda.length)}</p> : null}</header>
        {!result ? <p role="status">{s.loading}</p> : result.error ? <div className="club-calendar-empty" role="alert">{s.error} <button type="button" onClick={refresh}>{s.retry}</button></div> :
          !agenda.length ? <p>{s.empty}</p> : agenda.map(item => {
            const body = <><time dateTime={item.starts_at}>{time(item)}</time>
              <span className="club-calendar-item"><span className="club-calendar-kind" data-kind={item.kind}>
                {item.kind === "ride" ? <CalendarIcon icon="bike" size={14}/> : <CalendarIcon icon="calendar" size={14}/>} {s[item.kind]}
              </span><strong>{item.title}</strong>{location(item) ? <small>{location(item)}</small> : null}</span>
              <CalendarIcon icon="next" size={15}/></>;
            return item.kind === "ride" ?
              <Link key={"ride" + item.id} className="club-calendar-entry" prefetch={false} href={clubRideHref(locale, clubId, item.id) + "&date=" + selected}>{body}</Link> :
              <button type="button" key={"event" + item.id} className="club-calendar-entry" onClick={event => open({ id: item.id }, event.currentTarget)}>{body}</button>;
          })}
      </section>
    </div>
    {message ? <p className="club-calendar-notice" role="status">{s.saved}</p> : null}
    <dialog ref={panel} className="club-calendar-dialog" aria-labelledby="club-calendar-dialog-title"
      onCancel={event => { event.preventDefault(); close(); }} onClose={() => origin.current?.focus()}>
      {dialog && <div className="club-calendar-dialog-body">
        <div className="club-calendar-header"><h3 id="club-calendar-dialog-title">{dialog === "create" ? s.createHeading : detail?.title}</h3>
          <button type="button" aria-label={s.close} className="club-calendar-close" disabled={busy} onClick={close}><CalendarIcon icon="close" size={18}/></button>
        </div>
        {dialog === "create" ?
          <form onSubmit={submit} className="club-calendar-form">
            <fieldset className="club-calendar-choice" disabled={busy || issue === "uncertain"}><legend>{s.type}</legend>
              {(["ride", "event"] as const).map(value => <label key={value}><input type="radio" name="kind" checked={kind === value} onChange={() => setKind(value)}/>
                {value === "ride" ? <CalendarIcon icon="bike" size={15}/> : <CalendarIcon icon="calendar" size={15}/>} {s[value]}
              </label>)}
            </fieldset>
            <fieldset className="club-calendar-event-fields" hidden={kind !== "event"} disabled={kind !== "event" || busy || issue === "uncertain"}>
              <label>{s.name}<input name="title" required /></label>
              <div className="club-calendar-date-row">
                <label>{s.date}<input name="date" type="date" required defaultValue={selected}/></label>
                <label>{s.time}<input name="time" type="time" required defaultValue="09:00"/></label>
              </div>
              <label>{s.place}<input name="place" required /></label>
              <label>{s.description}<textarea name="description" rows={2}/></label>
            </fieldset>{kind === "ride" ? <p>{fullDate(day)}</p> : null}
            {issue ? <p role="alert">{s[issue]}</p> : null}
            <footer><small><CalendarIcon icon="lock" size={13}/> {s.private}</small>
              {kind === "ride" ? <Link prefetch={false} className="club-calendar-primary"
                href={clubRideHref(locale, clubId) + "/new?date=" + selected}>{s.createRide}</Link> :
                <button type="submit" disabled={busy} className="club-calendar-primary">{busy ? s.loading : issue === "uncertain" ? s.retry : s.createEvent}</button>}
            </footer>
          </form> : detail ? <div className="club-calendar-details">
            <span className="club-calendar-kind" data-kind="event"><CalendarIcon icon="calendar" size={16}/> {s.event}</span>
            <p><CalendarIcon icon="time" size={16}/> {fullDate(new Date(detail.starts_at))} · {time(detail)}</p>
            {detail.place ? <p><CalendarIcon icon="pin" size={16}/> {detail.place}</p> : null}
            {detail.description ? <p className="club-calendar-description">{detail.description}</p> : null}
          </div> : null}
      </div>}
    </dialog>
  </section>;
}
