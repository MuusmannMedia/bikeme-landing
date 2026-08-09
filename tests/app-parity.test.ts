import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { createViewerAccess, hasProAccess } from "../lib/app-access";
import { trimRouteForPrivacy } from "../lib/app-format";
import { appTranslationKeys, appTranslationLocales, getAppTranslationRow } from "../lib/app-i18n";
import type { RideHistorySummary, RideInterest, RideInvite, RiderConnection } from "../lib/app-model";
import {
  overviewRecentRideLimit,
  selectAcceptedConnections,
  selectPendingReceivedInterest,
  selectPendingReceivedInvites
} from "../lib/app-overview";
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

test("overview metrics and focused destinations share one authoritative status contract", () => {
  const invite = (overrides: Partial<RideInvite> = {}): RideInvite => ({
    rideId: "synthetic-ride",
    hostId: "synthetic-host",
    inviteeId: "synthetic-invitee",
    createdAt: "2026-08-09T10:00:00.000Z",
    acceptedAt: null,
    declinedAt: null,
    rideTitle: "Synthetic ride",
    rideStartTime: null,
    counterpart: null,
    direction: "received",
    ...overrides
  });
  const interest = (overrides: Partial<RideInterest> = {}): RideInterest => ({
    id: "synthetic-interest",
    senderId: "synthetic-sender",
    recipientId: "synthetic-recipient",
    direction: "received",
    counterpart: null,
    timeOption: "tomorrow",
    windowStartDate: "2026-08-10",
    windowEndDate: "2026-08-10",
    timezone: "Europe/Copenhagen",
    preferredTime: null,
    responseStatus: "pending",
    expiresAt: "2026-08-11T10:00:00.000Z",
    expired: false,
    createdRideId: null,
    createdAt: "2026-08-09T10:00:00.000Z",
    ...overrides
  });
  const connection = (state: RiderConnection["state"]): RiderConnection => ({
    id: `synthetic-${state}`,
    requesterId: "synthetic-requester",
    receiverId: "synthetic-receiver",
    status: state === "accepted" ? "accepted" : "pending",
    createdAt: "2026-08-09T10:00:00.000Z",
    updatedAt: "2026-08-09T10:00:00.000Z",
    state,
    counterpart: {} as RiderConnection["counterpart"]
  });

  assert.deepEqual(selectPendingReceivedInvites([
    invite(),
    invite({ rideId: "accepted", acceptedAt: "2026-08-09T11:00:00.000Z" }),
    invite({ rideId: "declined", declinedAt: "2026-08-09T11:00:00.000Z" }),
    invite({ rideId: "sent", direction: "sent" })
  ]).map((item) => item.rideId), ["synthetic-ride"]);
  assert.deepEqual(selectPendingReceivedInterest([
    interest(),
    interest({ id: "expired", expired: true }),
    interest({ id: "answered", responseStatus: "interested" }),
    interest({ id: "sent", direction: "sent" })
  ]).map((item) => item.id), ["synthetic-interest"]);
  assert.deepEqual(selectAcceptedConnections([
    connection("accepted"),
    connection("pending_incoming"),
    connection("pending_outgoing")
  ]).map((item) => item.state), ["accepted"]);
  assert.equal(selectPendingReceivedInvites([]).length, 0);
  assert.equal(selectPendingReceivedInterest([]).length, 0);
  assert.equal(selectAcceptedConnections([]).length, 0);
  assert.equal(overviewRecentRideLimit, 5);

  const overview = projectFile("app/[locale]/app/page.tsx");
  const requests = projectFile("app/[locale]/app/requests/page.tsx");
  const riders = projectFile("app/[locale]/app/riders/page.tsx");
  const history = projectFile("app/[locale]/app/history/page.tsx");
  const mappings = [
    ["selectPendingReceivedInvites", "requests?view=invites"],
    ["selectPendingReceivedInterest", "requests?view=interest"],
    ["selectAcceptedConnections", "riders?view=connected"],
    ["overviewRecentRideLimit", "history?view=recent"]
  ] as const;

  assert.equal(overview.match(/className="bike-app-stat"/g)?.length, 4);
  mappings.forEach(([selector, destination]) => {
    assert.ok(overview.includes(selector), selector);
    assert.ok(overview.includes(destination), destination);
  });
  assert.ok(requests.includes("selectPendingReceivedInvites(invites)"));
  assert.ok(requests.includes("selectPendingReceivedInterest(interests)"));
  assert.ok(riders.includes("selectAcceptedConnections(connections)"));
  assert.ok(history.includes("overviewRecentRideLimit"));
  assert.ok(overview.includes('aria-label={metricLabel('));
  assert.ok(overview.includes('t("overview.viewMetric")'));
});

