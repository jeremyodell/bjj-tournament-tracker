import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import {
  mockContext,
  parseResponseBody,
  createGymsSearchEvent,
  createGymDetailEvent,
  createGymRosterEvent,
} from '../utils/testHelpers.js';

// Mock dependencies before importing handler
jest.mock('../../db/gymQueries.js');
jest.mock('../../services/gymSyncService.js');

import { handler } from '../../handlers/gyms.js';
import * as gymQueries from '../../db/gymQueries.js';
import * as gymSyncService from '../../services/gymSyncService.js';

const context = mockContext();

describe('gyms handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /gyms (search)', () => {
    it('returns 400 if org query param is missing', async () => {
      const event = createGymsSearchEvent({ search: 'Pablo' });
      const result = await handler(event, context);

      expect(result.statusCode).toBe(400);
      const body = parseResponseBody<{ error: string; message: string }>(result);
      expect(body.error).toBe('VALIDATION_ERROR');
    });

    it('returns 400 if org is invalid', async () => {
      const event = createGymsSearchEvent({ org: 'INVALID', search: 'Pablo' });
      const result = await handler(event, context);

      expect(result.statusCode).toBe(400);
    });

    it('searches gyms with valid org and search params', async () => {
      const mockGyms = [
        {
          org: 'JJWL' as const,
          externalId: '123',
          name: 'Pablo Silva BJJ',
          PK: 'SRCGYM#JJWL#123',
          SK: 'META' as const,
          GSI1PK: 'GYMS' as const,
          GSI1SK: 'JJWL#Pablo Silva BJJ',
          masterGymId: null,
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
        },
      ];
      jest.spyOn(gymQueries, 'searchGyms').mockResolvedValue(mockGyms);

      const event = createGymsSearchEvent({ org: 'JJWL', search: 'Pablo' });
      const result = await handler(event, context);

      expect(result.statusCode).toBe(200);
      const body = parseResponseBody<{
        gyms: Array<{ org: string; externalId: string; name: string }>;
      }>(result);
      expect(body.gyms).toHaveLength(1);
      expect(body.gyms[0]).toEqual({
        org: 'JJWL',
        externalId: '123',
        name: 'Pablo Silva BJJ',
      });
    });

    it('returns empty array when no gyms match', async () => {
      jest.spyOn(gymQueries, 'searchGyms').mockResolvedValue([]);

      const event = createGymsSearchEvent({ org: 'JJWL', search: 'NonExistent' });
      const result = await handler(event, context);

      expect(result.statusCode).toBe(200);
      const body = parseResponseBody<{ gyms: unknown[] }>(result);
      expect(body.gyms).toHaveLength(0);
    });

    it('searches with empty search param (lists all)', async () => {
      jest.spyOn(gymQueries, 'searchGyms').mockResolvedValue([]);

      const event = createGymsSearchEvent({ org: 'JJWL' });
      const result = await handler(event, context);

      expect(result.statusCode).toBe(200);
      expect(gymQueries.searchGyms).toHaveBeenCalledWith('JJWL', '');
    });
  });

  describe('GET /gyms/:org/:externalId (detail)', () => {
    it('returns gym details', async () => {
      const mockGym = {
        org: 'JJWL' as const,
        externalId: '123',
        name: 'Test Gym',
        PK: 'SRCGYM#JJWL#123',
        SK: 'META' as const,
        GSI1PK: 'GYMS' as const,
        GSI1SK: 'JJWL#Test Gym',
        masterGymId: null,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      };
      jest.spyOn(gymQueries, 'getSourceGym').mockResolvedValue(mockGym);

      const event = createGymDetailEvent('JJWL', '123');
      const result = await handler(event, context);

      expect(result.statusCode).toBe(200);
      const body = parseResponseBody<{
        org: string;
        externalId: string;
        name: string;
      }>(result);
      expect(body).toEqual({
        org: 'JJWL',
        externalId: '123',
        name: 'Test Gym',
      });
    });

    it('returns 404 if gym not found', async () => {
      jest.spyOn(gymQueries, 'getSourceGym').mockResolvedValue(null);

      const event = createGymDetailEvent('JJWL', '999');
      const result = await handler(event, context);

      expect(result.statusCode).toBe(404);
      const body = parseResponseBody<{ error: string; message: string }>(result);
      expect(body.error).toBe('NOT_FOUND');
    });

    it('returns 400 for invalid org', async () => {
      const event = createGymDetailEvent('INVALID', '123');
      const result = await handler(event, context);

      expect(result.statusCode).toBe(400);
    });
  });

  describe('GET /gyms/:org/:externalId/roster/:tournamentId', () => {
    it('returns cached roster', async () => {
      const mockRoster = {
        PK: 'TOURN#JJWL#850',
        SK: 'GYMROSTER#5713',
        gymExternalId: '5713',
        gymName: 'Pablo Silva BJJ',
        athletes: [
          {
            name: 'John Doe',
            belt: 'Blue',
            ageDiv: 'Adult',
            weight: 'Light',
            gender: 'Male',
          },
        ],
        athleteCount: 1,
        fetchedAt: '2026-01-04T12:00:00.000Z',
      };
      jest.spyOn(gymQueries, 'getGymRoster').mockResolvedValue(mockRoster);

      const event = createGymRosterEvent('JJWL', '5713', '850');
      const result = await handler(event, context);

      expect(result.statusCode).toBe(200);
      const body = parseResponseBody<{
        gymExternalId: string;
        gymName: string;
        athletes: unknown[];
        athleteCount: number;
        fetchedAt: string;
      }>(result);
      expect(body.gymExternalId).toBe('5713');
      expect(body.gymName).toBe('Pablo Silva BJJ');
      expect(body.athleteCount).toBe(1);
      expect(body.fetchedAt).toBe('2026-01-04T12:00:00.000Z');
    });

    it('fetches roster if not cached', async () => {
      jest
        .spyOn(gymQueries, 'getGymRoster')
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          PK: 'TOURN#JJWL#850',
          SK: 'GYMROSTER#5713',
          gymExternalId: '5713',
          gymName: 'Test Gym',
          athletes: [],
          athleteCount: 0,
          fetchedAt: '2026-01-04T12:00:00.000Z',
        });

      jest.spyOn(gymSyncService, 'syncGymRoster').mockResolvedValue({
        success: true,
        athleteCount: 0,
      });

      const event = createGymRosterEvent('JJWL', '5713', '850');
      const result = await handler(event, context);

      expect(result.statusCode).toBe(200);
      expect(gymSyncService.syncGymRoster).toHaveBeenCalledWith('JJWL', '850', '5713');
    });

    it('returns empty roster when fetch returns nothing', async () => {
      jest
        .spyOn(gymQueries, 'getGymRoster')
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      jest.spyOn(gymSyncService, 'syncGymRoster').mockResolvedValue({
        success: true,
        athleteCount: 0,
      });

      const event = createGymRosterEvent('JJWL', '5713', '850');
      const result = await handler(event, context);

      expect(result.statusCode).toBe(200);
      const body = parseResponseBody<{ athleteCount: number; athletes: unknown[] }>(result);
      expect(body.athleteCount).toBe(0);
      expect(body.athletes).toEqual([]);
    });

    it('returns 500 when roster fetch fails', async () => {
      jest.spyOn(gymQueries, 'getGymRoster').mockResolvedValue(null);
      jest.spyOn(gymSyncService, 'syncGymRoster').mockResolvedValue({
        success: false,
        athleteCount: 0,
        error: 'Network error',
      });

      const event = createGymRosterEvent('JJWL', '5713', '850');
      const result = await handler(event, context);

      expect(result.statusCode).toBe(500);
    });

    it('returns 400 for invalid org', async () => {
      const event = createGymRosterEvent('INVALID', '5713', '850');
      const result = await handler(event, context);

      expect(result.statusCode).toBe(400);
    });
  });

  describe('Response headers', () => {
    it('includes Content-Type header', async () => {
      jest.spyOn(gymQueries, 'searchGyms').mockResolvedValue([]);

      const event = createGymsSearchEvent({ org: 'JJWL' });
      const result = await handler(event, context);

      expect(result.headers!['Content-Type']).toBe('application/json');
    });

    it('includes CORS headers', async () => {
      jest.spyOn(gymQueries, 'searchGyms').mockResolvedValue([]);

      const event = createGymsSearchEvent({ org: 'JJWL' });
      const result = await handler(event, context);

      expect(result.headers!['Access-Control-Allow-Origin']).toBe('*');
    });
  });
});
