import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import {
  getUserWishlist,
  addToWishlist,
  removeFromWishlist,
  getWishlistItem,
  updateWishlistItem,
  getAllWishlistedTournamentPKs,
} from '../../db/wishlistQueries.js';
import { docClient } from '../../db/client.js';
import type { WishlistItem, TournamentItem } from '../../db/types.js';

// Mock the docClient
jest.mock('../../db/client.js', () => ({
  docClient: {
    send: jest.fn(),
  },
  TABLE_NAME: 'bjj-tournament-tracker-test',
  GSI1_NAME: 'GSI1',
}));

const mockSend = docClient.send as jest.MockedFunction<typeof docClient.send>;

describe('wishlistQueries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserWishlist', () => {
    it('should return wishlist items for a user', async () => {
      const mockItems: WishlistItem[] = [
        {
          PK: 'USER#user-123',
          SK: 'WISH#TOURN#JJWL#850',
          tournamentPK: 'TOURN#JJWL#850',
          status: 'interested',
          athleteIds: [],
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
      ];

      mockSend.mockResolvedValueOnce({ Items: mockItems } as never);

      const result = await getUserWishlist('user-123');

      expect(result).toHaveLength(1);
      expect(result[0].tournamentPK).toBe('TOURN#JJWL#850');
    });
  });

  describe('getAllWishlistedTournamentPKs', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-01-15T00:00:00Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should return unique tournament PKs from all users within date range', async () => {
      // Mock wishlist items from multiple users
      const mockWishlistItems = [
        {
          PK: 'USER#user-1',
          SK: 'WISH#TOURN#JJWL#850',
          tournamentPK: 'TOURN#JJWL#850',
          status: 'interested',
          athleteIds: [],
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
        {
          PK: 'USER#user-2',
          SK: 'WISH#TOURN#JJWL#850',
          tournamentPK: 'TOURN#JJWL#850', // Same tournament, different user
          status: 'registered',
          athleteIds: [],
          createdAt: '2026-01-02T00:00:00Z',
          updatedAt: '2026-01-02T00:00:00Z',
        },
        {
          PK: 'USER#user-1',
          SK: 'WISH#TOURN#JJWL#860',
          tournamentPK: 'TOURN#JJWL#860',
          status: 'interested',
          athleteIds: [],
          createdAt: '2026-01-03T00:00:00Z',
          updatedAt: '2026-01-03T00:00:00Z',
        },
      ];

      // Mock tournaments data
      const mockTournaments: Partial<TournamentItem>[] = [
        {
          PK: 'TOURN#JJWL#850',
          SK: 'META',
          org: 'JJWL',
          externalId: '850',
          name: 'Tournament 1',
          startDate: '2026-02-01', // Within 60 days
        },
        {
          PK: 'TOURN#JJWL#860',
          SK: 'META',
          org: 'JJWL',
          externalId: '860',
          name: 'Tournament 2',
          startDate: '2026-02-15', // Within 60 days
        },
      ];

      // First call: scan wishlists (may need pagination)
      mockSend.mockResolvedValueOnce({ Items: mockWishlistItems } as never);
      // Second call: batch get tournaments
      mockSend.mockResolvedValueOnce({
        Responses: {
          'bjj-tournament-tracker-test': mockTournaments,
        },
      } as never);

      const result = await getAllWishlistedTournamentPKs(60);

      // Should deduplicate and only return JJWL tournaments (not IBJJF)
      expect(result).toContain('TOURN#JJWL#850');
      expect(result).toContain('TOURN#JJWL#860');
      expect(result).toHaveLength(2);
    });

    it('should filter out IBJJF tournaments (only JJWL rosters are supported)', async () => {
      const mockWishlistItems = [
        {
          PK: 'USER#user-1',
          SK: 'WISH#TOURN#IBJJF#123',
          tournamentPK: 'TOURN#IBJJF#123',
          status: 'interested',
          athleteIds: [],
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
        {
          PK: 'USER#user-1',
          SK: 'WISH#TOURN#JJWL#850',
          tournamentPK: 'TOURN#JJWL#850',
          status: 'interested',
          athleteIds: [],
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
      ];

      // Only JJWL tournament should be fetched (IBJJF is filtered before BatchGet)
      const mockTournaments: Partial<TournamentItem>[] = [
        {
          PK: 'TOURN#JJWL#850',
          SK: 'META',
          org: 'JJWL',
          externalId: '850',
          name: 'JJWL Tournament',
          startDate: '2026-02-01',
        },
      ];

      mockSend.mockResolvedValueOnce({ Items: mockWishlistItems } as never);
      mockSend.mockResolvedValueOnce({
        Responses: {
          'bjj-tournament-tracker-test': mockTournaments,
        },
      } as never);

      const result = await getAllWishlistedTournamentPKs(60);

      // Should only include JJWL tournament
      expect(result).toContain('TOURN#JJWL#850');
      expect(result).not.toContain('TOURN#IBJJF#123');
      expect(result).toHaveLength(1);

      // Verify the BatchGet was called with only JJWL PKs
      const batchGetCall = mockSend.mock.calls[1][0];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const keys = (batchGetCall as any).input.RequestItems['bjj-tournament-tracker-test'].Keys;
      expect(keys).toEqual([{ PK: 'TOURN#JJWL#850', SK: 'META' }]);
    });

    it('should filter out past tournaments', async () => {
      const mockWishlistItems = [
        {
          PK: 'USER#user-1',
          SK: 'WISH#TOURN#JJWL#past',
          tournamentPK: 'TOURN#JJWL#past',
          status: 'interested',
          athleteIds: [],
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
        {
          PK: 'USER#user-1',
          SK: 'WISH#TOURN#JJWL#future',
          tournamentPK: 'TOURN#JJWL#future',
          status: 'interested',
          athleteIds: [],
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
      ];

      const mockTournaments: Partial<TournamentItem>[] = [
        {
          PK: 'TOURN#JJWL#past',
          SK: 'META',
          org: 'JJWL',
          externalId: 'past',
          name: 'Past Tournament',
          startDate: '2026-01-01', // Past (today is 2026-01-15)
        },
        {
          PK: 'TOURN#JJWL#future',
          SK: 'META',
          org: 'JJWL',
          externalId: 'future',
          name: 'Future Tournament',
          startDate: '2026-02-01', // Future
        },
      ];

      mockSend.mockResolvedValueOnce({ Items: mockWishlistItems } as never);
      mockSend.mockResolvedValueOnce({
        Responses: {
          'bjj-tournament-tracker-test': mockTournaments,
        },
      } as never);

      const result = await getAllWishlistedTournamentPKs(60);

      expect(result).toContain('TOURN#JJWL#future');
      expect(result).not.toContain('TOURN#JJWL#past');
      expect(result).toHaveLength(1);
    });

    it('should filter out tournaments beyond daysAhead', async () => {
      const mockWishlistItems = [
        {
          PK: 'USER#user-1',
          SK: 'WISH#TOURN#JJWL#soon',
          tournamentPK: 'TOURN#JJWL#soon',
          status: 'interested',
          athleteIds: [],
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
        {
          PK: 'USER#user-1',
          SK: 'WISH#TOURN#JJWL#far',
          tournamentPK: 'TOURN#JJWL#far',
          status: 'interested',
          athleteIds: [],
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
      ];

      const mockTournaments: Partial<TournamentItem>[] = [
        {
          PK: 'TOURN#JJWL#soon',
          SK: 'META',
          org: 'JJWL',
          externalId: 'soon',
          name: 'Soon Tournament',
          startDate: '2026-02-01', // Within 60 days (today is 2026-01-15)
        },
        {
          PK: 'TOURN#JJWL#far',
          SK: 'META',
          org: 'JJWL',
          externalId: 'far',
          name: 'Far Tournament',
          startDate: '2026-06-01', // Beyond 60 days
        },
      ];

      mockSend.mockResolvedValueOnce({ Items: mockWishlistItems } as never);
      mockSend.mockResolvedValueOnce({
        Responses: {
          'bjj-tournament-tracker-test': mockTournaments,
        },
      } as never);

      const result = await getAllWishlistedTournamentPKs(60);

      expect(result).toContain('TOURN#JJWL#soon');
      expect(result).not.toContain('TOURN#JJWL#far');
      expect(result).toHaveLength(1);
    });

    it('should return empty array when no wishlisted tournaments', async () => {
      mockSend.mockResolvedValueOnce({ Items: [] } as never);

      const result = await getAllWishlistedTournamentPKs(60);

      expect(result).toEqual([]);
    });

    it('should handle pagination when scanning wishlists', async () => {
      const firstBatch = [
        {
          PK: 'USER#user-1',
          SK: 'WISH#TOURN#JJWL#850',
          tournamentPK: 'TOURN#JJWL#850',
          status: 'interested',
          athleteIds: [],
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
      ];

      const secondBatch = [
        {
          PK: 'USER#user-2',
          SK: 'WISH#TOURN#JJWL#860',
          tournamentPK: 'TOURN#JJWL#860',
          status: 'interested',
          athleteIds: [],
          createdAt: '2026-01-02T00:00:00Z',
          updatedAt: '2026-01-02T00:00:00Z',
        },
      ];

      const mockTournaments: Partial<TournamentItem>[] = [
        {
          PK: 'TOURN#JJWL#850',
          SK: 'META',
          org: 'JJWL',
          externalId: '850',
          name: 'Tournament 1',
          startDate: '2026-02-01',
        },
        {
          PK: 'TOURN#JJWL#860',
          SK: 'META',
          org: 'JJWL',
          externalId: '860',
          name: 'Tournament 2',
          startDate: '2026-02-15',
        },
      ];

      // First scan returns items with LastEvaluatedKey
      mockSend.mockResolvedValueOnce({
        Items: firstBatch,
        LastEvaluatedKey: { PK: 'USER#user-1', SK: 'WISH#TOURN#JJWL#850' },
      } as never);
      // Second scan returns more items without LastEvaluatedKey
      mockSend.mockResolvedValueOnce({
        Items: secondBatch,
      } as never);
      // Batch get tournaments
      mockSend.mockResolvedValueOnce({
        Responses: {
          'bjj-tournament-tracker-test': mockTournaments,
        },
      } as never);

      const result = await getAllWishlistedTournamentPKs(60);

      expect(result).toHaveLength(2);
      expect(result).toContain('TOURN#JJWL#850');
      expect(result).toContain('TOURN#JJWL#860');
    });
  });
});
