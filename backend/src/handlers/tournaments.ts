import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { withErrorHandler, jsonResponse } from './middleware/errorHandler.js';
import { listTournaments, getTournament } from '../services/tournamentService.js';

type AsyncHandler = (
  event: APIGatewayProxyEvent,
  context: Context
) => Promise<APIGatewayProxyResult>;

const tournamentsHandler: AsyncHandler = async (event) => {
  const id = event.pathParameters?.id;

  // GET /tournaments/:id
  if (id) {
    const tournament = await getTournament(id);
    return jsonResponse(200, tournament);
  }

  // GET /tournaments
  const params = event.queryStringParameters || {};
  const cursor = params.cursor;
  delete params.cursor;

  const result = await listTournaments(params, cursor);
  return jsonResponse(200, result);
};

export const handler = withErrorHandler(tournamentsHandler);
