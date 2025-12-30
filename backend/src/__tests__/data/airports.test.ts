import { describe, it, expect } from '@jest/globals';
import {
  getAirportByCode,
  getAllAirports,
  findNearestAirport,
  searchAirports,
} from '../../data/airports.js';

describe('airports data', () => {
  describe('getAirportByCode', () => {
    it('should return airport for valid IATA code', () => {
      const airport = getAirportByCode('DFW');
      expect(airport).toBeDefined();
      expect(airport?.iataCode).toBe('DFW');
      expect(airport?.city).toBe('Dallas');
    });

    it('should be case-insensitive', () => {
      const airport = getAirportByCode('dfw');
      expect(airport).toBeDefined();
      expect(airport?.iataCode).toBe('DFW');
    });

    it('should return undefined for unknown code', () => {
      const airport = getAirportByCode('XXX');
      expect(airport).toBeUndefined();
    });
  });

  describe('getAllAirports', () => {
    it('should return all airports', () => {
      const airports = getAllAirports();
      expect(airports.length).toBeGreaterThan(0);
      expect(airports.some(a => a.iataCode === 'DFW')).toBe(true);
      expect(airports.some(a => a.iataCode === 'LAX')).toBe(true);
    });
  });

  describe('findNearestAirport', () => {
    it('should find DFW for coordinates near Dallas', () => {
      // Downtown Dallas coordinates
      const airport = findNearestAirport(32.7767, -96.7970);
      expect(airport).toBeDefined();
      expect(airport?.iataCode).toBe('DFW');
    });

    it('should find MIA for coordinates near Miami', () => {
      // Downtown Miami coordinates
      const airport = findNearestAirport(25.7617, -80.1918);
      expect(airport).toBeDefined();
      expect(airport?.iataCode).toBe('MIA');
    });

    it('should find LAX for coordinates in Los Angeles', () => {
      // Downtown LA coordinates
      const airport = findNearestAirport(34.0522, -118.2437);
      expect(airport).toBeDefined();
      expect(airport?.iataCode).toBe('LAX');
    });

    it('should find LAS for coordinates in Las Vegas', () => {
      // Las Vegas Strip coordinates
      const airport = findNearestAirport(36.1147, -115.1728);
      expect(airport).toBeDefined();
      expect(airport?.iataCode).toBe('LAS');
    });
  });

  describe('searchAirports', () => {
    it('should find airports by IATA code', () => {
      const results = searchAirports('DFW');
      expect(results.length).toBe(1);
      expect(results[0].iataCode).toBe('DFW');
    });

    it('should find airports by city name', () => {
      const results = searchAirports('Miami');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(a => a.iataCode === 'MIA')).toBe(true);
    });

    it('should be case-insensitive', () => {
      const results = searchAirports('miami');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(a => a.iataCode === 'MIA')).toBe(true);
    });

    it('should find airports by name', () => {
      const results = searchAirports('O\'Hare');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(a => a.iataCode === 'ORD')).toBe(true);
    });

    it('should return empty array for no matches', () => {
      const results = searchAirports('zzzzz');
      expect(results).toHaveLength(0);
    });

    it('should find multiple airports for generic search', () => {
      const results = searchAirports('Houston');
      expect(results.length).toBeGreaterThanOrEqual(2); // IAH and HOU
      expect(results.some(a => a.iataCode === 'IAH')).toBe(true);
      expect(results.some(a => a.iataCode === 'HOU')).toBe(true);
    });
  });
});
