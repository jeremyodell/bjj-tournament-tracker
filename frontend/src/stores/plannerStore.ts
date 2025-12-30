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

// Per-athlete state that gets saved/restored when switching athletes
export interface AthleteState {
  config: PlannerConfig;
  plan: PlannedTournament[];
  hasCompletedWizard: boolean;
}

interface PlannerState {
  athleteId: string | null;
  config: PlannerConfig;
  plan: PlannedTournament[];
  isGenerating: boolean;
  hasCompletedWizard: boolean;
  athleteStates: Record<string, AthleteState>; // cached state per athlete

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
  resetWizard: () => void;
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
      isGenerating: false,
      hasCompletedWizard: false,
      athleteStates: {},

      setAthleteId: (athleteId) => {
        const state = get();
        const currentAthleteId = state.athleteId;

        // Save current athlete's state before switching (if there is one)
        let updatedAthleteStates = { ...state.athleteStates };
        if (currentAthleteId) {
          updatedAthleteStates[currentAthleteId] = {
            config: state.config,
            plan: state.plan,
            hasCompletedWizard: state.hasCompletedWizard,
          };
        }

        // Load new athlete's state (or defaults)
        const newAthleteState = updatedAthleteStates[athleteId] || defaultAthleteState;

        set({
          athleteId,
          config: newAthleteState.config,
          plan: newAthleteState.plan,
          hasCompletedWizard: newAthleteState.hasCompletedWizard,
          athleteStates: updatedAthleteStates,
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

      resetWizard: () => set({ hasCompletedWizard: false, plan: [] }),

      reset: () => set({
        config: defaultConfig,
        plan: [],
        athleteId: null,
        isGenerating: false,
        hasCompletedWizard: false,
        athleteStates: {},
      }),
    }),
    {
      name: 'planner-storage',
      partialize: (state) => ({
        athleteId: state.athleteId,
        config: state.config,
        plan: state.plan,
        hasCompletedWizard: state.hasCompletedWizard,
        athleteStates: state.athleteStates,
      }),
    }
  )
);
