import { QueryCommand, PutCommand, DeleteCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from './client.js';
import { buildUserPK, buildWishlistSK } from './types.js';
import type { WishlistItem } from './types.js';

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
