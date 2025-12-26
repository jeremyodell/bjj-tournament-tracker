import { describe, it, expect } from '@jest/globals';
import { haversineDistance, filterByDistance } from '../../utils/distance.js';

describe('haversineDistance', () => {
  it('calculates distance between two points correctly', () => {
    // Dallas to Houston is approximately 225 miles
    const dallas = { lat: 32.7767, lng: -96.7970 };
    const houston = { lat: 29.7604, lng: -95.3698 };

    const distance = haversineDistance(dallas.lat, dallas.lng, houston.lat, houston.lng);

    expect(distance).toBeGreaterThan(220);
    expect(distance).toBeLessThan(240);
  });

  it('returns 0 for same point', () => {
    const distance = haversineDistance(32.7767, -96.7970, 32.7767, -96.7970);
    expect(distance).toBe(0);
  });
});

describe('filterByDistance', () => {
  const tournaments = [
    { id: '1', lat: 32.7767, lng: -96.7970 }, // Dallas
    { id: '2', lat: 29.7604, lng: -95.3698 }, // Houston (~225mi from Dallas)
    { id: '3', lat: 30.2672, lng: -97.7431 }, // Austin (~195mi from Dallas)
    { id: '4', lat: null, lng: null },        // No location
  ];

  it('filters tournaments within radius', () => {
    const result = filterByDistance(tournaments, 32.7767, -96.7970, 200);

    expect(result).toHaveLength(2); // Dallas (0mi) and Austin (~195mi)
    expect(result.some((t) => t.id === '1')).toBe(true); // Dallas
    expect(result.some((t) => t.id === '3')).toBe(true); // Austin
  });

  it('includes all within large radius', () => {
    const result = filterByDistance(tournaments, 32.7767, -96.7970, 300);

    expect(result).toHaveLength(3); // Dallas, Houston, Austin (not null one)
  });

  it('excludes tournaments without coordinates', () => {
    const result = filterByDistance(tournaments, 32.7767, -96.7970, 1000);

    expect(result.every((t) => t.lat !== null)).toBe(true);
  });

  it('adds distanceMiles to results', () => {
    const result = filterByDistance(tournaments, 32.7767, -96.7970, 300);

    expect(result[0].distanceMiles).toBeDefined();
    expect(typeof result[0].distanceMiles).toBe('number');
  });

  it('sorts by distance ascending', () => {
    const result = filterByDistance(tournaments, 32.7767, -96.7970, 300);

    for (let i = 1; i < result.length; i++) {
      expect(result[i].distanceMiles).toBeGreaterThanOrEqual(result[i - 1].distanceMiles!);
    }
  });
});
