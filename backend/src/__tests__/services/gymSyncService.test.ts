import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock the dependencies before importing the service
jest.mock('../../fetchers/jjwlGymFetcher.js');
jest.mock('../../fetchers/jjwlRosterFetcher.js');
jest.mock('../../fetchers/ibjjfGymFetcher.js');
jest.mock('../../db/gymQueries.js');
jest.mock('../../db/queries.js');
jest.mock('../../services/gymMatchingService.js');

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
import * as gymMatchingService from '../../services/gymMatchingService.js';
import type { NormalizedGym, IBJJFNormalizedGym } from '../../fetchers/types.js';
import type { TournamentItem, GymSyncMetaItem, SourceGymItem } from '../../db/types.js';

describe('gymSyncService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('syncJJWLGyms', () => {
    const createMockSourceGym = (gym: NormalizedGym, masterGymId: string | null = null): SourceGymItem => ({
      PK: `SRCGYM#${gym.org}#${gym.externalId}`,
      SK: 'META',
      GSI1PK: 'GYMS',
      GSI1SK: `${gym.org}#${gym.name}`,
      org: gym.org,
      externalId: gym.externalId,
      name: gym.name,
      masterGymId,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    });

    it('fetches, saves, and runs matching for gyms successfully', async () => {
      const mockGyms: NormalizedGym[] = [
        { org: 'JJWL', externalId: '1', name: 'Gym A' },
        { org: 'JJWL', externalId: '2', name: 'Gym B' },
      ];

      const fetchMock = jest.spyOn(jjwlGymFetcher, 'fetchJJWLGyms');
      const batchUpsertMock = jest.spyOn(gymQueries, 'batchUpsertGyms');
      const listUSIBJJFGymsSpy = jest.spyOn(gymQueries as any, 'listUSIBJJFGyms');
      const getSourceGymMock = jest.spyOn(gymQueries, 'getSourceGym');
      const processMatchesMock = jest.spyOn(gymMatchingService, 'processGymMatches');

      fetchMock.mockResolvedValue(mockGyms);
      batchUpsertMock.mockResolvedValue(2);
      listUSIBJJFGymsSpy.mockResolvedValue([]);
      // Return unlinked gyms (masterGymId = null)
      getSourceGymMock.mockImplementation(async (_org, externalId) => {
        const gym = mockGyms.find(g => g.externalId === externalId);
        return gym ? createMockSourceGym(gym) : null;
      });
      processMatchesMock.mockResolvedValue({ autoLinked: 0, pendingCreated: 1 });

      const result = await syncJJWLGyms();

      expect(fetchMock).toHaveBeenCalled();
      expect(batchUpsertMock).toHaveBeenCalledWith(mockGyms);
      expect(processMatchesMock).toHaveBeenCalledTimes(2);
      expect(result.fetched).toBe(2);
      expect(result.saved).toBe(2);
      expect(result.matching).toEqual({
        processed: 2,
        autoLinked: 0,
        pendingCreated: 2,
      });
      expect(result.error).toBeUndefined();
    });

    it('skips matching for gyms already linked to master', async () => {
      const mockGyms: NormalizedGym[] = [
        { org: 'JJWL', externalId: '1', name: 'Gym A' },
      ];

      const fetchMock = jest.spyOn(jjwlGymFetcher, 'fetchJJWLGyms');
      const batchUpsertMock = jest.spyOn(gymQueries, 'batchUpsertGyms');
      const listUSIBJJFGymsSpy = jest.spyOn(gymQueries as any, 'listUSIBJJFGyms');
      const getSourceGymMock = jest.spyOn(gymQueries, 'getSourceGym');
      const processMatchesMock = jest.spyOn(gymMatchingService, 'processGymMatches');

      fetchMock.mockResolvedValue(mockGyms);
      batchUpsertMock.mockResolvedValue(1);
      listUSIBJJFGymsSpy.mockResolvedValue([]);
      // Return linked gym (masterGymId is set)
      getSourceGymMock.mockResolvedValue(createMockSourceGym(mockGyms[0], 'master-123'));

      const result = await syncJJWLGyms();

      expect(processMatchesMock).not.toHaveBeenCalled();
      expect(result.matching).toEqual({
        processed: 0,
        autoLinked: 0,
        pendingCreated: 0,
      });
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
      const listUSIBJJFGymsSpy = jest.spyOn(gymQueries as any, 'listUSIBJJFGyms');

      fetchMock.mockResolvedValue([]);
      batchUpsertMock.mockResolvedValue(0);
      listUSIBJJFGymsSpy.mockResolvedValue([]);

      const result = await syncJJWLGyms();

      expect(result.fetched).toBe(0);
      expect(result.saved).toBe(0);
      expect(result.error).toBeUndefined();
    });
  });

  describe('syncJJWLGyms with caching optimization', () => {
    const createMockSourceGym = (gym: NormalizedGym, masterGymId: string | null = null): SourceGymItem => ({
      PK: `SRCGYM#${gym.org}#${gym.externalId}`,
      SK: 'META',
      GSI1PK: 'GYMS',
      GSI1SK: `${gym.org}#${gym.name}`,
      org: gym.org,
      externalId: gym.externalId,
      name: gym.name,
      masterGymId,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    });

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should load US IBJJF gyms only once (caching)', async () => {
      const mockJJWLGyms: NormalizedGym[] = [
        { org: 'JJWL', externalId: 'jjwl-1', name: 'Test Gym 1' },
        { org: 'JJWL', externalId: 'jjwl-2', name: 'Test Gym 2' },
      ];

      const mockUSIBJJFGyms: SourceGymItem[] = [
        {
          PK: 'SRCGYM#IBJJF#us-1',
          SK: 'META',
          GSI1PK: 'GYMS',
          GSI1SK: 'IBJJF#US Gym 1',
          org: 'IBJJF',
          externalId: 'us-1',
          name: 'US Gym 1',
          city: 'Austin',
          countryCode: 'US',
          masterGymId: null,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
      ];

      const fetchMock = jest.spyOn(jjwlGymFetcher, 'fetchJJWLGyms');
      const batchUpsertMock = jest.spyOn(gymQueries, 'batchUpsertGyms');
      // Mock the function that will be added for caching
      const listUSIBJJFGymsSpy = jest.spyOn(gymQueries as any, 'listUSIBJJFGyms');
      const getSourceGymMock = jest.spyOn(gymQueries, 'getSourceGym');
      const processMatchesMock = jest.spyOn(gymMatchingService, 'processGymMatches');

      fetchMock.mockResolvedValue(mockJJWLGyms);
      batchUpsertMock.mockResolvedValue(2);
      listUSIBJJFGymsSpy.mockResolvedValue(mockUSIBJJFGyms);
      getSourceGymMock.mockImplementation(async (_org, externalId) => {
        const gym = mockJJWLGyms.find(g => g.externalId === externalId);
        return gym ? createMockSourceGym(gym) : null;
      });
      processMatchesMock.mockResolvedValue({ autoLinked: 0, pendingCreated: 1 });

      await syncJJWLGyms();

      // KEY ASSERTION: listUSIBJJFGyms called ONCE, not once per JJWL gym
      // This test will fail until caching is implemented
      expect(listUSIBJJFGymsSpy).toHaveBeenCalledTimes(1);
      expect(processMatchesMock).toHaveBeenCalledTimes(2); // Called for each JJWL gym
    });

    it('should auto-link high-confidence matches and create master gyms', async () => {
      const mockJJWLGyms: NormalizedGym[] = [
        { org: 'JJWL', externalId: 'jjwl-1', name: 'Gracie Barra Austin' },
      ];

      const fetchMock = jest.spyOn(jjwlGymFetcher, 'fetchJJWLGyms');
      const batchUpsertMock = jest.spyOn(gymQueries, 'batchUpsertGyms');
      const listUSIBJJFGymsSpy = jest.spyOn(gymQueries as any, 'listUSIBJJFGyms');
      const getSourceGymMock = jest.spyOn(gymQueries, 'getSourceGym');
      const processMatchesMock = jest.spyOn(gymMatchingService, 'processGymMatches');

      fetchMock.mockResolvedValue(mockJJWLGyms);
      batchUpsertMock.mockResolvedValue(1);
      listUSIBJJFGymsSpy.mockResolvedValue([]);
      getSourceGymMock.mockResolvedValue(createMockSourceGym(mockJJWLGyms[0]));
      // Mock high-confidence match that creates master gym
      processMatchesMock.mockResolvedValue({ autoLinked: 1, pendingCreated: 0 });

      const result = await syncJJWLGyms();

      expect(result.matching).toEqual({
        processed: 1,
        autoLinked: 1,
        pendingCreated: 0,
      });
      expect(processMatchesMock).toHaveBeenCalledTimes(1);
    });

    it('should create pending matches for medium-confidence matches', async () => {
      const mockJJWLGyms: NormalizedGym[] = [
        { org: 'JJWL', externalId: 'jjwl-1', name: 'Alliance BJJ Dallas' },
        { org: 'JJWL', externalId: 'jjwl-2', name: 'Atos Jiu-Jitsu Houston' },
      ];

      const fetchMock = jest.spyOn(jjwlGymFetcher, 'fetchJJWLGyms');
      const batchUpsertMock = jest.spyOn(gymQueries, 'batchUpsertGyms');
      const listUSIBJJFGymsSpy = jest.spyOn(gymQueries as any, 'listUSIBJJFGyms');
      const getSourceGymMock = jest.spyOn(gymQueries, 'getSourceGym');
      const processMatchesMock = jest.spyOn(gymMatchingService, 'processGymMatches');

      fetchMock.mockResolvedValue(mockJJWLGyms);
      batchUpsertMock.mockResolvedValue(2);
      listUSIBJJFGymsSpy.mockResolvedValue([]);
      getSourceGymMock.mockImplementation(async (_org, externalId) => {
        const gym = mockJJWLGyms.find(g => g.externalId === externalId);
        return gym ? createMockSourceGym(gym) : null;
      });
      // Mock medium-confidence matches that create pending matches
      processMatchesMock.mockResolvedValue({ autoLinked: 0, pendingCreated: 1 });

      const result = await syncJJWLGyms();

      expect(result.matching).toEqual({
        processed: 2,
        autoLinked: 0,
        pendingCreated: 2, // One pending match per gym
      });
      expect(processMatchesMock).toHaveBeenCalledTimes(2);
    });

    it('should skip matching for gyms already linked to master', async () => {
      const mockJJWLGyms: NormalizedGym[] = [
        { org: 'JJWL', externalId: 'jjwl-1', name: 'Linked Gym 1' },
        { org: 'JJWL', externalId: 'jjwl-2', name: 'Unlinked Gym 2' },
      ];

      const fetchMock = jest.spyOn(jjwlGymFetcher, 'fetchJJWLGyms');
      const batchUpsertMock = jest.spyOn(gymQueries, 'batchUpsertGyms');
      const listUSIBJJFGymsSpy = jest.spyOn(gymQueries as any, 'listUSIBJJFGyms');
      const getSourceGymMock = jest.spyOn(gymQueries, 'getSourceGym');
      const processMatchesMock = jest.spyOn(gymMatchingService, 'processGymMatches');

      fetchMock.mockResolvedValue(mockJJWLGyms);
      batchUpsertMock.mockResolvedValue(2);
      listUSIBJJFGymsSpy.mockResolvedValue([]);
      getSourceGymMock.mockImplementation(async (_org, externalId) => {
        // First gym is linked, second is not
        const gym = mockJJWLGyms.find(g => g.externalId === externalId);
        if (!gym) return null;
        return createMockSourceGym(gym, externalId === 'jjwl-1' ? 'master-123' : null);
      });
      processMatchesMock.mockResolvedValue({ autoLinked: 0, pendingCreated: 1 });

      const result = await syncJJWLGyms();

      // Only called once for the unlinked gym
      expect(processMatchesMock).toHaveBeenCalledTimes(1);
      expect(result.matching).toEqual({
        processed: 1,
        autoLinked: 0,
        pendingCreated: 1,
      });
    });

    it('should have matching results defined after JJWL sync', async () => {
      const mockJJWLGyms: NormalizedGym[] = [
        { org: 'JJWL', externalId: 'jjwl-1', name: 'Test Gym' },
      ];

      const fetchMock = jest.spyOn(jjwlGymFetcher, 'fetchJJWLGyms');
      const batchUpsertMock = jest.spyOn(gymQueries, 'batchUpsertGyms');
      const listUSIBJJFGymsSpy = jest.spyOn(gymQueries as any, 'listUSIBJJFGyms');
      const getSourceGymMock = jest.spyOn(gymQueries, 'getSourceGym');
      const processMatchesMock = jest.spyOn(gymMatchingService, 'processGymMatches');

      fetchMock.mockResolvedValue(mockJJWLGyms);
      batchUpsertMock.mockResolvedValue(1);
      listUSIBJJFGymsSpy.mockResolvedValue([]);
      getSourceGymMock.mockResolvedValue(createMockSourceGym(mockJJWLGyms[0]));
      processMatchesMock.mockResolvedValue({ autoLinked: 0, pendingCreated: 0 });

      const result = await syncJJWLGyms();

      // Matching should always be defined for JJWL sync
      expect(result.matching).toBeDefined();
      expect(result.matching).toHaveProperty('processed');
      expect(result.matching).toHaveProperty('autoLinked');
      expect(result.matching).toHaveProperty('pendingCreated');
    });

    it('should reflect correct processed count in matching results', async () => {
      const mockJJWLGyms: NormalizedGym[] = [
        { org: 'JJWL', externalId: 'jjwl-1', name: 'Gym 1' },
        { org: 'JJWL', externalId: 'jjwl-2', name: 'Gym 2' },
        { org: 'JJWL', externalId: 'jjwl-3', name: 'Gym 3' },
      ];

      const fetchMock = jest.spyOn(jjwlGymFetcher, 'fetchJJWLGyms');
      const batchUpsertMock = jest.spyOn(gymQueries, 'batchUpsertGyms');
      const listUSIBJJFGymsSpy = jest.spyOn(gymQueries as any, 'listUSIBJJFGyms');
      const getSourceGymMock = jest.spyOn(gymQueries, 'getSourceGym');
      const processMatchesMock = jest.spyOn(gymMatchingService, 'processGymMatches');

      fetchMock.mockResolvedValue(mockJJWLGyms);
      batchUpsertMock.mockResolvedValue(3);
      listUSIBJJFGymsSpy.mockResolvedValue([]);
      getSourceGymMock.mockImplementation(async (_org, externalId) => {
        const gym = mockJJWLGyms.find(g => g.externalId === externalId);
        return gym ? createMockSourceGym(gym) : null;
      });
      // Mix of results: 1 auto-linked, 1 pending
      processMatchesMock.mockResolvedValueOnce({ autoLinked: 1, pendingCreated: 0 })
        .mockResolvedValueOnce({ autoLinked: 0, pendingCreated: 1 })
        .mockResolvedValueOnce({ autoLinked: 0, pendingCreated: 0 });

      const result = await syncJJWLGyms();

      expect(result.matching).toEqual({
        processed: 3,
        autoLinked: 1,
        pendingCreated: 1,
      });
      expect(processMatchesMock).toHaveBeenCalledTimes(3);
    });
  });

  describe('syncIBJJFGyms without matching', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should NOT run matching during IBJJF sync', async () => {
      const mockGyms: IBJJFNormalizedGym[] = [
        {
          org: 'IBJJF',
          externalId: 'ibjjf-1',
          name: 'Test Gym',
          city: 'Austin',
          countryCode: 'US',
        },
      ];

      const fetchCountMock = jest.spyOn(ibjjfGymFetcher, 'fetchIBJJFGymCount');
      const getSyncMetaMock = jest.spyOn(gymQueries, 'getGymSyncMeta');
      const fetchAllMock = jest.spyOn(ibjjfGymFetcher, 'fetchAllIBJJFGyms');
      const batchUpsertMock = jest.spyOn(gymQueries, 'batchUpsertGyms');
      const updateSyncMetaMock = jest.spyOn(gymQueries, 'updateGymSyncMeta');
      const processMatchesMock = jest.spyOn(gymMatchingService, 'processGymMatches');

      fetchCountMock.mockResolvedValue(1);
      getSyncMetaMock.mockResolvedValue(null); // First sync
      fetchAllMock.mockResolvedValue(mockGyms);
      batchUpsertMock.mockResolvedValue(1);
      updateSyncMetaMock.mockResolvedValue();

      const result = await syncIBJJFGyms();

      // processGymMatches should NOT be called during IBJJF sync
      expect(processMatchesMock).not.toHaveBeenCalled();

      // matching field should be undefined (not run)
      expect(result.matching).toBeUndefined();
      expect(result.fetched).toBe(1);
      expect(result.saved).toBe(1);
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
          slug: null,
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

    const createMockSourceGym = (gym: IBJJFNormalizedGym, masterGymId: string | null = null): SourceGymItem => ({
      PK: `SRCGYM#${gym.org}#${gym.externalId}`,
      SK: 'META',
      GSI1PK: 'GYMS',
      GSI1SK: `${gym.org}#${gym.name}`,
      org: gym.org,
      externalId: gym.externalId,
      name: gym.name,
      masterGymId,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    });

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
      const processMatchesMock = jest.spyOn(gymMatchingService, 'processGymMatches');

      fetchCountMock.mockResolvedValue(8600); // Changed from 8573
      getSyncMetaMock.mockResolvedValue(mockSyncMeta);
      fetchAllMock.mockResolvedValue(mockGyms);
      batchUpsertMock.mockResolvedValue(2);
      updateSyncMetaMock.mockResolvedValue(undefined);

      const result = await syncIBJJFGyms();

      expect(result.skipped).toBe(false);
      expect(result.fetched).toBe(2);
      expect(result.saved).toBe(2);
      // IBJJF sync should NOT run matching
      expect(result.matching).toBeUndefined();
      expect(processMatchesMock).not.toHaveBeenCalled();
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
      const getSourceGymMock = jest.spyOn(gymQueries, 'getSourceGym');
      const processMatchesMock = jest.spyOn(gymMatchingService, 'processGymMatches');

      fetchCountMock.mockResolvedValue(8573);
      getSyncMetaMock.mockResolvedValue(null); // First sync
      fetchAllMock.mockResolvedValue(mockGyms);
      batchUpsertMock.mockResolvedValue(1);
      updateSyncMetaMock.mockResolvedValue(undefined);
      getSourceGymMock.mockResolvedValue(createMockSourceGym(mockGyms[0]));
      processMatchesMock.mockResolvedValue({ autoLinked: 0, pendingCreated: 0 });

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
      // No matching mocks needed since mockGyms is empty

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
