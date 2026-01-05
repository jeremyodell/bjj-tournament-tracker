import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '../../utils';
import userEvent from '@testing-library/user-event';
import { GymSearchAutocomplete } from '@/components/gym/GymSearchAutocomplete';
import type { Gym } from '@/lib/api';

// Mock the useGymSearch hook
vi.mock('@/hooks/useGymSearch', () => ({
  useGymSearch: vi.fn(),
}));

import { useGymSearch } from '@/hooks/useGymSearch';

const mockUseGymSearch = useGymSearch as ReturnType<typeof vi.fn>;

describe('GymSearchAutocomplete', () => {
  const mockOnSelect = vi.fn();

  const mockGyms: Gym[] = [
    { org: 'JJWL', externalId: '1234', name: 'Alliance BJJ Dallas' },
    { org: 'IBJJF', externalId: '5678', name: 'Gracie Barra Austin' },
    { org: 'JJWL', externalId: '9012', name: 'Atos San Diego' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock: empty results, not loading
    mockUseGymSearch.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });
  });

  describe('when no gym is selected', () => {
    it('shows input with placeholder "Search for your gym..."', () => {
      render(
        <GymSearchAutocomplete selectedGym={null} onSelect={mockOnSelect} />
      );

      const input = screen.getByPlaceholderText('Search for your gym...');
      expect(input).toBeInTheDocument();
    });

    it('does not show dropdown when input has less than 2 characters', async () => {
      const user = userEvent.setup();
      mockUseGymSearch.mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      });

      render(
        <GymSearchAutocomplete selectedGym={null} onSelect={mockOnSelect} />
      );

      const input = screen.getByPlaceholderText('Search for your gym...');
      await user.type(input, 'A');

      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('shows dropdown with results after 2+ characters typed', async () => {
      const user = userEvent.setup();
      mockUseGymSearch.mockReturnValue({
        data: mockGyms,
        isLoading: false,
        error: null,
      });

      render(
        <GymSearchAutocomplete selectedGym={null} onSelect={mockOnSelect} />
      );

      const input = screen.getByPlaceholderText('Search for your gym...');
      await user.type(input, 'Al');

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      expect(screen.getByText('Alliance BJJ Dallas')).toBeInTheDocument();
      expect(screen.getByText('Gracie Barra Austin')).toBeInTheDocument();
    });

    it('shows loading state while searching', async () => {
      const user = userEvent.setup();
      mockUseGymSearch.mockReturnValue({
        data: [],
        isLoading: true,
        error: null,
      });

      render(
        <GymSearchAutocomplete selectedGym={null} onSelect={mockOnSelect} />
      );

      const input = screen.getByPlaceholderText('Search for your gym...');
      await user.type(input, 'Alliance');

      await waitFor(() => {
        expect(screen.getByText(/searching/i)).toBeInTheDocument();
      });
    });

    it('shows "No gyms found" when search returns empty results', async () => {
      const user = userEvent.setup();
      mockUseGymSearch.mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      });

      render(
        <GymSearchAutocomplete selectedGym={null} onSelect={mockOnSelect} />
      );

      const input = screen.getByPlaceholderText('Search for your gym...');
      await user.type(input, 'NonexistentGym');

      await waitFor(() => {
        expect(screen.getByText(/no gyms found/i)).toBeInTheDocument();
      });
    });

    it('displays each result with gym name and org badge', async () => {
      const user = userEvent.setup();
      mockUseGymSearch.mockReturnValue({
        data: mockGyms,
        isLoading: false,
        error: null,
      });

      render(
        <GymSearchAutocomplete selectedGym={null} onSelect={mockOnSelect} />
      );

      const input = screen.getByPlaceholderText('Search for your gym...');
      await user.type(input, 'BJJ');

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      // Check gym names are displayed
      expect(screen.getByText('Alliance BJJ Dallas')).toBeInTheDocument();
      expect(screen.getByText('Gracie Barra Austin')).toBeInTheDocument();

      // Check org badges are displayed (JJWL and IBJJF)
      const jjwlBadges = screen.getAllByText('JJWL');
      const ibjjfBadges = screen.getAllByText('IBJJF');
      expect(jjwlBadges.length).toBeGreaterThan(0);
      expect(ibjjfBadges.length).toBeGreaterThan(0);
    });

    it('calls onSelect with gym and closes dropdown when result is clicked', async () => {
      const user = userEvent.setup();
      mockUseGymSearch.mockReturnValue({
        data: mockGyms,
        isLoading: false,
        error: null,
      });

      render(
        <GymSearchAutocomplete selectedGym={null} onSelect={mockOnSelect} />
      );

      const input = screen.getByPlaceholderText('Search for your gym...');
      await user.type(input, 'Alliance');

      await waitFor(() => {
        expect(screen.getByText('Alliance BJJ Dallas')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Alliance BJJ Dallas'));

      expect(mockOnSelect).toHaveBeenCalledWith({
        org: 'JJWL',
        externalId: '1234',
        name: 'Alliance BJJ Dallas',
      });

      // Dropdown should close after selection
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('clears input after selection', async () => {
      const user = userEvent.setup();
      mockUseGymSearch.mockReturnValue({
        data: mockGyms,
        isLoading: false,
        error: null,
      });

      render(
        <GymSearchAutocomplete selectedGym={null} onSelect={mockOnSelect} />
      );

      const input = screen.getByPlaceholderText('Search for your gym...');
      await user.type(input, 'Alliance');

      await waitFor(() => {
        expect(screen.getByText('Alliance BJJ Dallas')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Alliance BJJ Dallas'));

      // Input should be cleared after selection
      expect(input).toHaveValue('');
    });
  });

  describe('when gym is selected', () => {
    const selectedGym: Gym = {
      org: 'JJWL',
      externalId: '1234',
      name: 'Alliance BJJ Dallas',
    };

    it('shows selected gym as a chip instead of search input', () => {
      render(
        <GymSearchAutocomplete selectedGym={selectedGym} onSelect={mockOnSelect} />
      );

      expect(screen.getByText('Alliance BJJ Dallas')).toBeInTheDocument();
      expect(screen.queryByPlaceholderText('Search for your gym...')).not.toBeInTheDocument();
    });

    it('shows org badge on selected gym chip', () => {
      render(
        <GymSearchAutocomplete selectedGym={selectedGym} onSelect={mockOnSelect} />
      );

      expect(screen.getByText('JJWL')).toBeInTheDocument();
    });

    it('shows "Change" button next to selected gym', () => {
      render(
        <GymSearchAutocomplete selectedGym={selectedGym} onSelect={mockOnSelect} />
      );

      expect(screen.getByRole('button', { name: /change/i })).toBeInTheDocument();
    });

    it('clicking "Change" shows search input again', async () => {
      const user = userEvent.setup();
      render(
        <GymSearchAutocomplete selectedGym={selectedGym} onSelect={mockOnSelect} />
      );

      await user.click(screen.getByRole('button', { name: /change/i }));

      expect(screen.getByPlaceholderText('Search for your gym...')).toBeInTheDocument();
    });

    it('calls onSelect with null when cleared', async () => {
      const user = userEvent.setup();
      render(
        <GymSearchAutocomplete selectedGym={selectedGym} onSelect={mockOnSelect} />
      );

      await user.click(screen.getByRole('button', { name: /change/i }));

      // Should call onSelect with null to clear the selection
      expect(mockOnSelect).toHaveBeenCalledWith(null);
    });
  });

  describe('org badge styling', () => {
    it('applies cyan styling for JJWL badges', async () => {
      const user = userEvent.setup();
      mockUseGymSearch.mockReturnValue({
        data: [{ org: 'JJWL', externalId: '1234', name: 'JJWL Gym' }],
        isLoading: false,
        error: null,
      });

      render(
        <GymSearchAutocomplete selectedGym={null} onSelect={mockOnSelect} />
      );

      const input = screen.getByPlaceholderText('Search for your gym...');
      await user.type(input, 'JJWL');

      await waitFor(() => {
        const badge = screen.getByText('JJWL');
        expect(badge).toHaveClass('bg-cyan-500/20', 'text-cyan-400');
      });
    });

    it('applies magenta styling for IBJJF badges', async () => {
      const user = userEvent.setup();
      mockUseGymSearch.mockReturnValue({
        data: [{ org: 'IBJJF', externalId: '5678', name: 'IBJJF Gym' }],
        isLoading: false,
        error: null,
      });

      render(
        <GymSearchAutocomplete selectedGym={null} onSelect={mockOnSelect} />
      );

      const input = screen.getByPlaceholderText('Search for your gym...');
      await user.type(input, 'IBJJF');

      await waitFor(() => {
        const badge = screen.getByText('IBJJF');
        expect(badge).toHaveClass('bg-fuchsia-500/20', 'text-fuchsia-400');
      });
    });
  });

  describe('keyboard navigation', () => {
    it('closes dropdown when Escape is pressed', async () => {
      const user = userEvent.setup();
      mockUseGymSearch.mockReturnValue({
        data: mockGyms,
        isLoading: false,
        error: null,
      });

      render(
        <GymSearchAutocomplete selectedGym={null} onSelect={mockOnSelect} />
      );

      const input = screen.getByPlaceholderText('Search for your gym...');
      await user.type(input, 'Alliance');

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      await user.keyboard('{Escape}');

      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });
  });
});
