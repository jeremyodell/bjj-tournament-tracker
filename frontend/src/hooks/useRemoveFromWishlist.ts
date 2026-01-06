// frontend/src/hooks/useRemoveFromWishlist.ts

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { removeFromWishlist, type WishlistItem } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { getTournamentPK } from '@/lib/tournamentUtils';
import { toastError } from '@/lib/toastConfig';
import type { Tournament } from '@/lib/types';

/**
 * Mutation hook for removing tournaments from wishlist
 * Implements optimistic updates with error rollback
 */
export function useRemoveFromWishlist() {
  const queryClient = useQueryClient();
  const { getAccessToken } = useAuthStore();

  return useMutation({
    mutationFn: async (tournament: Tournament) => {
      const token = await getAccessToken();
      if (!token) throw new Error('Not authenticated');
      const tournamentPK = getTournamentPK(tournament);
      return removeFromWishlist(token, tournamentPK);
    },

    // Optimistic update: immediately remove from cache
    onMutate: async (tournament: Tournament) => {
      const tournamentPK = getTournamentPK(tournament);

      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['wishlist'] });

      // Snapshot previous value for rollback
      const previousWishlist = queryClient.getQueryData(['wishlist']);

      // Optimistically remove from wishlist
      queryClient.setQueryData(['wishlist'], (old: { wishlist: WishlistItem[] } | undefined) => {
        if (!old) return old;

        // Filter out the removed item
        return {
          wishlist: old.wishlist.filter((item) => item.tournamentPK !== tournamentPK),
        };
      });

      return { previousWishlist };
    },

    // On error, rollback to previous state
    onError: (_err, _tournament, context) => {
      if (context?.previousWishlist) {
        queryClient.setQueryData(['wishlist'], context.previousWishlist);
      }
      toastError('Failed to untrack tournament. Please try again.');
    },

    // Always refetch after success or error
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['wishlist'] });
    },
  });
}
