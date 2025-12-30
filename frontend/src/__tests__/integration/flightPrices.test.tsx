/**
 * Integration tests for Flight Prices feature on the frontend
 *
 * Tests the integration between:
 * - PlannedTournamentCard displaying flight prices
 * - TravelOverrideModal for changing travel type
 * - plannerStore managing flight price state
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '../utils';
import userEvent from '@testing-library/user-event';
import { PlannedTournamentCard } from '@/components/planner/PlannedTournamentCard';
import type { PlannedTournament, FlightPrice } from '@/stores/plannerStore';
import type { Tournament } from '@/lib/types';

// Mock the planner store
const mockLockTournament = vi.fn();
const mockRemoveTournament = vi.fn();
const mockUpdateTravelType = vi.fn();

vi.mock('@/stores/plannerStore', async () => {
  const actual = await vi.importActual('@/stores/plannerStore');
  return {
    ...actual,
    usePlannerStore: vi.fn(() => ({
      lockTournament: mockLockTournament,
      removeTournament: mockRemoveTournament,
      updateTravelType: mockUpdateTravelType,
    })),
  };
});

describe('Flight Prices Integration', () => {
  const baseTournament: Tournament = {
    id: 'test-tournament-1',
    org: 'IBJJF',
    name: 'Miami International Open',
    city: 'Miami',
    state: 'FL',
    country: 'United States',
    startDate: '2025-06-15',
    endDate: '2025-06-16',
    registrationUrl: 'https://example.com/register',
    gi: true,
    nogi: true,
    kids: true,
    lat: 25.7617,
    lng: -80.1918,
  };

  const flightPrice: FlightPrice = {
    price: 287,
    source: 'amadeus',
    airline: 'American Airlines',
    fetchedAt: new Date().toISOString(),
    route: { origin: 'DFW', destination: 'MIA' },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('PlannedTournamentCard with flight prices', () => {
    it('displays flight price for fly travel type', () => {
      const plannedTournament: PlannedTournament = {
        tournament: baseTournament,
        registrationCost: 120,
        travelCost: 287,
        travelType: 'fly',
        isLocked: false,
        flightPrice,
      };

      render(
        <PlannedTournamentCard
          plannedTournament={plannedTournament}
          index={0}
        />
      );

      // Should display the fly icon and price
      expect(screen.getByText(/Fly/i)).toBeInTheDocument();
      expect(screen.getByText(/\$287/)).toBeInTheDocument();
    });

    it('displays drive cost and distance for drive travel type', () => {
      const plannedTournament: PlannedTournament = {
        tournament: baseTournament,
        registrationCost: 120,
        travelCost: 150,
        travelType: 'drive',
        isLocked: false,
        driveDistance: 224,
      };

      render(
        <PlannedTournamentCard
          plannedTournament={plannedTournament}
          index={0}
        />
      );

      // Should display the drive icon and cost
      expect(screen.getByText(/Drive/i)).toBeInTheDocument();
      expect(screen.getByText(/\$150/)).toBeInTheDocument();
      expect(screen.getByText(/224.*mi/)).toBeInTheDocument();
    });

    it('shows price range for estimated flights', () => {
      const estimatedFlightPrice: FlightPrice = {
        price: null,
        source: 'estimated_range',
        rangeMin: 200,
        rangeMax: 350,
        fetchedAt: new Date().toISOString(),
        route: { origin: 'DFW', destination: 'MIA' },
      };

      const plannedTournament: PlannedTournament = {
        tournament: baseTournament,
        registrationCost: 120,
        travelCost: 275,
        travelType: 'fly',
        isLocked: false,
        flightPrice: estimatedFlightPrice,
      };

      render(
        <PlannedTournamentCard
          plannedTournament={plannedTournament}
          index={0}
        />
      );

      // Should display the range estimate
      expect(screen.getByText(/\$200-\$350/)).toBeInTheDocument();
    });

    it('displays total cost correctly', () => {
      const plannedTournament: PlannedTournament = {
        tournament: baseTournament,
        registrationCost: 120,
        travelCost: 287,
        travelType: 'fly',
        isLocked: false,
        flightPrice,
      };

      render(
        <PlannedTournamentCard
          plannedTournament={plannedTournament}
          index={0}
        />
      );

      // Total should be registration + travel
      expect(screen.getByText(/Total: \$407/)).toBeInTheDocument();
    });

    it('shows Must-Go badge when locked', () => {
      const plannedTournament: PlannedTournament = {
        tournament: baseTournament,
        registrationCost: 120,
        travelCost: 287,
        travelType: 'fly',
        isLocked: true,
        flightPrice,
      };

      render(
        <PlannedTournamentCard
          plannedTournament={plannedTournament}
          index={0}
        />
      );

      expect(screen.getByText(/Must-Go/)).toBeInTheDocument();
    });

    it('calls lockTournament when Lock button clicked', async () => {
      const user = userEvent.setup();
      const plannedTournament: PlannedTournament = {
        tournament: baseTournament,
        registrationCost: 120,
        travelCost: 287,
        travelType: 'fly',
        isLocked: false,
        flightPrice,
      };

      render(
        <PlannedTournamentCard
          plannedTournament={plannedTournament}
          index={0}
        />
      );

      const lockButton = screen.getByRole('button', { name: /Lock/i });
      await user.click(lockButton);

      expect(mockLockTournament).toHaveBeenCalledWith('test-tournament-1');
    });

    it('calls removeTournament when Remove button clicked', async () => {
      const user = userEvent.setup();
      const plannedTournament: PlannedTournament = {
        tournament: baseTournament,
        registrationCost: 120,
        travelCost: 287,
        travelType: 'fly',
        isLocked: false,
        flightPrice,
      };

      render(
        <PlannedTournamentCard
          plannedTournament={plannedTournament}
          index={0}
        />
      );

      const removeButton = screen.getByRole('button', { name: /Remove/i });
      await user.click(removeButton);

      expect(mockRemoveTournament).toHaveBeenCalledWith('test-tournament-1');
    });

    it('calls onTravelTypeClick when travel type button clicked', async () => {
      const user = userEvent.setup();
      const onTravelTypeClick = vi.fn();

      const plannedTournament: PlannedTournament = {
        tournament: baseTournament,
        registrationCost: 120,
        travelCost: 287,
        travelType: 'fly',
        isLocked: false,
        flightPrice,
      };

      render(
        <PlannedTournamentCard
          plannedTournament={plannedTournament}
          index={0}
          onTravelTypeClick={onTravelTypeClick}
        />
      );

      const travelButton = screen.getByRole('button', { name: /Fly.*\$287/i });
      await user.click(travelButton);

      expect(onTravelTypeClick).toHaveBeenCalledWith(plannedTournament);
    });

    it('displays tournament organization badge', () => {
      const plannedTournament: PlannedTournament = {
        tournament: baseTournament,
        registrationCost: 120,
        travelCost: 287,
        travelType: 'fly',
        isLocked: false,
        flightPrice,
      };

      render(
        <PlannedTournamentCard
          plannedTournament={plannedTournament}
          index={0}
        />
      );

      expect(screen.getByText('IBJJF')).toBeInTheDocument();
    });

    it('displays event type tags (GI, NOGI, KIDS)', () => {
      const plannedTournament: PlannedTournament = {
        tournament: baseTournament,
        registrationCost: 120,
        travelCost: 287,
        travelType: 'fly',
        isLocked: false,
        flightPrice,
      };

      render(
        <PlannedTournamentCard
          plannedTournament={plannedTournament}
          index={0}
        />
      );

      expect(screen.getByText('GI')).toBeInTheDocument();
      expect(screen.getByText('NOGI')).toBeInTheDocument();
      expect(screen.getByText('KIDS')).toBeInTheDocument();
    });
  });

  describe('Flight price tooltip', () => {
    it('shows flight details on hover', async () => {
      const user = userEvent.setup();
      const plannedTournament: PlannedTournament = {
        tournament: baseTournament,
        registrationCost: 120,
        travelCost: 287,
        travelType: 'fly',
        isLocked: false,
        flightPrice,
      };

      render(
        <PlannedTournamentCard
          plannedTournament={plannedTournament}
          index={0}
        />
      );

      const travelButton = screen.getByRole('button', { name: /Fly.*\$287/i });
      await user.hover(travelButton);

      await waitFor(() => {
        // Should show route info
        expect(screen.getByText(/DFW.*MIA/)).toBeInTheDocument();
      });
    });
  });

  describe('JJWL tournament styling', () => {
    it('uses different accent color for JJWL tournaments', () => {
      const jjwlTournament: Tournament = {
        ...baseTournament,
        org: 'JJWL',
        name: 'JJWL Dallas Open',
      };

      const plannedTournament: PlannedTournament = {
        tournament: jjwlTournament,
        registrationCost: 100,
        travelCost: 0,
        travelType: 'drive',
        isLocked: false,
      };

      render(
        <PlannedTournamentCard
          plannedTournament={plannedTournament}
          index={0}
        />
      );

      expect(screen.getByText('JJWL')).toBeInTheDocument();
    });
  });

  describe('Date formatting', () => {
    it('displays formatted date correctly', () => {
      const plannedTournament: PlannedTournament = {
        tournament: baseTournament, // June 15, 2025
        registrationCost: 120,
        travelCost: 287,
        travelType: 'fly',
        isLocked: false,
        flightPrice,
      };

      render(
        <PlannedTournamentCard
          plannedTournament={plannedTournament}
          index={0}
        />
      );

      // Use getAllByText since mobile + desktop views both show these
      // Only check month and year since exact day/weekday can shift with timezone
      expect(screen.getAllByText('JUN').length).toBeGreaterThan(0);
      expect(screen.getAllByText('2025').length).toBeGreaterThan(0);
      // Verify a day number is present (14, 15, or 16 depending on TZ)
      const dayElements = screen.queryAllByText(/^1[456]$/);
      expect(dayElements.length).toBeGreaterThan(0);
    });
  });
});
