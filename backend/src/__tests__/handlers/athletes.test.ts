import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { handler } from '../../handlers/athletes.js';
import * as athleteQueries from '../../db/athleteQueries.js';
import * as airportQueries from '../../db/airportQueries.js';
import * as eventBridgeService from '../../services/eventBridgeService.js';
import type { AthleteItem } from '../../db/types.js';

// Mock the athlete queries
jest.mock('../../db/athleteQueries.js', () => ({
  getUserAthletes: jest.fn(),
  createAthlete: jest.fn(),
  updateAthlete: jest.fn(),
  deleteAthlete: jest.fn(),
  getAthlete: jest.fn(),
}));

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

const mockGetUserAthletes = athleteQueries.getUserAthletes as jest.MockedFunction<
  typeof athleteQueries.getUserAthletes
>;
const mockCreateAthlete = athleteQueries.createAthlete as jest.MockedFunction<
  typeof athleteQueries.createAthlete
>;
const mockUpdateAthlete = athleteQueries.updateAthlete as jest.MockedFunction<
  typeof athleteQueries.updateAthlete
>;
const mockDeleteAthlete = athleteQueries.deleteAthlete as jest.MockedFunction<
  typeof athleteQueries.deleteAthlete
>;
const mockGetAthlete = athleteQueries.getAthlete as jest.MockedFunction<
  typeof athleteQueries.getAthlete
>;
const mockSaveKnownAirport = airportQueries.saveKnownAirport as jest.MockedFunction<
  typeof airportQueries.saveKnownAirport
>;
const mockGetKnownAirport = airportQueries.getKnownAirport as jest.MockedFunction<
  typeof airportQueries.getKnownAirport
>;
const mockPublishAirportAddedEvent = eventBridgeService.publishAirportAddedEvent as jest.MockedFunction<
  typeof eventBridgeService.publishAirportAddedEvent
>;

const mockContext = {} as Context;

