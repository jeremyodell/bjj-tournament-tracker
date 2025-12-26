import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { NormalizedTournament } from '../../fetchers/types.js';
import type { VenueItem } from '../../db/types.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockGetVenueByLookup = jest.fn<() => Promise<any>>();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockUpsertVenue = jest.fn<() => Promise<any>>();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockGeocodeVenue = jest.fn<() => Promise<any>>();

jest.mock('../../db/queries.js', () => ({
  getVenueByLookup: mockGetVenueByLookup,
  upsertVenue: mockUpsertVenue,
}));

jest.mock('../../services/geocoder.js', () => ({
  geocodeVenue: mockGeocodeVenue,
}));

// Import after mocks
import { enrichTournamentWithGeocode } from '../../services/venueEnrichment.js';

describe('enrichTournamentWithGeocode', () => {
  const baseTournament: NormalizedTournament = {
    org: 'IBJJF',
    externalId: '123',
    name: 'Test Open',
    city: 'Memphis',
    venue: 'Memphis Cook Convention Center',
    country: 'USA',
    startDate: '2025-03-15',
    endDate: '2025-03-16',
    gi: true,
    nogi: false,
    kids: true,
    registrationUrl: null,
    bannerUrl: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses cached venue when available', async () => {
    const mockVenue: VenueItem = {
      PK: 'VENUE#abc',
      SK: 'META',
      GSI1PK: 'VENUE_LOOKUP',
      GSI1SK: 'memphis cook convention center#memphis',
      venueId: 'abc',
      name: 'Memphis Cook Convention Center',
      city: 'Memphis',
      country: 'USA',
      lat: 35.15,
      lng: -90.05,
      geocodeConfidence: 'high',
      manualOverride: false,
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
    };

    mockGetVenueByLookup.mockResolvedValue(mockVenue);

    const result = await enrichTournamentWithGeocode(baseTournament);

    expect(mockGeocodeVenue).not.toHaveBeenCalled();
    expect(result.lat).toBe(35.15);
    expect(result.lng).toBe(-90.05);
    expect(result.venueId).toBe('abc');
  });

  it('geocodes and caches new venue', async () => {
    mockGetVenueByLookup.mockResolvedValue(null);
    mockGeocodeVenue.mockResolvedValue({
      lat: 35.15,
      lng: -90.05,
      confidence: 'high',
      formattedAddress: 'Memphis, TN, USA',
    });
    mockUpsertVenue.mockResolvedValue(undefined);

    const result = await enrichTournamentWithGeocode(baseTournament);

    expect(mockGeocodeVenue).toHaveBeenCalledWith(
      'Memphis Cook Convention Center',
      'Memphis',
      'USA'
    );
    expect(mockUpsertVenue).toHaveBeenCalled();
    expect(result.lat).toBe(35.15);
    expect(result.geocodeConfidence).toBe('high');
  });

  it('handles geocode failure gracefully', async () => {
    mockGetVenueByLookup.mockResolvedValue(null);
    mockGeocodeVenue.mockResolvedValue(null);

    const result = await enrichTournamentWithGeocode(baseTournament);

    expect(result.lat).toBeNull();
    expect(result.lng).toBeNull();
    expect(result.geocodeConfidence).toBe('failed');
  });

  it('uses city as venue fallback when venue is null', async () => {
    mockGetVenueByLookup.mockResolvedValue(null);
    mockGeocodeVenue.mockResolvedValue({
      lat: 35.15,
      lng: -90.05,
      confidence: 'low',
      formattedAddress: 'Memphis, TN, USA',
    });
    mockUpsertVenue.mockResolvedValue(undefined);

    const tournamentNoVenue = { ...baseTournament, venue: null };
    await enrichTournamentWithGeocode(tournamentNoVenue);

    expect(mockGeocodeVenue).toHaveBeenCalledWith(
      'Memphis', // city used as fallback
      'Memphis',
      'USA'
    );
  });
});
