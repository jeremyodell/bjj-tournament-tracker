# Season Planner UX Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Unify "My Season" (wishlist) and "View Season Plan" (planner) into a single wizard-driven flow accessible from "My Plan" in the nav.

**Architecture:** Replace the flat wishlist concept with a wizard that guides users through budget → location → must-gos → generate plan. The existing `PlannerConfig` and `PlannerResults` components are kept mostly intact, but the entry flow changes from being buried in profile to being the primary nav destination. Per-athlete plan persistence allows returning users to see their plan directly.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Zustand (plannerStore), TanStack Query, Tailwind CSS, shadcn/ui components

---

## Task 1: Update plannerStore for Per-Athlete Persistence

**Files:**
- Modify: `frontend/src/stores/plannerStore.ts`

**Step 1: Write the failing test**

Create test file:

```typescript
// frontend/src/__tests__/stores/plannerStore.test.ts
import { usePlannerStore } from '@/stores/plannerStore';
import { beforeEach, describe, expect, it } from 'vitest';

describe('plannerStore', () => {
  beforeEach(() => {
    usePlannerStore.getState().reset();
    localStorage.clear();
  });

  describe('per-athlete state', () => {
    it('stores hasCompletedWizard per athlete', () => {
      const store = usePlannerStore.getState();

      store.setAthleteId('athlete-1');
      store.markWizardComplete();

      expect(store.hasCompletedWizard).toBe(true);

      // Switch to different athlete
      store.setAthleteId('athlete-2');
      expect(store.hasCompletedWizard).toBe(false);

      // Switch back - should remember
      store.setAthleteId('athlete-1');
      expect(store.hasCompletedWizard).toBe(true);
    });

    it('persists plan per athlete', () => {
      const store = usePlannerStore.getState();
      const mockPlan = [{
        tournament: { id: 'tourn-1', name: 'Test', org: 'IBJJF' } as any,
        registrationCost: 100,
        travelCost: 200,
        travelType: 'drive' as const,
        isLocked: false,
      }];

      store.setAthleteId('athlete-1');
      store.setPlan(mockPlan);

      // Switch athletes
      store.setAthleteId('athlete-2');
      expect(store.plan).toEqual([]);

      // Switch back - plan should be restored
      store.setAthleteId('athlete-1');
      expect(store.plan).toEqual(mockPlan);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- --run plannerStore.test.ts`
Expected: FAIL - `markWizardComplete` and `hasCompletedWizard` not defined

**Step 3: Write minimal implementation**

Update `frontend/src/stores/plannerStore.ts`:

```typescript
// frontend/src/stores/plannerStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Tournament } from '@/lib/types';

export interface PlannerConfig {
  totalBudget: number;
  reserveBudget: number;
  homeAirport: string;
  maxDriveHours: number;
  tournamentsPerMonth: number;
  orgPreference: 'balanced' | 'ibjjf' | 'jjwl';
  mustGoTournaments: string[]; // tournament IDs
}

export interface PlannedTournament {
  tournament: Tournament;
  registrationCost: number;
  travelCost: number;
  travelType: 'drive' | 'fly';
  isLocked: boolean;
}

interface AthleteState {
  config: PlannerConfig;
  plan: PlannedTournament[];
  hasCompletedWizard: boolean;
}

interface PlannerState {
  athleteId: string | null;
  config: PlannerConfig;
  plan: PlannedTournament[];
  hasCompletedWizard: boolean;
  isGenerating: boolean;

  // Per-athlete state cache
  athleteStates: Record<string, AthleteState>;

  // Actions
  setAthleteId: (athleteId: string) => void;
  updateConfig: (updates: Partial<PlannerConfig>) => void;
  addMustGo: (tournamentId: string) => void;
  removeMustGo: (tournamentId: string) => void;
  setPlan: (plan: PlannedTournament[]) => void;
  lockTournament: (tournamentId: string) => void;
  removeTournament: (tournamentId: string) => void;
  setIsGenerating: (isGenerating: boolean) => void;
  markWizardComplete: () => void;
  reset: () => void;
}

const defaultConfig: PlannerConfig = {
  totalBudget: 3000,
  reserveBudget: 500,
  homeAirport: '',
  maxDriveHours: 4,
  tournamentsPerMonth: 1,
  orgPreference: 'balanced',
  mustGoTournaments: [],
};

const defaultAthleteState: AthleteState = {
  config: defaultConfig,
  plan: [],
  hasCompletedWizard: false,
};

export const usePlannerStore = create<PlannerState>()(
  persist(
    (set, get) => ({
      athleteId: null,
      config: defaultConfig,
      plan: [],
      hasCompletedWizard: false,
      isGenerating: false,
      athleteStates: {},

      setAthleteId: (athleteId) => {
        const currentState = get();
        const currentAthleteId = currentState.athleteId;

        // Save current athlete's state before switching
        if (currentAthleteId) {
          set((state) => ({
            athleteStates: {
              ...state.athleteStates,
              [currentAthleteId]: {
                config: state.config,
                plan: state.plan,
                hasCompletedWizard: state.hasCompletedWizard,
              },
            },
          }));
        }

        // Load new athlete's state (or defaults)
        const savedState = currentState.athleteStates[athleteId] || defaultAthleteState;

        set({
          athleteId,
          config: savedState.config,
          plan: savedState.plan,
          hasCompletedWizard: savedState.hasCompletedWizard,
        });
      },

      updateConfig: (updates) => set((state) => ({
        config: { ...state.config, ...updates },
      })),

      addMustGo: (tournamentId) => set((state) => ({
        config: {
          ...state.config,
          mustGoTournaments: state.config.mustGoTournaments.includes(tournamentId)
            ? state.config.mustGoTournaments
            : [...state.config.mustGoTournaments, tournamentId],
        },
      })),

      removeMustGo: (tournamentId) => set((state) => ({
        config: {
          ...state.config,
          mustGoTournaments: state.config.mustGoTournaments.filter(id => id !== tournamentId),
        },
      })),

      setPlan: (plan) => set({ plan }),

      lockTournament: (tournamentId) => set((state) => ({
        plan: state.plan.map(p =>
          p.tournament.id === tournamentId ? { ...p, isLocked: true } : p
        ),
        config: {
          ...state.config,
          mustGoTournaments: state.config.mustGoTournaments.includes(tournamentId)
            ? state.config.mustGoTournaments
            : [...state.config.mustGoTournaments, tournamentId],
        },
      })),

      removeTournament: (tournamentId) => set((state) => ({
        plan: state.plan.filter(p => p.tournament.id !== tournamentId),
      })),

      setIsGenerating: (isGenerating) => set({ isGenerating }),

      markWizardComplete: () => set({ hasCompletedWizard: true }),

      reset: () => set({
        config: defaultConfig,
        plan: [],
        athleteId: null,
        hasCompletedWizard: false,
        isGenerating: false,
      }),
    }),
    {
      name: 'planner-storage',
      partialize: (state) => ({
        athleteStates: state.athleteStates,
        athleteId: state.athleteId,
        config: state.config,
        plan: state.plan,
        hasCompletedWizard: state.hasCompletedWizard,
      }),
    }
  )
);
```

