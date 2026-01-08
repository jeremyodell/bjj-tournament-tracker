import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { syncWishlistedRosters, syncUserGymRosters } from '../../services/rosterSyncService.js';
import * as wishlistQueries from '../../db/wishlistQueries.js';
import * as athleteQueries from '../../db/athleteQueries.js';
import * as gymSyncService from '../../services/gymSyncService.js';
import * as userProfileQueries from '../../db/userProfileQueries.js';
import * as gymQueries from '../../db/gymQueries.js';
import * as queries from '../../db/queries.js';
import type { AthleteItem, TournamentItem, SourceGymItem } from '../../db/types.js';

// Mock dependencies
jest.mock('../../db/wishlistQueries.js');
jest.mock('../../db/athleteQueries.js');
jest.mock('../../services/gymSyncService.js');
jest.mock('../../db/queries.js');
jest.mock('../../db/userProfileQueries.js');
jest.mock('../../db/gymQueries.js');

const mockGetAllWishlistedTournamentPKs = wishlistQueries.getAllWishlistedTournamentPKs as jest.MockedFunction<
  typeof wishlistQueries.getAllWishlistedTournamentPKs
>;
const mockGetAllAthletesWithGyms = athleteQueries.getAllAthletesWithGyms as jest.MockedFunction<
  typeof athleteQueries.getAllAthletesWithGyms
>;
const mockSyncGymRoster = gymSyncService.syncGymRoster as jest.MockedFunction<
  typeof gymSyncService.syncGymRoster
>;
const mockGetAllUserMasterGymIds = userProfileQueries.getAllUserMasterGymIds as jest.MockedFunction<
  typeof userProfileQueries.getAllUserMasterGymIds
>;
const mockGetSourceGymsByMasterGymId = gymQueries.getSourceGymsByMasterGymId as jest.MockedFunction<
  typeof gymQueries.getSourceGymsByMasterGymId
