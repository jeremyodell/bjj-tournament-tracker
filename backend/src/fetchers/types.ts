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
}
