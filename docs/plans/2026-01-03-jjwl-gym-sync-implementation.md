# JJWL Gym Sync Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable roster lookup by syncing JJWL gyms and caching tournament registrations per gym.

**Architecture:** Add SourceGym and TournamentGymRoster entities to DynamoDB. Create fetchers for JJWL gym list and roster APIs. Expose search/roster endpoints. Update athlete schema with gym fields.

**Tech Stack:** TypeScript, DynamoDB, Express (local), AWS Lambda + API Gateway (prod)

---

## Task 1: Add TypeScript Types

**Files:**
- Modify: `backend/src/db/types.ts`
- Modify: `backend/src/fetchers/types.ts`

**Step 1: Add SourceGymItem type to db/types.ts**

Add after `WsConnectionItem` interface (around line 153):

```typescript
// Source gym entity (from JJWL, IBJJF, etc.)
export interface SourceGymItem {
  PK: string; // SRCGYM#{org}#{externalId}
  SK: 'META';
  GSI1PK: 'GYMS';
  GSI1SK: string; // {org}#{name}
  org: 'JJWL' | 'IBJJF';
  externalId: string;
  name: string;
  masterGymId: string | null; // Future: links to canonical gym
  createdAt: string;
  updatedAt: string;
}

// Cached roster for a gym at a tournament
export interface TournamentGymRosterItem {
  PK: string; // TOURN#{org}#{tournamentId}
  SK: string; // GYMROSTER#{gymExternalId}
  gymExternalId: string;
  gymName: string;
  athletes: Array<{
    name: string;
    belt: string;
    ageDiv: string;
    weight: string;
    gender: string;
  }>;
  athleteCount: number;
  fetchedAt: string;
}
```

**Step 2: Add key builders to db/types.ts**

Add after `buildWsConnPK` function (around line 28):

```typescript
export const buildSourceGymPK = (org: string, externalId: string): string =>
  `SRCGYM#${org}#${externalId}`;

export const buildSourceGymGSI1SK = (org: string, name: string): string =>
  `${org}#${name}`;

export const buildGymRosterSK = (gymExternalId: string): string =>
  `GYMROSTER#${gymExternalId}`;
```

**Step 3: Update DynamoDBItem union type**

Add to the union (around line 163):

```typescript
export type DynamoDBItem =
  | TournamentItem
  | UserProfileItem
  | AthleteItem
  | WishlistItem
  | VenueItem
  | FlightPriceItem
  | KnownAirportItem
  | WsConnectionItem
  | SourceGymItem
  | TournamentGymRosterItem;
```

**Step 4: Add fetcher types to fetchers/types.ts**

Add at end of file:

```typescript
// JJWL Gym from API
export interface JJWLGym {
  id: string;
  name: string;
}

// Normalized gym (for cross-source support)
export interface NormalizedGym {
  org: 'JJWL' | 'IBJJF';
  externalId: string;
  name: string;
}

// JJWL Roster athlete from API
export interface JJWLRosterAthlete {
  name: string;
  belt: string;
  ageDiv: string;
  weight: string;
  gender: string;
}
```

**Step 5: Verify TypeScript compiles**

Run: `cd backend && npx tsc --noEmit`
Expected: No errors

**Step 6: Commit**

```bash
git add backend/src/db/types.ts backend/src/fetchers/types.ts
git commit -m "feat(types): add SourceGym and TournamentGymRoster types"
```

---

## Task 2: Create Gym Database Queries

**Files:**
- Create: `backend/src/db/gymQueries.ts`
- Create: `backend/src/__tests__/db/gymQueries.test.ts`

**Step 1: Write the test file**

```typescript
// backend/src/__tests__/db/gymQueries.test.ts
import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  upsertSourceGym,
  getSourceGym,
  searchGyms,
  upsertGymRoster,
  getGymRoster,
  getTournamentRosters,
} from '../../db/gymQueries.js';
import type { NormalizedGym, JJWLRosterAthlete } from '../../fetchers/types.js';

// Note: These tests require local DynamoDB running
// Run with: npm run test:integration

