/**
 * Seeds the local DynamoDB with tournament data from IBJJF and JJWL.
 * Run with: npm run db:seed
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';

// Configure for local DynamoDB
const client = new DynamoDBClient({
  region: 'local',
  endpoint: process.env.DYNAMODB_ENDPOINT || 'http://localhost:8000',
  credentials: {
    accessKeyId: 'local',
    secretAccessKey: 'local',
  },
});

const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

const TABLE_NAME = process.env.DYNAMODB_TABLE || 'bjj-tournament-tracker';

// Import fetchers - adjust path based on your build output
import { fetchIBJJFTournaments } from '../src/fetchers/ibjjfFetcher.js';
import { fetchJJWLTournaments } from '../src/fetchers/jjwlFetcher.js';
import type { NormalizedTournament } from '../src/fetchers/types.js';

function buildTournamentPK(org: string, externalId: string): string {
  return `TOURN#${org}#${externalId}`;
}

async function upsertTournaments(tournaments: NormalizedTournament[]): Promise<number> {
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
            },
          },
        })),
      },
    });

    await docClient.send(command);
    saved += batch.length;
  }

  return saved;
}

async function main(): Promise<void> {
  console.log('Fetching tournaments from IBJJF and JJWL...\n');

  const results = {
    ibjjf: { fetched: 0, saved: 0, error: '' },
    jjwl: { fetched: 0, saved: 0, error: '' },
  };

  // Fetch IBJJF
  try {
    console.log('Fetching from IBJJF...');
    const ibjjfTournaments = await fetchIBJJFTournaments();
    results.ibjjf.fetched = ibjjfTournaments.length;
    console.log(`  Found ${ibjjfTournaments.length} tournaments`);

    results.ibjjf.saved = await upsertTournaments(ibjjfTournaments);
    console.log(`  Saved ${results.ibjjf.saved} tournaments`);
  } catch (error) {
    results.ibjjf.error = error instanceof Error ? error.message : 'Unknown error';
    console.error(`  Error: ${results.ibjjf.error}`);
  }

  // Fetch JJWL
  try {
    console.log('\nFetching from JJWL...');
    const jjwlTournaments = await fetchJJWLTournaments();
    results.jjwl.fetched = jjwlTournaments.length;
    console.log(`  Found ${jjwlTournaments.length} tournaments`);

    results.jjwl.saved = await upsertTournaments(jjwlTournaments);
    console.log(`  Saved ${results.jjwl.saved} tournaments`);
  } catch (error) {
    results.jjwl.error = error instanceof Error ? error.message : 'Unknown error';
    console.error(`  Error: ${results.jjwl.error}`);
  }

  // Summary
  console.log('\n--- Summary ---');
  console.log(`IBJJF: ${results.ibjjf.saved}/${results.ibjjf.fetched} saved`);
  console.log(`JJWL:  ${results.jjwl.saved}/${results.jjwl.fetched} saved`);
  console.log(`Total: ${results.ibjjf.saved + results.jjwl.saved} tournaments`);

  if (results.ibjjf.error || results.jjwl.error) {
    console.log('\nErrors occurred - some sources may have failed.');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
