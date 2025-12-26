# Filter Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add distance-based filtering with geocoded venues, mobile-friendly preset buttons, and URL-synced filter state.

**Architecture:** Google Maps Geocoding enriches tournaments with lat/lng during sync, cached by venue. Frontend filters by distance client-side after fetching date-range-filtered results. All filter state syncs to URL params.

**Tech Stack:** Google Maps Geocoding API, DynamoDB (venue cache), React Query, Zustand (optional), Next.js URL params.

---

## Phase 1: Backend Foundation

### Task 1: Add VenueItem type

**Files:**
- Modify: `backend/src/db/types.ts`

**Step 1: Add VenueItem interface**

Add after `WishlistItem` interface (~line 70):

```typescript
export interface VenueItem {
  PK: string; // VENUE#<ulid>
  SK: 'META';
  GSI1PK: 'VENUE_LOOKUP';
  GSI1SK: string; // <normalizedVenue>#<normalizedCity>
  venueId: string;
  name: string;
  city: string;
  country: string | null;
  lat: number;
  lng: number;
  geocodeConfidence: 'high' | 'low';
  manualOverride: boolean;
  createdAt: string;
  updatedAt: string;
}
```

**Step 2: Add to DynamoDBItem union**

Update the union type:

```typescript
export type DynamoDBItem =
  | TournamentItem
  | UserProfileItem
  | AthleteItem
  | WishlistItem
  | VenueItem;
```

**Step 3: Add key builder**

Add after `buildWishlistSK`:

```typescript
export const buildVenuePK = (venueId: string): string =>
  `VENUE#${venueId}`;

export const buildVenueLookupSK = (venue: string, city: string): string =>
  `${venue.toLowerCase().trim()}#${city.toLowerCase().trim()}`;
