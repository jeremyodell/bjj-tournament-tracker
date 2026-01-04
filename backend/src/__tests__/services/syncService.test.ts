import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { syncAllTournaments } from '../../services/syncService.js';
import * as ibjjfFetcher from '../../fetchers/ibjjfFetcher.js';
import * as jjwlFetcher from '../../fetchers/jjwlFetcher.js';
import * as gymSyncService from '../../services/gymSyncService.js';
import type { NormalizedTournament } from '../../fetchers/types.js';

// Mock the fetchers
jest.mock('../../fetchers/ibjjfFetcher.js');
jest.mock('../../fetchers/jjwlFetcher.js');
jest.mock('../../services/gymSyncService.js');

// Mock enrichment to pass through
jest.mock('../../services/venueEnrichment.js', () => ({
  enrichTournamentsWithGeocode: jest.fn((tournaments: NormalizedTournament[]) =>
    Promise.resolve({
      tournaments: tournaments.map((t) => ({ ...t, lat: null, lng: null })),
      stats: { cached: 0, geocoded: 0, failed: 0, lowConfidence: 0 },
    })
  ),
}));

const mockTournament: NormalizedTournament = {
  org: 'IBJJF',
  externalId: '123',
  name: 'Test Tournament',
  city: 'Test City',
  venue: null,
  country: null,
  startDate: '2025-03-15',
  endDate: '2025-03-17',
  gi: true,
  nogi: false,
  kids: false,
  registrationUrl: null,
  bannerUrl: null,
};

describe('syncAllTournaments', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default gym sync mock for all tests
    jest.spyOn(gymSyncService, 'syncJJWLGyms').mockResolvedValue({ fetched: 0, saved: 0 });
  });

  it('fetches from both sources', async () => {
    const ibjjfMock = jest.spyOn(ibjjfFetcher, 'fetchIBJJFTournaments');
    const jjwlMock = jest.spyOn(jjwlFetcher, 'fetchJJWLTournaments');

    ibjjfMock.mockResolvedValue([mockTournament]);
    jjwlMock.mockResolvedValue([{ ...mockTournament, org: 'JJWL' as const }]);

    const result = await syncAllTournaments({ dryRun: true });

    expect(ibjjfMock).toHaveBeenCalled();
    expect(jjwlMock).toHaveBeenCalled();
    expect(result.ibjjf.fetched).toBe(1);
    expect(result.jjwl.fetched).toBe(1);
  });

  it('continues if IBJJF fails', async () => {
    const ibjjfMock = jest.spyOn(ibjjfFetcher, 'fetchIBJJFTournaments');
    const jjwlMock = jest.spyOn(jjwlFetcher, 'fetchJJWLTournaments');

    ibjjfMock.mockRejectedValue(new Error('API Error'));
    jjwlMock.mockResolvedValue([{ ...mockTournament, org: 'JJWL' as const }]);

    const result = await syncAllTournaments({ dryRun: true });

    expect(result.ibjjf.error).toBe('API Error');
    expect(result.jjwl.fetched).toBe(1);
  });

  it('continues if JJWL fails', async () => {
    const ibjjfMock = jest.spyOn(ibjjfFetcher, 'fetchIBJJFTournaments');
    const jjwlMock = jest.spyOn(jjwlFetcher, 'fetchJJWLTournaments');

    ibjjfMock.mockResolvedValue([mockTournament]);
    jjwlMock.mockRejectedValue(new Error('API Error'));

    const result = await syncAllTournaments({ dryRun: true });

    expect(result.ibjjf.fetched).toBe(1);
    expect(result.jjwl.error).toBe('API Error');
  });

  it('syncs gyms in parallel with tournaments', async () => {
    const ibjjfMock = jest.spyOn(ibjjfFetcher, 'fetchIBJJFTournaments');
    const jjwlMock = jest.spyOn(jjwlFetcher, 'fetchJJWLTournaments');
    const gymMock = jest.spyOn(gymSyncService, 'syncJJWLGyms');

    ibjjfMock.mockResolvedValue([mockTournament]);
    jjwlMock.mockResolvedValue([{ ...mockTournament, org: 'JJWL' as const }]);
    gymMock.mockResolvedValue({ fetched: 100, saved: 100 });

    const result = await syncAllTournaments({ dryRun: true });

    expect(gymMock).toHaveBeenCalled();
    expect(result.gyms).toBeDefined();
    expect(result.gyms?.fetched).toBe(100);
    expect(result.gyms?.saved).toBe(100);
  });

  it('continues tournament sync if gym sync fails', async () => {
    const ibjjfMock = jest.spyOn(ibjjfFetcher, 'fetchIBJJFTournaments');
    const jjwlMock = jest.spyOn(jjwlFetcher, 'fetchJJWLTournaments');
    const gymMock = jest.spyOn(gymSyncService, 'syncJJWLGyms');

    ibjjfMock.mockResolvedValue([mockTournament]);
    jjwlMock.mockResolvedValue([{ ...mockTournament, org: 'JJWL' as const }]);
    gymMock.mockResolvedValue({ fetched: 0, saved: 0, error: 'Gym API Error' });

    const result = await syncAllTournaments({ dryRun: true });

    // Tournament sync should still succeed
    expect(result.ibjjf.fetched).toBe(1);
    expect(result.jjwl.fetched).toBe(1);
    // Gym error should be captured but not break sync
    expect(result.gyms?.error).toBe('Gym API Error');
  });
});
