import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useUserGymRoster } from '@/hooks/useUserGymRoster';
import * as api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

// Mock the API module
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api');
  return {
    ...actual,
    fetchUserGymRoster: vi.fn(),
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

describe('useUserGymRoster', () => {
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

      const { result } = renderHook(() => useUserGymRoster('TOURN#IBJJF#123'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.fetchStatus).toBe('idle');
      });

      expect(api.fetchUserGymRoster).not.toHaveBeenCalled();
    });

    it('should fetch when user is authenticated', async () => {
      const mockRoster: api.UserGymRoster = {
        gymName: 'Test Gym',
        athletes: [
          { name: 'John Doe', belt: 'Blue', ageDiv: 'Adult', weight: 'Middle', gender: 'Male' },
        ],
        athleteCount: 1,
        fetchedAt: '2024-01-01T00:00:00.000Z',
      };
      mockGetAccessToken.mockResolvedValue('mock-token-123');
      vi.mocked(api.fetchUserGymRoster).mockResolvedValue(mockRoster);

      const { result } = renderHook(() => useUserGymRoster('TOURN#IBJJF#123'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(api.fetchUserGymRoster).toHaveBeenCalledWith('TOURN#IBJJF#123', 'mock-token-123');
      expect(result.current.data).toEqual(mockRoster);
    });
  });

  describe('data fetching', () => {
    beforeEach(() => {
      mockGetAccessToken.mockResolvedValue('mock-token');
    });

    it('should return roster with athletes', async () => {
      const mockRoster: api.UserGymRoster = {
        gymName: 'Test Academy',
        athletes: [
          { name: 'John Doe', belt: 'Blue', ageDiv: 'Adult', weight: 'Middle', gender: 'Male' },
          { name: 'Jane Doe', belt: 'Purple', ageDiv: 'Adult', weight: 'Light', gender: 'Female' },
          { name: 'Kid Athlete', belt: 'Grey', ageDiv: 'Juvenile', weight: 'Feather', gender: 'Male' },
        ],
        athleteCount: 3,
        fetchedAt: '2024-01-01T12:00:00.000Z',
      };
      vi.mocked(api.fetchUserGymRoster).mockResolvedValue(mockRoster);

      const { result } = renderHook(() => useUserGymRoster('TOURN#JJWL#456'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.athletes).toHaveLength(3);
      expect(result.current.data?.athleteCount).toBe(3);
      expect(result.current.data?.gymName).toBe('Test Academy');
    });

    it('should handle empty roster when user has no gym', async () => {
      const mockEmptyRoster: api.UserGymRoster = {
        gymName: null,
        athletes: [],
        athleteCount: 0,
        fetchedAt: null,
      };
      vi.mocked(api.fetchUserGymRoster).mockResolvedValue(mockEmptyRoster);

      const { result } = renderHook(() => useUserGymRoster('TOURN#IBJJF#999'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.athletes).toHaveLength(0);
      expect(result.current.data?.gymName).toBeNull();
    });
  });

  describe('enabled option', () => {
    beforeEach(() => {
      mockGetAccessToken.mockResolvedValue('mock-token');
    });

    it('should not fetch when enabled is false', async () => {
      const { result } = renderHook(
        () => useUserGymRoster('TOURN#IBJJF#123', { enabled: false }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.fetchStatus).toBe('idle');
      });

      expect(api.fetchUserGymRoster).not.toHaveBeenCalled();
    });

    it('should fetch when enabled is true', async () => {
      const mockRoster: api.UserGymRoster = {
        gymName: 'Test Gym',
        athletes: [],
        athleteCount: 0,
        fetchedAt: null,
      };
      vi.mocked(api.fetchUserGymRoster).mockResolvedValue(mockRoster);

      const { result } = renderHook(
        () => useUserGymRoster('TOURN#IBJJF#123', { enabled: true }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(api.fetchUserGymRoster).toHaveBeenCalled();
    });

    it('should not fetch when tournamentId is empty', async () => {
      const { result } = renderHook(() => useUserGymRoster(''), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.fetchStatus).toBe('idle');
      });

      expect(api.fetchUserGymRoster).not.toHaveBeenCalled();
    });
  });

  describe('caching behavior', () => {
    beforeEach(() => {
      mockGetAccessToken.mockResolvedValue('mock-token');
    });

    it('should use correct query key with tournament ID', async () => {
      const mockRoster: api.UserGymRoster = {
        gymName: 'Test',
        athletes: [],
        athleteCount: 0,
        fetchedAt: null,
      };
      vi.mocked(api.fetchUserGymRoster).mockResolvedValue(mockRoster);

      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
        },
      });

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client: queryClient }, children);

      const { result } = renderHook(
        () => useUserGymRoster('TOURN#IBJJF#specific'),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Verify the query cache has the expected key
      const queryState = queryClient.getQueryState(['userGymRoster', 'TOURN#IBJJF#specific']);
      expect(queryState).toBeDefined();
      expect(queryState?.data).toEqual(mockRoster);
    });

    it('should have 5 minute stale time', async () => {
      const mockRoster: api.UserGymRoster = {
        gymName: 'Test',
        athletes: [],
        athleteCount: 0,
        fetchedAt: null,
      };
      vi.mocked(api.fetchUserGymRoster).mockResolvedValue(mockRoster);

      const { result } = renderHook(() => useUserGymRoster('TOURN#IBJJF#123'), {
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

      const mockRoster: api.UserGymRoster = {
        gymName: 'Test',
        athletes: [],
        athleteCount: 0,
        fetchedAt: null,
      };
      let resolvePromise: (value: api.UserGymRoster) => void;
      const promise = new Promise<api.UserGymRoster>((resolve) => {
        resolvePromise = resolve;
      });
      vi.mocked(api.fetchUserGymRoster).mockReturnValue(promise);

      const { result } = renderHook(() => useUserGymRoster('TOURN#IBJJF#123'), {
        wrapper: createWrapper(),
      });

      // Should be loading initially
      expect(result.current.isLoading).toBe(true);

      // Resolve the promise
      resolvePromise!(mockRoster);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      mockGetAccessToken.mockResolvedValue('mock-token');
    });

    it('should handle fetch errors and retry', async () => {
      let callCount = 0;
      vi.mocked(api.fetchUserGymRoster).mockImplementation(() => {
        callCount++;
        return Promise.reject(new Error('Network error'));
      });

      // Configure retry with no delay for faster tests
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: 2,
            retryDelay: 0,
          },
        },
      });
      const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client: queryClient }, children);

      const { result } = renderHook(() => useUserGymRoster('TOURN#IBJJF#123'), {
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      // Should be called 3 times: initial + 2 retries
      expect(callCount).toBe(3);
      expect(result.current.error?.message).toBe('Network error');
    });
  });
});