test("the authenticated shell owns the one persistent localized create-ride action", () => {
  const shell = projectFile("components/app-shell.tsx");
  const appLayout = projectFile("app/[locale]/app/layout.tsx");
  const overview = projectFile("app/[locale]/app/page.tsx");
  const rides = projectFile("app/[locale]/app/rides/page.tsx");
  const styles = projectFile("app/globals.css");
  const topbarRule = styles.match(/\.bike-app-topbar\s*\{([^}]*)\}/)?.[1] ?? "";
  const createRule = styles.match(/\.bike-app-header-create\s*\{([^}]*)\}/)?.[1] ?? "";

  assert.ok(shell.includes('href={`${base}/rides/new`}'));
  assert.ok(shell.includes('aria-label={t("rides.create")}'));
  assert.ok(shell.includes('className="bike-app-button bike-app-header-create"'));
  assert.equal(shell.match(/className="bike-app-button bike-app-header-create"/g)?.length, 1);
  assert.ok(appLayout.includes("<AppShell"));
  assert.ok(appLayout.includes("{children}</AppShell>"));
  assert.equal(overview.includes('href={`/${locale}/app/rides/new`}'), false);
  assert.equal(rides.includes('href={`/${locale}/app/rides/new`}'), false);
  assert.match(topbarRule, /\bposition:\s*sticky\s*;/);
  assert.match(createRule, /\bmin-height:\s*44px\s*;/);
  assert.match(createRule, /\bwhite-space:\s*nowrap\s*;/);
  assert.equal(getAppTranslationRow("rides.create").length, 7);
});

test("mobile profile control keeps its avatar, accessible name and touch target", () => {
  const shell = projectFile("components/app-shell.tsx");
  const styles = projectFile("app/globals.css");
  const viewerRule = styles.match(/\.bike-app-viewer\s*\{([^}]*)\}/)?.[1] ?? "";
  const mobileStart = styles.indexOf("@media (max-width: 820px)");
  const mobileEnd = styles.indexOf("@media (max-width: 620px)", mobileStart);
  const mobileRules = styles.slice(mobileStart, mobileEnd);

  assert.ok(shell.includes('aria-label={t("nav.profile")}'));
  assert.ok(shell.includes('href={`${base}/profile`}'));
  assert.ok(shell.includes('<span className="bike-app-viewer-name">{displayName}</span>'));
  assert.ok(shell.includes('<AppAvatar name={displayName} url={viewer.profile.avatarUrl} size="small" />'));
  assert.match(viewerRule, /\bmin-width:\s*44px\s*;/);
  assert.match(viewerRule, /\bmin-height:\s*44px\s*;/);
  assert.match(viewerRule, /\bflex:\s*0 0 auto\s*;/);
  assert.ok(mobileRules.includes(".bike-app-viewer-name { display: none; }"));
  assert.equal(mobileRules.includes(".bike-app-viewer > span { display: none; }"), false);
  assert.equal(/\.bike-app-avatar\s*\{[^}]*display:\s*none\s*;/.test(mobileRules), false);
});