```

**Step 4: Run type check**

Run: `cd backend && npx tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add backend/src/db/types.ts
git commit -m "feat(db): add VenueItem type for geocode caching"
```

---

### Task 2: Add geocoding fields to TournamentItem

**Files:**
- Modify: `backend/src/db/types.ts`

**Step 1: Add geocoding fields to TournamentItem**

Update TournamentItem interface (add after `bannerUrl` field, ~line 31):

```typescript
export interface TournamentItem {
  PK: string;
  SK: 'META';
  GSI1PK: 'TOURNAMENTS';
  GSI1SK: string;
  org: 'IBJJF' | 'JJWL';
  externalId: string;
  name: string;
  city: string;
  venue: string | null;
  country: string | null;
  startDate: string;
  endDate: string;
  gi: boolean;
  nogi: boolean;
  kids: boolean;
  registrationUrl: string | null;
  bannerUrl: string | null;
  // Geocoding fields
  lat: number | null;
  lng: number | null;
  venueId: string | null;
  geocodeConfidence: 'high' | 'low' | 'failed' | null;
  createdAt: string;
  updatedAt: string;
}
```

**Step 2: Run type check**

Run: `cd backend && npx tsc --noEmit`
Expected: Errors in files that create TournamentItems (we'll fix in next tasks)

**Step 3: Commit**

```bash
git add backend/src/db/types.ts
git commit -m "feat(db): add geocoding fields to TournamentItem"
```

---

### Task 3: Update NormalizedTournament type

**Files:**
- Modify: `backend/src/fetchers/types.ts`

**Step 1: Read current file**

Read `backend/src/fetchers/types.ts` to see current structure.

**Step 2: Add optional geocoding fields**

Add to NormalizedTournament interface:

```typescript
export interface NormalizedTournament {
  org: 'IBJJF' | 'JJWL';
  externalId: string;
  name: string;
  city: string;
  venue: string | null;
  country: string | null;
  startDate: string;
  endDate: string;
  gi: boolean;
  nogi: boolean;
  kids: boolean;
  registrationUrl: string | null;
  bannerUrl: string | null;
  // Optional geocoding fields (added during sync enrichment)
  lat?: number | null;
  lng?: number | null;
  venueId?: string | null;
  geocodeConfidence?: 'high' | 'low' | 'failed' | null;
}
```

**Step 3: Run type check**

Run: `cd backend && npx tsc --noEmit`
Expected: No new errors

**Step 4: Commit**

```bash
git add backend/src/fetchers/types.ts
git commit -m "feat(fetchers): add optional geocoding fields to NormalizedTournament"
```

---

### Task 4: Create geocoder service with tests

**Files:**
- Create: `backend/src/services/geocoder.ts`
- Create: `backend/src/__tests__/services/geocoder.test.ts`

**Step 1: Write the failing test**

Create `backend/src/__tests__/services/geocoder.test.ts`:

```typescript
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { geocodeVenue, type GeocodeResult } from '../../services/geocoder.js';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('geocodeVenue', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GOOGLE_MAPS_API_KEY = 'test-api-key';
  });

  it('returns high confidence for rooftop result', async () => {
    mockedAxios.get.mockResolvedValue({
      data: {
        status: 'OK',
        results: [
          {
            geometry: {
              location: { lat: 35.1495, lng: -90.0490 },
              location_type: 'ROOFTOP',
            },
            formatted_address: 'Memphis Cook Convention Center, Memphis, TN, USA',
          },
        ],
      },
    });

    const result = await geocodeVenue('Memphis Cook Convention Center', 'Memphis', 'USA');

    expect(result).toEqual({
      lat: 35.1495,
      lng: -90.0490,
      confidence: 'high',
      formattedAddress: 'Memphis Cook Convention Center, Memphis, TN, USA',
    });
  });

  it('returns low confidence for approximate result', async () => {
    mockedAxios.get.mockResolvedValue({
      data: {
        status: 'OK',
        results: [
          {
            geometry: {
              location: { lat: 35.15, lng: -90.05 },
              location_type: 'APPROXIMATE',
            },
            formatted_address: 'Memphis, TN, USA',
          },
        ],
      },
    });

    const result = await geocodeVenue('Unknown Venue', 'Memphis', 'USA');

    expect(result?.confidence).toBe('low');
  });

  it('returns null for zero results', async () => {
    mockedAxios.get.mockResolvedValue({
      data: { status: 'ZERO_RESULTS', results: [] },
    });

    const result = await geocodeVenue('Nonexistent Place', 'Nowhere', null);

    expect(result).toBeNull();
  });

  it('builds query with country when provided', async () => {
    mockedAxios.get.mockResolvedValue({
      data: { status: 'ZERO_RESULTS', results: [] },
    });

    await geocodeVenue('Some Venue', 'Memphis', 'USA');

    expect(mockedAxios.get).toHaveBeenCalledWith(
      expect.stringContaining('address=Some+Venue%2C+Memphis%2C+USA')
    );
  });

  it('builds query without country when null', async () => {
    mockedAxios.get.mockResolvedValue({
      data: { status: 'ZERO_RESULTS', results: [] },
    });

    await geocodeVenue('Some Venue', 'Memphis', null);

    expect(mockedAxios.get).toHaveBeenCalledWith(
      expect.stringContaining('address=Some+Venue%2C+Memphis')
    );
    expect(mockedAxios.get).not.toHaveBeenCalledWith(
      expect.stringContaining('null')
    );
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd backend && npm test -- geocoder.test.ts`
Expected: FAIL - module not found

**Step 3: Write minimal implementation**

Create `backend/src/services/geocoder.ts`:

```typescript
import axios from 'axios';

export interface GeocodeResult {
  lat: number;
  lng: number;
  confidence: 'high' | 'low';
  formattedAddress: string;
}

interface GoogleGeocodeResponse {
  status: string;
  results: Array<{
    geometry: {
      location: { lat: number; lng: number };
      location_type: 'ROOFTOP' | 'RANGE_INTERPOLATED' | 'GEOMETRIC_CENTER' | 'APPROXIMATE';
    };
    formatted_address: string;
  }>;
}

export async function geocodeVenue(
  venue: string,
  city: string,
  country: string | null
): Promise<GeocodeResult | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.error('GOOGLE_MAPS_API_KEY not set');
    return null;
  }

  const addressParts = [venue, city];
  if (country) {
    addressParts.push(country);
  }
  const address = addressParts.join(', ');

  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;

  try {
    const response = await axios.get<GoogleGeocodeResponse>(url);

    if (response.data.status !== 'OK' || response.data.results.length === 0) {
      return null;
    }

    const result = response.data.results[0];
    const { location, location_type } = result.geometry;

    const isHighConfidence =
      location_type === 'ROOFTOP' || location_type === 'RANGE_INTERPOLATED';

    return {
      lat: location.lat,
      lng: location.lng,
      confidence: isHighConfidence ? 'high' : 'low',
      formattedAddress: result.formatted_address,
    };
  } catch (error) {
    console.error('Geocoding failed:', error instanceof Error ? error.message : error);
    return null;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `cd backend && npm test -- geocoder.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/src/services/geocoder.ts backend/src/__tests__/services/geocoder.test.ts
git commit -m "feat(geocoder): add Google Maps geocoding service with tests"
```

---

### Task 5: Create venue cache queries

**Files:**
- Modify: `backend/src/db/queries.ts`
- Create: `backend/src/__tests__/db/venueCache.test.ts`

**Step 1: Write the failing test**

Create `backend/src/__tests__/db/venueCache.test.ts`:

```typescript
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { getVenueByLookup, upsertVenue } from '../../db/queries.js';
import type { VenueItem } from '../../db/types.js';

// Mock the DynamoDB client
jest.mock('../../db/client.js', () => ({
  docClient: {
    send: jest.fn(),
  },
  TABLE_NAME: 'test-table',
  GSI1_NAME: 'GSI1',
}));

describe('venue cache queries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getVenueByLookup', () => {
    it('returns venue when found', async () => {
      const mockVenue: VenueItem = {
        PK: 'VENUE#123',
        SK: 'META',
        GSI1PK: 'VENUE_LOOKUP',
        GSI1SK: 'memphis cook convention center#memphis',
        venueId: '123',
        name: 'Memphis Cook Convention Center',
        city: 'Memphis',
        country: 'USA',
        lat: 35.15,
        lng: -90.05,
        geocodeConfidence: 'high',
        manualOverride: false,
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      };

      const { docClient } = await import('../../db/client.js');
      (docClient.send as jest.Mock).mockResolvedValue({ Items: [mockVenue] });

      const result = await getVenueByLookup('Memphis Cook Convention Center', 'Memphis');

      expect(result).toEqual(mockVenue);
    });

    it('returns null when not found', async () => {
      const { docClient } = await import('../../db/client.js');
      (docClient.send as jest.Mock).mockResolvedValue({ Items: [] });

      const result = await getVenueByLookup('Unknown Venue', 'Nowhere');

      expect(result).toBeNull();
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd backend && npm test -- venueCache.test.ts`
Expected: FAIL - getVenueByLookup is not exported

**Step 3: Add venue cache functions to queries.ts**

Add to `backend/src/db/queries.ts` (at the end of file):

```typescript
import { QueryCommand, BatchWriteCommand, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME, GSI1_NAME } from './client.js';
import { buildTournamentPK, buildVenuePK, buildVenueLookupSK } from './types.js';
import type { TournamentItem, VenueItem } from './types.js';
import type { NormalizedTournament } from '../fetchers/types.js';

// ... existing code ...

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
```

**Step 4: Update imports at top of queries.ts**

Make sure the imports include PutCommand and the new types:

```typescript
import { QueryCommand, BatchWriteCommand, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME, GSI1_NAME } from './client.js';
import { buildTournamentPK, buildVenuePK, buildVenueLookupSK } from './types.js';
import type { TournamentItem, VenueItem } from './types.js';
import type { NormalizedTournament } from '../fetchers/types.js';
```

**Step 5: Run test to verify it passes**

Run: `cd backend && npm test -- venueCache.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add backend/src/db/queries.ts backend/src/__tests__/db/venueCache.test.ts
git commit -m "feat(db): add venue cache queries"
```

---

### Task 6: Create venue enrichment service

**Files:**
- Create: `backend/src/services/venueEnrichment.ts`
- Create: `backend/src/__tests__/services/venueEnrichment.test.ts`

**Step 1: Write the failing test**

Create `backend/src/__tests__/services/venueEnrichment.test.ts`:

```typescript
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { enrichTournamentWithGeocode } from '../../services/venueEnrichment.js';
import * as queries from '../../db/queries.js';
import * as geocoder from '../../services/geocoder.js';
import type { NormalizedTournament } from '../../fetchers/types.js';

jest.mock('../../db/queries.js');
jest.mock('../../services/geocoder.js');

const mockQueries = queries as jest.Mocked<typeof queries>;
const mockGeocoder = geocoder as jest.Mocked<typeof geocoder>;

describe('enrichTournamentWithGeocode', () => {
  const baseTournament: NormalizedTournament = {
    org: 'IBJJF',
    externalId: '123',
    name: 'Test Open',
    city: 'Memphis',
    venue: 'Memphis Cook Convention Center',
    country: 'USA',
    startDate: '2025-03-15',
    endDate: '2025-03-16',
    gi: true,
    nogi: false,
    kids: true,
    registrationUrl: null,
    bannerUrl: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses cached venue when available', async () => {
    mockQueries.getVenueByLookup.mockResolvedValue({
      PK: 'VENUE#abc',
      SK: 'META',
      GSI1PK: 'VENUE_LOOKUP',
      GSI1SK: 'memphis cook convention center#memphis',
      venueId: 'abc',
      name: 'Memphis Cook Convention Center',
      city: 'Memphis',
      country: 'USA',
      lat: 35.15,
      lng: -90.05,
      geocodeConfidence: 'high',
      manualOverride: false,
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
    });

    const result = await enrichTournamentWithGeocode(baseTournament);

    expect(mockGeocoder.geocodeVenue).not.toHaveBeenCalled();
    expect(result.lat).toBe(35.15);
    expect(result.lng).toBe(-90.05);
    expect(result.venueId).toBe('abc');
  });

  it('geocodes and caches new venue', async () => {
    mockQueries.getVenueByLookup.mockResolvedValue(null);
    mockGeocoder.geocodeVenue.mockResolvedValue({
      lat: 35.15,
      lng: -90.05,
      confidence: 'high',
      formattedAddress: 'Memphis, TN, USA',
    });
    mockQueries.upsertVenue.mockResolvedValue(undefined);

    const result = await enrichTournamentWithGeocode(baseTournament);

    expect(mockGeocoder.geocodeVenue).toHaveBeenCalledWith(
      'Memphis Cook Convention Center',
      'Memphis',
      'USA'
    );
    expect(mockQueries.upsertVenue).toHaveBeenCalled();
    expect(result.lat).toBe(35.15);
    expect(result.geocodeConfidence).toBe('high');
  });

  it('handles geocode failure gracefully', async () => {
    mockQueries.getVenueByLookup.mockResolvedValue(null);
    mockGeocoder.geocodeVenue.mockResolvedValue(null);

    const result = await enrichTournamentWithGeocode(baseTournament);

    expect(result.lat).toBeNull();
    expect(result.lng).toBeNull();
    expect(result.geocodeConfidence).toBe('failed');
  });

  it('uses city as venue fallback when venue is null', async () => {
    mockQueries.getVenueByLookup.mockResolvedValue(null);
    mockGeocoder.geocodeVenue.mockResolvedValue({
      lat: 35.15,
      lng: -90.05,
      confidence: 'low',
      formattedAddress: 'Memphis, TN, USA',
    });
    mockQueries.upsertVenue.mockResolvedValue(undefined);

    const tournamentNoVenue = { ...baseTournament, venue: null };
    await enrichTournamentWithGeocode(tournamentNoVenue);

    expect(mockGeocoder.geocodeVenue).toHaveBeenCalledWith(
      'Memphis', // city used as fallback
      'Memphis',
      'USA'
    );
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd backend && npm test -- venueEnrichment.test.ts`
Expected: FAIL - module not found

**Step 3: Write implementation**

Create `backend/src/services/venueEnrichment.ts`:

```typescript
import { ulid } from 'ulid';
import { getVenueByLookup, upsertVenue } from '../db/queries.js';
import { geocodeVenue } from './geocoder.js';
import type { NormalizedTournament } from '../fetchers/types.js';

export interface EnrichmentStats {
  cached: number;
  geocoded: number;
  failed: number;
  lowConfidence: number;
}

export async function enrichTournamentWithGeocode(
  tournament: NormalizedTournament
): Promise<NormalizedTournament> {
  const venueName = tournament.venue || tournament.city;
  const city = tournament.city;

  // Check cache first
  const cachedVenue = await getVenueByLookup(venueName, city);

  if (cachedVenue) {
    return {
      ...tournament,
      lat: cachedVenue.lat,
      lng: cachedVenue.lng,
      venueId: cachedVenue.venueId,
      geocodeConfidence: cachedVenue.geocodeConfidence,
    };
  }

  // Geocode the venue
  const geocodeResult = await geocodeVenue(venueName, city, tournament.country);

  if (!geocodeResult) {
    return {
      ...tournament,
      lat: null,
      lng: null,
      venueId: null,
      geocodeConfidence: 'failed',
    };
  }

  // Cache the result
  const venueId = ulid();
  const now = new Date().toISOString();

  await upsertVenue({
    venueId,
    name: venueName,
    city,
    country: tournament.country,
    lat: geocodeResult.lat,
    lng: geocodeResult.lng,
    geocodeConfidence: geocodeResult.confidence,
    manualOverride: false,
    createdAt: now,
    updatedAt: now,
  });

  return {
    ...tournament,
    lat: geocodeResult.lat,
    lng: geocodeResult.lng,
    venueId,
    geocodeConfidence: geocodeResult.confidence,
  };
}

export async function enrichTournamentsWithGeocode(
  tournaments: NormalizedTournament[]
): Promise<{ tournaments: NormalizedTournament[]; stats: EnrichmentStats }> {
  const stats: EnrichmentStats = {
    cached: 0,
    geocoded: 0,
    failed: 0,
    lowConfidence: 0,
  };

  const enriched: NormalizedTournament[] = [];

  for (const tournament of tournaments) {
    const venueName = tournament.venue || tournament.city;
    const cachedVenue = await getVenueByLookup(venueName, tournament.city);

    if (cachedVenue) {
      stats.cached++;
      enriched.push({
        ...tournament,
        lat: cachedVenue.lat,
        lng: cachedVenue.lng,
        venueId: cachedVenue.venueId,
        geocodeConfidence: cachedVenue.geocodeConfidence,
      });
    } else {
      const result = await enrichTournamentWithGeocode(tournament);
      enriched.push(result);

      if (result.geocodeConfidence === 'failed') {
        stats.failed++;
      } else {
        stats.geocoded++;
        if (result.geocodeConfidence === 'low') {
          stats.lowConfidence++;
        }
      }
    }
  }

  return { tournaments: enriched, stats };
}
```

**Step 4: Run test to verify it passes**

Run: `cd backend && npm test -- venueEnrichment.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/src/services/venueEnrichment.ts backend/src/__tests__/services/venueEnrichment.test.ts
git commit -m "feat(enrichment): add venue geocode enrichment service"
```

---

### Task 7: Update syncService to enrich tournaments

**Files:**
- Modify: `backend/src/services/syncService.ts`
- Modify: `backend/src/__tests__/services/syncService.test.ts`

**Step 1: Update syncService.ts**

Replace content of `backend/src/services/syncService.ts`:

```typescript
import { fetchIBJJFTournaments } from '../fetchers/ibjjfFetcher.js';
import { fetchJJWLTournaments } from '../fetchers/jjwlFetcher.js';
import { upsertTournaments } from '../db/queries.js';
import { enrichTournamentsWithGeocode, type EnrichmentStats } from './venueEnrichment.js';
import type { NormalizedTournament } from '../fetchers/types.js';

export interface SourceResult {
  fetched: number;
  saved: number;
  error?: string;
  enrichment?: EnrichmentStats;
}

export interface SyncResult {
  ibjjf: SourceResult;
  jjwl: SourceResult;
}

export interface SyncOptions {
  dryRun?: boolean;
  skipEnrichment?: boolean;
}

async function fetchSource(
  name: string,
  fetcher: () => Promise<NormalizedTournament[]>,
  options: SyncOptions
): Promise<SourceResult> {
  try {
    const tournaments = await fetcher();
    const fetched = tournaments.length;

    if (options.dryRun) {
      return { fetched, saved: 0 };
    }

    // Enrich with geocoding unless skipped
    let enrichedTournaments = tournaments;
    let enrichmentStats: EnrichmentStats | undefined;

    if (!options.skipEnrichment) {
      const enrichResult = await enrichTournamentsWithGeocode(tournaments);
      enrichedTournaments = enrichResult.tournaments;
      enrichmentStats = enrichResult.stats;

      console.log(`${name} enrichment:`, enrichmentStats);
    }

    const saved = await upsertTournaments(enrichedTournaments);
    return { fetched, saved, enrichment: enrichmentStats };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Failed to sync ${name}:`, message);
    return { fetched: 0, saved: 0, error: message };
  }
}

