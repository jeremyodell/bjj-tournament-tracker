import { QueryCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME, GSI1_NAME } from './client.js';
import { buildTournamentPK } from './types.js';
import type { TournamentItem } from './types.js';
import type { NormalizedTournament } from '../fetchers/types.js';

export interface TournamentFilters {
  org?: 'IBJJF' | 'JJWL';
  startAfter?: string;
  startBefore?: string;
  city?: string;
  gi?: boolean;
  nogi?: boolean;
  kids?: boolean;
  search?: string;
}

export function buildTournamentFilters(filters: TournamentFilters): {
  FilterExpression?: string;
  ExpressionAttributeValues: Record<string, unknown>;
  ExpressionAttributeNames?: Record<string, string>;
} {
  const conditions: string[] = [];
  const values: Record<string, unknown> = {};
  const names: Record<string, string> = {};

  if (filters.org) {
    conditions.push('org = :org');
    values[':org'] = filters.org;
  }

  if (filters.startAfter) {
    conditions.push('startDate >= :startAfter');
    values[':startAfter'] = filters.startAfter;
  }

  if (filters.startBefore) {
    conditions.push('startDate <= :startBefore');
    values[':startBefore'] = filters.startBefore;
  }

  if (filters.city) {
    conditions.push('contains(city, :city)');
    values[':city'] = filters.city;
  }

  if (filters.gi !== undefined) {
    conditions.push('gi = :gi');
    values[':gi'] = filters.gi;
  }

  if (filters.nogi !== undefined) {
    conditions.push('nogi = :nogi');
    values[':nogi'] = filters.nogi;
  }

  if (filters.kids !== undefined) {
    conditions.push('kids = :kids');
    values[':kids'] = filters.kids;
  }

  if (filters.search) {
    conditions.push('contains(#name, :search)');
    values[':search'] = filters.search;
    names['#name'] = 'name';
  }

  return {
    FilterExpression: conditions.length > 0 ? conditions.join(' AND ') : undefined,
    ExpressionAttributeValues: values,
    ExpressionAttributeNames: Object.keys(names).length > 0 ? names : undefined,
  };
}

export function buildGSI1Query(filters: TournamentFilters): {
  KeyConditionExpression: string;
  ExpressionAttributeValues: Record<string, unknown>;
} {
  const values: Record<string, unknown> = { ':pk': 'TOURNAMENTS' };

  if (filters.startAfter && filters.startBefore) {
    return {
      KeyConditionExpression: 'GSI1PK = :pk AND GSI1SK BETWEEN :start AND :end',
      ExpressionAttributeValues: {
        ...values,
        ':start': filters.startAfter,
        ':end': filters.startBefore + 'Z', // Ensure end is inclusive
      },
    };
  }

  return {
    KeyConditionExpression: 'GSI1PK = :pk',
    ExpressionAttributeValues: values,
  };
}

export async function queryTournaments(
  filters: TournamentFilters,
  limit = 50,
  lastKey?: Record<string, unknown>
): Promise<{ items: TournamentItem[]; lastKey?: Record<string, unknown> }> {
  const gsi1Query = buildGSI1Query(filters);
  const filterParams = buildTournamentFilters(filters);

  const command = new QueryCommand({
    TableName: TABLE_NAME,
    IndexName: GSI1_NAME,
    ...gsi1Query,
    FilterExpression: filterParams.FilterExpression,
    ExpressionAttributeValues: {
      ...gsi1Query.ExpressionAttributeValues,
      ...filterParams.ExpressionAttributeValues,
    },
    ExpressionAttributeNames: filterParams.ExpressionAttributeNames,
    Limit: limit,
    ExclusiveStartKey: lastKey,
    ScanIndexForward: true, // Ascending by date
  });

  const result = await docClient.send(command);

  return {
    items: (result.Items || []) as TournamentItem[],
    lastKey: result.LastEvaluatedKey,
  };
}

export async function upsertTournaments(
  tournaments: NormalizedTournament[]
): Promise<number> {
  const now = new Date().toISOString();
  const batches: NormalizedTournament[][] = [];

  // Split into batches of 25 (DynamoDB limit)
  for (let i = 0; i < tournaments.length; i += 25) {
    batches.push(tournaments.slice(i, i + 25));
  }

  let saved = 0;

  for (const batch of batches) {
    const command = new BatchWriteCommand({
      RequestItems: {
        [TABLE_NAME]: batch.map((t) => ({
          PutRequest: {
            Item: {
              PK: buildTournamentPK(t.org, t.externalId),
              SK: 'META',
              GSI1PK: 'TOURNAMENTS',
              GSI1SK: `${t.startDate}#${t.org}#${t.externalId}`,
              ...t,
              createdAt: now,
              updatedAt: now,
            } satisfies TournamentItem,
          },
        })),
      },
    });

    await docClient.send(command);
    saved += batch.length;
  }

  return saved;
}
