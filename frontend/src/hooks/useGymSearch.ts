// frontend/src/hooks/useGymSearch.ts
import { useQuery } from '@tanstack/react-query';
import { searchGyms, fetchGymRoster, type Gym, type GymRoster } from '@/lib/api';

const MINIMUM_SEARCH_LENGTH = 2;
const STALE_TIME = 30 * 1000; // 30 seconds
const ROSTER_STALE_TIME = 60 * 60 * 1000; // 1 hour (server handles 24h staleness)

/**
 * Parsed gym source ID containing org and externalId
 */
export interface ParsedGymSourceId {
  org: string;
  externalId: string;
}

/**
 * Parses a gymSourceId string in format "ORG#externalId" into its components.
 * Returns null if the input is null, undefined, empty, or invalid format.
 *
 * @param sourceId - The gym source ID string (e.g., "JJWL#5713" or "IBJJF#12345")
 * @returns Parsed object with org and externalId, or null if invalid
 */
export function parseGymSourceId(
  sourceId: string | null | undefined
): ParsedGymSourceId | null {
  if (!sourceId) {
    return null;
  }

  const hashIndex = sourceId.indexOf('#');
  if (hashIndex === -1) {
    return null;
  }

  const org = sourceId.substring(0, hashIndex);
  const externalId = sourceId.substring(hashIndex + 1);

  if (!org || !externalId) {
    return null;
  }

  return { org, externalId };
}

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

/**
 * Options for useGymRosterBySourceId hook
 */
export interface UseGymRosterBySourceIdOptions {
  /** Controls whether the query should execute. Defaults to true. */
  enabled?: boolean;
}

/**
 * Convenience hook for fetching a gym's roster using a gymSourceId string.
 * Parses the gymSourceId format ("ORG#externalId") and fetches the roster.
 * Uses 1-hour stale time (server handles 24h staleness check).
 *
 * @param gymSourceId - The gym source ID (e.g., "JJWL#5713" or "IBJJF#12345")
 * @param tournamentId - The tournament ID to fetch roster for
 * @param options - Optional configuration (enabled flag)
 * @returns TanStack Query result with GymRoster data
 */
export function useGymRosterBySourceId(
  gymSourceId: string | null | undefined,
  tournamentId: string,
  options: UseGymRosterBySourceIdOptions = {}
) {
  const { enabled = true } = options;
  const parsed = parseGymSourceId(gymSourceId);

  const shouldFetch = Boolean(
    enabled && parsed && tournamentId
  );

  return useQuery<GymRoster, Error>({
    queryKey: ['gyms', 'roster', parsed?.org ?? '', parsed?.externalId ?? '', tournamentId],
    queryFn: () => fetchGymRoster(parsed!.org, parsed!.externalId, tournamentId),
    enabled: shouldFetch,
    staleTime: ROSTER_STALE_TIME,
  });
}
