// frontend/src/components/planner/wizard/MustGoStep.tsx
'use client';

import { useState, useMemo } from 'react';
import { usePlannerStore } from '@/stores/plannerStore';
import { useTournaments } from '@/hooks/useTournaments';
import { Input } from '@/components/ui/input';
import type { Tournament } from '@/lib/types';

interface MustGoStepProps {
  onNext: () => void;
  onBack: () => void;
}

const ORG_COLORS = {
  IBJJF: '#00F0FF',
  JJWL: '#FF2D6A',
} as const;

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function MustGoStep({ onNext, onBack }: MustGoStepProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const { config, addMustGo, removeMustGo } = usePlannerStore();
  const { data, isLoading } = useTournaments({});

  // Flatten all tournament pages into a single array
  const allTournaments = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((page) => page.tournaments);
  }, [data]);

  // Filter tournaments based on search query
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return allTournaments
      .filter(
        (t) =>
          t.name.toLowerCase().includes(query) ||
          t.city.toLowerCase().includes(query)
      )
      .slice(0, 10);
  }, [allTournaments, searchQuery]);

  // Get selected tournament objects from IDs
  const selectedTournaments = useMemo(() => {
    return allTournaments.filter((t) =>
      config.mustGoTournaments.includes(t.id)
    );
  }, [allTournaments, config.mustGoTournaments]);

  const hasMustGos = config.mustGoTournaments.length > 0;

  const handleToggleTournament = (tournament: Tournament) => {
    if (config.mustGoTournaments.includes(tournament.id)) {
      removeMustGo(tournament.id);
    } else {
      addMustGo(tournament.id);
    }
    // Clear search to close dropdown after selection
    setSearchQuery('');
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Any must-go tournaments?</h2>
        <p className="text-sm opacity-60">
          Pin anchor events you don&apos;t want to miss - we&apos;ll build your plan around them
        </p>
      </div>

      <div className="space-y-6 max-w-md mx-auto">
        {/* Search Input */}
        <div className="relative">
          <label htmlFor="tournament-search" className="sr-only">
            Search tournaments
          </label>
          <div className="relative">
            <svg
              className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 opacity-50"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <Input
              id="tournament-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tournaments..."
              className="pl-12 h-12 bg-white/5 border-white/10"
            />
          </div>

          {/* Search Results Dropdown */}
          {searchQuery.trim() && (
            <div
              className="absolute z-10 w-full mt-2 rounded-xl overflow-hidden"
              style={{
                background: 'rgba(30, 30, 40, 0.95)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
              }}
            >
              {isLoading ? (
                <div className="px-4 py-3 text-sm opacity-60">Loading...</div>
              ) : searchResults.length === 0 ? (
                <div className="px-4 py-3 text-sm opacity-60">
                  No tournaments found
                </div>
              ) : (
                <ul className="max-h-80 overflow-y-auto">
                  {searchResults.map((tournament) => {
                    const isSelected = config.mustGoTournaments.includes(
                      tournament.id
                    );
                    return (
                      <li key={tournament.id}>
                        <button
                          type="button"
                          onClick={() => handleToggleTournament(tournament)}
                          className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors text-left"
                        >
                          {/* Org Badge */}
                          <span
                            className="text-xs font-bold px-2 py-0.5 rounded"
                            style={{
                              backgroundColor: `${ORG_COLORS[tournament.org]}20`,
                              color: ORG_COLORS[tournament.org],
                            }}
                          >
                            {tournament.org}
                          </span>

                          {/* Tournament Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs opacity-50">
                                {formatDate(tournament.startDate)}
                              </span>
                            </div>
                            <div className="font-medium truncate">
                              {tournament.name}
                            </div>
                            <div className="text-sm opacity-60 truncate">
                              {tournament.city}
                            </div>
                          </div>

                          {/* Checkbox Indicator */}
                          <div
                            className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all"
                            style={{
                              background: isSelected
                                ? 'linear-gradient(135deg, #d4af37 0%, #c9a227 100%)'
                                : 'rgba(255, 255, 255, 0.1)',
                              border: isSelected
                                ? 'none'
                                : '2px solid rgba(255, 255, 255, 0.2)',
                            }}
                          >
                            {isSelected && (
                              <svg
                                className="w-4 h-4 text-black"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={3}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                            )}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Selected Must-Gos Section */}
        {selectedTournaments.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium opacity-80">
              Must-go tournaments ({selectedTournaments.length})
            </h3>
            <div className="space-y-2">
              {selectedTournaments.map((tournament) => (
                <div
                  key={tournament.id}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg"
                  style={{
                    background: 'rgba(212, 175, 55, 0.1)',
                    border: '1px solid rgba(212, 175, 55, 0.3)',
                  }}
                >
                  {/* Org Badge */}
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded"
                    style={{
                      backgroundColor: `${ORG_COLORS[tournament.org]}20`,
                      color: ORG_COLORS[tournament.org],
                    }}
                  >
                    {tournament.org}
                  </span>

                  {/* Tournament Info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs opacity-50">
                      {formatDate(tournament.startDate)}
                    </div>
                    <div
                      className="font-medium truncate"
                      style={{ color: '#d4af37' }}
                    >
                      {tournament.name}
                    </div>
                    <div className="text-sm opacity-60 truncate">
                      {tournament.city}
                    </div>
                  </div>

                  {/* Remove Button */}
                  <button
                    type="button"
                    onClick={() => removeMustGo(tournament.id)}
                    className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
                    aria-label={`Remove ${tournament.name} from must-go list`}
                  >
                    <svg
                      className="w-5 h-5 opacity-60"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="pt-4 flex gap-4 max-w-sm mx-auto">
        <button
          onClick={onBack}
          className="flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-full font-semibold transition-all duration-300 hover:bg-white/10"
          style={{
            background: 'rgba(255,255,255,0.05)',
            color: 'rgba(255,255,255,0.7)',
          }}
        >
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M11 17l-5-5m0 0l5-5m-5 5h12"
            />
          </svg>
          Back
        </button>
        <button
          onClick={onNext}
          className="flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-full font-semibold transition-all duration-300 hover:scale-[1.02]"
          style={{
            background: 'linear-gradient(135deg, #d4af37 0%, #c9a227 100%)',
            color: '#000',
          }}
        >
          {hasMustGos ? 'Generate Plan' : 'Skip & Generate'}
          <svg
            className="w-5 h-5"
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
        </button>
      </div>
    </div>
  );
}
