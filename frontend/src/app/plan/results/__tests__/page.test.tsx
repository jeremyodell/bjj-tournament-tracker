import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock next/navigation
const mockReplace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: mockReplace,
    push: vi.fn(),
  }),
}));

// Mock stores
const mockSetupStore = {
  isComplete: false,
  athleteId: null as string | null,
  athleteName: '',
  age: null,
  belt: '',
  weight: '',
  location: '',
};

vi.mock('@/stores/setupStore', () => ({
  useSetupStore: (selector?: (state: typeof mockSetupStore) => unknown) => {
    if (selector) return selector(mockSetupStore);
    return mockSetupStore;
  },
}));

const mockAuthStore = {
  isAuthenticated: false,
  isLoading: false,
  user: null,
};

vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector?: (state: typeof mockAuthStore) => unknown) => {
    if (selector) return selector(mockAuthStore);
    return mockAuthStore;
  },
}));

// Mock child components
vi.mock('@/components/plan/FreePlannerView', () => ({
  FreePlannerView: () => <div data-testid="free-planner-view">FreePlannerView</div>,
}));

import PlanResultsPage from '../page';

describe('PlanResultsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store state
    mockSetupStore.isComplete = false;
    mockSetupStore.athleteId = null;
    mockAuthStore.isAuthenticated = false;
  });

  describe('anonymous users', () => {
    it('redirects to /plan when setup is not complete', () => {
      mockAuthStore.isAuthenticated = false;
      mockSetupStore.isComplete = false;

      render(<PlanResultsPage />);

      expect(mockReplace).toHaveBeenCalledWith('/plan');
    });

    it('shows results when setup is complete', () => {
      mockAuthStore.isAuthenticated = false;
      mockSetupStore.isComplete = true;

      render(<PlanResultsPage />);

      expect(mockReplace).not.toHaveBeenCalled();
      expect(screen.getByTestId('free-planner-view')).toBeInTheDocument();
    });
  });

  describe('authenticated users', () => {
    it('redirects to /plan when no athlete is selected', () => {
      mockAuthStore.isAuthenticated = true;
      mockSetupStore.athleteId = null;

      render(<PlanResultsPage />);

      expect(mockReplace).toHaveBeenCalledWith('/plan');
    });

    it('shows results when athlete is selected', () => {
      mockAuthStore.isAuthenticated = true;
      mockSetupStore.athleteId = 'athlete-123';
      mockSetupStore.isComplete = true;

      render(<PlanResultsPage />);

      expect(mockReplace).not.toHaveBeenCalled();
      expect(screen.getByTestId('free-planner-view')).toBeInTheDocument();
    });

    it('shows results even if setup not marked complete but athlete selected', () => {
      // When an athlete is loaded from backend, athleteId is set
      // but isComplete might not be true if some fields are missing
      mockAuthStore.isAuthenticated = true;
      mockSetupStore.athleteId = 'athlete-123';
      mockSetupStore.isComplete = false;

      render(<PlanResultsPage />);

      // Should still show results because athlete is selected
      expect(mockReplace).not.toHaveBeenCalled();
      expect(screen.getByTestId('free-planner-view')).toBeInTheDocument();
    });
  });
});
