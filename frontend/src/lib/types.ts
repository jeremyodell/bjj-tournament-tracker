// frontend/src/lib/types.ts
export interface Tournament {
  id: string;
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

export interface TournamentFilters {
  org?: 'IBJJF' | 'JJWL';
  startAfter?: string;
  startBefore?: string;
  city?: string;
  gi?: boolean;
  nogi?: boolean;
  kids?: boolean;
  search?: string;
}

export interface PaginatedResponse<T> {
  tournaments: T[];
  nextCursor?: string;
}
