'use client';

import type { Tournament } from '@/lib/types';

interface TournamentHeroProps {
  tournament: Tournament;
}

export function TournamentHero({ tournament }: TournamentHeroProps) {
  const isIBJJF = tournament.org === 'IBJJF';

  // Org-based gradient colors
  // JJWL: cyan-500 to blue-600
  // IBJJF: fuchsia-500 to purple-600
  const gradientClass = isIBJJF
    ? 'from-fuchsia-500 to-purple-600'
    : 'from-cyan-500 to-blue-600';

  const accentColor = isIBJJF ? '#d946ef' : '#06b6d4';

  // Parse date for display
  const startDate = new Date(tournament.startDate);
  const endDate = new Date(tournament.endDate);
  const month = startDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  const startDay = startDate.getDate();
  const endDay = endDate.getDate();
  const year = startDate.getFullYear();
  const weekday = startDate.toLocaleDateString('en-US', { weekday: 'long' });

  // Check if multi-day event
  const isMultiDay = startDay !== endDay;
  const dateDisplay = isMultiDay ? `${startDay}-${endDay}` : `${startDay}`;

  return (
    <div className="relative overflow-hidden">
      {/* Background - either banner image or gradient */}
      {tournament.bannerUrl ? (
        <>
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${tournament.bannerUrl})` }}
          />
          <div className="absolute inset-0 bg-black/60" />
        </>
      ) : (
        <div className={`absolute inset-0 bg-gradient-to-br ${gradientClass} opacity-30`} />
      )}

      {/* Content */}
      <div className="relative container mx-auto max-w-7xl px-4 py-12 sm:py-16 lg:py-20">
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-start">
          {/* Date Block */}
          <div
            className="flex-shrink-0 flex flex-col items-center justify-center w-32 h-36 rounded-2xl border transition-all duration-300"
            style={{
              background: 'rgba(0, 0, 0, 0.5)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              borderColor: `${accentColor}40`,
            }}
          >
            <div className="text-sm font-medium opacity-70 tracking-wider">{month}</div>
            <div
              className="text-5xl font-bold leading-none my-2"
              style={{ color: accentColor }}
            >
              {dateDisplay}
            </div>
            <div className="text-sm font-medium opacity-70 tracking-wider">{weekday}</div>
            <div className="text-xs font-medium opacity-50 mt-1">{year}</div>
          </div>

          {/* Main Info */}
          <div className="flex-1 space-y-6">
            {/* Org Badge */}
            <div
              className="inline-flex px-4 py-1.5 rounded-lg text-sm font-bold tracking-wider"
              style={{
                background: `${accentColor}20`,
                color: accentColor,
                border: `1px solid ${accentColor}50`,
              }}
            >
              {tournament.org}
            </div>

            {/* Tournament Name */}
            <h1
              className="font-[family-name:var(--font-display)] text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight"
              style={{
                textShadow: '0 2px 20px rgba(0,0,0,0.3)',
              }}
            >
              {tournament.name}
            </h1>

            {/* Location */}
            <div className="flex items-center gap-2 text-white/80">
              <svg
                className="h-5 w-5 flex-shrink-0"
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
              <span className="text-lg">
                {tournament.venue && `${tournament.venue}, `}
                {tournament.city}
                {tournament.country && `, ${tournament.country}`}
              </span>
            </div>

            {/* Event Type Tags */}
            <div className="flex flex-wrap gap-3">
              {tournament.gi && (
                <div className="px-4 py-1.5 rounded-full text-sm font-medium bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  GI
                </div>
              )}
              {tournament.nogi && (
                <div className="px-4 py-1.5 rounded-full text-sm font-medium bg-orange-500/20 text-orange-300 border border-orange-500/30">
                  NOGI
                </div>
              )}
              {tournament.kids && (
                <div className="px-4 py-1.5 rounded-full text-sm font-medium bg-green-500/20 text-green-300 border border-green-500/30">
                  KIDS
                </div>
              )}
            </div>

            {/* Register Button */}
            {tournament.registrationUrl && (
              <a
                href={tournament.registrationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-8 py-3 rounded-xl text-base font-semibold transition-all duration-300 hover:scale-105 shadow-lg"
                style={{
                  background: `linear-gradient(135deg, ${accentColor}, ${isIBJJF ? '#a855f7' : '#3b82f6'})`,
                  color: 'white',
                }}
              >
                <span>Register Now</span>
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
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
