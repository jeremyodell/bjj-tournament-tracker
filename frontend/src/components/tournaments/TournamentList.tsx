'use client';

import { useEffect, useRef } from 'react';
import { useTournaments } from '@/hooks/useTournaments';
import { TournamentCard } from './TournamentCard';
import { TournamentGridSkeleton } from './TournamentCardSkeleton';
import { ErrorState, EmptyState } from './ErrorState';
import type { TournamentFilters } from '@/lib/types';

interface TournamentListProps {
  filters?: TournamentFilters;
  onClearFilters?: () => void;
}

export function TournamentList({ filters = {}, onClearFilters }: TournamentListProps) {
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

  const tournaments = data?.pages.flatMap((page) => page.tournaments) ?? [];

  // Empty state
  if (tournaments.length === 0) {
    const hasActiveFilters = Object.values(filters).some(
      (v) => v !== undefined && v !== ''
    );

    return (
      <EmptyState
        title="No tournaments found"
        message={
          hasActiveFilters
            ? 'No tournaments match your current filters. Try adjusting your search criteria.'
            : 'No tournaments are currently available. Check back later for upcoming events.'
        }
        action={
          hasActiveFilters && onClearFilters
            ? { label: 'Clear Filters', onClick: onClearFilters }
            : undefined
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Tournament count */}
      <div className="text-sm text-muted-foreground">
        Showing {tournaments.length} tournament{tournaments.length !== 1 ? 's' : ''}
      </div>

      {/* Responsive grid: 1 col on mobile, 2 on tablet, 3 on desktop */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {tournaments.map((tournament, index) => (
          <div
            key={tournament.id}
            className="animate-fade-in-up opacity-0"
            style={{ animationDelay: `${index * 100}ms`, animationFillMode: 'forwards' }}
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
          <svg
            className="animate-spin h-8 w-8 text-muted-foreground/50"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        </div>
      )}
    </div>
  );
}
