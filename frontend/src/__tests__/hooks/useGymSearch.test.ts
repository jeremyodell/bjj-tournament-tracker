import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useGymSearch, useGymRoster, parseGymSourceId, useGymRosterBySourceId } from '@/hooks/useGymSearch';
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

describe('parseGymSourceId', () => {
  it('should parse valid JJWL source ID', () => {
    const result = parseGymSourceId('JJWL#5713');
    expect(result).toEqual({ org: 'JJWL', externalId: '5713' });
  });

  it('should parse valid IBJJF source ID', () => {
    const result = parseGymSourceId('IBJJF#12345');
    expect(result).toEqual({ org: 'IBJJF', externalId: '12345' });
  });

  it('should return null for null input', () => {
    const result = parseGymSourceId(null);
    expect(result).toBeNull();
  });

  it('should return null for undefined input', () => {
    const result = parseGymSourceId(undefined);
    expect(result).toBeNull();
  });

  it('should return null for empty string', () => {
    const result = parseGymSourceId('');
    expect(result).toBeNull();
  });

  it('should return null for invalid format without hash', () => {
    const result = parseGymSourceId('JJWL5713');
    expect(result).toBeNull();
  });

  it('should return null for invalid format with only hash', () => {
    const result = parseGymSourceId('#');
    expect(result).toBeNull();
  });

  it('should return null for format missing org', () => {
    const result = parseGymSourceId('#5713');
    expect(result).toBeNull();
  });

  it('should return null for format missing externalId', () => {
    const result = parseGymSourceId('JJWL#');
    expect(result).toBeNull();
  });

  it('should handle source ID with multiple hashes by using first hash as separator', () => {
    const result = parseGymSourceId('JJWL#123#456');
    expect(result).toEqual({ org: 'JJWL', externalId: '123#456' });
  });
});

describe('useGymRosterBySourceId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should fetch roster when valid gymSourceId is provided', async () => {
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
      () => useGymRosterBySourceId('JJWL#5713', 'tournament-123'),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(api.fetchGymRoster).toHaveBeenCalledWith('JJWL', '5713', 'tournament-123');
    expect(result.current.data).toEqual(mockRoster);
  });

  it('should not fetch when gymSourceId is null', async () => {
    const { result } = renderHook(
      () => useGymRosterBySourceId(null, 'tournament-123'),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.fetchStatus).toBe('idle');
    });

    expect(api.fetchGymRoster).not.toHaveBeenCalled();
    expect(result.current.data).toBeUndefined();
  });

  it('should not fetch when gymSourceId is empty string', async () => {
    const { result } = renderHook(
      () => useGymRosterBySourceId('', 'tournament-123'),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.fetchStatus).toBe('idle');
    });

    expect(api.fetchGymRoster).not.toHaveBeenCalled();
  });

  it('should not fetch when gymSourceId has invalid format', async () => {
    const { result } = renderHook(
      () => useGymRosterBySourceId('invalid-format', 'tournament-123'),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.fetchStatus).toBe('idle');
    });

    expect(api.fetchGymRoster).not.toHaveBeenCalled();
  });

  it('should not fetch when tournamentId is empty', async () => {
    const { result } = renderHook(
      () => useGymRosterBySourceId('JJWL#5713', ''),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.fetchStatus).toBe('idle');
    });

    expect(api.fetchGymRoster).not.toHaveBeenCalled();
  });

  it('should not fetch when enabled is false', async () => {
    const { result } = renderHook(
      () => useGymRosterBySourceId('JJWL#5713', 'tournament-123', { enabled: false }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.fetchStatus).toBe('idle');
    });

    expect(api.fetchGymRoster).not.toHaveBeenCalled();
  });

  it('should fetch when enabled is true', async () => {
    const mockRoster: api.GymRoster = {
      gymExternalId: '5713',
      gymName: 'Test Gym',
      athletes: [],
      athleteCount: 0,
      fetchedAt: '2024-01-01T00:00:00.000Z',
    };
    vi.mocked(api.fetchGymRoster).mockResolvedValue(mockRoster);

    const { result } = renderHook(
      () => useGymRosterBySourceId('JJWL#5713', 'tournament-123', { enabled: true }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(api.fetchGymRoster).toHaveBeenCalled();
  });

  it('should have 1-hour stale time', async () => {
    const mockRoster: api.GymRoster = {
      gymExternalId: '5713',
      gymName: 'Test Gym',
      athletes: [],
      athleteCount: 0,
      fetchedAt: '2024-01-01T00:00:00.000Z',
    };
    vi.mocked(api.fetchGymRoster).mockResolvedValue(mockRoster);

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);

    const { result } = renderHook(
      () => useGymRosterBySourceId('JJWL#5713', 'tournament-123'),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Verify data is not stale immediately (indicates stale time was set)
    expect(result.current.isStale).toBe(false);

    // Verify the query cache has the expected key structure
    const queryState = queryClient.getQueryState(['gyms', 'roster', 'JJWL', '5713', 'tournament-123']);
    expect(queryState).toBeDefined();
  });

  it('should handle IBJJF source ID correctly', async () => {
    const mockRoster: api.GymRoster = {
      gymExternalId: '99999',
      gymName: 'Alliance BJJ',
      athletes: [],
      athleteCount: 0,
      fetchedAt: '2024-01-01T00:00:00.000Z',
    };
    vi.mocked(api.fetchGymRoster).mockResolvedValue(mockRoster);

    const { result } = renderHook(
      () => useGymRosterBySourceId('IBJJF#99999', 'tournament-456'),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(api.fetchGymRoster).toHaveBeenCalledWith('IBJJF', '99999', 'tournament-456');
  });

  it('should handle API errors gracefully', async () => {
    const error = new Error('Failed to fetch roster');
    vi.mocked(api.fetchGymRoster).mockRejectedValue(error);

    const { result } = renderHook(
      () => useGymRosterBySourceId('JJWL#5713', 'tournament-123'),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBe(error);
  });
});