function createMockEvent(overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent {
  return {
    httpMethod: 'GET',
    path: '/athletes',
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

function createMockAthlete(overrides: Partial<AthleteItem> = {}): AthleteItem {
  return {
    PK: 'USER#test-user-123',
    SK: 'ATHLETE#test-athlete-id',
    athleteId: 'test-athlete-id',
    name: 'Test Athlete',
    beltRank: 'blue',
    birthYear: 2015,
    weightClass: '50lbs',
    homeAirport: null,
    gymSourceId: null,
    gymName: null,
    masterGymId: null,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('athletes handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('PUT /athletes/:athleteId - homeAirport change', () => {
    it('should trigger airport registration when homeAirport changes from null to a new airport', async () => {
      const existingAthlete = createMockAthlete({ homeAirport: null });
      const updatedAthlete = createMockAthlete({ homeAirport: 'JFK' });

      mockGetAthlete.mockResolvedValue(existingAthlete);
      mockUpdateAthlete.mockResolvedValue(updatedAthlete);
      mockGetKnownAirport.mockResolvedValue(null); // New airport
      mockSaveKnownAirport.mockResolvedValue(undefined);
      mockPublishAirportAddedEvent.mockResolvedValue(undefined);

      const event = createMockEvent({
        httpMethod: 'PUT',
        pathParameters: { athleteId: 'test-athlete-id' },
        body: JSON.stringify({ homeAirport: 'JFK' }),
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      expect(mockSaveKnownAirport).toHaveBeenCalledWith('JFK');
      expect(mockPublishAirportAddedEvent).toHaveBeenCalledWith('JFK', 'test-user-123');
    });

    it('should trigger airport registration when homeAirport changes from one airport to another', async () => {
      const existingAthlete = createMockAthlete({ homeAirport: 'IAH' });
      const updatedAthlete = createMockAthlete({ homeAirport: 'JFK' });

      mockGetAthlete.mockResolvedValue(existingAthlete);
      mockUpdateAthlete.mockResolvedValue(updatedAthlete);
      mockGetKnownAirport.mockResolvedValue(null); // New airport
      mockSaveKnownAirport.mockResolvedValue(undefined);
      mockPublishAirportAddedEvent.mockResolvedValue(undefined);

      const event = createMockEvent({
        httpMethod: 'PUT',
        pathParameters: { athleteId: 'test-athlete-id' },
        body: JSON.stringify({ homeAirport: 'JFK' }),
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      expect(mockSaveKnownAirport).toHaveBeenCalledWith('JFK');
      expect(mockPublishAirportAddedEvent).toHaveBeenCalledWith('JFK', 'test-user-123');
    });

    it('should not trigger airport registration when homeAirport does not change', async () => {
      const existingAthlete = createMockAthlete({ homeAirport: 'DFW' });
      const updatedAthlete = createMockAthlete({ homeAirport: 'DFW' });

      mockGetAthlete.mockResolvedValue(existingAthlete);
      mockUpdateAthlete.mockResolvedValue(updatedAthlete);

      const event = createMockEvent({
        httpMethod: 'PUT',
        pathParameters: { athleteId: 'test-athlete-id' },
        body: JSON.stringify({ homeAirport: 'DFW' }),
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      expect(mockSaveKnownAirport).not.toHaveBeenCalled();
      expect(mockPublishAirportAddedEvent).not.toHaveBeenCalled();
    });

    it('should not trigger EventBridge when airport already exists in the system', async () => {
      const existingAthlete = createMockAthlete({ homeAirport: 'IAH' });
      const updatedAthlete = createMockAthlete({ homeAirport: 'DFW' });

      mockGetAthlete.mockResolvedValue(existingAthlete);
      mockUpdateAthlete.mockResolvedValue(updatedAthlete);
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
        httpMethod: 'PUT',
        pathParameters: { athleteId: 'test-athlete-id' },
        body: JSON.stringify({ homeAirport: 'DFW' }),
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      expect(mockSaveKnownAirport).toHaveBeenCalledWith('DFW');
      expect(mockPublishAirportAddedEvent).not.toHaveBeenCalled();
    });

    it('should not trigger airport registration when homeAirport is not in the update', async () => {
      const existingAthlete = createMockAthlete({ homeAirport: 'IAH' });
      const updatedAthlete = createMockAthlete({ homeAirport: 'IAH', name: 'Updated Name' });

      mockGetAthlete.mockResolvedValue(existingAthlete);
      mockUpdateAthlete.mockResolvedValue(updatedAthlete);

      const event = createMockEvent({
        httpMethod: 'PUT',
        pathParameters: { athleteId: 'test-athlete-id' },
        body: JSON.stringify({ name: 'Updated Name' }),
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      expect(mockSaveKnownAirport).not.toHaveBeenCalled();
      expect(mockPublishAirportAddedEvent).not.toHaveBeenCalled();
    });
  });

  describe('GET /athletes', () => {
    it('should return list of athletes', async () => {
      const athletes = [createMockAthlete()];
      mockGetUserAthletes.mockResolvedValue(athletes);

      const event = createMockEvent({
        httpMethod: 'GET',
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.athletes).toEqual(athletes);
    });
  });

  describe('POST /athletes', () => {
    it('should return 400 when name is missing', async () => {
      const event = createMockEvent({
        httpMethod: 'POST',
        body: JSON.stringify({}),
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(400);
    });

    it('should create athlete successfully', async () => {
      const newAthlete = createMockAthlete();
      mockCreateAthlete.mockResolvedValue(newAthlete);

      const event = createMockEvent({
        httpMethod: 'POST',
        body: JSON.stringify({ name: 'Test Athlete' }),
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(201);
    });

    it('should create athlete with gym fields', async () => {
      const athleteWithGym = createMockAthlete({
        gymSourceId: 'JJWL#5713',
        gymName: 'Gracie Barra Houston',
        masterGymId: 'master-gym-123',
      });
      mockCreateAthlete.mockResolvedValue(athleteWithGym);

      const event = createMockEvent({
        httpMethod: 'POST',
        body: JSON.stringify({
          name: 'Test Athlete',
          gymSourceId: 'JJWL#5713',
          gymDisplayName: 'Gracie Barra Houston',
          masterGymId: 'master-gym-123',
        }),
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(201);
      expect(mockCreateAthlete).toHaveBeenCalledWith('test-user-123', {
        name: 'Test Athlete',
        gymSourceId: 'JJWL#5713',
        gymDisplayName: 'Gracie Barra Houston',
        masterGymId: 'master-gym-123',
      });
      const body = JSON.parse(result.body);
      expect(body.gymSourceId).toBe('JJWL#5713');
      expect(body.gymName).toBe('Gracie Barra Houston');
      expect(body.masterGymId).toBe('master-gym-123');
    });
  });

  describe('PUT /athletes/:athleteId', () => {
    it('should return 400 when athlete not found', async () => {
      mockUpdateAthlete.mockResolvedValue(null);

      const event = createMockEvent({
        httpMethod: 'PUT',
        pathParameters: { athleteId: 'non-existent' },
        body: JSON.stringify({ name: 'Updated' }),
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(400);
    });

    it('should update athlete gym fields', async () => {
      const existingAthlete = createMockAthlete({
        gymSourceId: null,
        gymName: null,
        masterGymId: null,
      });
      const updatedAthlete = createMockAthlete({
        gymSourceId: 'IBJJF#12345',
        gymName: 'Alliance BJJ',
        masterGymId: 'master-gym-456',
      });

      mockGetAthlete.mockResolvedValue(existingAthlete);
      mockUpdateAthlete.mockResolvedValue(updatedAthlete);

      const event = createMockEvent({
        httpMethod: 'PUT',
        pathParameters: { athleteId: 'test-athlete-id' },
        body: JSON.stringify({
          gymSourceId: 'IBJJF#12345',
          gymDisplayName: 'Alliance BJJ',
          masterGymId: 'master-gym-456',
        }),
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      expect(mockUpdateAthlete).toHaveBeenCalledWith('test-user-123', 'test-athlete-id', {
        gymSourceId: 'IBJJF#12345',
        gymDisplayName: 'Alliance BJJ',
        masterGymId: 'master-gym-456',
      });
      const body = JSON.parse(result.body);
      expect(body.gymSourceId).toBe('IBJJF#12345');
      expect(body.gymName).toBe('Alliance BJJ');
      expect(body.masterGymId).toBe('master-gym-456');
    });

    it('should clear gym fields when set to null', async () => {
      const existingAthlete = createMockAthlete({
        gymSourceId: 'JJWL#5713',
        gymName: 'Gracie Barra Houston',
        masterGymId: 'master-gym-123',
      });
      const updatedAthlete = createMockAthlete({
        gymSourceId: null,
        gymName: null,
        masterGymId: null,
      });

      mockGetAthlete.mockResolvedValue(existingAthlete);
      mockUpdateAthlete.mockResolvedValue(updatedAthlete);

      const event = createMockEvent({
        httpMethod: 'PUT',
        pathParameters: { athleteId: 'test-athlete-id' },
        body: JSON.stringify({
          gymSourceId: null,
          gymDisplayName: null,
          masterGymId: null,
        }),
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.gymSourceId).toBeNull();
      expect(body.gymName).toBeNull();
      expect(body.masterGymId).toBeNull();
    });
  });

  describe('DELETE /athletes/:athleteId', () => {
    it('should delete athlete successfully', async () => {
      mockDeleteAthlete.mockResolvedValue(undefined);

      const event = createMockEvent({
        httpMethod: 'DELETE',
        pathParameters: { athleteId: 'test-athlete-id' },
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(204);
    });
  });
});
