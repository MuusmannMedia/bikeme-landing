"use client";

import { useCallback, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { useFormState, useFormStatus } from "react-dom";

import { createRideAction, type CreateRideActionState } from "@/app/[locale]/app/actions";
import { AppNotice } from "@/components/app-ui";
import { BrowserTimezoneInput, LocalDateTimeInput } from "@/components/local-date-time-input";
import { MeetingPointMap, type MeetingCoordinate } from "@/components/meeting-point-map";
import { RoutePreview } from "@/components/route-preview";
import {
  getNextRoundedTenMinuteTimeValue,
  distanceFromKilometers,
  getDistanceUnit,
  getRideNowTitleInputMaxLength,
  getRideMoodOptions,
  getRideTitleSuggestions,
  getTenMinuteTimeOptions,
  resolveExactRideNowStart,
  rideTitleMaxLength,
  rideNowStartOffsets,
  type RideCreateType,
  type RideNowStartMode
} from "@/lib/create-ride";
import { getAppDictionary } from "@/lib/app-i18n";
import type { RoutePoint, UnitSystem } from "@/lib/app-model";
import {
  GpxImportError,
  gpxImportMaxFileBytes,
  parseGpxText,
  serializePlannedRoute,
  type ImportedGpxRoute
} from "@/lib/gpx-import";
import type { Locale } from "@/lib/locales";

type CreateRideHotspot = {
  id: string;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  region: string;
};

type CreateRideInvitee = {
  id: string;
  displayName: string | null;
  level: string | null;
  region: string | null;
};

function CreateRideSubmitButton({
  mode,
  blocked,
  plannedLabel,
  nowLabel,
  pendingLabel
}: {
  mode: RideCreateType;
  blocked: boolean;
  plannedLabel: string;
  nowLabel: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();
  const [clicked, setClicked] = useState(false);
  const clickedRef = useRef(false);
  const isPending = pending || clicked || blocked;
  return (
    <button
      className="bike-app-button"
      type="submit"
      disabled={isPending}
      aria-disabled={isPending}
      aria-busy={isPending}
      onClick={(event) => {
        if (!event.currentTarget.form?.checkValidity()) return;
        if (clickedRef.current) {
          event.preventDefault();
          return;
        }
        clickedRef.current = true;
        setClicked(true);
      }}
    >
      {isPending ? pendingLabel : mode === "PING" ? nowLabel : plannedLabel}
    </button>
  );
}

export function CreateRideForm({
  createRequestId,
  locale,
  hotspots,
  initialHotspotId,
  initialType,
  initialDiscipline = "ROAD",
  initialDistanceKm,
  inviteableRiders,
  inviteLoadFailed,
  notice,
  returnTo,
  unitSystem
}: {
  createRequestId: string;
  locale: Locale;
  hotspots: CreateRideHotspot[];
  initialHotspotId?: string;
  initialType: RideCreateType;
  initialDiscipline?: "ROAD" | "GRAVEL" | "MTB";
  initialDistanceKm?: number | null;
  inviteableRiders: CreateRideInvitee[];
  inviteLoadFailed: boolean;
  notice?: string | null;
  returnTo: string;
  unitSystem: UnitSystem;
}) {
  const t = getAppDictionary(locale);
  const initialHotspot = hotspots.find((hotspot) => hotspot.id === initialHotspotId) ?? hotspots[0] ?? null;
  const initialMeetingCoordinate = initialHotspot && initialHotspot.latitude != null && initialHotspot.longitude != null
    ? { latitude: initialHotspot.latitude, longitude: initialHotspot.longitude }
    : null;
  const initialDistanceValue = initialDistanceKm == null
    ? ""
    : distanceFromKilometers(initialDistanceKm, unitSystem).toFixed(1).replace(/\.0$/u, "");
  const [mode, setMode] = useState<RideCreateType>(initialType);
  const [title, setTitle] = useState("");
  const [discipline, setDiscipline] = useState(initialDiscipline);
  const [distanceValue, setDistanceValue] = useState(initialDistanceValue);
  const [startMode, setStartMode] = useState<RideNowStartMode>("OM");
  const [startOffsetMinutes, setStartOffsetMinutes] = useState("10");
  const [durationHours, setDurationHours] = useState("2");
  const [moodKey, setMoodKey] = useState("");
  const [description, setDescription] = useState("");
  const [inviteSearch, setInviteSearch] = useState("");
  const [selectedInviteeIds, setSelectedInviteeIds] = useState<string[]>([]);
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [visibilityTouched, setVisibilityTouched] = useState(false);
  const [plannedRoute, setPlannedRoute] = useState<ImportedGpxRoute | null>(null);
  const [gpxError, setGpxError] = useState<string | null>(null);
  const [gpxImporting, setGpxImporting] = useState(false);
  const [meetingMode, setMeetingMode] = useState<"hotspot" | "map">(initialHotspot ? "hotspot" : "map");
  const [selectedHotspotId, setSelectedHotspotId] = useState(initialHotspot?.id ?? "");
  const [meetingCoordinate, setMeetingCoordinate] = useState<MeetingCoordinate | null>(initialMeetingCoordinate);
  const [meetingAddress, setMeetingAddress] = useState(initialHotspot?.address?.trim() || initialHotspot?.name || "");
  const [actionState, formAction] = useFormState<CreateRideActionState, FormData>(createRideAction, {
    notice: null,
    attempt: 0
  });
  const exactStartRef = useRef<HTMLInputElement>(null);
  const gpxInputRef = useRef<HTMLInputElement>(null);
  const titleSuggestionsId = useId();
  const now = useMemo(() => new Date(), []);
  const eventStart = useMemo(() => {
    const date = new Date(now);
    date.setSeconds(0, 0);
    const nextMinute = Math.ceil((date.getMinutes() + 1) / 10) * 10;
    if (nextMinute >= 60) date.setHours(date.getHours() + 1, 0, 0, 0);
    else date.setMinutes(nextMinute, 0, 0);
    return date.toISOString();
  }, [now]);
  const [pingClockTime, setPingClockTime] = useState(() => getNextRoundedTenMinuteTimeValue(now));
  const titleSuggestions = useMemo(() => getRideTitleSuggestions(locale), [locale]);
  const moodOptions = useMemo(() => getRideMoodOptions(locale), [locale]);
  const clockOptions = useMemo(() => getTenMinuteTimeOptions(), []);
  const distanceUnit = getDistanceUnit(unitSystem);
  const maximumDistance = distanceFromKilometers(500, unitSystem);
  const parsedDistanceValue = Number(distanceValue.replace(",", "."));
  const titleMaxLength = mode === "PING"
    ? getRideNowTitleInputMaxLength(parsedDistanceValue, unitSystem)
    : rideTitleMaxLength;
  const filteredInvitees = useMemo(() => {
    const needle = inviteSearch.trim().toLocaleLowerCase();
    if (!needle) return inviteableRiders;
    return inviteableRiders.filter((rider) =>
      [rider.displayName, rider.level, rider.region]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase()
        .includes(needle)
    );
  }, [inviteSearch, inviteableRiders]);
  const routePreviewPoints = useMemo<RoutePoint[]>(() => {
    if (!plannedRoute) return [];
    const step = Math.max(1, Math.ceil(plannedRoute.routeCoordinates.length / 600));
    const sampled = plannedRoute.routeCoordinates.filter((_, index) => index % step === 0);
    const last = plannedRoute.routeCoordinates.at(-1);
    if (last && sampled.at(-1) !== last) sampled.push(last);
    return sampled.map((point) => ({
      latitude: point.latitude,
      longitude: point.longitude,
      recordedAt: null,
      elevation: null,
      startsNewSegment: false
    }));
  }, [plannedRoute]);

  const toggleInvitee = (inviteeId: string) => {
    const next = selectedInviteeIds.includes(inviteeId)
      ? selectedInviteeIds.filter((id) => id !== inviteeId)
      : [...selectedInviteeIds, inviteeId];
    setSelectedInviteeIds(next);
    if (!visibilityTouched) setVisibility(next.length > 0 ? "private" : "public");
  };

  const handleHotspotChange = (hotspotId: string) => {
    setSelectedHotspotId(hotspotId);
    const hotspot = hotspots.find((candidate) => candidate.id === hotspotId);
    if (!hotspot) return;
    setMeetingAddress(hotspot.address?.trim() || hotspot.name);
    if (hotspot.latitude != null && hotspot.longitude != null) {
      setMeetingCoordinate({ latitude: hotspot.latitude, longitude: hotspot.longitude });
    }
  };

  const handleMapSelect = useCallback((coordinate: MeetingCoordinate) => {
    setMeetingCoordinate(coordinate);
    setMeetingAddress("");
  }, []);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (mode === "PING" && startMode === "KL") {
      const exactStart = resolveExactRideNowStart(pingClockTime, new Date());
      if (!exactStart || !exactStartRef.current) {
        event.preventDefault();
        return;
      }
      exactStartRef.current.value = exactStart.toISOString();
    }
  };

  const handleGpxFile = async (file: File | null) => {
    if (!file) return;
    setGpxError(null);
    if (file.size > gpxImportMaxFileBytes) {
      setGpxError(t("rides.gpxTooLarge"));
      return;
    }
    setGpxImporting(true);
    try {
      const xml = await file.text();
      setPlannedRoute(parseGpxText(xml, { fileName: file.name, fileSizeBytes: file.size || null }));
    } catch (errorValue) {
      if (errorValue instanceof GpxImportError) {
        setGpxError(
          errorValue.code === "FILE_TOO_LARGE"
            ? t("rides.gpxTooLarge")
            : errorValue.code === "ROUTE_TOO_SHORT"
              ? t("rides.gpxTooShort")
              : t("rides.gpxInvalid")
        );
      } else {
        setGpxError(t("rides.gpxReadError"));
      }
    } finally {
      setGpxImporting(false);
      if (gpxInputRef.current) gpxInputRef.current.value = "";
    }
  };

  return (
    <form action={formAction} className="bike-app-form" onSubmit={handleSubmit}>
      <input type="hidden" name="createRequestId" value={createRequestId} />
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="returnTo" value={returnTo} />
      {selectedInviteeIds.map((inviteeId) => <input key={inviteeId} type="hidden" name="inviteeIds" value={inviteeId} />)}
      {plannedRoute ? <input type="hidden" name="plannedRoute" value={serializePlannedRoute(plannedRoute)} /> : null}
      <BrowserTimezoneInput />
      <AppNotice locale={locale} code={actionState.notice ?? notice} />

      <fieldset className="bike-app-choice-fieldset">
        <legend>{t("rides.typeLabel")}</legend>
        <div className="bike-app-choice-grid">
          <label className="bike-app-choice-card">
            <input
              type="radio"
              name="type"
              value="PING"
              checked={mode === "PING"}
              onChange={() => setMode("PING")}
            />
            <span><strong>{t("rides.rideNow")}</strong><small>{t("rides.rideNowHint")}</small></span>
          </label>
          <label className="bike-app-choice-card">
            <input
              type="radio"
              name="type"
              value="EVENT"
              checked={mode === "EVENT"}
              onChange={() => setMode("EVENT")}
            />
            <span><strong>{t("rides.planned")}</strong><small>{t("rides.plannedHint")}</small></span>
          </label>
        </div>
      </fieldset>

      <div className="bike-app-form-section">
        <h2>{t("rides.requiredFields")}</h2>
        <fieldset className="bike-app-choice-fieldset bike-app-meeting-choice">
          <legend>{t("rides.meeting")}</legend>
          <div className="bike-app-choice-grid">
            <label className="bike-app-choice-card" data-disabled={hotspots.length === 0}>
              <input
                type="radio"
                name="meetingMode"
                value="hotspot"
                checked={meetingMode === "hotspot"}
                disabled={hotspots.length === 0}
                onChange={() => setMeetingMode("hotspot")}
              />
              <span><strong>{t("rides.meetingHotspot")}</strong><small>{t("rides.meetingHotspotHint")}</small></span>
            </label>
            <label className="bike-app-choice-card">
              <input
                type="radio"
                name="meetingMode"
                value="map"
                checked={meetingMode === "map"}
                onChange={() => setMeetingMode("map")}
              />
              <span><strong>{t("rides.meetingMap")}</strong><small>{t("rides.meetingMapHint")}</small></span>
            </label>
          </div>
          {meetingMode === "hotspot" ? (
            <label className="bike-app-field">
              <span>{t("rides.hotspotLabel")}</span>
              <select
                name="hotspotId"
                required
                value={selectedHotspotId}
                onChange={(event) => handleHotspotChange(event.target.value)}
              >
                {hotspots.map((hotspot) => (
                  <option key={hotspot.id} value={hotspot.id}>{hotspot.name} · {hotspot.region}</option>
                ))}
              </select>
            </label>
          ) : (
            <div className="bike-app-free-meeting">
              {meetingCoordinate ? (
                <>
                  <input type="hidden" name="meetingLatitude" value={meetingCoordinate.latitude} />
                  <input type="hidden" name="meetingLongitude" value={meetingCoordinate.longitude} />
                </>
              ) : null}
              <MeetingPointMap
                coordinate={meetingCoordinate}
                onSelect={handleMapSelect}
                mapLabel={t("rides.meetingMapLabel")}
                markerLabel={t("rides.meetingMapMarker")}
                chooseHint={t("rides.meetingMapChoose")}
                currentLocationLabel={t("rides.meetingCurrentLocation")}
                locatingLabel={t("rides.meetingLocating")}
                locationErrorLabel={t("rides.meetingLocationError")}
                mapErrorLabel={t("rides.meetingMapError")}
                zoomInLabel={t("history.routeZoomIn")}
                zoomOutLabel={t("history.routeZoomOut")}
                attributionLabel={t("history.routeAttribution")}
              />
              <label className="bike-app-field">
                <span>{t("rides.meetingAddress")}</span>
                <input
                  name="meetingAddress"
                  value={meetingAddress}
                  maxLength={500}
                  placeholder={t("rides.meetingAddressPlaceholder")}
                  onChange={(event) => setMeetingAddress(event.target.value)}
                />
                <small>{meetingCoordinate
                  ? `${meetingCoordinate.latitude.toFixed(5)}, ${meetingCoordinate.longitude.toFixed(5)}`
                  : t("rides.meetingMapNoSelection")}</small>
              </label>
            </div>
          )}
        </fieldset>
        <div className="bike-app-form-grid">
          <div className="bike-app-title-field">
            <label className="bike-app-field">
              <span>{t("rides.titleLabel")}</span>
              <input
                name="title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={t("rides.titlePlaceholder")}
                list={titleSuggestionsId}
                required
                minLength={3}
                maxLength={titleMaxLength}
                onInvalid={(event) => event.currentTarget.setCustomValidity(
                  event.currentTarget.validity.tooLong ? t("message.titleTooLong") : t("message.titleTooShort")
                )}
                onInput={(event) => event.currentTarget.setCustomValidity("")}
              />
              <datalist id={titleSuggestionsId}>
                {titleSuggestions.map((suggestion) => <option key={suggestion} value={suggestion} />)}
              </datalist>
              <small>{t("rides.titleSuggestions")}</small>
            </label>
            <div className="bike-app-preset-list">
              {titleSuggestions.map((suggestion) => (
                <button key={suggestion} type="button" onClick={() => setTitle(suggestion)}>{suggestion}</button>
              ))}
            </div>
          </div>

          <label className="bike-app-field">
            <span>{t("rides.discipline")}</span>
            <select name="discipline" value={discipline} onChange={(event) => setDiscipline(event.target.value as typeof discipline)}>
              <option value="ROAD">{t("discipline.road")}</option>
              <option value="GRAVEL">{t("discipline.gravel")}</option>
              <option value="MTB">{t("discipline.mtb")}</option>
            </select>
          </label>

          <label className="bike-app-field">
            <span>{t("rides.distanceWithUnit").replace("{unit}", distanceUnit)}</span>
            <input
              name="distance"
              type="number"
              min="0.1"
              max={maximumDistance}
              step="0.1"
              value={distanceValue}
              placeholder={t("rides.distancePlaceholder")}
              required
              onInvalid={(event) => event.currentTarget.setCustomValidity(t("message.distanceInvalid"))}
              onChange={(event) => {
                event.currentTarget.setCustomValidity("");
                setDistanceValue(event.target.value);
              }}
            />
          </label>

          {mode === "PING" ? (
            <>
              <label className="bike-app-field">
                <span>{t("rides.startMode")}</span>
                <select name="pingStartMode" value={startMode} onChange={(event) => setStartMode(event.target.value as RideNowStartMode)}>
                  <option value="OM">{t("rides.startRelative")}</option>
                  <option value="KL">{t("rides.startExact")}</option>
                </select>
              </label>
              {startMode === "OM" ? (
                <label className="bike-app-field">
                  <span>{t("rides.startIn")}</span>
                  <select name="startOffsetMinutes" value={startOffsetMinutes} onChange={(event) => setStartOffsetMinutes(event.target.value)}>
                    {rideNowStartOffsets.map((minutes) => (
                      <option key={minutes} value={minutes}>{t("rides.inMinutes").replace("{minutes}", String(minutes))}</option>
                    ))}
                  </select>
                </label>
              ) : (
                <label className="bike-app-field">
                  <span>{t("rides.startAt")}</span>
                  <select value={pingClockTime} onChange={(event) => setPingClockTime(event.target.value)}>
                    {clockOptions.map((time) => <option key={time} value={time}>{time}</option>)}
                  </select>
                  <input ref={exactStartRef} type="hidden" name="startTimeIso" />
                </label>
              )}
              <p className="bike-app-form-note">{t("rides.rideNowDuration")}</p>
            </>
          ) : (
            <>
              <label className="bike-app-field">
                <span>{t("rides.startLabel")}</span>
                <LocalDateTimeInput
                  name="startTimeIso"
                  defaultValue={eventStart}
                  minimumValue={now.toISOString()}
                  stepSeconds={600}
                  invalidMessage={t("message.startFuture")}
                />
              </label>
              <label className="bike-app-field">
                <span>{t("rides.durationHours")}</span>
                <input
                  name="durationHours"
                  type="number"
                  min="0.01"
                  step="any"
                  value={durationHours}
                  required
                  onInvalid={(event) => event.currentTarget.setCustomValidity(t("message.durationInvalid"))}
                  onChange={(event) => {
                    event.currentTarget.setCustomValidity("");
                    setDurationHours(event.target.value);
                  }}
                />
              </label>
            </>
          )}

          <label className="bike-app-field">
            <span>{t("rides.visibilityLabel")}</span>
            <select
              name="visibility"
              value={visibility}
              onChange={(event) => {
                setVisibility(event.target.value as "public" | "private");
                setVisibilityTouched(true);
              }}
            >
              <option value="public">{t("common.public")}</option>
              <option value="private">{t("common.private")}</option>
            </select>
          </label>
        </div>
      </div>

      <div className="bike-app-form-section">
        <h2>{t("rides.optionalFields")}</h2>
        <div className="bike-app-form-grid">
          <label className="bike-app-field">
            <span>{t("rides.mood")}</span>
            <select name="paceText" value={moodKey} onChange={(event) => setMoodKey(event.target.value)}>
              <option value="">{t("rides.moodPlaceholder")}</option>
              {moodOptions.map((mood) => <option key={mood.key} value={mood.key}>{mood.label}</option>)}
            </select>
          </label>
        </div>
        <div className="bike-app-invite-picker">
          <div>
            <h3>{t("rides.inviteSearch")}</h3>
            <p>{t("rides.inviteHint")}</p>
          </div>
          <label className="bike-app-field">
            <span>{t("rides.inviteSelected").replace("{count}", String(selectedInviteeIds.length))}</span>
            <input
              type="search"
              value={inviteSearch}
              onChange={(event) => setInviteSearch(event.target.value)}
              placeholder={t("rides.inviteSearchPlaceholder")}
            />
          </label>
          {inviteLoadFailed ? (
            <p className="bike-app-inline-error" role="alert">{t("rides.inviteLoadError")}</p>
          ) : filteredInvitees.length ? (
            <div className="bike-app-invite-list">
              {filteredInvitees.map((rider) => {
                const selected = selectedInviteeIds.includes(rider.id);
                return (
                  <label key={rider.id} className="bike-app-invite-option" data-selected={selected}>
                    <input type="checkbox" checked={selected} onChange={() => toggleInvitee(rider.id)} />
                    <span>
                      <strong>{rider.displayName ?? "Bike Me"}</strong>
                      <small>{[rider.level, rider.region].filter(Boolean).join(" · ")}</small>
                    </span>
                  </label>
                );
              })}
            </div>
          ) : <p className="bike-app-form-note">{t("rides.inviteNoResults")}</p>}
        </div>
        <div className="bike-app-gpx-picker">
          <div>
            <h3>{t("rides.gpxImport")}</h3>
            <p>{t("rides.gpxHint")}</p>
          </div>
          <input
            ref={gpxInputRef}
            className="bike-app-file-input"
            type="file"
            accept=".gpx,application/gpx+xml,application/xml,text/xml"
            disabled={gpxImporting}
            onChange={(event) => void handleGpxFile(event.target.files?.[0] ?? null)}
          />
          {gpxImporting ? <p role="status">{t("rides.gpxImporting")}</p> : null}
          {gpxError ? <p className="bike-app-inline-error" role="alert">{gpxError}</p> : null}
          {plannedRoute ? (
            <div className="bike-app-gpx-preview">
              <div>
                <strong>{plannedRoute.fileName ?? t("rides.gpxSelected")}</strong>
                <small>{t("rides.gpxPointCount").replace("{count}", plannedRoute.pointCount.toLocaleString())}</small>
              </div>
              <RoutePreview points={routePreviewPoints} label={t("rides.gpxSelected")} />
              <button
                className="bike-app-button bike-app-button-secondary bike-app-button-small"
                type="button"
                onClick={() => {
                  setPlannedRoute(null);
                  setGpxError(null);
                }}
              >
                {t("rides.gpxRemove")}
              </button>
            </div>
          ) : null}
        </div>
        <label className="bike-app-field">
          <span>{t("rides.descriptionLabel")}</span>
          <textarea
            name="description"
            value={description}
            maxLength={1000}
            placeholder={t("rides.descriptionPlaceholder")}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
      </div>

      <div className="bike-app-actions">
        <CreateRideSubmitButton
          key={actionState.attempt}
          mode={mode}
          blocked={gpxImporting}
          nowLabel={t("rides.submitNow")}
          plannedLabel={t("rides.submitPlanned")}
          pendingLabel={t("rides.creating")}
        />
      </div>
    </form>
  );
}
