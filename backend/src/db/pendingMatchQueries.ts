import { QueryCommand, PutCommand, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME, GSI1_NAME } from './client.js';
import { buildPendingMatchPK } from './types.js';
import type { PendingMatchItem, MatchSignals } from './types.js';

/**
 * Create a new pending match with auto-generated UUID
 */
export async function createPendingMatch(data: {
  sourceGym1Id: string;
  sourceGym1Name: string;
  sourceGym2Id: string;
  sourceGym2Name: string;
  confidence: number;
  signals: MatchSignals;
}): Promise<PendingMatchItem> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const item: PendingMatchItem = {
    PK: buildPendingMatchPK(id),
    SK: 'META',
    GSI1PK: 'PENDINGMATCHES',
    GSI1SK: `pending#${now}`,
    id,
    sourceGym1Id: data.sourceGym1Id,
    sourceGym1Name: data.sourceGym1Name,
    sourceGym2Id: data.sourceGym2Id,
    sourceGym2Name: data.sourceGym2Name,
    confidence: data.confidence,
    signals: data.signals,
    status: 'pending',
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
 * Get a pending match by ID
 */
export async function getPendingMatch(id: string): Promise<PendingMatchItem | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: buildPendingMatchPK(id),
        SK: 'META',
      },
    })
  );

  return (result.Item as PendingMatchItem) || null;
}

/**
 * List pending matches by status using GSI1
 */
export async function listPendingMatches(
  status: 'pending' | 'approved' | 'rejected',
  limit = 50
): Promise<PendingMatchItem[]> {
  const command = new QueryCommand({
    TableName: TABLE_NAME,
    IndexName: GSI1_NAME,
    KeyConditionExpression: 'GSI1PK = :pk AND begins_with(GSI1SK, :status)',
    ExpressionAttributeValues: {
      ':pk': 'PENDINGMATCHES',
      ':status': `${status}#`,
    },
    Limit: limit,
  });

  const result = await docClient.send(command);
  return (result.Items || []) as PendingMatchItem[];
}

/**
 * Update pending match status
 */
export async function updatePendingMatchStatus(
  id: string,
  status: 'approved' | 'rejected',
  reviewedBy: string
): Promise<void> {
  const now = new Date().toISOString();

  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: buildPendingMatchPK(id),
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
 * Find existing pending match between two gyms (in either direction)
 * Used to prevent duplicate pending matches
 */
export async function findExistingPendingMatch(
  sourceGym1Id: string,
  sourceGym2Id: string
): Promise<PendingMatchItem | null> {
  // Query all pending matches and filter
  // Note: For production with many matches, consider adding a GSI for gym pairs
  const command = new QueryCommand({
    TableName: TABLE_NAME,
    IndexName: GSI1_NAME,
    KeyConditionExpression: 'GSI1PK = :pk AND begins_with(GSI1SK, :status)',
    ExpressionAttributeValues: {
      ':pk': 'PENDINGMATCHES',
      ':status': 'pending#',
    },
  });

  const result = await docClient.send(command);
  const matches = (result.Items || []) as PendingMatchItem[];

  // Check for match in either direction
  return (
    matches.find(
      (m) =>
        (m.sourceGym1Id === sourceGym1Id && m.sourceGym2Id === sourceGym2Id) ||
        (m.sourceGym1Id === sourceGym2Id && m.sourceGym2Id === sourceGym1Id)
    ) || null
  );
}
