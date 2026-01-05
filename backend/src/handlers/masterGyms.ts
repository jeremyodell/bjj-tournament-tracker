import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { withErrorHandler, jsonResponse } from './middleware/errorHandler.js';
import { getMasterGym, searchMasterGyms } from '../db/masterGymQueries.js';
import { ValidationError } from '../shared/errors.js';

const masterGymsHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const method = event.httpMethod;
  const gymId = event.pathParameters?.id;

  // GET /gyms/{id} - get single master gym
  if (method === 'GET' && gymId) {
    const gym = await getMasterGym(gymId);

    if (!gym) {
      return jsonResponse(404, { error: 'Gym not found' });
    }

    return jsonResponse(200, {
      id: gym.id,
      canonicalName: gym.canonicalName,
      city: gym.city,
      country: gym.country,
      address: gym.address,
      website: gym.website,
    });
  }

  // GET /gyms/search?q=query - search master gyms
  if (method === 'GET' && event.path.includes('/search')) {
    const query = event.queryStringParameters?.q;

    if (!query || query.length < 2) {
      throw new ValidationError('Query parameter "q" must be at least 2 characters');
    }

    const gyms = await searchMasterGyms(query, 20);

    return jsonResponse(200, {
      gyms: gyms.map((gym) => ({
        id: gym.id,
        canonicalName: gym.canonicalName,
        city: gym.city,
        country: gym.country,
      })),
    });
  }

  return jsonResponse(405, { error: 'Method not allowed' });
};

export const handler = withErrorHandler(masterGymsHandler);
