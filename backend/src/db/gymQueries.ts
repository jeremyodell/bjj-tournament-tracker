import { QueryCommand, ScanCommand, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME, GSI1_NAME } from './client.js';
import {
  buildSourceGymPK,
  buildSourceGymGSI1SK,
  buildTournamentPK,
  buildGymRosterSK,
  buildGymSyncMetaPK,
} from './types.js';
import type { SourceGymItem, TournamentGymRosterItem, GymSyncMetaItem } from './types.js';
import type { NormalizedGym, IBJJFNormalizedGym, JJWLRosterAthlete } from '../fetchers/types.js';

/**
 * Upsert a source gym (from JJWL, IBJJF, etc.)
 */
export async function upsertSourceGym(gym: NormalizedGym | IBJJFNormalizedGym): Promise<void> {
  const now = new Date().toISOString();

  const item: SourceGymItem = {
    PK: buildSourceGymPK(gym.org, gym.externalId),
    SK: 'META',
    GSI1PK: 'GYMS',
    GSI1SK: buildSourceGymGSI1SK(gym.org, gym.name),
    org: gym.org,
    externalId: gym.externalId,
    name: gym.name,
    masterGymId: null,
    // IBJJF extended fields - null when not provided
    country: (gym as IBJJFNormalizedGym).country ?? null,
    countryCode: (gym as IBJJFNormalizedGym).countryCode ?? null,
    city: (gym as IBJJFNormalizedGym).city ?? null,
    address: (gym as IBJJFNormalizedGym).address ?? null,
    federation: (gym as IBJJFNormalizedGym).federation ?? null,
    website: (gym as IBJJFNormalizedGym).website ?? null,
    responsible: (gym as IBJJFNormalizedGym).responsible ?? null,
    createdAt: now,
    updatedAt: now,
  };

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: item,
    })
  );
}

/**
 * Get a source gym by org and externalId
 */
export async function getSourceGym(
  org: 'JJWL' | 'IBJJF',
  externalId: string
): Promise<SourceGymItem | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: buildSourceGymPK(org, externalId),
        SK: 'META',
      },
    })
  );

  return (result.Item as SourceGymItem) || null;
}

/**
 * Search gyms by org and name prefix using GSI1
 */
export async function searchGyms(
  org: 'JJWL' | 'IBJJF',
  namePrefix: string,
  limit = 20
): Promise<SourceGymItem[]> {
  const command = new QueryCommand({
    TableName: TABLE_NAME,
    IndexName: GSI1_NAME,
    KeyConditionExpression: 'GSI1PK = :pk AND begins_with(GSI1SK, :prefix)',
    ExpressionAttributeValues: {
      ':pk': 'GYMS',
      ':prefix': `${org}#${namePrefix}`,
    },
    Limit: limit,
  });

  const result = await docClient.send(command);
  return (result.Items || []) as SourceGymItem[];
}

/**
 * Search gyms across all orgs (JJWL + IBJJF)
 * Returns combined results sorted by name
 */
export async function searchGymsAcrossOrgs(
  namePrefix: string,
  limit = 20
): Promise<SourceGymItem[]> {
  // Search both orgs in parallel
  const [jjwlGyms, ibjjfGyms] = await Promise.all([
    searchGyms('JJWL', namePrefix, limit),
    searchGyms('IBJJF', namePrefix, limit),
  ]);

  // Combine and sort by name
  const combined = [...jjwlGyms, ...ibjjfGyms];
  combined.sort((a, b) => a.name.localeCompare(b.name));

  // Limit total results
  return combined.slice(0, limit);
}

/**
 * List all gyms for an org (paginated)
 */
export async function listGyms(
  org: 'JJWL' | 'IBJJF',
  limit = 50,
  lastKey?: Record<string, unknown>
): Promise<{ items: SourceGymItem[]; lastKey?: Record<string, unknown> }> {
  const command = new QueryCommand({
    TableName: TABLE_NAME,
    IndexName: GSI1_NAME,
    KeyConditionExpression: 'GSI1PK = :pk AND begins_with(GSI1SK, :org)',
    ExpressionAttributeValues: {
      ':pk': 'GYMS',
      ':org': `${org}#`,
    },
    Limit: limit,
    ExclusiveStartKey: lastKey,
  });

  const result = await docClient.send(command);
  return {
    items: (result.Items || []) as SourceGymItem[],
    lastKey: result.LastEvaluatedKey,
  };
}

