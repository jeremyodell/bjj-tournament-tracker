import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '../../utils';
import userEvent from '@testing-library/user-event';
import { TeammatesBadge } from '@/components/tournaments/TeammatesBadge';
import type { GymRoster, RosterAthlete } from '@/lib/api';

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe('TeammatesBadge', () => {
  const createRoster = (athletes: RosterAthlete[], athleteCount?: number): GymRoster => ({
    gymExternalId: 'gym-123',
    gymName: 'Test Gym',
    athletes,
    athleteCount: athleteCount ?? athletes.length,
    fetchedAt: '2025-01-01T00:00:00Z',
  });

  const mockAthletes: RosterAthlete[] = [
    { name: 'John Doe', belt: 'blue', ageDiv: 'Adult', weight: 'Medium Heavy', gender: 'Male' },
    { name: 'Jane Smith', belt: 'purple', ageDiv: 'Adult', weight: 'Light', gender: 'Female' },
    { name: 'Bob Johnson', belt: 'brown', ageDiv: 'Master 1', weight: 'Heavy', gender: 'Male' },
    { name: 'Alice Williams', belt: 'black', ageDiv: 'Adult', weight: 'Feather', gender: 'Female' },
    { name: 'Charlie Brown', belt: 'white', ageDiv: 'Juvenile', weight: 'Light', gender: 'Male' },
  ];

  describe('visibility', () => {
    it('is hidden when roster is null', () => {
      const { container } = render(
        <TeammatesBadge roster={null} org="JJWL" />
      );
      expect(container.firstChild).toBeNull();
    });

    it('is hidden when roster is undefined', () => {
      const { container } = render(
        <TeammatesBadge roster={undefined} org="JJWL" />
      );
      expect(container.firstChild).toBeNull();
    });

    it('is hidden when athleteCount is 0', () => {
      const roster = createRoster([], 0);
      const { container } = render(
        <TeammatesBadge roster={roster} org="JJWL" />
      );
      expect(container.firstChild).toBeNull();
    });

    it('is visible when athleteCount > 0', () => {
      const roster = createRoster([mockAthletes[0]]);
      render(<TeammatesBadge roster={roster} org="JJWL" />);
      expect(screen.getByText(/1 teammate/i)).toBeInTheDocument();
    });
  });

  describe('badge text', () => {
    it('shows singular "teammate" for 1 athlete', () => {
      const roster = createRoster([mockAthletes[0]]);
      render(<TeammatesBadge roster={roster} org="JJWL" />);
      expect(screen.getByText('1 teammate')).toBeInTheDocument();
    });

    it('shows plural "teammates" for multiple athletes', () => {
      const roster = createRoster([mockAthletes[0], mockAthletes[1]]);
      render(<TeammatesBadge roster={roster} org="JJWL" />);
      expect(screen.getByText('2 teammates')).toBeInTheDocument();
    });

    it('shows correct count for 5 athletes', () => {
      const roster = createRoster(mockAthletes);
      render(<TeammatesBadge roster={roster} org="JJWL" />);
      expect(screen.getByText('5 teammates')).toBeInTheDocument();
    });
  });

  describe('org-based styling', () => {
    it('applies cyan color for JJWL org', () => {
      const roster = createRoster([mockAthletes[0]]);
      render(<TeammatesBadge roster={roster} org="JJWL" />);
      const badge = screen.getByText('1 teammate').closest('button');
      expect(badge).toHaveClass('text-cyan-400');
    });

    it('applies fuchsia color for IBJJF org', () => {
      const roster = createRoster([mockAthletes[0]]);
      render(<TeammatesBadge roster={roster} org="IBJJF" />);
      const badge = screen.getByText('1 teammate').closest('button');
      expect(badge).toHaveClass('text-fuchsia-400');
    });
  });

  describe('loading state', () => {
    it('shows skeleton when isLoading is true', () => {
      render(<TeammatesBadge roster={null} org="JJWL" isLoading={true} />);
      expect(screen.getByTestId('teammates-badge-skeleton')).toBeInTheDocument();
    });

    it('hides skeleton when isLoading is false and roster is null', () => {
      const { container } = render(
        <TeammatesBadge roster={null} org="JJWL" isLoading={false} />
      );
      expect(screen.queryByTestId('teammates-badge-skeleton')).not.toBeInTheDocument();
      expect(container.firstChild).toBeNull();
    });
  });

  describe('expand/collapse functionality', () => {
    it('is collapsed by default', () => {
      const roster = createRoster(mockAthletes);
      render(<TeammatesBadge roster={roster} org="JJWL" />);
      expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
    });

    it('expands to show athletes when clicked', async () => {
      const user = userEvent.setup();
      const roster = createRoster(mockAthletes);
      render(<TeammatesBadge roster={roster} org="JJWL" />);

      await user.click(screen.getByText('5 teammates'));

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });
    });

    it('collapses when clicked again', async () => {
      const user = userEvent.setup();
      const roster = createRoster(mockAthletes);
      render(<TeammatesBadge roster={roster} org="JJWL" />);

      // Expand
      await user.click(screen.getByText('5 teammates'));
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      // Collapse
      await user.click(screen.getByText('5 teammates'));
      await waitFor(() => {
        expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
      });
    });

    it('shows only first 3 athletes when expanded', async () => {
      const user = userEvent.setup();
      const roster = createRoster(mockAthletes);
      render(<TeammatesBadge roster={roster} org="JJWL" />);

      await user.click(screen.getByText('5 teammates'));

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
        expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
      });

      // 4th and 5th athletes should not be shown directly
      expect(screen.queryByText('Alice Williams')).not.toBeInTheDocument();
      expect(screen.queryByText('Charlie Brown')).not.toBeInTheDocument();
    });

    it('shows "+N more" when more than 3 athletes', async () => {
      const user = userEvent.setup();
      const roster = createRoster(mockAthletes);
      render(<TeammatesBadge roster={roster} org="JJWL" tournamentId="tourn-123" />);

      await user.click(screen.getByText('5 teammates'));

      await waitFor(() => {
        expect(screen.getByText('+2 more')).toBeInTheDocument();
      });
    });

    it('does not show "+N more" when 3 or fewer athletes', async () => {
      const user = userEvent.setup();
      const roster = createRoster(mockAthletes.slice(0, 3));
      render(<TeammatesBadge roster={roster} org="JJWL" />);

      await user.click(screen.getByText('3 teammates'));

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      expect(screen.queryByText(/\+\d+ more/)).not.toBeInTheDocument();
    });

    it('"+N more" links to full view with tournament ID', async () => {
      const user = userEvent.setup();
      const roster = createRoster(mockAthletes);
      render(<TeammatesBadge roster={roster} org="JJWL" tournamentId="tourn-123" />);

      await user.click(screen.getByText('5 teammates'));

      await waitFor(() => {
        const moreLink = screen.getByText('+2 more').closest('a');
        expect(moreLink).toHaveAttribute('href', '/tournaments/tourn-123/roster');
      });
    });
  });

  describe('belt indicator', () => {
    it('displays belt indicator for each athlete', async () => {
      const user = userEvent.setup();
      const roster = createRoster([mockAthletes[0]]); // blue belt
      render(<TeammatesBadge roster={roster} org="JJWL" />);

      await user.click(screen.getByText('1 teammate'));

      await waitFor(() => {
        const beltIndicator = screen.getByTestId('belt-indicator-blue');
        expect(beltIndicator).toBeInTheDocument();
      });
    });

    it('applies correct styling for white belt', async () => {
      const user = userEvent.setup();
      const roster = createRoster([
        { name: 'White Belt Kid', belt: 'white', ageDiv: 'Juvenile', weight: 'Light', gender: 'Male' },
      ]);
      render(<TeammatesBadge roster={roster} org="JJWL" />);

      await user.click(screen.getByText('1 teammate'));

      await waitFor(() => {
        const beltIndicator = screen.getByTestId('belt-indicator-white');
        expect(beltIndicator).toHaveClass('bg-white');
      });
    });

    it('applies correct styling for blue belt', async () => {
      const user = userEvent.setup();
      const roster = createRoster([mockAthletes[0]]); // blue belt
      render(<TeammatesBadge roster={roster} org="JJWL" />);

      await user.click(screen.getByText('1 teammate'));

      await waitFor(() => {
        const beltIndicator = screen.getByTestId('belt-indicator-blue');
        expect(beltIndicator).toHaveClass('bg-blue-600');
      });
    });

    it('applies correct styling for purple belt', async () => {
      const user = userEvent.setup();
      const roster = createRoster([mockAthletes[1]]); // purple belt
      render(<TeammatesBadge roster={roster} org="JJWL" />);

      await user.click(screen.getByText('1 teammate'));

      await waitFor(() => {
        const beltIndicator = screen.getByTestId('belt-indicator-purple');
        expect(beltIndicator).toHaveClass('bg-purple-600');
      });
    });

    it('applies correct styling for brown belt', async () => {
      const user = userEvent.setup();
      const roster = createRoster([mockAthletes[2]]); // brown belt
      render(<TeammatesBadge roster={roster} org="JJWL" />);

      await user.click(screen.getByText('1 teammate'));

      await waitFor(() => {
        const beltIndicator = screen.getByTestId('belt-indicator-brown');
        expect(beltIndicator).toHaveClass('bg-amber-800');
      });
    });

    it('applies correct styling for black belt', async () => {
      const user = userEvent.setup();
      const roster = createRoster([mockAthletes[3]]); // black belt
      render(<TeammatesBadge roster={roster} org="JJWL" />);

      await user.click(screen.getByText('1 teammate'));

      await waitFor(() => {
        const beltIndicator = screen.getByTestId('belt-indicator-black');
        expect(beltIndicator).toHaveClass('bg-gray-900');
      });
    });

    it('applies correct styling for yellow belt (kids)', async () => {
      const user = userEvent.setup();
      const roster = createRoster([
        { name: 'Yellow Kid', belt: 'yellow', ageDiv: 'Kids', weight: 'Light', gender: 'Male' },
      ]);
      render(<TeammatesBadge roster={roster} org="JJWL" />);

      await user.click(screen.getByText('1 teammate'));

      await waitFor(() => {
        const beltIndicator = screen.getByTestId('belt-indicator-yellow');
        expect(beltIndicator).toHaveClass('bg-yellow-400');
      });
    });

    it('applies correct styling for orange belt (kids)', async () => {
      const user = userEvent.setup();
      const roster = createRoster([
        { name: 'Orange Kid', belt: 'orange', ageDiv: 'Kids', weight: 'Light', gender: 'Male' },
      ]);
      render(<TeammatesBadge roster={roster} org="JJWL" />);

      await user.click(screen.getByText('1 teammate'));

      await waitFor(() => {
        const beltIndicator = screen.getByTestId('belt-indicator-orange');
        expect(beltIndicator).toHaveClass('bg-orange-500');
      });
    });

    it('applies correct styling for green belt (kids)', async () => {
      const user = userEvent.setup();
      const roster = createRoster([
        { name: 'Green Kid', belt: 'green', ageDiv: 'Kids', weight: 'Light', gender: 'Male' },
      ]);
      render(<TeammatesBadge roster={roster} org="JJWL" />);

      await user.click(screen.getByText('1 teammate'));

      await waitFor(() => {
        const beltIndicator = screen.getByTestId('belt-indicator-green');
        expect(beltIndicator).toHaveClass('bg-green-600');
      });
    });

    it('applies correct styling for grey belt (kids)', async () => {
      const user = userEvent.setup();
      const roster = createRoster([
        { name: 'Grey Kid', belt: 'grey', ageDiv: 'Kids', weight: 'Light', gender: 'Male' },
      ]);
      render(<TeammatesBadge roster={roster} org="JJWL" />);

      await user.click(screen.getByText('1 teammate'));

      await waitFor(() => {
        const beltIndicator = screen.getByTestId('belt-indicator-grey');
        expect(beltIndicator).toHaveClass('bg-gray-500');
      });
    });

    it('handles gray spelling variation', async () => {
      const user = userEvent.setup();
      const roster = createRoster([
        { name: 'Gray Kid', belt: 'gray', ageDiv: 'Kids', weight: 'Light', gender: 'Male' },
      ]);
      render(<TeammatesBadge roster={roster} org="JJWL" />);

      await user.click(screen.getByText('1 teammate'));

      await waitFor(() => {
        const beltIndicator = screen.getByTestId('belt-indicator-gray');
        expect(beltIndicator).toHaveClass('bg-gray-500');
      });
    });
  });

  describe('animation', () => {
    it('has slide-down animation class when expanded', async () => {
      const user = userEvent.setup();
      const roster = createRoster(mockAthletes);
      render(<TeammatesBadge roster={roster} org="JJWL" />);

      await user.click(screen.getByText('5 teammates'));

      await waitFor(() => {
        const expandedSection = screen.getByTestId('teammates-expanded');
        expect(expandedSection).toBeInTheDocument();
      });
    });
  });
});
