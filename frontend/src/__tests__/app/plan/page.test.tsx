import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '../../utils';
import PlanPage from '@/app/plan/page';
import { useSetupStore } from '@/stores/setupStore';

// Mock next/navigation
const mockPush = vi.fn();
const mockReplace = vi.fn();
let mockSearchParamsValue = '';
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
  }),
  useSearchParams: () => ({
    get: (key: string) => key === 'new' && mockSearchParamsValue === 'true' ? 'true' : null,
  }),
}));

// Mock auth store
const mockGetAccessToken = vi.fn();
let mockIsAuthenticated = false;
vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    isAuthenticated: mockIsAuthenticated,
    isLoading: false,
    getAccessToken: mockGetAccessToken,
  }),
}));

// Mock fetchAthletes API
const mockFetchAthletes = vi.fn();
vi.mock('@/lib/api', () => ({
  fetchAthletes: (...args: unknown[]) => mockFetchAthletes(...args),
  createAthlete: vi.fn(),
}));

describe('PlanPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSetupStore.getState().reset();
    mockIsAuthenticated = false;
    mockSearchParamsValue = '';
    mockGetAccessToken.mockResolvedValue('test-token');
  });

  describe('when not authenticated', () => {
    it('shows setup form', async () => {
      render(<PlanPage />);
      await waitFor(() => {
        expect(screen.getByText(/find tournaments/i)).toBeInTheDocument();
      });
    });

    it('shows "No account required" message', async () => {
      render(<PlanPage />);
      await waitFor(() => {
        expect(screen.getByText(/no account required/i)).toBeInTheDocument();
      });
    });
  });

  describe('when authenticated with 0 athletes', () => {
    beforeEach(() => {
      mockIsAuthenticated = true;
      mockFetchAthletes.mockResolvedValue({ athletes: [] });
    });

    it('shows setup form', async () => {
      render(<PlanPage />);
      await waitFor(() => {
        expect(screen.getByText(/find tournaments/i)).toBeInTheDocument();
      });
    });
  });

  describe('when authenticated with 1 athlete', () => {
    beforeEach(() => {
      mockIsAuthenticated = true;
      mockFetchAthletes.mockResolvedValue({
        athletes: [{
          athleteId: 'athlete-1',
          name: 'Sofia',
          beltRank: 'gray',
          birthYear: 2014,
          weightClass: '60',
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01',
        }],
      });
    });

    it('redirects to /wishlist after auto-selecting', async () => {
      render(<PlanPage />);
      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/wishlist');
      }, { timeout: 3000 });
    });

    it('populates setupStore with athlete data', async () => {
      render(<PlanPage />);
      await waitFor(() => {
        const state = useSetupStore.getState();
        expect(state.athleteId).toBe('athlete-1');
      }, { timeout: 3000 });
    });
  });

  describe('when authenticated with 2+ athletes', () => {
    beforeEach(() => {
      mockIsAuthenticated = true;
      mockFetchAthletes.mockResolvedValue({
        athletes: [
          { athleteId: 'athlete-1', name: 'Sofia', beltRank: 'gray', birthYear: 2014, weightClass: '60', createdAt: '2024-01-01', updatedAt: '2024-01-01' },
          { athleteId: 'athlete-2', name: 'Marco', beltRank: 'white', birthYear: 2016, weightClass: '45', createdAt: '2024-01-01', updatedAt: '2024-01-01' },
        ],
      });
    });

    it('redirects to /plan/select', async () => {
      render(<PlanPage />);
      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/plan/select');
      }, { timeout: 3000 });
    });
  });

  describe('when ?new=true query param is set', () => {
    beforeEach(() => {
      mockIsAuthenticated = true;
      mockSearchParamsValue = 'true';
      mockFetchAthletes.mockResolvedValue({
        athletes: [
          { athleteId: 'athlete-1', name: 'Sofia', beltRank: 'gray', birthYear: 2014, weightClass: '60', createdAt: '2024-01-01', updatedAt: '2024-01-01' },
        ],
      });
    });

    it('shows setup form even with existing athletes', async () => {
      render(<PlanPage />);
      await waitFor(() => {
        expect(screen.getByText(/find tournaments/i)).toBeInTheDocument();
      });
      expect(mockReplace).not.toHaveBeenCalled();
    });
  });
});
