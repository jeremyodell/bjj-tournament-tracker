import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { syncWishlistedRosters } from '../../services/rosterSyncService.js';
import * as wishlistQueries from '../../db/wishlistQueries.js';
import * as athleteQueries from '../../db/athleteQueries.js';
import * as gymSyncService from '../../services/gymSyncService.js';
import type { AthleteItem, TournamentItem } from '../../db/types.js';

// Mock dependencies
jest.mock('../../db/wishlistQueries.js');
jest.mock('../../db/athleteQueries.js');
jest.mock('../../services/gymSyncService.js');
jest.mock('../../db/queries.js');

const mockGetAllWishlistedTournamentPKs = wishlistQueries.getAllWishlistedTournamentPKs as jest.MockedFunction<
  typeof wishlistQueries.getAllWishlistedTournamentPKs
>;
const mockGetAllAthletesWithGyms = athleteQueries.getAllAthletesWithGyms as jest.MockedFunction<
  typeof athleteQueries.getAllAthletesWithGyms
>;
const mockSyncGymRoster = gymSyncService.syncGymRoster as jest.MockedFunction<
  typeof gymSyncService.syncGymRoster
>;

describe('rosterSyncService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('syncWishlistedRosters', () => {
    it('should sync rosters for wishlisted tournaments with user gym associations', async () => {
      // Setup: User wishlisted tournament 850, and has athlete at gym 5713
      mockGetAllWishlistedTournamentPKs.mockResolvedValue([
        'TOURN#JJWL#850',
      ]);

      const mockAthletes: AthleteItem[] = [
        {
          PK: 'USER#user-1',
          SK: 'ATHLETE#athlete-1',
          athleteId: 'athlete-1',
          name: 'Test Athlete',
          beltRank: 'Blue',
          birthYear: 2015,
          weightClass: '50lbs',
          homeAirport: 'AUS',
          gymSourceId: 'JJWL#5713',
          gymName: 'Pablo Silva BJJ',
          masterGymId: null,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
      ];
      mockGetAllAthletesWithGyms.mockResolvedValue(mockAthletes);

      mockSyncGymRoster.mockResolvedValue({
        success: true,
        athleteCount: 5,
      });

      const resultPromise = syncWishlistedRosters(60);

      // Advance timers to allow async operations
      await jest.runAllTimersAsync();

      const result = await resultPromise;

      expect(result.successCount).toBe(1);
      expect(result.failureCount).toBe(0);
      expect(mockSyncGymRoster).toHaveBeenCalledWith('JJWL', '850', '5713');
    });

    it('should return empty result when no wishlisted tournaments', async () => {
      mockGetAllWishlistedTournamentPKs.mockResolvedValue([]);

      const resultPromise = syncWishlistedRosters(60);
      await jest.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.successCount).toBe(0);
      expect(result.failureCount).toBe(0);
      expect(result.pairs).toEqual([]);
      expect(mockSyncGymRoster).not.toHaveBeenCalled();
    });

    it('should return empty result when no athletes have gyms', async () => {
      mockGetAllWishlistedTournamentPKs.mockResolvedValue(['TOURN#JJWL#850']);
      mockGetAllAthletesWithGyms.mockResolvedValue([]);

      const resultPromise = syncWishlistedRosters(60);
      await jest.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.successCount).toBe(0);
      expect(result.failureCount).toBe(0);
      expect(mockSyncGymRoster).not.toHaveBeenCalled();
    });

    it('should count failures when syncGymRoster returns error', async () => {
      mockGetAllWishlistedTournamentPKs.mockResolvedValue(['TOURN#JJWL#850']);

      const mockAthletes: AthleteItem[] = [
        {
          PK: 'USER#user-1',
          SK: 'ATHLETE#athlete-1',
          athleteId: 'athlete-1',
          name: 'Test Athlete',
          beltRank: 'Blue',
          birthYear: 2015,
          weightClass: '50lbs',
          homeAirport: 'AUS',
          gymSourceId: 'JJWL#5713',
          gymName: 'Pablo Silva BJJ',
          masterGymId: null,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
      ];
      mockGetAllAthletesWithGyms.mockResolvedValue(mockAthletes);

      mockSyncGymRoster.mockResolvedValue({
        success: false,
        athleteCount: 0,
        error: 'API timeout',
      });

      const resultPromise = syncWishlistedRosters(60);
      await jest.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.successCount).toBe(0);
      expect(result.failureCount).toBe(1);
    });

    it('should deduplicate (tournament, gym) pairs from multiple athletes', async () => {
      mockGetAllWishlistedTournamentPKs.mockResolvedValue(['TOURN#JJWL#850']);

      // Two athletes from the same gym
      const mockAthletes: AthleteItem[] = [
        {
          PK: 'USER#user-1',
          SK: 'ATHLETE#athlete-1',
          athleteId: 'athlete-1',
          name: 'Athlete 1',
          beltRank: 'Blue',
          birthYear: 2015,
          weightClass: '50lbs',
          homeAirport: 'AUS',
          gymSourceId: 'JJWL#5713',
          gymName: 'Pablo Silva BJJ',
          masterGymId: null,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
        {
          PK: 'USER#user-2',
          SK: 'ATHLETE#athlete-2',
          athleteId: 'athlete-2',
          name: 'Athlete 2',
          beltRank: 'White',
          birthYear: 2016,
          weightClass: '45lbs',
          homeAirport: 'AUS',
          gymSourceId: 'JJWL#5713', // Same gym
          gymName: 'Pablo Silva BJJ',
          masterGymId: null,
          createdAt: '2026-01-02T00:00:00Z',
          updatedAt: '2026-01-02T00:00:00Z',
        },
      ];
      mockGetAllAthletesWithGyms.mockResolvedValue(mockAthletes);

      mockSyncGymRoster.mockResolvedValue({
        success: true,
        athleteCount: 10,
      });

      const resultPromise = syncWishlistedRosters(60);
      await jest.runAllTimersAsync();
      const result = await resultPromise;

      // Should only call once for the deduplicated pair
      expect(mockSyncGymRoster).toHaveBeenCalledTimes(1);
      expect(result.successCount).toBe(1);
    });

    it('should sync multiple (tournament, gym) pairs', async () => {
      // Two tournaments, two different gyms
      mockGetAllWishlistedTournamentPKs.mockResolvedValue([
        'TOURN#JJWL#850',
        'TOURN#JJWL#860',
      ]);

      const mockAthletes: AthleteItem[] = [
        {
          PK: 'USER#user-1',
          SK: 'ATHLETE#athlete-1',
          athleteId: 'athlete-1',
          name: 'Athlete 1',
          beltRank: 'Blue',
          birthYear: 2015,
          weightClass: '50lbs',
          homeAirport: 'AUS',
          gymSourceId: 'JJWL#5713',
          gymName: 'Gym A',
          masterGymId: null,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
        {
          PK: 'USER#user-2',
          SK: 'ATHLETE#athlete-2',
          athleteId: 'athlete-2',
          name: 'Athlete 2',
          beltRank: 'White',
          birthYear: 2016,
          weightClass: '45lbs',
          homeAirport: 'DFW',
          gymSourceId: 'JJWL#5714',
          gymName: 'Gym B',
          masterGymId: null,
          createdAt: '2026-01-02T00:00:00Z',
          updatedAt: '2026-01-02T00:00:00Z',
        },
      ];
      mockGetAllAthletesWithGyms.mockResolvedValue(mockAthletes);

      mockSyncGymRoster.mockResolvedValue({
        success: true,
        athleteCount: 5,
      });

      const resultPromise = syncWishlistedRosters(60);
      await jest.runAllTimersAsync();
      const result = await resultPromise;

      // 2 tournaments * 2 gyms = 4 pairs
      expect(mockSyncGymRoster).toHaveBeenCalledTimes(4);
      expect(result.successCount).toBe(4);
      expect(result.pairs).toHaveLength(4);
    });

    it('should respect rate limiting with batches', async () => {
      // Setup: 15 pairs to sync (should require multiple batches with concurrency=10)
      const tournaments = Array.from({ length: 3 }, (_, i) => `TOURN#JJWL#${850 + i}`);
      mockGetAllWishlistedTournamentPKs.mockResolvedValue(tournaments);

      const mockAthletes: AthleteItem[] = Array.from({ length: 5 }, (_, i) => ({
        PK: `USER#user-${i}`,
        SK: `ATHLETE#athlete-${i}`,
        athleteId: `athlete-${i}`,
        name: `Athlete ${i}`,
        beltRank: 'Blue',
        birthYear: 2015,
        weightClass: '50lbs',
        homeAirport: 'AUS',
        gymSourceId: `JJWL#${5713 + i}`,
        gymName: `Gym ${i}`,
        masterGymId: null,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      }));
      mockGetAllAthletesWithGyms.mockResolvedValue(mockAthletes);

      mockSyncGymRoster.mockResolvedValue({
        success: true,
        athleteCount: 5,
      });

      const resultPromise = syncWishlistedRosters(60);
      await jest.runAllTimersAsync();
      const result = await resultPromise;

      // 3 tournaments * 5 gyms = 15 pairs
      expect(mockSyncGymRoster).toHaveBeenCalledTimes(15);
      expect(result.successCount).toBe(15);
    });

    it('should log success and failure counts', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      mockGetAllWishlistedTournamentPKs.mockResolvedValue(['TOURN#JJWL#850']);
      const mockAthletes: AthleteItem[] = [
        {
          PK: 'USER#user-1',
          SK: 'ATHLETE#athlete-1',
          athleteId: 'athlete-1',
          name: 'Test Athlete',
          beltRank: 'Blue',
          birthYear: 2015,
          weightClass: '50lbs',
          homeAirport: 'AUS',
          gymSourceId: 'JJWL#5713',
          gymName: 'Pablo Silva BJJ',
          masterGymId: null,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
      ];
      mockGetAllAthletesWithGyms.mockResolvedValue(mockAthletes);
      mockSyncGymRoster.mockResolvedValue({
        success: true,
        athleteCount: 5,
      });

      const resultPromise = syncWishlistedRosters(60);
      await jest.runAllTimersAsync();
      await resultPromise;

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[RosterSyncService]')
      );

      consoleSpy.mockRestore();
    });
  });
});
