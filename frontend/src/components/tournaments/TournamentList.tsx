'use client';

import { useEffect, useRef, useState } from 'react';
import { useTournaments } from '@/hooks/useTournaments';
import { useFilterParams } from '@/hooks/useFilterParams';
import { TournamentCard } from './TournamentCard';
import { TournamentGridSkeleton } from './TournamentCardSkeleton';
import { ErrorState, EmptyState } from './ErrorState';

export function TournamentList() {
  const { filters, clearAll } = useFilterParams();

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

  const loadMoreRef = useRef<HTMLDivElement>(null);
  const [hasAnimated, setHasAnimated] = useState(false);

  const tournaments = data?.pages.flatMap((page) => page.tournaments) ?? [];

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
      filters.datePreset !== '30';

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
      {/* Tournament count with distance hint */}
      <div className="text-sm text-muted-foreground">
        Showing {tournaments.length} tournament{tournaments.length !== 1 ? 's' : ''}
        {filters.radiusMiles && ` within ${filters.radiusMiles} miles`}
      </div>

      {/* Responsive grid: 1 col on mobile, 2 on tablet, 3 on desktop */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {tournaments.map((tournament, index) => (
          <div
            key={tournament.id}
            className={hasAnimated ? '' : 'animate-fade-in-up opacity-0'}
            style={!hasAnimated ? { animationDelay: `${index * 100}ms`, animationFillMode: 'forwards' } : {}}
          >
            <TournamentCard tournament={tournament} />
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
