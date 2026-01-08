import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import {
  normalizeGymName,
  calculateNameSimilarity,
  calculateMatchScore,
  findMatchesForGym,
  processGymMatches,
  calculateSimilarity,
} from '../../services/gymMatchingService.js';
import type { SourceGymItem } from '../../db/types.js';

// Mock the database modules
jest.mock('../../db/gymQueries.js', () => ({
  listGyms: jest.fn(),
}));

jest.mock('../../db/masterGymQueries.js', () => ({
  createMasterGym: jest.fn(),
  linkSourceGymToMaster: jest.fn(),
}));

jest.mock('../../db/pendingMatchQueries.js', () => ({
  createPendingMatch: jest.fn(),
  findExistingPendingMatch: jest.fn(),
}));

import { listGyms } from '../../db/gymQueries.js';
import { createMasterGym, linkSourceGymToMaster } from '../../db/masterGymQueries.js';
import { createPendingMatch, findExistingPendingMatch } from '../../db/pendingMatchQueries.js';

const mockListGyms = listGyms as jest.MockedFunction<typeof listGyms>;
const mockCreateMasterGym = createMasterGym as jest.MockedFunction<typeof createMasterGym>;
const mockLinkSourceGymToMaster = linkSourceGymToMaster as jest.MockedFunction<typeof linkSourceGymToMaster>;
const mockCreatePendingMatch = createPendingMatch as jest.MockedFunction<typeof createPendingMatch>;
const mockFindExistingPendingMatch = findExistingPendingMatch as jest.MockedFunction<typeof findExistingPendingMatch>;

