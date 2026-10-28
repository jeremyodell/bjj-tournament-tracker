import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { withErrorHandler, jsonResponse } from './middleware/errorHandler.js';
import { searchGyms, searchGymsAcrossOrgs, getSourceGym } from '../db/gymQueries.js';
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

  // GET /gyms/:org/:externalId/roster/:tournamentId - removed (R0).
  // This route exposed other gyms' athlete rosters (minors' names, belts,
  // ages, weights) to anonymous callers and fetched from JJWL on a cache miss.
  // The API Gateway route is gone from template.yaml; this branch makes sure
  // the handler never serves roster data or triggers a provider fetch even if
  // a roster-shaped path reaches it.
  if (tournamentId) {
    return jsonResponse(404, { error: 'Not found' });
  }

  return jsonResponse(405, { error: 'Method not allowed' });
};

export const handler = withErrorHandler(gymsHandler);
