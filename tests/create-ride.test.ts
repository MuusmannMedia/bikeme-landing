import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  buildRideNowTitle,
  distanceFromKilometers,
  distanceToKilometers,
  getNextRoundedTenMinuteTimeValue,
  getRideNowTitleInputMaxLength,
  getRideMoodOptions,
  getRideTitleSuggestions,
  getTenMinuteTimeOptions,
  isRideMoodKey,
  resolveFreeMeetingLocation,
  resolveExactRideNowStart,
  resolveRideSchedule,
  rideMoodKeys,
  rideNowDurationMinutes,
  rideNowStartOffsets,
  rideTitleMaxLength
} from "../lib/create-ride";
import {
  GpxImportError,
  gpxImportMaxFileBytes,
  gpxImportMaxPoints,
  parseGpxText,
  parseSerializedPlannedRoute,
  serializePlannedRoute
} from "../lib/gpx-import";

const projectFile = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

test("RIDE NOW relative starts use the mobile offsets and fixed duration", () => {
  const now = new Date("2026-08-22T10:00:00.000Z");
  assert.deepEqual(rideNowStartOffsets, [10, 20, 30, 45, 60, 90]);
  const result = resolveRideSchedule({ type: "PING", startMode: "OM", startOffsetMinutes: 45 }, now);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.startTime.toISOString(), "2026-08-22T10:45:00.000Z");
  assert.equal(result.durationMinutes, rideNowDurationMinutes);
  assert.equal(result.durationMinutes, 120);

  assert.deepEqual(
    resolveRideSchedule({ type: "PING", startMode: "OM", startOffsetMinutes: 15 }, now),
    { ok: false, error: "INVALID_START" }
  );
});

test("RIDE NOW exact time rolls elapsed clock values to tomorrow", () => {
  const now = new Date(2026, 7, 22, 14, 5, 30, 0);
  const today = resolveExactRideNowStart("14:10", now);
  const tomorrow = resolveExactRideNowStart("14:00", now);
  assert.ok(today);
  assert.ok(tomorrow);
  assert.equal(today.getDate(), 22);
  assert.equal(today.getHours(), 14);
  assert.equal(today.getMinutes(), 10);
  assert.equal(tomorrow.getDate(), 23);
  assert.equal(tomorrow.getHours(), 14);
  assert.equal(tomorrow.getMinutes(), 0);
  assert.equal(resolveExactRideNowStart("24:00", now), null);

  const scheduled = resolveRideSchedule({ type: "PING", startMode: "KL", startTimeIso: today.toISOString() }, now);
  assert.equal(scheduled.ok, true);
  if (scheduled.ok) assert.equal(scheduled.durationMinutes, 120);
  assert.deepEqual(
    resolveRideSchedule({ type: "PING", startMode: "KL", startTimeIso: new Date(now.getTime() - 1).toISOString() }, now),
    { ok: false, error: "START_NOT_FUTURE" }
  );
  assert.deepEqual(
    resolveRideSchedule({ type: "PING", startMode: "KL", startTimeIso: new Date(now.getTime() + 27 * 60 * 60_000).toISOString() }, now),
    { ok: false, error: "INVALID_START" }
  );
});

test("planned rides require a future start and a positive duration", () => {
  const now = new Date("2026-08-22T10:00:00.000Z");
  const valid = resolveRideSchedule({
    type: "EVENT",
    startTimeIso: "2026-08-22T12:00:00.000Z",
    durationHours: 2.5
  }, now);
  assert.equal(valid.ok, true);
  if (valid.ok) assert.equal(valid.durationMinutes, 150);

  assert.deepEqual(resolveRideSchedule({
    type: "EVENT",
    startTimeIso: "2026-08-22T09:59:59.000Z",
    durationHours: 2
  }, now), { ok: false, error: "START_NOT_FUTURE" });
  assert.deepEqual(resolveRideSchedule({
    type: "EVENT",
    startTimeIso: "2026-08-22T12:00:00.000Z",
    durationHours: 0
  }, now), { ok: false, error: "INVALID_DURATION" });
  assert.deepEqual(resolveRideSchedule({
    type: "EVENT",
    startTimeIso: "2026-08-22T12:00:00.000Z",
    durationHours: Number.MAX_VALUE
  }, now), { ok: false, error: "INVALID_DURATION" });
});

