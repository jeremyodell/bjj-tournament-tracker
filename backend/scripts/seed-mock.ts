/**
 * Seeds the local DynamoDB with mock tournament data for testing.
 * Run with: npm run db:seed:mock
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({
  region: 'us-east-1',
  endpoint: process.env.DYNAMODB_ENDPOINT || 'http://127.0.0.1:8000',
  credentials: {
    accessKeyId: 'local',
    secretAccessKey: 'local',
  },
});

const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

const TABLE_NAME = process.env.DYNAMODB_TABLE || 'bjj-tournament-tracker';

const mockTournaments = [
  {
    externalId: 'ibjjf-2025-worlds',
    org: 'IBJJF',
    name: 'World Jiu-Jitsu Championship 2025',
    startDate: '2025-06-01',
    endDate: '2025-06-08',
    location: 'Long Beach, CA',
    country: 'USA',
    venue: 'Walter Pyramid',
    registrationUrl: 'https://ibjjf.com/events/world-championship-2025',
    eventUrl: 'https://ibjjf.com/events/world-championship-2025',
    status: 'upcoming',
  },
  {
    externalId: 'ibjjf-2025-pans',
    org: 'IBJJF',
    name: 'Pan Jiu-Jitsu Championship 2025',
    startDate: '2025-03-26',
    endDate: '2025-03-30',
    location: 'Kissimmee, FL',
    country: 'USA',
    venue: 'Silver Spurs Arena',
    registrationUrl: 'https://ibjjf.com/events/pan-championship-2025',
    eventUrl: 'https://ibjjf.com/events/pan-championship-2025',
    status: 'upcoming',
  },
  {
    externalId: 'ibjjf-2025-europeans',
    org: 'IBJJF',
    name: 'European Jiu-Jitsu Championship 2025',
    startDate: '2025-01-21',
    endDate: '2025-01-26',
    location: 'Lisbon, Portugal',
    country: 'Portugal',
    venue: 'Altice Arena',
    registrationUrl: 'https://ibjjf.com/events/european-championship-2025',
    eventUrl: 'https://ibjjf.com/events/european-championship-2025',
    status: 'upcoming',
  },
  {
    externalId: 'ibjjf-dallas-open-2025',
    org: 'IBJJF',
    name: 'Dallas International Open 2025',
    startDate: '2025-02-15',
    endDate: '2025-02-16',
    location: 'Dallas, TX',
    country: 'USA',
    venue: 'Dallas Convention Center',
    registrationUrl: 'https://ibjjf.com/events/dallas-open-2025',
    eventUrl: 'https://ibjjf.com/events/dallas-open-2025',
    status: 'upcoming',
  },
  {
    externalId: 'ibjjf-austin-open-2025',
    org: 'IBJJF',
    name: 'Austin International Open 2025',
    startDate: '2025-04-05',
    endDate: '2025-04-06',
    location: 'Austin, TX',
    country: 'USA',
    venue: 'Palmer Events Center',
    registrationUrl: 'https://ibjjf.com/events/austin-open-2025',
    eventUrl: 'https://ibjjf.com/events/austin-open-2025',
    status: 'upcoming',
  },
  {
    externalId: 'jjwl-2025-season1',
    org: 'JJWL',
    name: 'Jiu Jitsu World League Season Opener 2025',
    startDate: '2025-02-08',
    endDate: '2025-02-08',
    location: 'Los Angeles, CA',
    country: 'USA',
    venue: 'LA Convention Center',
    registrationUrl: 'https://jjwl.com/events/season-opener-2025',
    eventUrl: 'https://jjwl.com/events/season-opener-2025',
    status: 'upcoming',
  },
  {
    externalId: 'jjwl-houston-2025',
    org: 'JJWL',
    name: 'JJWL Houston Championship 2025',
    startDate: '2025-03-15',
    endDate: '2025-03-15',
    location: 'Houston, TX',
    country: 'USA',
    venue: 'NRG Center',
    registrationUrl: 'https://jjwl.com/events/houston-2025',
    eventUrl: 'https://jjwl.com/events/houston-2025',
    status: 'upcoming',
  },
  {
    externalId: 'jjwl-sandiego-2025',
    org: 'JJWL',
    name: 'JJWL San Diego Open 2025',
    startDate: '2025-04-19',
    endDate: '2025-04-19',
    location: 'San Diego, CA',
    country: 'USA',
    venue: 'San Diego Convention Center',
    registrationUrl: 'https://jjwl.com/events/sandiego-2025',
    eventUrl: 'https://jjwl.com/events/sandiego-2025',
    status: 'upcoming',
  },
];

function buildTournamentPK(org: string, externalId: string): string {
  return `TOURN#${org}#${externalId}`;
}

async function main(): Promise<void> {
  console.log(`Seeding ${mockTournaments.length} mock tournaments...`);

  const now = new Date().toISOString();
  const batches: typeof mockTournaments[] = [];

  for (let i = 0; i < mockTournaments.length; i += 25) {
    batches.push(mockTournaments.slice(i, i + 25));
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
            },
          },
        })),
      },
    });

    await docClient.send(command);
    saved += batch.length;
  }

  console.log(`Successfully seeded ${saved} tournaments.`);
  console.log('\nTournaments seeded:');
  mockTournaments.forEach((t) => {
    console.log(`  - ${t.org}: ${t.name} (${t.startDate})`);
  });
}

main().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