describe('gymQueries', () => {
  describe('upsertSourceGym', () => {
    it('creates a new gym', async () => {
      const gym: NormalizedGym = {
        org: 'JJWL',
        externalId: 'test-123',
        name: 'Test Academy',
      };

      await upsertSourceGym(gym);
      const result = await getSourceGym('JJWL', 'test-123');

      expect(result).not.toBeNull();
      expect(result?.name).toBe('Test Academy');
      expect(result?.org).toBe('JJWL');
    });
  });

  describe('searchGyms', () => {
    it('finds gyms by name prefix', async () => {
      // Setup: create test gyms
      await upsertSourceGym({ org: 'JJWL', externalId: 'pablo-1', name: 'Pablo Silva BJJ' });
      await upsertSourceGym({ org: 'JJWL', externalId: 'pablo-2', name: 'Pablo Academy' });

      const results = await searchGyms('JJWL', 'Pablo');

      expect(results.length).toBeGreaterThanOrEqual(2);
      expect(results.every(g => g.name.includes('Pablo'))).toBe(true);
    });
  });

  describe('roster queries', () => {
    it('upserts and retrieves gym roster', async () => {
      const athletes: JJWLRosterAthlete[] = [
        { name: 'John Doe', belt: 'Blue', ageDiv: 'Adult', weight: 'Light', gender: 'Male' },
      ];

      await upsertGymRoster('JJWL', '850', '5713', 'Test Gym', athletes);
      const roster = await getGymRoster('JJWL', '850', '5713');

      expect(roster).not.toBeNull();
      expect(roster?.athleteCount).toBe(1);
      expect(roster?.athletes[0].name).toBe('John Doe');
    });

    it('gets all rosters for a tournament', async () => {
      await upsertGymRoster('JJWL', '999', 'gym-a', 'Gym A', []);
      await upsertGymRoster('JJWL', '999', 'gym-b', 'Gym B', []);

      const rosters = await getTournamentRosters('JJWL', '999');

      expect(rosters.length).toBeGreaterThanOrEqual(2);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd backend && npm test -- --testPathPattern=gymQueries`
Expected: FAIL - module not found

**Step 3: Create the queries file**

```typescript
// backend/src/db/gymQueries.ts
import { QueryCommand, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME, GSI1_NAME } from './client.js';
import {
  buildSourceGymPK,
  buildSourceGymGSI1SK,
  buildTournamentPK,
  buildGymRosterSK,
} from './types.js';
import type { SourceGymItem, TournamentGymRosterItem } from './types.js';
import type { NormalizedGym, JJWLRosterAthlete } from '../fetchers/types.js';

/**
 * Upsert a source gym (from JJWL, IBJJF, etc.)
 */
export async function upsertSourceGym(gym: NormalizedGym): Promise<void> {
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
    createdAt: now,
    updatedAt: now,
  };

  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: item,
  }));
}

/**
 * Get a source gym by org and externalId
 */
export async function getSourceGym(
  org: 'JJWL' | 'IBJJF',
  externalId: string
): Promise<SourceGymItem | null> {
  const result = await docClient.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: {
      PK: buildSourceGymPK(org, externalId),
      SK: 'META',
    },
  }));

  return (result.Item as SourceGymItem) || null;
}

/**
 * Search gyms by org and name prefix
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

  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: item,
  }));
}

/**
 * Get roster for a specific gym at a tournament
 */
export async function getGymRoster(
  org: 'JJWL' | 'IBJJF',
  tournamentId: string,
  gymExternalId: string
): Promise<TournamentGymRosterItem | null> {
  const result = await docClient.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: {
      PK: buildTournamentPK(org, tournamentId),
      SK: buildGymRosterSK(gymExternalId),
    },
  }));

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
 */
export async function batchUpsertGyms(gyms: NormalizedGym[]): Promise<number> {
  let count = 0;
  // Upsert one at a time to preserve createdAt for existing records
  // Could optimize with BatchWrite if needed for performance
  for (const gym of gyms) {
    await upsertSourceGym(gym);
    count++;
  }
  return count;
}
```

**Step 4: Run tests to verify they pass**

Run: `cd backend && npm test -- --testPathPattern=gymQueries`
Expected: Tests may fail if local DynamoDB not running - that's okay for unit test

**Step 5: Verify TypeScript compiles**

Run: `cd backend && npx tsc --noEmit`
Expected: No errors

**Step 6: Commit**

```bash
git add backend/src/db/gymQueries.ts backend/src/__tests__/db/gymQueries.test.ts
git commit -m "feat(db): add gym and roster query functions"
```

---

## Task 3: Create JJWL Gym Fetcher

**Files:**
- Create: `backend/src/fetchers/jjwlGymFetcher.ts`
- Create: `backend/src/__tests__/fetchers/jjwlGymFetcher.test.ts`

**Step 1: Write the test file**

```typescript
// backend/src/__tests__/fetchers/jjwlGymFetcher.test.ts
import { describe, it, expect } from '@jest/globals';
import { mapJJWLGymToNormalized, parseJJWLGymsResponse } from '../../fetchers/jjwlGymFetcher.js';
import type { JJWLGym } from '../../fetchers/types.js';

