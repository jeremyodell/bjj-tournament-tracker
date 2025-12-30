import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import {
  saveConnection,
  deleteConnection,
  getConnectionsForUser,
  setPendingAirport,
  getConnection,
} from '../../db/wsConnectionQueries.js';
import { docClient } from '../../db/client.js';
import type { WsConnectionItem } from '../../db/types.js';

// Mock the docClient
jest.mock('../../db/client.js', () => ({
  docClient: {
    send: jest.fn(),
  },
  TABLE_NAME: 'bjj-tournament-tracker-test',
  GSI1_NAME: 'GSI1',
}));

const mockSend = docClient.send as jest.MockedFunction<typeof docClient.send>;

describe('wsConnectionQueries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('saveConnection', () => {
    it('should save a WebSocket connection with correct PK/SK', async () => {
      mockSend.mockResolvedValueOnce({} as never);

      await saveConnection('conn-123', 'user-456');

      expect(mockSend).toHaveBeenCalledTimes(1);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const input = mockSend.mock.calls[0][0].input as any;
      expect(input.TableName).toBe('bjj-tournament-tracker-test');
      expect(input.Item.PK).toBe('WSCONN#conn-123');
      expect(input.Item.SK).toBe('META');
      expect(input.Item.connectionId).toBe('conn-123');
      expect(input.Item.userId).toBe('user-456');
      expect(input.Item.GSI1PK).toBe('USER#user-456');
      expect(input.Item.GSI1SK).toBe('WSCONN');
      expect(input.Item.pendingAirport).toBeNull();
    });

    it('should set TTL for 24 hours', async () => {
      mockSend.mockResolvedValueOnce({} as never);

      const beforeTime = Math.floor(Date.now() / 1000);
      await saveConnection('conn-123', 'user-456');
      const afterTime = Math.floor(Date.now() / 1000);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const input = mockSend.mock.calls[0][0].input as any;
      const expectedMinTtl = beforeTime + 24 * 60 * 60;
      const expectedMaxTtl = afterTime + 24 * 60 * 60;

      expect(input.Item.ttl).toBeGreaterThanOrEqual(expectedMinTtl);
      expect(input.Item.ttl).toBeLessThanOrEqual(expectedMaxTtl);
    });
  });

  describe('deleteConnection', () => {
    it('should delete a WebSocket connection by connectionId', async () => {
      mockSend.mockResolvedValueOnce({} as never);

      await deleteConnection('conn-123');

      expect(mockSend).toHaveBeenCalledTimes(1);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const input = mockSend.mock.calls[0][0].input as any;
      expect(input.Key.PK).toBe('WSCONN#conn-123');
      expect(input.Key.SK).toBe('META');
    });
  });

  describe('getConnection', () => {
    it('should return connection when found', async () => {
      const mockItem: WsConnectionItem = {
        PK: 'WSCONN#conn-123',
        SK: 'META',
        GSI1PK: 'USER#user-456',
        GSI1SK: 'WSCONN',
        connectionId: 'conn-123',
        userId: 'user-456',
        pendingAirport: null,
        connectedAt: '2025-01-01T00:00:00Z',
        ttl: 1735862400,
      };

      mockSend.mockResolvedValueOnce({ Item: mockItem } as never);

      const result = await getConnection('conn-123');

      expect(result).not.toBeNull();
      expect(result?.connectionId).toBe('conn-123');
      expect(result?.userId).toBe('user-456');
    });

    it('should return null when not found', async () => {
      mockSend.mockResolvedValueOnce({ Item: undefined } as never);

      const result = await getConnection('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getConnectionsForUser', () => {
    it('should return all connections for a user using GSI1', async () => {
      const mockItems: WsConnectionItem[] = [
        {
          PK: 'WSCONN#conn-123',
          SK: 'META',
          GSI1PK: 'USER#user-456',
          GSI1SK: 'WSCONN',
          connectionId: 'conn-123',
          userId: 'user-456',
          pendingAirport: null,
          connectedAt: '2025-01-01T00:00:00Z',
          ttl: 1735862400,
        },
        {
          PK: 'WSCONN#conn-789',
          SK: 'META',
          GSI1PK: 'USER#user-456',
          GSI1SK: 'WSCONN',
          connectionId: 'conn-789',
          userId: 'user-456',
          pendingAirport: 'DFW',
          connectedAt: '2025-01-01T01:00:00Z',
          ttl: 1735866000,
        },
      ];

      mockSend.mockResolvedValueOnce({ Items: mockItems } as never);

      const results = await getConnectionsForUser('user-456');

      expect(results).toHaveLength(2);
      expect(results[0].connectionId).toBe('conn-123');
      expect(results[1].connectionId).toBe('conn-789');
    });

    it('should use GSI1 with correct key condition', async () => {
      mockSend.mockResolvedValueOnce({ Items: [] } as never);

      await getConnectionsForUser('user-456');

      expect(mockSend).toHaveBeenCalledTimes(1);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const input = mockSend.mock.calls[0][0].input as any;
      expect(input.IndexName).toBe('GSI1');
      expect(input.KeyConditionExpression).toBe('GSI1PK = :pk AND GSI1SK = :sk');
      expect(input.ExpressionAttributeValues[':pk']).toBe('USER#user-456');
      expect(input.ExpressionAttributeValues[':sk']).toBe('WSCONN');
    });

    it('should return empty array when no connections found', async () => {
      mockSend.mockResolvedValueOnce({ Items: [] } as never);

      const results = await getConnectionsForUser('no-connections-user');

      expect(results).toHaveLength(0);
    });
  });

  describe('setPendingAirport', () => {
    it('should update pendingAirport for a connection', async () => {
      mockSend.mockResolvedValueOnce({} as never);

      await setPendingAirport('conn-123', 'DFW');

      expect(mockSend).toHaveBeenCalledTimes(1);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const input = mockSend.mock.calls[0][0].input as any;
      expect(input.Key.PK).toBe('WSCONN#conn-123');
      expect(input.Key.SK).toBe('META');
      expect(input.UpdateExpression).toContain('pendingAirport = :airport');
      expect(input.ExpressionAttributeValues[':airport']).toBe('DFW');
    });
  });
});
