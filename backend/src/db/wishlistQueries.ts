import { QueryCommand, PutCommand, DeleteCommand, GetCommand, ScanCommand, BatchGetCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from './client.js';
import { buildUserPK, buildWishlistSK } from './types.js';
import type { WishlistItem, TournamentItem } from './types.js';

export async function getUserWishlist(userId: string): Promise<WishlistItem[]> {
  const command = new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
    ExpressionAttributeValues: {
      ':pk': buildUserPK(userId),
      ':skPrefix': 'WISH#',
    },
  });

  const result = await docClient.send(command);
  return (result.Items || []) as WishlistItem[];
}

export async function addToWishlist(
  userId: string,
  tournamentPK: string
): Promise<WishlistItem> {
  const now = new Date().toISOString();
  const item: WishlistItem = {
    PK: buildUserPK(userId),
    SK: buildWishlistSK(tournamentPK),
    tournamentPK,
    status: 'interested',
    athleteIds: [],
    createdAt: now,
    updatedAt: now,
  };

  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: item,
  }));

  return item;
}

export async function removeFromWishlist(
  userId: string,
  tournamentPK: string
): Promise<void> {
  await docClient.send(new DeleteCommand({
    TableName: TABLE_NAME,
    Key: {
      PK: buildUserPK(userId),
      SK: buildWishlistSK(tournamentPK),
    },
  }));
}

export async function getWishlistItem(
  userId: string,
  tournamentPK: string
): Promise<WishlistItem | null> {
  const result = await docClient.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: {
      PK: buildUserPK(userId),
      SK: buildWishlistSK(tournamentPK),
    },
  }));

  return (result.Item as WishlistItem) || null;
}

export async function updateWishlistItem(
  userId: string,
  tournamentPK: string,
  updates: Partial<Pick<WishlistItem, 'status' | 'athleteIds'>>
): Promise<WishlistItem | null> {
  const existing = await getWishlistItem(userId, tournamentPK);
  if (!existing) return null;

  const updated: WishlistItem = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: updated,
  }));

  return updated;
}

/**
 * Get all wishlisted tournament PKs across all users.
 * Filters to only JJWL tournaments (roster sync not supported for IBJJF yet)
 * and tournaments within the specified date range.
 *
 * @param daysAhead - Number of days in the future to include tournaments
 * @returns Array of unique tournament PKs (e.g., "TOURN#JJWL#850")
 */
export async function getAllWishlistedTournamentPKs(daysAhead: number = 60): Promise<string[]> {
  // Step 1: Scan all wishlist items (with pagination)
  const allWishlistItems: WishlistItem[] = [];
  let lastKey: Record<string, unknown> | undefined;

  do {
    const command = new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: 'begins_with(SK, :wishPrefix)',
      ExpressionAttributeValues: {
        ':wishPrefix': 'WISH#',
      },
      ExclusiveStartKey: lastKey,
    });

    const result = await docClient.send(command);
    allWishlistItems.push(...((result.Items || []) as WishlistItem[]));
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  if (allWishlistItems.length === 0) {
    return [];
  }

  // Step 2: Extract unique tournament PKs, filtering to JJWL only
  const uniqueTournamentPKs = [...new Set(
    allWishlistItems
      .map(item => item.tournamentPK)
      .filter(pk => pk.includes('#JJWL#'))
  )];

  if (uniqueTournamentPKs.length === 0) {
    return [];
  }

  // Step 3: Batch get tournament details to filter by date
  const tournaments: TournamentItem[] = [];
  const batches: string[][] = [];

  // BatchGet has a limit of 100 items
  for (let i = 0; i < uniqueTournamentPKs.length; i += 100) {
    batches.push(uniqueTournamentPKs.slice(i, i + 100));
  }

  for (const batch of batches) {
    const batchGetCommand = new BatchGetCommand({
      RequestItems: {
        [TABLE_NAME]: {
          Keys: batch.map(pk => ({ PK: pk, SK: 'META' })),
        },
      },
    });

    const result = await docClient.send(batchGetCommand);
    const items = result.Responses?.[TABLE_NAME] || [];
    tournaments.push(...(items as TournamentItem[]));
  }

  // Step 4: Filter tournaments by date range
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const futureDate = new Date(today.getTime() + daysAhead * 24 * 60 * 60 * 1000);

  return tournaments
    .filter(tournament => {
      const startDate = new Date(tournament.startDate);
      return startDate >= today && startDate <= futureDate;
    })
    .map(tournament => tournament.PK);
}
