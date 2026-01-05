import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { handler } from '../../handlers/adminMatches.js';
import type { APIGatewayProxyEvent, Context } from 'aws-lambda';
import type { PendingMatchItem, MatchSignals, MasterGymItem, SourceGymItem } from '../../db/types.js';

// Mock the database modules
jest.mock('../../db/pendingMatchQueries.js', () => ({
  getPendingMatch: jest.fn(),
  listPendingMatches: jest.fn(),
  updatePendingMatchStatus: jest.fn(),
}));

jest.mock('../../db/masterGymQueries.js', () => ({
  createMasterGym: jest.fn(),
  getMasterGym: jest.fn(),
  linkSourceGymToMaster: jest.fn(),
  unlinkSourceGymFromMaster: jest.fn(),
}));

jest.mock('../../db/gymQueries.js', () => ({
  getSourceGym: jest.fn(),
}));

// Mock auth middleware
jest.mock('../../handlers/middleware/authMiddleware.js', () => ({
  extractAuthContext: jest.fn(() => ({
    userId: 'test-user-123',
    email: 'admin@example.com',
  })),
}));

import {
  getPendingMatch,
  listPendingMatches,
  updatePendingMatchStatus,
} from '../../db/pendingMatchQueries.js';
import {
  createMasterGym,
  getMasterGym,
  linkSourceGymToMaster,
  unlinkSourceGymFromMaster,
} from '../../db/masterGymQueries.js';
import { getSourceGym } from '../../db/gymQueries.js';

const mockGetPendingMatch = getPendingMatch as jest.MockedFunction<typeof getPendingMatch>;
const mockListPendingMatches = listPendingMatches as jest.MockedFunction<typeof listPendingMatches>;
const mockUpdatePendingMatchStatus = updatePendingMatchStatus as jest.MockedFunction<typeof updatePendingMatchStatus>;
const mockCreateMasterGym = createMasterGym as jest.MockedFunction<typeof createMasterGym>;
const mockGetMasterGym = getMasterGym as jest.MockedFunction<typeof getMasterGym>;
const mockLinkSourceGymToMaster = linkSourceGymToMaster as jest.MockedFunction<typeof linkSourceGymToMaster>;
const mockUnlinkSourceGymFromMaster = unlinkSourceGymFromMaster as jest.MockedFunction<typeof unlinkSourceGymFromMaster>;
const mockGetSourceGym = getSourceGym as jest.MockedFunction<typeof getSourceGym>;

