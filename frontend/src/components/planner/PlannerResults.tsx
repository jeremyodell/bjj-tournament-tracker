// frontend/src/components/planner/PlannerResults.tsx
'use client';

import { useState } from 'react';
import { usePlannerStore, type PlannedTournament } from '@/stores/plannerStore';
import { PlannedTournamentCard } from './PlannedTournamentCard';
import { TravelOverrideModal } from './TravelOverrideModal';

export function PlannerResults() {
  const { plan, config, isGenerating, setIsGenerating, updateTravelType } = usePlannerStore();
  const [selectedTournament, setSelectedTournament] = useState<PlannedTournament | null>(null);

  // Calculate budget usage
  const usedBudget = plan.reduce((sum, p) => sum + p.registrationCost + p.travelCost, 0);
  const availableBudget = config.totalBudget - config.reserveBudget;

  // Sort plan by date
  const sortedPlan = [...plan].sort((a, b) =>
    new Date(a.tournament.startDate).getTime() - new Date(b.tournament.startDate).getTime()
  );

  const handleRegenerate = () => {
    setIsGenerating(true);
    // Actual regeneration logic will be implemented in Task 4.3
    // For now, simulate a delay then reset
    setTimeout(() => {
      setIsGenerating(false);
    }, 1500);
  };

  const handleSavePlan = () => {
    // Save plan logic will be implemented later
  };

  return (
    <div className="flex flex-col h-full">
      {/* Results Content */}
      <div className="flex-1 overflow-y-auto pb-24 lg:pb-0">
        {isGenerating ? (
          // Loading State
          <div className="flex flex-col items-center justify-center h-full min-h-[400px]">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-[#d4af37]/20 rounded-full" />
              <div className="absolute top-0 left-0 w-16 h-16 border-4 border-[#d4af37] border-t-transparent rounded-full animate-spin" />
            </div>
            <p className="mt-6 text-lg font-medium opacity-60">Generating your season plan...</p>
            <p className="mt-2 text-sm opacity-40">Analyzing tournaments and travel costs</p>
          </div>
        ) : plan.length === 0 ? (
          // Empty State
          <div
            className="flex flex-col items-center justify-center h-full min-h-[400px] rounded-2xl border"
            style={{
              background: 'var(--glass-bg)',
              borderColor: 'var(--glass-border)',
            }}
          >
            <svg
              className="w-20 h-20 opacity-20"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <h3 className="mt-4 text-xl font-semibold opacity-60">No Season Plan Yet</h3>
            <p className="mt-2 text-sm opacity-40 text-center max-w-md px-4">
              Configure your budget, location, and preferences on the left, then click &quot;Generate Season Plan&quot; to see your personalized tournament schedule.
            </p>
          </div>
        ) : (
          // Results List
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">
                Your {new Date().getFullYear()} Season
                <span className="ml-2 text-sm font-normal opacity-60">
                  ({sortedPlan.length} tournaments)
                </span>
              </h2>
            </div>

            {sortedPlan.map((plannedTournament, index) => (
              <PlannedTournamentCard
                key={plannedTournament.tournament.id}
                plannedTournament={plannedTournament}
                index={index}
                onTravelTypeClick={setSelectedTournament}
              />
            ))}

            {/* Travel Override Modal */}
            {selectedTournament && (
              <TravelOverrideModal
                isOpen={!!selectedTournament}
                plannedTournament={selectedTournament}
                onClose={() => setSelectedTournament(null)}
                onSave={(travelType, travelCost) => {
                  updateTravelType(selectedTournament.tournament.id, travelType, travelCost);
                  setSelectedTournament(null);
                }}
              />
            )}
          </div>
        )}
      </div>

      {/* Sticky Footer - Desktop */}
      <div
        className="hidden lg:flex items-center justify-between mt-6 p-4 rounded-xl border"
        style={{
          background: 'var(--glass-bg)',
          borderColor: 'var(--glass-border)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
        }}
      >
        <div className="flex items-center gap-6 text-sm">
          <div>
            <span className="opacity-60">Budget:</span>{' '}
            <span
              className="font-semibold"
              style={{ color: usedBudget > availableBudget ? '#ef4444' : '#d4af37' }}
            >
              ${usedBudget.toLocaleString()}
            </span>
            <span className="opacity-40"> / ${availableBudget.toLocaleString()} used</span>
          </div>
          <div className="w-px h-4 bg-white/10" />
          <div>
            <span className="opacity-60">Reserved:</span>{' '}
            <span className="font-semibold">${config.reserveBudget.toLocaleString()}</span>
          </div>
          <div className="w-px h-4 bg-white/10" />
          <div>
            <span className="font-semibold" style={{ color: '#d4af37' }}>
              {plan.length}
            </span>{' '}
            <span className="opacity-60">tournaments</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRegenerate}
            disabled={isGenerating}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 hover:scale-105 disabled:opacity-50"
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--glass-border)',
            }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Regenerate
          </button>
          <button
            onClick={handleSavePlan}
            disabled={plan.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-300 hover:scale-105 disabled:opacity-50"
            style={{
              background: 'linear-gradient(135deg, #d4af37 0%, #c9a227 100%)',
              color: '#000',
            }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
            Save Plan
          </button>
        </div>
      </div>
    </div>
  );
}

