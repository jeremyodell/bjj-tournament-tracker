// frontend/src/hooks/useWishlist.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchWishlist, addToWishlist, removeFromWishlist } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

export function useWishlist() {
  const { isAuthenticated, getAccessToken } = useAuthStore();

  return useQuery({
    queryKey: ['wishlist'],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('Not authenticated');
      return fetchWishlist(token);
    },
    enabled: isAuthenticated,
    staleTime: 30 * 1000, // 30 seconds
  });
}

export function useWishlistMutations() {
  const queryClient = useQueryClient();
  const { getAccessToken } = useAuthStore();

  const addMutation = useMutation({
    mutationFn: async (tournamentId: string) => {
      const token = await getAccessToken();
      if (!token) throw new Error('Not authenticated');
      return addToWishlist(token, tournamentId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wishlist'] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (tournamentId: string) => {
      const token = await getAccessToken();
      if (!token) throw new Error('Not authenticated');
      return removeFromWishlist(token, tournamentId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wishlist'] });
    },
  });

  return { addMutation, removeMutation };
}

export function useIsInWishlist(tournamentId: string): boolean {
  const { data } = useWishlist();
  if (!data) return false;
  return data.wishlist.some(item => item.tournamentPK === tournamentId);
}
