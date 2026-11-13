import Link from "next/link";
import { clubRideHref } from "@/lib/clubs/ride-contract";
import { clubRideText } from "@/lib/clubs/ride-i18n";

import { formatDateTime, formatDistance } from "@/lib/app-format";
import type { AppTextKey } from "@/lib/app-i18n";
import type { RideSummary, UnitSystem } from "@/lib/app-model";
import type { Locale } from "@/lib/locales";

export function RideCard({ ride, locale, units, t, invited=false }: { invited?:boolean; ride: RideSummary; locale: Locale; units: UnitSystem; t: (key: AppTextKey) => string }) {
  return (
    <article className="bike-app-panel bike-app-ride-card">
      <div className="bike-app-actions">
        <span className="bike-app-chip">{ride.type === "PING" ? t("rides.rideNow") : t("rides.planned")}</span>
        <span className="bike-app-chip" data-tone="purple">{t(ride.visibility === "private" ? "common.private" : "common.public")}</span>
      </div>
      {ride.clubId ? <span className="bike-app-chip" data-tone="purple">{clubRideText(locale, "title")}</span> : null}
      {invited ? <p className="bike-app-muted">{clubRideText(locale,"invitation")}</p> : null}
      <h2>{ride.title}</h2>
      <p className="bike-app-muted">{formatDateTime(locale, ride.startTime)}</p>
      <dl className="bike-app-definition">
        <div><dt>{t("rides.discipline")}</dt><dd>{ride.clubId?t(ride.discipline==="ROAD"?"discipline.road":ride.discipline==="GRAVEL"?"discipline.gravel":ride.discipline==="MTB"?"discipline.mtb":"discipline.city"):ride.discipline}</dd></div>
        <div><dt>{t("rides.distance")}</dt><dd>{formatDistance(locale, ride.distanceKm, units)}</dd></div>
        <div><dt>{t("common.participants")}</dt><dd>{ride.participantCount}{ride.maxParticipants ? ` / ${ride.maxParticipants}` : ""}</dd></div>
        <div><dt>{t("common.host")}</dt><dd>{ride.hostName ?? "Bike Me"}</dd></div>
      </dl>
      {ride.meetingAddress ? <p className="bike-app-muted bike-app-ride-address">{ride.meetingAddress}</p> : null}
      <Link className="bike-app-button bike-app-button-secondary" href={ride.clubId ? clubRideHref(locale, ride.clubId, ride.id) : `/${locale}/app/rides/${ride.id}`}>{t("common.view")}</Link>
    </article>
  );
}
