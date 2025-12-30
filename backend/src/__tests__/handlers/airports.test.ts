import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { handler } from '../../handlers/airports.js';
import { saveKnownAirport, getKnownAirport } from '../../db/airportQueries.js';
import * as eventBridgeService from '../../services/eventBridgeService.js';

// Mock the airport queries
jest.mock('../../db/airportQueries.js', () => ({
  saveKnownAirport: jest.fn(),
  getKnownAirport: jest.fn(),
}));

// Mock EventBridge service
jest.mock('../../services/eventBridgeService.js', () => ({
  publishAirportAddedEvent: jest.fn(),
}));

// Mock auth middleware
jest.mock('../../handlers/middleware/authMiddleware.js', () => ({
  extractAuthContext: jest.fn(() => ({
    userId: 'test-user-123',
    email: 'test@example.com',
  })),
}));

const mockSaveKnownAirport = saveKnownAirport as jest.MockedFunction<
  typeof saveKnownAirport
>;
const mockGetKnownAirport = getKnownAirport as jest.MockedFunction<
  typeof getKnownAirport
>;
const mockPublishAirportAddedEvent = eventBridgeService.publishAirportAddedEvent as jest.MockedFunction<
  typeof eventBridgeService.publishAirportAddedEvent
>;

const mockContext = {} as Context;

function createMockEvent(overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent {
  return {
    httpMethod: 'POST',
    path: '/airports',
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

describe('airports handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /airports', () => {
    it('should return 400 when airport is missing from body', async () => {
      const event = createMockEvent({
        body: JSON.stringify({}),
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.message).toContain('airport');
    });

    it('should return 400 when body is null', async () => {
      const event = createMockEvent({
        body: null,
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(400);
    });

    it('should return 400 when airport code is invalid (too short)', async () => {
      const event = createMockEvent({
        body: JSON.stringify({ airport: 'DF' }),
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.message).toContain('valid');
    });

    it('should return 400 when airport code is invalid (too long)', async () => {
      const event = createMockEvent({
        body: JSON.stringify({ airport: 'DFWX' }),
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(400);
    });

    it('should save airport and return 202 for valid airport', async () => {
      mockSaveKnownAirport.mockResolvedValue(undefined);
      mockGetKnownAirport.mockResolvedValue(null); // New airport
      mockPublishAirportAddedEvent.mockResolvedValue(undefined);

      const event = createMockEvent({
        body: JSON.stringify({ airport: 'DFW' }),
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(202);
      const body = JSON.parse(result.body);
      expect(body.airport).toBe('DFW');
      expect(body.message).toContain('registered');
      expect(mockSaveKnownAirport).toHaveBeenCalledWith('DFW');
    });

    it('should uppercase the airport code', async () => {
      mockSaveKnownAirport.mockResolvedValue(undefined);
      mockGetKnownAirport.mockResolvedValue(null);
      mockPublishAirportAddedEvent.mockResolvedValue(undefined);

      const event = createMockEvent({
        body: JSON.stringify({ airport: 'dfw' }),
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(202);
      expect(mockSaveKnownAirport).toHaveBeenCalledWith('DFW');
    });

    it('should trigger EventBridge event for new airports', async () => {
      mockSaveKnownAirport.mockResolvedValue(undefined);
      mockGetKnownAirport.mockResolvedValue(null); // New airport
      mockPublishAirportAddedEvent.mockResolvedValue(undefined);

      const event = createMockEvent({
        body: JSON.stringify({ airport: 'LAX' }),
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(202);
      expect(mockPublishAirportAddedEvent).toHaveBeenCalledWith('LAX', 'test-user-123');
    });

    it('should not trigger EventBridge for existing airports', async () => {
      mockGetKnownAirport.mockResolvedValue({
        PK: 'AIRPORT#DFW',
        SK: 'META',
        GSI1PK: 'AIRPORTS',
        GSI1SK: 'DFW',
        iataCode: 'DFW',
        userCount: 5,
        lastFetchedAt: '2025-01-01T00:00:00Z',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      });
      mockSaveKnownAirport.mockResolvedValue(undefined);

      const event = createMockEvent({
        body: JSON.stringify({ airport: 'DFW' }),
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(202);
      // Should not send EventBridge event for existing airport
      expect(mockPublishAirportAddedEvent).not.toHaveBeenCalled();
    });
  });

  describe('unsupported methods', () => {
    it('should return 405 for GET requests', async () => {
      const event = createMockEvent({
        httpMethod: 'GET',
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(405);
    });
  });
});
