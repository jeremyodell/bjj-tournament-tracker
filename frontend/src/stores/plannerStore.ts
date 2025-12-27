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

interface PlannerState {
  athleteId: string | null;
  config: PlannerConfig;
  plan: PlannedTournament[];
  isGenerating: boolean;

  // Actions
  setAthleteId: (athleteId: string) => void;
  updateConfig: (updates: Partial<PlannerConfig>) => void;
  addMustGo: (tournamentId: string) => void;
  removeMustGo: (tournamentId: string) => void;
  setPlan: (plan: PlannedTournament[]) => void;
  lockTournament: (tournamentId: string) => void;
  removeTournament: (tournamentId: string) => void;
  setIsGenerating: (isGenerating: boolean) => void;
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

export const usePlannerStore = create<PlannerState>()(
  persist(
    (set) => ({
      athleteId: null,
      config: defaultConfig,
      plan: [],
      isGenerating: false,

      setAthleteId: (athleteId) => set({ athleteId }),

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

      reset: () => set({ config: defaultConfig, plan: [], athleteId: null, isGenerating: false }),
    }),
    {
      name: 'planner-storage',
      partialize: (state) => ({
        athleteId: state.athleteId,
        config: state.config,
      }),
    }
  )
);
