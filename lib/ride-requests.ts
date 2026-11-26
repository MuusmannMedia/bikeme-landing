import type { RideInterest, RideInvite, RideInviteUnavailable } from "./app-model";

export function rideInviteUnavailable(
  ride: { type?: unknown; status?: unknown; start_time?: unknown; expires_at?: unknown } | undefined,
  now = Date.now()
): RideInviteUnavailable | null {
  if (ride?.status === "CANCELLED") return "cancelled";
  if (ride?.status === "COMPLETED") return "completed";
  if (ride?.status !== "ACTIVE" || (ride.type !== "EVENT" && ride.type !== "PING")) return "unavailable";

  const start = typeof ride.start_time === "string" ? Date.parse(ride.start_time) : NaN;
  const expiry = typeof ride.expires_at === "string" ? Date.parse(ride.expires_at) : NaN;
  if (!Number.isFinite(start) || (ride.expires_at != null && !Number.isFinite(expiry))) return "unavailable";

  // The existing ride invitation rules allow a PING until expiry. An EVENT closes at its scheduled start.
  return expiry <= now || (ride.type === "EVENT" && start <= now) ? "expired" : null;
}

export function isCurrentRideInvite(invite: RideInvite) {
  return !invite.acceptedAt && !invite.declinedAt && invite.rideUnavailable === null;
}

export function isCurrentRideInterest(item: RideInterest) {
  return !item.expired && !item.createdRideId && (
    item.responseStatus === "pending" ||
    (item.direction === "sent" && (item.responseStatus === "interested" || item.responseStatus === "maybe"))
  );
}
