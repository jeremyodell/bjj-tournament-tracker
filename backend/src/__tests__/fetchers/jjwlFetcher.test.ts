import { describe, it, expect } from '@jest/globals';
import { mapJJWLToTournament } from '../../fetchers/jjwlFetcher.js';
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
