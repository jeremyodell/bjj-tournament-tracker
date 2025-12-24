/**
 * Local development server that wraps Lambda handlers in Express.
 * Run with: npm run dev
 *
 * This allows testing the same Lambda code locally without AWS.
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import type { APIGatewayProxyEvent, Context, APIGatewayProxyResult } from 'aws-lambda';

// Configure DynamoDB for local - MUST be set before any imports that use AWS SDK
process.env.DYNAMODB_ENDPOINT = process.env.DYNAMODB_ENDPOINT || 'http://127.0.0.1:8000';
process.env.DYNAMODB_TABLE = process.env.DYNAMODB_TABLE || 'bjj-tournament-tracker';
process.env.AWS_REGION = 'local';
process.env.AWS_ACCESS_KEY_ID = 'local';
process.env.AWS_SECRET_ACCESS_KEY = 'local';

// Import handlers dynamically after setting env vars
const { handler: tournamentsHandler } = await import('./handlers/tournaments.js');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Request logging
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

/**
 * Converts Express request to API Gateway event format
 */
function toAPIGatewayEvent(req: Request): APIGatewayProxyEvent {
  return {
    httpMethod: req.method,
    path: req.path,
    pathParameters: req.params || null,
    queryStringParameters: Object.keys(req.query).length > 0
      ? Object.fromEntries(
          Object.entries(req.query).map(([k, v]) => [k, String(v)])
        )
      : null,
    body: req.body ? JSON.stringify(req.body) : null,
    headers: req.headers as Record<string, string>,
    multiValueHeaders: {},
    isBase64Encoded: false,
    requestContext: {
      accountId: 'local',
      apiId: 'local',
      authorizer: null,
      protocol: 'HTTP/1.1',
      httpMethod: req.method,
      identity: {
        sourceIp: req.ip || '127.0.0.1',
        userAgent: req.get('user-agent') || '',
      } as any,
      path: req.path,
      stage: 'local',
      requestId: `local-${Date.now()}`,
      requestTimeEpoch: Date.now(),
      resourceId: 'local',
      resourcePath: req.path,
    } as any,
    resource: req.path,
    stageVariables: null,
    multiValueQueryStringParameters: null,
  };
}

/**
 * Mock Lambda context
 */
const mockContext: Context = {
  callbackWaitsForEmptyEventLoop: true,
  functionName: 'local-dev',
  functionVersion: '1',
  invokedFunctionArn: 'arn:aws:lambda:local:000000000000:function:local-dev',
  memoryLimitInMB: '128',
  awsRequestId: `local-${Date.now()}`,
  logGroupName: '/aws/lambda/local-dev',
  logStreamName: 'local',
  getRemainingTimeInMillis: () => 30000,
  done: () => {},
  fail: () => {},
  succeed: () => {},
};

/**
 * Wraps a Lambda handler for Express
 */
function wrapHandler(handler: (event: APIGatewayProxyEvent, context: Context) => Promise<APIGatewayProxyResult>) {
  return async (req: Request, res: Response) => {
    try {
      const event = toAPIGatewayEvent(req);
      const result = await handler(event, mockContext);

      // Set headers from Lambda response
      if (result.headers) {
        Object.entries(result.headers).forEach(([key, value]) => {
          res.setHeader(key, String(value));
        });
      }

      res.status(result.statusCode);

      if (result.body) {
        res.send(result.body);
      } else {
        res.end();
      }
    } catch (error) {
      console.error('Handler error:', error);
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };
}

// Routes - map to Lambda handlers
app.get('/api/tournaments', wrapHandler(tournamentsHandler));
app.get('/api/tournaments/:id', (req, res, next) => {
  // Pass id through pathParameters
  (req as any).params = { id: req.params.id };
  next();
}, wrapHandler(tournamentsHandler));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'NOT_FOUND', message: 'Route not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║        BJJ Tournament Tracker - Local Dev Server           ║
╠════════════════════════════════════════════════════════════╣
║  API Server:     http://localhost:${PORT}                      ║
║  DynamoDB:       http://localhost:8000                     ║
║  Health Check:   http://localhost:${PORT}/health               ║
╠════════════════════════════════════════════════════════════╣
║  Endpoints:                                                ║
║    GET /api/tournaments         List tournaments           ║
║    GET /api/tournaments/:id     Get single tournament      ║
╚════════════════════════════════════════════════════════════╝
  `);
});
