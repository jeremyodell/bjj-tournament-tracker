import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { withErrorHandler, jsonResponse } from './middleware/errorHandler.js';
import { extractAuthContext } from './middleware/authMiddleware.js';
import { saveKnownAirport, getKnownAirport } from '../db/airportQueries.js';
import { publishAirportAddedEvent } from '../services/eventBridgeService.js';
import { ValidationError } from '../shared/errors.js';

// Validate IATA airport code (3 letters)
function isValidAirportCode(code: string): boolean {
  return /^[A-Z]{3}$/.test(code);
}

const airportsHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const auth = extractAuthContext(event);
  const method = event.httpMethod;

  // POST /airports - register user's home airport
  if (method === 'POST') {
    const body = JSON.parse(event.body || '{}');
    const airport = body.airport?.trim().toUpperCase();

    if (!airport) {
      throw new ValidationError('airport is required in request body');
    }

    if (!isValidAirportCode(airport)) {
      throw new ValidationError('airport must be a valid 3-letter IATA code');
    }

    // Check if this is a new airport
    const existingAirport = await getKnownAirport(airport);
    const isNewAirport = !existingAirport;

    // Save/update the airport (increments user count if exists)
    await saveKnownAirport(airport);

    // Trigger EventBridge event only for new airports to start fetching prices
    if (isNewAirport) {
      await publishAirportAddedEvent(airport, auth.userId);
    }

    return jsonResponse(202, {
      airport,
      message: 'Airport registered successfully. Flight prices will be fetched shortly.',
      isNew: isNewAirport,
    });
  }

  return jsonResponse(405, { error: 'Method not allowed' });
};

export const handler = withErrorHandler(airportsHandler);
