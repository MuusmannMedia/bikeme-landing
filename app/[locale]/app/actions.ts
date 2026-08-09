"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getSafeLocale, getSafeReturnPath } from "@/lib/auth";
import type { Locale } from "@/lib/locales";
import { getSupabaseEnvironment } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
const allowedDisciplines = new Set(["ROAD", "GRAVEL", "MTB", "CITY"]);
const allowedVisibility = new Set(["public", "private"]);
const allowedInterestOptions = new Set(["today", "tomorrow", "this_weekend", "custom_date"]);
const allowedInterestResponses = new Set(["interested", "maybe", "declined"]);
const allowedConnectionResponses = new Set(["accepted", "declined"]);

type ActionContext = {
  locale: Locale;
  returnTo: string;
  client: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  accessToken: string;
};

function textValue(formData: FormData, key: string, maxLength: number): string | null {
  const value = formData.get(key);
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\r\n/g, "\n");
  return normalized.length > 0 && normalized.length <= maxLength ? normalized : null;
}

function optionalTextValue(formData: FormData, key: string, maxLength: number): string | null {
  const value = formData.get(key);
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\r\n/g, "\n");
  return normalized.length === 0 ? null : normalized.length <= maxLength ? normalized : null;
}

function uuidValue(formData: FormData, key: string): string | null {
  const value = textValue(formData, key, 36);
  return value && uuidPattern.test(value) ? value : null;
}

function numberValue(
  formData: FormData,
  key: string,
  minimum: number,
  maximum: number,
  optional = false
): number | null {
  const raw = formData.get(key);
  if (optional && (raw == null || raw === "")) return null;
  const value = typeof raw === "string" ? Number(raw.replace(",", ".")) : NaN;
  return Number.isFinite(value) && value >= minimum && value <= maximum ? value : null;
}

function withNotice(locale: Locale, returnTo: string, notice: string): string {
  const safe = getSafeReturnPath(locale, returnTo);
  const url = new URL(safe, "https://bikeme.invalid");
  url.searchParams.set("notice", notice);
  return `${url.pathname}${url.search}`;
}

async function getActionContext(formData: FormData): Promise<ActionContext | null> {
  const locale = getSafeLocale(formData.get("locale"));
  const returnTo = getSafeReturnPath(locale, formData.get("returnTo"));
  try {
    const client = await createClient();
    const [{ data: userData, error: userError }, { data: sessionData, error: sessionError }] = await Promise.all([
      client.auth.getUser(),
      client.auth.getSession()
    ]);
    const accessToken = sessionData.session?.access_token?.trim() ?? "";
    if (userError || sessionError || !userData.user || !accessToken) return null;
    return { locale, returnTo, client, userId: userData.user.id, accessToken };
  } catch {
    return null;
  }
}

async function callEdgeFunction(
  context: ActionContext,
  functionName: string,
  body: Record<string, unknown>
): Promise<Record<string, unknown> | null> {
  const environment = getSupabaseEnvironment();
  if (!environment || !/^[a-z0-9_]{1,80}$/.test(functionName)) return null;
  try {
    const response = await fetch(`${environment.url.replace(/\/$/, "")}/functions/v1/${functionName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${context.accessToken}`,
        apikey: environment.publishableKey
      },
      body: JSON.stringify(body),
      cache: "no-store"
    });
    const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
    return response.ok && payload?.success === true ? payload : null;
  } catch {
    return null;
  }
}

function revalidateApp(locale: Locale, paths: string[] = []) {
  revalidatePath(`/${locale}/app`);
  paths.forEach((path) => revalidatePath(path));
}

function redirectResult(context: Pick<ActionContext, "locale" | "returnTo">, notice: string): never {
  redirect(withNotice(context.locale, context.returnTo, notice));
}

export async function logoutAction(formData: FormData): Promise<void> {
  const locale = getSafeLocale(formData.get("locale"));

  if (getSupabaseEnvironment()) {
    try {
      const supabase = await createClient();
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      // Keep the response generic and return to the public localized page.
    }
  }

  redirect(`/${locale}`);
}

