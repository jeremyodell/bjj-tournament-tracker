// frontend/src/hooks/useAdminMatches.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchPendingMatches, approveMatch, rejectMatch, type PendingMatch } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

export function useAdminMatches(status: 'pending' | 'approved' | 'rejected' = 'pending') {
  const { isAuthenticated, getAccessToken } = useAuthStore();

  return useQuery({
    queryKey: ['adminMatches', status],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('Not authenticated');
      return fetchPendingMatches(token, status);
    },
    enabled: isAuthenticated,
  });
}

export function useApproveMatch() {
  const queryClient = useQueryClient();
  const { getAccessToken } = useAuthStore();

  return useMutation({
    mutationFn: async (matchId: string) => {
      const token = await getAccessToken();
      if (!token) throw new Error('Not authenticated');
      return approveMatch(token, matchId);
    },
    onSuccess: () => {
      // Invalidate all match queries to refresh the lists
      queryClient.invalidateQueries({ queryKey: ['adminMatches'] });
    },
  });
}

export function useRejectMatch() {
  const queryClient = useQueryClient();
  const { getAccessToken } = useAuthStore();

  return useMutation({
    mutationFn: async (matchId: string) => {
      const token = await getAccessToken();
      if (!token) throw new Error('Not authenticated');
      return rejectMatch(token, matchId);
    },
    onSuccess: () => {
      // Invalidate all match queries to refresh the lists
      queryClient.invalidateQueries({ queryKey: ['adminMatches'] });
    },
  });
}

export type { PendingMatch };
