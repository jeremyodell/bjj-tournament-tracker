import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createOnboardingAthletes, type OnboardingData, type OnboardingResult } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

/**
 * Hook for submitting onboarding data (creating multiple athletes at once)
 */
export function useOnboarding() {
  const queryClient = useQueryClient();
  const getAccessToken = useAuthStore((state) => state.getAccessToken);

  return useMutation<OnboardingResult, Error, OnboardingData>({
    mutationFn: async (data: OnboardingData) => {
      const token = await getAccessToken();
      if (!token) {
        throw new Error('Not authenticated');
      }
      return createOnboardingAthletes(token, data);
    },
    onSuccess: () => {
      // Invalidate athletes query to refetch the list
      queryClient.invalidateQueries({ queryKey: ['athletes'] });
    },
  });
}
