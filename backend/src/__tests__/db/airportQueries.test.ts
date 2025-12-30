import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import {
  saveKnownAirport,
  getKnownAirport,
  listKnownAirports,
  incrementAirportUserCount,
  decrementAirportUserCount,
  updateAirportLastFetched,
} from '../../db/airportQueries.js';
import { docClient } from '../../db/client.js';
import type { KnownAirportItem } from '../../db/types.js';

// Mock the docClient
jest.mock('../../db/client.js', () => ({
  docClient: {
    send: jest.fn(),
  },
  TABLE_NAME: 'bjj-tournament-tracker-test',
  GSI1_NAME: 'GSI1',
}));

const mockSend = docClient.send as jest.MockedFunction<typeof docClient.send>;

describe('airportQueries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('saveKnownAirport', () => {
    it('should save a new airport with userCount = 1', async () => {
      mockSend.mockResolvedValueOnce({} as never);

      await saveKnownAirport('DFW');

      expect(mockSend).toHaveBeenCalledTimes(1);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const input = mockSend.mock.calls[0][0].input as any;
      expect(input.TableName).toBe('bjj-tournament-tracker-test');
      expect(input.Item.PK).toBe('AIRPORT#DFW');
      expect(input.Item.SK).toBe('META');
      expect(input.Item.iataCode).toBe('DFW');
      expect(input.Item.userCount).toBe(1);
      expect(input.Item.GSI1PK).toBe('AIRPORTS');
      expect(input.Item.GSI1SK).toBe('DFW');
    });

    it('should increment user count if airport already exists', async () => {
      // First call fails with conditional check (airport exists)
      const conditionalError = new Error('ConditionalCheckFailed');
      conditionalError.name = 'ConditionalCheckFailedException';
      mockSend.mockRejectedValueOnce(conditionalError as never);
      // Second call for increment succeeds
      mockSend.mockResolvedValueOnce({} as never);

      await saveKnownAirport('DFW');

      expect(mockSend).toHaveBeenCalledTimes(2);
    });
  });

  describe('getKnownAirport', () => {
    it('should return airport when found', async () => {
      const mockItem: KnownAirportItem = {
        PK: 'AIRPORT#DFW',
        SK: 'META',
        GSI1PK: 'AIRPORTS',
        GSI1SK: 'DFW',
        iataCode: 'DFW',
        userCount: 5,
        lastFetchedAt: '2025-01-01T00:00:00Z',
        createdAt: '2024-12-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      };

      mockSend.mockResolvedValueOnce({ Item: mockItem } as never);

      const result = await getKnownAirport('DFW');

      expect(result).not.toBeNull();
      expect(result?.iataCode).toBe('DFW');
      expect(result?.userCount).toBe(5);
    });

    it('should return null when not found', async () => {
      mockSend.mockResolvedValueOnce({ Item: undefined } as never);

      const result = await getKnownAirport('XXX');

      expect(result).toBeNull();
    });
  });

  describe('incrementAirportUserCount', () => {
    it('should increment user count by 1', async () => {
      mockSend.mockResolvedValueOnce({} as never);

      await incrementAirportUserCount('DFW');

      expect(mockSend).toHaveBeenCalledTimes(1);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const input = mockSend.mock.calls[0][0].input as any;
      expect(input.Key.PK).toBe('AIRPORT#DFW');
      expect(input.Key.SK).toBe('META');
      expect(input.UpdateExpression).toContain('userCount = userCount + :inc');
      expect(input.ExpressionAttributeValues[':inc']).toBe(1);
    });
  });

  describe('decrementAirportUserCount', () => {
    it('should decrement user count by 1 with conditional check', async () => {
      mockSend.mockResolvedValueOnce({} as never);

      await decrementAirportUserCount('DFW');

      expect(mockSend).toHaveBeenCalledTimes(1);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const input = mockSend.mock.calls[0][0].input as any;
      expect(input.Key.PK).toBe('AIRPORT#DFW');
      expect(input.Key.SK).toBe('META');
      expect(input.UpdateExpression).toContain('userCount = userCount - :dec');
      expect(input.ConditionExpression).toContain('userCount > :zero');
      expect(input.ExpressionAttributeValues[':dec']).toBe(1);
      expect(input.ExpressionAttributeValues[':zero']).toBe(0);
    });

    it('should throw when user count is zero', async () => {
      const conditionalError = new Error('ConditionalCheckFailed');
      conditionalError.name = 'ConditionalCheckFailedException';
      mockSend.mockRejectedValueOnce(conditionalError as never);

      await expect(decrementAirportUserCount('DFW')).rejects.toThrow(
        'ConditionalCheckFailed'
      );
    });
  });

  describe('listKnownAirports', () => {
    it('should list all known airports using GSI1', async () => {
      const mockItems: KnownAirportItem[] = [
        {
          PK: 'AIRPORT#DFW',
          SK: 'META',
          GSI1PK: 'AIRPORTS',
          GSI1SK: 'DFW',
          iataCode: 'DFW',
          userCount: 5,
          lastFetchedAt: null,
          createdAt: '2024-12-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
        },
        {
          PK: 'AIRPORT#LAX',
          SK: 'META',
          GSI1PK: 'AIRPORTS',
          GSI1SK: 'LAX',
          iataCode: 'LAX',
          userCount: 3,
          lastFetchedAt: null,
          createdAt: '2024-12-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
        },
      ];

      mockSend.mockResolvedValueOnce({ Items: mockItems } as never);

      const results = await listKnownAirports();

      expect(results).toHaveLength(2);
      expect(results[0].iataCode).toBe('DFW');
      expect(results[1].iataCode).toBe('LAX');
    });

    it('should return empty array when no airports exist', async () => {
      mockSend.mockResolvedValueOnce({ Items: [] } as never);

      const results = await listKnownAirports();

      expect(results).toHaveLength(0);
    });
  });

  describe('updateAirportLastFetched', () => {
    it('should update lastFetchedAt timestamp', async () => {
      mockSend.mockResolvedValueOnce({} as never);

      await updateAirportLastFetched('DFW');

      expect(mockSend).toHaveBeenCalledTimes(1);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const input = mockSend.mock.calls[0][0].input as any;
      expect(input.Key.PK).toBe('AIRPORT#DFW');
      expect(input.UpdateExpression).toContain('lastFetchedAt = :now');
    });
  });
});
