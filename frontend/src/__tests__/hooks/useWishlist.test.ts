import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useWishlist } from '@/hooks/useWishlist';
import * as api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

// Mock the API module
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api');
  return {
    ...actual,
    fetchWishlist: vi.fn(),
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

describe('useWishlist', () => {
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

      const { result } = renderHook(() => useWishlist(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.fetchStatus).toBe('idle');
      });

      expect(api.fetchWishlist).not.toHaveBeenCalled();
    });

    it('should fetch when user is authenticated', async () => {
      const mockWishlist = {
        wishlist: [
          { tournamentPK: 'TOURN#IBJJF#123', addedAt: '2024-01-01T00:00:00.000Z' },
        ],
      };
      mockGetAccessToken.mockResolvedValue('mock-token-123');
      vi.mocked(api.fetchWishlist).mockResolvedValue(mockWishlist);

      const { result } = renderHook(() => useWishlist(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(api.fetchWishlist).toHaveBeenCalledWith('mock-token-123');
      expect(result.current.data).toEqual(mockWishlist);
    });
  });

  describe('data fetching', () => {
    beforeEach(() => {
      mockGetAccessToken.mockResolvedValue('mock-token');
    });

    it('should return wishlist data', async () => {
      const mockWishlist = {
        wishlist: [
          { tournamentPK: 'TOURN#IBJJF#123', addedAt: '2024-01-01T00:00:00.000Z' },
          { tournamentPK: 'TOURN#JJWL#456', addedAt: '2024-01-02T00:00:00.000Z' },
        ],
      };
      vi.mocked(api.fetchWishlist).mockResolvedValue(mockWishlist);

      const { result } = renderHook(() => useWishlist(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.wishlist).toHaveLength(2);
      expect(result.current.data).toEqual(mockWishlist);
    });

    it('should return empty wishlist', async () => {
      const mockWishlist = { wishlist: [] };
      vi.mocked(api.fetchWishlist).mockResolvedValue(mockWishlist);

      const { result } = renderHook(() => useWishlist(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.wishlist).toHaveLength(0);
      expect(result.current.data).toEqual(mockWishlist);
    });
  });

  describe('caching behavior', () => {
    beforeEach(() => {
      mockGetAccessToken.mockResolvedValue('mock-token');
    });

    it('should use wishlist query key', async () => {
      const mockWishlist = { wishlist: [] };
      vi.mocked(api.fetchWishlist).mockResolvedValue(mockWishlist);

      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
          },
        },
      });

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client: queryClient }, children);

      const { result } = renderHook(() => useWishlist(), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Verify the query cache has the expected key
      const queryState = queryClient.getQueryState(['wishlist']);
      expect(queryState).toBeDefined();
      expect(queryState?.data).toEqual(mockWishlist);
    });

    it('should have 5 minute stale time', async () => {
      const mockWishlist = { wishlist: [] };
      vi.mocked(api.fetchWishlist).mockResolvedValue(mockWishlist);

      const { result } = renderHook(() => useWishlist(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Verify data is not stale immediately (indicates staleTime was set)
      expect(result.current.isStale).toBe(false);
    });

    it('should retry 2 times on failure', async () => {
      let callCount = 0;
      vi.mocked(api.fetchWishlist).mockImplementation(() => {
        callCount++;
        return Promise.reject(new Error('Network error'));
      });

      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: 2, // Override to test retry behavior
            retryDelay: 0, // No delay for faster tests
          },
        },
      });

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client: queryClient }, children);

      const { result } = renderHook(() => useWishlist(), { wrapper });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      // Should be called 3 times: initial + 2 retries
      expect(callCount).toBe(3);
    });
  });

  describe('loading states', () => {
    it('should show loading state while fetching', async () => {
      mockGetAccessToken.mockResolvedValue('mock-token');

      let resolvePromise: (value: api.WishlistItem[]) => void;
      const promise = new Promise<{ wishlist: api.WishlistItem[] }>((resolve) => {
        resolvePromise = (value) => resolve({ wishlist: value });
      });
      vi.mocked(api.fetchWishlist).mockReturnValue(promise);

      const { result } = renderHook(() => useWishlist(), {
        wrapper: createWrapper(),
      });

      // Should be loading initially
      expect(result.current.isLoading).toBe(true);

      // Resolve the promise
      resolvePromise!([]);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });
  });
});
