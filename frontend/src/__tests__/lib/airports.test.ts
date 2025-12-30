import { describe, it, expect } from 'vitest';
import {
  searchAirports,
  findNearestAirport,
  getAirportByCode,
  getAllAirports,
  type Airport,
} from '@/lib/airports';

describe('airports', () => {
  describe('searchAirports', () => {
    it('should find airports by IATA code', () => {
      const results = searchAirports('DFW');
      expect(results.some((a) => a.iataCode === 'DFW')).toBe(true);
    });

    it('should find airports by city name', () => {
      const results = searchAirports('dallas');
      expect(results.some((a) => a.city.toLowerCase().includes('dallas'))).toBe(true);
    });

    it('should return empty for short queries', () => {
      const results = searchAirports('d');
      expect(results).toHaveLength(0);
    });

    it('should limit results to 10', () => {
      const results = searchAirports('new');
      expect(results.length).toBeLessThanOrEqual(10);
    });

    it('should be case-insensitive', () => {
      const results = searchAirports('MIAMI');
      expect(results.some((a) => a.iataCode === 'MIA')).toBe(true);
    });

    it('should find airports by name', () => {
      const results = searchAirports("O'Hare");
      expect(results.some((a) => a.iataCode === 'ORD')).toBe(true);
    });

    it('should return empty array for no matches', () => {
      const results = searchAirports('zzzzz');
      expect(results).toHaveLength(0);
    });
  });

  describe('findNearestAirport', () => {
    it('should find DFW for Dallas coordinates', () => {
      const result = findNearestAirport(32.7767, -96.797);
      expect(result?.iataCode).toBe('DFW');
    });

    it('should find LAX for LA coordinates', () => {
      const result = findNearestAirport(34.0522, -118.2437);
      expect(result?.iataCode).toBe('LAX');
    });

    it('should find MIA for Miami coordinates', () => {
      const result = findNearestAirport(25.7617, -80.1918);
      expect(result?.iataCode).toBe('MIA');
    });

    it('should find LAS for Las Vegas coordinates', () => {
      const result = findNearestAirport(36.1147, -115.1728);
      expect(result?.iataCode).toBe('LAS');
    });
  });

  describe('getAirportByCode', () => {
    it('should return airport for valid IATA code', () => {
      const airport = getAirportByCode('DFW');
      expect(airport).not.toBeNull();
      expect(airport?.iataCode).toBe('DFW');
      expect(airport?.city).toBe('Dallas');
    });

    it('should be case-insensitive', () => {
      const airport = getAirportByCode('dfw');
      expect(airport).not.toBeNull();
      expect(airport?.iataCode).toBe('DFW');
    });

    it('should return null for unknown code', () => {
      const airport = getAirportByCode('XXX');
      expect(airport).toBeNull();
    });
  });

  describe('getAllAirports', () => {
    it('should return all airports', () => {
      const airports = getAllAirports();
      expect(airports.length).toBeGreaterThan(0);
      expect(airports.some((a) => a.iataCode === 'DFW')).toBe(true);
      expect(airports.some((a) => a.iataCode === 'LAX')).toBe(true);
    });
  });
});
