'use client';

import { useRouter } from 'next/navigation';
import type { Tournament } from '@/lib/types';
import { useAuthStore } from '@/stores/authStore';
import { useIsInWishlist, useWishlistMutations } from '@/hooks/useWishlist';

interface TournamentCardProps {
  tournament: Tournament;
  index?: number;
}

export function TournamentCard({ tournament, index }: TournamentCardProps) {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const isInWishlist = useIsInWishlist(tournament.id);
  const { addMutation, removeMutation } = useWishlistMutations();

  const handleHeartClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    if (isInWishlist) {
      removeMutation.mutate(tournament.id);
    } else {
      addMutation.mutate(tournament.id);
    }
  };

  const isLoading = addMutation.isPending || removeMutation.isPending;
  const getDaysUntil = (start: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(start);
    startDate.setHours(0, 0, 0, 0);
    const diffTime = startDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const daysUntil = getDaysUntil(tournament.startDate);

  const getTimeLabel = () => {
    if (daysUntil < 0) return null;
    if (daysUntil === 0) return 'Today';
    if (daysUntil === 1) return 'Tomorrow';
    if (daysUntil <= 7) return `In ${daysUntil} days`;
    if (daysUntil <= 30) return `In ${Math.ceil(daysUntil / 7)} weeks`;
    return null;
  };

  const timeLabel = getTimeLabel();

  // Get org-based accent colors
  const isIBJJF = tournament.org === 'IBJJF';
  const accentColor = isIBJJF ? '#00F0FF' : '#FF2D6A';
  const glowClass = isIBJJF
    ? 'hover:shadow-[0_0_30px_rgba(0,240,255,0.3)]'
    : 'hover:shadow-[0_0_30px_rgba(255,45,106,0.3)]';

  // Parse date for display
  const startDate = new Date(tournament.startDate);
  const month = startDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  const day = startDate.getDate();
  const weekday = startDate.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
  const year = startDate.getFullYear();

  return (
    <div
      className={`group relative rounded-2xl border transition-all duration-300 ${glowClass}`}
      style={{
        background: 'var(--glass-bg)',
        borderColor: 'var(--glass-border)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        animationDelay: `${(index || 0) * 100}ms`,
      }}
    >
      {/* Heart/Wishlist Button */}
      <button
        onClick={handleHeartClick}
        disabled={isLoading}
        className="absolute top-3 right-3 z-10 p-2 rounded-full transition-all duration-300 hover:scale-110 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          background: 'rgba(0, 0, 0, 0.3)',
          backdropFilter: 'blur(8px)',
        }}
        aria-label={isInWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
      >
        <svg
          className="w-5 h-5 transition-all duration-300"
          viewBox="0 0 24 24"
          fill={isInWishlist ? '#d4af37' : 'none'}
          stroke={isInWishlist ? '#d4af37' : 'currentColor'}
          strokeWidth={2}
          style={{
            filter: isInWishlist ? 'drop-shadow(0 0 4px rgba(212, 175, 55, 0.5))' : 'none',
          }}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
          />
        </svg>
      </button>

      <div className="p-4 sm:p-6 flex flex-col sm:flex-row gap-4 sm:gap-6">
        {/* DATE BLOCK - Hero Element */}
        <div className="flex-shrink-0 flex sm:block items-center gap-3 sm:gap-0">
          {/* Mobile: horizontal layout */}
          <div className="sm:hidden flex items-center gap-2 px-4 py-2 rounded-xl border-l-2 border-t border-r border-b transition-all duration-300"
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              borderLeftColor: accentColor,
              borderTopColor: 'var(--glass-border)',
              borderRightColor: 'var(--glass-border)',
              borderBottomColor: 'var(--glass-border)',
            }}
          >
            <div className="text-xs font-medium opacity-60 tracking-wider">{month}</div>
            <div
              className="text-2xl font-bold leading-none transition-colors duration-300"
              style={{ color: accentColor }}
            >
              {day}
            </div>
            <div className="text-xs font-medium opacity-40">{year}</div>
            <div className="text-xs font-medium opacity-60">•</div>
            <div className="text-xs font-medium opacity-60 tracking-wider">{weekday}</div>
          </div>

          {/* Desktop: vertical layout */}
          <div
            className="hidden sm:flex flex-col items-center justify-center w-24 h-28 rounded-xl border-l-2 border-t border-r border-b transition-all duration-300 relative"
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              borderLeftColor: accentColor,
              borderTopColor: 'var(--glass-border)',
              borderRightColor: 'var(--glass-border)',
              borderBottomColor: 'var(--glass-border)',
            }}
          >
            <div className="text-xs font-medium opacity-60 tracking-wider">{month}</div>
            <div
              className="text-4xl font-bold leading-none my-1 transition-colors duration-300"
              style={{ color: accentColor }}
            >
              {day}
            </div>
            <div className="text-xs font-medium opacity-60 tracking-wider">{weekday}</div>
            <div className="text-[10px] font-medium opacity-40 mt-0.5">{year}</div>
          </div>
        </div>

        {/* CONTENT */}
        <div className="flex-1 min-w-0 flex flex-col justify-between">
          {/* Top Section */}
          <div className="space-y-3">
            {/* LOCATION - Second Most Prominent */}
            <div className="flex items-start gap-2">
              <svg
                className="h-5 w-5 mt-0.5 flex-shrink-0 opacity-60"
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
              <span className="text-xl font-semibold leading-tight">
                {tournament.city}
                {tournament.country ? `, ${tournament.country}` : ''}
              </span>
            </div>

            {/* ORG + EVENT NAME - Third Tier */}
            <div className="flex items-start gap-3">
              <div
                className="px-3 py-1 rounded-lg text-xs font-bold tracking-wider flex-shrink-0 transition-all duration-300"
                style={{
                  background: `${accentColor}15`,
                  color: accentColor,
                  border: `1px solid ${accentColor}40`,
                }}
              >
                {tournament.org}
              </div>
              <h3 className="text-base font-medium leading-snug opacity-90 line-clamp-2">
                {tournament.name}
              </h3>
            </div>

            {/* Time Label and Distance */}
            <div className="flex flex-wrap gap-2">
              {timeLabel && (
                <div
                  className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium"
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--glass-border)',
                  }}
                >
                  {timeLabel}
                </div>
              )}
              {tournament.distanceMiles !== undefined && (
                <div
                  className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium"
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--glass-border)',
                  }}
                >
                  {tournament.distanceMiles} mi away
                </div>
              )}
            </div>
          </div>

          {/* Bottom Section */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t" style={{ borderColor: 'var(--glass-border)' }}>
            {/* Event type tags */}
            <div className="flex flex-wrap gap-2">
              {tournament.gi && (
                <div className="px-3 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  GI
                </div>
              )}
              {tournament.nogi && (
                <div className="px-3 py-1 rounded-full text-xs font-medium bg-orange-500/10 text-orange-400 border border-orange-500/20">
                  NOGI
                </div>
              )}
              {tournament.kids && (
                <div className="px-3 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
                  KIDS
                </div>
              )}
            </div>

            {/* View Details Link */}
            {tournament.registrationUrl && (
              <a
                href={tournament.registrationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group/button flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 hover:scale-105"
                style={{
                  background: `${accentColor}30`,
                  color: accentColor,
                  border: `1px solid ${accentColor}50`,
                }}
              >
                <span>View</span>
                <svg
                  className="h-4 w-4 transition-transform duration-300 group-hover/button:translate-x-1"
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
    </div>
  );
}
