"use client";

import { useEffect, useRef } from "react";

import { getAppDictionary } from "@/lib/app-i18n";
import { validateReportDetail } from "@/lib/clubs/content-contract";
import { contentText } from "@/lib/clubs/content-i18n";
import { galleryText } from "@/lib/clubs/gallery-i18n";
import type { Locale } from "@/lib/locales";

export type ClubReportFields = {
  destination: "club" | "bikeMe";
  reason: "spam" | "harassment" | "unsafe" | "other";
  detail: string;
};

export function ClubReportForm({ locale, value, locked, onChange, onSubmit, onCancel, photo = false }: {
  locale: Locale;
  value: ClubReportFields;
  locked: boolean;
  photo?: boolean;
  onChange: (change: ClubReportFields) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const t = getAppDictionary(locale);
  const ct = (key: Parameters<typeof contentText>[1]) => contentText(locale, key);
  const select = useRef<HTMLSelectElement>(null);
  useEffect(() => { select.current?.focus({ preventScroll: true }); }, []);
  let valid = true;
  try { validateReportDetail(value.detail); } catch { valid = false; }
  const clubLabel = photo ? galleryText(locale, "reportClub") : ct("clubReport");
  const supportLabel = photo ? galleryText(locale, "reportSupport") : ct("bikeMeReport");

  return <form onSubmit={event => { event.preventDefault(); if (!locked && valid) onSubmit(); }}>
    <fieldset disabled={locked} className="bike-app-club-form-fields">
      <label className="bike-app-field"><span>{ct("report")}</span>
        <select ref={select} value={value.destination} onChange={event => onChange({
          ...value, destination: event.target.value as ClubReportFields["destination"],
        })}>
          <option value="club">{clubLabel}</option>
          <option value="bikeMe">{supportLabel}</option>
        </select>
      </label>
      <p className="bike-app-content-privacy">{ct(value.destination === "club" ? "privacyClub" : "privacyBikeMe")}</p>
      <label className="bike-app-field"><span>{ct("reason")}</span>
        <select value={value.reason} onChange={event => onChange({
          ...value, reason: event.target.value as ClubReportFields["reason"],
        })}>
          {(["spam", "harassment", "unsafe", "other"] as const).map(reason => <option key={reason} value={reason}>{ct(reason)}</option>)}
        </select>
      </label>
      <label className="bike-app-field"><span>{ct("detail")}</span>
        <textarea rows={3} value={value.detail} onChange={event => onChange({ ...value, detail: event.target.value })} />
      </label>
      <p className="bike-app-muted">{ct("counter").replace("{count}", String(Array.from(value.detail).length)).replace("{max}", "500")}</p>
    </fieldset>
    <div className="bike-app-actions">
      <button className="bike-app-button" disabled={locked || !valid}>{value.destination === "club" ? clubLabel : supportLabel}</button>
      <button type="button" className="bike-app-button bike-app-button-secondary" disabled={locked} onClick={onCancel}>{t("common.cancel")}</button>
    </div>
  </form>;
}
