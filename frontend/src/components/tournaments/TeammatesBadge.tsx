'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { GymRoster, RosterAthlete } from '@/lib/api';

interface TeammatesBadgeProps {
  roster: GymRoster | null | undefined;
  org: 'JJWL' | 'IBJJF';
  isLoading?: boolean;
  tournamentId?: string;
}

const BELT_COLORS: Record<string, { bg: string; text: string; border?: string }> = {
  white: { bg: 'bg-white', text: 'text-gray-900' },
  blue: { bg: 'bg-blue-600', text: 'text-white' },
  purple: { bg: 'bg-purple-600', text: 'text-white' },
  brown: { bg: 'bg-amber-800', text: 'text-white' },
  black: { bg: 'bg-gray-900', text: 'text-white', border: 'border border-gray-600' },
  yellow: { bg: 'bg-yellow-400', text: 'text-gray-900' },
  orange: { bg: 'bg-orange-500', text: 'text-white' },
  green: { bg: 'bg-green-600', text: 'text-white' },
  grey: { bg: 'bg-gray-500', text: 'text-white' },
  gray: { bg: 'bg-gray-500', text: 'text-white' },
};

function BeltIndicator({ belt }: { belt: string }) {
  const beltLower = belt.toLowerCase();
  const colors = BELT_COLORS[beltLower] || BELT_COLORS.white;

  return (
    <div
      data-testid={`belt-indicator-${beltLower}`}
      className={`w-3 h-3 rounded-full flex-shrink-0 ${colors.bg} ${colors.border || ''}`}
      title={`${belt} belt`}
    />
  );
}

function AthleteRow({ athlete }: { athlete: RosterAthlete }) {
  return (
    <div className="flex items-center gap-2 py-1.5">
      <BeltIndicator belt={athlete.belt} />
      <span className="text-sm text-gray-200 truncate">{athlete.name}</span>
    </div>
  );
}

function SkeletonBadge() {
  return (
    <div
      data-testid="teammates-badge-skeleton"
      className="h-7 w-24 rounded-full bg-gray-700/50 animate-pulse"
    />
  );
}

export function TeammatesBadge({
  roster,
  org,
  isLoading = false,
  tournamentId,
}: TeammatesBadgeProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Show skeleton while loading
  if (isLoading) {
    return <SkeletonBadge />;
  }

  // Hide when no roster or zero athletes
  if (!roster || roster.athleteCount === 0) {
    return null;
  }

  const { athletes, athleteCount } = roster;
  const displayedAthletes = athletes.slice(0, 3);
  const remainingCount = athleteCount - 3;
  const hasMore = remainingCount > 0;

  // Org-based colors: JJWL = cyan, IBJJF = fuchsia
  const isJJWL = org === 'JJWL';
  const colorClasses = isJJWL
    ? 'text-cyan-400 bg-cyan-500/20 border-cyan-500/30 hover:bg-cyan-500/30'
    : 'text-fuchsia-400 bg-fuchsia-500/20 border-fuchsia-500/30 hover:bg-fuchsia-500/30';

  const teammateText = athleteCount === 1 ? 'teammate' : 'teammates';

  return (
    <div className="relative">
      {/* Badge button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-all duration-200 ${colorClasses}`}
        aria-expanded={isExpanded}
        aria-controls="teammates-list"
      >
        <svg
          className="w-3.5 h-3.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
        <span>
          {athleteCount} {teammateText}
        </span>
        <svg
          className={`w-3 h-3 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded dropdown */}
      {isExpanded && (
        <div
          id="teammates-list"
          data-testid="teammates-expanded"
          className="absolute top-full left-0 mt-2 z-10 min-w-[200px] rounded-lg border border-gray-700 bg-gray-800/95 backdrop-blur-sm shadow-xl overflow-hidden animate-slide-down"
        >
          <div className="p-3">
            {displayedAthletes.map((athlete, index) => (
              <AthleteRow key={`${athlete.name}-${index}`} athlete={athlete} />
            ))}
            {hasMore && tournamentId && (
              <Link
                href={`/tournaments/${tournamentId}/roster`}
                className={`block mt-2 pt-2 border-t border-gray-700 text-sm font-medium hover:underline ${
                  isJJWL ? 'text-cyan-400' : 'text-fuchsia-400'
                }`}
              >
                +{remainingCount} more
              </Link>
            )}
            {hasMore && !tournamentId && (
              <span className={`block mt-2 pt-2 border-t border-gray-700 text-sm ${
                isJJWL ? 'text-cyan-400' : 'text-fuchsia-400'
              }`}>
                +{remainingCount} more
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
