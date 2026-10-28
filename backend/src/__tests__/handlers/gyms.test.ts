import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
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
    it('searches across all orgs when org param is missing', async () => {
      const mockGyms = [
        {
          org: 'IBJJF' as const,
          externalId: '200',
          name: 'Alpha Academy',
          PK: 'SRCGYM#IBJJF#200',
          SK: 'META' as const,
          GSI1PK: 'GYMS' as const,
          GSI1SK: 'IBJJF#Alpha Academy',
          masterGymId: null,
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
        },
        {
          org: 'JJWL' as const,
          externalId: '100',
          name: 'Beta BJJ',
          PK: 'SRCGYM#JJWL#100',
          SK: 'META' as const,
          GSI1PK: 'GYMS' as const,
          GSI1SK: 'JJWL#Beta BJJ',
          masterGymId: null,
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
        },
      ];
      jest.spyOn(gymQueries, 'searchGymsAcrossOrgs').mockResolvedValue(mockGyms);

      const event = createGymsSearchEvent({ search: 'Academy' });
      const result = await handler(event, context);

      expect(result.statusCode).toBe(200);
      expect(gymQueries.searchGymsAcrossOrgs).toHaveBeenCalledWith('Academy');
      const body = parseResponseBody<{
        gyms: Array<{ org: string; externalId: string; name: string }>;
      }>(result);
      expect(body.gyms).toHaveLength(2);
      expect(body.gyms[0]).toEqual({
        org: 'IBJJF',
        externalId: '200',
        name: 'Alpha Academy',
      });
      expect(body.gyms[1]).toEqual({
        org: 'JJWL',
        externalId: '100',
        name: 'Beta BJJ',
      });
    });

    it('searches across all orgs with empty search param', async () => {
      jest.spyOn(gymQueries, 'searchGymsAcrossOrgs').mockResolvedValue([]);

      const event = createGymsSearchEvent({});
      const result = await handler(event, context);

      expect(result.statusCode).toBe(200);
      expect(gymQueries.searchGymsAcrossOrgs).toHaveBeenCalledWith('');
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

  describe('GET /gyms/:org/:externalId/roster/:tournamentId (removed in R0)', () => {
    let fetchSpy: jest.SpiedFunction<typeof globalThis.fetch>;

    beforeEach(() => {
      fetchSpy = jest
        .spyOn(globalThis, 'fetch')
        .mockRejectedValue(new Error('network access is not allowed in this test'));
    });

    afterEach(() => {
      fetchSpy.mockRestore();
    });

    it('returns 404 to an anonymous caller', async () => {
      const event = createGymRosterEvent('JJWL', '5713', '850');
      const result = await handler(event, context);

      expect(result.statusCode).toBe(404);
    });

    it('does not return cached roster data', async () => {
      jest.spyOn(gymQueries, 'getGymRoster').mockResolvedValue({
        PK: 'TOURN#JJWL#850',
        SK: 'GYMROSTER#5713',
        gymExternalId: '5713',
        gymName: 'Synthetic Test Gym',
        athletes: [
          { name: 'Test Athlete', belt: 'Grey', ageDiv: 'Youth', weight: 'Light', gender: 'Male' },
        ],
        athleteCount: 1,
        fetchedAt: '2026-01-04T12:00:00.000Z',
      });

      const event = createGymRosterEvent('JJWL', '5713', '850');
      const result = await handler(event, context);

      expect(result.statusCode).toBe(404);
      expect(result.body).not.toContain('Test Athlete');
      expect(gymQueries.getGymRoster).not.toHaveBeenCalled();
    });

    it('makes no JJWL request on a cache miss', async () => {
      jest.spyOn(gymQueries, 'getGymRoster').mockResolvedValue(null);

      const event = createGymRosterEvent('JJWL', '5713', '850');
      const result = await handler(event, context);

      expect(result.statusCode).toBe(404);
      expect(gymSyncService.syncGymRoster).not.toHaveBeenCalled();
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('returns 404 for any org, including invalid ones', async () => {
      for (const org of ['IBJJF', 'INVALID']) {
        const result = await handler(createGymRosterEvent(org, '5713', '850'), context);
        expect(result.statusCode).toBe(404);
      }
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe('Response headers', () => {
    it('includes Content-Type header', async () => {
      jest.spyOn(gymQueries, 'searchGymsAcrossOrgs').mockResolvedValue([]);

      const event = createGymsSearchEvent({});
      const result = await handler(event, context);

      expect(result.headers!['Content-Type']).toBe('application/json');
    });

    it('includes CORS headers', async () => {
      jest.spyOn(gymQueries, 'searchGymsAcrossOrgs').mockResolvedValue([]);

      const event = createGymsSearchEvent({});
      const result = await handler(event, context);

      expect(result.headers!['Access-Control-Allow-Origin']).toBe('*');
    });
  });
});
