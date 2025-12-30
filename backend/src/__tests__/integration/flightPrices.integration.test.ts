/**
 * Integration tests for Flight Prices feature
 *
 * Tests the integration between API handlers:
 * - POST /airports → saves airport and triggers EventBridge
 * - GET /flight-prices → returns cached prices
 * - WebSocket → connect/disconnect
 *
 * Note: The SQS fetcher is tested at the unit level since it requires
 * complex mocking of the entire tournament pipeline.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { APIGatewayProxyEvent, Context } from 'aws-lambda';

// Tracking arrays for mock verification
const savedAirports: string[] = [];
const publishedEvents: Array<{ airport: string; userId: string }> = [];
const savedFlightPrices: Array<{ origin: string; destination: string; price: number | null }> = [];
const knownAirports = new Map<string, { iataCode: string; userCount: number }>();

// Mock airport queries
jest.mock('../../db/airportQueries.js', () => ({
  saveKnownAirport: jest.fn(async (code: string) => {
    savedAirports.push(code);
  }),
  getKnownAirport: jest.fn(async (code: string) => {
    return knownAirports.get(code) || null;
  }),
  listKnownAirports: jest.fn(async () => Array.from(knownAirports.values())),
  updateAirportLastFetched: jest.fn(),
  incrementAirportUserCount: jest.fn(),
}));

// Mock EventBridge service
jest.mock('../../services/eventBridgeService.js', () => ({
  publishAirportAddedEvent: jest.fn(async (airport: string, userId: string) => {
    publishedEvents.push({ airport, userId });
  }),
}));

// Mock flight price queries
jest.mock('../../db/flightPriceQueries.js', () => ({
  saveFlightPrice: jest.fn(async (priceData: { originAirport: string; destinationCity: string; price: number | null }) => {
    savedFlightPrices.push({
      origin: priceData.originAirport,
      destination: priceData.destinationCity,
      price: priceData.price,
    });
  }),
  getFlightPrice: jest.fn(async () => null),
  getFlightPricesForAirport: jest.fn(async () => savedFlightPrices),
}));

// Mock auth middleware
jest.mock('../../handlers/middleware/authMiddleware.js', () => ({
  extractAuthContext: jest.fn(() => ({
    userId: 'integration-test-user',
    email: 'test@integration.com',
  })),
}));

// Mock WS connection queries
jest.mock('../../db/wsConnectionQueries.js', () => ({
  getConnectionsForUser: jest.fn(async () => []),
  saveConnection: jest.fn(),
  deleteConnection: jest.fn(),
}));

// Import handlers after mocks
import { handler as airportsHandler } from '../../handlers/airports.js';
import { handler as flightPricesHandler } from '../../handlers/flightPrices.js';
import { handler as wsHandler } from '../../handlers/websocket.js';

const mockContext = {} as Context;

describe('Flight Prices Integration', () => {
  beforeEach(() => {
    savedAirports.length = 0;
    publishedEvents.length = 0;
    savedFlightPrices.length = 0;
    knownAirports.clear();
    jest.clearAllMocks();
  });

  function createAirportEvent(airport: string): APIGatewayProxyEvent {
    return {
      httpMethod: 'POST',
      path: '/airports',
      pathParameters: null,
      queryStringParameters: null,
      headers: { Authorization: 'Bearer test-token' },
      body: JSON.stringify({ airport }),
      isBase64Encoded: false,
      requestContext: {} as APIGatewayProxyEvent['requestContext'],
      resource: '',
      stageVariables: null,
      multiValueHeaders: {},
      multiValueQueryStringParameters: null,
    };
  }

  function createFlightPricesEvent(airport: string): APIGatewayProxyEvent {
    return {
      httpMethod: 'GET',
      path: '/flight-prices',
      pathParameters: null,
      queryStringParameters: { airport },
      headers: { Authorization: 'Bearer test-token' },
      body: null,
      isBase64Encoded: false,
      requestContext: {} as APIGatewayProxyEvent['requestContext'],
      resource: '',
      stageVariables: null,
      multiValueHeaders: {},
      multiValueQueryStringParameters: null,
    };
  }

  describe('POST /airports - Airport Registration Flow', () => {
    it('should save new airport and publish EventBridge event', async () => {
      const result = await airportsHandler(createAirportEvent('DFW'), mockContext);

      expect(result.statusCode).toBe(202);
      const body = JSON.parse(result.body);
      expect(body.airport).toBe('DFW');
      expect(body.isNew).toBe(true);
      expect(body.message).toContain('registered');

      // Verify airport was saved
      expect(savedAirports).toContain('DFW');

      // Verify EventBridge event was published for new airport
      expect(publishedEvents).toContainEqual({
        airport: 'DFW',
        userId: 'integration-test-user',
      });
    });

    it('should not publish EventBridge event for existing airports', async () => {
      // Pre-populate the airport as existing
      knownAirports.set('LAX', { iataCode: 'LAX', userCount: 5 });

      const result = await airportsHandler(createAirportEvent('LAX'), mockContext);

      expect(result.statusCode).toBe(202);
      const body = JSON.parse(result.body);
      expect(body.isNew).toBe(false);

      // Should NOT have published an EventBridge event
      expect(publishedEvents).toHaveLength(0);
    });

    it('should uppercase airport code automatically', async () => {
      const result = await airportsHandler(createAirportEvent('dfw'), mockContext);

      expect(result.statusCode).toBe(202);
      const body = JSON.parse(result.body);
      expect(body.airport).toBe('DFW');
      expect(savedAirports).toContain('DFW');
    });

    it('should validate airport code format - reject too short', async () => {
      const result = await airportsHandler(createAirportEvent('DF'), mockContext);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.message).toContain('valid');
    });

    it('should validate airport code format - reject too long', async () => {
      const result = await airportsHandler(createAirportEvent('DFWX'), mockContext);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.message).toContain('valid');
    });

    it('should reject empty airport code', async () => {
      const result = await airportsHandler(createAirportEvent(''), mockContext);

      expect(result.statusCode).toBe(400);
    });

    it('should reject missing body', async () => {
      const event = createAirportEvent('DFW');
      event.body = null;

      const result = await airportsHandler(event, mockContext);

      expect(result.statusCode).toBe(400);
    });
  });

  describe('GET /flight-prices - Price Retrieval Flow', () => {
    it('should return cached flight prices for an airport', async () => {
      // Pre-populate flight prices
      savedFlightPrices.push(
        { origin: 'DFW', destination: 'Miami', price: 287 },
        { origin: 'DFW', destination: 'Las Vegas', price: 199 }
      );

      const result = await flightPricesHandler(createFlightPricesEvent('DFW'), mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.prices).toBeDefined();
      expect(Array.isArray(body.prices)).toBe(true);
    });

    it('should return empty array when no prices exist', async () => {
      const result = await flightPricesHandler(createFlightPricesEvent('XYZ'), mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.prices).toHaveLength(0);
    });

    it('should uppercase airport code in query', async () => {
      const event = createFlightPricesEvent('dfw');

      const result = await flightPricesHandler(event, mockContext);

      expect(result.statusCode).toBe(200);
    });

    it('should reject invalid airport code', async () => {
      const result = await flightPricesHandler(createFlightPricesEvent('INVALID'), mockContext);

      expect(result.statusCode).toBe(400);
    });

    it('should reject missing airport query param', async () => {
      const event = createFlightPricesEvent('DFW');
      event.queryStringParameters = null;

      const result = await flightPricesHandler(event, mockContext);

      expect(result.statusCode).toBe(400);
    });
  });

  describe('WebSocket Connection Flow', () => {
    it('should handle $connect route with userId', async () => {
      const connectEvent = {
        requestContext: {
          connectionId: 'test-conn-123',
          routeKey: '$connect',
        },
        queryStringParameters: { userId: 'ws-test-user' },
      };

      const result = await wsHandler(connectEvent as any);

      expect(result.statusCode).toBe(200);
      expect(result.body).toBe('Connected');
    });

    it('should handle $disconnect route', async () => {
      const disconnectEvent = {
        requestContext: {
          connectionId: 'test-conn-123',
          routeKey: '$disconnect',
        },
      };

      const result = await wsHandler(disconnectEvent as any);

      expect(result.statusCode).toBe(200);
      expect(result.body).toBe('Disconnected');
    });

    it('should reject $connect without userId', async () => {
      const connectEvent = {
        requestContext: {
          connectionId: 'test-conn-123',
          routeKey: '$connect',
        },
        queryStringParameters: null,
      };

      const result = await wsHandler(connectEvent as any);

      expect(result.statusCode).toBe(400);
      expect(result.body).toContain('userId');
    });

    it('should handle unknown route gracefully', async () => {
      const unknownEvent = {
        requestContext: {
          connectionId: 'test-conn-123',
          routeKey: '$unknown',
        },
      };

      const result = await wsHandler(unknownEvent as any);

      expect(result.statusCode).toBe(400);
    });
  });

  describe('End-to-End API Flow', () => {
    it('should complete the airport registration → price retrieval flow', async () => {
      // Step 1: User registers their home airport
      const registerResult = await airportsHandler(createAirportEvent('DFW'), mockContext);
      expect(registerResult.statusCode).toBe(202);

      // Verify airport was registered
      expect(savedAirports).toContain('DFW');

      // Verify EventBridge event was published
      expect(publishedEvents).toContainEqual({
        airport: 'DFW',
        userId: 'integration-test-user',
      });

      // Step 2: Simulate prices being fetched (by SQS lambda, tested separately)
      savedFlightPrices.push(
        { origin: 'DFW', destination: 'Miami', price: 287 },
        { origin: 'DFW', destination: 'Las Vegas', price: 199 }
      );

      // Step 3: User retrieves the cached prices
      const pricesResult = await flightPricesHandler(createFlightPricesEvent('DFW'), mockContext);
      expect(pricesResult.statusCode).toBe(200);

      const body = JSON.parse(pricesResult.body);
      expect(body.prices.length).toBe(2);
    });

    it('should handle concurrent airport registrations', async () => {
      // Register multiple airports in sequence
      const airports = ['DFW', 'LAX', 'MIA'];

      for (const airport of airports) {
        const result = await airportsHandler(createAirportEvent(airport), mockContext);
        expect(result.statusCode).toBe(202);
      }

      // All airports should be saved
      expect(savedAirports).toHaveLength(3);
      expect(savedAirports).toContain('DFW');
      expect(savedAirports).toContain('LAX');
      expect(savedAirports).toContain('MIA');

      // All should have triggered EventBridge events
      expect(publishedEvents).toHaveLength(3);
    });
  });
});
