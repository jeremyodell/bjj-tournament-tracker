// Key builders
export const buildTournamentPK = (org: string, externalId: string): string =>
  `TOURN#${org}#${externalId}`;

export const buildUserPK = (cognitoSub: string): string =>
  `USER#${cognitoSub}`;

export const buildAthleteSK = (athleteId: string): string =>
  `ATHLETE#${athleteId}`;

export const buildWishlistSK = (tournamentPK: string): string =>
  `WISH#${tournamentPK}`;

export const buildVenuePK = (venueId: string): string =>
  `VENUE#${venueId}`;

export const buildVenueLookupSK = (venue: string, city: string): string =>
  `${venue.toLowerCase().trim()}#${city.toLowerCase().trim()}`;

// Flight price key builders
export const buildFlightPK = (originAirport: string, destinationCity: string): string =>
  `FLIGHT#${originAirport}#${destinationCity}`;

export const buildAirportPK = (iataCode: string): string =>
  `AIRPORT#${iataCode}`;

export const buildWsConnPK = (connectionId: string): string =>
  `WSCONN#${connectionId}`;

// Gym key builders
export const buildSourceGymPK = (org: string, externalId: string): string =>
  `SRCGYM#${org}#${externalId}`;

export const buildSourceGymGSI1SK = (org: string, name: string): string =>
  `${org}#${name}`;

export const buildGymRosterSK = (gymExternalId: string): string =>
  `GYMROSTER#${gymExternalId}`;

export const buildGymSyncMetaPK = (org: string): string =>
  `GYMSYNC#${org}`;

// Master gym key builders
export const buildMasterGymPK = (id: string): string =>
  `MASTERGYM#${id}`;

export const buildPendingMatchPK = (id: string): string =>
  `PENDINGMATCH#${id}`;

export const buildGymSubmissionPK = (id: string): string =>
  `GYMSUB#${id}`;

