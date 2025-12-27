import { describe, it, expect } from '@jest/globals';
import { mapJJWLToTournament, parseJJWLDate } from '../../fetchers/jjwlFetcher.js';
import type { JJWLEvent } from '../../fetchers/types.js';

describe('mapJJWLToTournament', () => {
  const baseEvent: JJWLEvent = {
    id: 456,
    name: 'World League Open',
    city: 'Las Vegas',
    place: 'Convention Center',
    datebeg: '2025-04-10',
    dateend: '2025-04-12',
    GI: '1',
    NOGI: '1',
    picture: 'https://jjwl.com/img/event.jpg',
    urlfriendly: 'world-league-open-2025',
  };

  it('maps basic fields correctly', () => {
    const result = mapJJWLToTournament(baseEvent);
    expect(result.org).toBe('JJWL');
    expect(result.externalId).toBe('456');
    expect(result.name).toBe('World League Open');
    expect(result.city).toBe('Las Vegas');
    expect(result.venue).toBe('Convention Center');
  });

  it('parses dates correctly', () => {
    const result = mapJJWLToTournament(baseEvent);
    expect(result.startDate).toBe('2025-04-10');
    expect(result.endDate).toBe('2025-04-12');
  });

  it('maps GI flag from string "1"', () => {
    const result = mapJJWLToTournament(baseEvent);
    expect(result.gi).toBe(true);
  });

  it('maps NOGI flag from string "0"', () => {
    const noGiEvent = { ...baseEvent, NOGI: '0' };
    const result = mapJJWLToTournament(noGiEvent);
    expect(result.nogi).toBe(false);
  });

  it('builds registration URL', () => {
    const result = mapJJWLToTournament(baseEvent);
    expect(result.registrationUrl).toBe(
      'https://www.jjworldleague.com/events/world-league-open-2025'
    );
  });

  it('maps banner URL', () => {
    const result = mapJJWLToTournament(baseEvent);
    expect(result.bannerUrl).toBe('https://jjwl.com/img/event.jpg');
  });
});

describe('parseJJWLDate', () => {
  it('returns null for empty string', () => {
    expect(parseJJWLDate('')).toBeNull();
  });

  it('returns null for whitespace-only string', () => {
    expect(parseJJWLDate('   ')).toBeNull();
  });

  it('parses YYYY-MM-DD format', () => {
    expect(parseJJWLDate('2025-04-10')).toBe('2025-04-10');
  });

  it('parses "Jan 15, 2025" format', () => {
    expect(parseJJWLDate('Jan 15, 2025')).toBe('2025-01-15');
  });

  it('parses "January 15, 2025" format', () => {
    expect(parseJJWLDate('January 15, 2025')).toBe('2025-01-15');
  });

  it('parses "15 Jan 2025" format', () => {
    expect(parseJJWLDate('15 Jan 2025')).toBe('2025-01-15');
  });

  it('parses "15/01/2025" format', () => {
    expect(parseJJWLDate('15/01/2025')).toBe('2025-01-15');
  });

  it('parses "15-01-2025" format', () => {
    expect(parseJJWLDate('15-01-2025')).toBe('2025-01-15');
  });

  it('handles leading/trailing whitespace', () => {
    expect(parseJJWLDate('  2025-04-10  ')).toBe('2025-04-10');
  });

  it('returns null for unparseable format', () => {
    expect(parseJJWLDate('not a date')).toBeNull();
  });

  it('returns null for partial date', () => {
    expect(parseJJWLDate('January 2025')).toBeNull();
  });
});
