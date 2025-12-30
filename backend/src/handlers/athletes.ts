import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { withErrorHandler, jsonResponse } from './middleware/errorHandler.js';
import { extractAuthContext } from './middleware/authMiddleware.js';
import {
  getUserAthletes,
  createAthlete,
  updateAthlete,
  deleteAthlete,
  getAthlete
} from '../db/athleteQueries.js';
import { saveKnownAirport, getKnownAirport } from '../db/airportQueries.js';
import { publishAirportAddedEvent } from '../services/eventBridgeService.js';
import { ValidationError } from '../shared/errors.js';

const athletesHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const auth = extractAuthContext(event);
  const method = event.httpMethod;
  const athleteId = event.pathParameters?.athleteId;

  // GET /athletes - list all athletes
  if (method === 'GET' && !athleteId) {
    const athletes = await getUserAthletes(auth.userId);
    return jsonResponse(200, { athletes });
  }

  // POST /athletes - create athlete
  if (method === 'POST') {
    const body = JSON.parse(event.body || '{}');

    if (!body.name) {
      throw new ValidationError('name is required');
    }

    const athlete = await createAthlete(auth.userId, body);
    return jsonResponse(201, athlete);
  }

  // PUT /athletes/:athleteId - update athlete
  if (method === 'PUT' && athleteId) {
    const body = JSON.parse(event.body || '{}');

    // Get existing athlete to check for homeAirport change
    const existingAthlete = await getAthlete(auth.userId, athleteId);
    const oldAirport = existingAthlete?.homeAirport;

    const updated = await updateAthlete(auth.userId, athleteId, body);

    if (!updated) {
      throw new ValidationError('Athlete not found');
    }

    // Check if homeAirport was in the update payload and changed
    const newAirport = updated.homeAirport;
    if (body.homeAirport !== undefined && newAirport && newAirport !== oldAirport) {
      // Check if this is a new airport
      const existingAirport = await getKnownAirport(newAirport);
      const isNewAirport = !existingAirport;

      // Save/update the airport (increments user count if exists)
      await saveKnownAirport(newAirport);

      // Trigger EventBridge event only for new airports to start fetching prices
      if (isNewAirport) {
        await publishAirportAddedEvent(newAirport, auth.userId);
      }
    }

    return jsonResponse(200, updated);
  }

  // DELETE /athletes/:athleteId - delete athlete
  if (method === 'DELETE' && athleteId) {
    await deleteAthlete(auth.userId, athleteId);
    return jsonResponse(204, null);
  }

  return jsonResponse(405, { error: 'Method not allowed' });
};

export const handler = withErrorHandler(athletesHandler);
