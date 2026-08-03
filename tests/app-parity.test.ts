import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { createViewerAccess, hasProAccess } from "../lib/app-access";
import { trimRouteForPrivacy } from "../lib/app-format";
import { appTranslationKeys, appTranslationLocales, getAppTranslationRow } from "../lib/app-i18n";
import type { RideHistorySummary } from "../lib/app-model";
import { buildStatusSummary, getStatusWindow, statusRanges } from "../lib/app-status";
import { buildGpx } from "../lib/gpx";
import { locales } from "../lib/locales";

const projectFile = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

function filesBelow(path: string): string[] {
  return readdirSync(path).flatMap((name) => {
    const absolute = join(path, name);
    return statSync(absolute).isDirectory() ? filesBelow(absolute) : [absolute];
  });
}

test("authenticated app strings are complete for exactly seven locales", () => {
  assert.deepEqual(appTranslationLocales, locales);
  assert.ok(appTranslationKeys.length >= 100);
  for (const key of appTranslationKeys) {
    const row = getAppTranslationRow(key);
    assert.equal(row.length, 7, key);
    row.forEach((value, index) => {
      assert.equal(typeof value, "string", `${key}:${appTranslationLocales[index]}`);
      assert.ok(value.trim().length > 0, `${key}:${appTranslationLocales[index]}`);
    });
  }
});

test("Basic and Pro access matches mobile access semantics", () => {
  assert.equal(hasProAccess("basic", null), false);
  assert.equal(hasProAccess("premium", null), true);
  assert.equal(hasProAccess("tester_premium", null), true);
  assert.equal(hasProAccess("founding_rider", null), true);
  assert.equal(hasProAccess("founding_rider", "2000-01-01T00:00:00.000Z"), false);
  assert.equal(createViewerAccess("unknown", null, false).level, "basic");
});

test("status periods use the same day windows and bucket counts as mobile", () => {
  const now = new Date(2026, 7, 2, 12, 0, 0);
  const expectedCounts = [7, 6, 12, 12, 8, 12];
  statusRanges.forEach((range, index) => {
    const window = getStatusWindow(range, now);
    assert.equal(window.bucketCount, expectedCounts[index]);
    assert.ok(window.end > window.start);
  });
});

test("status totals and previous-period comparison use only stored ride values", () => {
  const now = new Date(2026, 7, 2, 12, 0, 0);
  const ride = (startedAt: Date, distanceKm: number): RideHistorySummary => ({
    id: startedAt.toISOString(), startedAt: startedAt.toISOString(), title: "Ride", discipline: "ROAD",
    startAddress: null, distanceKm, durationMinutes: 60, elevationGain: 100, averageWatts: null,
    maxWatts: null, caloriesKcal: null, participantCount: 1
  });
  const summary = buildStatusSummary([
    ride(new Date(2026, 7, 1, 12), 20),
    ride(new Date(2026, 6, 25, 12), 10)
  ], "7D", "distance", "en", now);
  assert.equal(summary.totals.distanceKm, 20);
  assert.equal(summary.totals.durationMinutes, 60);
  assert.equal(summary.totals.rideCount, 1);
  assert.equal(summary.comparisonPercent, 100);
});

test("route privacy trims the same five percent from both ends as mobile", () => {
  const points = Array.from({ length: 100 }, (_, index) => ({
    latitude: 55 + index / 1000,
    longitude: 12 + index / 1000,
    recordedAt: null,
    elevation: null,
    startsNewSegment: false
  }));
  const trimmed = trimRouteForPrivacy(points, true);
  assert.equal(trimmed.length, 90);
  assert.equal(trimmed[0], points[5]);
  assert.equal(trimmed.at(-1), points[94]);
  assert.equal(trimRouteForPrivacy(points, false), points);
});

test("GPX export validates route length, escapes titles and preserves segments", () => {
  assert.equal(buildGpx("Empty", []), null);
  const gpx = buildGpx("A & B", [
    { latitude: 55, longitude: 12, recordedAt: "2026-08-02T08:00:00.000Z", elevation: 10, startsNewSegment: false },
    { latitude: 55.1, longitude: 12.1, recordedAt: "2026-08-02T08:10:00.000Z", elevation: 12, startsNewSegment: false },
    { latitude: 55.2, longitude: 12.2, recordedAt: null, elevation: null, startsNewSegment: true },
    { latitude: 55.3, longitude: 12.3, recordedAt: null, elevation: null, startsNewSegment: false }
  ]);
  assert.ok(gpx);
  assert.ok(gpx.includes("A &amp; B"));
  assert.equal((gpx.match(/<trkseg>/g) ?? []).length, 2);
  assert.equal((gpx.match(/<trkpt /g) ?? []).length, 4);
});