**Step 4: Run test to verify it passes**

Run: `cd frontend && npm test -- --run plannerStore.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/stores/plannerStore.ts frontend/src/__tests__/stores/plannerStore.test.ts
git commit -m "feat(planner): add per-athlete state persistence and wizard completion flag"
```

---

## Task 2: Create BudgetStep Component

**Files:**
- Create: `frontend/src/components/planner/wizard/BudgetStep.tsx`

**Step 1: Create the component**

```typescript
// frontend/src/components/planner/wizard/BudgetStep.tsx
'use client';

import { usePlannerStore } from '@/stores/plannerStore';
import { Input } from '@/components/ui/input';

interface BudgetStepProps {
  onNext: () => void;
}

export function BudgetStep({ onNext }: BudgetStepProps) {
  const { config, updateConfig } = usePlannerStore();
  const availableBudget = config.totalBudget - config.reserveBudget;

  const isValid = config.totalBudget > 0 && config.reserveBudget >= 0 && availableBudget > 0;

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">What&apos;s your tournament budget?</h2>
        <p className="text-sm opacity-60">This helps us find tournaments that fit your spending plan</p>
      </div>

      <div className="space-y-6 max-w-sm mx-auto">
        {/* Total Budget */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Total Budget for the Year</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg opacity-60">$</span>
            <Input
              type="number"
              value={config.totalBudget}
              onChange={(e) => updateConfig({ totalBudget: parseInt(e.target.value) || 0 })}
              className="pl-8 text-2xl h-14 bg-white/5 border-white/10"
              min={0}
            />
          </div>
        </div>

        {/* Reserve Budget */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Reserve for Unannounced Events</label>
          <p className="text-xs opacity-50">Set aside for surprise tournaments (JJWL often announces late)</p>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg opacity-60">$</span>
            <Input
              type="number"
              value={config.reserveBudget}
              onChange={(e) => updateConfig({ reserveBudget: parseInt(e.target.value) || 0 })}
              className="pl-8 text-xl h-12 bg-white/5 border-white/10"
              min={0}
              max={config.totalBudget}
            />
          </div>
        </div>

        {/* Available Budget Display */}
        <div
          className="flex items-center justify-between px-4 py-3 rounded-lg"
          style={{
            background: 'rgba(212, 175, 55, 0.1)',
            border: '1px solid rgba(212, 175, 55, 0.3)',
          }}
        >
          <span className="font-medium" style={{ color: '#d4af37' }}>Available for planning:</span>
          <span className="text-2xl font-bold" style={{ color: '#d4af37' }}>
            ${availableBudget.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Continue Button */}
      <div className="pt-4">
        <button
          onClick={onNext}
          disabled={!isValid}
          className="w-full max-w-sm mx-auto flex items-center justify-center gap-2 px-6 py-4 rounded-full font-semibold transition-all duration-300 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          style={{
            background: isValid
              ? 'linear-gradient(135deg, #d4af37 0%, #c9a227 100%)'
              : 'rgba(255,255,255,0.1)',
            color: isValid ? '#000' : 'rgba(255,255,255,0.5)',
          }}
        >
          Continue
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/planner/wizard/BudgetStep.tsx
git commit -m "feat(wizard): add BudgetStep component"
```

