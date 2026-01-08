import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Define mock implementations inside vi.hoisted to ensure they exist before vi.mock runs
const { mockGet, mockPut } = vi.hoisted(() => {
  return {
    mockGet: vi.fn(),
    mockPut: vi.fn(),
  };
});

// Mock axios at the module level
vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      get: mockGet,
      put: mockPut,
      post: vi.fn(),
      delete: vi.fn(),
    })),
  },
}));

// Import after mock setup - now the api.ts will use our mocked axios
import {
  fetchUserProfile,
  updateUserProfile,
  fetchUserGymRoster,
  type UserProfile,
  type UserProfileUpdate,
  type UserGymRoster,
} from '@/lib/api';

describe('User Profile API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('fetchUserProfile', () => {
    it('should fetch user profile with authorization header', async () => {
      const mockProfile: UserProfile = {
        email: 'test@example.com',
        name: 'Test User',
        homeCity: 'Los Angeles',
        homeState: 'CA',
        nearestAirport: 'LAX',
        gymName: 'Test Gym',
        masterGymId: 'master-gym-123',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      mockGet.mockResolvedValueOnce({ data: mockProfile });

      const result = await fetchUserProfile('mock-access-token');

      expect(mockGet).toHaveBeenCalledWith('/profile', {
        headers: { Authorization: 'Bearer mock-access-token' },
      });
      expect(result).toEqual(mockProfile);
    });

    it('should throw error when request fails', async () => {
      mockGet.mockRejectedValueOnce(new Error('Network error'));

      await expect(fetchUserProfile('mock-token')).rejects.toThrow('Network error');
    });

    it('should handle profile with null optional fields', async () => {
      const mockProfile: UserProfile = {
        email: 'test@example.com',
        name: null,
        homeCity: null,
        homeState: null,
        nearestAirport: null,
        gymName: null,
        masterGymId: null,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      mockGet.mockResolvedValueOnce({ data: mockProfile });

      const result = await fetchUserProfile('mock-token');

      expect(result.name).toBeNull();
      expect(result.masterGymId).toBeNull();
    });
  });

  describe('updateUserProfile', () => {
    it('should update user profile with authorization header', async () => {
      const updates: UserProfileUpdate = {
        name: 'Updated Name',
        homeCity: 'San Francisco',
        masterGymId: 'new-gym-456',
      };

      const mockUpdatedProfile: UserProfile = {
        email: 'test@example.com',
        name: 'Updated Name',
        homeCity: 'San Francisco',
        homeState: 'CA',
        nearestAirport: 'SFO',
        gymName: 'New Gym',
        masterGymId: 'new-gym-456',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-02T00:00:00.000Z',
      };

      mockPut.mockResolvedValueOnce({ data: mockUpdatedProfile });

      const result = await updateUserProfile('mock-access-token', updates);

      expect(mockPut).toHaveBeenCalledWith('/profile', updates, {
        headers: { Authorization: 'Bearer mock-access-token' },
      });
      expect(result).toEqual(mockUpdatedProfile);
    });

    it('should handle partial updates', async () => {
      const updates: UserProfileUpdate = {
        name: 'Only Name Updated',
      };

      const mockUpdatedProfile: UserProfile = {
        email: 'test@example.com',
        name: 'Only Name Updated',
        homeCity: null,
        homeState: null,
        nearestAirport: null,
        gymName: null,
        masterGymId: null,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-02T00:00:00.000Z',
      };

      mockPut.mockResolvedValueOnce({ data: mockUpdatedProfile });

      const result = await updateUserProfile('mock-token', updates);

      expect(mockPut).toHaveBeenCalledWith('/profile', updates, {
        headers: { Authorization: 'Bearer mock-token' },
      });
      expect(result.name).toBe('Only Name Updated');
    });

    it('should throw error when update fails', async () => {
      mockPut.mockRejectedValueOnce(new Error('Unauthorized'));

      await expect(
        updateUserProfile('invalid-token', { name: 'Test' })
      ).rejects.toThrow('Unauthorized');
    });
  });

  describe('fetchUserGymRoster', () => {
    it('should fetch user gym roster for a tournament with authorization header', async () => {
      const mockRoster: UserGymRoster = {
        gymName: 'Test Gym',
        athletes: [
          { name: 'John Doe', belt: 'Blue', ageDiv: 'Adult', weight: 'Middle', gender: 'Male' },
          { name: 'Jane Doe', belt: 'Purple', ageDiv: 'Adult', weight: 'Light', gender: 'Female' },
        ],
        athleteCount: 2,
        fetchedAt: '2024-01-01T00:00:00.000Z',
      };

      mockGet.mockResolvedValueOnce({ data: mockRoster });

      const result = await fetchUserGymRoster('TOURN#IBJJF#123', 'mock-access-token');

      expect(mockGet).toHaveBeenCalledWith('/tournaments/TOURN%23IBJJF%23123/roster', {
        headers: { Authorization: 'Bearer mock-access-token' },
      });
      expect(result).toEqual(mockRoster);
    });

    it('should return empty roster when user has no gym', async () => {
      const mockEmptyRoster: UserGymRoster = {
        gymName: null,
        athletes: [],
        athleteCount: 0,
        fetchedAt: null,
      };

      mockGet.mockResolvedValueOnce({ data: mockEmptyRoster });

      const result = await fetchUserGymRoster('TOURN#JJWL#456', 'mock-token');

      expect(result.athletes).toHaveLength(0);
      expect(result.gymName).toBeNull();
    });

    it('should encode tournament ID properly', async () => {
      const mockRoster: UserGymRoster = {
        gymName: 'Test Gym',
        athletes: [],
        athleteCount: 0,
        fetchedAt: null,
      };

      mockGet.mockResolvedValueOnce({ data: mockRoster });

      await fetchUserGymRoster('TOURN#IBJJF#test/special', 'mock-token');

      // Should encode # and /
      expect(mockGet).toHaveBeenCalledWith(
        '/tournaments/TOURN%23IBJJF%23test%2Fspecial/roster',
        expect.any(Object)
      );
    });

    it('should throw error when request fails', async () => {
      mockGet.mockRejectedValueOnce(new Error('Not found'));

      await expect(
        fetchUserGymRoster('TOURN#IBJJF#999', 'mock-token')
      ).rejects.toThrow('Not found');
    });
  });
});