export async function syncAllTournaments(
  options: SyncOptions = {}
): Promise<SyncResult> {
  const [ibjjf, jjwl] = await Promise.all([
    fetchSource('IBJJF', fetchIBJJFTournaments, options),
    fetchSource('JJWL', fetchJJWLTournaments, options),
  ]);

  return { ibjjf, jjwl };
}
```

**Step 2: Update existing test to mock enrichment**

Update `backend/src/__tests__/services/syncService.test.ts` to add mock:

```typescript
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { syncAllTournaments } from '../../services/syncService.js';
import * as ibjjfFetcher from '../../fetchers/ibjjfFetcher.js';
import * as jjwlFetcher from '../../fetchers/jjwlFetcher.js';
import type { NormalizedTournament } from '../../fetchers/types.js';

// Mock the fetchers
jest.mock('../../fetchers/ibjjfFetcher.js');
jest.mock('../../fetchers/jjwlFetcher.js');

// Mock enrichment to pass through
jest.mock('../../services/venueEnrichment.js', () => ({
  enrichTournamentsWithGeocode: jest.fn((tournaments: NormalizedTournament[]) =>
    Promise.resolve({
      tournaments: tournaments.map((t) => ({ ...t, lat: null, lng: null })),
      stats: { cached: 0, geocoded: 0, failed: 0, lowConfidence: 0 },
    })
  ),
}));

