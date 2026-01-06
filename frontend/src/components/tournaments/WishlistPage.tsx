'use client';

import { useMemo } from 'react';
import { useWishlist } from '@/hooks/useWishlist';
import { useTournaments } from '@/hooks/useTournaments';
import { ScoreboardTournamentCard } from './ScoreboardTournamentCard';
import { TournamentGridSkeleton } from './TournamentCardSkeleton';
import { ErrorState, EmptyState } from './ErrorState';
import { getTournamentPK } from '@/lib/tournamentUtils';
import Link from 'next/link';

export function WishlistPage() {
  // Fetch wishlist (tournament PKs)
  const {
    data: wishlistData,
    isLoading: wishlistLoading,
    isError: wishlistError,
    error: wishlistErrorObj,
    refetch: refetchWishlist,
  } = useWishlist();

  // Fetch all tournaments
  const {
    data: tournamentsData,
    isLoading: tournamentsLoading,
    isError: tournamentsError,
    error: tournamentsErrorObj,
    refetch: refetchTournaments,
  } = useTournaments({});

  // Filter tournaments that are in the wishlist
  const wishlistedTournaments = useMemo(() => {
    if (!wishlistData?.wishlist || !tournamentsData?.pages) {
      return [];
    }

    const wishlistPKs = new Set(
      wishlistData.wishlist.map((item) => item.tournamentPK)
    );

    const allTournaments = tournamentsData.pages.flatMap(
      (page) => page.tournaments
    );

    return allTournaments.filter((tournament) => {
      const tournamentPK = getTournamentPK(tournament);
      return wishlistPKs.has(tournamentPK);
    });
  }, [wishlistData, tournamentsData]);

  // Loading state
  if (wishlistLoading || tournamentsLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <h1 className="text-3xl font-bold mb-8">My Wishlist</h1>
        <TournamentGridSkeleton count={6} />
      </div>
    );
  }

  // Error state
  if (wishlistError || tournamentsError) {
    const errorMessage =
      wishlistErrorObj instanceof Error
        ? wishlistErrorObj.message
        : tournamentsErrorObj instanceof Error
        ? tournamentsErrorObj.message
        : 'Failed to load wishlist. Please try again.';

    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <h1 className="text-3xl font-bold mb-8">My Wishlist</h1>
        <ErrorState
          title="Unable to load wishlist"
          message={errorMessage}
          onRetry={() => {
            refetchWishlist();
            refetchTournaments();
          }}
        />
      </div>
    );
  }

  // Empty state
  if (wishlistedTournaments.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <h1 className="text-3xl font-bold mb-8">My Wishlist</h1>
        <EmptyState
          title="No tournaments tracked yet"
          message="Start tracking tournaments to build your competition calendar. Browse tournaments and click the track button to add them to your wishlist."
          action={{
            label: 'Browse Tournaments',
            onClick: () => (window.location.href = '/tournaments'),
          }}
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">My Wishlist</h1>
        <p className="text-sm text-muted-foreground">
          Tracking {wishlistedTournaments.length} tournament
          {wishlistedTournaments.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Responsive grid: 1 col on mobile, 2 on tablet, 3 on desktop */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {wishlistedTournaments.map((tournament, index) => (
          <ScoreboardTournamentCard
            key={tournament.id}
            tournament={tournament}
            index={index}
          />
        ))}
      </div>

      {/* Link back to browse tournaments */}
      <div className="mt-8 text-center">
        <Link
          href="/tournaments"
          className="text-sm text-[#00F0FF] hover:text-[#00D0DF] transition-colors"
        >
          ← Back to All Tournaments
        </Link>
      </div>
    </div>
  );
}
