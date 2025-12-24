import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { APIGatewayProxyEvent, Context } from 'aws-lambda';

// Mock the service before importing handler
jest.mock('../../services/tournamentService.js');

import { handler } from '../../handlers/tournaments.js';
import * as tournamentService from '../../services/tournamentService.js';

const mockContext: Context = {} as Context;

function createEvent(overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent {
  return {
    httpMethod: 'GET',
    path: '/tournaments',
    pathParameters: null,
    queryStringParameters: null,
    body: null,
    headers: {},
    multiValueHeaders: {},
    isBase64Encoded: false,
    requestContext: {} as any,
    resource: '',
    stageVariables: null,
    multiValueQueryStringParameters: null,
    ...overrides,
  };
}

describe('tournaments handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mocks
    jest.spyOn(tournamentService, 'listTournaments').mockResolvedValue({
      tournaments: [
        {
          id: 'TOURN#IBJJF#123',
          name: 'Pan American',
          org: 'IBJJF',
          externalId: '123',
          city: 'Irvine',
          venue: null,
          country: 'USA',
          startDate: '2025-03-15',
          endDate: '2025-03-17',
          gi: true,
          nogi: true,
          kids: false,
          registrationUrl: null,
          bannerUrl: null,
        },
      ],
      nextCursor: undefined,
    });

    jest.spyOn(tournamentService, 'getTournament').mockResolvedValue({
      id: 'TOURN#IBJJF#123',
      name: 'Pan American',
      org: 'IBJJF',
      externalId: '123',
      city: 'Irvine',
      venue: null,
      country: 'USA',
      startDate: '2025-03-15',
      endDate: '2025-03-17',
      gi: true,
      nogi: true,
      kids: false,
      registrationUrl: null,
      bannerUrl: null,
    });
  });

  it('GET /tournaments returns list', async () => {
    const event = createEvent({
      httpMethod: 'GET',
      path: '/tournaments',
    });

    const result = await handler(event, mockContext);

    expect(result).toBeDefined();
    expect(result!.statusCode).toBe(200);
    const body = JSON.parse(result!.body);
    expect(body.tournaments).toHaveLength(1);
  });

  it('GET /tournaments with filters passes params', async () => {
    const event = createEvent({
      queryStringParameters: { org: 'IBJJF', gi: 'true' },
    });

    const result = await handler(event, mockContext);

    expect(result!.statusCode).toBe(200);
  });

  it('GET /tournaments/:id returns single tournament', async () => {
    const event = createEvent({
      pathParameters: { id: 'TOURN#IBJJF#123' },
    });

    const result = await handler(event, mockContext);

    expect(result!.statusCode).toBe(200);
    const body = JSON.parse(result!.body);
    expect(body.id).toBe('TOURN#IBJJF#123');
  });
});