const mockTournament: NormalizedTournament = {
  org: 'IBJJF',
  externalId: '123',
  name: 'Test Tournament',
  city: 'Test City',
  venue: null,
  country: null,
  startDate: '2025-03-15',
  endDate: '2025-03-17',
  gi: true,
  nogi: false,
  kids: false,
  registrationUrl: null,
  bannerUrl: null,
};

describe('syncAllTournaments', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches from both sources', async () => {
    const ibjjfMock = jest.spyOn(ibjjfFetcher, 'fetchIBJJFTournaments');
    const jjwlMock = jest.spyOn(jjwlFetcher, 'fetchJJWLTournaments');

    ibjjfMock.mockResolvedValue([mockTournament]);
    jjwlMock.mockResolvedValue([{ ...mockTournament, org: 'JJWL' as const }]);

    const result = await syncAllTournaments({ dryRun: true });

    expect(ibjjfMock).toHaveBeenCalled();
    expect(jjwlMock).toHaveBeenCalled();
    expect(result.ibjjf.fetched).toBe(1);
    expect(result.jjwl.fetched).toBe(1);
  });

  it('continues if IBJJF fails', async () => {
    const ibjjfMock = jest.spyOn(ibjjfFetcher, 'fetchIBJJFTournaments');
    const jjwlMock = jest.spyOn(jjwlFetcher, 'fetchJJWLTournaments');

    ibjjfMock.mockRejectedValue(new Error('API Error'));
    jjwlMock.mockResolvedValue([{ ...mockTournament, org: 'JJWL' as const }]);

    const result = await syncAllTournaments({ dryRun: true });

    expect(result.ibjjf.error).toBe('API Error');
    expect(result.jjwl.fetched).toBe(1);
  });

  it('continues if JJWL fails', async () => {
    const ibjjfMock = jest.spyOn(ibjjfFetcher, 'fetchIBJJFTournaments');
    const jjwlMock = jest.spyOn(jjwlFetcher, 'fetchJJWLTournaments');

    ibjjfMock.mockResolvedValue([mockTournament]);
    jjwlMock.mockRejectedValue(new Error('API Error'));

    const result = await syncAllTournaments({ dryRun: true });

    expect(result.ibjjf.fetched).toBe(1);
    expect(result.jjwl.error).toBe('API Error');
  });
});
```

**Step 3: Run tests**

Run: `cd backend && npm test -- syncService.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add backend/src/services/syncService.ts backend/src/__tests__/services/syncService.test.ts
git commit -m "feat(sync): integrate geocode enrichment into sync flow"
```

---

### Task 8: Update upsertTournaments for new fields

**Files:**
- Modify: `backend/src/db/queries.ts`

**Step 1: Update upsertTournaments function**

The current upsertTournaments uses spread operator which will include the new fields. Verify it works by checking the type:

```typescript
// In upsertTournaments, the spread ...t already includes new fields
// Just ensure the Item satisfies TournamentItem
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
```

**Step 2: Run type check**

Run: `cd backend && npx tsc --noEmit`
Expected: No errors

**Step 3: Run all tests**

Run: `cd backend && npm test`
Expected: All tests pass

**Step 4: Commit**

```bash
git add backend/src/db/queries.ts
git commit -m "fix(db): ensure geocoding fields have defaults in upsert"
```

---

## Phase 2: API Updates

### Task 9: Add distance calculation utility

**Files:**
- Create: `backend/src/utils/distance.ts`
- Create: `backend/src/__tests__/utils/distance.test.ts`

**Step 1: Write the failing test**

Create `backend/src/__tests__/utils/distance.test.ts`:

```typescript
import { describe, it, expect } from '@jest/globals';
import { haversineDistance, filterByDistance } from '../../utils/distance.js';

describe('haversineDistance', () => {
  it('calculates distance between two points correctly', () => {
    // Dallas to Houston is approximately 225 miles
    const dallas = { lat: 32.7767, lng: -96.7970 };
    const houston = { lat: 29.7604, lng: -95.3698 };

    const distance = haversineDistance(dallas.lat, dallas.lng, houston.lat, houston.lng);

    expect(distance).toBeGreaterThan(220);
    expect(distance).toBeLessThan(240);
  });

  it('returns 0 for same point', () => {
    const distance = haversineDistance(32.7767, -96.7970, 32.7767, -96.7970);
    expect(distance).toBe(0);
  });
});

