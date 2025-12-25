'use client';

import type { Tournament } from '@/lib/types';

interface TournamentCardProps {
  tournament: Tournament;
}

export function TournamentCard({ tournament }: TournamentCardProps) {
  const formatDateRange = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };

    if (start === end) {
      return startDate.toLocaleDateString('en-US', { ...options, year: 'numeric' });
    }

    return `${startDate.toLocaleDateString('en-US', options)} - ${endDate.toLocaleDateString('en-US', { ...options, year: 'numeric' })}`;
  };

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

  return (
    <div
      className={`group relative rounded-2xl border transition-all duration-300 ${glowClass}`}
      style={{
        background: 'var(--glass-bg)',
        borderColor: 'var(--glass-border)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
      }}
    >
      <div className="p-6 flex gap-6">
        {/* DATE BLOCK - Hero Element */}
        <div className="flex-shrink-0">
          <div
            className="flex flex-col items-center justify-center w-24 h-24 rounded-xl border transition-all duration-300"
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              borderColor: 'var(--glass-border)',
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

            {/* Time Label */}
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
          </div>

          {/* Bottom Section */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t" style={{ borderColor: 'var(--glass-border)' }}>
            {/* Event type tags */}
            <div className="flex flex-wrap gap-2">
              {tournament.gi && (
                <div
                  className="px-2.5 py-1 rounded-md text-xs font-medium"
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--glass-border)',
                  }}
                >
                  GI
                </div>
              )}
              {tournament.nogi && (
                <div
                  className="px-2.5 py-1 rounded-md text-xs font-medium"
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--glass-border)',
                  }}
                >
                  NOGI
                </div>
              )}
              {tournament.kids && (
                <div
                  className="px-2.5 py-1 rounded-md text-xs font-medium"
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--glass-border)',
                  }}
                >
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
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 hover:scale-105"
                style={{
                  background: `${accentColor}20`,
                  color: accentColor,
                  border: `1px solid ${accentColor}40`,
                }}
              >
                <span>View</span>
                <svg
                  className="h-4 w-4"
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
