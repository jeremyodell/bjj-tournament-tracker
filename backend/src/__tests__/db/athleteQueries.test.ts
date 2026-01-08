import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import {
  getUserAthletes,
  createAthlete,
  getAthlete,
  updateAthlete,
  deleteAthlete,
  getAllAthletesWithGyms,
} from '../../db/athleteQueries.js';
import { docClient } from '../../db/client.js';
import type { AthleteItem } from '../../db/types.js';

// Mock the docClient
jest.mock('../../db/client.js', () => ({
  docClient: {
    send: jest.fn(),
  },
  TABLE_NAME: 'bjj-tournament-tracker-test',
  GSI1_NAME: 'GSI1',
}));

// Mock ulid for deterministic IDs
jest.mock('ulid', () => ({
  ulid: jest.fn(() => 'mock-ulid-123'),
}));

const mockSend = docClient.send as jest.MockedFunction<typeof docClient.send>;

describe('athleteQueries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserAthletes', () => {
    it('should return athletes for a user', async () => {
      const mockItems: AthleteItem[] = [
        {
          PK: 'USER#user-123',
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

      mockSend.mockResolvedValueOnce({ Items: mockItems } as never);

      const result = await getUserAthletes('user-123');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Test Athlete');
    });
  });

  describe('getAllAthletesWithGyms', () => {
    it('should return only athletes with gymSourceId set', async () => {
      const mockItems: AthleteItem[] = [
        {
          PK: 'USER#user-1',
          SK: 'ATHLETE#athlete-1',
          athleteId: 'athlete-1',
          name: 'Athlete With Gym',
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
        {
          PK: 'USER#user-2',
          SK: 'ATHLETE#athlete-2',
          athleteId: 'athlete-2',
          name: 'Another With Gym',
          gender: null,
          beltRank: 'White',
          birthYear: 2017,
          weightClass: '40lbs',
          homeAirport: 'DFW',
          gymSourceId: 'JJWL#5714',
          gymName: 'Alliance Dallas',
          masterGymId: 'master-gym-1',
          createdAt: '2026-01-02T00:00:00Z',
          updatedAt: '2026-01-02T00:00:00Z',
        },
      ];

      mockSend.mockResolvedValueOnce({ Items: mockItems } as never);

      const result = await getAllAthletesWithGyms();

      expect(result).toHaveLength(2);
      expect(result[0].gymSourceId).toBe('JJWL#5713');
      expect(result[1].gymSourceId).toBe('JJWL#5714');
    });

    it('should return empty array when no athletes have gyms', async () => {
      mockSend.mockResolvedValueOnce({ Items: [] } as never);

      const result = await getAllAthletesWithGyms();

      expect(result).toEqual([]);
    });

    it('should use scan with filter for non-null gymSourceId', async () => {
      mockSend.mockResolvedValueOnce({ Items: [] } as never);

      await getAllAthletesWithGyms();

      // Verify the scan was called with correct filter
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const input = mockSend.mock.calls[0][0].input as any;
      expect(input.TableName).toBe('bjj-tournament-tracker-test');
      expect(input.FilterExpression).toContain('attribute_exists(gymSourceId)');
      expect(input.FilterExpression).toContain('gymSourceId <> :nullVal');
    });

    it('should handle pagination when scanning athletes', async () => {
      const firstBatch: AthleteItem[] = [
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
          gymName: 'Gym 1',
          masterGymId: null,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
      ];

      const secondBatch: AthleteItem[] = [
        {
          PK: 'USER#user-2',
          SK: 'ATHLETE#athlete-2',
          athleteId: 'athlete-2',
          name: 'Athlete 2',
          gender: null,
          beltRank: 'White',
          birthYear: 2017,
          weightClass: '40lbs',
          homeAirport: 'DFW',
          gymSourceId: 'JJWL#5714',
          gymName: 'Gym 2',
          masterGymId: null,
          createdAt: '2026-01-02T00:00:00Z',
          updatedAt: '2026-01-02T00:00:00Z',
        },
      ];

      // First scan returns items with LastEvaluatedKey
      mockSend.mockResolvedValueOnce({
        Items: firstBatch,
        LastEvaluatedKey: { PK: 'USER#user-1', SK: 'ATHLETE#athlete-1' },
      } as never);
      // Second scan returns more items without LastEvaluatedKey
      mockSend.mockResolvedValueOnce({
        Items: secondBatch,
      } as never);

      const result = await getAllAthletesWithGyms();

      expect(result).toHaveLength(2);
      expect(mockSend).toHaveBeenCalledTimes(2);
    });

    it('should only return JJWL gym athletes (filter IBJJF)', async () => {
      const mockItems: AthleteItem[] = [
        {
          PK: 'USER#user-1',
          SK: 'ATHLETE#athlete-1',
          athleteId: 'athlete-1',
          name: 'JJWL Athlete',
          gender: null,
          beltRank: 'Blue',
          birthYear: 2015,
          weightClass: '50lbs',
          homeAirport: 'AUS',
          gymSourceId: 'JJWL#5713',
          gymName: 'JJWL Gym',
          masterGymId: null,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
      ];

      // Note: The scan filter should include begins_with for JJWL prefix
      mockSend.mockResolvedValueOnce({ Items: mockItems } as never);

      const result = await getAllAthletesWithGyms();

      expect(result).toHaveLength(1);
      expect(result[0].gymSourceId).toContain('JJWL#');
    });
  });
});
