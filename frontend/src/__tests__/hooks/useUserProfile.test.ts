import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useUserProfile, useUpdateUserProfile } from '@/hooks/useUserProfile';
import * as api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

// Mock the API module
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api');
  return {
    ...actual,
    fetchUserProfile: vi.fn(),
    updateUserProfile: vi.fn(),
  };
});

// Mock the auth store
vi.mock('@/stores/authStore', () => ({
  useAuthStore: vi.fn(),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      children
    );
  };
};

describe('useUserProfile', () => {
  const mockGetAccessToken = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: authenticated user
    vi.mocked(useAuthStore).mockReturnValue({
      isAuthenticated: true,
      getAccessToken: mockGetAccessToken,
      user: null,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('authentication', () => {
    it('should not fetch when user is not authenticated', async () => {
      vi.mocked(useAuthStore).mockReturnValue({
        isAuthenticated: false,
        getAccessToken: mockGetAccessToken,
        user: null,
        isLoading: false,
        login: vi.fn(),
        logout: vi.fn(),
      });

      const { result } = renderHook(() => useUserProfile(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.fetchStatus).toBe('idle');
      });

      expect(api.fetchUserProfile).not.toHaveBeenCalled();
    });

    it('should fetch when user is authenticated', async () => {
      const mockProfile: api.UserProfile = {
        email: 'test@example.com',
        name: 'Test User',
        homeCity: 'Los Angeles',
        homeState: 'CA',
        nearestAirport: 'LAX',
        gymName: 'Test Gym',
        masterGymId: 'gym-123',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };
      mockGetAccessToken.mockResolvedValue('mock-token-123');
      vi.mocked(api.fetchUserProfile).mockResolvedValue(mockProfile);

      const { result } = renderHook(() => useUserProfile(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(api.fetchUserProfile).toHaveBeenCalledWith('mock-token-123');
      expect(result.current.data).toEqual(mockProfile);
    });
  });

  describe('data fetching', () => {
    beforeEach(() => {
      mockGetAccessToken.mockResolvedValue('mock-token');
    });

    it('should return user profile data', async () => {
      const mockProfile: api.UserProfile = {
        email: 'test@example.com',
        name: 'Test User',
        homeCity: 'San Francisco',
        homeState: 'CA',
        nearestAirport: 'SFO',
        gymName: 'My Gym',
        masterGymId: 'master-gym-456',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };
      vi.mocked(api.fetchUserProfile).mockResolvedValue(mockProfile);

      const { result } = renderHook(() => useUserProfile(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockProfile);
      expect(result.current.data?.name).toBe('Test User');
      expect(result.current.data?.masterGymId).toBe('master-gym-456');
    });

    it('should handle profile with null gym', async () => {
      const mockProfile: api.UserProfile = {
        email: 'test@example.com',
        name: 'New User',
        homeCity: null,
        homeState: null,
        nearestAirport: null,
        gymName: null,
        masterGymId: null,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };
      vi.mocked(api.fetchUserProfile).mockResolvedValue(mockProfile);

      const { result } = renderHook(() => useUserProfile(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.masterGymId).toBeNull();
    });
  });

  describe('caching behavior', () => {
    beforeEach(() => {
      mockGetAccessToken.mockResolvedValue('mock-token');
    });

    it('should use userProfile query key', async () => {
      const mockProfile: api.UserProfile = {
        email: 'test@example.com',
        name: 'Test',
        homeCity: null,
        homeState: null,
        nearestAirport: null,
        gymName: null,
        masterGymId: null,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };
      vi.mocked(api.fetchUserProfile).mockResolvedValue(mockProfile);

      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
          },
        },
      });

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client: queryClient }, children);

      const { result } = renderHook(() => useUserProfile(), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Verify the query cache has the expected key
      const queryState = queryClient.getQueryState(['userProfile']);
      expect(queryState).toBeDefined();
      expect(queryState?.data).toEqual(mockProfile);
    });

    it('should have 5 minute stale time', async () => {
      const mockProfile: api.UserProfile = {
        email: 'test@example.com',
        name: 'Test',
        homeCity: null,
        homeState: null,
        nearestAirport: null,
        gymName: null,
        masterGymId: null,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };
      vi.mocked(api.fetchUserProfile).mockResolvedValue(mockProfile);

      const { result } = renderHook(() => useUserProfile(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Verify data is not stale immediately (indicates staleTime was set)
      expect(result.current.isStale).toBe(false);
    });
  });

  describe('loading states', () => {
    it('should show loading state while fetching', async () => {
      mockGetAccessToken.mockResolvedValue('mock-token');

      const mockProfile: api.UserProfile = {
        email: 'test@example.com',
        name: 'Test',
        homeCity: null,
        homeState: null,
        nearestAirport: null,
        gymName: null,
        masterGymId: null,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };
      let resolvePromise: (value: api.UserProfile) => void;
      const promise = new Promise<api.UserProfile>((resolve) => {
        resolvePromise = resolve;
      });
      vi.mocked(api.fetchUserProfile).mockReturnValue(promise);

      const { result } = renderHook(() => useUserProfile(), {
        wrapper: createWrapper(),
      });

      // Should be loading initially
      expect(result.current.isLoading).toBe(true);

      // Resolve the promise
      resolvePromise!(mockProfile);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });
  });
});

describe('useUpdateUserProfile', () => {
  const mockGetAccessToken = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuthStore).mockReturnValue({
      isAuthenticated: true,
      getAccessToken: mockGetAccessToken,
      user: null,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should update user profile successfully', async () => {
    mockGetAccessToken.mockResolvedValue('mock-token');

    const updatedProfile: api.UserProfile = {
      email: 'test@example.com',
      name: 'Updated Name',
      homeCity: 'New York',
      homeState: 'NY',
      nearestAirport: 'JFK',
      gymName: 'Updated Gym',
      masterGymId: 'new-gym-789',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-02T00:00:00.000Z',
    };
    vi.mocked(api.updateUserProfile).mockResolvedValue(updatedProfile);

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);

    const { result } = renderHook(() => useUpdateUserProfile(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ name: 'Updated Name', masterGymId: 'new-gym-789' });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(api.updateUserProfile).toHaveBeenCalledWith('mock-token', {
      name: 'Updated Name',
      masterGymId: 'new-gym-789',
    });
    expect(result.current.data).toEqual(updatedProfile);
  });

  it('should invalidate userProfile query on success', async () => {
    mockGetAccessToken.mockResolvedValue('mock-token');

    const updatedProfile: api.UserProfile = {
      email: 'test@example.com',
      name: 'Updated',
      homeCity: null,
      homeState: null,
      nearestAirport: null,
      gymName: null,
      masterGymId: null,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-02T00:00:00.000Z',
    };
    vi.mocked(api.updateUserProfile).mockResolvedValue(updatedProfile);

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);

    const { result } = renderHook(() => useUpdateUserProfile(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ name: 'Updated' });
    });

    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['userProfile'] });
  });

  it('should handle update failure', async () => {
    mockGetAccessToken.mockResolvedValue('mock-token');
    vi.mocked(api.updateUserProfile).mockRejectedValue(new Error('Update failed'));

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);

    const { result } = renderHook(() => useUpdateUserProfile(), { wrapper });

    await act(async () => {
      try {
        await result.current.mutateAsync({ name: 'Test' });
      } catch {
        // Expected to fail
      }
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });

  it('should throw when not authenticated', async () => {
    mockGetAccessToken.mockResolvedValue(null);

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);

    const { result } = renderHook(() => useUpdateUserProfile(), { wrapper });

    await act(async () => {
      try {
        await result.current.mutateAsync({ name: 'Test' });
      } catch (e) {
        expect((e as Error).message).toBe('Not authenticated');
      }
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
