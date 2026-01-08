import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { withErrorHandler, jsonResponse } from './middleware/errorHandler.js';
import { extractAuthContext } from './middleware/authMiddleware.js';
import { processOnboarding, type OnboardingData } from '../services/onboardingService.js';
import { ValidationError } from '../shared/errors.js';

const onboardingHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const auth = extractAuthContext(event);
  const method = event.httpMethod;

  // POST /onboarding/athletes - create multiple athletes from onboarding flow
  if (method === 'POST') {
    const body: OnboardingData = JSON.parse(event.body || '{}');

    // Validate required fields
    if (!body.role || !['athlete', 'parent'].includes(body.role)) {
      throw new ValidationError('role must be "athlete" or "parent"');
    }

    if (!body.athletes || !Array.isArray(body.athletes)) {
      throw new ValidationError('athletes array is required');
    }

    // Validate each athlete
    for (const athlete of body.athletes) {
      if (!athlete.name) {
        throw new ValidationError('athlete name is required');
      }
      if (!athlete.birthdate) {
        throw new ValidationError('athlete birthdate is required');
      }
      if (!athlete.gender || !['Male', 'Female'].includes(athlete.gender)) {
        throw new ValidationError('athlete gender must be "Male" or "Female"');
      }
      if (!athlete.beltRank) {
        throw new ValidationError('athlete beltRank is required');
      }
      if (!athlete.weight || typeof athlete.weight !== 'number') {
        throw new ValidationError('athlete weight must be a number');
      }
      // Either masterGymId or customGymName must be provided
      if (!athlete.masterGymId && !athlete.customGymName) {
        throw new ValidationError('athlete must have either masterGymId or customGymName');
      }
    }

    const result = await processOnboarding(auth.userId, body);
    return jsonResponse(201, result);
  }

  return jsonResponse(405, { error: 'Method not allowed' });
};

export const handler = withErrorHandler(onboardingHandler);
