import { describe, it, expect } from '@jest/globals';
import {
  buildTournamentFilters,
  buildGSI1Query,
} from '../../db/queries.js';

describe('buildTournamentFilters', () => {
  it('builds org filter', () => {
    const result = buildTournamentFilters({ org: 'IBJJF' });
    expect(result.FilterExpression).toContain('org = :org');
    expect(result.ExpressionAttributeValues[':org']).toBe('IBJJF');
  });

  it('builds date range filter', () => {
    const result = buildTournamentFilters({
      startAfter: '2025-01-01',
      startBefore: '2025-12-31',
    });
    expect(result.FilterExpression).toContain('startDate >= :startAfter');
    expect(result.FilterExpression).toContain('startDate <= :startBefore');
  });

  it('builds gi/nogi filters', () => {
    const result = buildTournamentFilters({ gi: true, nogi: false });
    expect(result.FilterExpression).toContain('gi = :gi');
    expect(result.ExpressionAttributeValues[':gi']).toBe(true);
  });

  it('builds city filter with contains', () => {
    const result = buildTournamentFilters({ city: 'Las Vegas' });
    expect(result.FilterExpression).toContain('contains(city, :city)');
  });
});

describe('buildGSI1Query', () => {
  it('queries GSI1 for all tournaments', () => {
    const result = buildGSI1Query({});
    expect(result.KeyConditionExpression).toBe('GSI1PK = :pk');
    expect(result.ExpressionAttributeValues[':pk']).toBe('TOURNAMENTS');
  });

  it('adds date range to key condition', () => {
    const result = buildGSI1Query({
      startAfter: '2025-01-01',
      startBefore: '2025-12-31',
    });
    expect(result.KeyConditionExpression).toContain('GSI1SK BETWEEN');
  });
});
