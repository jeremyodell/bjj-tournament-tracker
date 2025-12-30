import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import {
  calculateSmartTTL,
  shouldFetchFlightPrice,
  calculateDistance,
  estimateDriveCost,
  getTravelRecommendation,
} from '../../services/flightPriceService.js';

describe('flightPriceService', () => {
  describe('calculateSmartTTL', () => {
    it('should return 24hr TTL for tournaments < 30 days away', () => {
      const tournamentDate = new Date();
      tournamentDate.setDate(tournamentDate.getDate() + 15);

      const expiry = calculateSmartTTL(tournamentDate);
      const hoursUntilExpiry = (expiry.getTime() - Date.now()) / (1000 * 60 * 60);

      // Should be approximately 24 hours (with some tolerance)
      expect(hoursUntilExpiry).toBeGreaterThan(23);
      expect(hoursUntilExpiry).toBeLessThan(25);
    });

    it('should return 3-day TTL for tournaments 30-90 days away', () => {
      const tournamentDate = new Date();
      tournamentDate.setDate(tournamentDate.getDate() + 60);

      const expiry = calculateSmartTTL(tournamentDate);
      const daysUntilExpiry = (expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24);

      // Should be approximately 3 days
      expect(daysUntilExpiry).toBeGreaterThan(2.9);
      expect(daysUntilExpiry).toBeLessThan(3.1);
    });

    it('should return 7-day TTL for tournaments > 90 days away', () => {
      const tournamentDate = new Date();
      tournamentDate.setDate(tournamentDate.getDate() + 120);

      const expiry = calculateSmartTTL(tournamentDate);
      const daysUntilExpiry = (expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24);

      // Should be approximately 7 days
      expect(daysUntilExpiry).toBeGreaterThan(6.9);
      expect(daysUntilExpiry).toBeLessThan(7.1);
    });

    it('should return 3-day TTL for tournaments exactly 30 days away', () => {
      const tournamentDate = new Date();
      tournamentDate.setDate(tournamentDate.getDate() + 30);

      const expiry = calculateSmartTTL(tournamentDate);
      const daysUntilExpiry = (expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24);

      // At exactly 30 days, should use 3-day cache (30-90 days tier)
      expect(daysUntilExpiry).toBeGreaterThan(2.9);
      expect(daysUntilExpiry).toBeLessThan(3.1);
    });
  });

  describe('calculateDistance', () => {
    it('should calculate distance between Dallas and Houston', () => {
      // DFW: 32.8998, -97.0403
      // Houston: 29.7604, -95.3698
      const distance = calculateDistance(32.8998, -97.0403, 29.7604, -95.3698);

      // Should be approximately 225-240 miles
      expect(distance).toBeGreaterThan(220);
      expect(distance).toBeLessThan(250);
    });

    it('should calculate distance between Dallas and Miami', () => {
      // DFW: 32.8998, -97.0403
      // Miami: 25.7617, -80.1918
      const distance = calculateDistance(32.8998, -97.0403, 25.7617, -80.1918);

      // Should be approximately 1100-1200 miles
      expect(distance).toBeGreaterThan(1100);
      expect(distance).toBeLessThan(1200);
    });

    it('should return 0 for same location', () => {
      const distance = calculateDistance(32.8998, -97.0403, 32.8998, -97.0403);
      expect(distance).toBe(0);
    });
  });

  describe('shouldFetchFlightPrice', () => {
    const dfwAirport = { lat: 32.8998, lng: -97.0403, city: 'Dallas' };

    it('should return false for tournaments within drive range', () => {
      // Houston is ~4 hours from Dallas (240 miles at 60mph)
      const houstonTournament = { lat: 29.7604, lng: -95.3698, city: 'Houston' };
      const maxDriveHours = 6;

      const result = shouldFetchFlightPrice(dfwAirport, houstonTournament, maxDriveHours);
      expect(result).toBe(false);
    });

    it('should return true for tournaments outside drive range', () => {
      // Miami is ~18 hours from Dallas
      const miamiTournament = { lat: 25.7617, lng: -80.1918, city: 'Miami' };
      const maxDriveHours = 6;

      const result = shouldFetchFlightPrice(dfwAirport, miamiTournament, maxDriveHours);
      expect(result).toBe(true);
    });

    it('should return false for same city when maxDriveHours is 0', () => {
      const dallasTournament = { lat: 32.7767, lng: -96.7970, city: 'Dallas' };
      const maxDriveHours = 0;

      const result = shouldFetchFlightPrice(dfwAirport, dallasTournament, maxDriveHours);
      expect(result).toBe(false);
    });

    it('should return true for other cities when maxDriveHours is 0', () => {
      // User only flies - any non-local tournament should be fetched
      const houstonTournament = { lat: 29.7604, lng: -95.3698, city: 'Houston' };
      const maxDriveHours = 0;

      const result = shouldFetchFlightPrice(dfwAirport, houstonTournament, maxDriveHours);
      expect(result).toBe(true);
    });

    it('should be case-insensitive for city comparison', () => {
      const dallasTournament = { lat: 32.7767, lng: -96.7970, city: 'DALLAS' };
      const maxDriveHours = 0;

      const result = shouldFetchFlightPrice(dfwAirport, dallasTournament, maxDriveHours);
      expect(result).toBe(false);
    });

    it('should return true when tournament is exactly at drive range boundary', () => {
      // 360 miles at 60mph = 6 hours
      // San Antonio is about 275 miles from DFW
      const sanAntonioTournament = { lat: 29.4241, lng: -98.4936, city: 'San Antonio' };
      const maxDriveHours = 4; // Less than actual drive time

      const result = shouldFetchFlightPrice(dfwAirport, sanAntonioTournament, maxDriveHours);
      expect(result).toBe(true);
    });
  });

  describe('estimateDriveCost', () => {
    it('should calculate round-trip cost using IRS mileage rate', () => {
      // 100 miles one-way = 200 miles round trip * $0.67 = $134
      const cost = estimateDriveCost(100);
      expect(cost).toBe(134);
    });

    it('should return 0 for zero distance', () => {
      const cost = estimateDriveCost(0);
      expect(cost).toBe(0);
    });

    it('should round to nearest dollar', () => {
      // 150 miles one-way = 300 miles * $0.67 = $201
      const cost = estimateDriveCost(150);
      expect(cost).toBe(201);
    });
  });

  describe('getTravelRecommendation', () => {
    it('should recommend drive when within drive range preference', () => {
      // 200 miles = ~3.3 hours, within 6 hour preference
      const result = getTravelRecommendation(200, 300, 6);
      expect(result).toBe('drive');
    });

    it('should recommend fly when outside drive range and flying is cheaper', () => {
      // 600 miles = 10 hours, flight $300, drive $804
      const result = getTravelRecommendation(600, 300, 6);
      expect(result).toBe('fly');
    });

    it('should recommend fly when flight price is null and distance is long', () => {
      // Long distance but no flight price - assume fly is better
      const result = getTravelRecommendation(1000, null, 6);
      expect(result).toBe('fly');
    });

    it('should recommend drive for moderate distances when cost-effective', () => {
      // 400 miles = ~6.7 hours, drive cost $536
      // Flight is $700 - drive is cheaper even though over preference
      const result = getTravelRecommendation(400, 700, 4);
      expect(result).toBe('drive');
    });

    it('should recommend fly for long distances even if driving is slightly cheaper', () => {
      // 800 miles = ~13 hours, drive cost $1,072
      // Flight is $400 - fly wins
      const result = getTravelRecommendation(800, 400, 6);
      expect(result).toBe('fly');
    });

    it('should recommend drive when within max drive hours', () => {
      // User willing to drive 8 hours, 480 miles = 8 hours
      const result = getTravelRecommendation(480, 200, 8);
      expect(result).toBe('drive');
    });
  });
});