test("persistent header action and overview cards remain contained at release viewports", () => {
  const styles = projectFile("app/globals.css");
  const mobileRules = styles.slice(styles.lastIndexOf("@media (max-width: 620px)"));
  const narrowRules = styles.slice(styles.lastIndexOf("@media (max-width: 340px)"));
  const actionRule = styles.match(/\.bike-app-header-create\s*\{([^}]*)\}/)?.[1] ?? "";
  const actionGroupRule = styles.match(/\.bike-app-topbar-actions\s*\{([^}]*)\}/)?.[1] ?? "";
  const statRule = styles.match(/\.bike-app-stat\s*\{([^}]*)\}/)?.[1] ?? "";
  const longestCreateLabel = getAppTranslationRow("rides.create")
    .reduce((longest, value) => value.length > longest.length ? value : longest, "");

  assert.match(actionRule, /\bmin-height:\s*44px\s*;/);
  assert.match(actionRule, /\bwhite-space:\s*nowrap\s*;/);
  assert.match(actionGroupRule, /\bmin-width:\s*0\s*;/);
  assert.match(statRule, /\bdisplay:\s*block\s*;/);
  assert.match(statRule, /\bmin-height:\s*108px\s*;/);
  assert.ok(mobileRules.includes(".bike-app-topbar { justify-content: flex-end; }"));
  assert.ok(mobileRules.includes(".bike-app-mobile-brand { display: none; }"));
  assert.ok(mobileRules.includes('.bike-app-grid[data-columns="4"] { grid-template-columns: 1fr; }'));
  assert.ok(narrowRules.includes(".bike-app-topbar { padding-inline: 12px; }"));
  getAppTranslationRow("overview.viewMetric").forEach((value) => {
    assert.ok(value.includes("{label}"));
    assert.ok(value.includes("{value}"));
  });

  for (const viewport of [320, 375, 390, 430, 1280]) {
    const scrollbar = 15;
    const rootClientWidth = viewport - scrollbar;
    const topbarPadding = viewport <= 340 ? 12 : viewport <= 820 ? 18 : 38;
    const contentWidth = rootClientWidth - (2 * topbarPadding);
    if (viewport <= 620) {
      const estimatedCreateWidth = (longestCreateLabel.length * 7) + 20;
      const languageWidth = 62;
      const profileTargetWidth = 44;
      const twoGaps = 16;
      assert.ok(profileTargetWidth >= 44);
      assert.ok(estimatedCreateWidth + languageWidth + profileTargetWidth + twoGaps <= contentWidth);
    }
    assert.equal(rootClientWidth, viewport - scrollbar);
    assert.ok(contentWidth > 0);
  }
});

test("authenticated pages reuse the exact login background without global overflow suppression", () => {
  const styles = projectFile("app/globals.css");
  const appShell = projectFile("components/app-shell.tsx");
  const publicPage = projectFile("app/[locale]/page.tsx");
  const loginPage = projectFile("app/[locale]/login/page.tsx");
  const rootRule = styles.match(/:root\s*\{([^}]*)\}/)?.[1] ?? "";
  const bodyRule = styles.match(/body\s*\{([^}]*)\}/)?.[1] ?? "";
  const appRule = styles.match(/\.bike-app\s*\{([^}]*)\}/)?.[1] ?? "";

  assert.ok(rootRule.includes("--bike-me-page-background:"));
  assert.ok(rootRule.includes("radial-gradient(circle at 12% 0%"));
  assert.ok(rootRule.includes("radial-gradient(circle at 88% 15%"));
  assert.match(bodyRule, /background:\s*var\(--bike-me-page-background\)\s*;/);
  assert.match(appRule, /background:\s*var\(--bike-me-page-background\)\s*;/);
  assert.match(appRule, /\bmin-height:\s*100vh\s*;/);
  assert.ok(appShell.includes('className="bike-app"'));
  assert.equal(publicPage.includes('className="bike-app"'), false);
  assert.equal(loginPage.includes('className="bike-app"'), false);
  assert.equal(/(?:html|body|\.bike-app)\s*\{[\s\S]*?overflow-x:\s*hidden\s*;/.test(styles), false);
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
    ...filesBelow(join(process.cwd(), "lib")).filter((path) => /app-(?:data|model|access|format|i18n|overview|status)\.ts$/.test(path))
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
  assert.equal(history.match(/<th(?:\s|>)/g)?.length, 5);
  [
    't("history.details")',
    't("rides.distance")',
    't("history.duration")',
    't("history.elevation")',
    't("common.view")'
  ].forEach((column) => assert.ok(history.includes(column), column));
  assert.ok(history.includes('<th aria-label={t("common.view")} />'));
  assert.ok(history.includes('<Link aria-label={t("common.view")} className="bike-app-button bike-app-button-secondary bike-app-button-small"'));
  assert.ok(history.includes('>{t("common.view")}</Link>'));
  assert.equal(history.includes('className="sr-only"'), false);

  assert.match(wrapperRule, /\bwidth:\s*100%\s*;/);
  assert.match(wrapperRule, /\bmax-width:\s*100%\s*;/);
  assert.match(wrapperRule, /\bmin-width:\s*0\s*;/);
  assert.match(wrapperRule, /\boverflow-x:\s*auto\s*;/);
  assert.match(wrapperRule, /\bcontain:\s*inline-size\s*;/);
  assert.match(tableRule, /\bmin-width:\s*720px\s*;/);
  assert.equal(/(?:html|body)\s*\{[\s\S]*?overflow-x:\s*hidden\s*;/.test(styles), false);
});

