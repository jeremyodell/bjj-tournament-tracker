import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { withErrorHandler, jsonResponse } from './middleware/errorHandler.js';
import { extractAuthContext } from './middleware/authMiddleware.js';
import {
  getUserAthletes,
  createAthlete,
  updateAthlete,
  deleteAthlete
} from '../db/athleteQueries.js';
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
    const updated = await updateAthlete(auth.userId, athleteId, body);

    if (!updated) {
      throw new ValidationError('Athlete not found');
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
