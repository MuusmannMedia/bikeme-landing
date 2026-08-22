import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createViewerAccess } from "./app-access";
import type {
  Hotspot,
  RideDetail,
  RideDiscipline,
  RideHistoryDetail,
  RideHistorySummary,
  RideInterest,
  RideInvite,
  RideParticipant,
  RiderConnection,
  RiderProfile,
  RideSummary,
  RoutePoint,
  StatusHistoryRide,
  Viewer,
  ViewerProfile,
  ZoneDistribution
} from "./app-model";

type Client = SupabaseClient;

export class AppDataError extends Error {
  readonly code: "UNAUTHENTICATED" | "NOT_FOUND" | "LOAD_FAILED";

  constructor(code: AppDataError["code"]) {
    super(code);
    this.name = "AppDataError";
    this.code = code;
  }
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function nullableNumber(value: unknown): number | null {
  if (value == null) return null;
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function safeDiscipline(value: unknown): RideDiscipline {
  return value === "GRAVEL" || value === "MTB" || value === "CITY" ? value : "ROAD";
}

function normalizeProfile(row: Record<string, unknown>): RiderProfile {
  return {
    id: String(row.id ?? ""),
    displayName: nullableString(row.display_name),
    avatarUrl: nullableString(row.avatar_url),
    level: nullableString(row.level_desc),
    region: nullableString(row.home_region),
    about: nullableString(row.about_me)
  };
}

function normalizeViewerProfile(userId: string, row: Record<string, unknown> | null): ViewerProfile {
  const unitSystem = row?.unit_system === "imperial" ? "imperial" : "metric";
  return {
    id: userId,
    displayName: nullableString(row?.display_name),
    avatarUrl: nullableString(row?.avatar_url),
    bikeTypes: Array.isArray(row?.bike_type)
      ? row.bike_type.filter((value): value is string => typeof value === "string")
      : [],
    level: nullableString(row?.level_desc),
    region: nullableString(row?.home_region),
    about: nullableString(row?.about_me),
    unitSystem,
    heightCm: nullableNumber(row?.height_cm),
    weightKg: nullableNumber(row?.weight_kg),
    ftp: nullableNumber(row?.ftp),
    hideStartEnd: row?.hide_start_end === true
  };
}

export async function loadViewer(client: Client): Promise<Viewer> {
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData.user) throw new AppDataError("UNAUTHENTICATED");
  const userId = userData.user.id;

  const profileBaseFields = ["id", "display_name", "avatar_url", "bike_type", "level_desc", "home_region"];
  const profileOptionalFields = ["about_me", "unit_system", "height_cm", "weight_kg", "ftp", "hide_start_end"];
  let profileFields = [...profileBaseFields, ...profileOptionalFields];
  let profileData: Record<string, unknown> | null = null;
  let profileFailed = false;
  while (profileData == null && !profileFailed) {
    const response = await client.from("profiles").select(profileFields.join(",")).eq("id", userId).maybeSingle();
    if (!response.error) {
      profileData = response.data as Record<string, unknown> | null;
      if (!profileData) profileFailed = true;
      break;
    }
    const message = `${response.error.message ?? ""} ${response.error.details ?? ""}`.toLowerCase();
    const missing = profileOptionalFields.filter((field) => profileFields.includes(field) && message.includes(field));
    if (missing.length === 0) profileFailed = true;
    else profileFields = profileFields.filter((field) => !missing.includes(field));
  }

  const [accessResponse, founderResponse] = await Promise.all([
    client
      .from("user_access")
      .select("access_level,access_expires_at")
      .eq("user_id", userId)
      .maybeSingle(),
    client
      .from("founding_riders")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle()
  ]);

  if (profileFailed || !profileData) throw new AppDataError("LOAD_FAILED");

  const profileRow = profileData;
  const accessRow = accessResponse.error
    ? null
    : accessResponse.data as Record<string, unknown> | null;
  const isFoundingRider = !founderResponse.error && Boolean(founderResponse.data);

  return {
    userId,
    profile: normalizeViewerProfile(userId, profileRow),
    access: createViewerAccess(
      accessRow?.access_level,
      accessRow?.access_expires_at,
      isFoundingRider
    )
  };
}

async function loadProfilesById(client: Client, ids: string[]): Promise<Map<string, RiderProfile>> {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (uniqueIds.length === 0) return new Map();
  const { data, error } = await client
    .from("profiles")
    .select("id,display_name,avatar_url,level_desc,home_region,about_me")
    .in("id", uniqueIds);
  if (error) throw new AppDataError("LOAD_FAILED");
  return new Map(
    ((data ?? []) as Record<string, unknown>[]).map((row) => {
      const profile = normalizeProfile(row);
      return [profile.id, profile];
    })
  );
}

function normalizeRide(
  row: Record<string, unknown>,
  hostName: string | null,
  joinedIds: Set<string>
): RideSummary {
  const participants = Array.isArray(row.participants) ? row.participants : [];
  const countValue = participants[0] && typeof participants[0] === "object"
    ? (participants[0] as Record<string, unknown>).count
    : 0;
  return {
    id: String(row.id ?? ""),
    hostId: String(row.host_id ?? ""),
    hostName,
    type: row.type === "PING" ? "PING" : "EVENT",
    status: row.status === "CANCELLED" || row.status === "COMPLETED" ? row.status : "ACTIVE",
    visibility: row.visibility === "private" ? "private" : "public",
    title: String(row.title ?? ""),
    description: nullableString(row.description),
    startTime: String(row.start_time ?? ""),
    expiresAt: nullableString(row.expires_at),
    discipline: safeDiscipline(row.discipline),
    pace: nullableString(row.pace_text),
    distanceKm: nullableNumber(row.distance_km),
    meetingAddress: nullableString(row.meeting_address),
    maxParticipants: nullableNumber(row.max_participants),
    participantCount: nullableNumber(countValue) ?? 0,
    joined: joinedIds.has(String(row.id ?? "")),
    hotspotId: nullableString(row.hotspot_id)
  };
}

const rideProjection = "id,host_id,type,status,visibility,title,description,start_time,expires_at,discipline,pace_text,distance_km,meeting_address,max_participants,hotspot_id,participants(count)";

export async function listAuthorizedRides(client: Client, userId: string): Promise<RideSummary[]> {
  const nowIso = new Date().toISOString();
  const [ridesResponse, joinedResponse] = await Promise.all([
    client
      .from("rides")
      .select(rideProjection)
      .eq("status", "ACTIVE")
      .gt("expires_at", nowIso)
      .order("start_time", { ascending: true })
      .limit(200),
    client
      .from("participants")
      .select("ride_id")
      .eq("user_id", userId)
      .in("status", ["joined", "checked_in", "active", "completed"])
  ]);
  if (ridesResponse.error || joinedResponse.error) throw new AppDataError("LOAD_FAILED");
  const rows = (ridesResponse.data ?? []) as unknown as Record<string, unknown>[];
  const hostIds = rows.map((row) => String(row.host_id ?? ""));
  const profiles = await loadProfilesById(client, hostIds);
  const joinedIds = new Set(
    ((joinedResponse.data ?? []) as Record<string, unknown>[]).map((row) => String(row.ride_id ?? ""))
  );
  return rows.map((row) => normalizeRide(
    row,
    profiles.get(String(row.host_id ?? ""))?.displayName ?? null,
    joinedIds
  ));
}

export async function listHotspots(client: Client): Promise<Hotspot[]> {
  const { data, error } = await client
    .from("ride_hotspots")
    .select("id,name,description,address,latitude,longitude,region_label,default_discipline,default_distance_km,default_speed_kmh")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) throw new AppDataError("LOAD_FAILED");
  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    description: nullableString(row.description),
    address: nullableString(row.address),
    latitude: nullableNumber(row.latitude),
    longitude: nullableNumber(row.longitude),
    region: String(row.region_label ?? ""),
    defaultDiscipline: row.default_discipline == null ? null : safeDiscipline(row.default_discipline),
    defaultDistanceKm: nullableNumber(row.default_distance_km),
    defaultSpeedKmh: nullableNumber(row.default_speed_kmh)
  }));
}

