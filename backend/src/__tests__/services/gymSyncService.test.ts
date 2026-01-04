import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock the dependencies before importing the service
jest.mock('../../fetchers/jjwlGymFetcher.js');
jest.mock('../../fetchers/jjwlRosterFetcher.js');
jest.mock('../../fetchers/ibjjfGymFetcher.js');
jest.mock('../../db/gymQueries.js');
jest.mock('../../db/queries.js');

import {
  syncJJWLGyms,
  syncIBJJFGyms,
  getActiveGymIds,
  getUpcomingTournaments,
  syncGymRoster,
} from '../../services/gymSyncService.js';
import * as jjwlGymFetcher from '../../fetchers/jjwlGymFetcher.js';
import * as jjwlRosterFetcher from '../../fetchers/jjwlRosterFetcher.js';
import * as ibjjfGymFetcher from '../../fetchers/ibjjfGymFetcher.js';
import * as gymQueries from '../../db/gymQueries.js';
import * as queries from '../../db/queries.js';
import type { NormalizedGym, IBJJFNormalizedGym } from '../../fetchers/types.js';
import type { TournamentItem, GymSyncMetaItem } from '../../db/types.js';

describe('gymSyncService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('syncJJWLGyms', () => {
    it('fetches and saves gyms successfully', async () => {
      const mockGyms: NormalizedGym[] = [
        { org: 'JJWL', externalId: '1', name: 'Gym A' },
        { org: 'JJWL', externalId: '2', name: 'Gym B' },
      ];

      const fetchMock = jest.spyOn(jjwlGymFetcher, 'fetchJJWLGyms');
      const batchUpsertMock = jest.spyOn(gymQueries, 'batchUpsertGyms');

      fetchMock.mockResolvedValue(mockGyms);
      batchUpsertMock.mockResolvedValue(2);

      const result = await syncJJWLGyms();

      expect(fetchMock).toHaveBeenCalled();
      expect(batchUpsertMock).toHaveBeenCalledWith(mockGyms);
      expect(result.fetched).toBe(2);
      expect(result.saved).toBe(2);
      expect(result.error).toBeUndefined();
    });

    it('handles fetch errors gracefully', async () => {
      const fetchMock = jest.spyOn(jjwlGymFetcher, 'fetchJJWLGyms');
      fetchMock.mockRejectedValue(new Error('Network error'));

      const result = await syncJJWLGyms();

      expect(result.fetched).toBe(0);
      expect(result.saved).toBe(0);
      expect(result.error).toBe('Network error');
    });

    it('handles save errors gracefully', async () => {
      const mockGyms: NormalizedGym[] = [
        { org: 'JJWL', externalId: '1', name: 'Gym A' },
      ];

      const fetchMock = jest.spyOn(jjwlGymFetcher, 'fetchJJWLGyms');
      const batchUpsertMock = jest.spyOn(gymQueries, 'batchUpsertGyms');

      fetchMock.mockResolvedValue(mockGyms);
      batchUpsertMock.mockRejectedValue(new Error('DynamoDB error'));

      const result = await syncJJWLGyms();

      expect(result.fetched).toBe(0);
      expect(result.saved).toBe(0);
      expect(result.error).toBe('DynamoDB error');
    });

    it('handles empty gym list', async () => {
      const fetchMock = jest.spyOn(jjwlGymFetcher, 'fetchJJWLGyms');
      const batchUpsertMock = jest.spyOn(gymQueries, 'batchUpsertGyms');

      fetchMock.mockResolvedValue([]);
      batchUpsertMock.mockResolvedValue(0);

      const result = await syncJJWLGyms();

      expect(result.fetched).toBe(0);
      expect(result.saved).toBe(0);
      expect(result.error).toBeUndefined();
    });
  });

  describe('getActiveGymIds', () => {
    it('returns empty Map (MVP placeholder)', async () => {
      const result = await getActiveGymIds();

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
    });
  });

  describe('getUpcomingTournaments', () => {
    it('returns tournaments within the specified days', async () => {
      const mockTournaments: TournamentItem[] = [
        {
          PK: 'TOURN#JJWL#123',
          SK: 'META',
          GSI1PK: 'TOURNAMENTS',
          GSI1SK: '2026-02-01#JJWL#123',
          org: 'JJWL',
          externalId: '123',
          name: 'Test Tournament',
          city: 'Dallas',
          venue: 'Convention Center',
          country: 'USA',
          startDate: '2026-02-01',
          endDate: '2026-02-02',
          gi: true,
          nogi: true,
          kids: true,
          registrationUrl: null,
          bannerUrl: null,
          lat: null,
          lng: null,
          venueId: null,
          geocodeConfidence: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ];

      const queryMock = jest.spyOn(queries, 'queryTournaments');
      queryMock.mockResolvedValue({ items: mockTournaments });

      const result = await getUpcomingTournaments(60);

      expect(queryMock).toHaveBeenCalled();
      expect(result.tournaments).toHaveLength(1);
      expect(result.tournaments[0].name).toBe('Test Tournament');
      expect(result.error).toBeUndefined();
    });

    it('uses default of 60 days if not specified', async () => {
      const queryMock = jest.spyOn(queries, 'queryTournaments');
      queryMock.mockResolvedValue({ items: [] });

      await getUpcomingTournaments();

      expect(queryMock).toHaveBeenCalledWith(
        expect.objectContaining({
          startAfter: expect.any(String),
          startBefore: expect.any(String),
        })
      );
    });

    it('handles query errors gracefully', async () => {
      const queryMock = jest.spyOn(queries, 'queryTournaments');
      queryMock.mockRejectedValue(new Error('DynamoDB unavailable'));

      const result = await getUpcomingTournaments();

      expect(result.tournaments).toHaveLength(0);
      expect(result.error).toBe('DynamoDB unavailable');
    });
  });

  describe('syncGymRoster', () => {
    it('fetches and caches roster successfully', async () => {
      const mockAthletes = [
        { name: 'John Doe', belt: 'Blue', ageDiv: 'Adult', weight: 'Light', gender: 'Male' },
      ];
      const mockGym = { org: 'JJWL' as const, externalId: '5713', name: 'Pablo Silva BJJ' };

      const getGymMock = jest.spyOn(gymQueries, 'getSourceGym');
      const fetchRosterMock = jest.spyOn(jjwlRosterFetcher, 'fetchJJWLRoster');
      const upsertRosterMock = jest.spyOn(gymQueries, 'upsertGymRoster');

      getGymMock.mockResolvedValue({
        ...mockGym,
        PK: 'SRCGYM#JJWL#5713',
        SK: 'META',
        GSI1PK: 'GYMS',
        GSI1SK: 'JJWL#Pablo Silva BJJ',
        masterGymId: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      });
      fetchRosterMock.mockResolvedValue(mockAthletes);
      upsertRosterMock.mockResolvedValue(undefined);

      const result = await syncGymRoster('JJWL', '850', '5713');

      expect(fetchRosterMock).toHaveBeenCalledWith('850', '5713');
      expect(upsertRosterMock).toHaveBeenCalledWith(
        'JJWL',
        '850',
        '5713',
        'Pablo Silva BJJ',
        mockAthletes
      );
      expect(result.success).toBe(true);
      expect(result.athleteCount).toBe(1);
      expect(result.error).toBeUndefined();
    });

    it('uses Unknown Gym if gym not found in database', async () => {
      const mockAthletes = [
        { name: 'Jane Smith', belt: 'Purple', ageDiv: 'Adult', weight: 'Feather', gender: 'Female' },
      ];

      const getGymMock = jest.spyOn(gymQueries, 'getSourceGym');
      const fetchRosterMock = jest.spyOn(jjwlRosterFetcher, 'fetchJJWLRoster');
      const upsertRosterMock = jest.spyOn(gymQueries, 'upsertGymRoster');

      getGymMock.mockResolvedValue(null);
      fetchRosterMock.mockResolvedValue(mockAthletes);
      upsertRosterMock.mockResolvedValue(undefined);

      const result = await syncGymRoster('JJWL', '850', '9999');

      expect(upsertRosterMock).toHaveBeenCalledWith(
        'JJWL',
        '850',
        '9999',
        'Unknown Gym',
        mockAthletes
      );
      expect(result.success).toBe(true);
    });

    it('returns error for unsupported org', async () => {
      const result = await syncGymRoster('IBJJF', '123', '456');

      expect(result.success).toBe(false);
      expect(result.athleteCount).toBe(0);
      expect(result.error).toBe('Only JJWL supported currently');
    });

    it('handles fetch errors gracefully', async () => {
      const getGymMock = jest.spyOn(gymQueries, 'getSourceGym');
      const fetchRosterMock = jest.spyOn(jjwlRosterFetcher, 'fetchJJWLRoster');

      getGymMock.mockResolvedValue(null);
      fetchRosterMock.mockRejectedValue(new Error('API timeout'));

      const result = await syncGymRoster('JJWL', '850', '5713');

      expect(result.success).toBe(false);
      expect(result.athleteCount).toBe(0);
      expect(result.error).toBe('API timeout');
    });

    it('handles upsert errors gracefully', async () => {
      const mockAthletes = [
        { name: 'John Doe', belt: 'Blue', ageDiv: 'Adult', weight: 'Light', gender: 'Male' },
      ];

      const getGymMock = jest.spyOn(gymQueries, 'getSourceGym');
      const fetchRosterMock = jest.spyOn(jjwlRosterFetcher, 'fetchJJWLRoster');
      const upsertRosterMock = jest.spyOn(gymQueries, 'upsertGymRoster');

      getGymMock.mockResolvedValue(null);
      fetchRosterMock.mockResolvedValue(mockAthletes);
      upsertRosterMock.mockRejectedValue(new Error('DynamoDB write failed'));

      const result = await syncGymRoster('JJWL', '850', '5713');

      expect(result.success).toBe(false);
      expect(result.athleteCount).toBe(0);
      expect(result.error).toBe('DynamoDB write failed');
    });

    it('handles empty roster', async () => {
      const getGymMock = jest.spyOn(gymQueries, 'getSourceGym');
      const fetchRosterMock = jest.spyOn(jjwlRosterFetcher, 'fetchJJWLRoster');
      const upsertRosterMock = jest.spyOn(gymQueries, 'upsertGymRoster');

      getGymMock.mockResolvedValue({
        PK: 'SRCGYM#JJWL#5713',
        SK: 'META',
        GSI1PK: 'GYMS',
        GSI1SK: 'JJWL#Test Gym',
        org: 'JJWL',
        externalId: '5713',
        name: 'Test Gym',
        masterGymId: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      });
      fetchRosterMock.mockResolvedValue([]);
      upsertRosterMock.mockResolvedValue(undefined);

      const result = await syncGymRoster('JJWL', '850', '5713');

      expect(result.success).toBe(true);
      expect(result.athleteCount).toBe(0);
    });
  });

  describe('syncIBJJFGyms', () => {
    const mockSyncMeta: GymSyncMetaItem = {
      PK: 'GYMSYNC#IBJJF',
      SK: 'META',
      org: 'IBJJF',
      totalRecords: 8573,
      lastSyncAt: '2026-01-01T00:00:00Z',
      lastChangeAt: '2026-01-01T00:00:00Z',
    };

    it('should skip sync when totalRecords unchanged', async () => {
      const fetchCountMock = jest.spyOn(ibjjfGymFetcher, 'fetchIBJJFGymCount');
      const fetchAllMock = jest.spyOn(ibjjfGymFetcher, 'fetchAllIBJJFGyms');
      const getSyncMetaMock = jest.spyOn(gymQueries, 'getGymSyncMeta');

      fetchCountMock.mockResolvedValue(8573);
      getSyncMetaMock.mockResolvedValue(mockSyncMeta);

      const result = await syncIBJJFGyms();

      expect(result.skipped).toBe(true);
      expect(result.fetched).toBe(0);
      expect(result.saved).toBe(0);
      expect(fetchAllMock).not.toHaveBeenCalled();
    });

    it('should perform full sync when totalRecords changed', async () => {
      const mockGyms: IBJJFNormalizedGym[] = [
        { org: 'IBJJF', externalId: '1', name: 'Gym 1' },
        { org: 'IBJJF', externalId: '2', name: 'Gym 2' },
      ];

      const fetchCountMock = jest.spyOn(ibjjfGymFetcher, 'fetchIBJJFGymCount');
      const fetchAllMock = jest.spyOn(ibjjfGymFetcher, 'fetchAllIBJJFGyms');
      const getSyncMetaMock = jest.spyOn(gymQueries, 'getGymSyncMeta');
      const batchUpsertMock = jest.spyOn(gymQueries, 'batchUpsertGyms');
      const updateSyncMetaMock = jest.spyOn(gymQueries, 'updateGymSyncMeta');

      fetchCountMock.mockResolvedValue(8600); // Changed from 8573
      getSyncMetaMock.mockResolvedValue(mockSyncMeta);
      fetchAllMock.mockResolvedValue(mockGyms);
      batchUpsertMock.mockResolvedValue(2);
      updateSyncMetaMock.mockResolvedValue(undefined);

      const result = await syncIBJJFGyms();

      expect(result.skipped).toBe(false);
      expect(result.fetched).toBe(2);
      expect(result.saved).toBe(2);
      expect(fetchAllMock).toHaveBeenCalled();
      expect(updateSyncMetaMock).toHaveBeenCalledWith('IBJJF', 8600);
    });

    it('should perform full sync on first run (no previous meta)', async () => {
      const mockGyms: IBJJFNormalizedGym[] = [
        { org: 'IBJJF', externalId: '1', name: 'Gym 1' },
      ];

      const fetchCountMock = jest.spyOn(ibjjfGymFetcher, 'fetchIBJJFGymCount');
      const fetchAllMock = jest.spyOn(ibjjfGymFetcher, 'fetchAllIBJJFGyms');
      const getSyncMetaMock = jest.spyOn(gymQueries, 'getGymSyncMeta');
      const batchUpsertMock = jest.spyOn(gymQueries, 'batchUpsertGyms');
      const updateSyncMetaMock = jest.spyOn(gymQueries, 'updateGymSyncMeta');

      fetchCountMock.mockResolvedValue(8573);
      getSyncMetaMock.mockResolvedValue(null); // First sync
      fetchAllMock.mockResolvedValue(mockGyms);
      batchUpsertMock.mockResolvedValue(1);
      updateSyncMetaMock.mockResolvedValue(undefined);

      const result = await syncIBJJFGyms();

      expect(result.skipped).toBe(false);
      expect(fetchAllMock).toHaveBeenCalled();
    });

    it('should force sync even when totalRecords unchanged', async () => {
      const mockGyms: IBJJFNormalizedGym[] = [];

      const fetchCountMock = jest.spyOn(ibjjfGymFetcher, 'fetchIBJJFGymCount');
      const fetchAllMock = jest.spyOn(ibjjfGymFetcher, 'fetchAllIBJJFGyms');
      const getSyncMetaMock = jest.spyOn(gymQueries, 'getGymSyncMeta');
      const batchUpsertMock = jest.spyOn(gymQueries, 'batchUpsertGyms');
      const updateSyncMetaMock = jest.spyOn(gymQueries, 'updateGymSyncMeta');

      fetchCountMock.mockResolvedValue(8573); // Same as meta
      getSyncMetaMock.mockResolvedValue(mockSyncMeta);
      fetchAllMock.mockResolvedValue(mockGyms);
      batchUpsertMock.mockResolvedValue(0);
      updateSyncMetaMock.mockResolvedValue(undefined);

      const result = await syncIBJJFGyms({ forceSync: true });

      expect(result.skipped).toBe(false);
      expect(fetchAllMock).toHaveBeenCalled();
    });

    it('should return error on API failure', async () => {
      const fetchCountMock = jest.spyOn(ibjjfGymFetcher, 'fetchIBJJFGymCount');

      fetchCountMock.mockRejectedValue(new Error('API down'));

      const result = await syncIBJJFGyms();

      expect(result.error).toBe('API down');
      expect(result.skipped).toBe(false);
      expect(result.fetched).toBe(0);
      expect(result.saved).toBe(0);
    });

    it('should include duration in result', async () => {
      const fetchCountMock = jest.spyOn(ibjjfGymFetcher, 'fetchIBJJFGymCount');
      const getSyncMetaMock = jest.spyOn(gymQueries, 'getGymSyncMeta');

      fetchCountMock.mockResolvedValue(8573);
      getSyncMetaMock.mockResolvedValue(mockSyncMeta);

      const result = await syncIBJJFGyms();

      expect(result.duration).toBeDefined();
      expect(typeof result.duration).toBe('number');
    });
  });
});
