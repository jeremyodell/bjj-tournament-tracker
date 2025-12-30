import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '../../utils';
import userEvent from '@testing-library/user-event';
import { AirportSelector } from '@/components/planner/AirportSelector';
import type { Airport } from '@/lib/airports';

// Mock geolocation
const mockGeolocation = {
  getCurrentPosition: vi.fn(),
};

Object.defineProperty(navigator, 'geolocation', {
  value: mockGeolocation,
  writable: true,
});

describe('AirportSelector', () => {
  const mockOnSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockGeolocation.getCurrentPosition.mockReset();
  });

  describe('with no selected airport', () => {
    it('shows loading state initially when geolocation is being checked', () => {
      // Make geolocation hang (never call callback)
      mockGeolocation.getCurrentPosition.mockImplementation(() => {});

      render(<AirportSelector selectedAirport={null} onSelect={mockOnSelect} />);

      // Should show loading or detection state
      expect(
        screen.getByText(/detecting/i) || screen.getByRole('status')
      ).toBeInTheDocument();
    });

    it('shows detected airport when geolocation succeeds', async () => {
      // Mock successful geolocation near Dallas
      mockGeolocation.getCurrentPosition.mockImplementation((success) =>
        success({
          coords: { latitude: 32.7767, longitude: -96.797 },
        })
      );

      render(<AirportSelector selectedAirport={null} onSelect={mockOnSelect} />);

      await waitFor(() => {
        expect(screen.getByText(/Dallas\/Fort Worth/i)).toBeInTheDocument();
      });
      expect(screen.getByRole('button', { name: /use.*dfw/i })).toBeInTheDocument();
    });

    it('allows selecting detected airport', async () => {
      const user = userEvent.setup();
      mockGeolocation.getCurrentPosition.mockImplementation((success) =>
        success({
          coords: { latitude: 32.7767, longitude: -96.797 },
        })
      );

      render(<AirportSelector selectedAirport={null} onSelect={mockOnSelect} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /use.*dfw/i })).toBeInTheDocument();
      });

      const useButton = screen.getByRole('button', { name: /use.*dfw/i });
      await user.click(useButton);

      expect(mockOnSelect).toHaveBeenCalledWith(
        expect.objectContaining({ iataCode: 'DFW' })
      );
    });

    it('allows searching for different airport', async () => {
      const user = userEvent.setup();
      mockGeolocation.getCurrentPosition.mockImplementation((success) =>
        success({
          coords: { latitude: 32.7767, longitude: -96.797 },
        })
      );

      render(<AirportSelector selectedAirport={null} onSelect={mockOnSelect} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /choose different/i })).toBeInTheDocument();
      });

      const changeButton = screen.getByRole('button', { name: /choose different/i });
      await user.click(changeButton);

      const input = screen.getByPlaceholderText(/search/i);
      expect(input).toBeInTheDocument();
    });

    it('shows search results when typing in search', async () => {
      const user = userEvent.setup();
      // Geolocation fails
      mockGeolocation.getCurrentPosition.mockImplementation((_, error) =>
        error({ code: 1, message: 'Permission denied' })
      );

      render(<AirportSelector selectedAirport={null} onSelect={mockOnSelect} />);

      // Wait for geolocation to fail
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /search/i }));

      const input = screen.getByPlaceholderText(/search/i);
      await user.type(input, 'austin');

      await waitFor(() => {
        expect(screen.getByText(/AUS/)).toBeInTheDocument();
      });
    });

    it('calls onSelect when airport chosen from search', async () => {
      const user = userEvent.setup();
      mockGeolocation.getCurrentPosition.mockImplementation((_, error) =>
        error({ code: 1, message: 'Permission denied' })
      );

      render(<AirportSelector selectedAirport={null} onSelect={mockOnSelect} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /search/i }));

      const input = screen.getByPlaceholderText(/search/i);
      await user.type(input, 'DFW');

      await waitFor(() => {
        expect(screen.getByText(/Dallas\/Fort Worth/)).toBeInTheDocument();
      });

      // Click the result
      await user.click(screen.getByText(/Dallas\/Fort Worth/));

      expect(mockOnSelect).toHaveBeenCalledWith(
        expect.objectContaining({ iataCode: 'DFW' })
      );
    });
  });

  describe('with selected airport', () => {
    const selectedAirport: Airport = {
      iataCode: 'DFW',
      name: 'Dallas/Fort Worth International Airport',
      city: 'Dallas',
      state: 'TX',
      country: 'US',
      lat: 32.8998,
      lng: -97.0403,
    };

    it('shows the selected airport', () => {
      render(
        <AirportSelector selectedAirport={selectedAirport} onSelect={mockOnSelect} />
      );

      expect(screen.getByText(/Dallas\/Fort Worth/)).toBeInTheDocument();
      expect(screen.getByText(/DFW/)).toBeInTheDocument();
    });

    it('shows change button when airport is selected', () => {
      render(
        <AirportSelector selectedAirport={selectedAirport} onSelect={mockOnSelect} />
      );

      expect(screen.getByRole('button', { name: /change/i })).toBeInTheDocument();
    });

    it('allows changing airport', async () => {
      const user = userEvent.setup();
      render(
        <AirportSelector selectedAirport={selectedAirport} onSelect={mockOnSelect} />
      );

      await user.click(screen.getByRole('button', { name: /change/i }));

      expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
    });
  });
});
