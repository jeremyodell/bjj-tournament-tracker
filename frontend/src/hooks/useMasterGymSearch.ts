import { useQuery } from '@tanstack/react-query';
import { searchMasterGyms, type MasterGymSearchResult } from '@/lib/api';

const MINIMUM_SEARCH_LENGTH = 2;
const STALE_TIME = 30 * 1000; // 30 seconds

/**
 * Hook for searching master gyms (unified gyms across all organizations).
 * Requires minimum 2 characters before making API call.
 * Returns empty array for shorter queries without API call.
 */
export function useMasterGymSearch(query: string) {
  const trimmedQuery = query.trim();
  const shouldSearch = trimmedQuery.length >= MINIMUM_SEARCH_LENGTH;

  return useQuery<MasterGymSearchResult[], Error>({
    queryKey: ['master-gyms', 'search', trimmedQuery],
    queryFn: () => searchMasterGyms(trimmedQuery),
    enabled: shouldSearch,
    staleTime: STALE_TIME,
    // Return empty array when disabled instead of undefined
    placeholderData: shouldSearch ? undefined : [],
    // When query is too short, we want to return empty immediately
    ...(shouldSearch ? {} : { initialData: [] }),
  });
}
