'use client';

import { Suspense } from 'react';
import { TournamentList } from '@/components/tournaments/TournamentList';
import { TournamentFilters } from '@/components/tournaments/TournamentFilters';
import { TournamentGridSkeleton } from '@/components/tournaments/TournamentCardSkeleton';
import { AppHeader } from '@/components/layout/AppHeader';
import { Footer } from '@/components/landing/Footer';

export default function TournamentsPage() {
  return (
    <div className="relative min-h-screen flex flex-col">
      <AppHeader />

      {/* Main content with top padding for fixed header */}
      <main className="relative z-10 flex-1 pt-16">
        <div className="container mx-auto max-w-7xl py-8 sm:py-12 px-4">
          {/* Page Header */}
          <div className="mb-8 sm:mb-12">
            <h1
              className="font-[family-name:var(--font-display)] text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-3"
              style={{
                background:
                  'linear-gradient(135deg, #ffffff 0%, rgba(255, 255, 255, 0.8) 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              BJJ Tournaments
            </h1>
            <p className="text-white/60 text-lg max-w-xl">
              Find upcoming Brazilian Jiu-Jitsu tournaments from IBJJF and JJWL
            </p>
          </div>

          {/* Main content */}
          <div className="space-y-6">
            <Suspense fallback={null}>
              <TournamentFilters />
            </Suspense>
            <Suspense fallback={<TournamentGridSkeleton count={6} />}>
              <TournamentList />
            </Suspense>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
