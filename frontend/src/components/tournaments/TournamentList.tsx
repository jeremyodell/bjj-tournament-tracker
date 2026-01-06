'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { useTournaments } from '@/hooks/useTournaments';
import { useFilterParams } from '@/hooks/useFilterParams';
import { useWishlist } from '@/hooks/useWishlist';
import { useAuthStore } from '@/stores/authStore';
import { ScoreboardTournamentCard } from './ScoreboardTournamentCard';
import { TournamentGridSkeleton } from './TournamentCardSkeleton';
import { ErrorState, EmptyState } from './ErrorState';
import { TrackedFilter, type TrackedFilterValue } from './TrackedFilter';
import { getTournamentPK } from '@/lib/tournamentUtils';

export function TournamentList() {
  const { filters, clearAll } = useFilterParams();
  const { isAuthenticated } = useAuthStore();
  const [trackedFilter, setTrackedFilter] = useState<TrackedFilterValue>('all');

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useTournaments(filters);

  // Fetch wishlist if authenticated
  const { data: wishlistData } = useWishlist();

  const loadMoreRef = useRef<HTMLDivElement>(null);
  const [hasAnimated, setHasAnimated] = useState(false);

  // Get all tournaments
  const allTournaments = data?.pages.flatMap((page) => page.tournaments) ?? [];

  // Filter tournaments based on tracked status
  const tournaments = useMemo(() => {
    if (trackedFilter === 'all' || !isAuthenticated) {
      return allTournaments;
    }

    const wishlistPKs = new Set(
      wishlistData?.wishlist.map((item) => item.tournamentPK) ?? []
    );

    if (trackedFilter === 'tracked') {
      return allTournaments.filter((tournament) =>
        wishlistPKs.has(getTournamentPK(tournament))
      );
    }

    // not-tracked
    return allTournaments.filter(
      (tournament) => !wishlistPKs.has(getTournamentPK(tournament))
    );
  }, [allTournaments, trackedFilter, wishlistData, isAuthenticated]);

  // Set hasAnimated flag on initial load
  useEffect(() => {
    if (tournaments.length > 0 && !hasAnimated) {
      setHasAnimated(true);
    }
  }, [tournaments.length, hasAnimated]);

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0, rootMargin: '100px' } // Trigger 100px before reaching bottom
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Loading state with skeleton cards
  if (isLoading) {
    return <TournamentGridSkeleton count={6} />;
  }

  // Error state with retry button
  if (isError) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : 'Failed to load tournaments. Please check your connection and try again.';

    return (
      <ErrorState
        title="Unable to load tournaments"
        message={errorMessage}
        onRetry={() => refetch()}
      />
    );
  }

  // Empty state
  if (tournaments.length === 0) {
    const hasActiveFilters =
      filters.org ||
      filters.gi ||
      filters.nogi ||
      filters.kids ||
      filters.lat ||
      filters.radiusMiles ||
      filters.datePreset !== 'year';

    return (
      <EmptyState
        title="No tournaments found"
        message={
          hasActiveFilters
            ? 'No tournaments match your current filters. Try adjusting your search criteria.'
            : 'No tournaments are currently available. Check back later for upcoming events.'
        }
        action={
          hasActiveFilters
            ? { label: 'Clear Filters', onClick: clearAll }
            : undefined
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Tournament count and filter */}
      <div className="flex items-center justify-between gap-4">
        <div className="text-sm text-muted-foreground">
          Showing {tournaments.length} tournament{tournaments.length !== 1 ? 's' : ''}
          {filters.radiusMiles && ` within ${filters.radiusMiles} miles`}
        </div>
        {isAuthenticated && (
          <TrackedFilter value={trackedFilter} onChange={setTrackedFilter} />
        )}
      </div>

      {/* Responsive grid: 1 col on mobile, 2 on tablet, 3 on desktop */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {tournaments.map((tournament, index) => (
          <div
            key={tournament.id}
            className={hasAnimated ? '' : 'animate-fade-in-up opacity-0'}
            style={!hasAnimated ? { animationDelay: `${index * 100}ms`, animationFillMode: 'forwards' } : {}}
          >
            <ScoreboardTournamentCard tournament={tournament} index={index} />
          </div>
        ))}
      </div>

      {/* Infinite scroll sentinel element */}
      <div ref={loadMoreRef} className="h-1" />

      {/* Loading indicator for infinite scroll */}
      {isFetchingNextPage && (
        <div className="flex justify-center py-8">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#00F0FF] animate-pulse" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 rounded-full bg-[#00F0FF] animate-pulse" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 rounded-full bg-[#00F0FF] animate-pulse" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      )}
    </div>
  );
}
