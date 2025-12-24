/**
 * Integration tests for tournament handler.
 * These tests hit real DynamoDB Local - ensure it's running:
 *   docker compose up -d
 *
 * Run with:
 *   npm run test:integration
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';

// Set environment BEFORE importing modules that use it
process.env.DYNAMODB_ENDPOINT = 'http://localhost:8000';
process.env.DYNAMODB_TABLE = 'bjj-tournament-tracker-test';
process.env.AWS_REGION = 'us-east-1';

import {
  createTestTable,
  deleteTestTable,
  seedTournaments,
  isDynamoDBLocalRunning,
  TEST_TOURNAMENTS,
} from './setup.js';
import { handler } from '../../handlers/tournaments.js';
import { mockAPIGatewayEvent, mockContext, parseResponseBody } from '../utils/testHelpers.js';

describe('Tournament Handler Integration Tests', () => {
  const context = mockContext();

  beforeAll(async () => {
    // Check DynamoDB Local is running
    const isRunning = await isDynamoDBLocalRunning();
    if (!isRunning) {
      throw new Error(
        'DynamoDB Local is not running. Start it with: docker compose up -d'
      );
    }

    // Create test table
    await createTestTable();
  });

  afterAll(async () => {
    // Clean up test table
    await deleteTestTable();
  });

  beforeEach(async () => {
    // Seed fresh data before each test
    await deleteTestTable();
    await createTestTable();
    await seedTournaments(TEST_TOURNAMENTS);
  });

  describe('GET /tournaments', () => {
    it('returns all tournaments from the database', async () => {
      const event = mockAPIGatewayEvent({
        httpMethod: 'GET',
        path: '/tournaments',
        queryStringParameters: null,
      });

      const result = await handler(event, context);

      expect(result).toBeDefined();
      expect(result!.statusCode).toBe(200);

      const body = parseResponseBody<{
        tournaments: Array<{ id: string; name: string; org: string }>;
      }>(result!);

      expect(body.tournaments).toHaveLength(5);

      // Verify tournaments are sorted by date (GSI1SK)
      const dates = body.tournaments.map((t) => t.id);
      expect(dates).toContain('TOURN#JJWL#2001'); // Feb 20 - earliest
    });

    it('filters by organization', async () => {
      const event = mockAPIGatewayEvent({
        httpMethod: 'GET',
        path: '/tournaments',
        queryStringParameters: { org: 'IBJJF' },
      });

      const result = await handler(event, context);
      const body = parseResponseBody<{
        tournaments: Array<{ org: string }>;
      }>(result!);

      expect(body.tournaments).toHaveLength(3);
      expect(body.tournaments.every((t) => t.org === 'IBJJF')).toBe(true);
    });

    it('filters by gi tournaments', async () => {
      const event = mockAPIGatewayEvent({
        httpMethod: 'GET',
        path: '/tournaments',
        queryStringParameters: { gi: 'true' },
      });

      const result = await handler(event, context);
      const body = parseResponseBody<{
        tournaments: Array<{ gi: boolean }>;
      }>(result!);

      expect(body.tournaments.length).toBeGreaterThan(0);
      expect(body.tournaments.every((t) => t.gi === true)).toBe(true);
    });

    it('filters by nogi tournaments', async () => {
      const event = mockAPIGatewayEvent({
        httpMethod: 'GET',
        path: '/tournaments',
        queryStringParameters: { nogi: 'true' },
      });

      const result = await handler(event, context);
      const body = parseResponseBody<{
        tournaments: Array<{ nogi: boolean; name: string }>;
      }>(result!);

      // JJWL Austin (gi + nogi) and JJWL No-Gi
      expect(body.tournaments.length).toBe(2);
      expect(body.tournaments.every((t) => t.nogi === true)).toBe(true);
    });

    it('filters by kids tournaments', async () => {
      const event = mockAPIGatewayEvent({
        httpMethod: 'GET',
        path: '/tournaments',
        queryStringParameters: { kids: 'true' },
      });

      const result = await handler(event, context);
      const body = parseResponseBody<{
        tournaments: Array<{ kids: boolean; name: string }>;
      }>(result!);

      expect(body.tournaments).toHaveLength(1);
      expect(body.tournaments[0].name).toBe('Kids International Championship');
    });

    it('filters by city', async () => {
      const event = mockAPIGatewayEvent({
        httpMethod: 'GET',
        path: '/tournaments',
        queryStringParameters: { city: 'Las Vegas' },
      });

      const result = await handler(event, context);
      const body = parseResponseBody<{
        tournaments: Array<{ city: string; name: string }>;
      }>(result!);

      expect(body.tournaments).toHaveLength(1);
      expect(body.tournaments[0].name).toBe('World Championship 2025');
    });

    it('searches by tournament name', async () => {
      const event = mockAPIGatewayEvent({
        httpMethod: 'GET',
        path: '/tournaments',
        queryStringParameters: { search: 'World' },
      });

      const result = await handler(event, context);
      const body = parseResponseBody<{
        tournaments: Array<{ name: string }>;
      }>(result!);

      expect(body.tournaments).toHaveLength(1);
      expect(body.tournaments[0].name).toContain('World');
    });

    it('combines multiple filters', async () => {
      const event = mockAPIGatewayEvent({
        httpMethod: 'GET',
        path: '/tournaments',
        queryStringParameters: {
          org: 'IBJJF',
          gi: 'true',
          kids: 'false',
        },
      });

      const result = await handler(event, context);
      const body = parseResponseBody<{
        tournaments: Array<{ org: string; gi: boolean; kids: boolean }>;
      }>(result!);

      // Pan and Worlds (not Kids)
      expect(body.tournaments).toHaveLength(2);
      expect(
        body.tournaments.every(
          (t) => t.org === 'IBJJF' && t.gi === true && t.kids === false
        )
      ).toBe(true);
    });

    it('respects limit parameter', async () => {
      const event = mockAPIGatewayEvent({
        httpMethod: 'GET',
        path: '/tournaments',
        queryStringParameters: { limit: '2' },
      });

      const result = await handler(event, context);
      const body = parseResponseBody<{
        tournaments: Array<unknown>;
        nextCursor?: string;
      }>(result!);

      expect(body.tournaments).toHaveLength(2);
      expect(body.nextCursor).toBeDefined();
    });

    it('paginates with cursor', async () => {
      // Get first page
      const firstEvent = mockAPIGatewayEvent({
        httpMethod: 'GET',
        path: '/tournaments',
        queryStringParameters: { limit: '2' },
      });

      const firstResult = await handler(firstEvent, context);
      const firstBody = parseResponseBody<{
        tournaments: Array<{ id: string }>;
        nextCursor: string;
      }>(firstResult!);

      expect(firstBody.tournaments).toHaveLength(2);
      expect(firstBody.nextCursor).toBeDefined();

      // Get second page
      const secondEvent = mockAPIGatewayEvent({
        httpMethod: 'GET',
        path: '/tournaments',
        queryStringParameters: {
          limit: '2',
          cursor: firstBody.nextCursor,
        },
      });

      const secondResult = await handler(secondEvent, context);
      const secondBody = parseResponseBody<{
        tournaments: Array<{ id: string }>;
      }>(secondResult!);

      expect(secondBody.tournaments).toHaveLength(2);

      // Ensure no duplicates between pages
      const firstIds = firstBody.tournaments.map((t) => t.id);
      const secondIds = secondBody.tournaments.map((t) => t.id);
      const intersection = firstIds.filter((id) => secondIds.includes(id));
      expect(intersection).toHaveLength(0);
    });

    it('returns empty list when no matches', async () => {
      const event = mockAPIGatewayEvent({
        httpMethod: 'GET',
        path: '/tournaments',
        queryStringParameters: { city: 'Nonexistent City' },
      });

      const result = await handler(event, context);
      const body = parseResponseBody<{
        tournaments: Array<unknown>;
      }>(result!);

      expect(result!.statusCode).toBe(200);
      expect(body.tournaments).toHaveLength(0);
    });
  });

  describe('GET /tournaments/:id', () => {
    it('returns a single tournament by ID', async () => {
      const event = mockAPIGatewayEvent({
        httpMethod: 'GET',
        path: '/tournaments/TOURN#IBJJF#1001',
        pathParameters: { id: 'TOURN#IBJJF#1001' },
      });

      const result = await handler(event, context);

      expect(result!.statusCode).toBe(200);

      const body = parseResponseBody<{
        id: string;
        name: string;
        org: string;
        city: string;
      }>(result!);

      expect(body.id).toBe('TOURN#IBJJF#1001');
      expect(body.name).toBe('Pan American Championship 2025');
      expect(body.org).toBe('IBJJF');
      expect(body.city).toBe('Irvine');
    });

    it('returns 404 for non-existent tournament', async () => {
      const event = mockAPIGatewayEvent({
        httpMethod: 'GET',
        path: '/tournaments/TOURN#IBJJF#9999',
        pathParameters: { id: 'TOURN#IBJJF#9999' },
      });

      const result = await handler(event, context);

      expect(result!.statusCode).toBe(404);

      const body = parseResponseBody<{ error: string; message: string }>(result!);
      expect(body.error).toBe('NOT_FOUND');
    });
  });

  describe('Response format', () => {
    it('returns proper tournament structure', async () => {
      const event = mockAPIGatewayEvent({
        httpMethod: 'GET',
        path: '/tournaments',
        queryStringParameters: { limit: '1' },
      });

      const result = await handler(event, context);
      const body = parseResponseBody<{
        tournaments: Array<Record<string, unknown>>;
      }>(result!);

      const tournament = body.tournaments[0];

      // Verify all expected fields are present
      expect(tournament).toHaveProperty('id');
      expect(tournament).toHaveProperty('org');
      expect(tournament).toHaveProperty('externalId');
      expect(tournament).toHaveProperty('name');
      expect(tournament).toHaveProperty('city');
      expect(tournament).toHaveProperty('venue');
      expect(tournament).toHaveProperty('country');
      expect(tournament).toHaveProperty('startDate');
      expect(tournament).toHaveProperty('endDate');
      expect(tournament).toHaveProperty('gi');
      expect(tournament).toHaveProperty('nogi');
      expect(tournament).toHaveProperty('kids');
      expect(tournament).toHaveProperty('registrationUrl');
    });

    it('includes CORS headers', async () => {
      const event = mockAPIGatewayEvent({
        httpMethod: 'GET',
        path: '/tournaments',
      });

      const result = await handler(event, context);

      expect(result!.headers).toBeDefined();
      expect(result!.headers!['Access-Control-Allow-Origin']).toBe('*');
      expect(result!.headers!['Content-Type']).toBe('application/json');
    });
  });
});
