"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { getLocaleTag } from "@/lib/app-format";
import type { StatusHistoryRide, UnitSystem } from "@/lib/app-model";
import { buildStatusCalendar, buildStatusCalendarReturnPath, buildStatusCalendarRidePath, type StatusMetric, type StatusRange } from "@/lib/app-status";
import {
  formatStatusCalendarRideStats,
  formatStatusCalendarRideTitle,
  formatStatusDiscipline,
  formatStatusRideClock,
  statusText
} from "@/lib/status-format";
import type { Locale } from "@/lib/locales";

function shiftedMonth(year: number, month: number, delta: number) {
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}

export function StatusCalendar({
  history,
  locale,
  timeZone,
  now,
  initialYear,
  initialMonth,
  range,
  metric,
  unitSystem
}: {
  history: StatusHistoryRide[];
  locale: Locale;
  timeZone: string;
  now: Date;
  initialYear: number;
  initialMonth: number;
  range: StatusRange;
  metric: StatusMetric;
  unitSystem: UnitSystem;
}) {
  const router = useRouter();
  const [visible, setVisible] = useState({ year: initialYear, month: initialMonth });
  const [selectedRides, setSelectedRides] = useState<StatusHistoryRide[] | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const days = buildStatusCalendar(history, visible.year, visible.month, now, timeZone);
  const localeTag = getLocaleTag(locale);
  const monthLabel = new Intl.DateTimeFormat(localeTag, { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(visible.year, visible.month - 1, 1)));
  const weekdays = Array.from({ length: 7 }, (_, index) => new Intl.DateTimeFormat(localeTag, { weekday: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2024, 0, 1 + index))));
  const fullDate = (dateKey: string) => {
    const [year, month, day] = dateKey.split("-").map(Number);
    return new Intl.DateTimeFormat(localeTag, { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, day)));
  };
  const closeDialog = useCallback(() => {
    setSelectedRides(null);
    const trigger = triggerRef.current;
    requestAnimationFrame(() => {
      if (trigger?.isConnected) trigger.focus();
    });
  }, []);
  const changeMonth = (delta: number) => {
    const next = shiftedMonth(visible.year, visible.month, delta);
    setVisible(next);
    setSelectedRides(null);
    router.replace(buildStatusCalendarReturnPath(locale, { ...next, range, metric }), { scroll: false });
  };

  useEffect(() => {
    if (!selectedRides || selectedRides.length <= 1) return;
    const dialog = dialogRef.current;
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDialog();
        return;
      }
      if (event.key !== "Tab" || !dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled]):not([tabindex="-1"]),a[href]'));
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    dialog?.addEventListener("keydown", handleKeyDown);
    return () => dialog?.removeEventListener("keydown", handleKeyDown);
  }, [closeDialog, selectedRides]);

  return (
    <>
      <div className="bike-app-activity-calendar">
        <header>
          <button type="button" aria-label={statusText(locale, "status.previousMonth")} onClick={() => changeMonth(-1)}>‹</button>
          <strong aria-live="polite">{monthLabel}</strong>
          <button type="button" aria-label={statusText(locale, "status.nextMonth")} onClick={() => changeMonth(1)}>›</button>
        </header>
        <div className="bike-app-calendar-weekdays" aria-hidden="true">{weekdays.map((day) => <span key={day}>{day}</span>)}</div>
        <div className="bike-app-calendar-grid">
          {days.map((day) => {
            const count = day.rides.length;
            const calendarOrigin = { year: visible.year, month: visible.month, range, metric };
            const template = count === 1 ? "status.calendarDayRideSingular" : "status.calendarDayRidePlural";
            const dateLabel = count > 0
              ? statusText(locale, template, { day: fullDate(day.dateKey), count })
              : fullDate(day.dateKey);
            const label = day.isToday ? `${statusText(locale, "status.today")}: ${dateLabel}` : dateLabel;
            const content = <><span>{day.day}</span>{count > 0 ? <i aria-hidden="true" /> : null}{count > 1 ? <b aria-hidden="true">{count > 9 ? "9+" : count}</b> : null}</>;
            if (day.inMonth && count === 1) {
              return <Link key={day.dateKey} href={buildStatusCalendarRidePath(locale, day.rides[0].id, calendarOrigin)} aria-label={label} data-in-month={day.inMonth} data-rides="true" data-today={day.isToday}>{content}</Link>;
            }
            return (
              <button
                key={day.dateKey}
                type="button"
                aria-label={label}
                disabled={!day.inMonth || count === 0}
                data-in-month={day.inMonth}
                data-rides={day.inMonth && count > 0}
                data-today={day.isToday}
                onClick={(event) => {
                  triggerRef.current = event.currentTarget;
                  setSelectedRides(day.rides);
                }}
              >{content}</button>
            );
          })}
        </div>
      </div>
      {selectedRides && selectedRides.length > 1 ? (
        <div ref={dialogRef} className="bike-app-status-modal" role="dialog" aria-modal="true" aria-labelledby="status-day-rides-title">
          <button className="bike-app-status-modal-backdrop" type="button" tabIndex={-1} aria-hidden="true" onClick={closeDialog} />
          <section>
            <header><h3 id="status-day-rides-title">{statusText(locale, "status.ridesThisDay")}</h3><button ref={closeButtonRef} type="button" aria-label={statusText(locale, "common.close")} onClick={closeDialog}>×</button></header>
            <div className="bike-app-status-day-rides">
              {selectedRides.map((ride) => {
                const title = formatStatusCalendarRideTitle(locale, ride.title, ride.distanceKm, unitSystem);
                const clock = formatStatusRideClock(locale, ride.startedAt, timeZone);
                const discipline = formatStatusDiscipline(locale, ride.discipline);
                const stats = formatStatusCalendarRideStats(locale, ride.distanceKm, ride.durationMinutes, unitSystem);
                return (
                  <Link
                    key={ride.id}
                    href={buildStatusCalendarRidePath(locale, ride.id, { year: visible.year, month: visible.month, range, metric })}
                    aria-label={`${title}. ${clock}. ${discipline}. ${stats}`}
                  >
                    <strong className="bike-app-status-ride-title">{title}</strong>
                    <span className="bike-app-status-ride-meta">{clock} • {discipline}</span>
                    <small className="bike-app-status-ride-value">{stats}</small>
                  </Link>
                );
              })}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
