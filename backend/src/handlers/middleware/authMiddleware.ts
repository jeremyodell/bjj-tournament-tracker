import type { APIGatewayProxyEvent } from 'aws-lambda';
import { UnauthorizedError } from '../../shared/errors.js';

export interface AuthContext {
  userId: string;
  email: string;
}

export function extractAuthContext(event: APIGatewayProxyEvent): AuthContext {
  // Cognito authorizer adds claims to requestContext
  const claims = event.requestContext.authorizer?.claims;

  if (!claims || !claims.sub) {
    throw new UnauthorizedError();
  }

  return {
    userId: claims.sub as string,
    email: claims.email as string,
  };
}
