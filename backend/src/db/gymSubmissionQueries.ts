import { QueryCommand, PutCommand, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME, GSI1_NAME } from './client.js';
import { buildGymSubmissionPK } from './types.js';
import type { GymSubmissionItem } from './types.js';

/**
 * Create a new gym submission with auto-generated UUID
 */
export async function createGymSubmission(data: {
  customGymName: string;
  submittedByUserId: string;
  athleteIds: string[];
}): Promise<GymSubmissionItem> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const item: GymSubmissionItem = {
    PK: buildGymSubmissionPK(id),
    SK: 'META',
    GSI1PK: 'GYMSUBMISSIONS',
    GSI1SK: `pending#${now}`,
    id,
    customGymName: data.customGymName,
    submittedByUserId: data.submittedByUserId,
    athleteIds: data.athleteIds,
    status: 'pending',
    masterGymId: null,
    reviewedAt: null,
    reviewedBy: null,
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
 * Get a gym submission by ID
 */
export async function getGymSubmission(id: string): Promise<GymSubmissionItem | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: buildGymSubmissionPK(id),
        SK: 'META',
      },
    })
  );

  return (result.Item as GymSubmissionItem) || null;
}

/**
 * List gym submissions by status using GSI1
 */
export async function listGymSubmissions(
  status: 'pending' | 'approved' | 'rejected',
  limit = 50
): Promise<GymSubmissionItem[]> {
  const command = new QueryCommand({
    TableName: TABLE_NAME,
    IndexName: GSI1_NAME,
    KeyConditionExpression: 'GSI1PK = :pk AND begins_with(GSI1SK, :status)',
    ExpressionAttributeValues: {
      ':pk': 'GYMSUBMISSIONS',
      ':status': `${status}#`,
    },
    Limit: limit,
  });

  const result = await docClient.send(command);
  return (result.Items || []) as GymSubmissionItem[];
}

/**
 * Update gym submission status
 */
export async function updateGymSubmissionStatus(
  id: string,
  status: 'approved' | 'rejected',
  reviewedBy: string
): Promise<void> {
  const now = new Date().toISOString();

  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: buildGymSubmissionPK(id),
        SK: 'META',
      },
      UpdateExpression:
        'SET #status = :status, reviewedAt = :reviewedAt, reviewedBy = :reviewedBy, updatedAt = :updatedAt, GSI1SK = :gsi1sk',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':status': status,
        ':reviewedAt': now,
        ':reviewedBy': reviewedBy,
        ':updatedAt': now,
        ':gsi1sk': `${status}#${now}`,
      },
    })
  );
}

/**
 * Link a gym submission to a master gym (when approved)
 */
export async function linkGymSubmissionToMaster(
  id: string,
  masterGymId: string
): Promise<void> {
  const now = new Date().toISOString();

  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: buildGymSubmissionPK(id),
        SK: 'META',
      },
      UpdateExpression: 'SET masterGymId = :masterGymId, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':masterGymId': masterGymId,
        ':updatedAt': now,
      },
    })
  );
}
