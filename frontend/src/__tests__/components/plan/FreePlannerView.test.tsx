import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '../../utils';
import { FreePlannerView } from '@/components/plan/FreePlannerView';
import { useSetupStore } from '@/stores/setupStore';

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
}));

// Mock the tournaments hook
vi.mock('@/hooks/useTournaments', () => ({
  useTournaments: () => ({
    data: {
      pages: [
        {
          tournaments: [
            {
              id: '1',
              name: 'Pan Kids',
              city: 'Kissimmee, FL',
              startDate: '2025-02-15',
              endDate: '2025-02-16',
              org: 'IBJJF',
              kids: true,
            },
            {
              id: '2',
              name: 'Dallas Open',
              city: 'Dallas, TX',
              startDate: '2025-03-08',
              endDate: '2025-03-08',
              org: 'IBJJF',
              kids: true,
            },
          ],
        },
      ],
    },
    isLoading: false,
    error: null,
    hasNextPage: false,
    fetchNextPage: vi.fn(),
    isFetchingNextPage: false,
  }),
}));

// Mock the wishlist hooks used by TournamentCard
vi.mock('@/hooks/useWishlist', () => ({
  useIsInWishlist: () => false,
  useWishlistMutations: () => ({
    addMutation: { mutate: vi.fn(), isPending: false },
    removeMutation: { mutate: vi.fn(), isPending: false },
  }),
}));

// Mock auth store
vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    isAuthenticated: false,
  }),
}));

describe('FreePlannerView', () => {
  beforeEach(() => {
    useSetupStore.getState().reset();
    useSetupStore.getState().setAthleteInfo({
      athleteName: 'Sofia',
      age: 10,
      belt: 'gray',
      weight: '60',
    });
    useSetupStore.getState().setLocation('Dallas, TX');
  });

  it('displays athlete name in header', () => {
    render(<FreePlannerView />);
    expect(screen.getByText(/Sofia.*2025 Season/i)).toBeInTheDocument();
  });

  it('displays athlete info', () => {
    render(<FreePlannerView />);
    expect(screen.getByText(/Gray Belt/i)).toBeInTheDocument();
    expect(screen.getByText(/60/)).toBeInTheDocument();
    expect(screen.getByText(/Age 10/i)).toBeInTheDocument();
  });

  it('displays tournament count', () => {
    render(<FreePlannerView />);
    expect(screen.getByText(/2 tournaments/i)).toBeInTheDocument();
  });

  it('displays tournament list', () => {
    render(<FreePlannerView />);
    expect(screen.getByText('Pan Kids')).toBeInTheDocument();
    expect(screen.getByText('Dallas Open')).toBeInTheDocument();
  });

  it('shows upgrade nudge', () => {
    render(<FreePlannerView />);
    expect(screen.getByText(/overwhelmed/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try it/i })).toBeInTheDocument();
  });

  it('shows save button', () => {
    render(<FreePlannerView />);
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
  });
});
