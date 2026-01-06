// frontend/src/hooks/useWishlist.ts

import { useQuery } from '@tanstack/react-query';
import { fetchWishlist, type WishlistItem } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

/**
 * Query hook to fetch user's wishlist
 * Returns wishlist items and loading/error states
 * Only runs when user is authenticated
 */
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
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
  });
}

export type { WishlistItem };
