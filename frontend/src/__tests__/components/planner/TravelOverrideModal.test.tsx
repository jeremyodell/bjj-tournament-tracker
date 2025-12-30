import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '../../utils';
import userEvent from '@testing-library/user-event';
import { TravelOverrideModal } from '@/components/planner/TravelOverrideModal';
import type { PlannedTournament, FlightPrice } from '@/stores/plannerStore';

const mockTournament: PlannedTournament['tournament'] = {
  id: 'test-123',
  name: 'Miami Open',
  org: 'IBJJF',
  city: 'Miami',
  state: 'FL',
  country: 'US',
  startDate: '2025-02-15',
  endDate: '2025-02-16',
  registrationUrl: 'https://example.com',
  gi: true,
  nogi: true,
  kids: true,
  lat: 25.7617,
  lng: -80.1918,
};

const mockFlightPrice: FlightPrice = {
  price: 287,
  source: 'amadeus',
  airline: 'American Airlines',
  fetchedAt: '2025-01-01T00:00:00Z',
  route: { origin: 'DFW', destination: 'MIA' },
};

describe('TravelOverrideModal', () => {
  const mockOnClose = vi.fn();
  const mockOnSave = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders the modal with tournament name', () => {
      const plannedTournament: PlannedTournament = {
        tournament: mockTournament,
        registrationCost: 120,
        travelCost: 287,
        travelType: 'fly',
        isLocked: false,
        flightPrice: mockFlightPrice,
        driveCost: 428,
        driveDistance: 640,
      };

      render(
        <TravelOverrideModal
          isOpen={true}
          plannedTournament={plannedTournament}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );

      expect(screen.getByText(/change travel type/i)).toBeInTheDocument();
      expect(screen.getByText(/Miami Open/)).toBeInTheDocument();
    });

    it('shows fly option with price', () => {
      const plannedTournament: PlannedTournament = {
        tournament: mockTournament,
        registrationCost: 120,
        travelCost: 287,
        travelType: 'fly',
        isLocked: false,
        flightPrice: mockFlightPrice,
        driveCost: 428,
        driveDistance: 640,
      };

      render(
        <TravelOverrideModal
          isOpen={true}
          plannedTournament={plannedTournament}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );

      expect(screen.getByText(/fly/i)).toBeInTheDocument();
      expect(screen.getByText(/\$287/)).toBeInTheDocument();
    });

    it('shows drive option with distance and cost', () => {
      const plannedTournament: PlannedTournament = {
        tournament: mockTournament,
        registrationCost: 120,
        travelCost: 287,
        travelType: 'fly',
        isLocked: false,
        flightPrice: mockFlightPrice,
        driveCost: 428,
        driveDistance: 640,
      };

      render(
        <TravelOverrideModal
          isOpen={true}
          plannedTournament={plannedTournament}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );

      expect(screen.getByText(/drive/i)).toBeInTheDocument();
      expect(screen.getByText(/\$428/)).toBeInTheDocument();
      expect(screen.getByText(/640.*mi/i)).toBeInTheDocument();
    });

    it('does not render when isOpen is false', () => {
      const plannedTournament: PlannedTournament = {
        tournament: mockTournament,
        registrationCost: 120,
        travelCost: 287,
        travelType: 'fly',
        isLocked: false,
      };

      render(
        <TravelOverrideModal
          isOpen={false}
          plannedTournament={plannedTournament}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );

      expect(screen.queryByText(/change travel type/i)).not.toBeInTheDocument();
    });
  });

  describe('interactions', () => {
    it('calls onClose when cancel button clicked', async () => {
      const user = userEvent.setup();
      const plannedTournament: PlannedTournament = {
        tournament: mockTournament,
        registrationCost: 120,
        travelCost: 287,
        travelType: 'fly',
        isLocked: false,
      };

      render(
        <TravelOverrideModal
          isOpen={true}
          plannedTournament={plannedTournament}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );

      await user.click(screen.getByRole('button', { name: /cancel/i }));
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('calls onSave with drive option when selected and saved', async () => {
      const user = userEvent.setup();
      const plannedTournament: PlannedTournament = {
        tournament: mockTournament,
        registrationCost: 120,
        travelCost: 287,
        travelType: 'fly',
        isLocked: false,
        flightPrice: mockFlightPrice,
        driveCost: 428,
        driveDistance: 640,
      };

      render(
        <TravelOverrideModal
          isOpen={true}
          plannedTournament={plannedTournament}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );

      // Select drive option
      await user.click(screen.getByLabelText(/drive/i));

      // Save
      await user.click(screen.getByRole('button', { name: /save/i }));

      expect(mockOnSave).toHaveBeenCalledWith('drive', 428);
    });

    it('allows entering custom amount', async () => {
      const user = userEvent.setup();
      const plannedTournament: PlannedTournament = {
        tournament: mockTournament,
        registrationCost: 120,
        travelCost: 287,
        travelType: 'fly',
        isLocked: false,
        flightPrice: mockFlightPrice,
        driveCost: 428,
        driveDistance: 640,
      };

      render(
        <TravelOverrideModal
          isOpen={true}
          plannedTournament={plannedTournament}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );

      // Select custom option
      await user.click(screen.getByLabelText(/custom/i));

      // Enter amount
      const input = screen.getByPlaceholderText(/enter amount/i);
      await user.clear(input);
      await user.type(input, '350');

      // Save
      await user.click(screen.getByRole('button', { name: /save/i }));

      expect(mockOnSave).toHaveBeenCalledWith('fly', 350);
    });
  });
});