describe('filterByDistance', () => {
  const tournaments = [
    { id: '1', lat: 32.7767, lng: -96.7970 }, // Dallas
    { id: '2', lat: 29.7604, lng: -95.3698 }, // Houston (~225mi from Dallas)
    { id: '3', lat: 30.2672, lng: -97.7431 }, // Austin (~195mi from Dallas)
    { id: '4', lat: null, lng: null },        // No location
  ];

  it('filters tournaments within radius', () => {
    const result = filterByDistance(tournaments, 32.7767, -96.7970, 200);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('3'); // Only Austin is within 200mi
  });

  it('includes all within large radius', () => {
    const result = filterByDistance(tournaments, 32.7767, -96.7970, 300);

    expect(result).toHaveLength(3); // Dallas, Houston, Austin (not null one)
  });

  it('excludes tournaments without coordinates', () => {
    const result = filterByDistance(tournaments, 32.7767, -96.7970, 1000);

    expect(result.every((t) => t.lat !== null)).toBe(true);
  });

  it('adds distanceMiles to results', () => {
    const result = filterByDistance(tournaments, 32.7767, -96.7970, 300);

    expect(result[0].distanceMiles).toBeDefined();
    expect(typeof result[0].distanceMiles).toBe('number');
  });

  it('sorts by distance ascending', () => {
    const result = filterByDistance(tournaments, 32.7767, -96.7970, 300);

    for (let i = 1; i < result.length; i++) {
      expect(result[i].distanceMiles).toBeGreaterThanOrEqual(result[i - 1].distanceMiles!);
    }
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd backend && npm test -- distance.test.ts`
Expected: FAIL - module not found

**Step 3: Write implementation**

Create `backend/src/utils/distance.ts`:

```typescript
/**
 * Calculate distance between two points using Haversine formula
 * @returns Distance in miles
 */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 3959; // Earth's radius in miles

  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

interface WithLocation {
  lat: number | null;
  lng: number | null;
}

interface WithDistance {
  distanceMiles: number;
}

/**
 * Filter items by distance from a point
 * @returns Filtered items with distanceMiles added, sorted by distance
 */
export function filterByDistance<T extends WithLocation>(
  items: T[],
  userLat: number,
  userLng: number,
  radiusMiles: number
): (T & WithDistance)[] {
  return items
    .filter((item): item is T & { lat: number; lng: number } =>
      item.lat !== null && item.lng !== null
    )
    .map((item) => ({
      ...item,
      distanceMiles: Math.round(haversineDistance(userLat, userLng, item.lat, item.lng)),
    }))
    .filter((item) => item.distanceMiles <= radiusMiles)
    .sort((a, b) => a.distanceMiles - b.distanceMiles);
}
```

**Step 4: Run test to verify it passes**

Run: `cd backend && npm test -- distance.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/src/utils/distance.ts backend/src/__tests__/utils/distance.test.ts
git commit -m "feat(utils): add Haversine distance calculation"
```

---

### Task 10: Update tournamentService for distance filtering

**Files:**
- Modify: `backend/src/services/tournamentService.ts`
- Modify: `backend/src/__tests__/services/tournamentService.test.ts`

**Step 1: Update the filters schema**

In `backend/src/services/tournamentService.ts`, update the schema:

```typescript
const filtersSchema = z.object({
  org: z.enum(['IBJJF', 'JJWL']).optional(),
  startAfter: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  startBefore: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  city: z.string().min(1).optional(),
  gi: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  nogi: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  kids: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  search: z.string().min(1).optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  // New location params
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radiusMiles: z.coerce.number().min(1).max(1000).optional(),
});
```

**Step 2: Update TournamentResponse**

```typescript
export interface TournamentResponse {
  id: string;
  org: 'IBJJF' | 'JJWL';
  externalId: string;
  name: string;
  city: string;
  venue: string | null;
  country: string | null;
  startDate: string;
  endDate: string;
  gi: boolean;
  nogi: boolean;
  kids: boolean;
  registrationUrl: string | null;
  bannerUrl: string | null;
  lat: number | null;
  lng: number | null;
  distanceMiles?: number;
}
```

**Step 3: Update formatTournamentResponse**

```typescript
export function formatTournamentResponse(
  item: TournamentItem,
  distanceMiles?: number
): TournamentResponse {
  return {
    id: item.PK,
    org: item.org,
    externalId: item.externalId,
    name: item.name,
    city: item.city,
    venue: item.venue,
    country: item.country,
    startDate: item.startDate,
    endDate: item.endDate,
    gi: item.gi,
    nogi: item.nogi,
    kids: item.kids,
    registrationUrl: item.registrationUrl,
    bannerUrl: item.bannerUrl,
    lat: item.lat,
    lng: item.lng,
    ...(distanceMiles !== undefined && { distanceMiles }),
  };
}
```

**Step 4: Update listTournaments**

```typescript
import { filterByDistance } from '../utils/distance.js';

export async function listTournaments(
  params: Record<string, string | undefined>,
  lastKey?: string
): Promise<{
  tournaments: TournamentResponse[];
  nextCursor?: string;
}> {
  const filters = validateTournamentFilters(params);
  const { lat, lng, radiusMiles, ...dbFilters } = filters;
  const parsedLastKey = lastKey ? JSON.parse(Buffer.from(lastKey, 'base64').toString()) : undefined;

  // For distance queries, we need to fetch more and filter client-side
  const fetchLimit = lat && lng && radiusMiles ? 500 : filters.limit;

  const { items, lastKey: newLastKey } = await queryTournaments(
    dbFilters,
    fetchLimit,
    parsedLastKey
  );

  let tournaments: TournamentResponse[];

  if (lat && lng && radiusMiles) {
    // Apply distance filtering
    const withDistance = filterByDistance(items, lat, lng, radiusMiles);
    tournaments = withDistance.map((item) =>
      formatTournamentResponse(item, item.distanceMiles)
    );
    // Limit after distance filtering
    tournaments = tournaments.slice(0, filters.limit);
  } else {
    tournaments = items.map((item) => formatTournamentResponse(item));
  }

  return {
    tournaments,
    // Don't return cursor for distance queries (we fetch all and filter)
    nextCursor:
      !lat && newLastKey
        ? Buffer.from(JSON.stringify(newLastKey)).toString('base64')
        : undefined,
  };
}
```

**Step 5: Run type check**

Run: `cd backend && npx tsc --noEmit`
Expected: No errors

**Step 6: Run tests**

Run: `cd backend && npm test`
Expected: All tests pass

**Step 7: Commit**

```bash
git add backend/src/services/tournamentService.ts
git commit -m "feat(api): add distance-based filtering to tournament list"
```

---

### Task 11: Update frontend types

**Files:**
- Modify: `frontend/src/lib/types.ts`

**Step 1: Update Tournament interface**

```typescript
export interface Tournament {
  id: string;
  org: 'IBJJF' | 'JJWL';
  externalId: string;
  name: string;
  city: string;
  venue: string | null;
  country: string | null;
  startDate: string;
  endDate: string;
  gi: boolean;
  nogi: boolean;
  kids: boolean;
  registrationUrl: string | null;
  bannerUrl: string | null;
  lat: number | null;
  lng: number | null;
  distanceMiles?: number;
}
```

**Step 2: Update TournamentFilters interface**

```typescript
export interface TournamentFilters {
  org?: 'IBJJF' | 'JJWL';
  startAfter?: string;
  startBefore?: string;
  gi?: boolean;
  nogi?: boolean;
  kids?: boolean;
  // Location-based filtering
  lat?: number;
  lng?: number;
  radiusMiles?: number;
}
```

**Step 3: Run type check**

Run: `cd frontend && npx tsc --noEmit`
Expected: Some errors in TournamentFilters (search/city removed) - we'll fix in next phase

**Step 4: Commit**

```bash
git add frontend/src/lib/types.ts
git commit -m "feat(frontend): update types for distance filtering"
```

---

## Phase 3: Frontend Filter UI

### Task 12: Create useGeolocation hook

**Files:**
- Create: `frontend/src/hooks/useGeolocation.ts`

**Step 1: Create the hook**

```typescript
'use client';

import { useState, useCallback } from 'react';

interface GeolocationState {
  lat: number | null;
  lng: number | null;
  label: string | null;
  loading: boolean;
  error: string | null;
}

interface UseGeolocationReturn extends GeolocationState {
  requestLocation: () => void;
  setManualLocation: (lat: number, lng: number, label: string) => void;
  clearLocation: () => void;
}

const STORAGE_KEY = 'bjj-tracker-location';

function loadFromStorage(): Pick<GeolocationState, 'lat' | 'lng' | 'label'> | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

function saveToStorage(lat: number, lng: number, label: string): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ lat, lng, label }));
}

