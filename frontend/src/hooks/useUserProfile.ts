// frontend/src/hooks/useUserProfile.ts

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchUserProfile,
  updateUserProfile,
  type UserProfile,
  type UserProfileUpdate,
} from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

/**
 * Query hook to fetch user's profile
 * Returns profile data and loading/error states
 * Only runs when user is authenticated
 */
export function useUserProfile() {
  const { isAuthenticated, getAccessToken } = useAuthStore();

  return useQuery({
    queryKey: ['userProfile'],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('Not authenticated');
      return fetchUserProfile(token);
    },
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
    refetchOnWindowFocus: true,
  });
}

/**
 * Mutation hook to update user's profile
 * Automatically invalidates the userProfile query on success
 */
export function useUpdateUserProfile() {
  const queryClient = useQueryClient();
  const { getAccessToken } = useAuthStore();

  return useMutation({
    mutationFn: async (updates: UserProfileUpdate) => {
      const token = await getAccessToken();
      if (!token) throw new Error('Not authenticated');
      return updateUserProfile(token, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userProfile'] });
    },
  });
}

export type { UserProfile, UserProfileUpdate };
