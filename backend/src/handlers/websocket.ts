import type { APIGatewayProxyWebsocketEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { saveConnection, deleteConnection } from '../db/wsConnectionQueries.js';

/**
 * Extended WebSocket event type that includes queryStringParameters
 * Available on $connect events per AWS documentation
 */
interface WebSocketConnectEvent extends APIGatewayProxyWebsocketEventV2 {
  queryStringParameters?: { [key: string]: string | undefined } | null;
}

/**
 * WebSocket connection handler for API Gateway WebSocket API
 * Handles $connect and $disconnect routes
 */
export async function handler(
  event: WebSocketConnectEvent
): Promise<APIGatewayProxyResult> {
  const { connectionId, routeKey } = event.requestContext;

  try {
    switch (routeKey) {
      case '$connect': {
        const userId = event.queryStringParameters?.userId;
        if (!userId) {
          return { statusCode: 400, body: 'userId required' };
        }
        await saveConnection(connectionId, userId);
        return { statusCode: 200, body: 'Connected' };
      }

      case '$disconnect': {
        await deleteConnection(connectionId);
        return { statusCode: 200, body: 'Disconnected' };
      }

      default:
        return { statusCode: 400, body: 'Unknown route' };
    }
  } catch (error) {
    console.error('WebSocket error:', error);
    return { statusCode: 500, body: 'Internal error' };
  }
}
