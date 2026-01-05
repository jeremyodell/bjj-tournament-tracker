// frontend/src/hooks/useGymSearch.ts
import { useQuery } from '@tanstack/react-query';
import { searchGyms, fetchGymRoster, type Gym, type GymRoster } from '@/lib/api';

const MINIMUM_SEARCH_LENGTH = 2;
const STALE_TIME = 30 * 1000; // 30 seconds

/**
 * Hook for searching gyms across all organizations.
 * Requires minimum 2 characters before making API call.
 * Returns empty array for shorter queries without API call.
 */
export function useGymSearch(query: string) {
  const trimmedQuery = query.trim();
  const shouldSearch = trimmedQuery.length >= MINIMUM_SEARCH_LENGTH;

  return useQuery<Gym[], Error>({
    queryKey: ['gyms', 'search', trimmedQuery],
    queryFn: () => searchGyms(trimmedQuery),
    enabled: shouldSearch,
    staleTime: STALE_TIME,
    // Return empty array when disabled instead of undefined
    placeholderData: shouldSearch ? undefined : [],
    // When query is too short, we want to return empty immediately
    ...(shouldSearch ? {} : { initialData: [] }),
  });
}

/**
 * Hook for fetching a gym's roster for a specific tournament.
 * All parameters must be provided for the query to execute.
 */
export function useGymRoster(org: string, externalId: string, tournamentId: string) {
  const shouldFetch = Boolean(org && externalId && tournamentId);

  return useQuery<GymRoster, Error>({
    queryKey: ['gyms', 'roster', org, externalId, tournamentId],
    queryFn: () => fetchGymRoster(org, externalId, tournamentId),
    enabled: shouldFetch,
    staleTime: STALE_TIME,
  });
}
