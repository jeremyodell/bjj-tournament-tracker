import { PutCommand, GetCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME, GSI1_NAME } from './client.js';
import { buildAirportPK, type KnownAirportItem } from './types.js';

export async function saveKnownAirport(iataCode: string): Promise<void> {
  const now = new Date().toISOString();
  const item: KnownAirportItem = {
    PK: buildAirportPK(iataCode),
    SK: 'META',
    GSI1PK: 'AIRPORTS',
    GSI1SK: iataCode,
    iataCode,
    userCount: 1,
    lastFetchedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  const command = new PutCommand({
    TableName: TABLE_NAME,
    Item: item,
    ConditionExpression: 'attribute_not_exists(PK)',
  });

  try {
    await docClient.send(command);
  } catch (err) {
    if ((err as Error).name === 'ConditionalCheckFailedException') {
      // Airport already exists, increment user count instead
      await incrementAirportUserCount(iataCode);
    } else {
      throw err;
    }
  }
}

export async function getKnownAirport(iataCode: string): Promise<KnownAirportItem | null> {
  const command = new GetCommand({
    TableName: TABLE_NAME,
    Key: {
      PK: buildAirportPK(iataCode),
      SK: 'META',
    },
  });

  const result = await docClient.send(command);
  return (result.Item as KnownAirportItem) || null;
}

export async function incrementAirportUserCount(iataCode: string): Promise<void> {
  const command = new UpdateCommand({
    TableName: TABLE_NAME,
    Key: {
      PK: buildAirportPK(iataCode),
      SK: 'META',
    },
    UpdateExpression: 'SET userCount = userCount + :inc, updatedAt = :now',
    ExpressionAttributeValues: {
      ':inc': 1,
      ':now': new Date().toISOString(),
    },
  });

  await docClient.send(command);
}

export async function decrementAirportUserCount(iataCode: string): Promise<void> {
  const command = new UpdateCommand({
    TableName: TABLE_NAME,
    Key: {
      PK: buildAirportPK(iataCode),
      SK: 'META',
    },
    UpdateExpression: 'SET userCount = userCount - :dec, updatedAt = :now',
    ConditionExpression: 'userCount > :zero',
    ExpressionAttributeValues: {
      ':dec': 1,
      ':now': new Date().toISOString(),
      ':zero': 0,
    },
  });

  await docClient.send(command);
}

export async function listKnownAirports(): Promise<KnownAirportItem[]> {
  const command = new QueryCommand({
    TableName: TABLE_NAME,
    IndexName: GSI1_NAME,
    KeyConditionExpression: 'GSI1PK = :pk',
    ExpressionAttributeValues: {
      ':pk': 'AIRPORTS',
    },
  });

  const result = await docClient.send(command);
  return (result.Items as KnownAirportItem[]) || [];
}

export async function updateAirportLastFetched(iataCode: string): Promise<void> {
  const command = new UpdateCommand({
    TableName: TABLE_NAME,
    Key: {
      PK: buildAirportPK(iataCode),
      SK: 'META',
    },
    UpdateExpression: 'SET lastFetchedAt = :now, updatedAt = :now',
    ExpressionAttributeValues: {
      ':now': new Date().toISOString(),
    },
  });

  await docClient.send(command);
}
