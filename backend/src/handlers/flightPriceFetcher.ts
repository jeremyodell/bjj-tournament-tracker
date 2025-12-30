import type { SQSEvent } from 'aws-lambda';
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';
import { listKnownAirports, updateAirportLastFetched } from '../db/airportQueries.js';
import { getConnectionsForUser } from '../db/wsConnectionQueries.js';
import { queryTournaments } from '../db/queries.js';
import { fetchFlightPriceForTournament } from '../services/flightPriceService.js';
import { findNearestAirport, getAirportByCode } from '../data/airports.js';

const wsEndpoint = process.env.WEBSOCKET_ENDPOINT;

/**
 * Send a message to all WebSocket connections for a user
 */
async function notifyUser(userId: string, message: object): Promise<void> {
  if (!wsEndpoint) return;

  const client = new ApiGatewayManagementApiClient({
    endpoint: wsEndpoint,
  });

  const connections = await getConnectionsForUser(userId);

  for (const conn of connections) {
    try {
      await client.send(
        new PostToConnectionCommand({
          ConnectionId: conn.connectionId,
          Data: Buffer.from(JSON.stringify(message)),
        })
      );
    } catch (error: unknown) {
      const statusCode = (error as { statusCode?: number }).statusCode;
      if (statusCode === 410) {
        // Connection is gone (stale), skip cleanup - TTL will handle it
        console.log(`Stale connection: ${conn.connectionId}`);
      } else {
        console.error(`Error notifying connection ${conn.connectionId}:`, error);
      }
    }
  }
}

/**
 * Fetch flight prices from an airport to all future tournaments
 */
async function fetchPricesForAirport(
  airport: string,
  userId?: string
): Promise<void> {
  const airportData = getAirportByCode(airport);
  if (!airportData) {
    console.error(`Unknown airport: ${airport}`);
    return;
  }

  // Get all tournaments (paginate through all results)
  let allTournaments: Awaited<ReturnType<typeof queryTournaments>>['items'] = [];
  let lastKey: Record<string, unknown> | undefined;

  do {
    const result = await queryTournaments({}, 250, lastKey);
    allTournaments = allTournaments.concat(result.items);
    lastKey = result.lastKey;
  } while (lastKey);

  // Filter to future tournaments only
  const now = new Date();
  const futureTournaments = allTournaments.filter(
    (t) => new Date(t.startDate) > now
  );

  console.log(`Fetching prices for ${airport} -> ${futureTournaments.length} future tournaments`);

  for (const tournament of futureTournaments) {
    // Skip tournaments without coordinates
    if (tournament.lat == null || tournament.lng == null) continue;

    // Find the nearest airport to the tournament
    const destAirport = findNearestAirport(tournament.lat, tournament.lng);
    if (!destAirport) continue;

    try {
      await fetchFlightPriceForTournament(
        airport,
        { lat: airportData.lat, lng: airportData.lng, city: airportData.city },
        destAirport.iataCode,
        tournament,
        6 // Default maxDriveHours - will be personalized in frontend
      );
    } catch (error) {
      console.error(`Error fetching ${airport} -> ${tournament.city}:`, error);
    }
  }

  // Update last fetched timestamp
  await updateAirportLastFetched(airport);

  // Notify user if this was triggered by them adding a new airport
  if (userId) {
    await notifyUser(userId, {
      type: 'prices_ready',
      airport,
    });
  }
}

/**
 * Daily cron job: fetch prices for all known airports
 */
async function runDailyFetch(): Promise<void> {
  const airports = await listKnownAirports();
  console.log(`Daily fetch for ${airports.length} airports`);

  for (const airport of airports) {
    try {
      await fetchPricesForAirport(airport.iataCode);
    } catch (error) {
      console.error(`Error in daily fetch for ${airport.iataCode}:`, error);
    }
  }
}

/**
 * SQS event handler for flight price fetching
 *
 * Handles two event types:
 * 1. airport.added - New airport added by user, fetch prices immediately
 * 2. Scheduled Event - Daily cron, refresh all airports
 */
export async function handler(event: SQSEvent): Promise<void> {
  for (const record of event.Records) {
    try {
      const body = JSON.parse(record.body);

      if (body['detail-type'] === 'airport.added') {
        // New airport added by user - fetch prices
        const { airport, userId } = body.detail;
        console.log(`Processing airport.added for ${airport}, user ${userId}`);
        await fetchPricesForAirport(airport, userId);
      } else if (body['detail-type'] === 'Scheduled Event') {
        // Daily cron job
        console.log('Processing scheduled daily fetch');
        await runDailyFetch();
      } else {
        console.log('Unknown event type:', body['detail-type']);
      }
    } catch (error) {
      console.error('Error processing SQS record:', error);
      throw error; // Re-throw to trigger DLQ
    }
  }
}
