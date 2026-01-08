import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import {
  getUserProfile,
  updateUserProfile,
  getAllUserMasterGymIds,
} from '../../db/userProfileQueries.js';
import { docClient } from '../../db/client.js';
import type { UserProfileItem } from '../../db/types.js';

// Mock the docClient
jest.mock('../../db/client.js', () => ({
  docClient: {
    send: jest.fn(),
  },
  TABLE_NAME: 'bjj-tournament-tracker-test',
  GSI1_NAME: 'GSI1',
}));

const mockSend = docClient.send as jest.MockedFunction<typeof docClient.send>;

describe('userProfileQueries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserProfile', () => {
    it('should return user profile when found', async () => {
      const mockProfile: UserProfileItem = {
        PK: 'USER#user-123',
        SK: 'PROFILE',
        email: 'test@example.com',
        name: 'Test User',
        homeCity: 'San Francisco',
        homeState: 'CA',
        nearestAirport: 'SFO',
        gymName: 'Gracie Barra',
        masterGymId: 'master-gym-456',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      };

      mockSend.mockResolvedValueOnce({ Item: mockProfile } as never);

      const result = await getUserProfile('user-123');

      expect(result).not.toBeNull();
      expect(result?.email).toBe('test@example.com');
      expect(result?.masterGymId).toBe('master-gym-456');
    });

    it('should return null when user not found', async () => {
      mockSend.mockResolvedValueOnce({ Item: undefined } as never);

      const result = await getUserProfile('nonexistent');

      expect(result).toBeNull();
    });

    it('should query with correct key structure', async () => {
      mockSend.mockResolvedValueOnce({ Item: undefined } as never);

      await getUserProfile('user-abc');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const input = mockSend.mock.calls[0][0].input as any;
      expect(input.TableName).toBe('bjj-tournament-tracker-test');
      expect(input.Key.PK).toBe('USER#user-abc');
      expect(input.Key.SK).toBe('PROFILE');
    });
  });

  describe('updateUserProfile', () => {
    it('should update profile fields', async () => {
      const mockUpdatedProfile: UserProfileItem = {
        PK: 'USER#user-123',
        SK: 'PROFILE',
        email: 'test@example.com',
        name: 'Updated Name',
        homeCity: 'San Francisco',
        homeState: 'CA',
        nearestAirport: 'SFO',
        gymName: 'Alliance',
        masterGymId: 'new-master-gym',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-08T00:00:00Z',
      };

      mockSend.mockResolvedValueOnce({ Attributes: mockUpdatedProfile } as never);

      const result = await updateUserProfile('user-123', {
        name: 'Updated Name',
        gymName: 'Alliance',
        masterGymId: 'new-master-gym',
      });

      expect(result).not.toBeNull();
      expect(result?.name).toBe('Updated Name');
      expect(result?.masterGymId).toBe('new-master-gym');
    });

    it('should update only masterGymId', async () => {
      mockSend.mockResolvedValueOnce({ Attributes: {} } as never);

      await updateUserProfile('user-123', { masterGymId: 'gym-999' });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const input = mockSend.mock.calls[0][0].input as any;
      expect(input.Key.PK).toBe('USER#user-123');
      expect(input.Key.SK).toBe('PROFILE');
      expect(input.UpdateExpression).toContain('masterGymId = :masterGymId');
      expect(input.ExpressionAttributeValues[':masterGymId']).toBe('gym-999');
    });

    it('should update updatedAt timestamp', async () => {
      mockSend.mockResolvedValueOnce({ Attributes: {} } as never);

      await updateUserProfile('user-123', { name: 'New Name' });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const input = mockSend.mock.calls[0][0].input as any;
      expect(input.UpdateExpression).toContain('updatedAt = :updatedAt');
      expect(input.ExpressionAttributeValues[':updatedAt']).toBeDefined();
    });

    it('should set masterGymId to null when explicitly passed', async () => {
      mockSend.mockResolvedValueOnce({ Attributes: {} } as never);

      await updateUserProfile('user-123', { masterGymId: null });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const input = mockSend.mock.calls[0][0].input as any;
      expect(input.ExpressionAttributeValues[':masterGymId']).toBeNull();
    });

    it('should return updated profile with ReturnValues ALL_NEW', async () => {
      mockSend.mockResolvedValueOnce({ Attributes: {} } as never);

      await updateUserProfile('user-123', { name: 'Test' });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const input = mockSend.mock.calls[0][0].input as any;
      expect(input.ReturnValues).toBe('ALL_NEW');
    });
  });

  describe('getAllUserMasterGymIds', () => {
    it('should return unique master gym IDs from all user profiles', async () => {
      const mockProfiles = [
        {
          PK: 'USER#user-1',
          SK: 'PROFILE',
          email: 'user1@test.com',
          masterGymId: 'gym-1',
        },
        {
          PK: 'USER#user-2',
          SK: 'PROFILE',
          email: 'user2@test.com',
          masterGymId: 'gym-2',
        },
        {
          PK: 'USER#user-3',
          SK: 'PROFILE',
          email: 'user3@test.com',
          masterGymId: 'gym-1', // Duplicate
        },
        {
          PK: 'USER#user-4',
          SK: 'PROFILE',
          email: 'user4@test.com',
          masterGymId: null, // No gym
        },
      ];

      mockSend.mockResolvedValueOnce({ Items: mockProfiles } as never);

      const result = await getAllUserMasterGymIds();

      expect(result).toHaveLength(2);
      expect(result).toContain('gym-1');
      expect(result).toContain('gym-2');
      expect(result).not.toContain(null);
    });

    it('should return empty array when no profiles exist', async () => {
      mockSend.mockResolvedValueOnce({ Items: [] } as never);

      const result = await getAllUserMasterGymIds();

      expect(result).toHaveLength(0);
    });

    it('should return empty array when no profiles have gym IDs', async () => {
      const mockProfiles = [
        {
          PK: 'USER#user-1',
          SK: 'PROFILE',
          email: 'user1@test.com',
          masterGymId: null,
        },
      ];

      mockSend.mockResolvedValueOnce({ Items: mockProfiles } as never);

      const result = await getAllUserMasterGymIds();

      expect(result).toHaveLength(0);
    });

    it('should scan with correct filter for PROFILE SK', async () => {
      mockSend.mockResolvedValueOnce({ Items: [] } as never);

      await getAllUserMasterGymIds();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const input = mockSend.mock.calls[0][0].input as any;
      expect(input.TableName).toBe('bjj-tournament-tracker-test');
      expect(input.FilterExpression).toBe('SK = :sk');
      expect(input.ExpressionAttributeValues[':sk']).toBe('PROFILE');
      expect(input.ProjectionExpression).toBe('masterGymId');
    });

    it('should handle paginated results', async () => {
      // First page
      mockSend.mockResolvedValueOnce({
        Items: [
          { PK: 'USER#1', SK: 'PROFILE', masterGymId: 'gym-1' },
          { PK: 'USER#2', SK: 'PROFILE', masterGymId: 'gym-2' },
        ],
        LastEvaluatedKey: { PK: 'USER#2', SK: 'PROFILE' },
      } as never);

      // Second page
      mockSend.mockResolvedValueOnce({
        Items: [
          { PK: 'USER#3', SK: 'PROFILE', masterGymId: 'gym-3' },
        ],
      } as never);

      const result = await getAllUserMasterGymIds();

      expect(mockSend).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(3);
      expect(result).toContain('gym-1');
      expect(result).toContain('gym-2');
      expect(result).toContain('gym-3');
    });
  });
});
