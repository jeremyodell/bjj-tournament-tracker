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

export default api;
