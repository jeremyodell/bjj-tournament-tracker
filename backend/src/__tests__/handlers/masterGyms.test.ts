import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { handler } from '../../handlers/masterGyms.js';
import type { APIGatewayProxyEvent, Context } from 'aws-lambda';
import type { MasterGymItem } from '../../db/types.js';

// Mock the database modules
jest.mock('../../db/masterGymQueries.js', () => ({
  getMasterGym: jest.fn(),
  searchMasterGyms: jest.fn(),
}));

import { getMasterGym, searchMasterGyms } from '../../db/masterGymQueries.js';

const mockGetMasterGym = getMasterGym as jest.MockedFunction<typeof getMasterGym>;
const mockSearchMasterGyms = searchMasterGyms as jest.MockedFunction<typeof searchMasterGyms>;

function createMockEvent(overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent {
  return {
    httpMethod: 'GET',
    path: '/gyms',
    pathParameters: null,
    queryStringParameters: null,
    headers: {},
    body: null,
    isBase64Encoded: false,
    multiValueHeaders: {},
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {} as never,
    resource: '',
    ...overrides,
  };
}

const mockContext: Context = {
  callbackWaitsForEmptyEventLoop: false,
  functionName: 'test',
  functionVersion: '1',
  invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:test',
  memoryLimitInMB: '128',
  awsRequestId: 'test-request-id',
  logGroupName: 'test-log-group',
  logStreamName: 'test-log-stream',
  getRemainingTimeInMillis: () => 30000,
  done: () => {},
  fail: () => {},
  succeed: () => {},
};

function createMockMasterGym(overrides: Partial<MasterGymItem> = {}): MasterGymItem {
  return {
    PK: 'MASTERGYM#test-id',
    SK: 'META',
    GSI1PK: 'MASTERGYMS',
    GSI1SK: 'Test Gym',
    id: 'test-id',
    canonicalName: 'Test Gym',
    city: 'Test City',
    country: 'USA',
    address: '123 Test St',
    website: 'https://test.com',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('masterGyms handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /gyms/{id}', () => {
    it('should return gym when found', async () => {
      const mockGym = createMockMasterGym();
      mockGetMasterGym.mockResolvedValueOnce(mockGym);

      const event = createMockEvent({
        httpMethod: 'GET',
        path: '/gyms/test-id',
        pathParameters: { id: 'test-id' },
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.id).toBe('test-id');
      expect(body.canonicalName).toBe('Test Gym');
      expect(body.city).toBe('Test City');
      expect(mockGetMasterGym).toHaveBeenCalledWith('test-id');
    });

    it('should return 404 when gym not found', async () => {
      mockGetMasterGym.mockResolvedValueOnce(null);

      const event = createMockEvent({
        httpMethod: 'GET',
        path: '/gyms/nonexistent',
        pathParameters: { id: 'nonexistent' },
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(404);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('Gym not found');
    });
  });

  describe('GET /gyms/search', () => {
    it('should search gyms by query', async () => {
      const mockGyms = [
        createMockMasterGym({ id: '1', canonicalName: 'Gracie Barra' }),
        createMockMasterGym({ id: '2', canonicalName: 'Gracie Humaita' }),
      ];
      mockSearchMasterGyms.mockResolvedValueOnce(mockGyms);

      const event = createMockEvent({
        httpMethod: 'GET',
        path: '/gyms/search',
        queryStringParameters: { q: 'Gracie' },
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.gyms).toHaveLength(2);
      expect(body.gyms[0].canonicalName).toBe('Gracie Barra');
      expect(mockSearchMasterGyms).toHaveBeenCalledWith('Gracie', 20);
    });

    it('should return 400 for query less than 2 characters', async () => {
      const event = createMockEvent({
        httpMethod: 'GET',
        path: '/gyms/search',
        queryStringParameters: { q: 'G' },
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.error).toBe('VALIDATION_ERROR');
      expect(body.message).toContain('at least 2 characters');
    });

    it('should return 400 when query is missing', async () => {
      const event = createMockEvent({
        httpMethod: 'GET',
        path: '/gyms/search',
        queryStringParameters: null,
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(400);
    });

    it('should return empty array when no matches', async () => {
      mockSearchMasterGyms.mockResolvedValueOnce([]);

      const event = createMockEvent({
        httpMethod: 'GET',
        path: '/gyms/search',
        queryStringParameters: { q: 'NonexistentGym' },
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.gyms).toHaveLength(0);
    });
  });

  describe('unsupported methods', () => {
    it('should return 405 for POST', async () => {
      const event = createMockEvent({
        httpMethod: 'POST',
        path: '/gyms',
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(405);
    });
  });
});