// Mobile Footer Component
export function PlannerMobileFooter() {
  const { plan, config, isGenerating, setIsGenerating } = usePlannerStore();

  const usedBudget = plan.reduce((sum, p) => sum + p.registrationCost + p.travelCost, 0);
  const availableBudget = config.totalBudget - config.reserveBudget;

  const handleRegenerate = () => {
    setIsGenerating(true);
    // Actual regeneration logic will be implemented in Task 4.3
    // For now, simulate a delay then reset
    setTimeout(() => {
      setIsGenerating(false);
    }, 1500);
  };

  const handleSavePlan = () => {
    // Save plan logic will be implemented later
  };

  return (
    <div
      className="fixed bottom-0 left-0 right-0 lg:hidden z-40 p-4 border-t"
      style={{
        background: 'rgba(0, 0, 0, 0.9)',
        borderColor: 'var(--glass-border)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
      }}
    >
      {/* Budget Summary Row */}
      <div className="flex items-center justify-between mb-3 text-sm">
        <div className="flex items-center gap-4">
          <div>
            <span
              className="font-semibold"
              style={{ color: usedBudget > availableBudget ? '#ef4444' : '#d4af37' }}
            >
              ${usedBudget.toLocaleString()}
            </span>
            <span className="opacity-40"> / ${availableBudget.toLocaleString()}</span>
          </div>
          <div className="w-px h-4 bg-white/10" />
          <div>
            <span className="font-semibold" style={{ color: '#d4af37' }}>{plan.length}</span>
            <span className="opacity-60 ml-1">events</span>
          </div>
        </div>
        <div className="text-xs opacity-50">
          Reserved: ${config.reserveBudget.toLocaleString()}
        </div>
      </div>

      {/* Action Buttons Row */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleRegenerate}
          disabled={isGenerating}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid var(--glass-border)',
          }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Regenerate
        </button>
        <button
          onClick={handleSavePlan}
          disabled={plan.length === 0}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
          style={{
            background: 'linear-gradient(135deg, #d4af37 0%, #c9a227 100%)',
            color: '#000',
          }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
          </svg>
          Save Plan
        </button>
      </div>
    </div>
  );
}