---

## Task 3: Create LocationStep Component

**Files:**
- Create: `frontend/src/components/planner/wizard/LocationStep.tsx`

**Step 1: Create the component**

```typescript
// frontend/src/components/planner/wizard/LocationStep.tsx
'use client';

import { usePlannerStore } from '@/stores/plannerStore';
import { getHomeLocationFromAirport } from '@/lib/planGenerator';
import { Input } from '@/components/ui/input';

interface LocationStepProps {
  onNext: () => void;
  onBack: () => void;
}

export function LocationStep({ onNext, onBack }: LocationStepProps) {
  const { config, updateConfig } = usePlannerStore();

  const isAirportValid = config.homeAirport ? !!getHomeLocationFromAirport(config.homeAirport) : false;
  const isValid = isAirportValid;

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Where are you traveling from?</h2>
        <p className="text-sm opacity-60">We&apos;ll calculate travel costs from your home airport</p>
      </div>

      <div className="space-y-6 max-w-sm mx-auto">
        {/* Home Airport */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Home Airport Code</label>
          <Input
            type="text"
            placeholder="e.g., DFW, LAX, JFK"
            value={config.homeAirport}
            onChange={(e) => updateConfig({ homeAirport: e.target.value.toUpperCase() })}
            className="text-2xl h-14 bg-white/5 border-white/10 uppercase text-center tracking-widest"
            maxLength={4}
          />
          {config.homeAirport && !isAirportValid && (
            <p className="text-xs text-red-400 text-center">
              Airport code not recognized. Try common codes like DFW, LAX, JFK, etc.
            </p>
          )}
          {isAirportValid && (
            <p className="text-xs text-green-400 text-center">
              Valid airport code
            </p>
          )}
        </div>

        {/* Max Drive Hours */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Maximum driving distance</label>
            <span className="text-lg font-semibold" style={{ color: '#d4af37' }}>
              {config.maxDriveHours} hours
            </span>
          </div>
          <p className="text-xs opacity-50">
            Tournaments within this distance will be marked as &quot;drive&quot; with lower travel costs
          </p>
          <input
            type="range"
            min={1}
            max={12}
            value={config.maxDriveHours}
            onChange={(e) => updateConfig({ maxDriveHours: parseInt(e.target.value) })}
            className="w-full h-3 bg-white/10 rounded-lg appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, #d4af37 0%, #d4af37 ${((config.maxDriveHours - 1) / 11) * 100}%, rgba(255,255,255,0.1) ${((config.maxDriveHours - 1) / 11) * 100}%, rgba(255,255,255,0.1) 100%)`,
            }}
          />
          <div className="flex justify-between text-xs opacity-40">
            <span>1 hour</span>
            <span>12 hours</span>
          </div>
        </div>
      </div>

      {/* Navigation Buttons */}
      <div className="flex gap-3 max-w-sm mx-auto pt-4">
        <button
          onClick={onBack}
          className="flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-full font-medium transition-all duration-300 hover:bg-white/10"
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid var(--glass-border)',
          }}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 17l-5-5m0 0l5-5m-5 5h12" />
          </svg>
          Back
        </button>
        <button
          onClick={onNext}
          disabled={!isValid}
          className="flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-full font-semibold transition-all duration-300 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          style={{
            background: isValid
              ? 'linear-gradient(135deg, #d4af37 0%, #c9a227 100%)'
              : 'rgba(255,255,255,0.1)',
            color: isValid ? '#000' : 'rgba(255,255,255,0.5)',
          }}
        >
          Continue
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/planner/wizard/LocationStep.tsx
git commit -m "feat(wizard): add LocationStep component"
```

---

## Task 4: Create MustGoStep Component

**Files:**
- Create: `frontend/src/components/planner/wizard/MustGoStep.tsx`

**Step 1: Create the component**

```typescript
// frontend/src/components/planner/wizard/MustGoStep.tsx
'use client';

import { useState } from 'react';
import { usePlannerStore } from '@/stores/plannerStore';
import { useTournaments } from '@/hooks/useTournaments';
import { Input } from '@/components/ui/input';

interface MustGoStepProps {
  onNext: () => void;
  onBack: () => void;
}