describe('jjwlGymFetcher', () => {
  describe('mapJJWLGymToNormalized', () => {
    it('maps gym fields correctly', () => {
      const jjwlGym: JJWLGym = { id: '5713', name: 'Pablo Silva BJJ' };

      const result = mapJJWLGymToNormalized(jjwlGym);

      expect(result.org).toBe('JJWL');
      expect(result.externalId).toBe('5713');
      expect(result.name).toBe('Pablo Silva BJJ');
    });

    it('trims whitespace from name', () => {
      const jjwlGym: JJWLGym = { id: '123', name: '  Test Gym  ' };

      const result = mapJJWLGymToNormalized(jjwlGym);

      expect(result.name).toBe('Test Gym');
    });
  });

  describe('parseJJWLGymsResponse', () => {
    it('parses valid JSON array', () => {
      const response = [
        { id: '1', name: 'Gym A' },
        { id: '2', name: 'Gym B' },
      ];

      const result = parseJJWLGymsResponse(response);

      expect(result).toHaveLength(2);
      expect(result[0].externalId).toBe('1');
      expect(result[1].externalId).toBe('2');
    });

    it('filters out invalid entries', () => {
      const response = [
        { id: '1', name: 'Valid Gym' },
        { id: '', name: 'No ID' },
        { id: '3', name: '' },
        { name: 'Missing ID' },
      ];

      const result = parseJJWLGymsResponse(response as JJWLGym[]);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Valid Gym');
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd backend && npm test -- --testPathPattern=jjwlGymFetcher`
Expected: FAIL - module not found

**Step 3: Create the fetcher**

```typescript
// backend/src/fetchers/jjwlGymFetcher.ts
import type { JJWLGym, NormalizedGym } from './types.js';

const JJWL_GYMS_URL = 'https://www.jjworldleague.com/style2020_ajax/lists/gyms.php';

/**
 * Map JJWL gym to normalized format
 */
export function mapJJWLGymToNormalized(gym: JJWLGym): NormalizedGym {
  return {
    org: 'JJWL',
    externalId: gym.id,
    name: gym.name.trim(),
  };
}

/**
 * Parse and validate JJWL gyms response
 */
export function parseJJWLGymsResponse(data: unknown): NormalizedGym[] {
  if (!Array.isArray(data)) {
    console.warn('[JJWLGymFetcher] Response is not an array');
    return [];
  }

  return data
    .filter((item): item is JJWLGym => {
      if (!item || typeof item !== 'object') return false;
      const gym = item as Record<string, unknown>;
      return (
        typeof gym.id === 'string' &&
        gym.id.length > 0 &&
        typeof gym.name === 'string' &&
        gym.name.trim().length > 0
      );
    })
    .map(mapJJWLGymToNormalized);
}

/**
 * Fetch all gyms from JJWL
 */
export async function fetchJJWLGyms(): Promise<NormalizedGym[]> {
  console.log('[JJWLGymFetcher] Fetching gyms from JJWL...');

  const response = await fetch(JJWL_GYMS_URL, {
    headers: {
      'accept': 'application/json, text/javascript, */*; q=0.01',
      'x-requested-with': 'XMLHttpRequest',
    },
  });

  if (!response.ok) {
    throw new Error(`JJWL gyms API returned ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  const gyms = parseJJWLGymsResponse(data);

  console.log(`[JJWLGymFetcher] Fetched ${gyms.length} gyms`);
  return gyms;
}
```

**Step 4: Run tests to verify they pass**

Run: `cd backend && npm test -- --testPathPattern=jjwlGymFetcher`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/src/fetchers/jjwlGymFetcher.ts backend/src/__tests__/fetchers/jjwlGymFetcher.test.ts
git commit -m "feat(fetcher): add JJWL gym fetcher"
```

---

## Task 4: Create JJWL Roster Fetcher

**Files:**
- Create: `backend/src/fetchers/jjwlRosterFetcher.ts`
- Create: `backend/src/__tests__/fetchers/jjwlRosterFetcher.test.ts`

**Step 1: Write the test file**

```typescript
// backend/src/__tests__/fetchers/jjwlRosterFetcher.test.ts
import { describe, it, expect } from '@jest/globals';
import { parseRosterResponse } from '../../fetchers/jjwlRosterFetcher.js';

describe('jjwlRosterFetcher', () => {
  describe('parseRosterResponse', () => {
    it('parses DataTables format response', () => {
      // DataTables returns { data: [...] } format
      const response = {
        data: [
          ['John Doe', '1', '10:00', 'Male', 'Adult (18+)', 'Blue', 'Light'],
          ['Jane Smith', '2', '11:00', 'Female', 'Juvenile (16-17)', 'Purple', 'Feather'],
        ],
      };

      const result = parseRosterResponse(response);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        name: 'John Doe',
        gender: 'Male',
        ageDiv: 'Adult (18+)',
        belt: 'Blue',
        weight: 'Light',
      });
    });

    it('handles empty response', () => {
      const response = { data: [] };

      const result = parseRosterResponse(response);

      expect(result).toHaveLength(0);
    });

    it('handles missing data property', () => {
      const response = {};

      const result = parseRosterResponse(response as { data: unknown[] });

      expect(result).toHaveLength(0);
    });

    it('filters out invalid rows', () => {
      const response = {
        data: [
          ['Valid Name', '1', '10:00', 'Male', 'Adult', 'Blue', 'Light'],
          ['', '2', '11:00', 'Male', 'Adult', 'Blue', 'Light'], // Empty name
          null, // Invalid row
        ],
      };

      const result = parseRosterResponse(response as { data: unknown[] });

      expect(result).toHaveLength(1);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd backend && npm test -- --testPathPattern=jjwlRosterFetcher`
Expected: FAIL - module not found

**Step 3: Create the fetcher**

```typescript
// backend/src/fetchers/jjwlRosterFetcher.ts
import type { JJWLRosterAthlete } from './types.js';

const JJWL_ROSTER_URL = 'https://www.jjworldleague.com/pages/hermes_ajax/events_competitors_list.php';

/**
 * Parse DataTables response into roster athletes
 * DataTables returns rows as arrays: [name, mat, time, gender, ageDiv, belt, weight]
 */
export function parseRosterResponse(response: { data?: unknown[] }): JJWLRosterAthlete[] {
  if (!response.data || !Array.isArray(response.data)) {
    return [];
  }

  return response.data
    .filter((row): row is string[] => {
      if (!Array.isArray(row) || row.length < 7) return false;
      // Validate name exists
      return typeof row[0] === 'string' && row[0].trim().length > 0;
    })
    .map((row) => ({
      name: row[0].trim(),
      gender: row[3]?.trim() || '',
      ageDiv: row[4]?.trim() || '',
      belt: row[5]?.trim() || '',
      weight: row[6]?.trim() || '',
    }));
}

/**
 * Fetch roster for a gym at a tournament
 */
export async function fetchJJWLRoster(
  eventId: string,
  academyId: string
): Promise<JJWLRosterAthlete[]> {
  console.log(`[JJWLRosterFetcher] Fetching roster for event ${eventId}, academy ${academyId}`);

  const formData = new URLSearchParams();
  formData.append('event_id', eventId);
  formData.append('academy_id', academyId);
  // DataTables params
  formData.append('draw', '1');
  formData.append('start', '0');
  formData.append('length', '1000'); // Get all athletes

  const response = await fetch(JJWL_ROSTER_URL, {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'content-type': 'application/x-www-form-urlencoded',
      'x-requested-with': 'XMLHttpRequest',
    },
    body: formData.toString(),
  });

  if (!response.ok) {
    throw new Error(`JJWL roster API returned ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  const athletes = parseRosterResponse(data);

  console.log(`[JJWLRosterFetcher] Found ${athletes.length} athletes`);
  return athletes;
}
```

**Step 4: Run tests to verify they pass**

Run: `cd backend && npm test -- --testPathPattern=jjwlRosterFetcher`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/src/fetchers/jjwlRosterFetcher.ts backend/src/__tests__/fetchers/jjwlRosterFetcher.test.ts
git commit -m "feat(fetcher): add JJWL roster fetcher"
```

---

## Task 5: Create Gym Sync Service

**Files:**
- Create: `backend/src/services/gymSyncService.ts`
- Create: `backend/src/__tests__/services/gymSyncService.test.ts`

**Step 1: Write the test file**

```typescript
// backend/src/__tests__/services/gymSyncService.test.ts
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock the dependencies
jest.mock('../../fetchers/jjwlGymFetcher.js', () => ({
  fetchJJWLGyms: jest.fn(),
}));

jest.mock('../../db/gymQueries.js', () => ({
  batchUpsertGyms: jest.fn(),
}));

import { syncJJWLGyms } from '../../services/gymSyncService.js';
import { fetchJJWLGyms } from '../../fetchers/jjwlGymFetcher.js';
import { batchUpsertGyms } from '../../db/gymQueries.js';

describe('gymSyncService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('syncJJWLGyms', () => {
    it('fetches and saves gyms', async () => {
      const mockGyms = [
        { org: 'JJWL' as const, externalId: '1', name: 'Gym A' },
        { org: 'JJWL' as const, externalId: '2', name: 'Gym B' },
      ];

      (fetchJJWLGyms as jest.Mock).mockResolvedValue(mockGyms);
      (batchUpsertGyms as jest.Mock).mockResolvedValue(2);

      const result = await syncJJWLGyms();

      expect(fetchJJWLGyms).toHaveBeenCalled();
      expect(batchUpsertGyms).toHaveBeenCalledWith(mockGyms);
      expect(result.fetched).toBe(2);
      expect(result.saved).toBe(2);
    });

    it('handles fetch errors gracefully', async () => {
      (fetchJJWLGyms as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await syncJJWLGyms();

      expect(result.fetched).toBe(0);
      expect(result.saved).toBe(0);
      expect(result.error).toBe('Network error');
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd backend && npm test -- --testPathPattern=gymSyncService`
Expected: FAIL - module not found

**Step 3: Create the service**

```typescript
// backend/src/services/gymSyncService.ts
import { fetchJJWLGyms } from '../fetchers/jjwlGymFetcher.js';
import { fetchJJWLRoster } from '../fetchers/jjwlRosterFetcher.js';
import { batchUpsertGyms, upsertGymRoster, getSourceGym } from '../db/gymQueries.js';
import { queryTournaments } from '../db/queries.js';
import { getUserAthletes } from '../db/athleteQueries.js';
import type { TournamentItem } from '../db/types.js';

export interface GymSyncResult {
  fetched: number;
  saved: number;
  error?: string;
}

export interface RosterSyncResult {
  tournamentsProcessed: number;
  rostersUpdated: number;
  errors: string[];
}

/**
 * Sync all JJWL gyms to database
 */
export async function syncJJWLGyms(): Promise<GymSyncResult> {
  try {
    const gyms = await fetchJJWLGyms();
    const saved = await batchUpsertGyms(gyms);

    return {
      fetched: gyms.length,
      saved,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[GymSyncService] Failed to sync JJWL gyms:', message);
    return {
      fetched: 0,
      saved: 0,
      error: message,
    };
  }
}

/**
 * Get unique gym IDs from all athletes
 */
export async function getActiveGymIds(): Promise<Map<string, { org: 'JJWL' | 'IBJJF'; externalId: string }>> {
  // For now, we'd need to scan all athletes
  // This is a simplified version - in production you might want a GSI or separate tracking
  // For MVP, we'll accept the scan since athlete count is low

  // TODO: Implement proper gym tracking when scale requires it
  // For now, return empty - rosters will be fetched on-demand via API
  return new Map();
}

/**
 * Get upcoming tournaments (next N days)
 */
export async function getUpcomingTournaments(daysAhead = 60): Promise<TournamentItem[]> {
  const today = new Date().toISOString().split('T')[0];
  const futureDate = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];

  const result = await queryTournaments({
    startAfter: today,
    startBefore: futureDate,
  });

  return result.items;
}

/**
 * Sync roster for a specific gym at a specific tournament
 */
export async function syncGymRoster(
  org: 'JJWL' | 'IBJJF',
  tournamentId: string,
  gymExternalId: string
): Promise<{ success: boolean; athleteCount: number; error?: string }> {
  try {
    if (org !== 'JJWL') {
      return { success: false, athleteCount: 0, error: 'Only JJWL supported currently' };
    }

    // Get gym name for denormalization
    const gym = await getSourceGym(org, gymExternalId);
    const gymName = gym?.name || 'Unknown Gym';

    // Fetch roster from JJWL
    const athletes = await fetchJJWLRoster(tournamentId, gymExternalId);

    // Save to database
    await upsertGymRoster(org, tournamentId, gymExternalId, gymName, athletes);

    return {
      success: true,
      athleteCount: athletes.length,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[GymSyncService] Failed to sync roster for ${org}/${tournamentId}/${gymExternalId}:`, message);
    return {
      success: false,
      athleteCount: 0,
      error: message,
    };
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `cd backend && npm test -- --testPathPattern=gymSyncService`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/src/services/gymSyncService.ts backend/src/__tests__/services/gymSyncService.test.ts
git commit -m "feat(service): add gym sync service"
```

---

## Task 6: Create Gyms API Handler

**Files:**
- Create: `backend/src/handlers/gyms.ts`
- Create: `backend/src/__tests__/handlers/gyms.test.ts`

**Step 1: Write the test file**

```typescript
// backend/src/__tests__/handlers/gyms.test.ts
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { APIGatewayProxyEvent, Context } from 'aws-lambda';

// Mock dependencies
jest.mock('../../db/gymQueries.js', () => ({
  searchGyms: jest.fn(),
  getSourceGym: jest.fn(),
  getGymRoster: jest.fn(),
}));

jest.mock('../../services/gymSyncService.js', () => ({
  syncGymRoster: jest.fn(),
}));

import { handler } from '../../handlers/gyms.js';
import { searchGyms, getSourceGym, getGymRoster } from '../../db/gymQueries.js';

const mockContext: Context = {
  callbackWaitsForEmptyEventLoop: true,
  functionName: 'test',
  functionVersion: '1',
  invokedFunctionArn: 'arn:aws:lambda:us-east-1:000:function:test',
  memoryLimitInMB: '128',
  awsRequestId: 'test-123',
  logGroupName: '/aws/lambda/test',
  logStreamName: 'test',
  getRemainingTimeInMillis: () => 30000,
  done: () => {},
  fail: () => {},
  succeed: () => {},
};

describe('gyms handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /gyms', () => {
    it('searches gyms with query params', async () => {
      const mockGyms = [
        { org: 'JJWL', externalId: '123', name: 'Pablo Silva BJJ' },
      ];
      (searchGyms as jest.Mock).mockResolvedValue(mockGyms);

      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'GET',
        path: '/gyms',
        pathParameters: null,
        queryStringParameters: { search: 'Pablo', org: 'JJWL' },
        body: null,
        headers: {},
      };

      const result = await handler(event as APIGatewayProxyEvent, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.gyms).toHaveLength(1);
      expect(body.gyms[0].name).toBe('Pablo Silva BJJ');
    });

    it('returns 400 if org is missing', async () => {
      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'GET',
        path: '/gyms',
        pathParameters: null,
        queryStringParameters: { search: 'Pablo' },
        body: null,
        headers: {},
      };

      const result = await handler(event as APIGatewayProxyEvent, mockContext);

      expect(result.statusCode).toBe(400);
    });
  });

  describe('GET /gyms/:org/:externalId', () => {
    it('returns gym details', async () => {
      const mockGym = { org: 'JJWL', externalId: '123', name: 'Test Gym' };
      (getSourceGym as jest.Mock).mockResolvedValue(mockGym);

      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'GET',
        path: '/gyms/JJWL/123',
        pathParameters: { org: 'JJWL', externalId: '123' },
        queryStringParameters: null,
        body: null,
        headers: {},
      };

      const result = await handler(event as APIGatewayProxyEvent, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.name).toBe('Test Gym');
    });

    it('returns 404 if gym not found', async () => {
      (getSourceGym as jest.Mock).mockResolvedValue(null);

      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'GET',
        path: '/gyms/JJWL/999',
        pathParameters: { org: 'JJWL', externalId: '999' },
        queryStringParameters: null,
        body: null,
        headers: {},
      };

      const result = await handler(event as APIGatewayProxyEvent, mockContext);

      expect(result.statusCode).toBe(404);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd backend && npm test -- --testPathPattern=handlers/gyms`
Expected: FAIL - module not found

**Step 3: Create the handler**

```typescript
// backend/src/handlers/gyms.ts
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { withErrorHandler, jsonResponse } from './middleware/errorHandler.js';
import { searchGyms, getSourceGym, getGymRoster } from '../db/gymQueries.js';
import { syncGymRoster } from '../services/gymSyncService.js';
import { ValidationError, NotFoundError } from '../shared/errors.js';

const gymsHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const method = event.httpMethod;
  const org = event.pathParameters?.org as 'JJWL' | 'IBJJF' | undefined;
  const externalId = event.pathParameters?.externalId;
  const tournamentId = event.pathParameters?.tournamentId;

  // GET /gyms - search gyms
  if (method === 'GET' && !org && !externalId) {
    const searchQuery = event.queryStringParameters?.search || '';
    const orgFilter = event.queryStringParameters?.org as 'JJWL' | 'IBJJF' | undefined;

    if (!orgFilter) {
      throw new ValidationError('org query parameter is required (JJWL or IBJJF)');
    }

    if (orgFilter !== 'JJWL' && orgFilter !== 'IBJJF') {
      throw new ValidationError('org must be JJWL or IBJJF');
    }

    const gyms = await searchGyms(orgFilter, searchQuery);

    return jsonResponse(200, {
      gyms: gyms.map((g) => ({
        org: g.org,
        externalId: g.externalId,
        name: g.name,
      })),
    });
  }

  // GET /gyms/:org/:externalId - get gym details
  if (method === 'GET' && org && externalId && !tournamentId) {
    if (org !== 'JJWL' && org !== 'IBJJF') {
      throw new ValidationError('org must be JJWL or IBJJF');
    }

    const gym = await getSourceGym(org, externalId);

    if (!gym) {
      throw new NotFoundError('Gym not found');
    }

    return jsonResponse(200, {
      org: gym.org,
      externalId: gym.externalId,
      name: gym.name,
    });
  }

  // GET /tournaments/:tournamentId/roster/:gymId - get roster
  // Note: This route pattern requires different path structure
  // For simplicity, we'll use /gyms/:org/:externalId/roster/:tournamentId
  if (method === 'GET' && org && externalId && tournamentId) {
    if (org !== 'JJWL' && org !== 'IBJJF') {
      throw new ValidationError('org must be JJWL or IBJJF');
    }

    // Check cache first
    let roster = await getGymRoster(org, tournamentId, externalId);

    // If no cached roster, fetch it
    if (!roster) {
      const result = await syncGymRoster(org, tournamentId, externalId);
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch roster');
      }
      roster = await getGymRoster(org, tournamentId, externalId);
    }

    if (!roster) {
      return jsonResponse(200, {
        gymExternalId: externalId,
        athletes: [],
        athleteCount: 0,
        fetchedAt: null,
      });
    }

    return jsonResponse(200, {
      gymExternalId: roster.gymExternalId,
      gymName: roster.gymName,
      athletes: roster.athletes,
      athleteCount: roster.athleteCount,
      fetchedAt: roster.fetchedAt,
    });
  }

  return jsonResponse(405, { error: 'Method not allowed' });
};

export const handler = withErrorHandler(gymsHandler);
```

**Step 4: Run tests to verify they pass**

Run: `cd backend && npm test -- --testPathPattern=handlers/gyms`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/src/handlers/gyms.ts backend/src/__tests__/handlers/gyms.test.ts
git commit -m "feat(api): add gyms handler with search and roster endpoints"
```

---

## Task 7: Update Athlete Schema

**Files:**
- Modify: `backend/src/db/types.ts`
- Modify: `backend/src/db/athleteQueries.ts`

**Step 1: Update AthleteItem type**

In `backend/src/db/types.ts`, update `AthleteItem` interface (around line 71):

```typescript
export interface AthleteItem {
  PK: string; // USER#<cognitoSub>
  SK: string; // ATHLETE#<ulid>
  athleteId: string;
  name: string;
  beltRank: string | null;
  birthYear: number | null;
  weightClass: string | null;
  homeAirport: string | null;
  // NEW: Gym fields
  gymSourceId: string | null; // e.g., "JJWL#5713"
  gymName: string | null; // Denormalized for display
  createdAt: string;
  updatedAt: string;
}
```

**Step 2: Update CreateAthleteInput**

In `backend/src/db/athleteQueries.ts`, update the interface (around line 7):

```typescript
export interface CreateAthleteInput {
  name: string;
  beltRank?: string;
  birthYear?: number;
  gender?: string;
  weight?: number;
  gymName?: string;
  homeAirport?: string;
  // NEW: Gym fields
  gymSourceId?: string; // e.g., "JJWL#5713"
  gymDisplayName?: string; // Display name (gymName field on AthleteItem)
}
```

**Step 3: Update createAthlete function**

In `backend/src/db/athleteQueries.ts`, update `createAthlete` (around line 38):

```typescript
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
  createdAt: now,
  updatedAt: now,
};
```

**Step 4: Update updateAthlete function**

In `backend/src/db/athleteQueries.ts`, update `updateAthlete` (around line 79):

```typescript
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
  updatedAt: new Date().toISOString(),
};
```

**Step 5: Verify TypeScript compiles**

Run: `cd backend && npx tsc --noEmit`
Expected: No errors

**Step 6: Run existing athlete tests**

Run: `cd backend && npm test -- --testPathPattern=athletes`
Expected: PASS (existing tests should still work)

**Step 7: Commit**

```bash
git add backend/src/db/types.ts backend/src/db/athleteQueries.ts
git commit -m "feat(athlete): add gym fields to athlete schema"
```

---

## Task 8: Add Routes to Dev Server

**Files:**
- Modify: `backend/src/dev-server.ts`

**Step 1: Import gyms handler**

Add after other handler imports (around line 20):

```typescript
const { handler: gymsHandler } = await import('./handlers/gyms.js');
```

**Step 2: Add gym routes**

Add after other route definitions (before the `app.listen` call):

```typescript
// Gym routes
app.get('/gyms', wrapHandler(gymsHandler));
app.get('/gyms/:org/:externalId', wrapHandler(gymsHandler));
app.get('/gyms/:org/:externalId/roster/:tournamentId', wrapHandler(gymsHandler));
```

**Step 3: Verify dev server starts**

Run: `cd backend && npm run dev`
Expected: Server starts without errors

**Step 4: Test endpoint manually**

Run: `curl "http://localhost:3001/gyms?org=JJWL&search=Pablo"`
Expected: Returns JSON (may be empty if gyms not synced)

**Step 5: Commit**

```bash
git add backend/src/dev-server.ts
git commit -m "feat(dev-server): add gym routes"
```

---

## Task 9: Add Gym Sync to Sync Handler

**Files:**
- Modify: `backend/src/handlers/sync.ts`
- Modify: `backend/src/services/syncService.ts`

**Step 1: Update SyncResult interface**

In `backend/src/services/syncService.ts`, update the interface:

```typescript
export interface SyncResult {
  ibjjf: SourceResult;
  jjwl: SourceResult;
  gyms?: SourceResult;
}
```

**Step 2: Add gym sync to syncAllTournaments**

In `backend/src/services/syncService.ts`, update the function:

```typescript
import { syncJJWLGyms } from './gymSyncService.js';

export async function syncAllTournaments(
  options: SyncOptions = {}
): Promise<SyncResult> {
  const [ibjjf, jjwl, gyms] = await Promise.all([
    fetchSource('IBJJF', fetchIBJJFTournaments, options),
    fetchSource('JJWL', fetchJJWLTournaments, options),
    syncJJWLGyms().then(r => ({ fetched: r.fetched, saved: r.saved, error: r.error })),
  ]);

  return { ibjjf, jjwl, gyms };
}
```

**Step 3: Verify TypeScript compiles**

Run: `cd backend && npx tsc --noEmit`
Expected: No errors

**Step 4: Run sync service tests**

Run: `cd backend && npm test -- --testPathPattern=syncService`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/src/services/syncService.ts
git commit -m "feat(sync): include gym sync in daily sync job"
```

---

## Task 10: Update SAM Template

**Files:**
- Modify: `backend/template.yaml`

**Step 1: Add GymsFunction resource**

Add after `AthletesFunction` definition:

```yaml
  GymsFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: !Sub bjj-tournament-tracker-gyms-${Stage}
      Handler: dist/handlers/gyms.handler
      CodeUri: .
      Description: Handles gym search and roster lookups
      Policies:
        - DynamoDBCrudPolicy:
            TableName: !Ref TournamentsTable
      Events:
        SearchGyms:
          Type: Api
          Properties:
            RestApiId: !Ref TournamentsApi
            Path: /gyms
            Method: GET
        GetGym:
          Type: Api
          Properties:
            RestApiId: !Ref TournamentsApi
            Path: /gyms/{org}/{externalId}
            Method: GET
        GetRoster:
          Type: Api
          Properties:
            RestApiId: !Ref TournamentsApi
            Path: /gyms/{org}/{externalId}/roster/{tournamentId}
            Method: GET
    Metadata:
      BuildMethod: esbuild
      BuildProperties:
        Minify: true
        Target: es2022
        Sourcemap: true
        EntryPoints:
          - src/handlers/gyms.ts
        External:
          - '@aws-sdk/*'
```

**Step 2: Validate SAM template**

Run: `cd backend && sam validate`
Expected: Template is valid

**Step 3: Commit**

```bash
git add backend/template.yaml
git commit -m "feat(infra): add GymsFunction to SAM template"
```

---

## Task 11: Final Integration Test

**Step 1: Run all backend tests**

Run: `cd backend && npm test`
Expected: All tests pass

**Step 2: Build the project**

Run: `cd backend && sam build`
Expected: Build succeeds

**Step 3: Start local dev and test manually**

Run in terminal 1: `cd backend && docker compose up -d && npm run dev`
Run in terminal 2:
```bash
# Sync gyms first
curl -X POST http://localhost:3001/sync

# Search for gyms
curl "http://localhost:3001/gyms?org=JJWL&search=Pablo"

# Get roster (replace with real IDs)
curl "http://localhost:3001/gyms/JJWL/5713/roster/850"
```

**Step 4: Commit final changes if any**

```bash
git add -A
git commit -m "chore: final cleanup and integration verification"
```

---

## Summary

| Task | Description | Files Changed |
|------|-------------|---------------|
| 1 | TypeScript types | types.ts (db + fetchers) |
| 2 | Gym DB queries | gymQueries.ts + test |
| 3 | JJWL gym fetcher | jjwlGymFetcher.ts + test |
| 4 | JJWL roster fetcher | jjwlRosterFetcher.ts + test |
| 5 | Gym sync service | gymSyncService.ts + test |
| 6 | Gyms API handler | gyms.ts + test |
| 7 | Athlete schema update | types.ts, athleteQueries.ts |
| 8 | Dev server routes | dev-server.ts |
| 9 | Sync integration | syncService.ts |
| 10 | SAM template | template.yaml |
| 11 | Integration test | Manual verification |

**Total estimated commits:** 11
