import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { fetchIBJJFTournaments } from '../src/fetchers/ibjjfFetcher.js';
import { fetchJJWLTournaments } from '../src/fetchers/jjwlFetcher.js';
import type { NormalizedTournament } from '../src/fetchers/types.js';

const TABLE_NAME = 'bjj-tournament-tracker-dev';

const client = new DynamoDBClient({ region: 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);

function buildTournamentPK(org: string, externalId: string): string {
  return `TOURN#${org}#${externalId}`;
}

async function upsertTournaments(tournaments: NormalizedTournament[]): Promise<number> {
  const now = new Date().toISOString();
  const batches: NormalizedTournament[][] = [];

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
              lat: t.lat ?? null,
              lng: t.lng ?? null,
              venueId: t.venueId ?? null,
              geocodeConfidence: t.geocodeConfidence ?? null,
              createdAt: now,
              updatedAt: now,
            },
          },
        })),
      },
    });

    await docClient.send(command);
    saved += batch.length;
    process.stdout.write(`\rSaved ${saved} tournaments...`);
  }

  return saved;
}

async function main() {
  console.log('Syncing tournaments to AWS...\n');

  console.log('Fetching IBJJF tournaments...');
  const ibjjf = await fetchIBJJFTournaments();
  console.log(`Found ${ibjjf.length} IBJJF tournaments`);

  console.log('Fetching JJWL tournaments...');
  const jjwl = await fetchJJWLTournaments();
  console.log(`Found ${jjwl.length} JJWL tournaments`);

  console.log('\nSaving to DynamoDB...');
  const ibjjfSaved = await upsertTournaments(ibjjf);
  console.log(`\nSaved ${ibjjfSaved} IBJJF tournaments`);
  
  const jjwlSaved = await upsertTournaments(jjwl);
  console.log(`\nSaved ${jjwlSaved} JJWL tournaments`);

  console.log(`\nTotal: ${ibjjfSaved + jjwlSaved} tournaments synced to ${TABLE_NAME}`);
}

main().catch(console.error);
