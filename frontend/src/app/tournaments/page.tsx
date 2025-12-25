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
    <div className="relative min-h-screen">
      <div className="relative z-10">
        <div className="container mx-auto max-w-7xl py-8 sm:py-12 px-4">
          {/* Header */}
          <div className="mb-8 sm:mb-12">
            <h1 className="text-4xl sm:text-5xl font-bold text-white mb-3">
              BJJ Tournaments
            </h1>
            <p className="text-white/60 text-lg">
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
    </div>
  );
}
