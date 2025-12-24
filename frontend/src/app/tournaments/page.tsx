// frontend/src/app/tournaments/page.tsx
'use client';

import { useState } from 'react';
import { TournamentList } from '@/components/tournaments/TournamentList';
import { TournamentFilters } from '@/components/tournaments/TournamentFilters';
import type { TournamentFilters as Filters } from '@/lib/types';

export default function TournamentsPage() {
  const [filters, setFilters] = useState<Filters>({});

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-8">BJJ Tournaments</h1>

      <div className="space-y-6">
        <TournamentFilters filters={filters} onFiltersChange={setFilters} />
        <TournamentList filters={filters} />
      </div>
    </div>
  );
}
