import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { handler } from '../../handlers/flightPrices.js';
import { getFlightPricesForAirport } from '../../db/flightPriceQueries.js';

const mockContext = {} as Context;

// Mock the flight price queries
jest.mock('../../db/flightPriceQueries.js', () => ({
  getFlightPricesForAirport: jest.fn(),
}));

// Mock auth middleware
jest.mock('../../handlers/middleware/authMiddleware.js', () => ({
  extractAuthContext: jest.fn(() => ({
    userId: 'test-user-123',
    email: 'test@example.com',
  })),
}));

const mockGetFlightPricesForAirport = getFlightPricesForAirport as jest.MockedFunction<
  typeof getFlightPricesForAirport
>;

function createMockEvent(overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent {
  return {
    httpMethod: 'GET',
    path: '/flight-prices',
    pathParameters: null,
    queryStringParameters: null,
    headers: {
      Authorization: 'Bearer test-token',
    },
    body: null,
    isBase64Encoded: false,
    requestContext: {} as APIGatewayProxyEvent['requestContext'],
    resource: '',
    stageVariables: null,
    multiValueHeaders: {},
    multiValueQueryStringParameters: null,
    ...overrides,
  };
}

describe('flightPrices handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /flight-prices', () => {
    it('should return 400 when airport query param is missing', async () => {
      const event = createMockEvent({
        queryStringParameters: null,
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.message).toContain('airport');
    });

    it('should return 400 when airport query param is empty', async () => {
      const event = createMockEvent({
        queryStringParameters: { airport: '' },
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(400);
    });

    it('should return flight prices for a valid airport', async () => {
      const mockPrices = [
        {
          PK: 'FLIGHT#DFW#Miami',
          SK: '2025-02-15',
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
          ttl: 1735689600,
        },
        {
          PK: 'FLIGHT#DFW#Las Vegas',
          SK: '2025-03-10',
          originAirport: 'DFW',
          destinationCity: 'Las Vegas',
          tournamentStartDate: '2025-03-10',
          price: 199,
          currency: 'USD' as const,
          airline: 'Southwest',
          fetchedAt: '2025-01-01T00:00:00Z',
          expiresAt: '2025-01-02T00:00:00Z',
          source: 'amadeus' as const,
          rangeMin: null,
          rangeMax: null,
          ttl: 1735689600,
        },
      ];

      mockGetFlightPricesForAirport.mockResolvedValue(mockPrices);

      const event = createMockEvent({
        queryStringParameters: { airport: 'DFW' },
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.prices).toHaveLength(2);
      expect(body.prices[0].originAirport).toBe('DFW');
      expect(body.prices[0].price).toBe(287);
      expect(mockGetFlightPricesForAirport).toHaveBeenCalledWith('DFW');
    });

    it('should return empty array when no prices exist for airport', async () => {
      mockGetFlightPricesForAirport.mockResolvedValue([]);

      const event = createMockEvent({
        queryStringParameters: { airport: 'XYZ' },
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.prices).toHaveLength(0);
    });

    it('should uppercase the airport code', async () => {
      mockGetFlightPricesForAirport.mockResolvedValue([]);

      const event = createMockEvent({
        queryStringParameters: { airport: 'dfw' },
      });

      await handler(event, mockContext);

      expect(mockGetFlightPricesForAirport).toHaveBeenCalledWith('DFW');
    });
  });

  describe('unsupported methods', () => {
    it('should return 405 for POST requests', async () => {
      const event = createMockEvent({
        httpMethod: 'POST',
        queryStringParameters: { airport: 'DFW' },
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(405);
    });
  });
});
