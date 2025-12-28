import { describe, it, expect, beforeEach } from 'vitest';
import { useSetupStore } from '@/stores/setupStore';

describe('setupStore', () => {
  beforeEach(() => {
    useSetupStore.getState().reset();
  });

  it('initializes with empty state', () => {
    const state = useSetupStore.getState();
    expect(state.athleteName).toBe('');
    expect(state.age).toBeNull();
    expect(state.belt).toBe('');
    expect(state.weight).toBe('');
    expect(state.location).toBe('');
    expect(state.isComplete).toBe(false);
  });

  it('updates athlete info', () => {
    const { setAthleteInfo } = useSetupStore.getState();
    setAthleteInfo({
      athleteName: 'Sofia',
      age: 10,
      belt: 'gray',
      weight: '60',
    });

    const state = useSetupStore.getState();
    expect(state.athleteName).toBe('Sofia');
    expect(state.age).toBe(10);
    expect(state.belt).toBe('gray');
    expect(state.weight).toBe('60');
  });

  it('updates location', () => {
    const { setLocation } = useSetupStore.getState();
    setLocation('Dallas, TX');

    expect(useSetupStore.getState().location).toBe('Dallas, TX');
  });

  it('computes isComplete when all required fields are set', () => {
    const { setAthleteInfo, setLocation } = useSetupStore.getState();

    setLocation('Dallas, TX');
    expect(useSetupStore.getState().isComplete).toBe(false);

    setAthleteInfo({
      athleteName: 'Sofia',
      age: 10,
      belt: 'gray',
      weight: '60',
    });

    expect(useSetupStore.getState().isComplete).toBe(true);
  });

  it('resets to initial state', () => {
    const { setAthleteInfo, setLocation, reset } = useSetupStore.getState();

    setLocation('Dallas, TX');
    setAthleteInfo({ athleteName: 'Sofia', age: 10, belt: 'gray', weight: '60' });
    reset();

    const state = useSetupStore.getState();
    expect(state.athleteName).toBe('');
    expect(state.location).toBe('');
    expect(state.isComplete).toBe(false);
  });

  describe('athleteId', () => {
    it('initializes athleteId as null', () => {
      const state = useSetupStore.getState();
      expect(state.athleteId).toBeNull();
    });

    it('resets athleteId to null', () => {
      const { loadFromAthlete, reset } = useSetupStore.getState();
      loadFromAthlete({
        athleteId: 'athlete-123',
        name: 'Sofia',
        beltRank: 'gray',
        birthYear: 2014,
        weightClass: '60',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      });
      reset();
      expect(useSetupStore.getState().athleteId).toBeNull();
    });
  });

  describe('loadFromAthlete', () => {
    it('populates store from athlete data', () => {
      const { loadFromAthlete } = useSetupStore.getState();

      loadFromAthlete({
        athleteId: 'athlete-123',
        name: 'Sofia',
        beltRank: 'gray',
        birthYear: 2014,
        weightClass: '60',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      });

      const state = useSetupStore.getState();
      expect(state.athleteId).toBe('athlete-123');
      expect(state.athleteName).toBe('Sofia');
      expect(state.belt).toBe('gray');
      expect(state.weight).toBe('60');
      // birthYear 2014 means age ~10-11 in 2024/2025
      expect(state.age).toBe(new Date().getFullYear() - 2014);
    });

    it('handles null fields gracefully', () => {
      const { loadFromAthlete } = useSetupStore.getState();

      loadFromAthlete({
        athleteId: 'athlete-456',
        name: 'Test',
        beltRank: null,
        birthYear: null,
        weightClass: null,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      });

      const state = useSetupStore.getState();
      expect(state.athleteId).toBe('athlete-456');
      expect(state.athleteName).toBe('Test');
      expect(state.belt).toBe('');
      expect(state.weight).toBe('');
      expect(state.age).toBeNull();
    });

    it('preserves existing location when loading athlete', () => {
      const { setLocation, loadFromAthlete } = useSetupStore.getState();

      setLocation('Dallas, TX', 32.7767, -96.7970);

      loadFromAthlete({
        athleteId: 'athlete-123',
        name: 'Sofia',
        beltRank: 'gray',
        birthYear: 2014,
        weightClass: '60',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      });

      const state = useSetupStore.getState();
      expect(state.location).toBe('Dallas, TX');
      expect(state.lat).toBe(32.7767);
      expect(state.lng).toBe(-96.7970);
    });
  });
});
