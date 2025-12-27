import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { ZodError } from 'zod';
import { AppError } from '../../shared/errors.js';

type AsyncHandler = (
  event: APIGatewayProxyEvent,
  context: Context
) => Promise<APIGatewayProxyResult>;

// Standard CORS headers for all responses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
};

export function withErrorHandler(handler: AsyncHandler): AsyncHandler {
  return async (event, context) => {
    try {
      return await handler(event, context);
    } catch (error) {
      console.error('Handler error:', error);

      if (error instanceof AppError) {
        return {
          statusCode: error.statusCode,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
          body: JSON.stringify({
            error: error.code,
            message: error.message,
          }),
        };
      }

      if (error instanceof ZodError) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
          body: JSON.stringify({
            error: 'VALIDATION_ERROR',
            message: error.errors[0]?.message || 'Invalid input',
            details: error.errors,
          }),
        };
      }

      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
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
      ...corsHeaders,
    },
    body: JSON.stringify(body),
  };
}
