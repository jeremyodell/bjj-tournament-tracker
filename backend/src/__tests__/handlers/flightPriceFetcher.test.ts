import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { SQSEvent } from 'aws-lambda';
import { handler } from '../../handlers/flightPriceFetcher.js';
import type { TournamentItem } from '../../db/types.js';

// Mock all dependencies
jest.mock('../../db/airportQueries.js', () => ({
  listKnownAirports: jest.fn(),
  updateAirportLastFetched: jest.fn(),
}));

jest.mock('../../db/wsConnectionQueries.js', () => ({
  getConnectionsForUser: jest.fn(),
}));

jest.mock('../../db/queries.js', () => ({
  queryTournaments: jest.fn(),
}));

jest.mock('../../services/flightPriceService.js', () => ({
  fetchFlightPriceForTournament: jest.fn(),
}));

jest.mock('@aws-sdk/client-apigatewaymanagementapi', () => ({
  ApiGatewayManagementApiClient: jest.fn(() => ({
    send: jest.fn(),
  })),
  PostToConnectionCommand: jest.fn(),
}));

// Import mocked modules
import { listKnownAirports, updateAirportLastFetched } from '../../db/airportQueries.js';
import { getConnectionsForUser } from '../../db/wsConnectionQueries.js';
import { queryTournaments } from '../../db/queries.js';
import { fetchFlightPriceForTournament } from '../../services/flightPriceService.js';

const mockListKnownAirports = listKnownAirports as jest.MockedFunction<typeof listKnownAirports>;
const mockUpdateAirportLastFetched = updateAirportLastFetched as jest.MockedFunction<typeof updateAirportLastFetched>;
const mockGetConnectionsForUser = getConnectionsForUser as jest.MockedFunction<typeof getConnectionsForUser>;
const mockQueryTournaments = queryTournaments as jest.MockedFunction<typeof queryTournaments>;
const mockFetchFlightPriceForTournament = fetchFlightPriceForTournament as jest.MockedFunction<typeof fetchFlightPriceForTournament>;

