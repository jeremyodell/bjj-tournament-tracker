// frontend/src/hooks/useTournaments.ts
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { fetchTournaments, fetchTournament } from '@/lib/api';
import type { TournamentFilters } from '@/lib/types';

export function useTournaments(filters: TournamentFilters = {}) {
  return useInfiniteQuery({
    queryKey: ['tournaments', filters],
    queryFn: ({ pageParam }) => fetchTournaments(filters, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
  });
}

export function useTournament(id: string) {
  return useQuery({
    queryKey: ['tournament', id],
    queryFn: () => fetchTournament(id),
    staleTime: 5 * 60 * 1000,
    retry: 2,
    enabled: !!id,
  });
}
