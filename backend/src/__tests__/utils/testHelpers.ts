import type { APIGatewayProxyEvent, Context } from 'aws-lambda';
import type { TournamentResponse } from '../../services/tournamentService.js';
import type { TournamentItem } from '../../db/types.js';

/**
 * Creates a mock API Gateway proxy event with sensible defaults.
 * Use the overrides parameter to customize specific properties.
 */
export function mockAPIGatewayEvent(
  overrides: Partial<APIGatewayProxyEvent> = {}
): APIGatewayProxyEvent {
  return {
    httpMethod: 'GET',
    path: '/',
    pathParameters: null,
    queryStringParameters: null,
    body: null,
    headers: {
      'Content-Type': 'application/json',
    },
    multiValueHeaders: {},
    isBase64Encoded: false,
    requestContext: {
      accountId: '123456789012',
      apiId: 'test-api-id',
      authorizer: null,
      connectedAt: undefined,
      connectionId: undefined,
      domainName: 'localhost',
      domainPrefix: 'test',
      eventType: undefined,
      extendedRequestId: 'test-extended-request-id',
      httpMethod: overrides.httpMethod || 'GET',
      identity: {
        accessKey: null,
        accountId: null,
        apiKey: null,
        apiKeyId: null,
        caller: null,
        clientCert: null,
        cognitoAuthenticationProvider: null,
        cognitoAuthenticationType: null,
        cognitoIdentityId: null,
        cognitoIdentityPoolId: null,
        principalOrgId: null,
        sourceIp: '127.0.0.1',
        user: null,
        userAgent: 'test-agent',
        userArn: null,
      },
      messageDirection: undefined,
      messageId: undefined,
      path: overrides.path || '/',
      protocol: 'HTTP/1.1',
      requestId: 'test-request-id',
      requestTime: new Date().toISOString(),
      requestTimeEpoch: Date.now(),
      resourceId: 'test-resource-id',
      resourcePath: overrides.path || '/',
      routeKey: undefined,
      stage: 'test',
    },
    resource: overrides.path || '/',
    stageVariables: null,
    multiValueQueryStringParameters: null,
    ...overrides,
  };
}

/**
 * Creates a mock Lambda context with sensible defaults.
 */
export function mockContext(overrides: Partial<Context> = {}): Context {
  const defaultContext: Context = {
    callbackWaitsForEmptyEventLoop: true,
    functionName: 'test-function',
    functionVersion: '$LATEST',
    invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:test-function',
    memoryLimitInMB: '128',
    awsRequestId: 'test-request-id',
    logGroupName: '/aws/lambda/test-function',
    logStreamName: '2025/01/01/[$LATEST]abcdef123456',
    getRemainingTimeInMillis: () => 30000,
    done: () => {},
    fail: () => {},
    succeed: () => {},
  };

  return { ...defaultContext, ...overrides };
}

/**
 * Creates a mock TournamentResponse for testing.
 */
export function mockTournamentResponse(
  overrides: Partial<TournamentResponse> = {}
): TournamentResponse {
  return {
    id: 'TOURN#IBJJF#123',
    org: 'IBJJF',
    externalId: '123',
    name: 'Pan American Championship',
    city: 'Irvine',
    venue: 'Bren Events Center',
    country: 'USA',
    startDate: '2025-03-15',
    endDate: '2025-03-17',
    gi: true,
    nogi: true,
    kids: false,
    registrationUrl: 'https://ibjjf.com/events/pan-2025',
    bannerUrl: null,
    lat: null,
    lng: null,
    ...overrides,
  };
}

/**
 * Creates a mock TournamentItem (DynamoDB record) for testing.
 */
export function mockTournamentItem(
  overrides: Partial<TournamentItem> = {}
): TournamentItem {
  const now = new Date().toISOString();
  return {
    PK: 'TOURN#IBJJF#123',
    SK: 'META',
    GSI1PK: 'TOURNAMENTS',
    GSI1SK: '2025-03-15#IBJJF#123',
    org: 'IBJJF',
    externalId: '123',
    name: 'Pan American Championship',
    city: 'Irvine',
    venue: 'Bren Events Center',
    country: 'USA',
    startDate: '2025-03-15',
    endDate: '2025-03-17',
    gi: true,
    nogi: true,
    kids: false,
    registrationUrl: 'https://ibjjf.com/events/pan-2025',
    bannerUrl: null,
    lat: null,
    lng: null,
    venueId: null,
    geocodeConfidence: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/**
 * Helper to parse JSON response body from API Gateway result.
 */
export function parseResponseBody<T>(result: { body: string }): T {
  return JSON.parse(result.body) as T;
}

/**
 * Helper to create a GET request event for tournaments list.
 */
export function createTournamentsListEvent(
  queryParams?: Record<string, string>
): APIGatewayProxyEvent {
  return mockAPIGatewayEvent({
    httpMethod: 'GET',
    path: '/tournaments',
    queryStringParameters: queryParams || null,
  });
}

/**
 * Helper to create a GET request event for a single tournament.
 */
export function createTournamentDetailEvent(id: string): APIGatewayProxyEvent {
  return mockAPIGatewayEvent({
    httpMethod: 'GET',
    path: `/tournaments/${id}`,
    pathParameters: { id },
  });
}

/**
 * Helper to create a GET request event for gyms search.
 */
export function createGymsSearchEvent(
  queryParams?: Record<string, string>
): APIGatewayProxyEvent {
  return mockAPIGatewayEvent({
    httpMethod: 'GET',
    path: '/gyms',
    queryStringParameters: queryParams || null,
  });
}

/**
 * Helper to create a GET request event for a single gym.
 */
export function createGymDetailEvent(
  org: string,
  externalId: string
): APIGatewayProxyEvent {
  return mockAPIGatewayEvent({
    httpMethod: 'GET',
    path: `/gyms/${org}/${externalId}`,
    pathParameters: { org, externalId },
  });
}

/**
 * Helper to create a GET request event for gym roster.
 */
export function createGymRosterEvent(
  org: string,
  externalId: string,
  tournamentId: string
): APIGatewayProxyEvent {
  return mockAPIGatewayEvent({
    httpMethod: 'GET',
    path: `/gyms/${org}/${externalId}/roster/${tournamentId}`,
    pathParameters: { org, externalId, tournamentId },
  });
}
