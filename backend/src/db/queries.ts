import { QueryCommand, BatchWriteCommand, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME, GSI1_NAME } from './client.js';
import { buildTournamentPK, buildVenuePK, buildVenueLookupSK } from './types.js';
import type { TournamentItem, VenueItem } from './types.js';
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

/**
 * Get a single tournament by its PK (e.g., "TOURN#IBJJF#123")
 */
export async function getTournamentById(
  pk: string
): Promise<TournamentItem | null> {
  const command = new GetCommand({
    TableName: TABLE_NAME,
    Key: {
      PK: pk,
      SK: 'META',
    },
  });

  const result = await docClient.send(command);
  return (result.Item as TournamentItem) || null;
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
              // Ensure geocoding fields have defaults
              lat: t.lat ?? null,
              lng: t.lng ?? null,
              venueId: t.venueId ?? null,
              geocodeConfidence: t.geocodeConfidence ?? null,
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

/**
 * Look up a venue by name and city (normalized, case-insensitive)
 */
export async function getVenueByLookup(
  venue: string,
  city: string
): Promise<VenueItem | null> {
  const lookupKey = buildVenueLookupSK(venue, city);

  const command = new QueryCommand({
    TableName: TABLE_NAME,
    IndexName: GSI1_NAME,
    KeyConditionExpression: 'GSI1PK = :pk AND GSI1SK = :sk',
    ExpressionAttributeValues: {
      ':pk': 'VENUE_LOOKUP',
      ':sk': lookupKey,
    },
    Limit: 1,
  });

  const result = await docClient.send(command);
  return (result.Items?.[0] as VenueItem) || null;
}

/**
 * Create or update a venue in the cache
 */
export async function upsertVenue(venue: Omit<VenueItem, 'PK' | 'SK' | 'GSI1PK' | 'GSI1SK'>): Promise<void> {
  const now = new Date().toISOString();
  const lookupKey = buildVenueLookupSK(venue.name, venue.city);

  const command = new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      PK: buildVenuePK(venue.venueId),
      SK: 'META',
      GSI1PK: 'VENUE_LOOKUP',
      GSI1SK: lookupKey,
      ...venue,
      updatedAt: now,
    } satisfies VenueItem,
  });

  await docClient.send(command);
}

/**
 * Get all venues with low confidence that haven't been manually overridden
 */
export async function getLowConfidenceVenues(): Promise<VenueItem[]> {
  const command = new QueryCommand({
    TableName: TABLE_NAME,
    IndexName: GSI1_NAME,
    KeyConditionExpression: 'GSI1PK = :pk',
    FilterExpression: 'geocodeConfidence = :conf AND manualOverride = :override',
    ExpressionAttributeValues: {
      ':pk': 'VENUE_LOOKUP',
      ':conf': 'low',
      ':override': false,
    },
  });

  const result = await docClient.send(command);
  return (result.Items || []) as VenueItem[];
}