export function MustGoStep({ onNext, onBack }: MustGoStepProps) {
  const { config, addMustGo, removeMustGo } = usePlannerStore();
  const { data: tournamentsData, isLoading } = useTournaments();
  const [searchQuery, setSearchQuery] = useState('');

  const allTournaments = tournamentsData?.pages.flatMap(page => page.tournaments) ?? [];

  // Filter by search query
  const filteredTournaments = searchQuery
    ? allTournaments.filter(t =>
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.city.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 10)
    : [];

  // Get selected tournament details
  const selectedTournaments = allTournaments.filter(t =>
    config.mustGoTournaments.includes(t.id)
  );

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Any must-go tournaments?</h2>
        <p className="text-sm opacity-60">
          Pin anchor events like Worlds or Pan - we&apos;ll build the rest of your season around them
        </p>
      </div>

      <div className="space-y-6 max-w-md mx-auto">
        {/* Search Input */}
        <div className="relative">
          <svg
            className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 opacity-40"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <Input
            type="text"
            placeholder="Search tournaments..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-12 h-12 bg-white/5 border-white/10"
          />
        </div>

        {/* Search Results */}
        {searchQuery && (
          <div
            className="rounded-lg border overflow-hidden max-h-64 overflow-y-auto"
            style={{
              background: 'var(--glass-bg)',
              borderColor: 'var(--glass-border)',
            }}
          >
            {isLoading ? (
              <div className="p-4 text-center text-sm opacity-60">Loading...</div>
            ) : filteredTournaments.length === 0 ? (
              <div className="p-4 text-center text-sm opacity-60">No tournaments found</div>
            ) : (
              filteredTournaments.map((tournament) => {
                const isSelected = config.mustGoTournaments.includes(tournament.id);
                const startDate = new Date(tournament.startDate);
                const formattedDate = startDate.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                });
                const isIBJJF = tournament.org === 'IBJJF';
                const accentColor = isIBJJF ? '#00F0FF' : '#FF2D6A';

                return (
                  <button
                    key={tournament.id}
                    onClick={() => {
                      if (isSelected) {
                        removeMustGo(tournament.id);
                      } else {
                        addMustGo(tournament.id);
                      }
                    }}
                    className={`w-full p-3 flex items-center justify-between text-left hover:bg-white/5 transition-colors border-b last:border-b-0 ${
                      isSelected ? 'bg-[#d4af37]/10' : ''
                    }`}
                    style={{ borderColor: 'var(--glass-border)' }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span
                          className="px-1.5 py-0.5 rounded text-xs font-bold"
                          style={{ background: `${accentColor}20`, color: accentColor }}
                        >
                          {tournament.org}
                        </span>
                        <span className="text-xs opacity-60">{formattedDate}</span>
                      </div>
                      <p className="text-sm font-medium truncate">{tournament.name}</p>
                      <p className="text-xs opacity-50 truncate">{tournament.city}</p>
                    </div>
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                      isSelected
                        ? 'bg-[#d4af37] border-[#d4af37]'
                        : 'border-white/30'
                    }`}>
                      {isSelected && (
                        <svg className="w-4 h-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        )}

        {/* Selected Must-Gos */}
        {selectedTournaments.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium opacity-60">Must-Go Events ({selectedTournaments.length})</h3>
            <div className="space-y-2">
              {selectedTournaments.map((tournament) => {
                const isIBJJF = tournament.org === 'IBJJF';
                const accentColor = isIBJJF ? '#00F0FF' : '#FF2D6A';
                const startDate = new Date(tournament.startDate);
                const formattedDate = startDate.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                });

                return (
                  <div
                    key={tournament.id}
                    className="flex items-center justify-between p-3 rounded-lg"
                    style={{
                      background: 'rgba(212, 175, 55, 0.1)',
                      border: '1px solid rgba(212, 175, 55, 0.3)',
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span
                          className="px-1.5 py-0.5 rounded text-xs font-bold"
                          style={{ background: `${accentColor}20`, color: accentColor }}
                        >
                          {tournament.org}
                        </span>
                        <span className="text-xs opacity-60">{formattedDate}</span>
                      </div>
                      <p className="text-sm font-medium truncate">{tournament.name}</p>
                    </div>
                    <button
                      onClick={() => removeMustGo(tournament.id)}
                      className="p-1 rounded hover:bg-white/10 transition-colors text-red-400"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex gap-3 max-w-sm mx-auto pt-4">
        <button
          onClick={onBack}
          className="flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-full font-medium transition-all duration-300 hover:bg-white/10"
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid var(--glass-border)',
          }}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 17l-5-5m0 0l5-5m-5 5h12" />
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
          {config.mustGoTournaments.length === 0 ? 'Skip & Generate' : 'Generate Plan'}
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/planner/wizard/MustGoStep.tsx
git commit -m "feat(wizard): add MustGoStep component with tournament search"
```

---

## Task 5: Create PlannerWizard Orchestrator

**Files:**
- Create: `frontend/src/components/planner/wizard/PlannerWizard.tsx`
- Create: `frontend/src/components/planner/wizard/index.ts`

**Step 1: Create the wizard component**

```typescript
// frontend/src/components/planner/wizard/PlannerWizard.tsx
'use client';

import { useState } from 'react';
import { usePlannerStore } from '@/stores/plannerStore';
import { useTournaments } from '@/hooks/useTournaments';
import { generatePlan, getHomeLocationFromAirport } from '@/lib/planGenerator';
import { BudgetStep } from './BudgetStep';
import { LocationStep } from './LocationStep';
import { MustGoStep } from './MustGoStep';

interface PlannerWizardProps {
  athleteName: string;
  onComplete: () => void;
}

type WizardStep = 'budget' | 'location' | 'must-go';

export function PlannerWizard({ athleteName, onComplete }: PlannerWizardProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>('budget');
  const { config, setPlan, markWizardComplete, setIsGenerating } = usePlannerStore();
  const { data: tournamentsData, hasNextPage, fetchNextPage, isFetchingNextPage } = useTournaments();

  const steps: WizardStep[] = ['budget', 'location', 'must-go'];
  const currentStepIndex = steps.indexOf(currentStep);

  const handleGenerate = async () => {
    const homeLocation = getHomeLocationFromAirport(config.homeAirport);
    if (!homeLocation) return;

    setIsGenerating(true);

    try {
      // Fetch all pages if there are more to load
      while (hasNextPage) {
        await fetchNextPage();
      }

      const allTournaments = tournamentsData?.pages.flatMap(page => page.tournaments) ?? [];

      // Use setTimeout to allow UI to update
      setTimeout(() => {
        try {
          const plan = generatePlan({
            config,
            allTournaments,
            homeLocation,
          });
          setPlan(plan);
          markWizardComplete();
          onComplete();
        } finally {
          setIsGenerating(false);
        }
      }, 100);
    } catch {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-[60vh] flex flex-col">
      {/* Progress Indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-center gap-2 mb-4">
          {steps.map((step, index) => (
            <div key={step} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  index <= currentStepIndex
                    ? 'bg-[#d4af37] text-black'
                    : 'bg-white/10 text-white/40'
                }`}
              >
                {index < currentStepIndex ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  index + 1
                )}
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`w-12 h-0.5 mx-1 transition-colors ${
                    index < currentStepIndex ? 'bg-[#d4af37]' : 'bg-white/10'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
        <p className="text-center text-sm opacity-60">
          Setting up {athleteName}&apos;s {new Date().getFullYear()} season
        </p>
      </div>

      {/* Step Content */}
      <div className="flex-1">
        {currentStep === 'budget' && (
          <BudgetStep onNext={() => setCurrentStep('location')} />
        )}
        {currentStep === 'location' && (
          <LocationStep
            onNext={() => setCurrentStep('must-go')}
            onBack={() => setCurrentStep('budget')}
          />
        )}
        {currentStep === 'must-go' && (
          <MustGoStep
            onNext={handleGenerate}
            onBack={() => setCurrentStep('location')}
          />
        )}
      </div>

      {/* Loading Overlay */}
      {isFetchingNextPage && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="text-center">
            <div className="relative mb-4">
              <div className="w-16 h-16 border-4 border-[#d4af37]/20 rounded-full" />
              <div className="absolute top-0 left-0 w-16 h-16 border-4 border-[#d4af37] border-t-transparent rounded-full animate-spin" />
            </div>
            <p className="text-lg font-medium">Generating your season plan...</p>
            <p className="text-sm opacity-60">Analyzing tournaments and travel costs</p>
          </div>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Create index file**

```typescript
// frontend/src/components/planner/wizard/index.ts
export { PlannerWizard } from './PlannerWizard';
export { BudgetStep } from './BudgetStep';
export { LocationStep } from './LocationStep';
export { MustGoStep } from './MustGoStep';
```

**Step 3: Commit**

```bash
git add frontend/src/components/planner/wizard/
git commit -m "feat(wizard): add PlannerWizard orchestrator component"
```

---

## Task 6: Create New Plan Page with Wizard/Plan View Logic

**Files:**
- Create: `frontend/src/app/plan/[athleteId]/page.tsx`

**Step 1: Create the athlete plan page**

```typescript
// frontend/src/app/plan/[athleteId]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAthletes } from '@/hooks/useAthletes';
import { usePlannerStore } from '@/stores/plannerStore';
import { PlannerWizard } from '@/components/planner/wizard';
import { PlannerConfig } from '@/components/planner/PlannerConfig';
import { PlannerResults, PlannerMobileFooter, PlannerMobileConfigSheet } from '@/components/planner/PlannerResults';

export default function AthletePlanPage() {
  const params = useParams();
  const athleteId = params.athleteId as string;

  const { data: athletesData, isLoading } = useAthletes();
  const { setAthleteId, hasCompletedWizard, plan } = usePlannerStore();

  const [isMobileConfigOpen, setIsMobileConfigOpen] = useState(false);
  const [showWizard, setShowWizard] = useState(true);

  // Find the athlete
  const athlete = athletesData?.athletes.find((a) => a.athleteId === athleteId);

  // Set athlete ID in store and determine view mode
  useEffect(() => {
    if (athleteId) {
      setAthleteId(athleteId);
    }
  }, [athleteId, setAthleteId]);

  // Determine if we should show wizard or plan view
  useEffect(() => {
    // Show plan view if wizard completed and has a plan
    if (hasCompletedWizard && plan.length > 0) {
      setShowWizard(false);
    } else {
      setShowWizard(true);
    }
  }, [hasCompletedWizard, plan.length]);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#d4af37] border-t-transparent" />
        </div>
      </div>
    );
  }

  if (!athlete) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <div
            className="p-8 rounded-xl border text-center max-w-md"
            style={{
              background: 'var(--glass-bg)',
              borderColor: 'var(--glass-border)',
            }}
          >
            <svg className="w-16 h-16 mx-auto mb-4 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <h2 className="text-xl font-semibold mb-2">Athlete Not Found</h2>
            <p className="text-sm opacity-60 mb-6">
              The athlete you&apos;re looking for doesn&apos;t exist or you don&apos;t have access to it.
            </p>
            <Link
              href="/profile"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all hover:scale-105"
              style={{
                background: 'linear-gradient(135deg, #d4af37 0%, #c9a227 100%)',
                color: '#000',
              }}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Profile
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Show Wizard for first-time setup
  if (showWizard) {
    return (
      <div className="container mx-auto px-4 py-8">
        <PlannerWizard
          athleteName={athlete.name}
          onComplete={() => setShowWizard(false)}
        />
      </div>
    );
  }

  // Show Plan View for returning users
  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center gap-4 mb-6">
          <Link
            href="/plan"
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{athlete.name}&apos;s {new Date().getFullYear()} Plan</h1>
            <p className="text-sm opacity-60">
              {athlete.beltRank && <span className="capitalize">{athlete.beltRank} Belt</span>}
              {athlete.weightClass && <span> - {athlete.weightClass}</span>}
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 pb-8">
        {/* Desktop: Split Screen Layout */}
        <div className="hidden lg:grid lg:grid-cols-[2fr_3fr] gap-6">
          {/* Left Panel - Config */}
          <div className="sticky top-24 h-fit">
            <PlannerConfig athleteName={athlete.name} />
          </div>

          {/* Right Panel - Results */}
          <div>
            <PlannerResults />
          </div>
        </div>

        {/* Mobile: Full Screen Results with Config Sheet */}
        <div className="lg:hidden">
          <PlannerResults />

          {/* Mobile Config Button */}
          <button
            onClick={() => setIsMobileConfigOpen(true)}
            className="fixed bottom-20 right-4 z-30 p-4 rounded-full shadow-lg transition-all duration-300 hover:scale-110"
            style={{
              background: 'linear-gradient(135deg, #d4af37 0%, #c9a227 100%)',
            }}
          >
            <svg className="w-6 h-6 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
          </button>

          {/* Mobile Footer */}
          <PlannerMobileFooter />

          {/* Mobile Config Sheet */}
          <PlannerMobileConfigSheet
            athleteName={athlete.name}
            isOpen={isMobileConfigOpen}
            onClose={() => setIsMobileConfigOpen(false)}
          />
        </div>
      </div>

      {/* CSS for animations */}
      <style jsx global>{`
        @keyframes slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/app/plan/[athleteId]/page.tsx
git commit -m "feat(plan): add athlete plan page with wizard/plan view toggle"
```

---

## Task 7: Update Plan Entry Page Routing

**Files:**
- Modify: `frontend/src/app/plan/page.tsx`

**Step 1: Update the routing logic**

Replace the content of `frontend/src/app/plan/page.tsx`:

```typescript
// frontend/src/app/plan/page.tsx
'use client';

import { Suspense, useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { QuickSetupForm } from '@/components/setup/QuickSetupForm';
import { useAuthStore } from '@/stores/authStore';
import { useSetupStore } from '@/stores/setupStore';
import { fetchAthletes, createAthlete } from '@/lib/api';

function PlanSetupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading: authLoading, getAccessToken } = useAuthStore();
  const loadFromAthlete = useSetupStore((state) => state.loadFromAthlete);

  const [isCheckingAthletes, setIsCheckingAthletes] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [isCreatingAthlete, setIsCreatingAthlete] = useState(false);
  const hasChecked = useRef(false);

  const forceNew = searchParams.get('new') === 'true';

  useEffect(() => {
    if (hasChecked.current) return;

    async function checkAthletes() {
      // Not authenticated - show form immediately
      if (!isAuthenticated) {
        setShowForm(true);
        setIsCheckingAthletes(false);
        return;
      }

      // Force new athlete creation
      if (forceNew) {
        setShowForm(true);
        setIsCheckingAthletes(false);
        return;
      }

      try {
        const token = await getAccessToken();
        if (!token) {
          setShowForm(true);
          setIsCheckingAthletes(false);
          return;
        }

        const data = await fetchAthletes(token);
        const athletes = data.athletes;

        if (athletes.length === 0) {
          // No athletes - show setup form
          setShowForm(true);
        } else if (athletes.length === 1) {
          // Single athlete - go directly to their plan page
          router.replace(`/plan/${athletes[0].athleteId}`);
          return;
        } else {
          // Multiple athletes - go to select page
          router.replace('/plan/select');
          return;
        }
      } catch {
        setShowForm(true);
      }

      setIsCheckingAthletes(false);
    }

    if (!authLoading) {
      hasChecked.current = true;
      checkAthletes();
    }
  }, [isAuthenticated, authLoading, forceNew, getAccessToken, loadFromAthlete, router]);

  const handleComplete = async () => {
    if (isAuthenticated) {
      setIsCreatingAthlete(true);
      try {
        const token = await getAccessToken();
        if (token) {
          const { athleteName, age, belt, weight } = useSetupStore.getState();
          const currentYear = new Date().getFullYear();
          const birthYear = age ? currentYear - age : undefined;

          const newAthlete = await createAthlete(token, {
            name: athleteName,
            beltRank: belt || undefined,
            birthYear,
            weight: weight ? parseInt(weight) : undefined,
          });

          loadFromAthlete(newAthlete);
          // Navigate to the new athlete's plan page
          router.push(`/plan/${newAthlete.athleteId}`);
          return;
        }
      } catch (error) {
        console.error('Failed to create athlete:', error);
      }
      setIsCreatingAthlete(false);
    }

    // For unauthenticated users, go to tournaments browse
    router.push('/tournaments');
  };

  if (authLoading || isCheckingAthletes) {
    return (
      <main className="container mx-auto px-4 py-16">
        <div className="max-w-lg mx-auto pt-16 text-center">
          <p className="opacity-60">Loading...</p>
        </div>
      </main>
    );
  }

  if (!showForm) {
    return null;
  }

  return (
    <main className="container mx-auto px-4 py-16">
      <div className="max-w-lg mx-auto pt-16">
        <p className="text-center text-sm opacity-60 mb-12">
          {isAuthenticated ? 'Create a new athlete profile' : 'No account required'}
        </p>
        <QuickSetupForm onComplete={handleComplete} />
        {isCreatingAthlete && (
          <p className="text-center text-sm opacity-60 mt-4">Saving...</p>
        )}
      </div>
    </main>
  );
}

export default function PlanSetupPage() {
  return (
    <Suspense
      fallback={
        <main className="container mx-auto px-4 py-16">
          <div className="max-w-lg mx-auto pt-16 text-center">
            <p className="opacity-60">Loading...</p>
          </div>
        </main>
      }
    >
      <PlanSetupContent />
    </Suspense>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/app/plan/page.tsx
git commit -m "refactor(plan): update routing to navigate to athlete plan pages"
```

---

## Task 8: Update Select Page Routing

**Files:**
- Modify: `frontend/src/app/plan/select/page.tsx`

**Step 1: Update the handleSelectAthlete function**

Replace line 41-43 in `frontend/src/app/plan/select/page.tsx`:

```typescript
  const handleSelectAthlete = (athlete: Athlete) => {
    loadFromAthlete(athlete);
    router.push(`/plan/${athlete.athleteId}`);
  };
```

**Step 2: Commit**

```bash
git add frontend/src/app/plan/select/page.tsx
git commit -m "refactor(plan/select): navigate to athlete plan page instead of wishlist"
```

---

## Task 9: Update AppHeader Navigation Label

**Files:**
- Modify: `frontend/src/components/layout/AppHeader.tsx`

**Step 1: Change "My Season" to "My Plan"**

Replace line 24 in `frontend/src/components/layout/AppHeader.tsx`:

```typescript
    { href: '/plan', label: 'My Plan' },
```

**Step 2: Commit**

```bash
git add frontend/src/components/layout/AppHeader.tsx
git commit -m "refactor(nav): rename 'My Season' to 'My Plan'"
```

---

## Task 10: Remove "View Season Plan" Button from AthleteCard

**Files:**
- Modify: `frontend/src/components/profile/AthleteCard.tsx`

**Step 1: Remove the View Season Plan link**

Remove lines 68-79 (the Link to /planner/[athleteId]) from `frontend/src/components/profile/AthleteCard.tsx`:

```typescript
// Remove this block:
        {/* View Season Plan button */}
        <Link
          href={`/planner/${athlete.athleteId}`}
          className="px-5 py-2.5 rounded-full text-sm font-semibold transition-all duration-300 hover:scale-105"
          style={{
            background: 'linear-gradient(135deg, #d4af37 0%, #c9a227 50%, #b8962a 100%)',
            color: '#000',
            boxShadow: '0 0 20px rgba(212, 175, 55, 0.2), 0 0 40px rgba(212, 175, 55, 0.1)',
          }}
        >
          View Season Plan
        </Link>
```

Also remove the `Link` import from 'next/link' if it's no longer used.

**Step 2: Commit**

```bash
git add frontend/src/components/profile/AthleteCard.tsx
git commit -m "refactor(profile): remove View Season Plan button from AthleteCard"
```

---

## Task 11: Delete Old Planner Route

**Files:**
- Delete: `frontend/src/app/(protected)/planner/[athleteId]/page.tsx`

**Step 1: Delete the file**

```bash
rm frontend/src/app/\(protected\)/planner/\[athleteId\]/page.tsx
rmdir frontend/src/app/\(protected\)/planner/\[athleteId\]/
rmdir frontend/src/app/\(protected\)/planner/
```

**Step 2: Commit**

```bash
git add -A
git commit -m "chore: remove old /planner/[athleteId] route"
```

---

## Task 12: Delete Wishlist Page and Components

**Files:**
- Delete: `frontend/src/app/(protected)/wishlist/page.tsx`
- Delete: `frontend/src/components/wishlist/WishlistCard.tsx`
- Delete: `frontend/src/components/wishlist/` (directory)

**Step 1: Delete the files**

```bash
rm frontend/src/app/\(protected\)/wishlist/page.tsx
rmdir frontend/src/app/\(protected\)/wishlist/
rm -rf frontend/src/components/wishlist/
```

**Step 2: Commit**

```bash
git add -A
git commit -m "chore: remove wishlist page and components"
```

---

## Task 13: Update Plan Verify Page (Optional Removal)

The `/plan/verify` page is currently for confirming athlete info after anonymous setup. We can keep it for now but update routing or remove if not needed.

**Files:**
- Modify: `frontend/src/app/plan/verify/page.tsx`

**Step 1: Update redirect destination**

Replace line 64 in `frontend/src/app/plan/verify/page.tsx`:

```typescript
      router.push('/tournaments');
```

Change to a more appropriate flow or consider removing if the QuickSetupForm handles creation directly.

**Step 2: Commit**

```bash
git add frontend/src/app/plan/verify/page.tsx
git commit -m "refactor(plan/verify): update redirect after athlete creation"
```

---

## Task 14: Run All Tests and Fix Any Issues

**Step 1: Run tests**

```bash
cd frontend && npm test
```

**Step 2: Fix any failing tests**

Update test files as needed to account for:
- New routing (`/plan/[athleteId]` instead of `/wishlist`)
- Removed wishlist components
- Updated plannerStore interface

**Step 3: Commit fixes**

```bash
git add -A
git commit -m "test: update tests for new plan routing structure"
```

---

## Task 15: Verify Build Passes

**Step 1: Run build**

```bash
cd frontend && npm run build
```

**Step 2: Fix any type errors or build issues**

**Step 3: Commit if needed**

```bash
git add -A
git commit -m "fix: resolve build errors"
```

---

## Task 16: Manual Testing Checklist

Test the following scenarios manually:

1. **New user with no athletes:**
   - Navigate to `/plan`
   - Should see QuickSetupForm
   - After completing, should create athlete and redirect to `/plan/[athleteId]`
   - Should see wizard (budget → location → must-gos → generate)

2. **Returning user with one athlete:**
   - Navigate to `/plan`
   - Should auto-redirect to `/plan/[athleteId]`
   - If wizard completed: should see plan view
   - If no wizard completed: should see wizard

3. **User with multiple athletes:**
   - Navigate to `/plan`
   - Should redirect to `/plan/select`
   - Selecting an athlete should go to `/plan/[athleteId]`

4. **Settings changes in plan view:**
   - Change budget, airport, or org preference
   - Click "Regenerate Plan"
   - Plan should update

5. **Mobile experience:**
   - Wizard steps should be touch-friendly
   - Plan view should have floating config button
   - Bottom sheet should work for settings

---

## Summary

This implementation transforms the confusing "My Season" + "View Season Plan" dual concepts into a unified wizard-driven "My Plan" experience. Key changes:

1. **plannerStore** now persists per-athlete state including the generated plan
2. **Wizard flow** guides new users through budget → location → must-gos → generate
3. **Plan view** shows returning users their saved plan with settings sidebar
4. **Routing** consolidated under `/plan` and `/plan/[athleteId]`
5. **Navigation** simplified with single "My Plan" entry point
6. **Cleanup** removes old wishlist and planner routes

The existing `PlannerConfig` and `PlannerResults` components are reused with minimal changes, and the `generatePlan()` logic is untouched.
