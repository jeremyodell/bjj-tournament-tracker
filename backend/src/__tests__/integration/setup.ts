/**
 * Integration test setup utilities.
 * Manages DynamoDB Local table creation, seeding, and cleanup.
 */

import {
  DynamoDBClient,
  CreateTableCommand,
  DeleteTableCommand,
  DescribeTableCommand,
  ResourceNotFoundException,
} from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, BatchWriteCommand, ScanCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import type { NormalizedTournament, NormalizedGym } from '../../fetchers/types.js';
import { buildSourceGymPK } from '../../db/types.js';

// Test table configuration
const TEST_TABLE_NAME = 'bjj-tournament-tracker-test';
const TEST_ENDPOINT = 'http://localhost:8000';

// Create a dedicated test client
const testClient = new DynamoDBClient({
  region: 'us-east-1',
  endpoint: TEST_ENDPOINT,
  credentials: {
    accessKeyId: 'local',
    secretAccessKey: 'local',
  },
});

export const testDocClient = DynamoDBDocumentClient.from(testClient, {
  marshallOptions: {
    removeUndefinedValues: true,
  },
});

export { TEST_TABLE_NAME, TEST_ENDPOINT };

/**
 * Check if DynamoDB Local is running
 */
export async function isDynamoDBLocalRunning(): Promise<boolean> {
  try {
    await testClient.send(
      new DescribeTableCommand({ TableName: 'nonexistent' })
    );
    return true;
  } catch (error) {
    if (error instanceof ResourceNotFoundException) {
      return true; // DynamoDB is running, table just doesn't exist
    }
    return false;
  }
}

/**
 * Create the test table with the same schema as production
 */
export async function createTestTable(): Promise<void> {
  try {
    await testClient.send(
      new CreateTableCommand({
        TableName: TEST_TABLE_NAME,
        AttributeDefinitions: [
          { AttributeName: 'PK', AttributeType: 'S' },
          { AttributeName: 'SK', AttributeType: 'S' },
          { AttributeName: 'GSI1PK', AttributeType: 'S' },
          { AttributeName: 'GSI1SK', AttributeType: 'S' },
        ],
        KeySchema: [
          { AttributeName: 'PK', KeyType: 'HASH' },
          { AttributeName: 'SK', KeyType: 'RANGE' },
        ],
        GlobalSecondaryIndexes: [
          {
            IndexName: 'GSI1',
            KeySchema: [
              { AttributeName: 'GSI1PK', KeyType: 'HASH' },
              { AttributeName: 'GSI1SK', KeyType: 'RANGE' },
            ],
            Projection: { ProjectionType: 'ALL' },
            ProvisionedThroughput: {
              ReadCapacityUnits: 5,
              WriteCapacityUnits: 5,
            },
          },
        ],
        ProvisionedThroughput: {
          ReadCapacityUnits: 5,
          WriteCapacityUnits: 5,
        },
      })
    );
  } catch (error) {
    // Table might already exist
    if (
      error instanceof Error &&
      error.name === 'ResourceInUseException'
    ) {
      return;
    }
    throw error;
  }
}

/**
 * Delete the test table
 */
export async function deleteTestTable(): Promise<void> {
  try {
    await testClient.send(
      new DeleteTableCommand({ TableName: TEST_TABLE_NAME })
    );
  } catch (error) {
    if (error instanceof ResourceNotFoundException) {
      return; // Table doesn't exist, that's fine
    }
    throw error;
  }
}

/**
 * Clear all items from the test table (faster than recreating)
 */
export async function clearTestTable(): Promise<void> {
  // For simplicity, just recreate the table
  await deleteTestTable();
  await createTestTable();
}

/**
 * Build a tournament PK
 */
function buildTournamentPK(org: string, externalId: string): string {
  return `TOURN#${org}#${externalId}`;
}

/**
 * Seed test tournaments into the table
 */
export async function seedTournaments(
  tournaments: NormalizedTournament[]
): Promise<void> {
  const now = new Date().toISOString();
  const batches: NormalizedTournament[][] = [];

  for (let i = 0; i < tournaments.length; i += 25) {
    batches.push(tournaments.slice(i, i + 25));
  }

  for (const batch of batches) {
    await testDocClient.send(
      new BatchWriteCommand({
        RequestItems: {
          [TEST_TABLE_NAME]: batch.map((t) => ({
            PutRequest: {
              Item: {
                PK: buildTournamentPK(t.org, t.externalId),
                SK: 'META',
                GSI1PK: 'TOURNAMENTS',
                GSI1SK: `${t.startDate}#${t.org}#${t.externalId}`,
                ...t,
                slug: null, // Generated on-demand
                createdAt: now,
                updatedAt: now,
              },
            },
          })),
        },
      })
    );
  }
}

/**
 * Sample test tournaments
 */
