import { describe, it, expect } from '@jest/globals';
import { mapIBJJFToTournament, parseIBJJFDate } from '../../fetchers/ibjjfFetcher.js';
import type { IBJJFEvent } from '../../fetchers/types.js';

describe('parseIBJJFDate', () => {
  it('parses Jan correctly', () => {
    expect(parseIBJJFDate(15, 'Jan', 2025)).toBe('2025-01-15');
  });

  it('parses Dec correctly', () => {
    expect(parseIBJJFDate(1, 'Dec', 2025)).toBe('2025-12-01');
  });

  it('pads single digit days', () => {
    expect(parseIBJJFDate(5, 'Mar', 2025)).toBe('2025-03-05');
  });
});

describe('mapIBJJFToTournament', () => {
  const baseEvent: IBJJFEvent = {
    id: 123,
    name: 'Pan American',
    region: 'USA',
    city: 'Irvine',
    local: 'Pyramid',
    startDay: 15,
    endDay: 17,
    month: 'Mar',
    year: 2025,
    eventGroups: [
      { id: 1, name: 'GI' },
      { id: 2, name: 'NO-GI' },
    ],
    pageUrl: '/events/pan-2025',
  };

  it('maps basic fields correctly', () => {
    const result = mapIBJJFToTournament(baseEvent);
    expect(result.org).toBe('IBJJF');
    expect(result.externalId).toBe('123');
    expect(result.name).toBe('Pan American');
    expect(result.city).toBe('Irvine');
    expect(result.venue).toBe('Pyramid');
  });

  it('parses dates correctly', () => {
    const result = mapIBJJFToTournament(baseEvent);
    expect(result.startDate).toBe('2025-03-15');
    expect(result.endDate).toBe('2025-03-17');
  });

  it('maps GI/NOGI flags from eventGroups', () => {
    const result = mapIBJJFToTournament(baseEvent);
    expect(result.gi).toBe(true);
    expect(result.nogi).toBe(true);
  });

  it('detects kids from eventGroups', () => {
    const kidsEvent = {
      ...baseEvent,
      eventGroups: [{ id: 3, name: 'KIDS' }],
    };
    const result = mapIBJJFToTournament(kidsEvent);
    expect(result.kids).toBe(true);
  });

  it('builds registration URL', () => {
    const result = mapIBJJFToTournament(baseEvent);
    expect(result.registrationUrl).toBe('https://ibjjf.com/events/pan-2025');
  });
});