test("mobile clock and structured title/mood options are reproduced", () => {
  assert.equal(getNextRoundedTenMinuteTimeValue(new Date(2026, 7, 22, 14, 0, 30)), "14:10");
  assert.equal(getNextRoundedTenMinuteTimeValue(new Date(2026, 7, 22, 14, 59, 30)), "15:00");
  const clockOptions = getTenMinuteTimeOptions();
  assert.equal(clockOptions.length, 144);
  assert.equal(clockOptions[0], "00:00");
  assert.equal(clockOptions.at(-1), "23:50");

  assert.equal(rideMoodKeys.length, 10);
  assert.equal(getRideMoodOptions("da")[0].label, "Hurtigt rul med kort opvarmning.");
  assert.equal(getRideTitleSuggestions("da")[0], "Hurtig tur i dag");
  assert.equal(getRideTitleSuggestions("en").length, 10);
  rideMoodKeys.forEach((key) => assert.equal(isRideMoodKey(key), true));
  assert.equal(isRideMoodKey("free text"), false);
});

test("create-ride distance input follows profile units and normalizes storage to kilometers", () => {
  assert.equal(distanceToKilometers(100, "metric"), 100);
  assert.equal(distanceToKilometers(10, "imperial"), 16.09344);
  assert.ok(Math.abs(distanceFromKilometers(100, "imperial") - 62.137119) < 0.000001);
  assert.equal(buildRideNowTitle("Fast ride today", 65, "metric"), "65 km • Fast ride today");
  assert.equal(buildRideNowTitle("Fast ride today", 65, "imperial"), "40.4 mi • Fast ride today");
  assert.equal(
    getRideNowTitleInputMaxLength(40.4, "imperial"),
    rideTitleMaxLength - "40.4 mi • ".length
  );
});

test("free meeting points validate coordinates and use the mobile coordinate fallback", () => {
  assert.deepEqual(resolveFreeMeetingLocation({
    latitude: 55.676098,
    longitude: 12.568337,
    address: "  Rådhuspladsen 1  "
  }), {
    latitude: 55.676098,
    longitude: 12.568337,
    address: "Rådhuspladsen 1"
  });
  assert.deepEqual(resolveFreeMeetingLocation({
    latitude: 55.676098,
    longitude: 12.568337,
    address: ""
  }), {
    latitude: 55.676098,
    longitude: 12.568337,
    address: "55.67610, 12.56834"
  });
  assert.equal(resolveFreeMeetingLocation({ latitude: 91, longitude: 12, address: null }), null);
  assert.equal(resolveFreeMeetingLocation({ latitude: 55, longitude: -181, address: null }), null);
  assert.equal(resolveFreeMeetingLocation({ latitude: null, longitude: 12, address: null }), null);
  assert.equal(resolveFreeMeetingLocation({ latitude: 55, longitude: 12, address: "x".repeat(501) }), null);
});

test("GPX import matches the mobile limits, normalization and server contract", () => {
  const route = parseGpxText(`<?xml version="1.0"?><gpx><trk><trkseg>
    <trkpt lat="55.1" lon="12.1"></trkpt>
    <trkpt lat="55.1" lon="12.1"></trkpt>
    <trkpt lat="55.2" lon="12.3"></trkpt>
  </trkseg></trk></gpx>`, { fileName: "route.gpx", fileSizeBytes: 180 });
  assert.equal(gpxImportMaxFileBytes, 3 * 1024 * 1024);
  assert.equal(gpxImportMaxPoints, 5000);
  assert.equal(route.pointCount, 2);
  assert.deepEqual(route.bounds, {
    min_latitude: 55.1,
    max_latitude: 55.2,
    min_longitude: 12.1,
    max_longitude: 12.3
  });
  assert.deepEqual(parseSerializedPlannedRoute(serializePlannedRoute(route)), route);
  assert.equal(parseSerializedPlannedRoute("not json"), false);
  assert.equal(parseSerializedPlannedRoute(null), null);

  const routeOnly = parseGpxText('<gpx><rte><rtept lat="1" lon="2"></rtept><rtept lat="3" lon="4"></rtept></rte></gpx>');
  assert.equal(routeOnly.pointCount, 2);
  assert.throws(
    () => parseGpxText("<gpx></gpx>"),
    (error) => error instanceof GpxImportError && error.code === "ROUTE_TOO_SHORT"
  );
  assert.throws(
    () => parseGpxText('<gpx><trkpt lat="1" lon="2"></trkpt><trkpt lat="3" lon="4"></trkpt></gpx>', { fileSizeBytes: gpxImportMaxFileBytes + 1 }),
    (error) => error instanceof GpxImportError && error.code === "FILE_TOO_LARGE"
  );
});

