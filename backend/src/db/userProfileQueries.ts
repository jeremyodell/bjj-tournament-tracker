import { GetCommand, UpdateCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from './client.js';
import { buildUserPK } from './types.js';
import type { UserProfileItem } from './types.js';

/**
 * Get a user profile by user ID (cognitoSub)
 */
export async function getUserProfile(userId: string): Promise<UserProfileItem | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: buildUserPK(userId),
        SK: 'PROFILE',
      },
    })
  );

  return (result.Item as UserProfileItem) || null;
}

/**
 * Update a user profile with partial updates
 */
export async function updateUserProfile(
  userId: string,
  updates: Partial<Pick<UserProfileItem, 'name' | 'homeCity' | 'homeState' | 'nearestAirport' | 'gymName' | 'masterGymId'>>
): Promise<UserProfileItem | null> {
  const updateExpressions: string[] = ['updatedAt = :updatedAt'];
  const expressionAttributeValues: Record<string, unknown> = {
    ':updatedAt': new Date().toISOString(),
  };

  // Build update expression dynamically from provided updates
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      updateExpressions.push(`${key} = :${key}`);
      expressionAttributeValues[`:${key}`] = value;
    }
  }

  const result = await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: buildUserPK(userId),
        SK: 'PROFILE',
      },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW',
    })
  );

  return (result.Attributes as UserProfileItem) || null;
}

/**
 * Get all unique master gym IDs from user profiles
 * Used to build the set of gyms that need roster tracking
 */
export async function getAllUserMasterGymIds(): Promise<string[]> {
  const gymIds = new Set<string>();
  let lastEvaluatedKey: Record<string, unknown> | undefined;

  do {
    const result = await docClient.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: 'SK = :sk',
        ExpressionAttributeValues: {
          ':sk': 'PROFILE',
        },
        ProjectionExpression: 'masterGymId',
        ExclusiveStartKey: lastEvaluatedKey,
      })
    );

    // Collect non-null gym IDs
    for (const item of result.Items || []) {
      const gymId = (item as { masterGymId?: string | null }).masterGymId;
      if (gymId) {
        gymIds.add(gymId);
      }
    }

    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  return Array.from(gymIds);
}
