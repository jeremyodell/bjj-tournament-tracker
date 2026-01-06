// frontend/src/hooks/useAddToWishlist.ts

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addToWishlist, type WishlistItem } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { getTournamentPK } from '@/lib/tournamentUtils';
import { toastError } from '@/lib/toastConfig';
import type { Tournament } from '@/lib/types';

/**
 * Mutation hook for adding tournaments to wishlist
 * Implements optimistic updates with error rollback
 */
export function useAddToWishlist() {
  const queryClient = useQueryClient();
  const { getAccessToken } = useAuthStore();

  return useMutation({
    mutationFn: async (tournament: Tournament) => {
      const token = await getAccessToken();
      if (!token) throw new Error('Not authenticated');
      const tournamentPK = getTournamentPK(tournament);
      return addToWishlist(token, tournamentPK);
    },

    // Optimistic update: immediately add to cache
    onMutate: async (tournament: Tournament) => {
      const tournamentPK = getTournamentPK(tournament);

      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['wishlist'] });

      // Snapshot previous value for rollback
      const previousWishlist = queryClient.getQueryData(['wishlist']);

      // Optimistically add to wishlist
      queryClient.setQueryData(['wishlist'], (old: { wishlist: WishlistItem[] } | undefined) => {
        if (!old) return { wishlist: [{ tournamentPK } as WishlistItem] };

        // Check if already tracked to prevent duplicates
        const alreadyTracked = old.wishlist.some(item => item.tournamentPK === tournamentPK);
        if (alreadyTracked) return old;

        return {
          wishlist: [...old.wishlist, { tournamentPK } as WishlistItem],
        };
      });

      return { previousWishlist };
    },

    // On error, rollback to previous state
    onError: (_err, _tournament, context) => {
      if (context?.previousWishlist) {
        queryClient.setQueryData(['wishlist'], context.previousWishlist);
      }
      toastError('Failed to track tournament. Please try again.');
    },

    // Always refetch after success or error
    onSettled: async () => {
      // Use refetchQueries instead of invalidateQueries to force immediate refetch
      // invalidateQueries only marks as stale but won't refetch with staleTime set
      await queryClient.refetchQueries({ queryKey: ['wishlist'] });
    },
  });
}