/**
 * Load all US IBJJF gyms for matching cache.
 * Filters by countryCode='US' or country='United States'.
 * This reduces the comparison space by ~50% (from 8,614 to ~4,307 gyms).
 */
export async function listUSIBJJFGyms(): Promise<SourceGymItem[]> {
  const gyms: SourceGymItem[] = [];
  let lastEvaluatedKey: Record<string, any> | undefined;

  do {
    const result = await docClient.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression:
          'begins_with(PK, :pk) AND (countryCode = :us OR country = :usLong)',
        ExpressionAttributeValues: {
          ':pk': 'SRCGYM#IBJJF#',
          ':us': 'US',
          ':usLong': 'United States',
        },
        ExclusiveStartKey: lastEvaluatedKey,
      })
    );

    if (result.Items) {
      gyms.push(...(result.Items as SourceGymItem[]));
    }

    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  return gyms;
}

/**
 * Upsert a tournament gym roster
 */
export async function upsertGymRoster(
  org: 'JJWL' | 'IBJJF',
  tournamentId: string,
  gymExternalId: string,
  gymName: string,
  athletes: JJWLRosterAthlete[]
): Promise<void> {
  const item: TournamentGymRosterItem = {
    PK: buildTournamentPK(org, tournamentId),
    SK: buildGymRosterSK(gymExternalId),
    gymExternalId,
    gymName,
    athletes,
    athleteCount: athletes.length,
    fetchedAt: new Date().toISOString(),
  };

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: item,
    })
  );
}

/**
 * Get roster for a specific gym at a tournament
 */
export async function getGymRoster(
  org: 'JJWL' | 'IBJJF',
  tournamentId: string,
  gymExternalId: string
): Promise<TournamentGymRosterItem | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: buildTournamentPK(org, tournamentId),
        SK: buildGymRosterSK(gymExternalId),
      },
    })
  );

  return (result.Item as TournamentGymRosterItem) || null;
}

/**
 * Get all gym rosters for a tournament
 */
export async function getTournamentRosters(
  org: 'JJWL' | 'IBJJF',
  tournamentId: string
): Promise<TournamentGymRosterItem[]> {
  const command = new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
    ExpressionAttributeValues: {
      ':pk': buildTournamentPK(org, tournamentId),
      ':skPrefix': 'GYMROSTER#',
    },
  });

  const result = await docClient.send(command);
  return (result.Items || []) as TournamentGymRosterItem[];
}

/**
 * Batch upsert gyms (for sync)
 * Upserts one at a time to preserve createdAt for existing records
 */
export async function batchUpsertGyms(gyms: NormalizedGym[]): Promise<number> {
  let count = 0;
  for (const gym of gyms) {
    await upsertSourceGym(gym);
    count++;
  }
  return count;
}

/**
 * Get gym sync metadata for an org (for change detection)
 */
export async function getGymSyncMeta(
  org: 'JJWL' | 'IBJJF'
): Promise<GymSyncMetaItem | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: buildGymSyncMetaPK(org),
        SK: 'META',
      },
    })
  );

  return (result.Item as GymSyncMetaItem) || null;
}

/**
 * Update gym sync metadata (upsert)
 * - Always updates lastSyncAt
 * - Only updates lastChangeAt when totalRecords differs from previous value
 */
export async function updateGymSyncMeta(
  org: 'JJWL' | 'IBJJF',
  totalRecords: number
): Promise<void> {
  const now = new Date().toISOString();
  const existing = await getGymSyncMeta(org);

  const recordsChanged = !existing || existing.totalRecords !== totalRecords;

  const item: GymSyncMetaItem = {
    PK: buildGymSyncMetaPK(org),
    SK: 'META',
    org,
    totalRecords,
    lastSyncAt: now,
    lastChangeAt: recordsChanged ? now : existing.lastChangeAt,
  };

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: item,
    })
  );
}

