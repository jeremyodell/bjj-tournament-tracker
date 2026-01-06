import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useAddToWishlist } from '@/hooks/useAddToWishlist';
import * as api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import type { Tournament } from '@/lib/types';

// Mock the API module
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api');
  return {
    ...actual,
    addToWishlist: vi.fn(),
  };
});

// Mock the auth store
vi.mock('@/stores/authStore', () => ({
  useAuthStore: vi.fn(),
}));

// Mock toast
vi.mock('@/lib/toastConfig', () => ({
  toastError: vi.fn(),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
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

const mockTournament: Tournament = {
  id: '123',
  externalId: '123',
  name: 'Test Tournament',
  org: 'IBJJF',
  location: {
    city: 'Austin',
    state: 'TX',
    country: 'USA',
  },
  startDate: '2024-06-01',
  endDate: '2024-06-02',
  registrationDeadline: '2024-05-25',
  url: 'https://example.com',
};

describe('useAddToWishlist', () => {
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
    mockGetAccessToken.mockResolvedValue('mock-token-123');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('mutation execution', () => {
    it('should call addToWishlist API with correct parameters', async () => {
      vi.mocked(api.addToWishlist).mockResolvedValue(undefined);

      const { result } = renderHook(() => useAddToWishlist(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate(mockTournament);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(api.addToWishlist).toHaveBeenCalledWith('mock-token-123', 'TOURN#IBJJF#123');
    });

    it('should throw error when not authenticated', async () => {
      mockGetAccessToken.mockResolvedValue(null);

      const { result } = renderHook(() => useAddToWishlist(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate(mockTournament);
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toEqual(new Error('Not authenticated'));
    });
  });

  describe('optimistic updates', () => {
    it('should optimistically add tournament to cache', async () => {
      vi.mocked(api.addToWishlist).mockImplementation(
        () => new Promise(() => {}) // Never resolves to test optimistic state
      );

      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      });

      // Pre-populate cache with initial wishlist
      queryClient.setQueryData(['wishlist'], {
        wishlist: [
          { tournamentPK: 'TOURN#JJWL#456', addedAt: '2024-01-01T00:00:00.000Z' },
        ],
      });

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client: queryClient }, children);

      const { result } = renderHook(() => useAddToWishlist(), { wrapper });

      act(() => {
        result.current.mutate(mockTournament);
      });

      // Check optimistic update happened immediately
      await waitFor(() => {
        const wishlistData = queryClient.getQueryData<{
          wishlist: api.WishlistItem[];
        }>(['wishlist']);
        expect(wishlistData?.wishlist).toHaveLength(2);
        expect(wishlistData?.wishlist.some(
          (item) => item.tournamentPK === 'TOURN#IBJJF#123'
        )).toBe(true);
      });
    });

    it('should prevent duplicate additions', async () => {
      vi.mocked(api.addToWishlist).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      });

      // Pre-populate cache with tournament already in wishlist
      queryClient.setQueryData(['wishlist'], {
        wishlist: [
          { tournamentPK: 'TOURN#IBJJF#123', addedAt: '2024-01-01T00:00:00.000Z' },
        ],
      });

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client: queryClient }, children);

      const { result } = renderHook(() => useAddToWishlist(), { wrapper });

      act(() => {
        result.current.mutate(mockTournament);
      });

      // Should not add duplicate
      await waitFor(() => {
        const wishlistData = queryClient.getQueryData<{
          wishlist: api.WishlistItem[];
        }>(['wishlist']);
        expect(wishlistData?.wishlist).toHaveLength(1);
      });
    });

    it('should create new wishlist if cache is empty', async () => {
      vi.mocked(api.addToWishlist).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      });

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client: queryClient }, children);

      const { result } = renderHook(() => useAddToWishlist(), { wrapper });

      act(() => {
        result.current.mutate(mockTournament);
      });

      // Should create new wishlist with tournament
      await waitFor(() => {
        const wishlistData = queryClient.getQueryData<{
          wishlist: api.WishlistItem[];
        }>(['wishlist']);
        expect(wishlistData?.wishlist).toHaveLength(1);
        expect(wishlistData?.wishlist[0].tournamentPK).toBe('TOURN#IBJJF#123');
      });
    });
  });

  describe('error handling and rollback', () => {
    it('should rollback optimistic update on error', async () => {
      const error = new Error('API error');
      vi.mocked(api.addToWishlist).mockRejectedValue(error);

      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      });

      // Pre-populate cache with initial wishlist
      const initialWishlist = {
        wishlist: [
          { tournamentPK: 'TOURN#JJWL#456', addedAt: '2024-01-01T00:00:00.000Z' },
        ],
      };
      queryClient.setQueryData(['wishlist'], initialWishlist);

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client: queryClient }, children);

      const { result } = renderHook(() => useAddToWishlist(), { wrapper });

      await act(async () => {
        result.current.mutate(mockTournament);
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      // Should rollback to initial state
      const wishlistData = queryClient.getQueryData(['wishlist']);
      expect(wishlistData).toEqual(initialWishlist);
    });

    it('should show error toast on failure', async () => {
      const { toastError } = await import('@/lib/toastConfig');
      const error = new Error('Network error');
      vi.mocked(api.addToWishlist).mockRejectedValue(error);

      const { result } = renderHook(() => useAddToWishlist(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        result.current.mutate(mockTournament);
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(toastError).toHaveBeenCalledWith(
        'Failed to track tournament. Please try again.'
      );
    });
  });

  describe('cache invalidation', () => {
    it('should refetch wishlist after successful mutation', async () => {
      vi.mocked(api.addToWishlist).mockResolvedValue(undefined);

      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      });

      const refetchSpy = vi.spyOn(queryClient, 'refetchQueries');

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client: queryClient }, children);

      const { result } = renderHook(() => useAddToWishlist(), { wrapper });

      await act(async () => {
        result.current.mutate(mockTournament);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(refetchSpy).toHaveBeenCalledWith({ queryKey: ['wishlist'] });
    });

    it('should refetch wishlist after error', async () => {
      vi.mocked(api.addToWishlist).mockRejectedValue(new Error('API error'));

      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      });

      const refetchSpy = vi.spyOn(queryClient, 'refetchQueries');

      const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client: queryClient }, children);

      const { result } = renderHook(() => useAddToWishlist(), { wrapper });

      await act(async () => {
        result.current.mutate(mockTournament);
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(refetchSpy).toHaveBeenCalledWith({ queryKey: ['wishlist'] });
    });
  });

  describe('loading states', () => {
    it('should show loading state during mutation', async () => {
      let resolvePromise: () => void;
      const promise = new Promise<void>((resolve) => {
        resolvePromise = resolve;
      });
      vi.mocked(api.addToWishlist).mockReturnValue(promise);

      const { result } = renderHook(() => useAddToWishlist(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.mutate(mockTournament);
      });

      // Should be loading after mutation starts
      await waitFor(() => {
        expect(result.current.isPending).toBe(true);
      });

      // Resolve the promise
      await act(async () => {
        resolvePromise!();
      });

      await waitFor(() => {
        expect(result.current.isPending).toBe(false);
      });
    });
  });
});
