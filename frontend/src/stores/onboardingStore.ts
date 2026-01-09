import { create } from 'zustand';

export interface OnboardingAthleteData {
  name: string;
  birthdate: string; // YYYY-MM-DD format
  gender: 'Male' | 'Female' | '';
  beltRank: string;
  weight: number | null;
  masterGymId?: string; // If user selected an existing gym
  masterGymName?: string; // Display name for selected gym
  gymCity?: string; // City of selected gym
  gymCountry?: string; // Country of selected gym
  customGymName?: string; // If user selected "Other" gym option
}

interface OnboardingState {
  // User role selection
  role: 'athlete' | 'parent' | null;

  // Array of athletes (1 for athlete role, 0-4 for parent role)
  athletes: OnboardingAthleteData[];

  // Current step in the flow
  currentStep: 'role' | 'athlete-form' | 'review';

  // Actions
  setRole: (role: 'athlete' | 'parent') => void;
  addAthlete: (athlete: OnboardingAthleteData) => void;
  updateAthlete: (index: number, athlete: Partial<OnboardingAthleteData>) => void;
  removeAthlete: (index: number) => void;
  setCurrentStep: (step: 'role' | 'athlete-form' | 'review') => void;
  reset: () => void;

  // Validation
  canAddAthlete: () => boolean;
  isAthleteComplete: (athlete: OnboardingAthleteData) => boolean;
  isOnboardingComplete: () => boolean;
}

const initialAthleteData: OnboardingAthleteData = {
  name: '',
  birthdate: '',
  gender: '',
  beltRank: '',
  weight: null,
  masterGymId: undefined,
  masterGymName: undefined,
  customGymName: undefined,
};

const initialState = {
  role: null as 'athlete' | 'parent' | null,
  athletes: [] as OnboardingAthleteData[],
  currentStep: 'role' as 'role' | 'athlete-form' | 'review',
};

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  ...initialState,

  setRole: (role) => {
    set({
      role,
      // Always start with at least one athlete slot
      athletes: [{ ...initialAthleteData }],
      currentStep: 'athlete-form',
    });
  },

  addAthlete: (athlete) => {
    const { role, athletes } = get();
    const maxAthletes = role === 'athlete' ? 1 : 4;

    if (athletes.length < maxAthletes) {
      set({ athletes: [...athletes, athlete] });
    }
  },

  updateAthlete: (index, updates) => {
    set((state) => {
      const newAthletes = [...state.athletes];
      newAthletes[index] = { ...newAthletes[index], ...updates };
      return { athletes: newAthletes };
    });
  },

  removeAthlete: (index) => {
    set((state) => ({
      athletes: state.athletes.filter((_, i) => i !== index),
    }));
  },

  setCurrentStep: (step) => set({ currentStep: step }),

  reset: () => set(initialState),

  canAddAthlete: () => {
    const { role, athletes } = get();
    const maxAthletes = role === 'athlete' ? 1 : 4;
    return athletes.length < maxAthletes;
  },

  isAthleteComplete: (athlete) => {
    if (!athlete) return false;
    return Boolean(
      athlete.name &&
        athlete.birthdate &&
        athlete.gender &&
        athlete.beltRank &&
        athlete.weight !== null &&
        athlete.weight > 0 &&
        (athlete.masterGymId || athlete.customGymName)
    );
  },

  isOnboardingComplete: () => {
    const { role, athletes } = get();
    if (!role || athletes.length === 0) return false;

    // All athletes must be complete
    return athletes.every((athlete) => get().isAthleteComplete(athlete));
  },
}));
