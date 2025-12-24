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

export default api;
