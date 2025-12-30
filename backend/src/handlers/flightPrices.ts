import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { withErrorHandler, jsonResponse } from './middleware/errorHandler.js';
import { extractAuthContext } from './middleware/authMiddleware.js';
import { getFlightPricesForAirport } from '../db/flightPriceQueries.js';
import { ValidationError } from '../shared/errors.js';

const flightPricesHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const auth = extractAuthContext(event);
  const method = event.httpMethod;

  // GET /flight-prices?airport=DFW - get cached flight prices for an airport
  if (method === 'GET') {
    const airport = event.queryStringParameters?.airport?.trim().toUpperCase();

    if (!airport) {
      throw new ValidationError('airport query parameter is required');
    }

    const prices = await getFlightPricesForAirport(airport);

    return jsonResponse(200, { prices });
  }

  return jsonResponse(405, { error: 'Method not allowed' });
};

export const handler = withErrorHandler(flightPricesHandler);
