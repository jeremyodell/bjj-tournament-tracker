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

// Entity types
export interface TournamentItem {
  PK: string; // TOURN#<org>#<externalId>
  SK: 'META';
  GSI1PK: 'TOURNAMENTS';
  GSI1SK: string; // <startDate>#<org>#<externalId>
  org: 'IBJJF' | 'JJWL';
  externalId: string;
  name: string;
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
  createdAt: string;
  updatedAt: string;
}

export interface AthleteItem {
  PK: string; // USER#<cognitoSub>
  SK: string; // ATHLETE#<ulid>
  athleteId: string;
  name: string;
  beltRank: string | null;
  birthYear: number | null;
  weightClass: string | null;
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

export type DynamoDBItem =
  | TournamentItem
  | UserProfileItem
  | AthleteItem
  | WishlistItem
  | VenueItem;