function normalizeRoute(value: unknown): RoutePoint[] {
  let candidate = value;
  if (typeof candidate === "string") {
    try {
      candidate = JSON.parse(candidate);
    } catch {
      return [];
    }
  }
  if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
    const coordinates = (candidate as { coordinates?: unknown }).coordinates;
    if (Array.isArray(coordinates)) candidate = coordinates;
  }
  if (!Array.isArray(candidate)) return [];
  return candidate.flatMap((entry): RoutePoint[] => {
    if (Array.isArray(entry) && entry.length >= 2) {
      const longitude = nullableNumber(entry[0]);
      const latitude = nullableNumber(entry[1]);
      if (latitude == null || longitude == null || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return [];
      return [{ latitude, longitude, recordedAt: null, elevation: null, altitudeAccuracy: null, startsNewSegment: false }];
    }
    if (!entry || typeof entry !== "object") return [];
    const row = entry as Record<string, unknown>;
    const geometry = row.geometry && typeof row.geometry === "object" ? row.geometry as Record<string, unknown> : null;
    const nested = Array.isArray(row.coordinates) && row.coordinates.length >= 2
      ? row.coordinates
      : Array.isArray(geometry?.coordinates) && geometry.coordinates.length >= 2
        ? geometry.coordinates
        : Array.isArray(row.lonlat) && row.lonlat.length >= 2
          ? row.lonlat
          : null;
    const latitude = nullableNumber(row.latitude ?? row.lat ?? nested?.[1]);
    const longitude = nullableNumber(row.longitude ?? row.lng ?? row.lon ?? nested?.[0]);
    if (latitude == null || longitude == null || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return [];
    }
    return [{
      latitude,
      longitude,
      recordedAt: nullableString(row.recorded_at),
      elevation: nullableNumber(row.altitude ?? row.altitude_m ?? row.altitudeMeters ?? row.elevation ?? row.elevation_m ?? row.elevation_meters),
      altitudeAccuracy: nullableNumber(row.altitude_accuracy ?? row.altitudeAccuracy ?? row.altitudeAccuracyMeters),
      startsNewSegment: row.starts_new_segment === true
    }];
  });
}

