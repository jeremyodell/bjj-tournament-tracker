'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Calendar, Star } from 'lucide-react';
import type { Tournament } from '@/lib/types';
import { useWishlist } from '@/hooks/useWishlist';
import { useAddToWishlist } from '@/hooks/useAddToWishlist';
import { useRemoveFromWishlist } from '@/hooks/useRemoveFromWishlist';
import { useAuthStore } from '@/stores/authStore';
import { getTournamentPK, getDaysUntilTournament, formatTournamentDate } from '@/lib/tournamentUtils';
import { generateTournamentICS, downloadICS } from '@/lib/calendar';

interface ScoreboardTournamentCardProps {
  tournament: Tournament;
  index?: number;
}

export function ScoreboardTournamentCard({ tournament, index }: ScoreboardTournamentCardProps) {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const { data: wishlistData } = useWishlist();
  const addToWishlist = useAddToWishlist();
  const removeFromWishlist = useRemoveFromWishlist();

  // Build tournament PK for matching
  const tournamentPK = useMemo(() => getTournamentPK(tournament), [tournament]);

  // Check if this tournament is tracked
  const isTracked = useMemo(() => {
    return wishlistData?.wishlist.some((item) => item.tournamentPK === tournamentPK) ?? false;
  }, [wishlistData, tournamentPK]);

  // Track loading state from both mutations
  const isPending = addToWishlist.isPending || removeFromWishlist.isPending;

  const daysUntil = getDaysUntilTournament(tournament.startDate);

  // Parse date for LED display
  const { month, day, year } = formatTournamentDate(tournament.startDate);

  // Get org-based accent colors
  const isIBJJF = tournament.org === 'IBJJF';
  const orgColor = isIBJJF ? 'var(--accent-ibjjf)' : 'var(--accent-jjwl)';

  const handleTrack = () => {
    // Redirect to login if not authenticated
    if (!isAuthenticated) {
      router.push('/login?redirect=/tournaments');
      return;
    }

    // Track or untrack based on current state
    if (isTracked) {
      removeFromWishlist.mutate(tournament);
    } else {
      addToWishlist.mutate(tournament);
    }
  };

  const handleCalendarExport = () => {
    // Generate .ics file and trigger download
    const icsContent = generateTournamentICS(tournament);
    // Create slug from tournament name for filename
    const slug = tournament.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    downloadICS(icsContent, slug);
  };

  return (
    <div
      className="group relative border transition-all duration-200 hover:-translate-y-1"
      style={{
        background: 'var(--glass-bg)',
        borderColor: isTracked ? 'var(--scoreboard-yellow)' : 'var(--glass-border)',
        borderRadius: 'var(--radius)',
        backdropFilter: 'blur(var(--glass-blur))',
        WebkitBackdropFilter: 'blur(var(--glass-blur))',
        boxShadow: isTracked ? '0 0 20px var(--scoreboard-yellow-glow)' : 'none',
        animationDelay: `${(index || 0) * 50}ms`,
      }}
    >
      {/* Star Badge - Only show for tracked tournaments */}
      {isTracked && (
        <div className="absolute top-3 left-3 z-10">
          <div
            className="flex items-center justify-center w-7 h-7 rounded-full"
            style={{
              background: 'rgba(0, 0, 0, 0.6)',
              border: '1px solid var(--scoreboard-yellow)',
            }}
          >
            <Star
              className="w-4 h-4 fill-current"
              style={{
                color: 'var(--scoreboard-yellow)',
                filter: 'drop-shadow(0 0 8px var(--scoreboard-yellow-glow))',
              }}
            />
          </div>
        </div>
      )}

      {/* LED Status Indicator */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5">
        <div
          className="w-2 h-2 rounded-full animate-pulse"
          style={{
            background: daysUntil <= 7 ? 'var(--led-red)' : daysUntil <= 30 ? 'var(--led-amber)' : 'var(--led-green)',
            boxShadow: `0 0 8px ${daysUntil <= 7 ? 'var(--led-red)' : daysUntil <= 30 ? 'var(--led-amber)' : 'var(--led-green)'}`,
          }}
        />
      </div>

      <div className="p-5">
        {/* Header: Org Badge + Days Counter */}
        <div className="flex items-start justify-between mb-4">
          <div
            className="px-3 py-1 text-xs font-bold tracking-widest rounded"
            style={{
              fontFamily: 'var(--font-mono-display)',
              background: `${orgColor}20`,
              color: orgColor,
              border: `1px solid ${orgColor}40`,
            }}
          >
            {tournament.org}
          </div>

          {daysUntil >= 0 && (
            <div
              className="px-3 py-1 text-xs font-semibold tracking-wider rounded"
              style={{
                fontFamily: 'var(--font-mono-display)',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: 'var(--scoreboard-white)',
              }}
            >
              {daysUntil === 0 ? 'TODAY' : daysUntil === 1 ? 'TOMORROW' : `${daysUntil}D`}
            </div>
          )}
        </div>

        {/* Date Display - LED Style */}
        <div className="flex items-baseline gap-2 mb-3">
          <div
            className="text-4xl font-bold tracking-tight leading-none"
            style={{
              fontFamily: 'var(--font-mono-display)',
              color: 'var(--scoreboard-yellow)',
              textShadow: '0 0 12px var(--scoreboard-yellow-glow)',
            }}
          >
            {month} {day}
          </div>
          <div
            className="text-sm font-medium opacity-50"
            style={{
              fontFamily: 'var(--font-mono-display)',
            }}
          >
            {year}
          </div>
        </div>

        {/* Event Name */}
        <h3
          className="text-base font-medium leading-snug mb-2 line-clamp-2"
          style={{
            fontFamily: 'var(--font-body)',
            color: 'var(--scoreboard-white)',
          }}
        >
          {tournament.name}
        </h3>

        {/* Location */}
        <div className="flex items-center gap-2 mb-4 text-sm opacity-70">
          <svg
            className="w-4 h-4 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          <span style={{ fontFamily: 'var(--font-body)' }}>
            {tournament.city}
            {tournament.country ? `, ${tournament.country}` : ''}
          </span>
          {tournament.distanceMiles !== undefined && (
            <>
              <span className="opacity-40">•</span>
              <span style={{ fontFamily: 'var(--font-mono-display)' }}>
                {tournament.distanceMiles}mi
              </span>
            </>
          )}
        </div>

        {/* Division Tags */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {tournament.gi && (
            <div
              className="px-2 py-0.5 text-[10px] font-bold tracking-wider rounded"
              style={{
                fontFamily: 'var(--font-mono-display)',
                background: 'rgba(59, 130, 246, 0.15)',
                color: '#60A5FA',
                border: '1px solid rgba(59, 130, 246, 0.3)',
              }}
            >
              GI
            </div>
          )}
          {tournament.nogi && (
            <div
              className="px-2 py-0.5 text-[10px] font-bold tracking-wider rounded"
              style={{
                fontFamily: 'var(--font-mono-display)',
                background: 'rgba(249, 115, 22, 0.15)',
                color: '#FB923C',
                border: '1px solid rgba(249, 115, 22, 0.3)',
              }}
            >
              NOGI
            </div>
          )}
          {tournament.kids && (
            <div
              className="px-2 py-0.5 text-[10px] font-bold tracking-wider rounded"
              style={{
                fontFamily: 'var(--font-mono-display)',
                background: 'rgba(34, 197, 94, 0.15)',
                color: '#4ADE80',
                border: '1px solid rgba(34, 197, 94, 0.3)',
              }}
            >
              KIDS
            </div>
          )}
        </div>

        {/* Bottom Bar: Track Button + Who's Going */}
        <div className="flex items-center gap-3 pt-4 border-t" style={{ borderColor: 'var(--glass-border)' }}>
          {/* Track Button */}
          <button
            onClick={handleTrack}
            disabled={isPending}
            className="flex-1 px-4 py-2.5 rounded text-sm font-bold tracking-wide transition-all duration-200 hover:scale-105 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            style={{
              fontFamily: 'var(--font-mono-display)',
              background: isTracked
                ? 'var(--scoreboard-yellow)'
                : 'rgba(255, 215, 0, 0.15)',
              color: isTracked ? '#000' : 'var(--scoreboard-yellow)',
              border: isTracked
                ? '1px solid var(--scoreboard-yellow)'
                : '1px solid rgba(255, 215, 0, 0.3)',
            }}
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                LOADING
              </>
            ) : isTracked ? (
              '✓ TRACKING'
            ) : (
              'TRACK'
            )}
          </button>

          {/* Calendar Export Button - Only show for tracked tournaments */}
          {isTracked && (
            <button
              onClick={handleCalendarExport}
              className="p-2.5 rounded transition-all duration-200 hover:scale-110"
              style={{
                background: `${orgColor}20`,
                border: `1px solid ${orgColor}40`,
                color: orgColor,
              }}
              title="Add to Calendar"
              aria-label="Add to Calendar"
            >
              <Calendar className="w-4 h-4" />
            </button>
          )}

          {/* Who's Going Counter - Hidden until gym registration features are added */}
          {false && (
            <div
              className="flex items-center gap-2 px-3 py-2.5 rounded"
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
              }}
            >
              <svg
                className="w-4 h-4 opacity-60"
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
              <span
                className="text-sm font-bold tabular-nums"
                style={{
                  fontFamily: 'var(--font-mono-display)',
                  color: 'var(--scoreboard-white)',
                }}
              >
                0
              </span>
            </div>
          )}

          {/* View Details */}
          {tournament.registrationUrl && (
            <a
              href={tournament.registrationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2.5 rounded transition-all duration-200 hover:scale-110"
              style={{
                background: `${orgColor}20`,
                border: `1px solid ${orgColor}40`,
                color: orgColor,
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
                  d="M13 7l5 5m0 0l-5 5m5-5H6"
                />
              </svg>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