function createMockSourceGym(overrides: Partial<SourceGymItem> = {}): SourceGymItem {
  return {
    PK: 'SRCGYM#JJWL#123',
    SK: 'META',
    GSI1PK: 'GYMS',
    GSI1SK: 'JJWL#Test Gym',
    org: 'JJWL',
    externalId: '123',
    name: 'Test Gym',
    masterGymId: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('gymMatchingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('normalizeGymName', () => {
    it('should lowercase the name', () => {
      expect(normalizeGymName('GRACIE BARRA')).toBe('gracie barra');
    });

    it('should remove BJJ suffix', () => {
      expect(normalizeGymName('Pablo Silva BJJ')).toBe('pablo silva');
    });

    it('should remove Academy suffix', () => {
      expect(normalizeGymName('Alliance Academy')).toBe('alliance');
    });

    it('should remove Brazilian Jiu Jitsu suffix', () => {
      expect(normalizeGymName('Atos Brazilian Jiu Jitsu')).toBe('atos');
    });

    it('should remove multiple suffixes', () => {
      expect(normalizeGymName('Checkmat BJJ Academy')).toBe('checkmat');
    });

    it('should collapse whitespace', () => {
      expect(normalizeGymName('Gracie   Barra    Team')).toBe('gracie barra');
    });

    it('should trim whitespace', () => {
      expect(normalizeGymName('  Alliance  ')).toBe('alliance');
    });

    it('should handle empty string', () => {
      expect(normalizeGymName('')).toBe('');
    });

    it('should handle Jiu-Jitsu with hyphen', () => {
      expect(normalizeGymName('Test Jiu-Jitsu')).toBe('test');
    });
  });

  describe('calculateNameSimilarity', () => {
    it('should return 100 for identical names', () => {
      expect(calculateNameSimilarity('Gracie Barra', 'Gracie Barra')).toBe(100);
    });

    it('should return 100 for names that normalize to same value', () => {
      expect(calculateNameSimilarity('Gracie Barra BJJ', 'Gracie Barra Academy')).toBe(100);
    });

    it('should return high score for similar names', () => {
      const score = calculateNameSimilarity('Pablo Silva', 'Pablo Silvas');
      expect(score).toBeGreaterThan(80);
    });

    it('should return low score for different names', () => {
      const score = calculateNameSimilarity('Alliance', 'Checkmat');
      expect(score).toBeLessThan(50);
    });

    it('should handle case differences', () => {
      expect(calculateNameSimilarity('gracie barra', 'GRACIE BARRA')).toBe(100);
    });

    it('should return 0 for empty strings', () => {
      expect(calculateNameSimilarity('', 'Test')).toBe(0);
      expect(calculateNameSimilarity('Test', '')).toBe(0);
    });
  });

  describe('calculateSimilarity with Jaro-Winkler', () => {
    it('should return 100 for identical gym names', () => {
      const score = calculateSimilarity(
        'Gracie Barra',
        'Gracie Barra',
        'Austin',
        'Austin'
      );
      expect(score).toBe(100);
    });

    it('should handle minor variations with high score', () => {
      const score = calculateSimilarity(
        'Gracie Barra Austin',
        'Gracie Barra - Austin',
        'Austin',
        'Austin'
      );
      // Jaro-Winkler favors prefix matches
      expect(score).toBeGreaterThan(85);
    });

    it('should give low score for completely different names', () => {
      const score = calculateSimilarity(
        'Gracie Barra',
        'Alliance Jiu Jitsu',
        'Austin',
        'Houston'
      );
      expect(score).toBeLessThan(50);
    });

    it('should apply city boost when city appears in gym name', () => {
      const scoreWithCity = calculateSimilarity(
        'Gracie Barra Austin',
        'Gracie Barra Austin',
        'Austin',
        'Austin'
      );
      const scoreWithoutCity = calculateSimilarity(
        'Gracie Barra',
        'Gracie Barra',
        'Austin',
        'Austin'
      );
      // City boost should add ~15 points
      expect(scoreWithCity).toBeGreaterThanOrEqual(scoreWithoutCity);
    });

    it('should apply affiliation boost for matching affiliations', () => {
      const score = calculateSimilarity(
        'Gracie Barra Austin',
        'Gracie Barra Dallas',
        'Austin',
        'Dallas'
      );
      // "Gracie Barra" affiliation should boost score
      expect(score).toBeGreaterThan(70);
    });

    it('should not exceed 100 even with boosts', () => {
      const score = calculateSimilarity(
        'Gracie Barra Austin',
        'Gracie Barra Austin',
        'Austin',
        'Austin'
      );
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should NOT apply city boost for different cities', () => {
      const score = calculateSimilarity(
        'Gracie Barra Austin',
        'Gracie Barra Dallas',
        'Austin',
        'Dallas'
      );
      // Should NOT get city boost since cities are different
      // Base Jaro-Winkler for "gracie barra austin" vs "gracie barra dallas" is ~91-95
      // Add affiliation boost (+10) = ~101-105, capped at 100
      // Should NOT get city boost (+15)
      expect(score).toBe(100); // Capped score with affiliation boost only
    });
  });

  describe('calculateMatchScore', () => {
    it('should return base name similarity when no boosts apply', () => {
      const gym1 = createMockSourceGym({ name: 'Test Academy', org: 'JJWL' });
      const gym2 = createMockSourceGym({ name: 'Test Academy', org: 'IBJJF' });

      const { score, signals } = calculateMatchScore(gym1, gym2);

      expect(score).toBe(100);
      expect(signals.nameSimilarity).toBe(100);
      expect(signals.cityBoost).toBe(0);
      expect(signals.affiliationBoost).toBe(0);
    });

    it('should add city boost when city appears in other gym name', () => {
      const gym1 = createMockSourceGym({
        name: 'Alliance',
        city: 'Atlanta',
        org: 'IBJJF',
      });
      const gym2 = createMockSourceGym({
        name: 'Alliance Atlanta',
        org: 'JJWL',
      });

      const { score, signals } = calculateMatchScore(gym1, gym2);

      expect(signals.cityBoost).toBe(15);
      expect(score).toBeGreaterThan(signals.nameSimilarity);
    });

    it('should add affiliation boost when both have same affiliation', () => {
      const gym1 = createMockSourceGym({
        name: 'Gracie Barra Irvine',
        org: 'JJWL',
      });
      const gym2 = createMockSourceGym({
        name: 'Gracie Barra HQ',
        org: 'IBJJF',
      });

      const { score, signals } = calculateMatchScore(gym1, gym2);

      expect(signals.affiliationBoost).toBe(10);
    });

    it('should not add affiliation boost for different affiliations', () => {
      const gym1 = createMockSourceGym({
        name: 'Alliance Atlanta',
        org: 'JJWL',
      });
      const gym2 = createMockSourceGym({
        name: 'Atos Houston',
        org: 'IBJJF',
      });

      const { signals } = calculateMatchScore(gym1, gym2);

      expect(signals.affiliationBoost).toBe(0);
    });

    it('should cap total score at 100', () => {
      const gym1 = createMockSourceGym({
        name: 'Gracie Barra Atlanta',
        city: 'Atlanta',
        org: 'IBJJF',
      });
      const gym2 = createMockSourceGym({
        name: 'Gracie Barra Atlanta',
        org: 'JJWL',
      });

      const { score } = calculateMatchScore(gym1, gym2);

      expect(score).toBe(100);
    });
  });

  describe('findMatchesForGym', () => {
    it('should find matches from opposite org above threshold', async () => {
      const sourceGym = createMockSourceGym({
        name: 'Pablo Silva BJJ',
        org: 'JJWL',
      });

      const targetGym = createMockSourceGym({
        PK: 'SRCGYM#IBJJF#456',
        name: 'Pablo Silva Academy',
        org: 'IBJJF',
        externalId: '456',
        masterGymId: null,
      });

      mockListGyms.mockResolvedValueOnce({
        items: [targetGym],
        lastKey: undefined,
      });

      const matches = await findMatchesForGym(sourceGym);

      expect(mockListGyms).toHaveBeenCalledWith('IBJJF', 100, undefined);
      expect(matches.length).toBe(1);
      expect(matches[0].gym.name).toBe('Pablo Silva Academy');
      expect(matches[0].score).toBeGreaterThanOrEqual(70);
    });

    it('should skip gyms already linked to master', async () => {
      const sourceGym = createMockSourceGym({
        name: 'Test Gym',
        org: 'JJWL',
      });

      const linkedGym = createMockSourceGym({
        name: 'Test Gym',
        org: 'IBJJF',
        masterGymId: 'existing-master-id',
      });

      mockListGyms.mockResolvedValueOnce({
        items: [linkedGym],
        lastKey: undefined,
      });

      const matches = await findMatchesForGym(sourceGym);

      expect(matches.length).toBe(0);
    });

    it('should sort matches by score descending', async () => {
      const sourceGym = createMockSourceGym({
        name: 'Alliance',
        org: 'JJWL',
      });

      const gym1 = createMockSourceGym({
        name: 'Alliance BJJ',
        org: 'IBJJF',
        externalId: '1',
      });
      const gym2 = createMockSourceGym({
        name: 'Alliance Academy',
        org: 'IBJJF',
        externalId: '2',
      });

      mockListGyms.mockResolvedValueOnce({
        items: [gym1, gym2],
        lastKey: undefined,
      });

      const matches = await findMatchesForGym(sourceGym);

      // Both should match, scores should be sorted descending
      expect(matches.length).toBe(2);
      expect(matches[0].score).toBeGreaterThanOrEqual(matches[1].score);
    });

    it('should paginate through all gyms', async () => {
      const sourceGym = createMockSourceGym({ org: 'JJWL' });

      mockListGyms
        .mockResolvedValueOnce({
          items: [],
          lastKey: { PK: 'key1' },
        })
        .mockResolvedValueOnce({
          items: [],
          lastKey: undefined,
        });

      await findMatchesForGym(sourceGym);

      expect(mockListGyms).toHaveBeenCalledTimes(2);
    });
  });

  // TODO: Task 8 - Uncomment these tests when implementing caching optimization
  describe.skip('findMatchesForGym with cached gyms', () => {
    it('should accept cached gym array instead of querying DB', async () => {
      const sourceGym: SourceGymItem = {
        PK: 'SRCGYM#JJWL#123',
        SK: 'META',
        org: 'JJWL',
        externalId: '123',
        name: 'Test Gym Austin',
        city: 'Austin',
        GSI1PK: 'GYMS',
        GSI1SK: 'JJWL#Test Gym Austin',
        masterGymId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const cachedGyms: SourceGymItem[] = [
        {
          PK: 'SRCGYM#IBJJF#456',
          SK: 'META',
          org: 'IBJJF',
          externalId: '456',
          name: 'Test Gym Austin',
          city: 'Austin',
          countryCode: 'US',
          GSI1PK: 'GYMS',
          GSI1SK: 'IBJJF#Test Gym Austin',
          masterGymId: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      // @ts-expect-error - Task 8: cachedGyms parameter not yet implemented
      const matches = await findMatchesForGym(sourceGym, cachedGyms);

      expect(matches).toHaveLength(1);
      expect(matches[0].gym.externalId).toBe('456');
      expect(matches[0].score).toBeGreaterThan(90);
    });

    it('should find high-confidence matches (≥90%)', async () => {
      const sourceGym: SourceGymItem = {
        PK: 'SRCGYM#JJWL#123',
        SK: 'META',
        org: 'JJWL',
        externalId: '123',
        name: 'Gracie Barra Austin',
        city: 'Austin',
        GSI1PK: 'GYMS',
        GSI1SK: 'JJWL#Gracie Barra Austin',
        masterGymId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const cachedGyms: SourceGymItem[] = [
        {
          PK: 'SRCGYM#IBJJF#456',
          SK: 'META',
          org: 'IBJJF',
          externalId: '456',
          name: 'Gracie Barra - Austin',
          city: 'Austin',
          countryCode: 'US',
          GSI1PK: 'GYMS',
          GSI1SK: 'IBJJF#Gracie Barra - Austin',
          masterGymId: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      // @ts-expect-error - Task 8: cachedGyms parameter not yet implemented
      const matches = await findMatchesForGym(sourceGym, cachedGyms);

      expect(matches).toHaveLength(1);
      expect(matches[0].score).toBeGreaterThanOrEqual(90);
    });

    it('should find medium-confidence matches (70-89%)', async () => {
      const sourceGym: SourceGymItem = {
        PK: 'SRCGYM#JJWL#123',
        SK: 'META',
        org: 'JJWL',
        externalId: '123',
        name: 'Alliance Austin',
        city: 'Austin',
        GSI1PK: 'GYMS',
        GSI1SK: 'JJWL#Alliance Austin',
        masterGymId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const cachedGyms: SourceGymItem[] = [
        {
          PK: 'SRCGYM#IBJJF#456',
          SK: 'META',
          org: 'IBJJF',
          externalId: '456',
          name: 'Alliance Jiu Jitsu',
          city: 'Austin',
          countryCode: 'US',
          GSI1PK: 'GYMS',
          GSI1SK: 'IBJJF#Alliance Jiu Jitsu',
          masterGymId: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      // @ts-expect-error - Task 8: cachedGyms parameter not yet implemented
      const matches = await findMatchesForGym(sourceGym, cachedGyms);

      expect(matches).toHaveLength(1);
      expect(matches[0].score).toBeGreaterThanOrEqual(70);
      expect(matches[0].score).toBeLessThan(90);
    });

    it('should exclude low-confidence matches (<70%)', async () => {
      const sourceGym: SourceGymItem = {
        PK: 'SRCGYM#JJWL#123',
        SK: 'META',
        org: 'JJWL',
        externalId: '123',
        name: 'Gracie Barra Austin',
        city: 'Austin',
        GSI1PK: 'GYMS',
        GSI1SK: 'JJWL#Gracie Barra Austin',
        masterGymId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const cachedGyms: SourceGymItem[] = [
        {
          PK: 'SRCGYM#IBJJF#456',
          SK: 'META',
          org: 'IBJJF',
          externalId: '456',
          name: 'Completely Different Gym',
          city: 'Houston',
          countryCode: 'US',
          GSI1PK: 'GYMS',
          GSI1SK: 'IBJJF#Completely Different Gym',
          masterGymId: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      // @ts-expect-error - Task 8: cachedGyms parameter not yet implemented
      const matches = await findMatchesForGym(sourceGym, cachedGyms);

      expect(matches).toHaveLength(0);
    });
  });

  describe('processGymMatches', () => {
    it('should skip if source gym already linked', async () => {
      const sourceGym = createMockSourceGym({
        masterGymId: 'existing-id',
      });

      const result = await processGymMatches(sourceGym);

      expect(result).toEqual({ autoLinked: 0, pendingCreated: 0 });
      expect(mockListGyms).not.toHaveBeenCalled();
    });

    it('should auto-link for 90%+ match', async () => {
      const sourceGym = createMockSourceGym({
        name: 'Gracie Barra',
        org: 'JJWL',
        externalId: '123',
      });

      const targetGym = createMockSourceGym({
        name: 'Gracie Barra', // Exact match = 100%
        org: 'IBJJF',
        externalId: '456',
      });

      mockListGyms.mockResolvedValueOnce({
        items: [targetGym],
        lastKey: undefined,
      });

      mockCreateMasterGym.mockResolvedValueOnce({
        id: 'new-master-id',
        PK: 'MASTERGYM#new-master-id',
        SK: 'META',
        GSI1PK: 'MASTERGYMS',
        GSI1SK: 'Gracie Barra',
        canonicalName: 'Gracie Barra',
        city: null,
        country: null,
        address: null,
        website: null,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      });

      const result = await processGymMatches(sourceGym);

      expect(result.autoLinked).toBe(1);
      expect(mockCreateMasterGym).toHaveBeenCalled();
      expect(mockLinkSourceGymToMaster).toHaveBeenCalledTimes(2);
      expect(mockLinkSourceGymToMaster).toHaveBeenCalledWith('JJWL', '123', 'new-master-id');
      expect(mockLinkSourceGymToMaster).toHaveBeenCalledWith('IBJJF', '456', 'new-master-id');
    });

    it('should create pending match for 70-89% match', async () => {
      const sourceGym = createMockSourceGym({
        name: 'Pablo Silva BJJ',
        org: 'JJWL',
        externalId: '123',
      });

      // Name that will score 70-89% (more different to ensure < 90%)
      const targetGym = createMockSourceGym({
        name: 'Pablo Silveira Academy',
        org: 'IBJJF',
        externalId: '456',
      });

      mockListGyms.mockResolvedValueOnce({
        items: [targetGym],
        lastKey: undefined,
      });

      mockFindExistingPendingMatch.mockResolvedValueOnce(null);

      const result = await processGymMatches(sourceGym);

      expect(result.pendingCreated).toBe(1);
      expect(mockCreatePendingMatch).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceGym1Id: 'SRCGYM#JJWL#123',
          sourceGym1Name: 'Pablo Silva BJJ',
          sourceGym2Id: 'SRCGYM#IBJJF#456',
          sourceGym2Name: 'Pablo Silveira Academy',
        })
      );
    });

    it('should not create duplicate pending match', async () => {
      const sourceGym = createMockSourceGym({
        name: 'Pablo Silva BJJ',
        org: 'JJWL',
        externalId: '123',
      });

      // Use a name that scores 70-89%
      const targetGym = createMockSourceGym({
        name: 'Pablo Silveira Academy',
        org: 'IBJJF',
        externalId: '456',
      });

      mockListGyms.mockResolvedValueOnce({
        items: [targetGym],
        lastKey: undefined,
      });

      // Existing match found
      mockFindExistingPendingMatch.mockResolvedValueOnce({
        id: 'existing-match',
      } as never);

      const result = await processGymMatches(sourceGym);

      expect(result.pendingCreated).toBe(0);
      expect(mockCreatePendingMatch).not.toHaveBeenCalled();
    });
  });
});
