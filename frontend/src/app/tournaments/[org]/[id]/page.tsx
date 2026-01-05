'use client';

import { use } from 'react';
import Link from 'next/link';
import { useTournament } from '@/hooks/useTournaments';
import { useGymRosterBySourceId } from '@/hooks/useGymSearch';
import { useAthletes } from '@/hooks/useAthletes';
import { useAuthStore } from '@/stores/authStore';
import { TournamentHero } from '@/components/tournaments/TournamentHero';
import { GymRosterSection } from '@/components/tournaments/GymRosterSection';
import { Footer } from '@/components/landing/Footer';

interface TournamentDetailPageProps {
  params: Promise<{ org: string; id: string }>;
}

export default function TournamentDetailPage({ params }: TournamentDetailPageProps) {
  const resolvedParams = use(params);
  const { org, id } = resolvedParams;

  // Construct the tournament ID as stored in the database (e.g., "TOURN#JJWL#123")
  const tournamentId = `TOURN#${org.toUpperCase()}#${id}`;

  const { isAuthenticated } = useAuthStore();
  const { data: tournament, isLoading: isTournamentLoading, error: tournamentError } = useTournament(tournamentId);
  const { data: athletesData } = useAthletes();

  // Get the first athlete's gym source ID if available
  const primaryAthlete = athletesData?.athletes?.[0];
  const gymSourceId = primaryAthlete?.gymSourceId;

  // Construct tournament source ID for roster lookup (e.g., "JJWL#123")
  const tournamentSourceId = `${org.toUpperCase()}#${id}`;

  const {
    data: gymRoster,
    isLoading: isRosterLoading,
    refetch: refetchRoster,
    dataUpdatedAt,
  } = useGymRosterBySourceId(gymSourceId, tournamentSourceId, {
    enabled: isAuthenticated && !!gymSourceId,
  });

  // Loading state
  if (isTournamentLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4" />
            <p className="text-white/60">Loading tournament...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // Error state
  if (tournamentError || !tournament) {
    return (
      <div className="min-h-screen flex flex-col">
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md mx-auto px-4">
            <div className="text-6xl mb-4">404</div>
            <h1 className="text-2xl font-bold text-white mb-2">Tournament Not Found</h1>
            <p className="text-white/60 mb-6">
              We couldn&apos;t find the tournament you&apos;re looking for.
            </p>
            <Link
              href="/tournaments"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-white font-medium"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to tournaments
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1">
        {/* Back link */}
        <div className="container mx-auto max-w-7xl px-4 pt-6">
          <Link
            href="/tournaments"
            className="inline-flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm font-medium"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to tournaments
          </Link>
        </div>

        {/* Tournament Hero */}
        <TournamentHero tournament={tournament} />

        {/* Gym Roster Section - only show if user has a gym */}
        {isAuthenticated && gymSourceId && (
          <div className="container mx-auto max-w-7xl px-4 py-8">
            <GymRosterSection
              roster={gymRoster}
              isLoading={isRosterLoading}
              onRefresh={refetchRoster}
              lastUpdatedAt={dataUpdatedAt}
              org={tournament.org}
            />
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