function clearStorage(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function useGeolocation(): UseGeolocationReturn {
  const stored = loadFromStorage();

  const [state, setState] = useState<GeolocationState>({
    lat: stored?.lat ?? null,
    lng: stored?.lng ?? null,
    label: stored?.label ?? null,
    loading: false,
    error: null,
  });

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setState((prev) => ({ ...prev, error: 'Geolocation not supported' }));
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;

        // Reverse geocode to get city name (using free Nominatim API)
        let label = 'Current location';
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
          );
          const data = await response.json();
          const city = data.address?.city || data.address?.town || data.address?.village;
          const state = data.address?.state;
          if (city && state) {
            label = `${city}, ${state}`;
          } else if (city) {
            label = city;
          }
        } catch {
          // Use fallback label
        }

        saveToStorage(latitude, longitude, label);
        setState({
          lat: latitude,
          lng: longitude,
          label,
          loading: false,
          error: null,
        });
      },
      (error) => {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: error.message,
        }));
      },
      { enableHighAccuracy: false, timeout: 10000 }
    );
  }, []);

  const setManualLocation = useCallback((lat: number, lng: number, label: string) => {
    saveToStorage(lat, lng, label);
    setState({
      lat,
      lng,
      label,
      loading: false,
      error: null,
    });
  }, []);

  const clearLocation = useCallback(() => {
    clearStorage();
    setState({
      lat: null,
      lng: null,
      label: null,
      loading: false,
      error: null,
    });
  }, []);

  return {
    ...state,
    requestLocation,
    setManualLocation,
    clearLocation,
  };
}
```

**Step 2: Run type check**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors in this file

**Step 3: Commit**

```bash
git add frontend/src/hooks/useGeolocation.ts
git commit -m "feat(frontend): add useGeolocation hook with localStorage persistence"
```

---

### Task 13: Create useFilterParams hook

**Files:**
- Create: `frontend/src/hooks/useFilterParams.ts`

**Step 1: Create the hook**

```typescript
'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import type { TournamentFilters } from '@/lib/types';

type DatePreset = 'month' | '30' | '60' | '90' | 'year';
type DistancePreset = 50 | 100 | 250 | 'any';

interface FilterState extends TournamentFilters {
  datePreset: DatePreset;
  distancePreset: DistancePreset;
}

function getDateRange(preset: DatePreset): { startAfter: string; startBefore: string } {
  const now = new Date();
  const startAfter = now.toISOString().split('T')[0];

  let endDate: Date;

  switch (preset) {
    case 'month':
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      break;
    case '30':
      endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      break;
    case '60':
      endDate = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
      break;
    case '90':
      endDate = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
      break;
    case 'year':
      endDate = new Date(now.getFullYear(), 11, 31);
      break;
  }

  return {
    startAfter,
    startBefore: endDate.toISOString().split('T')[0],
  };
}

function getRadiusMiles(preset: DistancePreset): number | undefined {
  return preset === 'any' ? undefined : preset;
}

export function useFilterParams() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const state = useMemo((): FilterState => {
    const datePreset = (searchParams.get('date') as DatePreset) || '30';
    const distancePreset = searchParams.get('d')
      ? (parseInt(searchParams.get('d')!) as DistancePreset)
      : 'any';

    const { startAfter, startBefore } = getDateRange(datePreset);

    return {
      org: (searchParams.get('org') as 'IBJJF' | 'JJWL') || undefined,
      gi: searchParams.get('gi') === '1' ? true : undefined,
      nogi: searchParams.get('nogi') === '1' ? true : undefined,
      kids: searchParams.get('kids') === '1' ? true : undefined,
      lat: searchParams.get('lat') ? parseFloat(searchParams.get('lat')!) : undefined,
      lng: searchParams.get('lng') ? parseFloat(searchParams.get('lng')!) : undefined,
      radiusMiles: getRadiusMiles(distancePreset),
      startAfter,
      startBefore,
      datePreset,
      distancePreset,
    };
  }, [searchParams]);

  const updateParams = useCallback(
    (updates: Partial<Record<string, string | undefined>>) => {
      const params = new URLSearchParams(searchParams.toString());

      Object.entries(updates).forEach(([key, value]) => {
        if (value === undefined || value === '') {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      });

      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [searchParams, router, pathname]
  );

  const setDatePreset = useCallback(
    (preset: DatePreset) => {
      updateParams({ date: preset });
    },
    [updateParams]
  );

  const setDistancePreset = useCallback(
    (preset: DistancePreset) => {
      updateParams({ d: preset === 'any' ? undefined : String(preset) });
    },
    [updateParams]
  );

  const setLocation = useCallback(
    (lat: number, lng: number) => {
      updateParams({ lat: String(lat), lng: String(lng) });
    },
    [updateParams]
  );

  const clearLocation = useCallback(() => {
    updateParams({ lat: undefined, lng: undefined, d: undefined });
  }, [updateParams]);

  const toggleFormat = useCallback(
    (format: 'gi' | 'nogi' | 'kids') => {
      const current = searchParams.get(format) === '1';
      updateParams({ [format]: current ? undefined : '1' });
    },
    [searchParams, updateParams]
  );

  const setOrg = useCallback(
    (org: 'IBJJF' | 'JJWL' | undefined) => {
      updateParams({ org });
    },
    [updateParams]
  );

  const clearAll = useCallback(() => {
    router.push(pathname, { scroll: false });
  }, [router, pathname]);

  return {
    filters: state,
    setDatePreset,
    setDistancePreset,
    setLocation,
    clearLocation,
    toggleFormat,
    setOrg,
    clearAll,
  };
}
```

**Step 2: Run type check**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add frontend/src/hooks/useFilterParams.ts
git commit -m "feat(frontend): add useFilterParams hook for URL-synced filters"
```

---

### Task 14: Create PresetButton component

**Files:**
- Create: `frontend/src/components/ui/preset-button.tsx`

**Step 1: Create the component**

```typescript
'use client';

import { cn } from '@/lib/utils';

interface PresetButtonProps<T extends string | number> {
  value: T;
  label: string;
  selected: boolean;
  onClick: (value: T) => void;
  disabled?: boolean;
}

export function PresetButton<T extends string | number>({
  value,
  label,
  selected,
  onClick,
  disabled = false,
}: PresetButtonProps<T>) {
  return (
    <button
      type="button"
      onClick={() => onClick(value)}
      disabled={disabled}
      className={cn(
        'px-3 py-1.5 text-sm font-medium rounded-lg transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0A0A1A]',
        selected
          ? 'bg-[#00F0FF]/20 text-[#00F0FF] border border-[#00F0FF]/30 focus:ring-[#00F0FF]/50'
          : 'bg-white/5 text-white/80 border border-white/10 hover:bg-white/10 focus:ring-white/20',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      {label}
    </button>
  );
}

interface PresetButtonGroupProps<T extends string | number> {
  options: Array<{ value: T; label: string }>;
  selected: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}

export function PresetButtonGroup<T extends string | number>({
  options,
  selected,
  onChange,
  disabled = false,
}: PresetButtonGroupProps<T>) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((option) => (
        <PresetButton
          key={String(option.value)}
          value={option.value}
          label={option.label}
          selected={selected === option.value}
          onClick={onChange}
          disabled={disabled}
        />
      ))}
    </div>
  );
}
```

**Step 2: Run type check**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add frontend/src/components/ui/preset-button.tsx
git commit -m "feat(ui): add PresetButton and PresetButtonGroup components"
```

---

### Task 15: Rewrite TournamentFilters component

**Files:**
- Modify: `frontend/src/components/tournaments/TournamentFilters.tsx`

**Step 1: Rewrite the component**

Replace the entire file:

```typescript
'use client';

import { MapPin, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PresetButtonGroup } from '@/components/ui/preset-button';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useFilterParams } from '@/hooks/useFilterParams';

