import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { ZodError } from 'zod';
import { AppError } from '../../shared/errors.js';

type AsyncHandler = (
  event: APIGatewayProxyEvent,
  context: Context
) => Promise<APIGatewayProxyResult>;

export function withErrorHandler(handler: AsyncHandler): AsyncHandler {
  return async (event, context) => {
    try {
      return await handler(event, context);
    } catch (error) {
      console.error('Handler error:', error);

      if (error instanceof AppError) {
        return {
          statusCode: error.statusCode,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            error: error.code,
            message: error.message,
          }),
        };
      }

      if (error instanceof ZodError) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            error: 'VALIDATION_ERROR',
            message: error.errors[0]?.message || 'Invalid input',
            details: error.errors,
          }),
        };
      }

      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'INTERNAL_ERROR',
          message: 'Something went wrong',
        }),
      };
    }
  };
}

export function jsonResponse(
  statusCode: number,
  body: unknown
): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(body),
  };
}
