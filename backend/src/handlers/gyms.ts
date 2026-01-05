import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { withErrorHandler, jsonResponse } from './middleware/errorHandler.js';
import { searchGyms, searchGymsAcrossOrgs, getSourceGym, getGymRoster } from '../db/gymQueries.js';
import { syncGymRoster } from '../services/gymSyncService.js';
import { ValidationError, NotFoundError } from '../shared/errors.js';

type AsyncHandler = (
  event: APIGatewayProxyEvent,
  context: Context
) => Promise<APIGatewayProxyResult>;

const gymsHandler: AsyncHandler = async (event) => {
  const method = event.httpMethod;
  const pathOrg = event.pathParameters?.org as 'JJWL' | 'IBJJF' | undefined;
  const externalId = event.pathParameters?.externalId;
  const tournamentId = event.pathParameters?.tournamentId;

  // GET /gyms - search gyms
  if (method === 'GET' && !pathOrg && !externalId) {
    const searchQuery = event.queryStringParameters?.search || '';
    const orgFilter = event.queryStringParameters?.org as 'JJWL' | 'IBJJF' | undefined;

    // If org is provided but invalid, reject
    if (orgFilter && orgFilter !== 'JJWL' && orgFilter !== 'IBJJF') {
      throw new ValidationError('org must be JJWL or IBJJF');
    }

    // Search by org if provided, otherwise search across all orgs
    const gyms = orgFilter
      ? await searchGyms(orgFilter, searchQuery)
      : await searchGymsAcrossOrgs(searchQuery);

    return jsonResponse(200, {
      gyms: gyms.map((g) => ({
        org: g.org,
        externalId: g.externalId,
        name: g.name,
      })),
    });
  }

  // GET /gyms/:org/:externalId - get gym details
  if (method === 'GET' && pathOrg && externalId && !tournamentId) {
    if (pathOrg !== 'JJWL' && pathOrg !== 'IBJJF') {
      throw new ValidationError('org must be JJWL or IBJJF');
    }

    const gym = await getSourceGym(pathOrg, externalId);

    if (!gym) {
      throw new NotFoundError('Gym');
    }

    return jsonResponse(200, {
      org: gym.org,
      externalId: gym.externalId,
      name: gym.name,
    });
  }

  // GET /gyms/:org/:externalId/roster/:tournamentId - get roster
  if (method === 'GET' && pathOrg && externalId && tournamentId) {
    if (pathOrg !== 'JJWL' && pathOrg !== 'IBJJF') {
      throw new ValidationError('org must be JJWL or IBJJF');
    }

    // Check cache first
    let roster = await getGymRoster(pathOrg, tournamentId, externalId);

    // If no cached roster, fetch it
    if (!roster) {
      const result = await syncGymRoster(pathOrg, tournamentId, externalId);
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch roster');
      }
      roster = await getGymRoster(pathOrg, tournamentId, externalId);
    }

    // Return empty roster if still nothing
    if (!roster) {
      return jsonResponse(200, {
        gymExternalId: externalId,
        gymName: null,
        athletes: [],
        athleteCount: 0,
        fetchedAt: null,
      });
    }

    return jsonResponse(200, {
      gymExternalId: roster.gymExternalId,
      gymName: roster.gymName,
      athletes: roster.athletes,
      athleteCount: roster.athleteCount,
      fetchedAt: roster.fetchedAt,
    });
  }

  return jsonResponse(405, { error: 'Method not allowed' });
};

export const handler = withErrorHandler(gymsHandler);
