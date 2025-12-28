import { create } from 'zustand';

interface AthleteInfo {
  athleteName?: string;
  age?: number | null;
  belt?: string;
  weight?: string;
}

interface SetupState {
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
  reset: () => void;
}

const initialState = {
  athleteName: '',
  age: null,
  belt: '',
  weight: '',
  location: '',
  lat: null,
  lng: null,
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
