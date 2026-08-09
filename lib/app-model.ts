export type AccessLevel = "basic" | "premium" | "tester_premium" | "founding_rider";
export type UnitSystem = "metric" | "imperial";
export type RideDiscipline = "ROAD" | "GRAVEL" | "MTB" | "CITY";
export type RideVisibility = "public" | "private";
export type RideType = "PING" | "EVENT";

export type ViewerProfile = {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
  bikeTypes: string[];
  level: string | null;
  region: string | null;
  about: string | null;
  unitSystem: UnitSystem;
  heightCm: number | null;
  weightKg: number | null;
  ftp: number | null;
  hideStartEnd: boolean;
};

export type ViewerAccess = {
  level: AccessLevel;
  expiresAt: string | null;
  isFoundingRider: boolean;
  hasPro: boolean;
};

export type Viewer = {
  userId: string;
  profile: ViewerProfile;
  access: ViewerAccess;
};

export type RiderProfile = {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
  level: string | null;
  region: string | null;
  about: string | null;
};

export type RoutePoint = {
  latitude: number;
  longitude: number;
  recordedAt: string | null;
  elevation: number | null;
  startsNewSegment: boolean;
};

export type RideSummary = {
  id: string;
  hostId: string;
  hostName: string | null;
  type: RideType;
  status: "ACTIVE" | "CANCELLED" | "COMPLETED";
  visibility: RideVisibility;
  title: string;
  description: string | null;
  startTime: string;
  expiresAt: string | null;
  discipline: RideDiscipline;
  pace: string | null;
  distanceKm: number | null;
  meetingAddress: string | null;
  maxParticipants: number | null;
  participantCount: number;
  joined: boolean;
  hotspotId: string | null;
};

export type RideParticipant = RiderProfile & {
  role: "HOST" | "RIDER";
  status: "joined" | "checked_in" | "active" | "completed";
  joinedAt: string | null;
};

export type RideInvite = {
  rideId: string;
  hostId: string;
  inviteeId: string;
  createdAt: string;
  acceptedAt: string | null;
  declinedAt: string | null;
  rideTitle: string | null;
  rideStartTime: string | null;
  counterpart: RiderProfile | null;
  direction: "received" | "sent";
};

export type RideDetail = RideSummary & {
  route: RoutePoint[];
  participants: RideParticipant[];
  invites: RideInvite[];
};

export type Hotspot = {
  id: string;
  name: string;
  description: string | null;
  address: string | null;
  region: string;
  defaultDiscipline: RideDiscipline | null;
  defaultDistanceKm: number | null;
  defaultSpeedKmh: number | null;
};

export type RiderConnection = {
  id: string;
  requesterId: string;
  receiverId: string;
  status: "pending" | "accepted";
  createdAt: string;
  updatedAt: string;
  state: "accepted" | "pending_incoming" | "pending_outgoing";
  counterpart: RiderProfile;
};

export type RideInterest = {
  id: string;
  senderId: string;
  recipientId: string;
  direction: "received" | "sent";
  counterpart: RiderProfile | null;
  timeOption: "today" | "tomorrow" | "this_weekend" | "custom_date";
  windowStartDate: string;
  windowEndDate: string;
  timezone: string;
  preferredTime: string | null;
  responseStatus: "pending" | "interested" | "maybe" | "declined" | "cancelled" | "converted";
  expiresAt: string;
  expired: boolean;
  createdRideId: string | null;
  createdAt: string;
};

export type RideHistorySummary = {
  id: string;
  startedAt: string;
  title: string;
  discipline: RideDiscipline;
  startAddress: string | null;
  distanceKm: number | null;
  durationMinutes: number | null;
  elevationGain: number | null;
  averageWatts: number | null;
  maxWatts: number | null;
  caloriesKcal: number | null;
  participantCount: number | null;
};

export type ZoneDistribution = {
  z1: number;
  z2: number;
  z3: number;
  z4: number;
  z5: number;
  z6: number;
  z7: number;
};

export type RideHistoryDetail = RideHistorySummary & {
  notes: string | null;
  mood: string | null;
  routeLink: string | null;
  route: RoutePoint[];
  zones: ZoneDistribution | null;
};