const DATE_OPTIONS = [
  { value: 'month' as const, label: 'This Month' },
  { value: '30' as const, label: '30 Days' },
  { value: '60' as const, label: '60 Days' },
  { value: '90' as const, label: '90 Days' },
  { value: 'year' as const, label: 'This Year' },
];

const DISTANCE_OPTIONS = [
  { value: 50 as const, label: '50mi' },
  { value: 100 as const, label: '100mi' },
  { value: 250 as const, label: '250mi' },
  { value: 'any' as const, label: 'Any' },
];

export function TournamentFilters() {
  const geo = useGeolocation();
  const {
    filters,
    setDatePreset,
    setDistancePreset,
    setLocation,
    clearLocation,
    toggleFormat,
    setOrg,
    clearAll,
  } = useFilterParams();

  const handleNearMe = () => {
    geo.requestLocation();
  };

  // Sync geolocation to URL params when it updates
  if (geo.lat && geo.lng && (geo.lat !== filters.lat || geo.lng !== filters.lng)) {
    setLocation(geo.lat, geo.lng);
  }

  const hasLocation = filters.lat && filters.lng;
  const hasActiveFilters =
    filters.org ||
    filters.gi ||
    filters.nogi ||
    filters.kids ||
    hasLocation ||
    filters.datePreset !== '30';

  return (
    <div className="space-y-4 p-6 bg-[var(--glass-bg)] backdrop-blur-xl border border-[var(--glass-border)] rounded-2xl">
      {/* Location Section */}
      <div className="space-y-2">
        <span className="text-sm text-white/50">Location</span>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleNearMe}
            disabled={geo.loading}
            className={
              hasLocation
                ? 'bg-[#00F0FF]/20 text-[#00F0FF] border-[#00F0FF]/30'
                : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10'
            }
          >
            {geo.loading ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <MapPin className="h-4 w-4 mr-1.5" />
            )}
            {hasLocation ? geo.label || 'Near me' : 'Near me'}
          </Button>
          {hasLocation && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                geo.clearLocation();
                clearLocation();
              }}
              className="text-white/60 hover:text-white hover:bg-white/10"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
          {geo.error && (
            <span className="text-xs text-red-400">{geo.error}</span>
          )}
        </div>
      </div>

      {/* Distance Section */}
      <div className="space-y-2">
        <span className="text-sm text-white/50">Distance</span>
        <PresetButtonGroup
          options={DISTANCE_OPTIONS}
          selected={filters.distancePreset}
          onChange={setDistancePreset}
          disabled={!hasLocation}
        />
      </div>

      {/* Date Section */}
      <div className="space-y-2">
        <span className="text-sm text-white/50">Date</span>
        <PresetButtonGroup
          options={DATE_OPTIONS}
          selected={filters.datePreset}
          onChange={setDatePreset}
        />
      </div>

      {/* Format Section */}
      <div className="space-y-2">
        <span className="text-sm text-white/50">Format</span>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => toggleFormat('gi')}
              className={
                filters.gi
                  ? 'bg-[#00F0FF]/20 text-[#00F0FF] border-[#00F0FF]/30 hover:bg-[#00F0FF]/30'
                  : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10'
              }
            >
              GI
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => toggleFormat('nogi')}
              className={
                filters.nogi
                  ? 'bg-[#00F0FF]/20 text-[#00F0FF] border-[#00F0FF]/30 hover:bg-[#00F0FF]/30'
                  : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10'
              }
            >
              NOGI
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => toggleFormat('kids')}
              className={
                filters.kids
                  ? 'bg-[#00F0FF]/20 text-[#00F0FF] border-[#00F0FF]/30 hover:bg-[#00F0FF]/30'
                  : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10'
              }
            >
              Kids
            </Button>
          </div>

          <div className="h-6 w-px bg-white/10 hidden sm:block" />

          <div className="flex gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOrg(filters.org === 'IBJJF' ? undefined : 'IBJJF')}
              className={
                filters.org === 'IBJJF'
                  ? 'bg-[#00F0FF]/20 text-[#00F0FF] border-[#00F0FF]/30 hover:bg-[#00F0FF]/30'
                  : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10'
              }
            >
              IBJJF
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOrg(filters.org === 'JJWL' ? undefined : 'JJWL')}
              className={
                filters.org === 'JJWL'
                  ? 'bg-[#00F0FF]/20 text-[#00F0FF] border-[#00F0FF]/30 hover:bg-[#00F0FF]/30'
                  : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10'
              }
            >
              JJWL
            </Button>
          </div>
        </div>
      </div>

      {/* Clear Filters */}
      {hasActiveFilters && (
        <div className="pt-2 border-t border-white/10">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearAll}
            className="text-white/60 hover:text-white hover:bg-white/10"
          >
            <X className="h-4 w-4 mr-1" />
            Clear filters
          </Button>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Run type check**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add frontend/src/components/tournaments/TournamentFilters.tsx
git commit -m "feat(filters): rewrite TournamentFilters with distance and date presets"
```

---

### Task 16: Update tournaments page to use new filters

**Files:**
- Modify: `frontend/src/app/tournaments/page.tsx`

**Step 1: Read current page**

Read the file to understand current structure.

**Step 2: Update to use useFilterParams**

The page should use the filters from useFilterParams to pass to useTournaments:

```typescript
'use client';

import { Suspense } from 'react';
import { TournamentFilters } from '@/components/tournaments/TournamentFilters';
import { TournamentList } from '@/components/tournaments/TournamentList';
import { useFilterParams } from '@/hooks/useFilterParams';
import { useTournaments } from '@/hooks/useTournaments';

function TournamentsContent() {
  const { filters } = useFilterParams();

  // Build API filters from state
  const apiFilters = {
    org: filters.org,
    gi: filters.gi,
    nogi: filters.nogi,
    kids: filters.kids,
    startAfter: filters.startAfter,
    startBefore: filters.startBefore,
    lat: filters.lat,
    lng: filters.lng,
    radiusMiles: filters.radiusMiles,
  };

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
  } = useTournaments(apiFilters);

  const tournaments = data?.pages.flatMap((page) => page.tournaments) ?? [];

  return (
    <div className="space-y-6">
      <TournamentFilters />
      <TournamentList
        tournaments={tournaments}
        isLoading={isLoading}
        isError={isError}
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        onLoadMore={fetchNextPage}
      />
    </div>
  );
}

