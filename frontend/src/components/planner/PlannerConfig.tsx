// frontend/src/components/planner/PlannerConfig.tsx
'use client';

import { useState } from 'react';
import { usePlannerStore } from '@/stores/plannerStore';
import { useTournaments } from '@/hooks/useTournaments';
import { generatePlan, getHomeLocationFromAirport } from '@/lib/planGenerator';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface PlannerConfigProps {
  athleteName: string;
}

export function PlannerConfig({ athleteName }: PlannerConfigProps) {
  const { config, updateConfig, removeMustGo, isGenerating, setIsGenerating, setPlan } = usePlannerStore();
  const {
    data: tournamentsData,
    isLoading: isTournamentsLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useTournaments();
  const [generationError, setGenerationError] = useState<string | null>(null);

  const availableBudget = config.totalBudget - config.reserveBudget;

  const handleGenerate = async () => {
    // Clear any previous error
    setGenerationError(null);

    const homeLocation = getHomeLocationFromAirport(config.homeAirport);
    if (!homeLocation) {
      setGenerationError('Invalid airport code. Please enter a valid 3-letter airport code.');
      return;
    }

    setIsGenerating(true);

    try {
      // Fetch all pages if there are more to load
      while (hasNextPage) {
        await fetchNextPage();
      }

      // Flatten all tournament pages into a single array
      const allTournaments = tournamentsData?.pages.flatMap(page => page.tournaments) ?? [];

      // Use setTimeout to allow UI to update before potentially heavy computation
      setTimeout(() => {
        try {
          const plan = generatePlan({
            config,
            allTournaments,
            homeLocation,
          });
          setPlan(plan);
        } finally {
          setIsGenerating(false);
        }
      }, 100);
    } catch {
      setGenerationError('Failed to load all tournaments. Please try again.');
      setIsGenerating(false);
    }
  };

  // Check if the airport code is valid
  const isAirportValid = config.homeAirport ? !!getHomeLocationFromAirport(config.homeAirport) : false;

  return (
    <div
      className="rounded-2xl border p-6 space-y-6"
      style={{
        background: 'var(--glass-bg)',
        borderColor: 'var(--glass-border)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
      }}
    >
      {/* Header */}
      <div className="border-b pb-4" style={{ borderColor: 'var(--glass-border)' }}>
        <h2 className="text-xl font-bold">
          {athleteName}&apos;s {new Date().getFullYear()} Season
        </h2>
      </div>

      {/* BUDGET Section */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold tracking-wider opacity-60 uppercase">Budget</h3>

        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-sm opacity-80 w-20">Total:</span>
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm opacity-60">$</span>
              <Input
                type="number"
                value={config.totalBudget}
                onChange={(e) => updateConfig({ totalBudget: parseInt(e.target.value) || 0 })}
                className="pl-7 bg-white/5 border-white/10"
                min={0}
              />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <span className="text-sm opacity-80 w-20">Reserve:</span>
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm opacity-60">$</span>
                <Input
                  type="number"
                  value={config.reserveBudget}
                  onChange={(e) => updateConfig({ reserveBudget: parseInt(e.target.value) || 0 })}
                  className="pl-7 bg-white/5 border-white/10"
                  min={0}
                  max={config.totalBudget}
                />
              </div>
            </div>
            <p className="text-xs opacity-50 ml-[92px]">
              For unannounced JJWL, etc.
            </p>
          </div>

          <div
            className="flex items-center justify-between px-4 py-2 rounded-lg"
            style={{
              background: 'rgba(212, 175, 55, 0.1)',
              border: '1px solid rgba(212, 175, 55, 0.3)',
            }}
          >
            <span className="text-sm font-medium" style={{ color: '#d4af37' }}>Available:</span>
            <span className="text-lg font-bold" style={{ color: '#d4af37' }}>
              ${availableBudget.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* LOCATION Section */}
      <div className="space-y-4 pt-4 border-t" style={{ borderColor: 'var(--glass-border)' }}>
        <h3 className="text-sm font-semibold tracking-wider opacity-60 uppercase">Location</h3>

        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-sm opacity-80 w-28">Home Airport:</span>
            <Input
              type="text"
              placeholder="e.g., DFW"
              value={config.homeAirport}
              onChange={(e) => updateConfig({ homeAirport: e.target.value.toUpperCase() })}
              className="flex-1 bg-white/5 border-white/10 uppercase"
              maxLength={4}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm opacity-80">Max Drive:</span>
              <span className="text-sm font-medium">{config.maxDriveHours} hours</span>
            </div>
            <input
              type="range"
              min={1}
              max={12}
              value={config.maxDriveHours}
              onChange={(e) => updateConfig({ maxDriveHours: parseInt(e.target.value) })}
              className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#d4af37]"
              style={{
                background: `linear-gradient(to right, #d4af37 0%, #d4af37 ${((config.maxDriveHours - 1) / 11) * 100}%, rgba(255,255,255,0.1) ${((config.maxDriveHours - 1) / 11) * 100}%, rgba(255,255,255,0.1) 100%)`,
              }}
            />
            <div className="flex justify-between text-xs opacity-40">
              <span>1h</span>
              <span>12h</span>
            </div>
          </div>
        </div>
      </div>

      {/* SCHEDULE BALANCE Section */}
      <div className="space-y-4 pt-4 border-t" style={{ borderColor: 'var(--glass-border)' }}>
        <h3 className="text-sm font-semibold tracking-wider opacity-60 uppercase">Schedule Balance</h3>

        <div className="space-y-4">
          <div className="space-y-2">
            <span className="text-sm opacity-80">Tournaments per month:</span>
            <Select
              value={String(config.tournamentsPerMonth)}
              onValueChange={(value) => updateConfig({ tournamentsPerMonth: parseInt(value) })}
            >
              <SelectTrigger className="w-full bg-white/5 border-white/10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 tournament</SelectItem>
                <SelectItem value="2">2 tournaments</SelectItem>
                <SelectItem value="3">3 tournaments</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <span className="text-sm opacity-80">Org preference:</span>
            <div className="space-y-2">
              <input
                type="range"
                min={0}
                max={2}
                value={config.orgPreference === 'ibjjf' ? 0 : config.orgPreference === 'balanced' ? 1 : 2}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  updateConfig({
                    orgPreference: val === 0 ? 'ibjjf' : val === 1 ? 'balanced' : 'jjwl',
                  });
                }}
                className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer"
                style={{
                  background: 'linear-gradient(to right, #00F0FF, rgba(255,255,255,0.2), #FF2D6A)',
                }}
              />
              <div className="flex justify-between text-xs">
                <span style={{ color: '#00F0FF' }}>IBJJF</span>
                <span className="opacity-60">(balanced)</span>
                <span style={{ color: '#FF2D6A' }}>JJWL</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MUST-GO TOURNAMENTS Section */}
      <div className="space-y-4 pt-4 border-t" style={{ borderColor: 'var(--glass-border)' }}>
        <h3 className="text-sm font-semibold tracking-wider opacity-60 uppercase">Must-Go Tournaments</h3>

        {config.mustGoTournaments.length === 0 ? (
          <p className="text-sm opacity-50 italic">No must-go tournaments selected</p>
        ) : (
          <div className="space-y-2">
            {config.mustGoTournaments.map((tournamentId) => (
              <div
                key={tournamentId}
                className="flex items-center justify-between px-3 py-2 rounded-lg"
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--glass-border)',
                }}
              >
                <span className="text-sm truncate">{tournamentId}</span>
                <button
                  onClick={() => removeMustGo(tournamentId)}
                  className="p-1 rounded hover:bg-white/10 transition-colors text-red-400"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          className="flex items-center gap-2 text-sm opacity-60 hover:opacity-100 transition-opacity"
          onClick={() => {
            // Will be connected to wishlist selection in future
          }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add from wishlist
        </button>
      </div>

      {/* Generate Button */}
      <div className="pt-4 border-t" style={{ borderColor: 'var(--glass-border)' }}>
        <button
          onClick={handleGenerate}
          disabled={isGenerating || isTournamentsLoading || isFetchingNextPage || !isAirportValid}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all duration-300 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          style={{
            background: 'linear-gradient(135deg, #d4af37 0%, #c9a227 100%)',
            color: '#000',
          }}
        >
          {isGenerating || isFetchingNextPage ? (
            <>
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              {isFetchingNextPage ? 'Loading all tournaments...' : 'Generating...'}
            </>
          ) : isTournamentsLoading ? (
            <>
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Loading Tournaments...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Generate Season Plan
            </>
          )}
        </button>
        {generationError && (
          <p className="text-xs text-center mt-2 text-red-400">
            {generationError}
          </p>
        )}
        {!generationError && !config.homeAirport && (
          <p className="text-xs text-center mt-2 opacity-50">
            Enter your home airport to generate a plan
          </p>
        )}
        {!generationError && config.homeAirport && !isAirportValid && (
          <p className="text-xs text-center mt-2 text-red-400">
            Airport code not recognized. Try common codes like DFW, LAX, JFK, etc.
          </p>
        )}
      </div>
    </div>
  );
}