test("create-ride UI and action wire errors, pending protection and conditional payloads", () => {
  const page = projectFile("app/[locale]/app/rides/new/page.tsx");
  const form = projectFile("components/create-ride-form.tsx");
  const styles = projectFile("app/globals.css");
  const actions = projectFile("app/[locale]/app/actions.ts");
  const data = projectFile("lib/app-data.ts");
  const meetingMap = projectFile("components/meeting-point-map.tsx");
  const requestsPage = projectFile("app/[locale]/app/requests/page.tsx");

  assert.ok(page.includes("notice={query.notice}"));
  assert.ok(form.includes("useFormState<CreateRideActionState, FormData>"));
  assert.ok(form.includes("action={formAction}"));
  assert.ok(form.includes("actionState.notice ?? notice"));
  assert.ok(form.includes("useFormStatus()"));
  assert.ok(form.includes("clickedRef.current"));
  assert.ok(form.includes("disabled={isPending}"));
  assert.ok(form.includes('name="createRequestId"'));
  assert.ok(page.includes("createRequestId={crypto.randomUUID()}"));
  assert.ok(form.includes('mode === "PING"'));
  assert.ok(form.includes('name="durationHours"'));
  assert.ok(form.includes('name="distance"'));
  assert.ok(form.includes("value={distanceValue}"));
  assert.ok(form.includes("value={discipline}"));
  assert.ok(form.includes("value={durationHours}"));
  assert.ok(form.includes("value={moodKey}"));
  assert.ok(form.includes("value={description}"));
  assert.ok(form.includes("required"));
  assert.ok(form.includes('className="bike-app-form-grid bike-app-create-fields"'));
  assert.ok(form.includes('className="bike-app-create-start"'));
  assert.ok(form.includes('className="bike-app-create-schedule"'));
  assert.ok(styles.includes(".bike-app-create-schedule { display: grid; grid-column: 1 / -1;"));
  assert.ok(styles.includes(".bike-app-create-schedule { grid-column: auto; grid-template-columns: 1fr; }"));
  assert.ok(form.includes("getRideMoodOptions(locale)"));
  assert.equal(form.includes('value="CITY"'), false);
  assert.equal(form.includes('name="maxParticipants"'), false);
  assert.ok(actions.includes("resolveRideSchedule({"));
  assert.ok(actions.includes('schedule.error === "START_NOT_FUTURE"'));
  assert.ok(actions.includes("schedule.durationMinutes"));
  assert.ok(actions.includes("isRideMoodKey(moodKey)"));
  assert.ok(actions.includes("distanceToKilometers(distanceValue, unitSystem)"));
  assert.ok(actions.includes("buildRideNowTitle(input.title, input.distanceKm, unitSystem)"));
  assert.ok(actions.includes("storedTitle.length > rideTitleMaxLength"));
  assert.ok(actions.includes("id: createRequestId"));
  assert.ok(actions.includes('error?.code === "23505"'));
  assert.ok(actions.includes("loadOwnedRideId(context, createRequestId)"));
  assert.ok(actions.includes("existingRide?.id"));
  assert.ok(actions.includes("allowedCreateDisciplines"));
  assert.ok(data.includes("export async function listInviteableRiders"));
  assert.ok(page.includes("listInviteableRiders(client, viewer.userId)"));
  assert.ok(form.includes('type="search"'));
  assert.ok(form.includes('name="inviteeIds"'));
  assert.ok(form.includes('setVisibility(next.length > 0 ? "private" : "public")'));
  assert.ok(form.includes("selectedInviteeIds.includes(rider.id)"));
  assert.ok(actions.includes("validateCreateRideInvitees(context, inviteeIds)"));
  assert.ok(actions.includes('from("ride_invites").upsert'));
  assert.ok(actions.includes('"notify_ride_invite"'));
  assert.ok(actions.includes('"createdInviteError"'));
  assert.ok(form.includes("parseGpxText(xml"));
  assert.ok(form.includes('name="plannedRoute"'));
  assert.ok(form.includes("<RoutePreview"));
  assert.ok(actions.includes("parseSerializedPlannedRoute"));
  assert.ok(actions.includes('from("ride_planned_routes").upsert'));
  assert.ok(actions.includes('"createdRouteInviteError"'));
  assert.ok(form.includes('name="meetingMode"'));
  assert.ok(form.includes('name="meetingLatitude"'));
  assert.ok(form.includes("<MeetingPointMap"));
  assert.ok(meetingMap.includes('map.on("click"'));
  assert.ok(meetingMap.includes("navigator.geolocation.getCurrentPosition"));
  assert.ok(actions.includes("resolveFreeMeetingLocation({"));
  assert.ok(actions.includes('hotspot_id: meetingMode === "hotspot" ? hotspotId : null'));
  assert.ok(data.includes("latitude,longitude,region_label"));
  assert.equal(requestsPage.includes("<option>CITY</option>"), false);
  assert.ok(actions
    .slice(actions.indexOf("export async function convertRideInterestAction"))
    .includes("!allowedCreateDisciplines.has(discipline)"));
});