// Helper to create mock tournament data
function createMockTournament(overrides: Partial<TournamentItem> = {}): TournamentItem {
  // Use a date in the future (2026)
  return {
    PK: 'TOURN#IBJJF#123',
    SK: 'META',
    GSI1PK: 'TOURNAMENTS',
    GSI1SK: '2026-06-15#IBJJF#123',
    org: 'IBJJF',
    externalId: '123',
    name: 'Miami Open',
    city: 'Miami',
    venue: 'Convention Center',
    country: 'US',
    startDate: '2026-06-15',
    endDate: '2026-06-16',
    gi: true,
    nogi: true,
    kids: true,
    registrationUrl: null,
    bannerUrl: null,
    lat: 25.7617,
    lng: -80.1918,
    venueId: null,
    geocodeConfidence: 'high',
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

function createSQSEvent(body: object): SQSEvent {
  return {
    Records: [
      {
        body: JSON.stringify(body),
        messageId: 'test-msg-1',
        receiptHandle: 'handle',
        attributes: {
          ApproximateReceiveCount: '1',
          SentTimestamp: '1234567890',
          SenderId: 'sender',
          ApproximateFirstReceiveTimestamp: '1234567890',
        },
        messageAttributes: {},
        md5OfBody: 'md5',
        eventSource: 'aws:sqs',
        eventSourceARN: 'arn:aws:sqs:us-east-1:123456789:queue',
        awsRegion: 'us-east-1',
      },
    ],
  };
}

describe('flightPriceFetcher handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default mock implementations
    mockListKnownAirports.mockResolvedValue([]);
    mockUpdateAirportLastFetched.mockResolvedValue(undefined);
    mockGetConnectionsForUser.mockResolvedValue([]);
    mockQueryTournaments.mockResolvedValue({ items: [], lastKey: undefined });
    mockFetchFlightPriceForTournament.mockResolvedValue(undefined);
  });

  describe('airport-added event', () => {
    it('should process airport-added event', async () => {
      const event = createSQSEvent({
        type: 'airport-added',
        airport: 'DFW',
        userId: 'user-123',
      });

      const futureTournament = createMockTournament();

      mockQueryTournaments.mockResolvedValue({
        items: [futureTournament],
        lastKey: undefined,
      });

      await expect(handler(event)).resolves.not.toThrow();

      expect(mockQueryTournaments).toHaveBeenCalled();
      expect(mockFetchFlightPriceForTournament).toHaveBeenCalled();
    });

    it('should filter out past tournaments', async () => {
      const event = createSQSEvent({
        type: 'airport-added',
        airport: 'DFW',
        userId: 'user-123',
      });

      const pastTournament = createMockTournament({
        startDate: '2024-01-15',
        endDate: '2024-01-16',
      });

      mockQueryTournaments.mockResolvedValue({
        items: [pastTournament],
        lastKey: undefined,
      });

      await handler(event);

      expect(mockFetchFlightPriceForTournament).not.toHaveBeenCalled();
    });

    it('should skip tournaments without lat/lng', async () => {
      const event = createSQSEvent({
        type: 'airport-added',
        airport: 'DFW',
        userId: 'user-123',
      });

      const tournamentWithoutCoords = createMockTournament({
        lat: null,
        lng: null,
      });

      mockQueryTournaments.mockResolvedValue({
        items: [tournamentWithoutCoords],
        lastKey: undefined,
      });

      await handler(event);

      expect(mockFetchFlightPriceForTournament).not.toHaveBeenCalled();
    });

    it('should handle unknown airport gracefully', async () => {
      const event = createSQSEvent({
        type: 'airport-added',
        airport: 'XXX', // Unknown airport code
        userId: 'user-123',
      });

      await expect(handler(event)).resolves.not.toThrow();
      expect(mockFetchFlightPriceForTournament).not.toHaveBeenCalled();
    });
  });

  describe('daily-refresh event (daily cron)', () => {
    it('should process scheduled daily fetch', async () => {
      const event = createSQSEvent({
        type: 'daily-refresh',
      });

      // Mock known airports
      mockListKnownAirports.mockResolvedValue([
        {
          PK: 'AIRPORT#DFW',
          SK: 'META',
          GSI1PK: 'AIRPORTS',
          GSI1SK: 'DFW',
          iataCode: 'DFW',
          userCount: 5,
          lastFetchedAt: '2025-01-01T00:00:00Z',
          createdAt: '2024-12-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
        },
      ]);

      // Mock tournaments
      mockQueryTournaments.mockResolvedValue({
        items: [createMockTournament()],
        lastKey: undefined,
      });

      await expect(handler(event)).resolves.not.toThrow();

      expect(mockListKnownAirports).toHaveBeenCalled();
      expect(mockQueryTournaments).toHaveBeenCalled();
    });

    it('should handle empty airports list', async () => {
      const event = createSQSEvent({
        type: 'daily-refresh',
      });

      mockListKnownAirports.mockResolvedValue([]);

      await expect(handler(event)).resolves.not.toThrow();

      expect(mockListKnownAirports).toHaveBeenCalled();
      expect(mockFetchFlightPriceForTournament).not.toHaveBeenCalled();
    });
  });

  describe('unknown event type', () => {
    it('should handle unknown event type gracefully', async () => {
      const event = createSQSEvent({
        type: 'unknown-event',
      });

      await expect(handler(event)).resolves.not.toThrow();
    });
  });

  describe('multiple records', () => {
    it('should process multiple SQS records', async () => {
      const event: SQSEvent = {
        Records: [
          {
            body: JSON.stringify({
              type: 'airport-added',
              airport: 'DFW',
              userId: 'user-1',
            }),
            messageId: 'msg-1',
            receiptHandle: 'handle-1',
            attributes: {
              ApproximateReceiveCount: '1',
              SentTimestamp: '1234567890',
              SenderId: 'sender',
              ApproximateFirstReceiveTimestamp: '1234567890',
            },
            messageAttributes: {},
            md5OfBody: 'md5',
            eventSource: 'aws:sqs',
            eventSourceARN: 'arn',
            awsRegion: 'us-east-1',
          },
          {
            body: JSON.stringify({
              type: 'airport-added',
              airport: 'LAX',
              userId: 'user-2',
            }),
            messageId: 'msg-2',
            receiptHandle: 'handle-2',
            attributes: {
              ApproximateReceiveCount: '1',
              SentTimestamp: '1234567890',
              SenderId: 'sender',
              ApproximateFirstReceiveTimestamp: '1234567890',
            },
            messageAttributes: {},
            md5OfBody: 'md5',
            eventSource: 'aws:sqs',
            eventSourceARN: 'arn',
            awsRegion: 'us-east-1',
          },
        ],
      };

      mockQueryTournaments.mockResolvedValue({
        items: [createMockTournament()],
        lastKey: undefined,
      });

      await expect(handler(event)).resolves.not.toThrow();

      // Should call queryTournaments twice (once per airport)
      expect(mockQueryTournaments).toHaveBeenCalledTimes(2);
    });
  });
});