export async function joinRideAction(formData: FormData): Promise<void> {
  const context = await getActionContext(formData);
  if (!context) redirect(`/${getSafeLocale(formData.get("locale"))}/login`);
  const rideId = uuidValue(formData, "rideId");
  if (!rideId) redirectResult(context, "invalid");
  const { error } = await context.client.from("participants").insert({
    ride_id: rideId,
    user_id: context.userId,
    role: "RIDER",
    status: "joined"
  });
  if (error && error.code !== "23505") redirectResult(context, error.code === "42501" ? "forbidden" : "error");
  await callEdgeFunction(context, "notify_ride_join", { rideId });
  revalidateApp(context.locale, [`/${context.locale}/app/rides/${rideId}`]);
  redirectResult(context, "done");
}

export async function leaveRideAction(formData: FormData): Promise<void> {
  const context = await getActionContext(formData);
  if (!context) redirect(`/${getSafeLocale(formData.get("locale"))}/login`);
  const rideId = uuidValue(formData, "rideId");
  if (!rideId) redirectResult(context, "invalid");
  const { error } = await context.client
    .from("participants")
    .delete()
    .eq("ride_id", rideId)
    .eq("user_id", context.userId)
    .eq("role", "RIDER");
  if (error) redirectResult(context, error.code === "42501" ? "forbidden" : "error");
  revalidateApp(context.locale, [`/${context.locale}/app/rides/${rideId}`]);
  redirectResult(context, "done");
}

async function updateRideInvite(formData: FormData, accepted: boolean): Promise<never> {
  const context = await getActionContext(formData);
  if (!context) redirect(`/${getSafeLocale(formData.get("locale"))}/login`);
  const rideId = uuidValue(formData, "rideId");
  if (!rideId) redirectResult(context, "invalid");
  const now = new Date().toISOString();
  const { error } = await context.client
    .from("ride_invites")
    .update(accepted ? { accepted_at: now, declined_at: null } : { accepted_at: null, declined_at: now })
    .eq("ride_id", rideId)
    .eq("invitee_id", context.userId)
    .is("accepted_at", null)
    .is("declined_at", null);
  if (error) redirectResult(context, error.code === "42501" ? "forbidden" : "error");
  revalidateApp(context.locale, [`/${context.locale}/app/requests`, `/${context.locale}/app/rides/${rideId}`]);
  redirectResult(context, "done");
}

export async function acceptRideInviteAction(formData: FormData): Promise<void> {
  await updateRideInvite(formData, true);
}

export async function declineRideInviteAction(formData: FormData): Promise<void> {
  await updateRideInvite(formData, false);
}

