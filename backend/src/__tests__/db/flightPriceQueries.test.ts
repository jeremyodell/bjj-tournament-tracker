import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import {
  saveFlightPrice,
  getFlightPrice,
  getFlightPricesForAirport,
  getExpiredFlightPrices,
} from '../../db/flightPriceQueries.js';
import { docClient } from '../../db/client.js';
import type { FlightPriceItem } from '../../db/types.js';

// Mock the docClient
jest.mock('../../db/client.js', () => ({
  docClient: {
    send: jest.fn(),
  },
  TABLE_NAME: 'bjj-tournament-tracker-test',
  GSI1_NAME: 'GSI1',
}));

const mockSend = docClient.send as jest.MockedFunction<typeof docClient.send>;

describe('flightPriceQueries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('saveFlightPrice', () => {
    it('should save a flight price with correct PK/SK', async () => {
      mockSend.mockResolvedValueOnce({} as never);

      const priceData = {
        originAirport: 'DFW',
        destinationCity: 'Miami',
        tournamentStartDate: '2025-02-15',
        price: 287,
        currency: 'USD' as const,
        airline: 'American',
        fetchedAt: '2025-01-01T00:00:00Z',
        expiresAt: '2025-01-02T00:00:00Z',
        source: 'amadeus' as const,
        rangeMin: null,
        rangeMax: null,
      };

      await saveFlightPrice(priceData);

      expect(mockSend).toHaveBeenCalledTimes(1);
      const command = mockSend.mock.calls[0][0];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const input = command.input as any;
      expect(input.TableName).toBe('bjj-tournament-tracker-test');
      expect(input.Item.PK).toBe('FLIGHT#DFW#Miami');
      expect(input.Item.SK).toBe('2025-02-15');
      expect(input.Item.price).toBe(287);
      expect(input.Item.originAirport).toBe('DFW');
      expect(input.Item.destinationCity).toBe('Miami');
    });

    it('should calculate TTL from expiresAt', async () => {
      mockSend.mockResolvedValueOnce({} as never);

      const expiresAt = '2025-01-02T00:00:00Z';
      await saveFlightPrice({
        originAirport: 'DFW',
        destinationCity: 'Miami',
        tournamentStartDate: '2025-02-15',
        price: 287,
        currency: 'USD' as const,
        airline: null,
        fetchedAt: '2025-01-01T00:00:00Z',
        expiresAt,
        source: 'amadeus' as const,
        rangeMin: null,
        rangeMax: null,
      });

      const command = mockSend.mock.calls[0][0];
      const expectedTtl = Math.floor(new Date(expiresAt).getTime() / 1000);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((command.input as any).Item.ttl).toBe(expectedTtl);
    });
  });

  describe('getFlightPrice', () => {
    it('should return flight price when found', async () => {
      const mockItem: FlightPriceItem = {
        PK: 'FLIGHT#DFW#Miami',
        SK: '2025-02-15',
        price: 287,
        currency: 'USD',
        airline: 'American',
        fetchedAt: '2025-01-01T00:00:00Z',
        expiresAt: '2025-01-02T00:00:00Z',
        source: 'amadeus',
        rangeMin: null,
        rangeMax: null,
        originAirport: 'DFW',
        destinationCity: 'Miami',
        tournamentStartDate: '2025-02-15',
        ttl: 1735776000,
      };

      mockSend.mockResolvedValueOnce({ Item: mockItem } as never);

      const result = await getFlightPrice('DFW', 'Miami', '2025-02-15');

      expect(result).not.toBeNull();
      expect(result?.price).toBe(287);
      expect(result?.airline).toBe('American');
    });

    it('should return null when not found', async () => {
      mockSend.mockResolvedValueOnce({ Item: undefined } as never);

      const result = await getFlightPrice('DFW', 'Unknown', '2025-02-15');

      expect(result).toBeNull();
    });
  });

  describe('getFlightPricesForAirport', () => {
    it('should return all prices for an origin airport', async () => {
      const mockItems: FlightPriceItem[] = [
        {
          PK: 'FLIGHT#DFW#Miami',
          SK: '2025-02-15',
          price: 287,
          currency: 'USD',
          airline: null,
          fetchedAt: '2025-01-01T00:00:00Z',
          expiresAt: '2025-01-02T00:00:00Z',
          source: 'amadeus',
          rangeMin: null,
          rangeMax: null,
          originAirport: 'DFW',
          destinationCity: 'Miami',
          tournamentStartDate: '2025-02-15',
          ttl: 1735776000,
        },
        {
          PK: 'FLIGHT#DFW#Las Vegas',
          SK: '2025-03-10',
          price: 199,
          currency: 'USD',
          airline: null,
          fetchedAt: '2025-01-01T00:00:00Z',
          expiresAt: '2025-01-02T00:00:00Z',
          source: 'amadeus',
          rangeMin: null,
          rangeMax: null,
          originAirport: 'DFW',
          destinationCity: 'Las Vegas',
          tournamentStartDate: '2025-03-10',
          ttl: 1735776000,
        },
      ];

      mockSend.mockResolvedValueOnce({ Items: mockItems } as never);

      const results = await getFlightPricesForAirport('DFW');

      expect(results).toHaveLength(2);
      expect(results[0].price).toBe(287);
      expect(results[1].price).toBe(199);
    });

    it('should return empty array when no prices found', async () => {
      mockSend.mockResolvedValueOnce({ Items: [] } as never);

      const results = await getFlightPricesForAirport('XXX');

      expect(results).toHaveLength(0);
    });
  });

  describe('getExpiredFlightPrices', () => {
    it('should return expired flight prices', async () => {
      const mockItems: FlightPriceItem[] = [
        {
          PK: 'FLIGHT#DFW#Miami',
          SK: '2025-02-15',
          price: 287,
          currency: 'USD',
          airline: null,
          fetchedAt: '2025-01-01T00:00:00Z',
          expiresAt: '2024-12-01T00:00:00Z', // expired
          source: 'amadeus',
          rangeMin: null,
          rangeMax: null,
          originAirport: 'DFW',
          destinationCity: 'Miami',
          tournamentStartDate: '2025-02-15',
          ttl: 1735776000,
        },
      ];

      mockSend.mockResolvedValueOnce({ Items: mockItems } as never);

      const results = await getExpiredFlightPrices();

      expect(results).toHaveLength(1);
      expect(results[0].originAirport).toBe('DFW');
    });
  });
});
