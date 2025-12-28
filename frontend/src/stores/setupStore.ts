import { create } from 'zustand';
import type { Athlete } from '@/lib/api';

interface AthleteInfo {
  athleteName?: string;
  age?: number | null;
  belt?: string;
  weight?: string;
}

interface SetupState {
  // Athlete ID (set when loading from existing athlete)
  athleteId: string | null;

  // Athlete info
  athleteName: string;
  age: number | null;
  belt: string;
  weight: string;

  // Location
  location: string;
  lat: number | null;
  lng: number | null;

  // Computed
  isComplete: boolean;

  // Actions
  setAthleteInfo: (info: AthleteInfo) => void;
  setLocation: (location: string, lat?: number, lng?: number) => void;
  loadFromAthlete: (athlete: Athlete) => void;
  reset: () => void;
}

const initialState = {
  athleteId: null as string | null,
  athleteName: '',
  age: null as number | null,
  belt: '',
  weight: '',
  location: '',
  lat: null as number | null,
  lng: null as number | null,
  isComplete: false,
};

export const useSetupStore = create<SetupState>((set, get) => ({
  ...initialState,

  setAthleteInfo: (info) => {
    set((state) => {
      const newState = {
        ...state,
        athleteName: info.athleteName ?? state.athleteName,
        age: info.age !== undefined ? info.age : state.age,
        belt: info.belt ?? state.belt,
        weight: info.weight ?? state.weight,
      };
      return {
        ...newState,
        isComplete: isSetupComplete(newState),
      };
    });
  },

  setLocation: (location, lat, lng) => {
    set((state) => {
      const newState = {
        ...state,
        location,
        lat: lat ?? state.lat,
        lng: lng ?? state.lng,
      };
      return {
        ...newState,
        isComplete: isSetupComplete(newState),
      };
    });
  },

  loadFromAthlete: (athlete) => {
    set((state) => {
      const currentYear = new Date().getFullYear();
      const age = athlete.birthYear ? currentYear - athlete.birthYear : null;

      const newState = {
        ...state,
        athleteId: athlete.athleteId,
        athleteName: athlete.name,
        age,
        belt: athlete.beltRank ?? '',
        weight: athlete.weightClass ?? '',
      };
      return {
        ...newState,
        isComplete: isSetupComplete(newState),
      };
    });
  },

  reset: () => set(initialState),
}));

function isSetupComplete(state: Partial<SetupState>): boolean {
  return Boolean(
    state.location &&
    state.athleteName &&
    state.age &&
    state.belt &&
    state.weight
  );
}
