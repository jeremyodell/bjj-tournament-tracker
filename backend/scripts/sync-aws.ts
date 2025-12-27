import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, BatchWriteCommand, QueryCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { fetchIBJJFTournaments } from '../src/fetchers/ibjjfFetcher.js';
import { fetchJJWLTournaments } from '../src/fetchers/jjwlFetcher.js';
import { geocodeVenue } from '../src/services/geocoder.js';
import { ulid } from 'ulid';
import type { NormalizedTournament } from '../src/fetchers/types.js';

const TABLE_NAME = 'bjj-tournament-tracker-dev';

const client = new DynamoDBClient({ region: 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);

function buildTournamentPK(org: string, externalId: string): string {
  return `TOURN#${org}#${externalId}`;
}

function buildVenueLookupSK(venue: string, city: string): string {
  const normalized = `${venue}|${city}`.toLowerCase().replace(/\s+/g, '_');
  return normalized;
}

interface VenueCache {
  venueId: string;
  lat: number;
  lng: number;
  geocodeConfidence: 'high' | 'low' | 'failed';
}

async function getVenueFromCache(venue: string, city: string): Promise<VenueCache | null> {
  const lookupKey = buildVenueLookupSK(venue, city);

  const command = new QueryCommand({
    TableName: TABLE_NAME,
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :pk AND GSI1SK = :sk',
    ExpressionAttributeValues: {
      ':pk': 'VENUE_LOOKUP',
      ':sk': lookupKey,
    },
    Limit: 1,
  });

  const result = await docClient.send(command);
  if (result.Items && result.Items.length > 0) {
    const item = result.Items[0];
    return {
      venueId: item.venueId as string,
      lat: item.lat as number,
      lng: item.lng as number,
      geocodeConfidence: item.geocodeConfidence as 'high' | 'low' | 'failed',
    };
  }
  return null;
}

async function cacheVenue(venue: string, city: string, country: string | null, lat: number, lng: number, confidence: 'high' | 'low'): Promise<string> {
  const venueId = ulid();
  const now = new Date().toISOString();
  const lookupKey = buildVenueLookupSK(venue, city);

  const command = new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      PK: `VENUE#${venueId}`,
      SK: 'META',
      GSI1PK: 'VENUE_LOOKUP',
      GSI1SK: lookupKey,
      venueId,
      name: venue,
      city,
      country,
      lat,
      lng,
      geocodeConfidence: confidence,
      manualOverride: false,
      createdAt: now,
      updatedAt: now,
    },
  });

  await docClient.send(command);
  return venueId;
}

interface EnrichmentStats {
  cached: number;
  geocoded: number;
  failed: number;
}

async function enrichWithGeocoding(tournaments: NormalizedTournament[]): Promise<{ tournaments: NormalizedTournament[]; stats: EnrichmentStats }> {
  const stats: EnrichmentStats = { cached: 0, geocoded: 0, failed: 0 };
  const enriched: NormalizedTournament[] = [];

  for (let i = 0; i < tournaments.length; i++) {
    const t = tournaments[i];
    const venueName = t.venue || t.city;

    process.stdout.write(`\rEnriching ${i + 1}/${tournaments.length} (cached: ${stats.cached}, geocoded: ${stats.geocoded}, failed: ${stats.failed})...`);

    // Check cache first
    const cached = await getVenueFromCache(venueName, t.city);
    if (cached) {
      stats.cached++;
      enriched.push({
        ...t,
        lat: cached.lat,
        lng: cached.lng,
        venueId: cached.venueId,
        geocodeConfidence: cached.geocodeConfidence,
      });
      continue;
    }

    // Geocode
    const result = await geocodeVenue(venueName, t.city, t.country);
    if (result) {
      stats.geocoded++;
      const venueId = await cacheVenue(venueName, t.city, t.country, result.lat, result.lng, result.confidence);
      enriched.push({
        ...t,
        lat: result.lat,
        lng: result.lng,
        venueId,
        geocodeConfidence: result.confidence,
      });
    } else {
      stats.failed++;
      enriched.push({
        ...t,
        lat: null,
        lng: null,
        venueId: null,
        geocodeConfidence: 'failed',
      });
    }

    // Rate limit: 50 requests/second max for Google Geocoding API
    await new Promise(resolve => setTimeout(resolve, 25));
  }

  console.log(''); // newline after progress
  return { tournaments: enriched, stats };
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

  if (!process.env.GOOGLE_MAPS_API_KEY) {
    console.error('ERROR: GOOGLE_MAPS_API_KEY environment variable not set');
    console.error('Set it with: export GOOGLE_MAPS_API_KEY=your-api-key');
    process.exit(1);
  }

  console.log('Fetching IBJJF tournaments...');
  const ibjjf = await fetchIBJJFTournaments();
  console.log(`Found ${ibjjf.length} IBJJF tournaments`);

  console.log('Fetching JJWL tournaments...');
  const jjwl = await fetchJJWLTournaments();
  console.log(`Found ${jjwl.length} JJWL tournaments`);

  const allTournaments = [...ibjjf, ...jjwl];
  console.log(`\nEnriching ${allTournaments.length} tournaments with geocoding...`);

  const { tournaments: enrichedTournaments, stats } = await enrichWithGeocoding(allTournaments);
  console.log(`Enrichment complete: ${stats.cached} cached, ${stats.geocoded} geocoded, ${stats.failed} failed`);

  console.log('\nSaving to DynamoDB...');
  const saved = await upsertTournaments(enrichedTournaments);
  console.log(`\nSaved ${saved} tournaments to ${TABLE_NAME}`);
}

main().catch(console.error);