function createMockEvent(overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent {
  return {
    httpMethod: 'GET',
    path: '/admin/pending-matches',
    pathParameters: null,
    queryStringParameters: null,
    headers: {
      'x-user-id': 'test-user-123',
    },
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

const mockSignals: MatchSignals = {
  nameSimilarity: 85,
  cityBoost: 15,
  affiliationBoost: 0,
};

function createMockPendingMatch(overrides: Partial<PendingMatchItem> = {}): PendingMatchItem {
  return {
    PK: 'PENDINGMATCH#test-id',
    SK: 'META',
    GSI1PK: 'PENDINGMATCHES',
    GSI1SK: 'pending#2026-01-01T00:00:00Z',
    id: 'test-id',
    sourceGym1Id: 'SRCGYM#JJWL#123',
    sourceGym1Name: 'Test Gym JJWL',
    sourceGym2Id: 'SRCGYM#IBJJF#456',
    sourceGym2Name: 'Test Gym IBJJF',
    confidence: 85,
    signals: mockSignals,
    status: 'pending',
    reviewedAt: null,
    reviewedBy: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function createMockSourceGym(overrides: Partial<SourceGymItem> = {}): SourceGymItem {
  return {
    PK: 'SRCGYM#JJWL#123',
    SK: 'META',
    GSI1PK: 'GYMS',
    GSI1SK: 'JJWL#Test Gym',
    org: 'JJWL',
    externalId: '123',
    name: 'Test Gym',
    masterGymId: null,
    city: 'Test City',
    country: 'USA',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('adminMatches handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /admin/pending-matches', () => {
    it('should list pending matches', async () => {
      const mockMatches = [createMockPendingMatch()];
      mockListPendingMatches.mockResolvedValueOnce(mockMatches);

      const event = createMockEvent({
        httpMethod: 'GET',
        path: '/admin/pending-matches',
        queryStringParameters: { status: 'pending' },
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.matches).toHaveLength(1);
      expect(body.matches[0].id).toBe('test-id');
      expect(mockListPendingMatches).toHaveBeenCalledWith('pending');
    });

    it('should default to pending status', async () => {
      mockListPendingMatches.mockResolvedValueOnce([]);

      const event = createMockEvent({
        httpMethod: 'GET',
        path: '/admin/pending-matches',
      });

      await handler(event, mockContext);

      expect(mockListPendingMatches).toHaveBeenCalledWith('pending');
    });

    it('should support filtering by approved status', async () => {
      mockListPendingMatches.mockResolvedValueOnce([]);

      const event = createMockEvent({
        httpMethod: 'GET',
        path: '/admin/pending-matches',
        queryStringParameters: { status: 'approved' },
      });

      await handler(event, mockContext);

      expect(mockListPendingMatches).toHaveBeenCalledWith('approved');
    });
  });

  describe('POST /admin/pending-matches/{id}/approve', () => {
    it('should approve match and create master gym', async () => {
      const mockMatch = createMockPendingMatch();
      mockGetPendingMatch.mockResolvedValueOnce(mockMatch);
      mockGetSourceGym.mockResolvedValue(createMockSourceGym());
      mockCreateMasterGym.mockResolvedValueOnce({
        id: 'new-master-id',
        PK: 'MASTERGYM#new-master-id',
        SK: 'META',
        GSI1PK: 'MASTERGYMS',
        GSI1SK: 'Test Gym JJWL',
        canonicalName: 'Test Gym JJWL',
        city: 'Test City',
        country: 'USA',
        address: null,
        website: null,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      });

      const event = createMockEvent({
        httpMethod: 'POST',
        path: '/admin/pending-matches/test-id/approve',
        pathParameters: { id: 'test-id' },
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.masterGymId).toBe('new-master-id');
      expect(mockCreateMasterGym).toHaveBeenCalled();
      expect(mockLinkSourceGymToMaster).toHaveBeenCalledTimes(2);
      expect(mockUpdatePendingMatchStatus).toHaveBeenCalledWith('test-id', 'approved', 'test-user-123');
    });

    it('should return 404 for non-existent match', async () => {
      mockGetPendingMatch.mockResolvedValueOnce(null);

      const event = createMockEvent({
        httpMethod: 'POST',
        path: '/admin/pending-matches/nonexistent/approve',
        pathParameters: { id: 'nonexistent' },
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(404);
    });

    it('should return 400 for already reviewed match', async () => {
      const mockMatch = createMockPendingMatch({ status: 'approved' });
      mockGetPendingMatch.mockResolvedValueOnce(mockMatch);

      const event = createMockEvent({
        httpMethod: 'POST',
        path: '/admin/pending-matches/test-id/approve',
        pathParameters: { id: 'test-id' },
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(400);
    });
  });

  describe('POST /admin/pending-matches/{id}/reject', () => {
    it('should reject match', async () => {
      const mockMatch = createMockPendingMatch();
      mockGetPendingMatch.mockResolvedValueOnce(mockMatch);

      const event = createMockEvent({
        httpMethod: 'POST',
        path: '/admin/pending-matches/test-id/reject',
        pathParameters: { id: 'test-id' },
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      expect(mockUpdatePendingMatchStatus).toHaveBeenCalledWith('test-id', 'rejected', 'test-user-123');
    });

    it('should return 404 for non-existent match', async () => {
      mockGetPendingMatch.mockResolvedValueOnce(null);

      const event = createMockEvent({
        httpMethod: 'POST',
        path: '/admin/pending-matches/nonexistent/reject',
        pathParameters: { id: 'nonexistent' },
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(404);
    });
  });

  describe('POST /admin/master-gyms/{id}/unlink', () => {
    it('should unlink source gym from master', async () => {
      mockGetMasterGym.mockResolvedValueOnce({
        id: 'master-id',
        PK: 'MASTERGYM#master-id',
        SK: 'META',
        GSI1PK: 'MASTERGYMS',
        GSI1SK: 'Test Gym',
        canonicalName: 'Test Gym',
        city: null,
        country: null,
        address: null,
        website: null,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      });

      const event = createMockEvent({
        httpMethod: 'POST',
        path: '/admin/master-gyms/master-id/unlink',
        pathParameters: { id: 'master-id' },
        body: JSON.stringify({ sourceGymId: 'SRCGYM#JJWL#123' }),
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(200);
      expect(mockUnlinkSourceGymFromMaster).toHaveBeenCalledWith('JJWL', '123');
    });

    it('should return 404 for non-existent master gym', async () => {
      mockGetMasterGym.mockResolvedValueOnce(null);

      const event = createMockEvent({
        httpMethod: 'POST',
        path: '/admin/master-gyms/nonexistent/unlink',
        pathParameters: { id: 'nonexistent' },
        body: JSON.stringify({ sourceGymId: 'SRCGYM#JJWL#123' }),
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(404);
    });

    it('should return 400 for missing sourceGymId', async () => {
      mockGetMasterGym.mockResolvedValueOnce({} as MasterGymItem);

      const event = createMockEvent({
        httpMethod: 'POST',
        path: '/admin/master-gyms/master-id/unlink',
        pathParameters: { id: 'master-id' },
        body: JSON.stringify({}),
      });

      const result = await handler(event, mockContext);

      expect(result.statusCode).toBe(400);
    });
  });
});