>;
const mockQueryTournaments = queries.queryTournaments as jest.MockedFunction<
  typeof queries.queryTournaments
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
          gender: null,
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
          gender: null,
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
          gender: 'Male',
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
          gender: 'Female',
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
          gender: null,
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
          gender: null,
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
        gender: null,
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
          gender: null,
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

  describe('syncUserGymRosters', () => {
    // Helper to create a mock tournament item
    const createMockTournament = (org: 'JJWL' | 'IBJJF', externalId: string, startDate: string): TournamentItem => ({
      PK: `TOURN#${org}#${externalId}`,
      SK: 'META',
      GSI1PK: 'TOURNAMENTS',
      GSI1SK: `${startDate}#${org}#${externalId}`,
      org,
      externalId,
      name: `Tournament ${externalId}`,
      slug: null,
      city: 'Austin',
      venue: 'Convention Center',
      country: 'USA',
      startDate,
      endDate: startDate,
      gi: true,
      nogi: false,
      kids: true,
      registrationUrl: null,
      bannerUrl: null,
      lat: null,
      lng: null,
      venueId: null,
      geocodeConfidence: null,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    });

    // Helper to create a mock source gym item
    const createMockSourceGym = (org: 'JJWL' | 'IBJJF', externalId: string, masterGymId: string): SourceGymItem => ({
      PK: `SRCGYM#${org}#${externalId}`,
      SK: 'META',
      GSI1PK: 'GYMS',
      GSI1SK: `${org}#Gym ${externalId}`,
      org,
      externalId,
      name: `Gym ${externalId}`,
      masterGymId,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    });

    it('should sync rosters for user gyms at upcoming tournaments', async () => {
      // User has one master gym linked to their profile
      mockGetAllUserMasterGymIds.mockResolvedValue(['master-gym-1']);

      // The master gym is linked to a JJWL source gym
      mockGetSourceGymsByMasterGymId.mockResolvedValue([
        createMockSourceGym('JJWL', '5713', 'master-gym-1'),
      ]);

      // One upcoming JJWL tournament
      mockQueryTournaments.mockResolvedValue({
        items: [createMockTournament('JJWL', '850', '2026-02-15')],
      });

      mockSyncGymRoster.mockResolvedValue({
        success: true,
        athleteCount: 10,
      });

      const resultPromise = syncUserGymRosters(90);
      await jest.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.successCount).toBe(1);
      expect(result.failureCount).toBe(0);
      expect(mockSyncGymRoster).toHaveBeenCalledWith('JJWL', '850', '5713');
    });

    it('should return empty result when no user gyms exist', async () => {
      mockGetAllUserMasterGymIds.mockResolvedValue([]);

      const resultPromise = syncUserGymRosters(90);
      await jest.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.successCount).toBe(0);
      expect(result.failureCount).toBe(0);
      expect(result.pairs).toEqual([]);
      expect(mockSyncGymRoster).not.toHaveBeenCalled();
    });

    it('should return empty result when no source gyms linked to master gyms', async () => {
      mockGetAllUserMasterGymIds.mockResolvedValue(['master-gym-1']);
      mockGetSourceGymsByMasterGymId.mockResolvedValue([]);

      const resultPromise = syncUserGymRosters(90);
      await jest.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.successCount).toBe(0);
      expect(result.failureCount).toBe(0);
      expect(mockSyncGymRoster).not.toHaveBeenCalled();
    });

    it('should return empty result when no tournaments in window', async () => {
      mockGetAllUserMasterGymIds.mockResolvedValue(['master-gym-1']);
      mockGetSourceGymsByMasterGymId.mockResolvedValue([
        createMockSourceGym('JJWL', '5713', 'master-gym-1'),
      ]);
      mockQueryTournaments.mockResolvedValue({ items: [] });

      const resultPromise = syncUserGymRosters(90);
      await jest.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.successCount).toBe(0);
      expect(result.failureCount).toBe(0);
      expect(mockSyncGymRoster).not.toHaveBeenCalled();
    });

    it('should only sync JJWL gyms at JJWL tournaments', async () => {
      mockGetAllUserMasterGymIds.mockResolvedValue(['master-gym-1']);

      // Source gym is JJWL
      mockGetSourceGymsByMasterGymId.mockResolvedValue([
        createMockSourceGym('JJWL', '5713', 'master-gym-1'),
      ]);

      // Tournaments include both JJWL and IBJJF
      mockQueryTournaments.mockResolvedValue({
        items: [
          createMockTournament('JJWL', '850', '2026-02-15'),
          createMockTournament('IBJJF', '999', '2026-02-20'),
        ],
      });

      mockSyncGymRoster.mockResolvedValue({
        success: true,
        athleteCount: 5,
      });

      const resultPromise = syncUserGymRosters(90);
      await jest.runAllTimersAsync();
      const result = await resultPromise;

      // Should only sync the JJWL gym at the JJWL tournament (not the IBJJF one)
      expect(mockSyncGymRoster).toHaveBeenCalledTimes(1);
      expect(mockSyncGymRoster).toHaveBeenCalledWith('JJWL', '850', '5713');
      expect(result.successCount).toBe(1);
    });

    it('should sync multiple gyms from same master gym at multiple tournaments', async () => {
      mockGetAllUserMasterGymIds.mockResolvedValue(['master-gym-1']);

      // Master gym linked to both JJWL and IBJJF source gyms
      mockGetSourceGymsByMasterGymId.mockResolvedValue([
        createMockSourceGym('JJWL', '5713', 'master-gym-1'),
        createMockSourceGym('IBJJF', 'ibjjf-123', 'master-gym-1'),
      ]);

      // Multiple JJWL tournaments
      mockQueryTournaments.mockResolvedValue({
        items: [
          createMockTournament('JJWL', '850', '2026-02-15'),
          createMockTournament('JJWL', '860', '2026-03-10'),
        ],
      });

      mockSyncGymRoster.mockResolvedValue({
        success: true,
        athleteCount: 5,
      });

      const resultPromise = syncUserGymRosters(90);
      await jest.runAllTimersAsync();
      const result = await resultPromise;

      // 2 JJWL tournaments * 1 JJWL gym = 2 pairs (IBJJF gym doesn't match JJWL tournaments)
      expect(mockSyncGymRoster).toHaveBeenCalledTimes(2);
      expect(result.successCount).toBe(2);
    });

    it('should deduplicate source gyms from multiple master gyms', async () => {
      // Two users have the same master gym
      mockGetAllUserMasterGymIds.mockResolvedValue(['master-gym-1', 'master-gym-1']);

      mockGetSourceGymsByMasterGymId.mockResolvedValue([
        createMockSourceGym('JJWL', '5713', 'master-gym-1'),
      ]);

      mockQueryTournaments.mockResolvedValue({
        items: [createMockTournament('JJWL', '850', '2026-02-15')],
      });

      mockSyncGymRoster.mockResolvedValue({
        success: true,
        athleteCount: 5,
      });

      const resultPromise = syncUserGymRosters(90);
      await jest.runAllTimersAsync();
      const result = await resultPromise;

      // Should only sync once (deduplicated)
      expect(mockSyncGymRoster).toHaveBeenCalledTimes(1);
      expect(result.successCount).toBe(1);
    });

    it('should count failures when syncGymRoster returns error', async () => {
      mockGetAllUserMasterGymIds.mockResolvedValue(['master-gym-1']);
      mockGetSourceGymsByMasterGymId.mockResolvedValue([
        createMockSourceGym('JJWL', '5713', 'master-gym-1'),
      ]);
      mockQueryTournaments.mockResolvedValue({
        items: [createMockTournament('JJWL', '850', '2026-02-15')],
      });

      mockSyncGymRoster.mockResolvedValue({
        success: false,
        athleteCount: 0,
        error: 'API timeout',
      });

      const resultPromise = syncUserGymRosters(90);
      await jest.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.successCount).toBe(0);
      expect(result.failureCount).toBe(1);
    });

    it('should use default 90-day window', async () => {
      mockGetAllUserMasterGymIds.mockResolvedValue(['master-gym-1']);
      mockGetSourceGymsByMasterGymId.mockResolvedValue([
        createMockSourceGym('JJWL', '5713', 'master-gym-1'),
      ]);
      mockQueryTournaments.mockResolvedValue({ items: [] });

      const resultPromise = syncUserGymRosters();
      await jest.runAllTimersAsync();
      await resultPromise;

      // Check that queryTournaments was called with a date window
      expect(mockQueryTournaments).toHaveBeenCalledWith(
        expect.objectContaining({
          startAfter: expect.any(String),
          startBefore: expect.any(String),
        }),
        250, // Limit
        undefined // Initial lastKey
      );
    });

    it('should respect rate limiting with batches', async () => {
      mockGetAllUserMasterGymIds.mockResolvedValue(['master-gym-1']);

      // 5 source gyms
      mockGetSourceGymsByMasterGymId.mockResolvedValue([
        createMockSourceGym('JJWL', '1', 'master-gym-1'),
        createMockSourceGym('JJWL', '2', 'master-gym-1'),
        createMockSourceGym('JJWL', '3', 'master-gym-1'),
        createMockSourceGym('JJWL', '4', 'master-gym-1'),
        createMockSourceGym('JJWL', '5', 'master-gym-1'),
      ]);

      // 3 tournaments = 15 pairs (requires 2 batches with concurrency 10)
      mockQueryTournaments.mockResolvedValue({
        items: [
          createMockTournament('JJWL', '850', '2026-02-15'),
          createMockTournament('JJWL', '860', '2026-02-20'),
          createMockTournament('JJWL', '870', '2026-02-25'),
        ],
      });

      mockSyncGymRoster.mockResolvedValue({
        success: true,
        athleteCount: 5,
      });

      const resultPromise = syncUserGymRosters(90);
      await jest.runAllTimersAsync();
      const result = await resultPromise;

      expect(mockSyncGymRoster).toHaveBeenCalledTimes(15);
      expect(result.successCount).toBe(15);
    });
  });
});
