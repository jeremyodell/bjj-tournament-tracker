import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import {
  createPendingMatch,
  getPendingMatch,
  listPendingMatches,
  updatePendingMatchStatus,
  findExistingPendingMatch,
} from '../../db/pendingMatchQueries.js';
import { docClient } from '../../db/client.js';
import type { PendingMatchItem, MatchSignals } from '../../db/types.js';

// Mock the docClient
jest.mock('../../db/client.js', () => ({
  docClient: {
    send: jest.fn(),
  },
  TABLE_NAME: 'bjj-tournament-tracker-test',
  GSI1_NAME: 'GSI1',
}));

// Mock crypto.randomUUID
const mockUUID = '123e4567-e89b-12d3-a456-426614174000';
jest.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(mockUUID);

const mockSend = docClient.send as jest.MockedFunction<typeof docClient.send>;

const mockSignals: MatchSignals = {
  nameSimilarity: 85,
  cityBoost: 15,
  affiliationBoost: 0,
};

describe('pendingMatchQueries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createPendingMatch', () => {
    it('should create a pending match with correct structure', async () => {
      mockSend.mockResolvedValueOnce({} as never);

      const result = await createPendingMatch({
        sourceGym1Id: 'SRCGYM#JJWL#123',
        sourceGym1Name: 'Pablo Silva BJJ',
        sourceGym2Id: 'SRCGYM#IBJJF#456',
        sourceGym2Name: 'Pablo Silva Academy',
        confidence: 85,
        signals: mockSignals,
      });

      expect(mockSend).toHaveBeenCalledTimes(1);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const input = mockSend.mock.calls[0][0].input as any;
      expect(input.TableName).toBe('bjj-tournament-tracker-test');
      expect(input.Item.PK).toBe(`PENDINGMATCH#${mockUUID}`);
      expect(input.Item.SK).toBe('META');
      expect(input.Item.GSI1PK).toBe('PENDINGMATCHES');
      expect(input.Item.GSI1SK).toMatch(/^pending#/);
      expect(input.Item.status).toBe('pending');
      expect(input.Item.confidence).toBe(85);
      expect(input.Item.signals).toEqual(mockSignals);
    });

    it('should return the created item', async () => {
      mockSend.mockResolvedValueOnce({} as never);

      const result = await createPendingMatch({
        sourceGym1Id: 'SRCGYM#JJWL#123',
        sourceGym1Name: 'Test Gym 1',
        sourceGym2Id: 'SRCGYM#IBJJF#456',
        sourceGym2Name: 'Test Gym 2',
        confidence: 75,
        signals: mockSignals,
      });

      expect(result.id).toBe(mockUUID);
      expect(result.sourceGym1Name).toBe('Test Gym 1');
      expect(result.sourceGym2Name).toBe('Test Gym 2');
      expect(result.status).toBe('pending');
      expect(result.reviewedAt).toBeNull();
      expect(result.reviewedBy).toBeNull();
    });
  });

  describe('getPendingMatch', () => {
    it('should return pending match when found', async () => {
      const mockItem: PendingMatchItem = {
        PK: 'PENDINGMATCH#test-id',
        SK: 'META',
        GSI1PK: 'PENDINGMATCHES',
        GSI1SK: 'pending#2026-01-01T00:00:00Z',
        id: 'test-id',
        sourceGym1Id: 'SRCGYM#JJWL#123',
        sourceGym1Name: 'Gym 1',
        sourceGym2Id: 'SRCGYM#IBJJF#456',
        sourceGym2Name: 'Gym 2',
        confidence: 80,
        signals: mockSignals,
        status: 'pending',
        reviewedAt: null,
        reviewedBy: null,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      };

      mockSend.mockResolvedValueOnce({ Item: mockItem } as never);

      const result = await getPendingMatch('test-id');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('test-id');
      expect(result?.status).toBe('pending');
    });

    it('should return null when not found', async () => {
      mockSend.mockResolvedValueOnce({ Item: undefined } as never);

      const result = await getPendingMatch('nonexistent');

      expect(result).toBeNull();
    });

    it('should query with correct key structure', async () => {
      mockSend.mockResolvedValueOnce({ Item: undefined } as never);

      await getPendingMatch('my-match-id');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const input = mockSend.mock.calls[0][0].input as any;
      expect(input.Key.PK).toBe('PENDINGMATCH#my-match-id');
      expect(input.Key.SK).toBe('META');
    });
  });

  describe('listPendingMatches', () => {
    it('should list matches by status', async () => {
      const mockItems: PendingMatchItem[] = [
        {
          PK: 'PENDINGMATCH#1',
          SK: 'META',
          GSI1PK: 'PENDINGMATCHES',
          GSI1SK: 'pending#2026-01-01T00:00:00Z',
          id: '1',
          sourceGym1Id: 'SRCGYM#JJWL#a',
          sourceGym1Name: 'Gym A',
          sourceGym2Id: 'SRCGYM#IBJJF#b',
          sourceGym2Name: 'Gym B',
          confidence: 85,
          signals: mockSignals,
          status: 'pending',
          reviewedAt: null,
          reviewedBy: null,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
      ];

      mockSend.mockResolvedValueOnce({ Items: mockItems } as never);

      const results = await listPendingMatches('pending');

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('pending');
    });

    it('should use GSI1 with begins_with for status filter', async () => {
      mockSend.mockResolvedValueOnce({ Items: [] } as never);

      await listPendingMatches('approved', 25);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const input = mockSend.mock.calls[0][0].input as any;
      expect(input.IndexName).toBe('GSI1');
      expect(input.KeyConditionExpression).toBe(
        'GSI1PK = :pk AND begins_with(GSI1SK, :status)'
      );
      expect(input.ExpressionAttributeValues[':pk']).toBe('PENDINGMATCHES');
      expect(input.ExpressionAttributeValues[':status']).toBe('approved#');
      expect(input.Limit).toBe(25);
    });

    it('should use default limit of 50', async () => {
      mockSend.mockResolvedValueOnce({ Items: [] } as never);

      await listPendingMatches('pending');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const input = mockSend.mock.calls[0][0].input as any;
      expect(input.Limit).toBe(50);
    });
  });

  describe('updatePendingMatchStatus', () => {
    it('should update status to approved', async () => {
      mockSend.mockResolvedValueOnce({} as never);

      await updatePendingMatchStatus('match-123', 'approved', 'user-456');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const input = mockSend.mock.calls[0][0].input as any;
      expect(input.Key.PK).toBe('PENDINGMATCH#match-123');
      expect(input.Key.SK).toBe('META');
      expect(input.ExpressionAttributeValues[':status']).toBe('approved');
      expect(input.ExpressionAttributeValues[':reviewedBy']).toBe('user-456');
      expect(input.ExpressionAttributeValues[':reviewedAt']).toBeDefined();
    });

    it('should update status to rejected', async () => {
      mockSend.mockResolvedValueOnce({} as never);

      await updatePendingMatchStatus('match-789', 'rejected', 'admin-user');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const input = mockSend.mock.calls[0][0].input as any;
      expect(input.ExpressionAttributeValues[':status']).toBe('rejected');
      expect(input.ExpressionAttributeValues[':reviewedBy']).toBe('admin-user');
    });

    it('should update GSI1SK with new status prefix', async () => {
      mockSend.mockResolvedValueOnce({} as never);

      await updatePendingMatchStatus('match-123', 'approved', 'user-456');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const input = mockSend.mock.calls[0][0].input as any;
      expect(input.ExpressionAttributeValues[':gsi1sk']).toMatch(/^approved#/);
    });
  });

  describe('findExistingPendingMatch', () => {
    it('should find match when gym1->gym2 exists', async () => {
      const mockItems: PendingMatchItem[] = [
        {
          PK: 'PENDINGMATCH#existing',
          SK: 'META',
          GSI1PK: 'PENDINGMATCHES',
          GSI1SK: 'pending#2026-01-01T00:00:00Z',
          id: 'existing',
          sourceGym1Id: 'SRCGYM#JJWL#123',
          sourceGym1Name: 'Gym 1',
          sourceGym2Id: 'SRCGYM#IBJJF#456',
          sourceGym2Name: 'Gym 2',
          confidence: 80,
          signals: mockSignals,
          status: 'pending',
          reviewedAt: null,
          reviewedBy: null,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
      ];

      mockSend.mockResolvedValueOnce({ Items: mockItems } as never);

      const result = await findExistingPendingMatch('SRCGYM#JJWL#123', 'SRCGYM#IBJJF#456');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('existing');
    });

    it('should find match when gym2->gym1 exists (reverse order)', async () => {
      const mockItems: PendingMatchItem[] = [
        {
          PK: 'PENDINGMATCH#existing',
          SK: 'META',
          GSI1PK: 'PENDINGMATCHES',
          GSI1SK: 'pending#2026-01-01T00:00:00Z',
          id: 'existing',
          sourceGym1Id: 'SRCGYM#IBJJF#456',
          sourceGym1Name: 'Gym 2',
          sourceGym2Id: 'SRCGYM#JJWL#123',
          sourceGym2Name: 'Gym 1',
          confidence: 80,
          signals: mockSignals,
          status: 'pending',
          reviewedAt: null,
          reviewedBy: null,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
      ];

      mockSend.mockResolvedValueOnce({ Items: mockItems } as never);

      const result = await findExistingPendingMatch('SRCGYM#JJWL#123', 'SRCGYM#IBJJF#456');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('existing');
    });

    it('should return null when no match exists', async () => {
      mockSend.mockResolvedValueOnce({ Items: [] } as never);

      const result = await findExistingPendingMatch('SRCGYM#JJWL#new1', 'SRCGYM#IBJJF#new2');

      expect(result).toBeNull();
    });

    it('should query pending matches only', async () => {
      mockSend.mockResolvedValueOnce({ Items: [] } as never);

      await findExistingPendingMatch('gym1', 'gym2');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const input = mockSend.mock.calls[0][0].input as any;
      expect(input.ExpressionAttributeValues[':status']).toBe('pending#');
    });
  });
});
