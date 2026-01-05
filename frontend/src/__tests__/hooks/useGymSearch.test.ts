import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useGymSearch, useGymRoster } from '@/hooks/useGymSearch';
import * as api from '@/lib/api';

// Mock the API module
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api');
  return {
    ...actual,
    searchGyms: vi.fn(),
    fetchGymRoster: vi.fn(),
  };
});

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

describe('useGymSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('query parameter validation', () => {
    it('should return empty array without API call when query is empty', async () => {
      const { result } = renderHook(() => useGymSearch(''), {
        wrapper: createWrapper(),
      });

      // Wait for hook to settle
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toEqual([]);
      expect(api.searchGyms).not.toHaveBeenCalled();
    });

    it('should return empty array without API call when query is 1 character', async () => {
      const { result } = renderHook(() => useGymSearch('a'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toEqual([]);
      expect(api.searchGyms).not.toHaveBeenCalled();
    });

    it('should make API call when query is 2+ characters', async () => {
      const mockGyms = [
        { org: 'JJWL', externalId: '123', name: 'Alliance BJJ' },
        { org: 'IBJJF', externalId: '456', name: 'Alliance HQ' },
      ];
      vi.mocked(api.searchGyms).mockResolvedValue(mockGyms);

      const { result } = renderHook(() => useGymSearch('al'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(api.searchGyms).toHaveBeenCalledWith('al');
      expect(result.current.data).toEqual(mockGyms);
    });
  });

  describe('API integration', () => {
    it('should pass search query to API', async () => {
      const mockGyms = [{ org: 'JJWL', externalId: '5713', name: 'Gracie Barra' }];
      vi.mocked(api.searchGyms).mockResolvedValue(mockGyms);

      const { result } = renderHook(() => useGymSearch('gracie'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(api.searchGyms).toHaveBeenCalledWith('gracie');
      expect(result.current.data).toEqual(mockGyms);
    });

    it('should handle API errors gracefully', async () => {
      const error = new Error('Network error');
      vi.mocked(api.searchGyms).mockRejectedValue(error);

      const { result } = renderHook(() => useGymSearch('test'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBe(error);
    });
  });

  describe('caching behavior', () => {
    it('should have 30 second stale time', async () => {
      const mockGyms = [{ org: 'JJWL', externalId: '123', name: 'Test Gym' }];
      vi.mocked(api.searchGyms).mockResolvedValue(mockGyms);

      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
          },
        },
      });

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client: queryClient }, children);

      const { result } = renderHook(() => useGymSearch('test'), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Check the query cache configuration
      const queryState = queryClient.getQueryState(['gyms', 'search', 'test']);
      expect(queryState).toBeDefined();

      // The stale time is set at hook level - verify data is not stale immediately
      expect(result.current.isStale).toBe(false);
    });
  });

  describe('loading states', () => {
    it('should show loading state while fetching', async () => {
      let resolvePromise: (value: api.Gym[]) => void;
      const promise = new Promise<api.Gym[]>((resolve) => {
        resolvePromise = resolve;
      });
      vi.mocked(api.searchGyms).mockReturnValue(promise);

      const { result } = renderHook(() => useGymSearch('loading'), {
        wrapper: createWrapper(),
      });

      // Should be loading initially
      expect(result.current.isLoading).toBe(true);

      // Resolve the promise
      resolvePromise!([{ org: 'JJWL', externalId: '1', name: 'Gym' }]);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });
  });
});

describe('useGymRoster', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should fetch roster when enabled', async () => {
    const mockRoster: api.GymRoster = {
      gymExternalId: '5713',
      gymName: 'Gracie Barra Austin',
      athletes: [
        { name: 'John Doe', belt: 'Blue', ageDiv: 'Adult', weight: 'Light', gender: 'Male' },
      ],
      athleteCount: 1,
      fetchedAt: '2024-01-01T00:00:00.000Z',
    };
    vi.mocked(api.fetchGymRoster).mockResolvedValue(mockRoster);

    const { result } = renderHook(
      () => useGymRoster('JJWL', '5713', 'tournament-123'),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(api.fetchGymRoster).toHaveBeenCalledWith('JJWL', '5713', 'tournament-123');
    expect(result.current.data).toEqual(mockRoster);
  });

  it('should not fetch when org is empty', async () => {
    const { result } = renderHook(() => useGymRoster('', '5713', 'tournament-123'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.fetchStatus).toBe('idle');
    });

    expect(api.fetchGymRoster).not.toHaveBeenCalled();
  });

  it('should not fetch when externalId is empty', async () => {
    const { result } = renderHook(() => useGymRoster('JJWL', '', 'tournament-123'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.fetchStatus).toBe('idle');
    });

    expect(api.fetchGymRoster).not.toHaveBeenCalled();
  });

  it('should not fetch when tournamentId is empty', async () => {
    const { result } = renderHook(() => useGymRoster('JJWL', '5713', ''), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.fetchStatus).toBe('idle');
    });

    expect(api.fetchGymRoster).not.toHaveBeenCalled();
  });

  it('should handle API errors', async () => {
    const error = new Error('Failed to fetch roster');
    vi.mocked(api.fetchGymRoster).mockRejectedValue(error);

    const { result } = renderHook(
      () => useGymRoster('JJWL', '5713', 'tournament-123'),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBe(error);
  });

  it('should return athletes array from roster', async () => {
    const mockRoster: api.GymRoster = {
      gymExternalId: '5713',
      gymName: 'Test Gym',
      athletes: [
        { name: 'Athlete 1', belt: 'White', ageDiv: 'Adult', weight: 'Light', gender: 'Male' },
        { name: 'Athlete 2', belt: 'Blue', ageDiv: 'Juvenile', weight: 'Feather', gender: 'Female' },
      ],
      athleteCount: 2,
      fetchedAt: '2024-01-01T00:00:00.000Z',
    };
    vi.mocked(api.fetchGymRoster).mockResolvedValue(mockRoster);

    const { result } = renderHook(
      () => useGymRoster('JJWL', '5713', 'tournament-123'),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.athletes).toHaveLength(2);
    expect(result.current.data?.athleteCount).toBe(2);
  });
});
