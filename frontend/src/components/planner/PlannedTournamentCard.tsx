// frontend/src/components/planner/PlannedTournamentCard.tsx
'use client';

import { useState } from 'react';
import type { PlannedTournament } from '@/stores/plannerStore';
import { usePlannerStore } from '@/stores/plannerStore';

interface PlannedTournamentCardProps {
  plannedTournament: PlannedTournament;
  index?: number;
  onTravelTypeClick?: (plannedTournament: PlannedTournament) => void;
}

export function PlannedTournamentCard({ plannedTournament, index, onTravelTypeClick }: PlannedTournamentCardProps) {
  const { lockTournament, removeTournament } = usePlannerStore();
  const { tournament, registrationCost, travelCost, travelType, isLocked, flightPrice, driveDistance } = plannedTournament;
  const [showTooltip, setShowTooltip] = useState(false);

  const totalCost = registrationCost + travelCost;

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

  const handleLock = () => {
    lockTournament(tournament.id);
  };

  const handleRemove = () => {
    removeTournament(tournament.id);
  };

  return (
    <div
      className={`group relative rounded-2xl border transition-all duration-300 ${glowClass}`}
      style={{
        background: 'var(--glass-bg)',
        borderColor: isLocked ? '#d4af37' : 'var(--glass-border)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        animationDelay: `${(index || 0) * 100}ms`,
      }}
    >
      {/* Must-Go Badge - positioned inside card to avoid overflow clipping */}
      {isLocked && (
        <div
          className="absolute top-3 right-3 z-10 px-3 py-1 rounded-full text-xs font-bold shadow-lg"
          style={{
            background: 'linear-gradient(135deg, #d4af37 0%, #c9a227 100%)',
            color: '#000',
            boxShadow: '0 2px 8px rgba(212, 175, 55, 0.4)',
          }}
        >
          Must-Go
        </div>
      )}

      <div className="p-4 sm:p-6 flex flex-col sm:flex-row gap-4 sm:gap-6">
        {/* DATE BLOCK */}
        <div className="flex-shrink-0 flex sm:block items-center gap-3 sm:gap-0">
          {/* Mobile: horizontal layout */}
          <div
            className="sm:hidden flex items-center gap-2 px-4 py-2 rounded-xl border-l-2 border-t border-r border-b transition-all duration-300"
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
            <div className="text-xs font-medium opacity-60">-</div>
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
            {/* LOCATION */}
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

            {/* ORG + EVENT NAME */}
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

            {/* Cost Breakdown + Travel Type */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Travel Type - Clickable to change */}
              <button
                onClick={() => onTravelTypeClick?.(plannedTournament)}
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                className="relative inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium gap-1.5 transition-all hover:scale-105 cursor-pointer"
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--glass-border)',
                }}
                title="Click to change travel type"
              >
                {travelType === 'drive' ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                )}
                <span>
                  {travelType === 'drive' ? 'Drive' : 'Fly'}
                  {travelType === 'fly' && flightPrice?.source === 'estimated_range' && (
                    <span className="ml-1 opacity-60">~</span>
                  )}
                </span>
                <span className="font-semibold">
                  {travelType === 'fly' && flightPrice?.source === 'estimated_range' && flightPrice.rangeMin && flightPrice.rangeMax
                    ? `$${flightPrice.rangeMin}-$${flightPrice.rangeMax}`
                    : `$${travelCost}`}
                </span>
                {driveDistance && travelType === 'drive' && (
                  <span className="opacity-60 ml-1">({Math.round(driveDistance)} mi)</span>
                )}

                {/* Tooltip for flight details */}
                {showTooltip && travelType === 'fly' && flightPrice && (
                  <div
                    className="absolute left-0 top-full mt-2 z-20 p-3 rounded-lg text-left whitespace-nowrap"
                    style={{
                      background: 'rgba(0, 0, 0, 0.9)',
                      border: '1px solid var(--glass-border)',
                      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
                    }}
                  >
                    <div className="text-sm font-medium mb-1">
                      {flightPrice.route.origin} → {flightPrice.route.destination}
                    </div>
                    {flightPrice.airline && (
                      <div className="text-xs opacity-70">{flightPrice.airline}</div>
                    )}
                    <div className="text-xs opacity-50 mt-1">
                      {flightPrice.source === 'amadeus' ? 'Checked ' : 'Based on similar routes • '}
                      {new Date(flightPrice.fetchedAt).toLocaleDateString()}
                    </div>
                    <div className="text-xs opacity-50 mt-0.5">Click to change</div>
                  </div>
                )}
              </button>

              {/* Registration Cost */}
              <div
                className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium gap-1.5"
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--glass-border)',
                }}
              >
                <svg className="w-3.5 h-3.5 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                </svg>
                <span>${registrationCost}</span>
              </div>

              {/* Total Cost */}
              <div
                className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium"
                style={{
                  background: 'rgba(212, 175, 55, 0.1)',
                  border: '1px solid rgba(212, 175, 55, 0.3)',
                  color: '#d4af37',
                }}
              >
                Total: ${totalCost}
              </div>
            </div>

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
          </div>

          {/* Bottom Section - Actions */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t" style={{ borderColor: 'var(--glass-border)' }}>
            <div className="flex items-center gap-2">
              {/* Lock Button */}
              {!isLocked && (
                <button
                  onClick={handleLock}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-300 hover:scale-105"
                  style={{
                    background: 'rgba(212, 175, 55, 0.15)',
                    color: '#d4af37',
                    border: '1px solid rgba(212, 175, 55, 0.3)',
                  }}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Lock
                </button>
              )}

              {/* Remove Button */}
              <button
                onClick={handleRemove}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-300 hover:scale-105"
                style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  color: '#ef4444',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                }}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
                Remove
              </button>

              {/* Swap Button - Disabled for now */}
              <button
                disabled
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium opacity-50 cursor-not-allowed"
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--glass-border)',
                }}
                title="Swap feature coming soon"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                Swap
              </button>
            </div>

            {/* View Details Link */}
            {tournament.registrationUrl && (
              <a
                href={tournament.registrationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group/button flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-300 hover:scale-105"
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
