'use client';

import { useState, useCallback } from 'react';
import { TournamentList } from '@/components/tournaments/TournamentList';
import { TournamentFilters } from '@/components/tournaments/TournamentFilters';
import type { TournamentFilters as Filters } from '@/lib/types';

export default function TournamentsPage() {
  const [filters, setFilters] = useState<Filters>({});

  const handleClearFilters = useCallback(() => {
    setFilters({});
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-4 sm:py-8 px-4">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold">BJJ Tournaments</h1>
          <p className="text-muted-foreground mt-1">
            Find upcoming Brazilian Jiu-Jitsu tournaments from IBJJF and JJWL
          </p>
        </div>

        {/* Main content */}
        <div className="space-y-6">
          <TournamentFilters filters={filters} onFiltersChange={setFilters} />
          <TournamentList filters={filters} onClearFilters={handleClearFilters} />
        </div>
      </div>
    </div>
  );
}