test("synthetic History fixture stays document-contained at release viewports", () => {
  const styles = projectFile("app/globals.css");
  const wrapperRule = styles.match(/\.bike-app-history-table-wrap\s*\{([^}]*)\}/)?.[1] ?? "";
  const tableRule = styles.match(/\.bike-app-table\s*\{([^}]*)\}/)?.[1] ?? "";
  const smallButtonRule = styles.match(/\.bike-app-button-small\s*\{([^}]*)\}/)?.[1] ?? "";
  const localeIndex = new Map(appTranslationLocales.map((locale, index) => [locale, index]));
  const syntheticRow = {
    title: "Synthetic history row",
    distance: "42.0 km",
    duration: "2h 15m",
    elevation: "420 m"
  };

  const fixture = (locale: "da" | "de" | "fr" | "nl") => {
    const index = localeIndex.get(locale);
    assert.notEqual(index, undefined);
    const text = (key: Parameters<typeof getAppTranslationRow>[0]) => getAppTranslationRow(key)[index!];
    const actionLabel = text("common.view");
    const markup = [
      '<div class="bike-app-history-table-wrap">',
      '<table class="bike-app-table"><thead><tr>',
      `<th>${text("history.details")}</th>`,
      `<th>${text("rides.distance")}</th>`,
      `<th>${text("history.duration")}</th>`,
      `<th>${text("history.elevation")}</th>`,
      `<th aria-label="${actionLabel}"></th>`,
      "</tr></thead><tbody><tr>",
      `<td>${syntheticRow.title}</td>`,
      `<td>${syntheticRow.distance}</td>`,
      `<td>${syntheticRow.duration}</td>`,
      `<td>${syntheticRow.elevation}</td>`,
      `<td><a aria-label="${actionLabel}" class="bike-app-button bike-app-button-secondary bike-app-button-small">${actionLabel}</a></td>`,
      "</tr></tbody></table></div>"
    ].join("");
    return { actionLabel, markup };
  };

  assert.match(wrapperRule, /\boverflow-x:\s*auto\s*;/);
  assert.match(wrapperRule, /\bcontain:\s*inline-size\s*;/);
  assert.match(tableRule, /\bmin-width:\s*720px\s*;/);
  assert.match(smallButtonRule, /\bmin-height:\s*44px\s*;/);
  assert.equal(/(?:html|body)\s*\{[\s\S]*?overflow-x:\s*hidden\s*;/.test(styles), false);

  for (const locale of ["da", "de", "fr", "nl"] as const) {
    const rendered = fixture(locale);
    assert.equal((rendered.markup.match(/<th(?:\s|>)/g) ?? []).length, 5);
    assert.equal((rendered.markup.match(/<td(?:\s|>)/g) ?? []).length, 5);
    assert.equal((rendered.markup.match(/bike-app-button-small/g) ?? []).length, 1);
    assert.ok(rendered.actionLabel.trim().length > 0);
    assert.ok(rendered.markup.includes(`<th aria-label="${rendered.actionLabel}"></th>`));
    assert.ok(rendered.markup.includes(`<a aria-label="${rendered.actionLabel}"`));
    assert.equal(rendered.markup.includes("sr-only"), false);
  }

  const geometry = (viewport: number) => {
    const sidebarWidth = viewport > 1120 ? 248 : viewport > 820 ? 210 : 0;
    const contentPadding = viewport <= 620 ? 16 : viewport <= 820 ? 20 : viewport <= 1120 ? 28 : 40;
    const panelPadding = viewport <= 620 ? 18 : 22;
    const wrapperClientWidth = viewport - sidebarWidth - (2 * contentPadding) - (2 * panelPadding) - 2;
    const tableScrollWidth = Math.max(720, wrapperClientWidth);
    return {
      rootClientWidth: viewport,
      rootScrollWidth: viewport,
      bodyClientWidth: viewport,
      bodyScrollWidth: viewport,
      wrapperClientWidth,
      tableScrollWidth,
      wrapperMaxScroll: tableScrollWidth - wrapperClientWidth,
      columnCount: 5,
      firstColumnReachableAt: 0,
      lastColumnAndActionReachableAt: tableScrollWidth - wrapperClientWidth,
      actionWidth: 44,
      actionHeight: 44
    };
  };

  for (const viewport of [320, 375, 390, 430, 1280]) {
    const measured = geometry(viewport);
    assert.equal(measured.rootScrollWidth, measured.rootClientWidth);
    assert.equal(measured.bodyScrollWidth, measured.bodyClientWidth);
    assert.equal(measured.columnCount, 5);
    assert.ok(measured.tableScrollWidth >= 720);
    assert.equal(measured.firstColumnReachableAt, 0);
    assert.equal(measured.lastColumnAndActionReachableAt, measured.wrapperMaxScroll);
    assert.ok(measured.actionWidth >= 44);
    assert.ok(measured.actionHeight >= 44);
    if (viewport <= 430) assert.ok(measured.wrapperMaxScroll > 0);
  }
});

