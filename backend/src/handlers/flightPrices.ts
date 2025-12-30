import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { withErrorHandler, jsonResponse } from './middleware/errorHandler.js';
import { extractAuthContext } from './middleware/authMiddleware.js';
import { getFlightPricesForAirport } from '../db/flightPriceQueries.js';
import { ValidationError } from '../shared/errors.js';
import { isValidAirportCode } from '../shared/validation.js';

const flightPricesHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  // Verify authentication (user ID not needed for flight price queries)
  extractAuthContext(event);
  const method = event.httpMethod;

  // GET /flight-prices?airport=DFW - get cached flight prices for an airport
  if (method === 'GET') {
    const airport = event.queryStringParameters?.airport?.trim().toUpperCase();

    if (!airport) {
      throw new ValidationError('airport query parameter is required');
    }

    if (!isValidAirportCode(airport)) {
      throw new ValidationError('airport must be a valid 3-letter IATA code');
    }

    const prices = await getFlightPricesForAirport(airport);

    return jsonResponse(200, { prices });
  }

  return jsonResponse(405, { error: 'Method not allowed' });
};

export const handler = withErrorHandler(flightPricesHandler);
