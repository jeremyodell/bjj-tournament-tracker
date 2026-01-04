import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import {
  upsertSourceGym,
  getSourceGym,
  searchGyms,
  listGyms,
  upsertGymRoster,
  getGymRoster,
  getTournamentRosters,
  batchUpsertGyms,
} from '../../db/gymQueries.js';
import { docClient } from '../../db/client.js';
import type { SourceGymItem, TournamentGymRosterItem } from '../../db/types.js';
import type { NormalizedGym, JJWLRosterAthlete } from '../../fetchers/types.js';

// Mock the docClient
jest.mock('../../db/client.js', () => ({
  docClient: {
    send: jest.fn(),
  },
  TABLE_NAME: 'bjj-tournament-tracker-test',
  GSI1_NAME: 'GSI1',
}));

const mockSend = docClient.send as jest.MockedFunction<typeof docClient.send>;

describe('gymQueries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('upsertSourceGym', () => {
    it('should create a new gym with correct PK/SK/GSI keys', async () => {
      mockSend.mockResolvedValueOnce({} as never);

      const gym: NormalizedGym = {
        org: 'JJWL',
        externalId: 'test-123',
        name: 'Test Academy',
      };

      await upsertSourceGym(gym);

      expect(mockSend).toHaveBeenCalledTimes(1);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const input = mockSend.mock.calls[0][0].input as any;
      expect(input.TableName).toBe('bjj-tournament-tracker-test');
      expect(input.Item.PK).toBe('SRCGYM#JJWL#test-123');
      expect(input.Item.SK).toBe('META');
      expect(input.Item.GSI1PK).toBe('GYMS');
      expect(input.Item.GSI1SK).toBe('JJWL#Test Academy');
      expect(input.Item.org).toBe('JJWL');
      expect(input.Item.externalId).toBe('test-123');
      expect(input.Item.name).toBe('Test Academy');
      expect(input.Item.masterGymId).toBeNull();
    });

    it('should handle IBJJF org correctly', async () => {
      mockSend.mockResolvedValueOnce({} as never);

      const gym: NormalizedGym = {
        org: 'IBJJF',
        externalId: 'ibjjf-456',
        name: 'Alliance Atlanta',
      };

      await upsertSourceGym(gym);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const input = mockSend.mock.calls[0][0].input as any;
      expect(input.Item.PK).toBe('SRCGYM#IBJJF#ibjjf-456');
      expect(input.Item.GSI1SK).toBe('IBJJF#Alliance Atlanta');
      expect(input.Item.org).toBe('IBJJF');
    });
  });

  describe('getSourceGym', () => {
    it('should return gym when found', async () => {
      const mockItem: SourceGymItem = {
        PK: 'SRCGYM#JJWL#5713',
        SK: 'META',
        GSI1PK: 'GYMS',
        GSI1SK: 'JJWL#Pablo Silva BJJ',
        org: 'JJWL',
        externalId: '5713',
        name: 'Pablo Silva BJJ',
        masterGymId: null,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      };

      mockSend.mockResolvedValueOnce({ Item: mockItem } as never);

      const result = await getSourceGym('JJWL', '5713');

      expect(result).not.toBeNull();
      expect(result?.name).toBe('Pablo Silva BJJ');
      expect(result?.org).toBe('JJWL');
      expect(result?.externalId).toBe('5713');
    });

    it('should return null when gym not found', async () => {
      mockSend.mockResolvedValueOnce({ Item: undefined } as never);

      const result = await getSourceGym('JJWL', 'nonexistent');

      expect(result).toBeNull();
    });

    it('should query with correct key structure', async () => {
      mockSend.mockResolvedValueOnce({ Item: undefined } as never);

      await getSourceGym('IBJJF', 'gym-789');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const input = mockSend.mock.calls[0][0].input as any;
      expect(input.TableName).toBe('bjj-tournament-tracker-test');
      expect(input.Key.PK).toBe('SRCGYM#IBJJF#gym-789');
      expect(input.Key.SK).toBe('META');
    });
  });

  describe('searchGyms', () => {
    it('should search gyms by name prefix using GSI1', async () => {
      const mockItems: SourceGymItem[] = [
        {
          PK: 'SRCGYM#JJWL#1',
          SK: 'META',
          GSI1PK: 'GYMS',
          GSI1SK: 'JJWL#Pablo Silva BJJ',
          org: 'JJWL',
          externalId: '1',
          name: 'Pablo Silva BJJ',
          masterGymId: null,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
        {
          PK: 'SRCGYM#JJWL#2',
          SK: 'META',
          GSI1PK: 'GYMS',
          GSI1SK: 'JJWL#Pablo Academy',
          org: 'JJWL',
          externalId: '2',
          name: 'Pablo Academy',
          masterGymId: null,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
      ];

      mockSend.mockResolvedValueOnce({ Items: mockItems } as never);

      const results = await searchGyms('JJWL', 'Pablo');

      expect(results).toHaveLength(2);
      expect(results[0].name).toBe('Pablo Silva BJJ');
      expect(results[1].name).toBe('Pablo Academy');
    });

    it('should use GSI1 with begins_with for prefix search', async () => {
      mockSend.mockResolvedValueOnce({ Items: [] } as never);

      await searchGyms('JJWL', 'Alliance', 10);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const input = mockSend.mock.calls[0][0].input as any;
      expect(input.IndexName).toBe('GSI1');
      expect(input.KeyConditionExpression).toBe(
        'GSI1PK = :pk AND begins_with(GSI1SK, :prefix)'
      );
      expect(input.ExpressionAttributeValues[':pk']).toBe('GYMS');
      expect(input.ExpressionAttributeValues[':prefix']).toBe('JJWL#Alliance');
      expect(input.Limit).toBe(10);
    });

    it('should return empty array when no gyms match', async () => {
      mockSend.mockResolvedValueOnce({ Items: [] } as never);

      const results = await searchGyms('JJWL', 'NonexistentGym');

      expect(results).toHaveLength(0);
    });

    it('should use default limit of 20', async () => {
      mockSend.mockResolvedValueOnce({ Items: [] } as never);

      await searchGyms('JJWL', 'Test');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const input = mockSend.mock.calls[0][0].input as any;
      expect(input.Limit).toBe(20);
    });
  });

  describe('listGyms', () => {
    it('should list gyms for an org with pagination', async () => {
      const mockItems: SourceGymItem[] = [
        {
          PK: 'SRCGYM#JJWL#1',
          SK: 'META',
          GSI1PK: 'GYMS',
          GSI1SK: 'JJWL#Academy A',
          org: 'JJWL',
          externalId: '1',
          name: 'Academy A',
          masterGymId: null,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
      ];
      const mockLastKey = { PK: 'SRCGYM#JJWL#1', SK: 'META' };

      mockSend.mockResolvedValueOnce({
        Items: mockItems,
        LastEvaluatedKey: mockLastKey,
      } as never);

      const result = await listGyms('JJWL', 50);

      expect(result.items).toHaveLength(1);
      expect(result.lastKey).toEqual(mockLastKey);
    });

    it('should query GSI1 with org prefix', async () => {
      mockSend.mockResolvedValueOnce({ Items: [] } as never);

      await listGyms('IBJJF', 25);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const input = mockSend.mock.calls[0][0].input as any;
      expect(input.IndexName).toBe('GSI1');
      expect(input.KeyConditionExpression).toBe(
        'GSI1PK = :pk AND begins_with(GSI1SK, :org)'
      );
      expect(input.ExpressionAttributeValues[':pk']).toBe('GYMS');
      expect(input.ExpressionAttributeValues[':org']).toBe('IBJJF#');
      expect(input.Limit).toBe(25);
    });

    it('should pass lastKey for pagination', async () => {
      mockSend.mockResolvedValueOnce({ Items: [] } as never);
      const lastKey = { PK: 'SRCGYM#JJWL#prev', SK: 'META' };

      await listGyms('JJWL', 50, lastKey);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const input = mockSend.mock.calls[0][0].input as any;
      expect(input.ExclusiveStartKey).toEqual(lastKey);
    });
  });

  describe('upsertGymRoster', () => {
    it('should save roster with correct structure', async () => {
      mockSend.mockResolvedValueOnce({} as never);

      const athletes: JJWLRosterAthlete[] = [
        { name: 'John Doe', belt: 'Blue', ageDiv: 'Adult', weight: 'Light', gender: 'Male' },
        { name: 'Jane Smith', belt: 'Purple', ageDiv: 'Juvenile', weight: 'Feather', gender: 'Female' },
      ];

      await upsertGymRoster('JJWL', '850', '5713', 'Test Gym', athletes);

      expect(mockSend).toHaveBeenCalledTimes(1);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const input = mockSend.mock.calls[0][0].input as any;
      expect(input.Item.PK).toBe('TOURN#JJWL#850');
      expect(input.Item.SK).toBe('GYMROSTER#5713');
      expect(input.Item.gymExternalId).toBe('5713');
      expect(input.Item.gymName).toBe('Test Gym');
      expect(input.Item.athletes).toEqual(athletes);
      expect(input.Item.athleteCount).toBe(2);
      expect(input.Item.fetchedAt).toBeDefined();
    });

    it('should store athleteCount for quick access', async () => {
      mockSend.mockResolvedValueOnce({} as never);

      const athletes: JJWLRosterAthlete[] = [
        { name: 'A', belt: 'White', ageDiv: 'Adult', weight: 'Medium', gender: 'Male' },
        { name: 'B', belt: 'Blue', ageDiv: 'Adult', weight: 'Heavy', gender: 'Male' },
        { name: 'C', belt: 'Purple', ageDiv: 'Adult', weight: 'Light', gender: 'Female' },
      ];

      await upsertGymRoster('JJWL', '999', 'gym-1', 'Academy', athletes);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const input = mockSend.mock.calls[0][0].input as any;
      expect(input.Item.athleteCount).toBe(3);
    });

    it('should handle empty athlete list', async () => {
      mockSend.mockResolvedValueOnce({} as never);

      await upsertGymRoster('JJWL', '850', '5713', 'Test Gym', []);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const input = mockSend.mock.calls[0][0].input as any;
      expect(input.Item.athletes).toEqual([]);
      expect(input.Item.athleteCount).toBe(0);
    });
  });

  describe('getGymRoster', () => {
    it('should return roster when found', async () => {
      const mockRoster: TournamentGymRosterItem = {
        PK: 'TOURN#JJWL#850',
        SK: 'GYMROSTER#5713',
        gymExternalId: '5713',
        gymName: 'Pablo Silva BJJ',
        athletes: [
          { name: 'John Doe', belt: 'Blue', ageDiv: 'Adult', weight: 'Light', gender: 'Male' },
        ],
        athleteCount: 1,
        fetchedAt: '2026-01-01T00:00:00Z',
      };

      mockSend.mockResolvedValueOnce({ Item: mockRoster } as never);

      const result = await getGymRoster('JJWL', '850', '5713');

      expect(result).not.toBeNull();
      expect(result?.gymName).toBe('Pablo Silva BJJ');
      expect(result?.athleteCount).toBe(1);
      expect(result?.athletes).toHaveLength(1);
    });

    it('should return null when roster not found', async () => {
      mockSend.mockResolvedValueOnce({ Item: undefined } as never);

      const result = await getGymRoster('JJWL', '850', 'nonexistent');

      expect(result).toBeNull();
    });

    it('should query with correct key structure', async () => {
      mockSend.mockResolvedValueOnce({ Item: undefined } as never);

      await getGymRoster('IBJJF', 'tourn-123', 'gym-456');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const input = mockSend.mock.calls[0][0].input as any;
      expect(input.Key.PK).toBe('TOURN#IBJJF#tourn-123');
      expect(input.Key.SK).toBe('GYMROSTER#gym-456');
    });
  });

  describe('getTournamentRosters', () => {
    it('should return all rosters for a tournament', async () => {
      const mockRosters: TournamentGymRosterItem[] = [
        {
          PK: 'TOURN#JJWL#850',
          SK: 'GYMROSTER#gym-a',
          gymExternalId: 'gym-a',
          gymName: 'Gym A',
          athletes: [],
          athleteCount: 0,
          fetchedAt: '2026-01-01T00:00:00Z',
        },
        {
          PK: 'TOURN#JJWL#850',
          SK: 'GYMROSTER#gym-b',
          gymExternalId: 'gym-b',
          gymName: 'Gym B',
          athletes: [],
          athleteCount: 5,
          fetchedAt: '2026-01-01T00:00:00Z',
        },
      ];

      mockSend.mockResolvedValueOnce({ Items: mockRosters } as never);

      const results = await getTournamentRosters('JJWL', '850');

      expect(results).toHaveLength(2);
      expect(results[0].gymName).toBe('Gym A');
      expect(results[1].gymName).toBe('Gym B');
    });

    it('should query with correct key condition for GYMROSTER prefix', async () => {
      mockSend.mockResolvedValueOnce({ Items: [] } as never);

      await getTournamentRosters('IBJJF', 'tourn-999');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const input = mockSend.mock.calls[0][0].input as any;
      expect(input.KeyConditionExpression).toBe(
        'PK = :pk AND begins_with(SK, :skPrefix)'
      );
      expect(input.ExpressionAttributeValues[':pk']).toBe('TOURN#IBJJF#tourn-999');
      expect(input.ExpressionAttributeValues[':skPrefix']).toBe('GYMROSTER#');
    });

    it('should return empty array when no rosters exist', async () => {
      mockSend.mockResolvedValueOnce({ Items: [] } as never);

      const results = await getTournamentRosters('JJWL', 'empty-tournament');

      expect(results).toHaveLength(0);
    });
  });

  describe('batchUpsertGyms', () => {
    it('should upsert multiple gyms', async () => {
      // Mock multiple calls (one per gym)
      mockSend.mockResolvedValue({} as never);

      const gyms: NormalizedGym[] = [
        { org: 'JJWL', externalId: '1', name: 'Gym One' },
        { org: 'JJWL', externalId: '2', name: 'Gym Two' },
        { org: 'JJWL', externalId: '3', name: 'Gym Three' },
      ];

      const count = await batchUpsertGyms(gyms);

      expect(count).toBe(3);
      expect(mockSend).toHaveBeenCalledTimes(3);
    });

    it('should return 0 for empty array', async () => {
      const count = await batchUpsertGyms([]);

      expect(count).toBe(0);
      expect(mockSend).not.toHaveBeenCalled();
    });

    it('should handle large batches', async () => {
      mockSend.mockResolvedValue({} as never);

      const gyms: NormalizedGym[] = Array.from({ length: 100 }, (_, i) => ({
        org: 'JJWL' as const,
        externalId: `gym-${i}`,
        name: `Gym ${i}`,
      }));

      const count = await batchUpsertGyms(gyms);

      expect(count).toBe(100);
      expect(mockSend).toHaveBeenCalledTimes(100);
    });
  });
});
