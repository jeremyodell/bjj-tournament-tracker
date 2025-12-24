// frontend/src/components/tournaments/TournamentList.tsx
'use client';

import { useTournaments } from '@/hooks/useTournaments';
import { TournamentCard } from './TournamentCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import type { TournamentFilters } from '@/lib/types';

interface TournamentListProps {
  filters?: TournamentFilters;
}

export function TournamentList({ filters = {} }: TournamentListProps) {
  const {
    data,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useTournaments(filters);

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-48" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center py-8 text-destructive">
        Error loading tournaments: {error.message}
      </div>
    );
  }

  const tournaments = data?.pages.flatMap((page) => page.tournaments) ?? [];

  if (tournaments.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No tournaments found matching your criteria.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {tournaments.map((tournament) => (
          <TournamentCard key={tournament.id} tournament={tournament} />
        ))}
      </div>

      {hasNextPage && (
        <div className="text-center">
          <Button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            variant="outline"
          >
            {isFetchingNextPage ? 'Loading...' : 'Load More'}
          </Button>
        </div>
      )}
    </div>
  );
}
