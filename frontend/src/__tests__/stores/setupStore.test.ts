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
});