export default function TournamentsPage() {
  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold text-white mb-6">Tournaments</h1>
      <Suspense fallback={<div className="text-white/60">Loading...</div>}>
        <TournamentsContent />
      </Suspense>
    </main>
  );
}
```

**Step 3: Run type check and build**

Run: `cd frontend && npm run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add frontend/src/app/tournaments/page.tsx
git commit -m "feat(page): integrate new filter system into tournaments page"
```

---

## Phase 4: Admin Tooling

### Task 17: Create venue review CLI script

**Files:**
- Create: `backend/scripts/review-venues.ts`

**Step 1: Create the script**

```typescript
#!/usr/bin/env npx tsx

import { getLowConfidenceVenues, upsertVenue } from '../src/db/queries.js';
import * as readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, resolve));
}

async function main() {
  console.log('Fetching low-confidence venues...\n');

  const venues = await getLowConfidenceVenues();

  if (venues.length === 0) {
    console.log('No low-confidence venues found!');
    rl.close();
    return;
  }

  console.log(`Found ${venues.length} venues to review:\n`);

  for (const venue of venues) {
    console.log('─'.repeat(60));
    console.log(`Venue: ${venue.name}`);
    console.log(`City: ${venue.city}`);
    console.log(`Country: ${venue.country || 'Unknown'}`);
    console.log(`Coordinates: ${venue.lat}, ${venue.lng}`);
    console.log(`Confidence: ${venue.geocodeConfidence}`);
    console.log(`\nView on Google Maps:`);
    console.log(`https://www.google.com/maps?q=${venue.lat},${venue.lng}\n`);

    const action = await ask('Action: (c)onfirm, (e)dit, (s)kip, (q)uit? ');

    switch (action.toLowerCase()) {
      case 'c':
        await upsertVenue({
          ...venue,
          manualOverride: true,
          geocodeConfidence: 'high',
        });
        console.log('✓ Confirmed\n');
        break;

      case 'e':
        const latStr = await ask(`New latitude (current: ${venue.lat}): `);
        const lngStr = await ask(`New longitude (current: ${venue.lng}): `);

        const newLat = latStr ? parseFloat(latStr) : venue.lat;
        const newLng = lngStr ? parseFloat(lngStr) : venue.lng;

        if (isNaN(newLat) || isNaN(newLng)) {
          console.log('Invalid coordinates, skipping...\n');
          break;
        }

        await upsertVenue({
          ...venue,
          lat: newLat,
          lng: newLng,
          manualOverride: true,
          geocodeConfidence: 'high',
        });
        console.log('✓ Updated\n');
        break;

      case 's':
        console.log('Skipped\n');
        break;

      case 'q':
        console.log('Quitting...');
        rl.close();
        return;

      default:
        console.log('Unknown action, skipping...\n');
    }
  }

  console.log('\nReview complete!');
  rl.close();
}

main().catch((error) => {
  console.error('Error:', error);
  rl.close();
  process.exit(1);
});
```

**Step 2: Add script to package.json**

Add to backend/package.json scripts:

```json
"admin:review-venues": "tsx scripts/review-venues.ts"
```

**Step 3: Test script compiles**

Run: `cd backend && npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add backend/scripts/review-venues.ts backend/package.json
git commit -m "feat(admin): add CLI script for reviewing low-confidence venues"
```

---

## Phase 5: Environment Setup

### Task 18: Add Google Maps API key to environment

**Files:**
- Modify: `backend/env.json`
- Modify: `backend/template.yaml` (if using SAM)

**Step 1: Add to env.json for local development**

Add GOOGLE_MAPS_API_KEY to backend/env.json:

```json
{
  "TournamentsFunction": {
    "DYNAMODB_ENDPOINT": "http://localhost:8000",
    "DYNAMODB_TABLE": "bjj-tournament-tracker",
    "AWS_REGION": "us-east-1"
  },
  "SyncFunction": {
    "DYNAMODB_ENDPOINT": "http://localhost:8000",
    "DYNAMODB_TABLE": "bjj-tournament-tracker",
    "AWS_REGION": "us-east-1",
    "GOOGLE_MAPS_API_KEY": "YOUR_API_KEY_HERE"
  }
}
```

**Step 2: Update .gitignore if needed**

Ensure env.json is in .gitignore (it likely already is).

**Step 3: Document in README or add .env.example**

Create `backend/.env.example`:

```
DYNAMODB_ENDPOINT=http://localhost:8000
DYNAMODB_TABLE=bjj-tournament-tracker
GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
```

**Step 4: Commit**

```bash
git add backend/.env.example
git commit -m "docs: add .env.example with Google Maps API key placeholder"
```

---

## Final Steps

### Task 19: Run full test suite

**Step 1: Run backend tests**

Run: `cd backend && npm test`
Expected: All tests pass

**Step 2: Run frontend build**

Run: `cd frontend && npm run build`
Expected: Build succeeds

**Step 3: Run type checks**

Run: `cd backend && npx tsc --noEmit && cd ../frontend && npx tsc --noEmit`
Expected: No type errors

---

### Task 20: Create final commit

**Step 1: Review all changes**

Run: `git status` and `git diff --stat`

**Step 2: Create summary commit if needed**

If there are any uncommitted changes, commit them.

**Step 3: Push to branch**

Run: `git push origin HEAD`

---

## Summary

This plan implements:

1. **Backend geocoding** - Google Maps API integration with venue caching
2. **Sync enrichment** - Tournaments are geocoded during sync, cached by venue
3. **Distance filtering** - Haversine distance calculation, post-filter approach
4. **Frontend filters** - Location (Near me + manual), distance presets, date presets
5. **URL sync** - All filter state persists to URL for shareability
6. **Admin tooling** - CLI script for reviewing low-confidence geocodes

Total: 20 tasks, estimated 2-3 hours of implementation time.
