import { usePlannerStore } from '@/stores/plannerStore';
import { beforeEach, describe, expect, it } from 'vitest';

describe('plannerStore', () => {
  beforeEach(() => {
    usePlannerStore.getState().reset();
    localStorage.clear();
  });

  describe('per-athlete state', () => {
    it('stores hasCompletedWizard per athlete', () => {
      const { setAthleteId, markWizardComplete } = usePlannerStore.getState();

      setAthleteId('athlete-1');
      markWizardComplete();

      expect(usePlannerStore.getState().hasCompletedWizard).toBe(true);

      // Switch to different athlete
      setAthleteId('athlete-2');
      expect(usePlannerStore.getState().hasCompletedWizard).toBe(false);

      // Switch back - should remember
      setAthleteId('athlete-1');
      expect(usePlannerStore.getState().hasCompletedWizard).toBe(true);
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
      expect(usePlannerStore.getState().plan).toEqual([]);

      // Switch back - plan should be restored
      store.setAthleteId('athlete-1');
      expect(usePlannerStore.getState().plan).toEqual(mockPlan);
    });

    it('persists config per athlete', () => {
      const store = usePlannerStore.getState();

      store.setAthleteId('athlete-1');
      store.updateConfig({ totalBudget: 5000, homeAirport: 'DFW' });

      // Switch athletes
      store.setAthleteId('athlete-2');
      expect(usePlannerStore.getState().config.totalBudget).toBe(3000); // default
      expect(usePlannerStore.getState().config.homeAirport).toBe('');

      // Switch back - config should be restored
      store.setAthleteId('athlete-1');
      expect(usePlannerStore.getState().config.totalBudget).toBe(5000);
      expect(usePlannerStore.getState().config.homeAirport).toBe('DFW');
    });

    it('handles reset correctly', () => {
      const store = usePlannerStore.getState();

      store.setAthleteId('athlete-1');
      store.markWizardComplete();
      store.setPlan([{
        tournament: { id: 'tourn-1', name: 'Test', org: 'IBJJF' } as any,
        registrationCost: 100,
        travelCost: 200,
        travelType: 'drive' as const,
        isLocked: false,
      }]);

      store.reset();

      expect(usePlannerStore.getState().athleteId).toBeNull();
      expect(usePlannerStore.getState().hasCompletedWizard).toBe(false);
      expect(usePlannerStore.getState().plan).toEqual([]);
    });
  });

  describe('existing functionality', () => {
    it('initializes with default config', () => {
      const state = usePlannerStore.getState();
      expect(state.athleteId).toBeNull();
      expect(state.config.totalBudget).toBe(3000);
      expect(state.config.reserveBudget).toBe(500);
      expect(state.config.maxDriveHours).toBe(4);
      expect(state.config.tournamentsPerMonth).toBe(1);
      expect(state.config.orgPreference).toBe('balanced');
      expect(state.plan).toEqual([]);
      expect(state.isGenerating).toBe(false);
    });

    it('updates config', () => {
      const { updateConfig } = usePlannerStore.getState();
      updateConfig({ totalBudget: 5000, homeAirport: 'DFW' });

      const state = usePlannerStore.getState();
      expect(state.config.totalBudget).toBe(5000);
      expect(state.config.homeAirport).toBe('DFW');
      // Other config values unchanged
      expect(state.config.reserveBudget).toBe(500);
    });

    it('adds and removes must-go tournaments', () => {
      const { addMustGo, removeMustGo } = usePlannerStore.getState();

      addMustGo('tourn-1');
      expect(usePlannerStore.getState().config.mustGoTournaments).toContain('tourn-1');

      addMustGo('tourn-2');
      expect(usePlannerStore.getState().config.mustGoTournaments).toEqual(['tourn-1', 'tourn-2']);

      removeMustGo('tourn-1');
      expect(usePlannerStore.getState().config.mustGoTournaments).toEqual(['tourn-2']);
    });

    it('does not duplicate must-go tournaments', () => {
      const { addMustGo } = usePlannerStore.getState();

      addMustGo('tourn-1');
      addMustGo('tourn-1');

      expect(usePlannerStore.getState().config.mustGoTournaments).toEqual(['tourn-1']);
    });

    it('sets and manages plan', () => {
      const { setPlan } = usePlannerStore.getState();
      const mockPlan = [{
        tournament: { id: 'tourn-1', name: 'Test', org: 'IBJJF' } as any,
        registrationCost: 100,
        travelCost: 200,
        travelType: 'drive' as const,
        isLocked: false,
      }];

      setPlan(mockPlan);
      expect(usePlannerStore.getState().plan).toEqual(mockPlan);
    });

    it('locks tournament and adds to must-go', () => {
      const { setPlan, lockTournament } = usePlannerStore.getState();

      setPlan([{
        tournament: { id: 'tourn-1', name: 'Test', org: 'IBJJF' } as any,
        registrationCost: 100,
        travelCost: 200,
        travelType: 'drive' as const,
        isLocked: false,
      }]);

      lockTournament('tourn-1');

      const state = usePlannerStore.getState();
      expect(state.plan[0].isLocked).toBe(true);
      expect(state.config.mustGoTournaments).toContain('tourn-1');
    });

    it('removes tournament from plan', () => {
      const { setPlan, removeTournament } = usePlannerStore.getState();

      setPlan([
        {
          tournament: { id: 'tourn-1', name: 'Test 1', org: 'IBJJF' } as any,
          registrationCost: 100,
          travelCost: 200,
          travelType: 'drive' as const,
          isLocked: false,
        },
        {
          tournament: { id: 'tourn-2', name: 'Test 2', org: 'JJWL' } as any,
          registrationCost: 50,
          travelCost: 100,
          travelType: 'drive' as const,
          isLocked: false,
        },
      ]);

      removeTournament('tourn-1');

      const state = usePlannerStore.getState();
      expect(state.plan.length).toBe(1);
      expect(state.plan[0].tournament.id).toBe('tourn-2');
    });

    it('sets isGenerating flag', () => {
      const { setIsGenerating } = usePlannerStore.getState();

      setIsGenerating(true);
      expect(usePlannerStore.getState().isGenerating).toBe(true);

      setIsGenerating(false);
      expect(usePlannerStore.getState().isGenerating).toBe(false);
    });
  });
});
