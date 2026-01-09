import { QueryCommand, PutCommand, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME, GSI1_NAME } from './client.js';
import { buildMasterGymPK, buildSourceGymPK } from './types.js';
import type { MasterGymItem } from './types.js';

/**
 * Create a new master gym with auto-generated UUID
 */
export async function createMasterGym(data: {
  canonicalName: string;
  city?: string | null;
  country?: string | null;
  address?: string | null;
  website?: string | null;
}): Promise<MasterGymItem> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const item: MasterGymItem = {
    PK: buildMasterGymPK(id),
    SK: 'META',
    GSI1PK: 'MASTERGYMS',
    GSI1SK: data.canonicalName.toLowerCase(), // Lowercase for case-insensitive search
    id,
    canonicalName: data.canonicalName,
    city: data.city ?? null,
    country: data.country ?? null,
    address: data.address ?? null,
    website: data.website ?? null,
    createdAt: now,
    updatedAt: now,
  };

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: item,
    })
  );

  return item;
}

/**
 * Get a master gym by ID
 */
export async function getMasterGym(id: string): Promise<MasterGymItem | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: buildMasterGymPK(id),
        SK: 'META',
      },
    })
  );

  return (result.Item as MasterGymItem) || null;
}

/**
 * Search master gyms by name prefix using GSI1 (case-insensitive)
 */
export async function searchMasterGyms(
  namePrefix: string,
  limit = 20
): Promise<MasterGymItem[]> {
  const command = new QueryCommand({
    TableName: TABLE_NAME,
    IndexName: GSI1_NAME,
    KeyConditionExpression: 'GSI1PK = :pk AND begins_with(GSI1SK, :prefix)',
    ExpressionAttributeValues: {
      ':pk': 'MASTERGYMS',
      ':prefix': namePrefix.toLowerCase(), // Convert to lowercase for case-insensitive search
    },
    Limit: limit,
  });

  const result = await docClient.send(command);
  return (result.Items || []) as MasterGymItem[];
}

/**
 * Link a source gym to a master gym by updating its masterGymId
 */
export async function linkSourceGymToMaster(
  org: 'JJWL' | 'IBJJF',
  externalId: string,
  masterGymId: string
): Promise<void> {
  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: buildSourceGymPK(org, externalId),
        SK: 'META',
      },
      UpdateExpression: 'SET masterGymId = :masterGymId, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':masterGymId': masterGymId,
        ':updatedAt': new Date().toISOString(),
      },
    })
  );
}

/**
 * Unlink a source gym from its master gym by clearing masterGymId
 */
export async function unlinkSourceGymFromMaster(
  org: 'JJWL' | 'IBJJF',
  externalId: string
): Promise<void> {
  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: buildSourceGymPK(org, externalId),
        SK: 'META',
      },
      UpdateExpression: 'SET masterGymId = :masterGymId, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':masterGymId': null,
        ':updatedAt': new Date().toISOString(),
      },
    })
  );
}
