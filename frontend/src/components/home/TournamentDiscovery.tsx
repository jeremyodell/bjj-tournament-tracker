'use client';

import { Suspense } from 'react';
import { TournamentList } from '@/components/tournaments/TournamentList';
import { TournamentFilters } from '@/components/tournaments/TournamentFilters';
import { TournamentGridSkeleton } from '@/components/tournaments/TournamentCardSkeleton';

export function TournamentDiscovery() {
  return (
    <section id="tournaments" className="py-16 sm:py-20">
      <div className="container mx-auto px-4">
        <div className="max-w-7xl mx-auto">
          {/* Section Header */}
          <div className="mb-8 sm:mb-12">
            <h2
              className="text-3xl sm:text-4xl font-bold mb-3"
              style={{
                fontFamily: 'var(--font-mono-display)',
                color: 'var(--scoreboard-white)',
              }}
            >
              UPCOMING TOURNAMENTS
            </h2>
            <p
              className="text-base sm:text-lg opacity-70 max-w-2xl"
              style={{
                fontFamily: 'var(--font-body)',
              }}
            >
              Track competitions, see who's competing, and plan your season
            </p>
          </div>

          {/* Filters + Tournament Grid */}
          <div className="space-y-6">
            <Suspense fallback={null}>
              <TournamentFilters />
            </Suspense>

            <Suspense fallback={<TournamentGridSkeleton count={6} />}>
              <TournamentList />
            </Suspense>
          </div>
        </div>
      </div>
    </section>
  );
}
