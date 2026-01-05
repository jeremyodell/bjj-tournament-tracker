'use client';

import { useMemo } from 'react';
import type { GymRoster, RosterAthlete } from '@/lib/api';

interface GymRosterSectionProps {
  roster: GymRoster | null | undefined;
  isLoading: boolean;
  onRefresh: () => void;
  lastUpdatedAt?: number;
  org: 'JJWL' | 'IBJJF';
}

const BELT_COLORS: Record<string, { bg: string; border?: string }> = {
  white: { bg: 'bg-white' },
  blue: { bg: 'bg-blue-600' },
  purple: { bg: 'bg-purple-600' },
  brown: { bg: 'bg-amber-800' },
  black: { bg: 'bg-gray-900', border: 'border border-gray-500' },
  yellow: { bg: 'bg-yellow-400' },
  orange: { bg: 'bg-orange-500' },
  green: { bg: 'bg-green-600' },
  grey: { bg: 'bg-gray-500' },
  gray: { bg: 'bg-gray-500' },
};

function BeltIndicator({ belt }: { belt: string }) {
  const beltLower = belt.toLowerCase();
  const colors = BELT_COLORS[beltLower] || BELT_COLORS.white;

  return (
    <div
      className={`w-3 h-3 rounded-full flex-shrink-0 ${colors.bg} ${colors.border || ''}`}
      title={`${belt} belt`}
    />
  );
}

function AthleteRow({ athlete }: { athlete: RosterAthlete }) {
  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-white/5 transition-colors">
      <BeltIndicator belt={athlete.belt} />
      <span className="text-sm text-white flex-1 truncate">{athlete.name}</span>
      <span className="text-xs text-white/50">{athlete.weight}</span>
    </div>
  );
}

function formatTimeAgo(timestamp: number | undefined): string {
  if (!timestamp) return 'Unknown';

  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  return 'Just now';
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-6 w-32 bg-white/10 rounded" />
        <div className="h-8 w-24 bg-white/10 rounded" />
      </div>
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 bg-white/5 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export function GymRosterSection({
  roster,
  isLoading,
  onRefresh,
  lastUpdatedAt,
  org,
}: GymRosterSectionProps) {
  // Group athletes by age division
  const groupedAthletes = useMemo(() => {
    if (!roster?.athletes) return {};

    const groups: Record<string, RosterAthlete[]> = {};

    roster.athletes.forEach((athlete) => {
      const ageDiv = athlete.ageDiv || 'Unknown';
      if (!groups[ageDiv]) {
        groups[ageDiv] = [];
      }
      groups[ageDiv].push(athlete);
    });

    // Sort athletes within each group by name
    Object.keys(groups).forEach((key) => {
      groups[key].sort((a, b) => a.name.localeCompare(b.name));
    });

    return groups;
  }, [roster?.athletes]);

  const ageDivisions = Object.keys(groupedAthletes).sort();

  // Org-based accent color
  const isJJWL = org === 'JJWL';
  const accentColor = isJJWL ? '#06b6d4' : '#d946ef';

  if (isLoading) {
    return (
      <div
        className="rounded-2xl border p-6"
        style={{
          background: 'var(--glass-bg)',
          borderColor: 'var(--glass-border)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
        }}
      >
        <LoadingSkeleton />
      </div>
    );
  }

  // Empty state
  if (!roster || roster.athleteCount === 0) {
    return (
      <div
        className="rounded-2xl border p-6"
        style={{
          background: 'var(--glass-bg)',
          borderColor: 'var(--glass-border)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white">Your Teammates</h2>
          <button
            onClick={() => onRefresh()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all hover:bg-white/10"
            style={{ color: accentColor }}
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Refresh
          </button>
        </div>
        <div className="text-center py-8">
          <div className="text-4xl mb-3 opacity-30">
            <svg
              className="w-16 h-16 mx-auto"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
          </div>
          <p className="text-white/60">No teammates registered yet</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl border p-6"
      style={{
        background: 'var(--glass-bg)',
        borderColor: 'var(--glass-border)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-white">Your Teammates</h2>
          <p className="text-sm text-white/50 mt-1">
            {roster.athleteCount} teammate{roster.athleteCount !== 1 ? 's' : ''} registered
          </p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-white/40">
            Updated {formatTimeAgo(lastUpdatedAt)}
          </span>
          <button
            onClick={() => onRefresh()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all hover:scale-105"
            style={{
              background: `${accentColor}20`,
              color: accentColor,
              border: `1px solid ${accentColor}40`,
            }}
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Grouped Athletes by Age Division */}
      <div className="space-y-6">
        {ageDivisions.map((ageDiv) => (
          <div key={ageDiv}>
            <h3
              className="text-sm font-medium mb-2 px-3 py-1.5 rounded-lg inline-block"
              style={{
                background: `${accentColor}15`,
                color: accentColor,
              }}
            >
              {ageDiv}
            </h3>
            <div className="space-y-1">
              {groupedAthletes[ageDiv].map((athlete, index) => (
                <AthleteRow
                  key={`${athlete.name}-${athlete.weight}-${index}`}
                  athlete={athlete}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
