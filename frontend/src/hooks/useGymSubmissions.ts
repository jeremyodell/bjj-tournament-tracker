import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchGymSubmissions,
  approveGymSubmission,
  rejectGymSubmission,
  type GymSubmission,
} from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

const STALE_TIME = 30 * 1000; // 30 seconds

/**
 * Hook for fetching gym submissions by status
 */
export function useGymSubmissions(status: 'pending' | 'approved' | 'rejected' = 'pending') {
  const getAccessToken = useAuthStore((state) => state.getAccessToken);

  return useQuery<{ submissions: GymSubmission[] }, Error>({
    queryKey: ['gym-submissions', status],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) {
        throw new Error('Not authenticated');
      }
      return fetchGymSubmissions(token, status);
    },
    staleTime: STALE_TIME,
  });
}

/**
 * Hook for approving a gym submission
 */
export function useApproveGymSubmission() {
  const queryClient = useQueryClient();
  const getAccessToken = useAuthStore((state) => state.getAccessToken);

  return useMutation<
    { masterGymId: string; message: string },
    Error,
    { submissionId: string; createNew: boolean; masterGymId?: string }
  >({
    mutationFn: async ({ submissionId, createNew, masterGymId }) => {
      const token = await getAccessToken();
      if (!token) {
        throw new Error('Not authenticated');
      }
      return approveGymSubmission(token, submissionId, createNew, masterGymId);
    },
    onSuccess: () => {
      // Invalidate gym submissions to refetch
      queryClient.invalidateQueries({ queryKey: ['gym-submissions'] });
    },
  });
}

/**
 * Hook for rejecting a gym submission
 */
export function useRejectGymSubmission() {
  const queryClient = useQueryClient();
  const getAccessToken = useAuthStore((state) => state.getAccessToken);

  return useMutation<{ message: string }, Error, string>({
    mutationFn: async (submissionId: string) => {
      const token = await getAccessToken();
      if (!token) {
        throw new Error('Not authenticated');
      }
      return rejectGymSubmission(token, submissionId);
    },
    onSuccess: () => {
      // Invalidate gym submissions to refetch
      queryClient.invalidateQueries({ queryKey: ['gym-submissions'] });
    },
  });
}