test("authenticated app source contains no service role, tracking or sensitive logging", () => {
  const appRoot = join(process.cwd(), "app", "[locale]", "app");
  const sources = [
    ...filesBelow(appRoot).filter((path) => /\.(?:ts|tsx)$/.test(path)),
    ...filesBelow(join(process.cwd(), "components")).filter((path) => /\.(?:ts|tsx)$/.test(path)),
    ...filesBelow(join(process.cwd(), "lib")).filter((path) => /app-(?:data|model|access|format|i18n|status)\.ts$/.test(path))
  ].map((path) => readFileSync(path, "utf8")).join("\n");
  ["service_role", "service-role", "participant_live_locations", "last_location", "navigator.geolocation", "push_tokens"].forEach((value) => assert.equal(sources.includes(value), false, value));
  assert.equal(/\bconsole\.(?:log|info|warn|error|debug)\b/.test(sources), false);
  assert.equal(sources.includes('select("*")'), false);
});

test("structured social mutations use existing Edge Functions and preserve RLS authority", () => {
  const actions = projectFile("app/[locale]/app/actions.ts");
  [
    "send_rider_connection_request",
    "respond_rider_connection_request",
    "cancel_rider_connection_request",
    "send_ride_interest_request",
    "respond_ride_interest_request",
    "cancel_ride_interest_request",
    "dismiss_ride_interest_request",
    "convert_ride_interest_request"
  ].forEach((name) => assert.ok(actions.includes(name), name));
  assert.equal(/from\(["']ride_interest_requests["']\)\s*\.\s*(?:insert|update|delete)/.test(actions), false);
  assert.ok(actions.includes('from("rider_connections")'));
  assert.ok(actions.includes('.eq("status", "accepted")'));
});

test("authenticated routes remain dynamic, private and noindex while GPX is no-store", () => {
  const layout = projectFile("app/[locale]/app/layout.tsx");
  const gpx = projectFile("app/[locale]/app/history/[historyId]/gpx/route.ts");
  assert.ok(layout.includes('dynamic = "force-dynamic"'));
  assert.ok(layout.includes("revalidate = 0"));
  assert.ok(layout.includes("index: false"));
  assert.ok(gpx.includes('"Cache-Control": "private, no-store, max-age=0"'));
  assert.ok(gpx.includes('"X-Robots-Tag": "noindex, nofollow, noarchive"'));
});

test("history table keeps its full data contract inside a width-contained scroller", () => {
  const history = projectFile("app/[locale]/app/history/page.tsx");
  const styles = projectFile("app/globals.css");
  const wrapperRule = styles.match(/\.bike-app-history-table-wrap\s*\{([^}]*)\}/)?.[1] ?? "";
  const tableRule = styles.match(/\.bike-app-table\s*\{([^}]*)\}/)?.[1] ?? "";

  assert.ok(history.includes('className="bike-app-history-table-wrap"'));
  assert.ok(history.includes('className="bike-app-table"'));
  [
    't("history.details")',
    't("rides.distance")',
    't("history.duration")',
    't("history.elevation")',
    't("common.view")'
  ].forEach((column) => assert.ok(history.includes(column), column));

  assert.match(wrapperRule, /\bwidth:\s*100%\s*;/);
  assert.match(wrapperRule, /\bmax-width:\s*100%\s*;/);
  assert.match(wrapperRule, /\bmin-width:\s*0\s*;/);
  assert.match(wrapperRule, /\boverflow-x:\s*auto\s*;/);
  assert.match(wrapperRule, /\bcontain:\s*inline-size\s*;/);
  assert.match(tableRule, /\bmin-width:\s*720px\s*;/);
  assert.equal(/(?:html|body)\s*\{[\s\S]*?overflow-x:\s*hidden\s*;/.test(styles), false);
});