export async function loadRideDetail(client: Client, userId: string, rideId: string): Promise<RideDetail> {
  const [rideResponse, joinedResponse, routeResponse, participantResponse, inviteResponse] = await Promise.all([
    client.from("rides").select(rideProjection).eq("id", rideId).maybeSingle(),
    client.from("participants").select("ride_id").eq("ride_id", rideId).eq("user_id", userId).maybeSingle(),
    client.from("ride_planned_routes").select("route_coordinates").eq("ride_id", rideId).maybeSingle(),
    client.from("participants").select("user_id,role,status,joined_at").eq("ride_id", rideId).order("joined_at"),
    client.from("ride_invites").select("ride_id,host_id,invitee_id,created_at,accepted_at,declined_at").eq("ride_id", rideId).order("created_at")
  ]);
  if (rideResponse.error || !rideResponse.data) throw new AppDataError(rideResponse.error ? "LOAD_FAILED" : "NOT_FOUND");
  if (participantResponse.error) throw new AppDataError("LOAD_FAILED");
  const rideRow = rideResponse.data as unknown as Record<string, unknown>;
  const participantRows = (participantResponse.data ?? []) as Record<string, unknown>[];
  const inviteRows = inviteResponse.error ? [] : (inviteResponse.data ?? []) as Record<string, unknown>[];
  const profileIds = [
    String(rideRow.host_id ?? ""),
    ...participantRows.map((row) => String(row.user_id ?? "")),
    ...inviteRows.map((row) => String(row.invitee_id ?? ""))
  ];
  const profiles = await loadProfilesById(client, profileIds);
  const joinedIds = new Set(joinedResponse.data ? [rideId] : []);
  const ride = normalizeRide(rideRow, profiles.get(String(rideRow.host_id ?? ""))?.displayName ?? null, joinedIds);
  const participants: RideParticipant[] = participantRows.map((row) => {
    const profile = profiles.get(String(row.user_id ?? "")) ?? normalizeProfile({ id: row.user_id });
    return {
      ...profile,
      role: row.role === "HOST" ? "HOST" : "RIDER",
      status: row.status === "checked_in" || row.status === "active" || row.status === "completed" ? row.status : "joined",
      joinedAt: nullableString(row.joined_at)
    };
  });
  if (!participants.some((participant) => participant.id === ride.hostId)) {
    const host = profiles.get(ride.hostId) ?? normalizeProfile({ id: ride.hostId });
    participants.unshift({ ...host, role: "HOST", status: "joined", joinedAt: null });
  }
  const invites = inviteRows.map((row): RideInvite => ({
    rideId,
    hostId: String(row.host_id ?? ""),
    inviteeId: String(row.invitee_id ?? ""),
    createdAt: String(row.created_at ?? ""),
    acceptedAt: nullableString(row.accepted_at),
    declinedAt: nullableString(row.declined_at),
    rideTitle: ride.title,
    rideStartTime: ride.startTime,
    counterpart: profiles.get(String(row.invitee_id ?? "")) ?? null,
    direction: "sent"
  }));
  const routeRow = routeResponse.error ? null : routeResponse.data as Record<string, unknown> | null;
  return { ...ride, participants, invites, route: normalizeRoute(routeRow?.route_coordinates) };
}

