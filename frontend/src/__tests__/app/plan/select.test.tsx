import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '../../utils';
import userEvent from '@testing-library/user-event';
import SelectPage from '@/app/plan/select/page';
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

// Mock fetchAthletes API
const mockFetchAthletes = vi.fn();
vi.mock('@/lib/api', () => ({
  fetchAthletes: (...args: unknown[]) => mockFetchAthletes(...args),
}));

const mockAthletes = [
  {
    athleteId: 'athlete-1',
    name: 'Sofia',
    beltRank: 'gray',
    birthYear: 2014,
    weightClass: '60',
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
  {
    athleteId: 'athlete-2',
    name: 'Marco',
    beltRank: 'white',
    birthYear: 2016,
    weightClass: '45',
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  },
];

describe('SelectPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSetupStore.getState().reset();
    mockGetAccessToken.mockResolvedValue('test-token');
    mockFetchAthletes.mockResolvedValue({ athletes: mockAthletes });
  });

  it('renders heading', async () => {
    render(<SelectPage />);
    await waitFor(() => {
      expect(screen.getByText(/who's competing/i)).toBeInTheDocument();
    });
  });

  it('displays athlete cards', async () => {
    render(<SelectPage />);
    await waitFor(() => {
      expect(screen.getByText('Sofia')).toBeInTheDocument();
      expect(screen.getByText('Marco')).toBeInTheDocument();
    });
  });

  it('shows athlete details on cards', async () => {
    render(<SelectPage />);
    await waitFor(() => {
      expect(screen.getByText(/gray/i)).toBeInTheDocument();
      expect(screen.getByText(/white/i)).toBeInTheDocument();
    });
  });

  it('shows add new athlete button', async () => {
    render(<SelectPage />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add new athlete/i })).toBeInTheDocument();
    });
  });

  it('selects athlete and redirects on card click', async () => {
    const user = userEvent.setup();
    render(<SelectPage />);

    await waitFor(() => {
      expect(screen.getByText('Sofia')).toBeInTheDocument();
    });

    const sofiaCard = screen.getByText('Sofia').closest('button');
    await user.click(sofiaCard!);

    // Should populate setupStore with athlete data
    const state = useSetupStore.getState();
    expect(state.athleteId).toBe('athlete-1');
    expect(state.athleteName).toBe('Sofia');

    // Should redirect to wishlist
    expect(mockPush).toHaveBeenCalledWith('/wishlist');
  });

  it('navigates to /plan when add new athlete is clicked', async () => {
    const user = userEvent.setup();
    render(<SelectPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add new athlete/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /add new athlete/i }));
    expect(mockPush).toHaveBeenCalledWith('/plan?new=true');
  });

  it('shows loading state while fetching athletes', () => {
    mockFetchAthletes.mockImplementation(() => new Promise(() => {})); // Never resolves
    render(<SelectPage />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });
});
