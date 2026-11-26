import type { RideInterest, RideInvite, RiderConnection } from "./app-model";

import { isCurrentRideInvite } from "./ride-requests";

export const overviewRecentRideLimit = 5;

export function selectPendingReceivedInvites(invites: RideInvite[]): RideInvite[] {
  return invites.filter((invite) => (
    invite.direction === "received" && isCurrentRideInvite(invite)
  ));
}

export function selectPendingReceivedInterest(interests: RideInterest[]): RideInterest[] {
  return interests.filter((item) => (
    item.direction === "received" && item.responseStatus === "pending" && !item.expired
  ));
}

export function selectAcceptedConnections(connections: RiderConnection[]): RiderConnection[] {
  return connections.filter((connection) => connection.state === "accepted");
}
