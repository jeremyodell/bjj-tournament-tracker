// frontend/src/lib/api.ts
import axios from 'axios';
import type { Tournament, TournamentFilters, PaginatedResponse } from './types';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

export async function fetchTournaments(
  filters: TournamentFilters = {},
  cursor?: string
): Promise<PaginatedResponse<Tournament>> {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      params.set(key, String(value));
    }
  });

  if (cursor) {
    params.set('cursor', cursor);
  }

  const response = await api.get<PaginatedResponse<Tournament>>(
    `/tournaments?${params.toString()}`
  );
  return response.data;
}

export async function fetchTournament(id: string): Promise<Tournament> {
  const response = await api.get<Tournament>(`/tournaments/${encodeURIComponent(id)}`);
  return response.data;
}

// Wishlist types and API functions
export interface WishlistItem {
  PK: string;
  SK: string;
  tournamentPK: string;
  status: 'interested' | 'registered' | 'attending';
  athleteIds: string[];
  createdAt: string;
  updatedAt: string;
  tournament?: Tournament;
}

export async function fetchWishlist(accessToken: string): Promise<{ wishlist: WishlistItem[] }> {
  const response = await api.get('/wishlist', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return response.data;
}

export async function addToWishlist(accessToken: string, tournamentId: string): Promise<WishlistItem> {
  const response = await api.post('/wishlist',
    { tournamentId },
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  return response.data;
}

export async function removeFromWishlist(accessToken: string, tournamentId: string): Promise<void> {
  await api.delete(`/wishlist/${encodeURIComponent(tournamentId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

// Athlete types and API functions
export interface Athlete {
  athleteId: string;
  name: string;
  beltRank: string | null;
  birthYear: number | null;
  weightClass: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAthleteInput {
  name: string;
  beltRank?: string;
  birthYear?: number;
  gender?: string;
  weight?: number;
  gymName?: string;
}

export async function fetchAthletes(accessToken: string): Promise<{ athletes: Athlete[] }> {
  const response = await api.get('/athletes', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return response.data;
}

export async function createAthlete(accessToken: string, input: CreateAthleteInput): Promise<Athlete> {
  const response = await api.post('/athletes', input, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return response.data;
}

export async function updateAthlete(accessToken: string, athleteId: string, input: Partial<CreateAthleteInput>): Promise<Athlete> {
  const response = await api.put(`/athletes/${athleteId}`, input, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return response.data;
}

export async function deleteAthlete(accessToken: string, athleteId: string): Promise<void> {
  await api.delete(`/athletes/${athleteId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

// Airport registration API
export interface RegisterAirportResponse {
  airport: string;
  message: string;
  isNew: boolean;
}

export async function registerAirport(accessToken: string, airport: string): Promise<RegisterAirportResponse> {
  const response = await api.post('/airports',
    { airport },
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  return response.data;
}

// Admin - Pending Match types and API functions
export interface MatchSignals {
  nameSimilarity: number;
  cityBoost: number;
  affiliationBoost: number;
}

export interface PendingMatch {
  id: string;
  sourceGym1Id: string;
  sourceGym1Name: string;
  sourceGym2Id: string;
  sourceGym2Name: string;
  confidence: number;
  signals: MatchSignals;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
}

export async function fetchPendingMatches(
  accessToken: string,
  status: 'pending' | 'approved' | 'rejected' = 'pending'
): Promise<{ matches: PendingMatch[] }> {
  const response = await api.get(`/admin/pending-matches?status=${status}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return response.data;
}

export async function approveMatch(
  accessToken: string,
  matchId: string
): Promise<{ masterGymId: string; message: string }> {
  const response = await api.post(
    `/admin/pending-matches/${matchId}/approve`,
    {},
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  return response.data;
}

export async function rejectMatch(
  accessToken: string,
  matchId: string
): Promise<{ message: string }> {
  const response = await api.post(
    `/admin/pending-matches/${matchId}/reject`,
    {},
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  return response.data;
}

export default api;
