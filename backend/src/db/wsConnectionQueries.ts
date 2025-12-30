import {
  PutCommand,
  DeleteCommand,
  GetCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME, GSI1_NAME } from './client.js';
import { buildWsConnPK, WsConnectionItem } from './types.js';

/**
 * Save a new WebSocket connection to DynamoDB
 */
export async function saveConnection(
  connectionId: string,
  userId: string
): Promise<void> {
  const now = new Date();
  const ttl = Math.floor(now.getTime() / 1000) + 24 * 60 * 60; // 24 hours

  const item: WsConnectionItem = {
    PK: buildWsConnPK(connectionId),
    SK: 'META',
    GSI1PK: `USER#${userId}`,
    GSI1SK: 'WSCONN',
    connectionId,
    userId,
    pendingAirport: null,
    connectedAt: now.toISOString(),
    ttl,
  };

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: item,
    })
  );
}

/**
 * Delete a WebSocket connection from DynamoDB
 */
export async function deleteConnection(connectionId: string): Promise<void> {
  await docClient.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: buildWsConnPK(connectionId),
        SK: 'META',
      },
    })
  );
}

/**
 * Get a single WebSocket connection by connectionId
 */
export async function getConnection(
  connectionId: string
): Promise<WsConnectionItem | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: buildWsConnPK(connectionId),
        SK: 'META',
      },
    })
  );

  return (result.Item as WsConnectionItem) || null;
}

/**
 * Get all WebSocket connections for a user via GSI1
 */
export async function getConnectionsForUser(
  userId: string
): Promise<WsConnectionItem[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: GSI1_NAME,
      KeyConditionExpression: 'GSI1PK = :pk AND GSI1SK = :sk',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':sk': 'WSCONN',
      },
    })
  );

  return (result.Items as WsConnectionItem[]) || [];
}

/**
 * Set the pending airport for a WebSocket connection
 * Used when fetching flight prices for a new airport
 */
export async function setPendingAirport(
  connectionId: string,
  airport: string
): Promise<void> {
  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: buildWsConnPK(connectionId),
        SK: 'META',
      },
      UpdateExpression: 'SET pendingAirport = :airport',
      ExpressionAttributeValues: {
        ':airport': airport,
      },
    })
  );
}
