export interface IBJJFEventGroup {
  id: number;
  name: string;
}

export interface IBJJFEvent {
  id: number;
  name: string;
  region: string;
  city: string;
  local: string | null; // venue
  startDay: number;
  endDay: number;
  month: string;
  year: number;
  eventGroups: IBJJFEventGroup[];
  pageUrl: string | null;
  status?: string;
}

export interface JJWLEvent {
  id: number;
  name: string;
  city: string;
  place: string | null; // venue
  datebeg: string;
  dateend: string;
  GI: string; // "0" or "1"
  NOGI: string; // "0" or "1"
  picture: string | null;
  urlfriendly: string;
}

export interface NormalizedTournament {
  org: 'IBJJF' | 'JJWL';
  externalId: string;
  name: string;
  city: string;
  venue: string | null;
  country: string | null;
  startDate: string;
  endDate: string;
  gi: boolean;
  nogi: boolean;
  kids: boolean;
  registrationUrl: string | null;
  bannerUrl: string | null;
  // Optional geocoding fields (added during sync enrichment)
  lat?: number | null;
  lng?: number | null;
  venueId?: string | null;
  geocodeConfidence?: 'high' | 'low' | 'failed' | null;
}

// JJWL Gym from API
export interface JJWLGym {
  id: string;
  name: string;
}

// Normalized gym (for cross-source support)
export interface NormalizedGym {
  org: 'JJWL' | 'IBJJF';
  externalId: string;
  name: string;
}

// JJWL Roster athlete from API
export interface JJWLRosterAthlete {
  name: string;
  belt: string;
  ageDiv: string;
  weight: string;
  gender: string;
}

// IBJJF Academy from API
export interface IBJJFAcademy {
  id: number;
  name: string;
  country: string;
  countryCode: string;
  city: string;
  address: string;
  federation: string;
  site: string;
  responsible: string;
}

// IBJJF API response structure
export interface IBJJFAcademiesResponse {
  data: IBJJFAcademy[];
  totalRecords: number;
  filteredRecords: number;
}

// Extended normalized gym with IBJJF fields
export interface IBJJFNormalizedGym extends NormalizedGym {
  country?: string;
  countryCode?: string;
  city?: string;
  address?: string;
  federation?: string;
  website?: string;
  responsible?: string;
}