// Entity types
export interface TournamentItem {
  PK: string; // TOURN#<org>#<externalId>
  SK: 'META';
  GSI1PK: 'TOURNAMENTS';
  GSI1SK: string; // <startDate>#<org>#<externalId>
  org: 'IBJJF' | 'JJWL';
  externalId: string;
  name: string;
  slug: string | null; // URL-friendly identifier
  city: string;
  venue: string | null;
  country: string | null;
  startDate: string; // ISO date
  endDate: string; // ISO date
  gi: boolean;
  nogi: boolean;
  kids: boolean;
  registrationUrl: string | null;
  bannerUrl: string | null;
  // Geocoding fields
  lat: number | null;
  lng: number | null;
  venueId: string | null;
  geocodeConfidence: 'high' | 'low' | 'failed' | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfileItem {
  PK: string; // USER#<cognitoSub>
  SK: 'PROFILE';
  email: string;
  name: string | null;
  homeCity: string | null;
  homeState: string | null;
  nearestAirport: string | null;
  gymName: string | null;
  masterGymId: string | null; // Links to unified master gym
  createdAt: string;
  updatedAt: string;
}

export interface AthleteItem {
  PK: string; // USER#<cognitoSub>
  SK: string; // ATHLETE#<ulid>
  athleteId: string;
  name: string;
  gender: 'Male' | 'Female' | null;
  beltRank: string | null;
  birthYear: number | null;
  weightClass: string | null;
  homeAirport: string | null;
  gymSourceId: string | null; // e.g., "JJWL#5713"
  gymName: string | null; // Denormalized display name
  masterGymId: string | null; // Links to unified master gym
  createdAt: string;
  updatedAt: string;
}

export interface WishlistItem {
  PK: string; // USER#<cognitoSub>
  SK: string; // WISH#<tournamentPK>
  tournamentPK: string;
  status: 'interested' | 'registered' | 'attending';
  athleteIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface VenueItem {
  PK: string; // VENUE#<ulid>
  SK: 'META';
  GSI1PK: 'VENUE_LOOKUP';
  GSI1SK: string; // <normalizedVenue>#<normalizedCity>
  venueId: string;
  name: string;
  city: string;
  country: string | null;
  lat: number;
  lng: number;
  geocodeConfidence: 'high' | 'low';
  manualOverride: boolean;
  createdAt: string;
  updatedAt: string;
}

// Flight price cache entity
export interface FlightPriceItem {
  PK: string; // FLIGHT#{originAirport}#{destinationCity}
  SK: string; // {tournamentStartDate}
  price: number | null;
  currency: 'USD';
  airline: string | null;
  fetchedAt: string;
  expiresAt: string;
  source: 'amadeus' | 'estimated_range';
  rangeMin: number | null;
  rangeMax: number | null;
  originAirport: string;
  destinationCity: string;
  tournamentStartDate: string;
  ttl: number;
}

// Known airport entity (for tracking user airports for daily cron)
export interface KnownAirportItem {
  PK: string; // AIRPORT#{iataCode}
  SK: 'META';
  GSI1PK: 'AIRPORTS';
  GSI1SK: string; // {iataCode}
  iataCode: string;
  userCount: number;
  lastFetchedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// WebSocket connection entity
export interface WsConnectionItem {
  PK: string; // WSCONN#{connectionId}
  SK: 'META';
  GSI1PK: string; // USER#{userId}
  GSI1SK: 'WSCONN';
  connectionId: string;
  userId: string;
  pendingAirport: string | null;
  connectedAt: string;
  ttl: number;
}

// Source gym entity (from JJWL, IBJJF, etc.)
export interface SourceGymItem {
  PK: string; // SRCGYM#{org}#{externalId}
  SK: 'META';
  GSI1PK: 'GYMS';
  GSI1SK: string; // {org}#{name}
  org: 'JJWL' | 'IBJJF';
  externalId: string;
  name: string;
  masterGymId: string | null; // Future: links to canonical gym
  // Optional IBJJF fields
  country?: string | null;
  countryCode?: string | null;
  city?: string | null;
  address?: string | null;
  federation?: string | null;
  website?: string | null;
  responsible?: string | null;
  createdAt: string;
  updatedAt: string;
}

// Cached roster for a gym at a tournament
export interface TournamentGymRosterItem {
  PK: string; // TOURN#{org}#{tournamentId}
  SK: string; // GYMROSTER#{gymExternalId}
  gymExternalId: string;
  gymName: string;
  athletes: Array<{
    name: string;
    belt: string;
    ageDiv: string;
    weight: string;
    gender: string;
  }>;
  athleteCount: number;
  fetchedAt: string;
}

// Gym sync metadata for change detection
export interface GymSyncMetaItem {
  PK: string; // GYMSYNC#{org}
  SK: 'META';
  org: 'JJWL' | 'IBJJF';
  totalRecords: number;
  lastSyncAt: string;
  lastChangeAt: string; // When totalRecords last changed
}

// Master gym entity (unified gym across orgs)
export interface MasterGymItem {
  PK: string; // MASTERGYM#{uuid}
  SK: 'META';
  GSI1PK: 'MASTERGYMS';
  GSI1SK: string; // {canonicalName} for prefix search
  id: string;
  canonicalName: string;
  city: string | null;
  country: string | null;
  address: string | null;
  website: string | null;
  createdAt: string;
  updatedAt: string;
}

// Match confidence signals for fuzzy matching
export interface MatchSignals {
  nameSimilarity: number; // 0-100 Levenshtein-based score
  cityBoost: number; // 0-15 bonus for matching city
  affiliationBoost: number; // 0-10 bonus for matching affiliation
}

// Pending match for admin review
export interface PendingMatchItem {
  PK: string; // PENDINGMATCH#{uuid}
  SK: 'META';
  GSI1PK: 'PENDINGMATCHES';
  GSI1SK: string; // {status}#{createdAt} for filtering by status
  id: string;
  sourceGym1Id: string; // SRCGYM#{org}#{externalId}
  sourceGym1Name: string;
  sourceGym2Id: string; // SRCGYM#{org}#{externalId}
  sourceGym2Name: string;
  confidence: number; // 0-100 overall match score
  signals: MatchSignals;
  status: 'pending' | 'approved' | 'rejected';
  reviewedAt: string | null;
  reviewedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

// Gym submission from onboarding (for "Other" gym option)
export interface GymSubmissionItem {
  PK: string; // GYMSUB#{uuid}
  SK: 'META';
  GSI1PK: 'GYMSUBMISSIONS';
  GSI1SK: string; // {status}#{createdAt} for filtering by status
  id: string;
  customGymName: string;
  submittedByUserId: string; // Cognito sub
  athleteIds: string[]; // Athlete IDs that selected this custom gym
  status: 'pending' | 'approved' | 'rejected';
  masterGymId: string | null; // Set when approved and linked to a master gym
  reviewedAt: string | null;
  reviewedBy: string | null; // Cognito sub of admin who reviewed
  createdAt: string;
  updatedAt: string;
}

export type DynamoDBItem =
  | TournamentItem
  | UserProfileItem
  | AthleteItem
  | WishlistItem
  | VenueItem
  | FlightPriceItem
  | KnownAirportItem
  | WsConnectionItem
  | SourceGymItem
  | TournamentGymRosterItem
  | GymSyncMetaItem
  | MasterGymItem
  | PendingMatchItem
  | GymSubmissionItem;
