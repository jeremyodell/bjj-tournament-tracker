import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import {
  generateSlug,
  ensureTournamentSlug,
} from '../../services/slugService.js';
import { docClient } from '../../db/client.js';

// Mock the docClient
jest.mock('../../db/client.js', () => ({
  docClient: {
    send: jest.fn(),
  },
  TABLE_NAME: 'bjj-tournament-tracker-test',
}));

const mockSend = docClient.send as jest.MockedFunction<typeof docClient.send>;

describe('slugService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateSlug', () => {
    it('should convert name to lowercase', () => {
      const slug = generateSlug('IBJJF Pan American', 'IBJJF', '123');
      expect(slug).toMatch(/^ibjjf-pan-american/);
    });

    it('should replace spaces with hyphens', () => {
      const slug = generateSlug('World Championship', 'IBJJF', '456');
      expect(slug).toMatch(/world-championship/);
    });

    it('should remove special characters', () => {
      const slug = generateSlug('BJJ Pro (Kids) Championship!', 'JJWL', '789');
      expect(slug).toMatch(/bjj-pro-kids-championship/);
    });

    it('should handle multiple spaces', () => {
      const slug = generateSlug('World   Championship', 'IBJJF', '123');
      expect(slug).not.toMatch(/--/); // No double hyphens
    });

    it('should include org in the slug', () => {
      const ibjjfSlug = generateSlug('Pan Am', 'IBJJF', '123');
      const jjwlSlug = generateSlug('Pan Am', 'JJWL', '123');

      expect(ibjjfSlug).toContain('ibjjf');
      expect(jjwlSlug).toContain('jjwl');
    });

    it('should include external ID suffix to ensure uniqueness', () => {
      const slug = generateSlug('World Championship', 'IBJJF', 'ext-456');
      expect(slug).toContain('ext-456');
    });

    it('should trim leading and trailing whitespace', () => {
      const slug = generateSlug('  World Championship  ', 'IBJJF', '123');
      expect(slug).not.toMatch(/^-/);
      expect(slug).not.toMatch(/-$/);
    });

    it('should handle accented characters', () => {
      const slug = generateSlug('São Paulo Open', 'IBJJF', '123');
      expect(slug).toMatch(/sao-paulo-open/);
    });

    it('should handle ampersands', () => {
      const slug = generateSlug('Gi & No-Gi Championship', 'JJWL', '456');
      expect(slug).toMatch(/gi-no-gi-championship/);
    });

    it('should handle apostrophes', () => {
      const slug = generateSlug("Kid's Championship", 'JJWL', '789');
      expect(slug).toMatch(/kids-championship/);
    });
  });

  describe('ensureTournamentSlug', () => {
    it('should return existing slug if tournament already has one', async () => {
      const mockTournament = {
        PK: 'TOURN#IBJJF#123',
        SK: 'META',
        name: 'World Championship',
        slug: 'world-championship-ibjjf-123',
        org: 'IBJJF',
        externalId: '123',
      };

      mockSend.mockResolvedValueOnce({ Item: mockTournament } as never);

      const result = await ensureTournamentSlug('TOURN#IBJJF#123');

      expect(result).toBe('world-championship-ibjjf-123');
      // Should only call GetCommand, not UpdateCommand
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('should generate and save slug if tournament has none', async () => {
      const mockTournament = {
        PK: 'TOURN#IBJJF#456',
        SK: 'META',
        name: 'Pan American',
        slug: null,
        org: 'IBJJF',
        externalId: '456',
      };

      // First call: GetCommand returns tournament without slug
      mockSend.mockResolvedValueOnce({ Item: mockTournament } as never);
      // Second call: UpdateCommand to save the new slug
      mockSend.mockResolvedValueOnce({} as never);

      const result = await ensureTournamentSlug('TOURN#IBJJF#456');

      expect(result).toContain('pan-american');
      expect(result).toContain('ibjjf');
      expect(result).toContain('456');
      expect(mockSend).toHaveBeenCalledTimes(2);
    });

    it('should throw if tournament not found', async () => {
      mockSend.mockResolvedValueOnce({ Item: undefined } as never);

      await expect(ensureTournamentSlug('TOURN#IBJJF#nonexistent')).rejects.toThrow(
        'Tournament not found'
      );
    });

    it('should update tournament with the generated slug', async () => {
      const mockTournament = {
        PK: 'TOURN#JJWL#789',
        SK: 'META',
        name: 'Kids Championship',
        slug: null,
        org: 'JJWL',
        externalId: '789',
      };

      mockSend.mockResolvedValueOnce({ Item: mockTournament } as never);
      mockSend.mockResolvedValueOnce({} as never);

      await ensureTournamentSlug('TOURN#JJWL#789');

      // Verify the UpdateCommand was called with correct parameters
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updateInput = mockSend.mock.calls[1][0].input as any;
      expect(updateInput.Key.PK).toBe('TOURN#JJWL#789');
      expect(updateInput.Key.SK).toBe('META');
      expect(updateInput.UpdateExpression).toContain('slug = :slug');
      expect(updateInput.ExpressionAttributeValues[':slug']).toContain('kids-championship');
    });

    it('should cache slugs to avoid repeated DB calls', async () => {
      const mockTournament = {
        PK: 'TOURN#IBJJF#cached',
        SK: 'META',
        name: 'Cached Tournament',
        slug: 'cached-tournament-ibjjf-cached',
        org: 'IBJJF',
        externalId: 'cached',
      };

      mockSend.mockResolvedValueOnce({ Item: mockTournament } as never);

      // Call twice
      const result1 = await ensureTournamentSlug('TOURN#IBJJF#cached');
      const result2 = await ensureTournamentSlug('TOURN#IBJJF#cached');

      expect(result1).toBe(result2);
      // Should only call once due to caching
      expect(mockSend).toHaveBeenCalledTimes(1);
    });
  });
});