async function loadHotspotCoordinates(context: ActionContext, hotspotId: string) {
  const { data, error } = await context.client
    .from("ride_hotspots")
    .select("id,name,address,latitude,longitude")
    .eq("id", hotspotId)
    .eq("is_active", true)
    .maybeSingle();
  if (error || !data) return null;
  const latitude = Number(data.latitude);
  const longitude = Number(data.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return {
    latitude,
    longitude,
    address: typeof data.address === "string" && data.address.trim() ? data.address.trim() : String(data.name ?? "")
  };
}

function rideInput(formData: FormData) {
  const title = textValue(formData, "title", 120);
  const description = optionalTextValue(formData, "description", 1000);
  const startTimeIso = textValue(formData, "startTimeIso", 40);
  const startTime = startTimeIso ? new Date(startTimeIso) : null;
  const discipline = textValue(formData, "discipline", 10);
  const visibility = textValue(formData, "visibility", 10);
  const paceText = optionalTextValue(formData, "paceText", 80);
  const distanceKm = numberValue(formData, "distanceKm", 0, 500, true);
  const maxParticipants = numberValue(formData, "maxParticipants", 2, 200, true);
  const durationMinutes = numberValue(formData, "durationMinutes", 30, 480) ?? 120;
  if (
    !title || !startTime || !Number.isFinite(startTime.getTime()) ||
    !discipline || !allowedDisciplines.has(discipline) ||
    !visibility || !allowedVisibility.has(visibility)
  ) return null;
  return { title, description, startTime, discipline, visibility, paceText, distanceKm, maxParticipants, durationMinutes };
}

export async function createRideAction(formData: FormData): Promise<void> {
  const context = await getActionContext(formData);
  if (!context) redirect(`/${getSafeLocale(formData.get("locale"))}/login`);
  const hotspotId = uuidValue(formData, "hotspotId");
  const input = rideInput(formData);
  const type = textValue(formData, "type", 10);
  if (!hotspotId || !input || (type !== "PING" && type !== "EVENT")) redirectResult(context, "invalid");
  const hotspot = await loadHotspotCoordinates(context, hotspotId);
  if (!hotspot) redirectResult(context, "invalid");
  const expiresAt = new Date(input.startTime.getTime() + (type === "PING" ? 120 : input.durationMinutes) * 60_000);
  const { data, error } = await context.client
    .from("rides")
    .insert({
      host_id: context.userId,
      type,
      status: "ACTIVE",
      title: input.title,
      description: input.description,
      start_time: input.startTime.toISOString(),
      expires_at: expiresAt.toISOString(),
      latitude: hotspot.latitude,
      longitude: hotspot.longitude,
      meeting_address: hotspot.address,
      discipline: input.discipline,
      pace_text: input.paceText,
      distance_km: input.distanceKm,
      max_participants: input.maxParticipants,
      visibility: input.visibility,
      hotspot_id: hotspotId
    })
    .select("id")
    .single();
  if (error || !data?.id) redirectResult(context, error?.code === "42501" ? "forbidden" : "error");
  if (input.visibility === "public") await callEdgeFunction(context, "notify_nearby_ride", { rideId: data.id });
  revalidateApp(context.locale, [`/${context.locale}/app/rides`]);
  redirect(withNotice(context.locale, `/${context.locale}/app/rides/${data.id}`, "created"));
}

export async function updateRideAction(formData: FormData): Promise<void> {
  const context = await getActionContext(formData);
  if (!context) redirect(`/${getSafeLocale(formData.get("locale"))}/login`);
  const rideId = uuidValue(formData, "rideId");
  const input = rideInput(formData);
  if (!rideId || !input) redirectResult(context, "invalid");
  const { data: current, error: currentError } = await context.client
    .from("rides")
    .select("type")
    .eq("id", rideId)
    .eq("host_id", context.userId)
    .maybeSingle();
  if (currentError || !current) redirectResult(context, currentError?.code === "42501" ? "forbidden" : "error");
  const expiresAt = new Date(input.startTime.getTime() + (current.type === "PING" ? 120 : input.durationMinutes) * 60_000);
  const { error } = await context.client
    .from("rides")
    .update({
      title: input.title,
      description: input.description,
      start_time: input.startTime.toISOString(),
      expires_at: expiresAt.toISOString(),
      discipline: input.discipline,
      pace_text: input.paceText,
      distance_km: input.distanceKm,
      max_participants: input.maxParticipants,
      visibility: input.visibility
    })
    .eq("id", rideId)
    .eq("host_id", context.userId);
  if (error) redirectResult(context, error.code === "42501" ? "forbidden" : "error");
  revalidateApp(context.locale, [`/${context.locale}/app/rides`, `/${context.locale}/app/rides/${rideId}`]);
  redirectResult(context, "updated");
}

export async function cancelRideAction(formData: FormData): Promise<void> {
  const context = await getActionContext(formData);
  if (!context) redirect(`/${getSafeLocale(formData.get("locale"))}/login`);
  const rideId = uuidValue(formData, "rideId");
  if (!rideId) redirectResult(context, "invalid");
  const { error } = await context.client
    .from("rides")
    .update({ status: "CANCELLED" })
    .eq("id", rideId)
    .eq("host_id", context.userId)
    .eq("status", "ACTIVE");
  if (error) redirectResult(context, error.code === "42501" ? "forbidden" : "error");
  revalidateApp(context.locale, [`/${context.locale}/app/rides`]);
  redirect(withNotice(context.locale, `/${context.locale}/app/rides`, "done"));
}

export async function inviteRiderAction(formData: FormData): Promise<void> {
  const context = await getActionContext(formData);
  if (!context) redirect(`/${getSafeLocale(formData.get("locale"))}/login`);
  const rideId = uuidValue(formData, "rideId");
  const inviteeId = uuidValue(formData, "inviteeId");
  if (!rideId || !inviteeId || inviteeId === context.userId) redirectResult(context, "invalid");
  const { data: connection, error: connectionError } = await context.client
    .from("rider_connections")
    .select("id")
    .eq("status", "accepted")
    .or(`and(requester_id.eq.${context.userId},receiver_id.eq.${inviteeId}),and(requester_id.eq.${inviteeId},receiver_id.eq.${context.userId})`)
    .limit(1)
    .maybeSingle();
  if (connectionError || !connection) redirectResult(context, "forbidden");
  const { error } = await context.client.from("ride_invites").upsert({
    ride_id: rideId,
    host_id: context.userId,
    invitee_id: inviteeId
  }, { onConflict: "ride_id,invitee_id", ignoreDuplicates: true });
  if (error) redirectResult(context, error.code === "42501" ? "forbidden" : "error");
  await callEdgeFunction(context, "notify_ride_invite", { rideId, inviteeUserIds: [inviteeId] });
  revalidateApp(context.locale, [`/${context.locale}/app/rides/${rideId}`, `/${context.locale}/app/requests`]);
  redirectResult(context, "done");
}

export async function sendConnectionAction(formData: FormData): Promise<void> {
  const context = await getActionContext(formData);
  if (!context) redirect(`/${getSafeLocale(formData.get("locale"))}/login`);
  const recipientUserId = uuidValue(formData, "recipientUserId");
  if (!recipientUserId || recipientUserId === context.userId) redirectResult(context, "invalid");
  const result = await callEdgeFunction(context, "send_rider_connection_request", { recipientUserId });
  if (!result) redirectResult(context, "error");
  revalidateApp(context.locale, [`/${context.locale}/app/riders`]);
  redirectResult(context, "done");
}

export async function respondConnectionAction(formData: FormData): Promise<void> {
  const context = await getActionContext(formData);
  if (!context) redirect(`/${getSafeLocale(formData.get("locale"))}/login`);
  const connectionId = uuidValue(formData, "connectionId");
  const responseStatus = textValue(formData, "responseStatus", 10);
  if (!connectionId || !responseStatus || !allowedConnectionResponses.has(responseStatus)) redirectResult(context, "invalid");
  const result = await callEdgeFunction(context, "respond_rider_connection_request", { connectionId, responseStatus });
  if (!result) redirectResult(context, "error");
  revalidateApp(context.locale, [`/${context.locale}/app/riders`]);
  redirectResult(context, "done");
}

export async function cancelConnectionAction(formData: FormData): Promise<void> {
  const context = await getActionContext(formData);
  if (!context) redirect(`/${getSafeLocale(formData.get("locale"))}/login`);
  const connectionId = uuidValue(formData, "connectionId");
  if (!connectionId) redirectResult(context, "invalid");
  const result = await callEdgeFunction(context, "cancel_rider_connection_request", { connectionId });
  if (!result) redirectResult(context, "error");
  revalidateApp(context.locale, [`/${context.locale}/app/riders`]);
  redirectResult(context, "done");
}

export async function removeConnectionAction(formData: FormData): Promise<void> {
  const context = await getActionContext(formData);
  if (!context) redirect(`/${getSafeLocale(formData.get("locale"))}/login`);
  const connectionId = uuidValue(formData, "connectionId");
  if (!connectionId) redirectResult(context, "invalid");
  const { data, error } = await context.client
    .from("rider_connections")
    .delete()
    .eq("id", connectionId)
    .eq("status", "accepted")
    .select("id");
  if (error || (data ?? []).length !== 1) redirectResult(context, error?.code === "42501" ? "forbidden" : "error");
  revalidateApp(context.locale, [`/${context.locale}/app/riders`]);
  redirectResult(context, "done");
}

export async function sendRideInterestAction(formData: FormData): Promise<void> {
  const context = await getActionContext(formData);
  if (!context) redirect(`/${getSafeLocale(formData.get("locale"))}/login`);
  const recipientUserId = uuidValue(formData, "recipientUserId");
  const timeOption = textValue(formData, "timeOption", 20);
  const timezone = textValue(formData, "timezone", 100);
  const customDate = textValue(formData, "customDate", 10);
  const preferredTime = textValue(formData, "preferredTime", 5);
  if (
    !recipientUserId || recipientUserId === context.userId ||
    !timeOption || !allowedInterestOptions.has(timeOption) || !timezone ||
    (timeOption === "custom_date" && (!customDate || !datePattern.test(customDate))) ||
    (preferredTime && !timePattern.test(preferredTime))
  ) redirectResult(context, "invalid");
  const body: Record<string, unknown> = {
    recipientUserId,
    timeOption,
    timezone,
    idempotencyKey: crypto.randomUUID()
  };
  if (timeOption === "custom_date") body.customDate = customDate;
  if (preferredTime) body.preferredTime = preferredTime;
  const result = await callEdgeFunction(context, "send_ride_interest_request", body);
  if (!result) redirectResult(context, "error");
  revalidateApp(context.locale, [`/${context.locale}/app/requests`, `/${context.locale}/app/riders`]);
  redirect(withNotice(context.locale, `/${context.locale}/app/requests`, "done"));
}

export async function respondRideInterestAction(formData: FormData): Promise<void> {
  const context = await getActionContext(formData);
  if (!context) redirect(`/${getSafeLocale(formData.get("locale"))}/login`);
  const requestId = uuidValue(formData, "requestId");
  const responseStatus = textValue(formData, "responseStatus", 12);
  if (!requestId || !responseStatus || !allowedInterestResponses.has(responseStatus)) redirectResult(context, "invalid");
  const result = await callEdgeFunction(context, "respond_ride_interest_request", { requestId, responseStatus });
  if (!result) redirectResult(context, "error");
  revalidateApp(context.locale, [`/${context.locale}/app/requests`]);
  redirectResult(context, "done");
}

async function simpleInterestAction(formData: FormData, functionName: "cancel_ride_interest_request" | "dismiss_ride_interest_request") {
  const context = await getActionContext(formData);
  if (!context) redirect(`/${getSafeLocale(formData.get("locale"))}/login`);
  const requestId = uuidValue(formData, "requestId");
  if (!requestId) redirectResult(context, "invalid");
  const result = await callEdgeFunction(context, functionName, { requestId });
  if (!result) redirectResult(context, "error");
  revalidateApp(context.locale, [`/${context.locale}/app/requests`]);
  redirectResult(context, "done");
}

export async function cancelRideInterestAction(formData: FormData): Promise<void> {
  await simpleInterestAction(formData, "cancel_ride_interest_request");
}

export async function dismissRideInterestAction(formData: FormData): Promise<void> {
  await simpleInterestAction(formData, "dismiss_ride_interest_request");
}

export async function convertRideInterestAction(formData: FormData): Promise<void> {
  const context = await getActionContext(formData);
  if (!context) redirect(`/${getSafeLocale(formData.get("locale"))}/login`);
  const requestId = uuidValue(formData, "requestId");
  const hotspotId = uuidValue(formData, "hotspotId");
  const title = textValue(formData, "title", 120);
  const discipline = textValue(formData, "discipline", 10);
  const startDate = textValue(formData, "startDate", 10);
  const startTime = textValue(formData, "startTime", 5);
  const durationMinutes = numberValue(formData, "durationMinutes", 30, 480);
  const visibility = textValue(formData, "visibility", 10);
  if (
    !requestId || !hotspotId || !title || !discipline || !allowedDisciplines.has(discipline) ||
    !startDate || !datePattern.test(startDate) || !startTime || !timePattern.test(startTime) ||
    !durationMinutes || !visibility || !allowedVisibility.has(visibility)
  ) redirectResult(context, "invalid");
  const hotspot = await loadHotspotCoordinates(context, hotspotId);
  if (!hotspot) redirectResult(context, "invalid");
  const result = await callEdgeFunction(context, "convert_ride_interest_request", {
    requestId,
    title,
    discipline,
    startLocalDate: startDate,
    startLocalTime: startTime,
    durationMinutes,
    latitude: hotspot.latitude,
    longitude: hotspot.longitude,
    meetingAddress: hotspot.address,
    visibility,
    hotspotId
  });
  const rideId = result && typeof result.rideId === "string" && uuidPattern.test(result.rideId) ? result.rideId : null;
  if (!rideId) redirectResult(context, "error");
  revalidateApp(context.locale, [`/${context.locale}/app/requests`, `/${context.locale}/app/rides`]);
  redirect(withNotice(context.locale, `/${context.locale}/app/rides/${rideId}`, "created"));
}

export async function updateProfileAction(formData: FormData): Promise<void> {
  const context = await getActionContext(formData);
  if (!context) redirect(`/${getSafeLocale(formData.get("locale"))}/login`);
  const displayName = textValue(formData, "displayName", 80);
  const homeRegion = optionalTextValue(formData, "homeRegion", 120);
  const level = optionalTextValue(formData, "level", 80);
  const about = optionalTextValue(formData, "about", 500);
  const bikeTypesRaw = optionalTextValue(formData, "bikeTypes", 200);
  const unitSystem = textValue(formData, "unitSystem", 10);
  const heightCm = numberValue(formData, "heightCm", 80, 250, true);
  const weightKg = numberValue(formData, "weightKg", 30, 300, true);
  const ftp = numberValue(formData, "ftp", 50, 700, true);
  if (!displayName || (unitSystem !== "metric" && unitSystem !== "imperial")) redirectResult(context, "invalid");
  const bikeTypes = bikeTypesRaw
    ? [...new Set(bikeTypesRaw.split(",").map((value) => value.trim()).filter(Boolean))].slice(0, 8)
    : [];
  const { error } = await context.client
    .from("profiles")
    .update({
      display_name: displayName,
      home_region: homeRegion,
      level_desc: level,
      about_me: about,
      bike_type: bikeTypes,
      unit_system: unitSystem,
      height_cm: heightCm,
      weight_kg: weightKg,
      ftp,
      hide_start_end: formData.get("hideStartEnd") === "on"
    })
    .eq("id", context.userId);
  if (error) redirectResult(context, error.code === "42501" ? "forbidden" : "error");
  revalidateApp(context.locale, [`/${context.locale}/app/profile`]);
  redirectResult(context, "saved");
}

export async function uploadAvatarAction(formData: FormData): Promise<void> {
  const context = await getActionContext(formData);
  if (!context) redirect(`/${getSafeLocale(formData.get("locale"))}/login`);
  const file = formData.get("avatar");
  const allowedTypes: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp"
  };
  if (!(file instanceof File) || file.size <= 0 || file.size > 5 * 1024 * 1024 || !allowedTypes[file.type]) {
    redirectResult(context, "invalid");
  }
  const path = `${context.userId}/web-avatar-${crypto.randomUUID()}.${allowedTypes[file.type]}`;
  const { error: uploadError } = await context.client.storage.from("avatars").upload(path, file, {
    contentType: file.type,
    upsert: false
  });
  if (uploadError) redirectResult(context, "error");
  const { data } = context.client.storage.from("avatars").getPublicUrl(path);
  const { error: profileError } = await context.client
    .from("profiles")
    .update({ avatar_url: data.publicUrl })
    .eq("id", context.userId);
  if (profileError) redirectResult(context, "error");
  revalidateApp(context.locale, [`/${context.locale}/app/profile`]);
  redirectResult(context, "saved");
}
