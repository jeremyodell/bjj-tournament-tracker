import { describe, it, expect } from '@jest/globals';
import { validateTournamentFilters, formatTournamentResponse } from '../../services/tournamentService.js';
import type { TournamentItem } from '../../db/types.js';

describe('validateTournamentFilters', () => {
  it('accepts valid filters', () => {
    const result = validateTournamentFilters({
      org: 'IBJJF',
      startAfter: '2025-01-01',
      gi: 'true',
    });
    expect(result.org).toBe('IBJJF');
    expect(result.startAfter).toBe('2025-01-01');
    expect(result.gi).toBe(true);
  });

  it('rejects invalid org', () => {
    expect(() =>
      validateTournamentFilters({ org: 'INVALID' })
    ).toThrow();
  });

  it('parses boolean strings', () => {
    const result = validateTournamentFilters({ gi: 'true', nogi: 'false' });
    expect(result.gi).toBe(true);
    expect(result.nogi).toBe(false);
  });

  it('ignores empty values', () => {
    const result = validateTournamentFilters({ org: '', city: undefined });
    expect(result.org).toBeUndefined();
    expect(result.city).toBeUndefined();
  });
});

describe('formatTournamentResponse', () => {
  const item: TournamentItem = {
    PK: 'TOURN#IBJJF#123',
    SK: 'META',
    GSI1PK: 'TOURNAMENTS',
    GSI1SK: '2025-03-15#IBJJF#123',
    org: 'IBJJF',
    externalId: '123',
    name: 'Pan American',
    city: 'Irvine',
    venue: 'Pyramid',
    country: 'USA',
    startDate: '2025-03-15',
    endDate: '2025-03-17',
    gi: true,
    nogi: true,
    kids: false,
    registrationUrl: 'https://ibjjf.com/pan',
    bannerUrl: null,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  };

  it('formats tournament for API response', () => {
    const result = formatTournamentResponse(item);
    expect(result.id).toBe('TOURN#IBJJF#123');
    expect(result.name).toBe('Pan American');
    expect(result).not.toHaveProperty('PK');
    expect(result).not.toHaveProperty('SK');
    expect(result).not.toHaveProperty('GSI1PK');
  });
});
