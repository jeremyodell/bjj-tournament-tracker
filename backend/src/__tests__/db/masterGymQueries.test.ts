import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import {
  createMasterGym,
  getMasterGym,
  searchMasterGyms,
  linkSourceGymToMaster,
  unlinkSourceGymFromMaster,
} from '../../db/masterGymQueries.js';
import { docClient } from '../../db/client.js';
import type { MasterGymItem } from '../../db/types.js';

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

describe('masterGymQueries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createMasterGym', () => {
    it('should create a master gym with correct PK/SK/GSI keys', async () => {
      mockSend.mockResolvedValueOnce({} as never);

      const result = await createMasterGym({
        canonicalName: 'Gracie Barra',
        city: 'Irvine',
        country: 'USA',
      });

      expect(mockSend).toHaveBeenCalledTimes(1);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const input = mockSend.mock.calls[0][0].input as any;
      expect(input.TableName).toBe('bjj-tournament-tracker-test');
      expect(input.Item.PK).toBe(`MASTERGYM#${mockUUID}`);
      expect(input.Item.SK).toBe('META');
      expect(input.Item.GSI1PK).toBe('MASTERGYMS');
      expect(input.Item.GSI1SK).toBe('Gracie Barra');
      expect(input.Item.id).toBe(mockUUID);
      expect(input.Item.canonicalName).toBe('Gracie Barra');
      expect(input.Item.city).toBe('Irvine');
      expect(input.Item.country).toBe('USA');
    });

    it('should return the created item', async () => {
      mockSend.mockResolvedValueOnce({} as never);

      const result = await createMasterGym({
        canonicalName: 'Alliance',
      });

      expect(result.id).toBe(mockUUID);
      expect(result.canonicalName).toBe('Alliance');
      expect(result.PK).toBe(`MASTERGYM#${mockUUID}`);
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
    });

    it('should set null for optional fields when not provided', async () => {
      mockSend.mockResolvedValueOnce({} as never);

      await createMasterGym({
        canonicalName: 'Atos',
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const input = mockSend.mock.calls[0][0].input as any;
      expect(input.Item.city).toBeNull();
      expect(input.Item.country).toBeNull();
      expect(input.Item.address).toBeNull();
      expect(input.Item.website).toBeNull();
    });
  });

  describe('getMasterGym', () => {
    it('should return master gym when found', async () => {
      const mockItem: MasterGymItem = {
        PK: 'MASTERGYM#test-id',
        SK: 'META',
        GSI1PK: 'MASTERGYMS',
        GSI1SK: 'Gracie Barra',
        id: 'test-id',
        canonicalName: 'Gracie Barra',
        city: 'Irvine',
        country: 'USA',
        address: '123 Main St',
        website: 'https://graciebarra.com',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      };

      mockSend.mockResolvedValueOnce({ Item: mockItem } as never);

      const result = await getMasterGym('test-id');

      expect(result).not.toBeNull();
      expect(result?.canonicalName).toBe('Gracie Barra');
      expect(result?.id).toBe('test-id');
    });

    it('should return null when not found', async () => {
      mockSend.mockResolvedValueOnce({ Item: undefined } as never);

      const result = await getMasterGym('nonexistent');

      expect(result).toBeNull();
    });

    it('should query with correct key structure', async () => {
      mockSend.mockResolvedValueOnce({ Item: undefined } as never);

      await getMasterGym('my-gym-id');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const input = mockSend.mock.calls[0][0].input as any;
      expect(input.TableName).toBe('bjj-tournament-tracker-test');
      expect(input.Key.PK).toBe('MASTERGYM#my-gym-id');
      expect(input.Key.SK).toBe('META');
    });
  });

  describe('searchMasterGyms', () => {
    it('should search gyms by name prefix using GSI1', async () => {
      const mockItems: MasterGymItem[] = [
        {
          PK: 'MASTERGYM#1',
          SK: 'META',
          GSI1PK: 'MASTERGYMS',
          GSI1SK: 'Gracie Barra',
          id: '1',
          canonicalName: 'Gracie Barra',
          city: null,
          country: null,
          address: null,
          website: null,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
        {
          PK: 'MASTERGYM#2',
          SK: 'META',
          GSI1PK: 'MASTERGYMS',
          GSI1SK: 'Gracie Humaita',
          id: '2',
          canonicalName: 'Gracie Humaita',
          city: null,
          country: null,
          address: null,
          website: null,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
      ];

      mockSend.mockResolvedValueOnce({ Items: mockItems } as never);

      const results = await searchMasterGyms('Gracie');

      expect(results).toHaveLength(2);
      expect(results[0].canonicalName).toBe('Gracie Barra');
      expect(results[1].canonicalName).toBe('Gracie Humaita');
    });

    it('should use GSI1 with begins_with for prefix search', async () => {
      mockSend.mockResolvedValueOnce({ Items: [] } as never);

      await searchMasterGyms('Alliance', 10);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const input = mockSend.mock.calls[0][0].input as any;
      expect(input.IndexName).toBe('GSI1');
      expect(input.KeyConditionExpression).toBe(
        'GSI1PK = :pk AND begins_with(GSI1SK, :prefix)'
      );
      expect(input.ExpressionAttributeValues[':pk']).toBe('MASTERGYMS');
      expect(input.ExpressionAttributeValues[':prefix']).toBe('Alliance');
      expect(input.Limit).toBe(10);
    });

    it('should return empty array when no gyms match', async () => {
      mockSend.mockResolvedValueOnce({ Items: [] } as never);

      const results = await searchMasterGyms('NonexistentGym');

      expect(results).toHaveLength(0);
    });

    it('should use default limit of 20', async () => {
      mockSend.mockResolvedValueOnce({ Items: [] } as never);

      await searchMasterGyms('Test');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const input = mockSend.mock.calls[0][0].input as any;
      expect(input.Limit).toBe(20);
    });
  });

  describe('linkSourceGymToMaster', () => {
    it('should update source gym with masterGymId', async () => {
      mockSend.mockResolvedValueOnce({} as never);

      await linkSourceGymToMaster('JJWL', 'gym-123', 'master-456');

      expect(mockSend).toHaveBeenCalledTimes(1);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const input = mockSend.mock.calls[0][0].input as any;
      expect(input.TableName).toBe('bjj-tournament-tracker-test');
      expect(input.Key.PK).toBe('SRCGYM#JJWL#gym-123');
      expect(input.Key.SK).toBe('META');
      expect(input.UpdateExpression).toContain('masterGymId = :masterGymId');
      expect(input.ExpressionAttributeValues[':masterGymId']).toBe('master-456');
    });

    it('should work for IBJJF gyms', async () => {
      mockSend.mockResolvedValueOnce({} as never);

      await linkSourceGymToMaster('IBJJF', 'ibjjf-789', 'master-abc');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const input = mockSend.mock.calls[0][0].input as any;
      expect(input.Key.PK).toBe('SRCGYM#IBJJF#ibjjf-789');
      expect(input.ExpressionAttributeValues[':masterGymId']).toBe('master-abc');
    });

    it('should update updatedAt timestamp', async () => {
      mockSend.mockResolvedValueOnce({} as never);

      await linkSourceGymToMaster('JJWL', 'gym-123', 'master-456');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const input = mockSend.mock.calls[0][0].input as any;
      expect(input.UpdateExpression).toContain('updatedAt = :updatedAt');
      expect(input.ExpressionAttributeValues[':updatedAt']).toBeDefined();
    });
  });

  describe('unlinkSourceGymFromMaster', () => {
    it('should set masterGymId to null', async () => {
      mockSend.mockResolvedValueOnce({} as never);

      await unlinkSourceGymFromMaster('JJWL', 'gym-123');

      expect(mockSend).toHaveBeenCalledTimes(1);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const input = mockSend.mock.calls[0][0].input as any;
      expect(input.TableName).toBe('bjj-tournament-tracker-test');
      expect(input.Key.PK).toBe('SRCGYM#JJWL#gym-123');
      expect(input.Key.SK).toBe('META');
      expect(input.ExpressionAttributeValues[':masterGymId']).toBeNull();
    });

    it('should work for IBJJF gyms', async () => {
      mockSend.mockResolvedValueOnce({} as never);

      await unlinkSourceGymFromMaster('IBJJF', 'ibjjf-789');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const input = mockSend.mock.calls[0][0].input as any;
      expect(input.Key.PK).toBe('SRCGYM#IBJJF#ibjjf-789');
    });

    it('should update updatedAt timestamp', async () => {
      mockSend.mockResolvedValueOnce({} as never);

      await unlinkSourceGymFromMaster('JJWL', 'gym-123');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const input = mockSend.mock.calls[0][0].input as any;
      expect(input.UpdateExpression).toContain('updatedAt = :updatedAt');
      expect(input.ExpressionAttributeValues[':updatedAt']).toBeDefined();
    });
  });
});