export async function listConnections(client: Client, userId: string): Promise<RiderConnection[]> {
  const { data, error } = await client
    .from("rider_connections")
    .select("id,requester_id,receiver_id,status,created_at,updated_at")
    .or(`requester_id.eq.${userId},receiver_id.eq.${userId}`)
    .order("updated_at", { ascending: false });
  if (error) throw new AppDataError("LOAD_FAILED");
  const rows = (data ?? []) as Record<string, unknown>[];
  const counterpartIds = rows.map((row) => String(
    row.requester_id === userId ? row.receiver_id : row.requester_id
  ));
  const profiles = await loadProfilesById(client, counterpartIds);
  return rows.flatMap((row): RiderConnection[] => {
    const requesterId = String(row.requester_id ?? "");
    const receiverId = String(row.receiver_id ?? "");
    const counterpartId = requesterId === userId ? receiverId : requesterId;
    const counterpart = profiles.get(counterpartId);
    if (!counterpart || (row.status !== "accepted" && row.status !== "pending")) return [];
    return [{
      id: String(row.id ?? ""),
      requesterId,
      receiverId,
      status: row.status,
      createdAt: String(row.created_at ?? ""),
      updatedAt: String(row.updated_at ?? ""),
      state: row.status === "accepted"
        ? "accepted"
        : receiverId === userId
          ? "pending_incoming"
          : "pending_outgoing",
      counterpart
    }];
  });
}

export async function searchRiders(client: Client, userId: string, query: string): Promise<RiderProfile[]> {
  const normalized = query.trim();
  if (normalized.length < 2 || normalized.length > 80) return [];
  const { data, error } = await client.rpc("search_riders", {
    search_query: normalized,
    result_limit: 30
  });
  if (error) throw new AppDataError("LOAD_FAILED");
  return ((data ?? []) as Record<string, unknown>[])
    .map(normalizeProfile)
    .filter((profile) => profile.id && profile.id !== userId);
}

export async function listInviteableRiders(client: Client, userId: string): Promise<RiderProfile[]> {
  const { data, error } = await client
    .from("profiles")
    .select("id,display_name,avatar_url,level_desc,home_region")
    .neq("id", userId)
    .order("display_name", { ascending: true, nullsFirst: false })
    .limit(500);
  if (error) throw new AppDataError("LOAD_FAILED");
  return ((data ?? []) as Record<string, unknown>[])
    .map(normalizeProfile)
    .filter((profile) => profile.id && profile.id !== userId);
}

export async function listRideInvites(client: Client, userId: string): Promise<RideInvite[]> {
  const { data, error } = await client
    .from("ride_invites")
    .select("ride_id,host_id,invitee_id,created_at,accepted_at,declined_at")
    .or(`host_id.eq.${userId},invitee_id.eq.${userId}`)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new AppDataError("LOAD_FAILED");
  const rows = (data ?? []) as Record<string, unknown>[];
  const rideIds = [...new Set(rows.map((row) => String(row.ride_id ?? "")))];
  const counterpartIds = rows.map((row) => String(row.invitee_id === userId ? row.host_id : row.invitee_id));
  const [profiles, ridesResponse] = await Promise.all([
    loadProfilesById(client, counterpartIds),
    rideIds.length
      ? client.from("rides").select("id,title,start_time").in("id", rideIds)
      : Promise.resolve({ data: [], error: null })
  ]);
  if (ridesResponse.error) throw new AppDataError("LOAD_FAILED");
  const rides = new Map(((ridesResponse.data ?? []) as Record<string, unknown>[]).map((row) => [String(row.id), row]));
  return rows.map((row) => {
    const direction = row.invitee_id === userId ? "received" as const : "sent" as const;
    const counterpartId = String(direction === "received" ? row.host_id : row.invitee_id);
    const ride = rides.get(String(row.ride_id ?? ""));
    return {
      rideId: String(row.ride_id ?? ""),
      hostId: String(row.host_id ?? ""),
      inviteeId: String(row.invitee_id ?? ""),
      createdAt: String(row.created_at ?? ""),
      acceptedAt: nullableString(row.accepted_at),
      declinedAt: nullableString(row.declined_at),
      rideTitle: nullableString(ride?.title),
      rideStartTime: nullableString(ride?.start_time),
      counterpart: profiles.get(counterpartId) ?? null,
      direction
    };
  });
}

