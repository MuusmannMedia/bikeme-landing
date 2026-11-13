import { distanceToKilometers, isRideMoodKey, resolveFreeMeetingLocation, resolveRideSchedule } from "../create-ride";
import { parseSerializedPlannedRoute } from "../gpx-import";
import type { UnitSystem } from "../app-model";
import { ClubError } from "./membership-types";
import { isClubId } from "./types";
export const clubRideHref = (locale: string, clubId: string, rideId?: string) => `/${locale}/app/clubs/${clubId}/rides${rideId ? `?rideId=${encodeURIComponent(rideId)}` : ""}`;
export const inviteStatuses = ["created","pending","accepted","declined","joined","self","not_member"] as const;
export type RideInviteResult = {user_id: string; status: typeof inviteStatuses[number]};
export function validateInviteResults(data: unknown, ids: string[]): RideInviteResult[] {
  if (!Array.isArray(data) || data.length !== ids.length || new Set(data.map(r => r?.user_id)).size !== ids.length || data.some(r => !ids.includes(r?.user_id) || !inviteStatuses.includes(r?.status))) throw new ClubError("network");
  return data.map(r => ({user_id:r.user_id,status:r.status}));
}
export function clubRideAvailable(ride: {status: string; startTime: string; expiresAt: string | null; clubClosedAt?: string | null}, now = Date.now()) {
  return !ride.clubClosedAt && ride.status === "ACTIVE" && Date.parse(ride.startTime) > now && (!ride.expiresAt || Date.parse(ride.expiresAt) > now);
}
export function parseClubRide(form: FormData, actorId: string, units: UnitSystem) {
  const text = (key: string) => typeof form.get(key) === "string" ? String(form.get(key)).trim() : "";
  const number = (key: string) => text(key) ? Number(text(key).replace(",", ".")) : NaN;
  const clubId=text("clubId"), id=text("createRequestId"), title=text("title"), description=text("description"), discipline=text("discipline"), pace=text("paceText");
  const distance=distanceToKilometers(number("distance"), units);
  const schedule=resolveRideSchedule({type:"EVENT",startTimeIso:text("startTimeIso"),durationHours:number("durationHours")});
  const route=parseSerializedPlannedRoute(form.get("plannedRoute"));
  if (!isClubId(clubId) || !isClubId(id) || text("actorId") !== actorId || text("type") !== "EVENT" || text("visibility") !== "private" || title.length<3 || title.length>120 || description.length>1000 || !["ROAD","GRAVEL","MTB"].includes(discipline) || !Number.isFinite(distance) || distance<=0 || distance>500 || (pace && !isRideMoodKey(pace)) || !schedule.ok || route === false || form.getAll("inviteeIds").length) throw new ClubError("invalid");
  const meetingMode=text("meetingMode");
  const hotspotId=meetingMode === "hotspot" && isClubId(text("hotspotId")) ? text("hotspotId") : null;
  const meeting=meetingMode === "map" ? resolveFreeMeetingLocation({latitude:number("meetingLatitude"),longitude:number("meetingLongitude"),address:text("meetingAddress")}) : null;
  if (!meeting && !hotspotId) throw new ClubError("invalid");
  return {clubId,id,route,hotspotId,meeting,row:{id,club_id:clubId,host_id:actorId,type:"EVENT",visibility:"private",status:"ACTIVE",title,description:description || null,discipline,pace_text:pace || null,distance_km:distance,start_time:schedule.startTime.toISOString(),expires_at:new Date(schedule.startTime.getTime()+schedule.durationMinutes*60000).toISOString(),hotspot_id:hotspotId}};
}
