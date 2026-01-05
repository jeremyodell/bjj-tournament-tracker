import { QueryCommand, PutCommand, DeleteCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { ulid } from 'ulid';
import { docClient, TABLE_NAME } from './client.js';
import { buildUserPK, buildAthleteSK } from './types.js';
import type { AthleteItem } from './types.js';

export interface CreateAthleteInput {
  name: string;
  beltRank?: string;
  birthYear?: number;
  gender?: string;
  weight?: number;
  gymName?: string;
  homeAirport?: string;
  gymSourceId?: string; // e.g., "JJWL#5713"
  gymDisplayName?: string; // Maps to gymName on AthleteItem
  masterGymId?: string; // Links to unified master gym
}

export async function getUserAthletes(userId: string): Promise<AthleteItem[]> {
  const command = new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
    ExpressionAttributeValues: {
      ':pk': buildUserPK(userId),
      ':skPrefix': 'ATHLETE#',
    },
  });

  const result = await docClient.send(command);
  return (result.Items || []) as AthleteItem[];
}

export async function createAthlete(
  userId: string,
  input: CreateAthleteInput
): Promise<AthleteItem> {
  const athleteId = ulid();
  const now = new Date().toISOString();

  const item: AthleteItem = {
    PK: buildUserPK(userId),
    SK: buildAthleteSK(athleteId),
    athleteId,
    name: input.name,
    beltRank: input.beltRank || null,
    birthYear: input.birthYear || null,
    weightClass: input.weight ? `${input.weight}lbs` : null,
    homeAirport: input.homeAirport?.trim().toUpperCase() || null,
    gymSourceId: input.gymSourceId || null,
    gymName: input.gymDisplayName || null,
    masterGymId: input.masterGymId || null,
    createdAt: now,
    updatedAt: now,
  };

  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: item,
  }));

  return item;
}

export async function getAthlete(userId: string, athleteId: string): Promise<AthleteItem | null> {
  const result = await docClient.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: {
      PK: buildUserPK(userId),
      SK: buildAthleteSK(athleteId),
    },
  }));

  return (result.Item as AthleteItem) || null;
}

export async function updateAthlete(
  userId: string,
  athleteId: string,
  input: Partial<CreateAthleteInput>
): Promise<AthleteItem | null> {
  const existing = await getAthlete(userId, athleteId);
  if (!existing) return null;

  const updated: AthleteItem = {
    ...existing,
    name: input.name ?? existing.name,
    beltRank: input.beltRank ?? existing.beltRank,
    birthYear: input.birthYear ?? existing.birthYear,
    weightClass: input.weight ? `${input.weight}lbs` : existing.weightClass,
    homeAirport: input.homeAirport !== undefined
      ? (input.homeAirport?.trim().toUpperCase() || null)
      : existing.homeAirport,
    gymSourceId: input.gymSourceId !== undefined
      ? (input.gymSourceId || null)
      : existing.gymSourceId,
    gymName: input.gymDisplayName !== undefined
      ? (input.gymDisplayName || null)
      : existing.gymName,
    masterGymId: input.masterGymId !== undefined
      ? (input.masterGymId || null)
      : existing.masterGymId,
    updatedAt: new Date().toISOString(),
  };

  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: updated,
  }));

  return updated;
}

export async function deleteAthlete(userId: string, athleteId: string): Promise<void> {
  await docClient.send(new DeleteCommand({
    TableName: TABLE_NAME,
    Key: {
      PK: buildUserPK(userId),
      SK: buildAthleteSK(athleteId),
    },
  }));
}