export async function listRideInterest(client: Client, userId: string): Promise<RideInterest[]> {
  const { data, error } = await client
    .from("ride_interest_requests")
    .select("id,sender_user_id,recipient_user_id,time_option,window_start_date,window_end_date,timezone,preferred_time,response_status,expires_at,created_ride_id,sender_hidden_at,recipient_hidden_at,created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new AppDataError("LOAD_FAILED");
  const rows = ((data ?? []) as Record<string, unknown>[]).filter((row) => (
    row.sender_user_id === userId ? row.sender_hidden_at == null : row.recipient_hidden_at == null
  ));
  const counterpartIds = rows.map((row) => String(row.sender_user_id === userId ? row.recipient_user_id : row.sender_user_id));
  const profiles = await loadProfilesById(client, counterpartIds);
  return rows.map((row) => {
    const direction = row.recipient_user_id === userId ? "received" as const : "sent" as const;
    const counterpartId = String(direction === "received" ? row.sender_user_id : row.recipient_user_id);
    const timeOption = row.time_option === "tomorrow" || row.time_option === "this_weekend" || row.time_option === "custom_date"
      ? row.time_option
      : "today";
    const responseStatus = row.response_status === "interested" || row.response_status === "maybe" || row.response_status === "declined" || row.response_status === "cancelled" || row.response_status === "converted"
      ? row.response_status
      : "pending";
    return {
      id: String(row.id ?? ""),
      senderId: String(row.sender_user_id ?? ""),
      recipientId: String(row.recipient_user_id ?? ""),
      direction,
      counterpart: profiles.get(counterpartId) ?? null,
      timeOption,
      windowStartDate: String(row.window_start_date ?? ""),
      windowEndDate: String(row.window_end_date ?? ""),
      timezone: String(row.timezone ?? "UTC"),
      preferredTime: nullableString(row.preferred_time),
      responseStatus,
      expiresAt: String(row.expires_at ?? ""),
      expired: !Number.isFinite(Date.parse(String(row.expires_at ?? ""))) || Date.parse(String(row.expires_at ?? "")) <= Date.now(),
      createdRideId: nullableString(row.created_ride_id),
      createdAt: String(row.created_at ?? "")
    };
  });
}

const historyBaseFields = ["id", "started_at", "title", "discipline", "start_address", "distance_km", "duration_minutes", "participant_count"];
const historyOptionalSummaryFields = ["elevation_gain", "average_watts", "max_watts", "calories_kcal"];

function normalizeHistory(row: Record<string, unknown>): RideHistorySummary {
  return {
    id: String(row.id ?? ""),
    startedAt: String(row.started_at ?? ""),
    title: String(row.title ?? ""),
    discipline: safeDiscipline(row.discipline),
    startAddress: nullableString(row.start_address),
    distanceKm: nullableNumber(row.distance_km),
    durationMinutes: nullableNumber(row.duration_minutes),
    elevationGain: nullableNumber(row.elevation_gain),
    averageWatts: nullableNumber(row.average_watts),
    maxWatts: nullableNumber(row.max_watts),
    caloriesKcal: nullableNumber(row.calories_kcal),
    participantCount: nullableNumber(row.participant_count)
  };
}

export async function listRideHistory(client: Client, userId: string, limit = 200): Promise<RideHistorySummary[]> {
  let fields = [...historyBaseFields, ...historyOptionalSummaryFields];
  while (true) {
    const { data, error } = await client
      .from("ride_history")
      .select(fields.join(","))
      .eq("owner_id", userId)
      .order("started_at", { ascending: false })
      .limit(limit);
    if (!error) return ((data ?? []) as unknown as Record<string, unknown>[]).map(normalizeHistory);
    const message = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
    const missing = historyOptionalSummaryFields.filter((field) => fields.includes(field) && message.includes(field));
    if (missing.length === 0) throw new AppDataError("LOAD_FAILED");
    fields = fields.filter((field) => !missing.includes(field));
  }
}

const statusOptionalFields = [
  ...historyOptionalSummaryFields,
  "route_coordinates",
  "route_data",
  "zone_distribution"
];

function normalizeStatusHistory(row: Record<string, unknown>): StatusHistoryRide {
  const primaryRoute = normalizeRoute(row.route_coordinates);
  return {
    ...normalizeHistory(row),
    route: primaryRoute.length > 0 ? primaryRoute : normalizeRoute(row.route_data),
    zones: normalizeZones(row.zone_distribution)
  };
}

/**
 * Loads the complete owner-scoped Status dataset in read-only pages. The
 * projection is intentionally separate from the lightweight History list DTO.
 */
export async function listStatusHistory(client: Client, userId: string): Promise<StatusHistoryRide[]> {
  const pageSize = 1000;
  let fields = [...historyBaseFields, ...statusOptionalFields];

  while (true) {
    const rows: Record<string, unknown>[] = [];
    let restartWithReducedProjection = false;

    for (let from = 0; ; from += pageSize) {
      const { data, error } = await client
        .from("ride_history")
        .select(fields.join(","))
        .eq("owner_id", userId)
        .order("started_at", { ascending: false })
        .range(from, from + pageSize - 1);

      if (error) {
        const message = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
        const missing = statusOptionalFields.filter((field) => fields.includes(field) && message.includes(field));
        if (missing.length === 0) throw new AppDataError("LOAD_FAILED");
        fields = fields.filter((field) => !missing.includes(field));
        restartWithReducedProjection = true;
        break;
      }

      const page = (data ?? []) as unknown as Record<string, unknown>[];
      rows.push(...page);
      if (page.length < pageSize) return rows.map(normalizeStatusHistory);
    }

    if (!restartWithReducedProjection) return rows.map(normalizeStatusHistory);
  }
}

function normalizeZones(value: unknown): ZoneDistribution | null {
  let candidate = value;
  if (typeof candidate === "string") {
    try {
      candidate = JSON.parse(candidate);
    } catch {
      return null;
    }
  }
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return null;
  const row = candidate as Record<string, unknown>;
  return {
    z1: nullableNumber(row.z1) ?? 0,
    z2: nullableNumber(row.z2) ?? 0,
    z3: nullableNumber(row.z3) ?? 0,
    z4: nullableNumber(row.z4) ?? 0,
    z5: nullableNumber(row.z5) ?? 0,
    z6: nullableNumber(row.z6) ?? 0,
    z7: nullableNumber(row.z7) ?? 0
  };
}

export async function loadRideHistoryDetail(client: Client, userId: string, historyId: string): Promise<RideHistoryDetail> {
  const detailBase = [...historyBaseFields, "notes", "mood_key", "route_link"];
  const detailOptional = [...historyOptionalSummaryFields, "route_coordinates", "route_data", "zone_distribution"];
  let fields = [...detailBase, ...detailOptional];
  let row: Record<string, unknown> | null = null;
  while (!row) {
    const { data, error } = await client
      .from("ride_history")
      .select(fields.join(","))
      .eq("id", historyId)
      .eq("owner_id", userId)
      .maybeSingle();
    if (!error) {
      if (!data) throw new AppDataError("NOT_FOUND");
      row = data as unknown as Record<string, unknown>;
      break;
    }
    const message = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
    const missing = detailOptional.filter((field) => fields.includes(field) && message.includes(field));
    if (missing.length === 0) throw new AppDataError("LOAD_FAILED");
    fields = fields.filter((field) => !missing.includes(field));
  }
  const route = normalizeRoute(row.route_coordinates);
  return {
    ...normalizeHistory(row),
    notes: nullableString(row.notes),
    mood: nullableString(row.mood_key),
    routeLink: nullableString(row.route_link),
    route: route.length > 0 ? route : normalizeRoute(row.route_data),
    zones: normalizeZones(row.zone_distribution)
  };
}