// Mobile Config Sheet Trigger (shown on mobile when tapping the bottom bar)
export function PlannerMobileConfigSheet({
  athleteName,
  isOpen,
  onClose,
}: {
  athleteName: string;
  isOpen: boolean;
  onClose: () => void;
}) {
  const { config, updateConfig, removeMustGo, isGenerating, setIsGenerating } = usePlannerStore();
  const availableBudget = config.totalBudget - config.reserveBudget;

  const handleGenerate = () => {
    setIsGenerating(true);
    // Actual generation logic will be implemented in Task 4.3
    // For now, simulate a delay then reset
    setTimeout(() => {
      setIsGenerating(false);
    }, 1500);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-50 lg:hidden"
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="fixed inset-x-0 bottom-0 z-50 lg:hidden rounded-t-3xl overflow-hidden animate-slide-up"
        style={{
          background: 'rgba(20, 20, 20, 0.98)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          maxHeight: '85vh',
        }}
      >
        {/* Handle */}
        <div className="flex justify-center py-3">
          <div className="w-12 h-1.5 rounded-full bg-white/20" />
        </div>

        {/* Content */}
        <div className="px-6 pb-8 overflow-y-auto max-h-[calc(85vh-60px)]">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold">{athleteName}&apos;s Season Config</h2>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Budget Section */}
          <div className="space-y-4 mb-6">
            <h3 className="text-sm font-semibold tracking-wider opacity-60 uppercase">Budget</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs opacity-60 block mb-1">Total Budget</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm opacity-60">$</span>
                  <input
                    type="number"
                    value={config.totalBudget}
                    onChange={(e) => updateConfig({ totalBudget: parseInt(e.target.value) || 0 })}
                    className="w-full pl-7 pr-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs opacity-60 block mb-1">Reserve</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm opacity-60">$</span>
                  <input
                    type="number"
                    value={config.reserveBudget}
                    onChange={(e) => updateConfig({ reserveBudget: parseInt(e.target.value) || 0 })}
                    className="w-full pl-7 pr-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm"
                  />
                </div>
              </div>
            </div>
            <div
              className="flex items-center justify-between px-4 py-2 rounded-lg"
              style={{
                background: 'rgba(212, 175, 55, 0.1)',
                border: '1px solid rgba(212, 175, 55, 0.3)',
              }}
            >
              <span className="text-sm" style={{ color: '#d4af37' }}>Available</span>
              <span className="font-bold" style={{ color: '#d4af37' }}>${availableBudget.toLocaleString()}</span>
            </div>
          </div>

          {/* Location Section */}
          <div className="space-y-4 mb-6">
            <h3 className="text-sm font-semibold tracking-wider opacity-60 uppercase">Location</h3>
            <div>
              <label className="text-xs opacity-60 block mb-1">Home Airport</label>
              <input
                type="text"
                placeholder="e.g., DFW"
                value={config.homeAirport}
                onChange={(e) => updateConfig({ homeAirport: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm uppercase"
                maxLength={4}
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs opacity-60">Max Drive</label>
                <span className="text-sm font-medium">{config.maxDriveHours}h</span>
              </div>
              <input
                type="range"
                min={1}
                max={12}
                value={config.maxDriveHours}
                onChange={(e) => updateConfig({ maxDriveHours: parseInt(e.target.value) })}
                className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #d4af37 0%, #d4af37 ${((config.maxDriveHours - 1) / 11) * 100}%, rgba(255,255,255,0.1) ${((config.maxDriveHours - 1) / 11) * 100}%, rgba(255,255,255,0.1) 100%)`,
                }}
              />
            </div>
          </div>

          {/* Schedule Section */}
          <div className="space-y-4 mb-6">
            <h3 className="text-sm font-semibold tracking-wider opacity-60 uppercase">Schedule</h3>
            <div>
              <label className="text-xs opacity-60 block mb-1">Tournaments per month</label>
              <select
                value={config.tournamentsPerMonth}
                onChange={(e) => updateConfig({ tournamentsPerMonth: parseInt(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm"
              >
                <option value={1}>1 tournament</option>
                <option value={2}>2 tournaments</option>
                <option value={3}>3 tournaments</option>
              </select>
            </div>
          </div>

          {/* Must-Go Section */}
          {config.mustGoTournaments.length > 0 && (
            <div className="space-y-3 mb-6">
              <h3 className="text-sm font-semibold tracking-wider opacity-60 uppercase">Must-Go</h3>
              {config.mustGoTournaments.map((id) => (
                <div
                  key={id}
                  className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 border border-white/10"
                >
                  <span className="text-sm truncate">{id}</span>
                  <button onClick={() => removeMustGo(id)} className="text-red-400">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !config.homeAirport}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all disabled:opacity-50"
            style={{
              background: 'linear-gradient(135deg, #d4af37 0%, #c9a227 100%)',
              color: '#000',
            }}
          >
            {isGenerating ? (
              <>
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Generating...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Generate Plan
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );
}
