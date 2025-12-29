import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '../../utils';
import userEvent from '@testing-library/user-event';
import VerifyPage from '@/app/plan/verify/page';
import { useSetupStore } from '@/stores/setupStore';

// Mock next/navigation
const mockPush = vi.fn();
const mockReplace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
  }),
}));

// Mock auth store
const mockGetAccessToken = vi.fn();
vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    isAuthenticated: true,
    getAccessToken: mockGetAccessToken,
  }),
}));

// Mock createAthlete API
const mockCreateAthlete = vi.fn();
vi.mock('@/lib/api', () => ({
  createAthlete: (...args: unknown[]) => mockCreateAthlete(...args),
}));

describe('VerifyPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSetupStore.getState().reset();
    mockGetAccessToken.mockResolvedValue('test-token');
  });

  describe('when setupStore has data', () => {
    beforeEach(() => {
      useSetupStore.getState().setLocation('Dallas, TX');
      useSetupStore.getState().setAthleteInfo({
        athleteName: 'Sofia',
        age: 10,
        belt: 'gray',
        weight: '60',
      });
    });

    it('renders verification heading with athlete name', () => {
      render(<VerifyPage />);
      expect(screen.getByText(/confirm sofia's info/i)).toBeInTheDocument();
    });

    it('shows pre-filled form fields', () => {
      render(<VerifyPage />);
      expect(screen.getByDisplayValue('Sofia')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Dallas, TX')).toBeInTheDocument();
    });

    it('shows save button', () => {
      render(<VerifyPage />);
      expect(screen.getByRole('button', { name: /save.*continue/i })).toBeInTheDocument();
    });

    it('calls createAthlete and redirects on submit', async () => {
      const user = userEvent.setup();
      mockCreateAthlete.mockResolvedValue({
        athleteId: 'new-athlete-123',
        name: 'Sofia',
        beltRank: 'gray',
        birthYear: 2014,
        weightClass: '60',
      });

      render(<VerifyPage />);

      const submitButton = screen.getByRole('button', { name: /save.*continue/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockCreateAthlete).toHaveBeenCalledWith(
          'test-token',
          expect.objectContaining({
            name: 'Sofia',
            beltRank: 'gray',
          })
        );
      });

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/wishlist');
      });
    });

    it('clears setupStore after successful creation', async () => {
      const user = userEvent.setup();
      mockCreateAthlete.mockResolvedValue({
        athleteId: 'new-athlete-123',
        name: 'Sofia',
      });

      render(<VerifyPage />);

      const submitButton = screen.getByRole('button', { name: /save.*continue/i });
      await user.click(submitButton);

      await waitFor(() => {
        const state = useSetupStore.getState();
        expect(state.athleteName).toBe('');
        expect(state.isComplete).toBe(false);
      });
    });
  });

  describe('when setupStore is empty', () => {
    it('redirects to /plan', () => {
      render(<VerifyPage />);
      expect(mockReplace).toHaveBeenCalledWith('/plan');
    });
  });
});
