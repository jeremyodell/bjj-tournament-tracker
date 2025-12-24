import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import {
  mockContext,
  mockTournamentResponse,
  parseResponseBody,
  createTournamentsListEvent,
  createTournamentDetailEvent,
} from '../utils/testHelpers.js';
import { NotFoundError, ValidationError } from '../../shared/errors.js';

// Mock the service before importing handler
jest.mock('../../services/tournamentService.js');

import { handler } from '../../handlers/tournaments.js';
import * as tournamentService from '../../services/tournamentService.js';

const context = mockContext();

describe('tournaments handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /tournaments', () => {
    it('returns list of tournaments', async () => {
      const mockTournament = mockTournamentResponse();
      jest.spyOn(tournamentService, 'listTournaments').mockResolvedValue({
        tournaments: [mockTournament],
        nextCursor: undefined,
      });

      const event = createTournamentsListEvent();
      const result = await handler(event, context);

      expect(result).toBeDefined();
      expect(result!.statusCode).toBe(200);

      const body = parseResponseBody<{ tournaments: unknown[]; nextCursor?: string }>(result!);
      expect(body.tournaments).toHaveLength(1);
      expect(body.tournaments[0]).toEqual(mockTournament);
    });

    it('passes filter parameters to service', async () => {
      const listSpy = jest.spyOn(tournamentService, 'listTournaments').mockResolvedValue({
        tournaments: [],
        nextCursor: undefined,
      });

      const event = createTournamentsListEvent({
        org: 'IBJJF',
        gi: 'true',
        city: 'Las Vegas',
      });
      await handler(event, context);

      expect(listSpy).toHaveBeenCalledWith(
        { org: 'IBJJF', gi: 'true', city: 'Las Vegas' },
        undefined
      );
    });

    it('passes cursor parameter for pagination', async () => {
      const listSpy = jest.spyOn(tournamentService, 'listTournaments').mockResolvedValue({
        tournaments: [],
        nextCursor: undefined,
      });

      const cursor = 'eyJQSyI6IlRPVVJOI0lCSiJ9';
      const event = createTournamentsListEvent({ cursor });
      await handler(event, context);

      expect(listSpy).toHaveBeenCalledWith({}, cursor);
    });

    it('returns nextCursor when more results available', async () => {
      const mockTournament = mockTournamentResponse();
      jest.spyOn(tournamentService, 'listTournaments').mockResolvedValue({
        tournaments: [mockTournament],
        nextCursor: 'eyJQSyI6IlRPVVJOI0lCSiJ9',
      });

      const event = createTournamentsListEvent();
      const result = await handler(event, context);

      const body = parseResponseBody<{ tournaments: unknown[]; nextCursor?: string }>(result!);
      expect(body.nextCursor).toBe('eyJQSyI6IlRPVVJOI0lCSiJ9');
    });

    it('returns empty list when no tournaments match', async () => {
      jest.spyOn(tournamentService, 'listTournaments').mockResolvedValue({
        tournaments: [],
        nextCursor: undefined,
      });

      const event = createTournamentsListEvent({ org: 'JJWL' });
      const result = await handler(event, context);

      expect(result!.statusCode).toBe(200);
      const body = parseResponseBody<{ tournaments: unknown[] }>(result!);
      expect(body.tournaments).toHaveLength(0);
    });
  });

  describe('GET /tournaments/:id', () => {
    it('returns single tournament by id', async () => {
      const mockTournament = mockTournamentResponse({ id: 'TOURN#IBJJF#456' });
      jest.spyOn(tournamentService, 'getTournament').mockResolvedValue(mockTournament);

      const event = createTournamentDetailEvent('TOURN#IBJJF#456');
      const result = await handler(event, context);

      expect(result!.statusCode).toBe(200);
      const body = parseResponseBody<typeof mockTournament>(result!);
      expect(body.id).toBe('TOURN#IBJJF#456');
    });

    it('returns 404 when tournament not found', async () => {
      jest.spyOn(tournamentService, 'getTournament').mockRejectedValue(
        new NotFoundError('Tournament')
      );

      const event = createTournamentDetailEvent('TOURN#IBJJF#999');
      const result = await handler(event, context);

      expect(result!.statusCode).toBe(404);
      const body = parseResponseBody<{ error: string; message: string }>(result!);
      expect(body.error).toBe('NOT_FOUND');
      expect(body.message).toBe('Tournament not found');
    });
  });

  describe('Error handling', () => {
    it('returns 400 for validation errors', async () => {
      jest.spyOn(tournamentService, 'listTournaments').mockRejectedValue(
        new ValidationError('Invalid org parameter')
      );

      const event = createTournamentsListEvent({ org: 'INVALID' });
      const result = await handler(event, context);

      expect(result!.statusCode).toBe(400);
      const body = parseResponseBody<{ error: string; message: string }>(result!);
      expect(body.error).toBe('VALIDATION_ERROR');
    });

    it('returns 500 for unexpected errors', async () => {
      jest.spyOn(tournamentService, 'listTournaments').mockRejectedValue(
        new Error('Database connection failed')
      );

      const event = createTournamentsListEvent();
      const result = await handler(event, context);

      expect(result!.statusCode).toBe(500);
      const body = parseResponseBody<{ error: string; message: string }>(result!);
      expect(body.error).toBe('INTERNAL_ERROR');
      expect(body.message).toBe('Something went wrong');
    });
  });

  describe('Response headers', () => {
    it('includes Content-Type header', async () => {
      jest.spyOn(tournamentService, 'listTournaments').mockResolvedValue({
        tournaments: [],
        nextCursor: undefined,
      });

      const event = createTournamentsListEvent();
      const result = await handler(event, context);

      expect(result!.headers!['Content-Type']).toBe('application/json');
    });

    it('includes CORS header', async () => {
      jest.spyOn(tournamentService, 'listTournaments').mockResolvedValue({
        tournaments: [],
        nextCursor: undefined,
      });

      const event = createTournamentsListEvent();
      const result = await handler(event, context);

      expect(result!.headers!['Access-Control-Allow-Origin']).toBe('*');
    });
  });
});