export const TEST_TOURNAMENTS: NormalizedTournament[] = [
  {
    org: 'IBJJF',
    externalId: '1001',
    name: 'Pan American Championship 2026',
    city: 'Irvine',
    venue: 'Bren Events Center',
    country: 'USA',
    startDate: '2026-03-15',
    endDate: '2026-03-17',
    gi: true,
    nogi: false,
    kids: false,
    registrationUrl: 'https://ibjjf.com/events/pan-2026',
    bannerUrl: null,
  },
  {
    org: 'IBJJF',
    externalId: '1002',
    name: 'World Championship 2026',
    city: 'Las Vegas',
    venue: 'Thomas & Mack Center',
    country: 'USA',
    startDate: '2026-05-28',
    endDate: '2026-06-01',
    gi: true,
    nogi: false,
    kids: false,
    registrationUrl: 'https://ibjjf.com/events/worlds-2026',
    bannerUrl: null,
  },
  {
    org: 'IBJJF',
    externalId: '1003',
    name: 'Kids International Championship',
    city: 'Miami',
    venue: 'Miami Beach Convention Center',
    country: 'USA',
    startDate: '2026-04-10',
    endDate: '2026-04-10',
    gi: true,
    nogi: false,
    kids: true,
    registrationUrl: 'https://ibjjf.com/events/kids-2026',
    bannerUrl: null,
  },
  {
    org: 'JJWL',
    externalId: '2001',
    name: 'JJWL Grand Prix Austin',
    city: 'Austin',
    venue: 'Austin Convention Center',
    country: 'USA',
    startDate: '2026-02-20',
    endDate: '2026-02-20',
    gi: true,
    nogi: true,
    kids: false,
    registrationUrl: 'https://jjworldleague.com/events/austin-2026',
    bannerUrl: null,
  },
  {
    org: 'JJWL',
    externalId: '2002',
    name: 'JJWL No-Gi Championship',
    city: 'Houston',
    venue: 'George R. Brown Convention Center',
    country: 'USA',
    startDate: '2026-06-15',
    endDate: '2026-06-16',
    gi: false,
    nogi: true,
    kids: false,
    registrationUrl: 'https://jjworldleague.com/events/nogi-2026',
    bannerUrl: null,
  },
];

/**
 * Delete all gym records from the test table
 */
export async function deleteAllGyms(): Promise<void> {
  // Scan for all gym-related items (SRCGYM#, GYMSYNC#)
  const scanResult = await testDocClient.send(
    new ScanCommand({
      TableName: TEST_TABLE_NAME,
      FilterExpression: 'begins_with(PK, :srcgym) OR begins_with(PK, :gymsync)',
      ExpressionAttributeValues: {
        ':srcgym': 'SRCGYM#',
        ':gymsync': 'GYMSYNC#',
      },
    })
  );

  if (!scanResult.Items || scanResult.Items.length === 0) {
    return;
  }

  // Delete items in batches of 25 (BatchWrite limit)
  const batches: Array<{ PK: string; SK: string }>[] = [];
  for (let i = 0; i < scanResult.Items.length; i += 25) {
    batches.push(
      scanResult.Items.slice(i, i + 25).map((item) => ({
        PK: item.PK as string,
        SK: item.SK as string,
      }))
    );
  }

  for (const batch of batches) {
    await testDocClient.send(
      new BatchWriteCommand({
        RequestItems: {
          [TEST_TABLE_NAME]: batch.map((key) => ({
            DeleteRequest: { Key: key },
          })),
        },
      })
    );
  }
}

/**
 * Put a single source gym into the test table
 */
export async function putSourceGym(
  gym: NormalizedGym & {
    country?: string;
    countryCode?: string;
    city?: string;
    state?: string;
    address?: string;
    federation?: string;
    website?: string;
  }
): Promise<void> {
  const now = new Date().toISOString();

  await testDocClient.send(
    new BatchWriteCommand({
      RequestItems: {
        [TEST_TABLE_NAME]: [
          {
            PutRequest: {
              Item: {
                PK: buildSourceGymPK(gym.org, gym.externalId),
                SK: 'META',
                GSI1PK: 'GYMS',
                GSI1SK: `${gym.org}#${gym.name}`,
                org: gym.org,
                externalId: gym.externalId,
                name: gym.name,
                masterGymId: null,
                createdAt: now,
                updatedAt: now,
                // Optional IBJJF fields
                ...(gym.country && { country: gym.country }),
                ...(gym.countryCode && { countryCode: gym.countryCode }),
                ...(gym.city && { city: gym.city }),
                ...(gym.state && { state: gym.state }),
                ...(gym.address && { address: gym.address }),
                ...(gym.federation && { federation: gym.federation }),
                ...(gym.website && { website: gym.website }),
              },
            },
          },
        ],
      },
    })
  );
}
