// frontend/src/hooks/useUserGymRoster.ts

import { useQuery } from '@tanstack/react-query';
import { fetchUserGymRoster, type UserGymRoster } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

export interface UseUserGymRosterOptions {
  /**
   * Whether to enable the query (default: true)
   * Set to false to disable fetching until needed
   */
  enabled?: boolean;
}

/**
 * Query hook to fetch user's gym roster for a specific tournament
 * Returns roster data and loading/error states
 * Only runs when user is authenticated and tournamentId is provided
 */
export function useUserGymRoster(
  tournamentId: string,
  options: UseUserGymRosterOptions = {}
) {
  const { isAuthenticated, getAccessToken } = useAuthStore();
  const { enabled = true } = options;

  return useQuery({
    queryKey: ['userGymRoster', tournamentId],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('Not authenticated');
      return fetchUserGymRoster(tournamentId, token);
    },
    enabled: isAuthenticated && !!tournamentId && enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
  });
}

export type { UserGymRoster };