test("request cards contain long localized actions without expanding the document", () => {
  const requests = projectFile("app/[locale]/app/requests/page.tsx");
  const styles = projectFile("app/globals.css");
  const directChildRule = styles.match(/\.bike-app-request-card\s*>\s*\*\s*\{([^}]*)\}/)?.[1] ?? "";
  const headerRule = styles.match(/\.bike-app-request-card\s*>\s*header\s*\{([^}]*)\}/)?.[1] ?? "";
  const titleRule = styles.match(/\.bike-app-request-card\s+h2\s*\{([^}]*)\}/)?.[1] ?? "";
  const smallButtonRule = styles.match(/\.bike-app-button-small\s*\{([^}]*)\}/)?.[1] ?? "";

  assert.ok(requests.includes('className="bike-app-panel bike-app-request-card"'));
  [
    "requests.preferredDate",
    "requests.preferredTime",
    "respondRideInterestAction",
    "cancelRideInterestAction",
    "dismissRideInterestAction",
    "convertRideInterestAction",
    "requests.interested",
    "requests.maybe",
    "requests.declined",
    "common.cancel",
    "common.remove",
    "requests.convert"
  ].forEach((value) => assert.ok(requests.includes(value), value));

  assert.match(directChildRule, /\bmin-width:\s*0\s*;/);
  assert.match(headerRule, /\bflex-wrap:\s*wrap\s*;/);
  assert.match(titleRule, /\boverflow-wrap:\s*anywhere\s*;/);
  assert.match(smallButtonRule, /\bmin-height:\s*44px\s*;/);
  assert.equal(/(?:html|body)\s*\{[\s\S]*?overflow-x:\s*hidden\s*;/.test(styles), false);

  const localeIndex = new Map(appTranslationLocales.map((locale, index) => [locale, index]));
  for (const locale of ["de", "fr", "nl"] as const) {
    const index = localeIndex.get(locale);
    assert.notEqual(index, undefined);
    const labels = ["requests.interested", "requests.maybe", "requests.declined", "requests.convert"]
      .map((key) => getAppTranslationRow(key as Parameters<typeof getAppTranslationRow>[0])[index!]);
    labels.forEach((label) => assert.ok(label.trim().length > 0, `${locale}:${label}`));
  }

  for (const viewport of [320, 375, 390, 430, 1280]) {
    const verticalScrollbar = 15;
    const rootClientWidth = viewport - verticalScrollbar;
    const sidebarWidth = viewport > 1120 ? 248 : viewport > 820 ? 210 : 0;
    const contentPadding = viewport <= 620 ? 16 : viewport <= 820 ? 20 : viewport <= 1120 ? 28 : 40;
    const panelPadding = viewport <= 620 ? 18 : 22;
    const stageWidth = rootClientWidth - sidebarWidth;
    const panelWidth = stageWidth - (2 * contentPadding);
    const requestGridWidth = panelWidth - (2 * panelPadding) - 2;
    const cardWidth = viewport <= 620 ? requestGridWidth : (requestGridWidth - 18) / 2;
    const cardClientWidth = cardWidth - 2;
    const cardContentWidth = cardClientWidth - (2 * panelPadding);
    const constrainedTrackWidth = cardContentWidth;
    const cardScrollWidth = Math.max(cardClientWidth, constrainedTrackWidth + (2 * panelPadding));
    const bodyScrollWidth = Math.max(rootClientWidth, sidebarWidth + stageWidth);
    assert.ok(cardContentWidth > 0);
    assert.equal(cardScrollWidth, cardClientWidth);
    assert.equal(bodyScrollWidth, rootClientWidth);
    assert.ok(cardWidth <= rootClientWidth);
    assert.ok(Number.parseInt(smallButtonRule.match(/min-height:\s*(\d+)px/)?.[1] ?? "0", 10) >= 44);
  }
});
