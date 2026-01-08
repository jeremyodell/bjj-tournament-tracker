# IBJJF Gym Data Loading Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Sync 8,500+ IBJJF gyms via paginated API, with change detection to skip unchanged syncs.

**Architecture:** Extend existing SourceGymItem schema with optional IBJJF fields. Create ibjjfGymFetcher for sequential pagination (200ms delay). Add GymSyncMetaItem for totalRecords tracking. Weekly Lambda via EventBridge with CloudWatch Alarm + SNS alerts.

**Tech Stack:** TypeScript, DynamoDB, AWS Lambda, EventBridge Scheduler, CloudWatch Alarms, SNS

---

## Task 1: Add IBJJF Types to Fetcher Types

**Files:**
- Modify: `backend/src/fetchers/types.ts`

**Step 1: Add IBJJF academy types**

Add at end of `backend/src/fetchers/types.ts`:

```typescript
// IBJJF Academy from API
export interface IBJJFAcademy {
  id: number;
  name: string;
  federationAbbr: string;
  country: string;
  countryAbbr: string;
  city: string;
  responsible: string;
  address: string;
  website: string | null;
}

// IBJJF Academies API response
export interface IBJJFAcademiesResponse {
  pagination: {
    page: number;
    pageSize: number;
    lastPage: number;
    totalRecords: number;
  };
  list: IBJJFAcademy[];
}
```

**Step 2: Verify TypeScript compiles**

Run: `cd backend && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add backend/src/fetchers/types.ts
git commit -m "feat(types): add IBJJF academy types for gym fetcher"
```

---

## Task 2: Extend SourceGymItem Schema

**Files:**
- Modify: `backend/src/db/types.ts`

**Step 1: Add optional IBJJF fields to SourceGymItem**

Update `SourceGymItem` interface (around line 166) to add optional fields after `updatedAt`:

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
  // Optional IBJJF-specific fields
  country?: string | null;
  countryCode?: string | null;
  city?: string | null;
  address?: string | null;
  federation?: string | null;
  website?: string | null;
  responsible?: string | null;
}
```

**Step 2: Add GymSyncMetaItem type**

Add after `TournamentGymRosterItem` interface (around line 194):

```typescript
// Gym sync metadata (tracks totalRecords for change detection)
export interface GymSyncMetaItem {
  PK: string; // GYMSYNC#{org}
  SK: 'META';
  org: 'JJWL' | 'IBJJF';
  totalRecords: number;
  lastSyncAt: string;
  lastChangeAt: string;
}
```

**Step 3: Add key builder for GymSyncMeta**

Add after `buildGymRosterSK` (around line 38):

```typescript
export const buildGymSyncMetaPK = (org: string): string =>
  `GYMSYNC#${org}`;
```

**Step 4: Update DynamoDBItem union**

Add `GymSyncMetaItem` to the union type (around line 206):

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
  | TournamentGymRosterItem
  | GymSyncMetaItem;
```

**Step 5: Verify TypeScript compiles**

Run: `cd backend && npx tsc --noEmit`
Expected: No errors

**Step 6: Commit**

```bash
git add backend/src/db/types.ts
git commit -m "feat(types): extend SourceGymItem with IBJJF fields, add GymSyncMetaItem"
```

---

## Task 3: Add Gym Sync Meta Queries

**Files:**
- Modify: `backend/src/db/gymQueries.ts`
- Create: `backend/src/__tests__/db/gymSyncMeta.test.ts`

**Step 1: Write the test file**

Create `backend/src/__tests__/db/gymSyncMeta.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { getGymSyncMeta, updateGymSyncMeta } from '../../db/gymQueries.js';

describe('gymSyncMeta queries', () => {
  describe('getGymSyncMeta', () => {
    it('returns null when no meta exists', async () => {
      const result = await getGymSyncMeta('IBJJF');
      // First run will be null
      expect(result === null || result.org === 'IBJJF').toBe(true);
    });
  });

  describe('updateGymSyncMeta', () => {
    it('creates meta record with totalRecords', async () => {
      await updateGymSyncMeta('IBJJF', 8576);
      const result = await getGymSyncMeta('IBJJF');

      expect(result).not.toBeNull();
      expect(result?.totalRecords).toBe(8576);
      expect(result?.org).toBe('IBJJF');
    });

    it('updates existing meta record', async () => {
      await updateGymSyncMeta('IBJJF', 8576);
      await updateGymSyncMeta('IBJJF', 8600);
      const result = await getGymSyncMeta('IBJJF');

      expect(result?.totalRecords).toBe(8600);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd backend && npm test -- --testPathPattern=gymSyncMeta`
Expected: FAIL - functions not defined

**Step 3: Add imports to gymQueries.ts**

Add to imports at top of `backend/src/db/gymQueries.ts`:

```typescript
import {
  buildSourceGymPK,
  buildSourceGymGSI1SK,
  buildTournamentPK,
  buildGymRosterSK,
  buildGymSyncMetaPK,
} from './types.js';
import type { SourceGymItem, TournamentGymRosterItem, GymSyncMetaItem } from './types.js';
```

**Step 4: Add getGymSyncMeta function**

Add at end of `backend/src/db/gymQueries.ts`:

```typescript
/**
 * Get gym sync metadata for an org
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
 */
export async function updateGymSyncMeta(
  org: 'JJWL' | 'IBJJF',
  totalRecords: number
): Promise<void> {
  const now = new Date().toISOString();
  const existing = await getGymSyncMeta(org);

  const item: GymSyncMetaItem = {
    PK: buildGymSyncMetaPK(org),
    SK: 'META',
    org,
    totalRecords,
    lastSyncAt: now,
    lastChangeAt: existing?.totalRecords !== totalRecords ? now : (existing?.lastChangeAt || now),
  };

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: item,
    })
  );
}
```

**Step 5: Run tests to verify they pass**

Run: `cd backend && npm test -- --testPathPattern=gymSyncMeta`
Expected: PASS (or skip if no local DynamoDB)

**Step 6: Verify TypeScript compiles**

Run: `cd backend && npx tsc --noEmit`
Expected: No errors

**Step 7: Commit**

```bash
git add backend/src/db/gymQueries.ts backend/src/__tests__/db/gymSyncMeta.test.ts
git commit -m "feat(db): add gym sync meta queries for change detection"
```

---

## Task 4: Create IBJJF Gym Fetcher

**Files:**
- Create: `backend/src/fetchers/ibjjfGymFetcher.ts`
- Create: `backend/src/__tests__/fetchers/ibjjfGymFetcher.test.ts`

**Step 1: Write the test file**

Create `backend/src/__tests__/fetchers/ibjjfGymFetcher.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  mapIBJJFAcademyToGym,
  parseIBJJFAcademiesResponse,
  sanitizeGymName,
} from '../../fetchers/ibjjfGymFetcher.js';
import type { IBJJFAcademy } from '../../fetchers/types.js';

describe('ibjjfGymFetcher', () => {
  describe('sanitizeGymName', () => {
    it('trims whitespace', () => {
      expect(sanitizeGymName('  Test Gym  ')).toBe('Test Gym');
    });

    it('removes # characters that could break GSI1SK', () => {
      expect(sanitizeGymName('Test#Gym#BJJ')).toBe('Test Gym BJJ');
    });

    it('handles empty string', () => {
      expect(sanitizeGymName('')).toBe('');
    });
  });

  describe('mapIBJJFAcademyToGym', () => {
    const baseAcademy: IBJJFAcademy = {
      id: 13240,
      name: 'FIGHT ACADEMY JMF',
      federationAbbr: 'CBJJ',
      country: 'Brasil',
      countryAbbr: 'BR',
      city: 'Manaus',
      responsible: 'Alex Taveira de Lira',
      address: 'Rua Cacique, 543',
      website: null,
    };

    it('maps basic fields correctly', () => {
      const result = mapIBJJFAcademyToGym(baseAcademy);

      expect(result.org).toBe('IBJJF');
      expect(result.externalId).toBe('13240');
      expect(result.name).toBe('FIGHT ACADEMY JMF');
    });

    it('includes extended IBJJF fields', () => {
      const result = mapIBJJFAcademyToGym(baseAcademy);

      expect(result.country).toBe('Brasil');
      expect(result.countryCode).toBe('BR');
      expect(result.city).toBe('Manaus');
      expect(result.federation).toBe('CBJJ');
      expect(result.responsible).toBe('Alex Taveira de Lira');
      expect(result.address).toBe('Rua Cacique, 543');
      expect(result.website).toBeNull();
    });

    it('handles website when present', () => {
      const withWebsite = { ...baseAcademy, website: 'https://test.com' };
      const result = mapIBJJFAcademyToGym(withWebsite);

      expect(result.website).toBe('https://test.com');
    });
  });

  describe('parseIBJJFAcademiesResponse', () => {
    it('parses valid response', () => {
      const response = {
        pagination: { page: 1, pageSize: 20, lastPage: 429, totalRecords: 8576 },
        list: [
          {
            id: 1,
            name: 'Test Gym',
            federationAbbr: 'USBJJF',
            country: 'USA',
            countryAbbr: 'US',
            city: 'Austin',
            responsible: 'John Doe',
            address: '123 Main St',
            website: null,
          },
        ],
      };

      const result = parseIBJJFAcademiesResponse(response);

      expect(result.gyms).toHaveLength(1);
      expect(result.pagination.totalRecords).toBe(8576);
    });

    it('filters out gyms with empty names', () => {
      const response = {
        pagination: { page: 1, pageSize: 20, lastPage: 1, totalRecords: 2 },
        list: [
          { id: 1, name: 'Valid Gym', federationAbbr: 'USBJJF', country: 'USA', countryAbbr: 'US', city: 'Austin', responsible: '', address: '', website: null },
          { id: 2, name: '', federationAbbr: 'USBJJF', country: 'USA', countryAbbr: 'US', city: 'Austin', responsible: '', address: '', website: null },
        ],
      };

      const result = parseIBJJFAcademiesResponse(response);

      expect(result.gyms).toHaveLength(1);
      expect(result.gyms[0].name).toBe('Valid Gym');
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd backend && npm test -- --testPathPattern=ibjjfGymFetcher`
Expected: FAIL - module not found

**Step 3: Create the fetcher**

Create `backend/src/fetchers/ibjjfGymFetcher.ts`:

```typescript
import type { IBJJFAcademy, IBJJFAcademiesResponse, NormalizedGym } from './types.js';

const IBJJF_ACADEMIES_URL = 'https://ibjjf.com/api/v1/academies/list.json';
const PAGE_DELAY_MS = 200;

// Extended gym type with IBJJF-specific fields
export interface IBJJFNormalizedGym extends NormalizedGym {
  country?: string | null;
  countryCode?: string | null;
  city?: string | null;
  address?: string | null;
  federation?: string | null;
  website?: string | null;
  responsible?: string | null;
}

/**
 * Sanitize gym name to prevent issues with DynamoDB GSI keys
 * Removes # characters which are used as delimiters in GSI1SK
 */
export function sanitizeGymName(name: string): string {
  return name.replace(/#/g, ' ').trim();
}

/**
 * Map IBJJF academy to extended normalized gym format
 */
export function mapIBJJFAcademyToGym(academy: IBJJFAcademy): IBJJFNormalizedGym {
  return {
    org: 'IBJJF',
    externalId: String(academy.id),
    name: sanitizeGymName(academy.name),
    country: academy.country || null,
    countryCode: academy.countryAbbr || null,
    city: academy.city || null,
    address: academy.address || null,
    federation: academy.federationAbbr || null,
    website: academy.website || null,
    responsible: academy.responsible || null,
  };
}

/**
 * Parse and validate IBJJF academies response
 */
export function parseIBJJFAcademiesResponse(data: unknown): {
  gyms: IBJJFNormalizedGym[];
  pagination: IBJJFAcademiesResponse['pagination'];
} {
  const response = data as IBJJFAcademiesResponse;

  if (!response.pagination || !Array.isArray(response.list)) {
    console.warn('[IBJJFGymFetcher] Invalid response structure');
    return {
      gyms: [],
      pagination: { page: 0, pageSize: 0, lastPage: 0, totalRecords: 0 },
    };
  }

  const gyms = response.list
    .filter((academy) => {
      if (!academy.id || !academy.name || !academy.name.trim()) {
        return false;
      }
      return true;
    })
    .map(mapIBJJFAcademyToGym);

  return {
    gyms,
    pagination: response.pagination,
  };
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch a single page of IBJJF academies
 */
export async function fetchIBJJFGymPage(page: number): Promise<{
  gyms: IBJJFNormalizedGym[];
  pagination: IBJJFAcademiesResponse['pagination'];
}> {
  const url = `${IBJJF_ACADEMIES_URL}?page=${page}`;

  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json, text/javascript, */*; q=0.01',
      'X-Requested-With': 'XMLHttpRequest',
      'Referer': 'https://ibjjf.com/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  });

  if (!response.ok) {
    throw new Error(`IBJJF academies API returned ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  return parseIBJJFAcademiesResponse(data);
}

/**
 * Fetch just the total count (for change detection)
 */
export async function fetchIBJJFGymCount(): Promise<number> {
  const result = await fetchIBJJFGymPage(1);
  return result.pagination.totalRecords;
}

/**
 * Fetch all IBJJF gyms with sequential pagination
 */
export async function fetchAllIBJJFGyms(options?: {
  onProgress?: (page: number, totalPages: number) => void;
}): Promise<IBJJFNormalizedGym[]> {
  console.log('[IBJJFGymFetcher] Starting full gym sync...');

  // Fetch first page to get pagination info
  const firstPage = await fetchIBJJFGymPage(1);
  const totalPages = firstPage.pagination.lastPage;
  const allGyms: IBJJFNormalizedGym[] = [...firstPage.gyms];

  console.log(`[IBJJFGymFetcher] Total pages: ${totalPages}, Total records: ${firstPage.pagination.totalRecords}`);
  options?.onProgress?.(1, totalPages);

  // Fetch remaining pages with delay
  for (let page = 2; page <= totalPages; page++) {
    await sleep(PAGE_DELAY_MS);

    try {
      const result = await fetchIBJJFGymPage(page);
      allGyms.push(...result.gyms);
      options?.onProgress?.(page, totalPages);

      if (page % 50 === 0) {
        console.log(`[IBJJFGymFetcher] Progress: ${page}/${totalPages} pages`);
      }
    } catch (error) {
      // Log error but continue with remaining pages
      console.error(`[IBJJFGymFetcher] Error on page ${page}:`, error);
      // Skip malformed page, continue
    }
  }

  console.log(`[IBJJFGymFetcher] Completed: ${allGyms.length} gyms fetched`);
  return allGyms;
}
```

**Step 4: Run tests to verify they pass**

Run: `cd backend && npm test -- --testPathPattern=ibjjfGymFetcher`
Expected: PASS

**Step 5: Verify TypeScript compiles**

Run: `cd backend && npx tsc --noEmit`
Expected: No errors

**Step 6: Commit**

```bash
git add backend/src/fetchers/ibjjfGymFetcher.ts backend/src/__tests__/fetchers/ibjjfGymFetcher.test.ts
git commit -m "feat(fetcher): add IBJJF gym fetcher with pagination"
```

---

## Task 5: Update Gym Queries for Extended Fields

**Files:**
- Modify: `backend/src/db/gymQueries.ts`

**Step 1: Update upsertSourceGym to accept extended fields**

Update the `upsertSourceGym` function signature and body:

```typescript
import type { IBJJFNormalizedGym } from '../fetchers/ibjjfGymFetcher.js';

/**
 * Upsert a source gym (from JJWL, IBJJF, etc.)
 * Supports both basic NormalizedGym and extended IBJJFNormalizedGym
 */
export async function upsertSourceGym(gym: NormalizedGym | IBJJFNormalizedGym): Promise<void> {
  const now = new Date().toISOString();
  const extendedGym = gym as IBJJFNormalizedGym;

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
    // Optional IBJJF fields
    country: extendedGym.country ?? null,
    countryCode: extendedGym.countryCode ?? null,
    city: extendedGym.city ?? null,
    address: extendedGym.address ?? null,
    federation: extendedGym.federation ?? null,
    website: extendedGym.website ?? null,
    responsible: extendedGym.responsible ?? null,
  };

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: item,
    })
  );
}
```

**Step 2: Verify TypeScript compiles**

Run: `cd backend && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add backend/src/db/gymQueries.ts
git commit -m "feat(db): extend upsertSourceGym for IBJJF fields"
```

---

## Task 6: Create Gym Sync Service

**Files:**
- Create: `backend/src/services/gymSyncService.ts`
- Create: `backend/src/__tests__/services/gymSyncService.test.ts`

**Step 1: Write the test file**

Create `backend/src/__tests__/services/gymSyncService.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before importing
vi.mock('../../fetchers/ibjjfGymFetcher.js', () => ({
  fetchIBJJFGymCount: vi.fn(),
  fetchAllIBJJFGyms: vi.fn(),
}));

vi.mock('../../db/gymQueries.js', () => ({
  getGymSyncMeta: vi.fn(),
  updateGymSyncMeta: vi.fn(),
  batchUpsertGyms: vi.fn(),
}));

import { syncIBJJFGyms } from '../../services/gymSyncService.js';
import { fetchIBJJFGymCount, fetchAllIBJJFGyms } from '../../fetchers/ibjjfGymFetcher.js';
import { getGymSyncMeta, updateGymSyncMeta, batchUpsertGyms } from '../../db/gymQueries.js';

describe('gymSyncService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('syncIBJJFGyms', () => {
    it('skips sync when totalRecords unchanged', async () => {
      vi.mocked(fetchIBJJFGymCount).mockResolvedValue(8576);
      vi.mocked(getGymSyncMeta).mockResolvedValue({
        PK: 'GYMSYNC#IBJJF',
        SK: 'META',
        org: 'IBJJF',
        totalRecords: 8576,
        lastSyncAt: '2026-01-01T00:00:00Z',
        lastChangeAt: '2026-01-01T00:00:00Z',
      });

      const result = await syncIBJJFGyms();

      expect(result.skipped).toBe(true);
      expect(fetchAllIBJJFGyms).not.toHaveBeenCalled();
    });

    it('runs full sync when totalRecords changed', async () => {
      const mockGyms = [
        { org: 'IBJJF' as const, externalId: '1', name: 'Gym A' },
        { org: 'IBJJF' as const, externalId: '2', name: 'Gym B' },
      ];

      vi.mocked(fetchIBJJFGymCount).mockResolvedValue(8600);
      vi.mocked(getGymSyncMeta).mockResolvedValue({
        PK: 'GYMSYNC#IBJJF',
        SK: 'META',
        org: 'IBJJF',
        totalRecords: 8576,
        lastSyncAt: '2026-01-01T00:00:00Z',
        lastChangeAt: '2026-01-01T00:00:00Z',
      });
      vi.mocked(fetchAllIBJJFGyms).mockResolvedValue(mockGyms);
      vi.mocked(batchUpsertGyms).mockResolvedValue(2);

      const result = await syncIBJJFGyms();

      expect(result.skipped).toBe(false);
      expect(result.fetched).toBe(2);
      expect(result.saved).toBe(2);
      expect(updateGymSyncMeta).toHaveBeenCalledWith('IBJJF', 8600);
    });

    it('runs full sync with forceSync=true regardless of totalRecords', async () => {
      const mockGyms = [{ org: 'IBJJF' as const, externalId: '1', name: 'Gym A' }];

      vi.mocked(fetchIBJJFGymCount).mockResolvedValue(8576);
      vi.mocked(getGymSyncMeta).mockResolvedValue({
        PK: 'GYMSYNC#IBJJF',
        SK: 'META',
        org: 'IBJJF',
        totalRecords: 8576, // Same as current
        lastSyncAt: '2026-01-01T00:00:00Z',
        lastChangeAt: '2026-01-01T00:00:00Z',
      });
      vi.mocked(fetchAllIBJJFGyms).mockResolvedValue(mockGyms);
      vi.mocked(batchUpsertGyms).mockResolvedValue(1);

      const result = await syncIBJJFGyms({ forceSync: true });

      expect(result.skipped).toBe(false);
      expect(fetchAllIBJJFGyms).toHaveBeenCalled();
    });

    it('handles fetch errors gracefully', async () => {
      vi.mocked(fetchIBJJFGymCount).mockRejectedValue(new Error('Network error'));

      const result = await syncIBJJFGyms();

      expect(result.skipped).toBe(false);
      expect(result.error).toBe('Network error');
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd backend && npm test -- --testPathPattern=services/gymSyncService`
Expected: FAIL - module not found

**Step 3: Create the service**

Create `backend/src/services/gymSyncService.ts`:

```typescript
import { fetchIBJJFGymCount, fetchAllIBJJFGyms } from '../fetchers/ibjjfGymFetcher.js';
import { getGymSyncMeta, updateGymSyncMeta, batchUpsertGyms } from '../db/gymQueries.js';

export interface IBJJFGymSyncResult {
  skipped: boolean;
  previousTotal: number;
  currentTotal: number;
  fetched: number;
  saved: number;
  duration: number;
  error?: string;
}

export interface SyncOptions {
  forceSync?: boolean;
}

/**
 * Sync IBJJF gyms to database
 * Checks totalRecords first - skips if unchanged (unless forceSync=true)
 */
export async function syncIBJJFGyms(options: SyncOptions = {}): Promise<IBJJFGymSyncResult> {
  const startTime = Date.now();

  try {
    // 1. Get current total from API
    console.log('[GymSyncService] Checking IBJJF gym count...');
    const currentTotal = await fetchIBJJFGymCount();

    // 2. Get last known total from DB
    const meta = await getGymSyncMeta('IBJJF');
    const previousTotal = meta?.totalRecords ?? 0;

    console.log(`[GymSyncService] Previous: ${previousTotal}, Current: ${currentTotal}`);

    // 3. Skip if unchanged (unless forceSync)
    if (!options.forceSync && meta && meta.totalRecords === currentTotal) {
      console.log('[GymSyncService] No change detected, skipping sync');
      return {
        skipped: true,
        previousTotal,
        currentTotal,
        fetched: 0,
        saved: 0,
        duration: Date.now() - startTime,
      };
    }

    // 4. Full sync needed
    console.log('[GymSyncService] Change detected or forceSync, running full sync...');
    const gyms = await fetchAllIBJJFGyms();
    const saved = await batchUpsertGyms(gyms);

    // 5. Update sync metadata
    await updateGymSyncMeta('IBJJF', currentTotal);

    return {
      skipped: false,
      previousTotal,
      currentTotal,
      fetched: gyms.length,
      saved,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[GymSyncService] Sync failed:', message);

    return {
      skipped: false,
      previousTotal: 0,
      currentTotal: 0,
      fetched: 0,
      saved: 0,
      duration: Date.now() - startTime,
      error: message,
    };
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `cd backend && npm test -- --testPathPattern=services/gymSyncService`
Expected: PASS

**Step 5: Verify TypeScript compiles**

Run: `cd backend && npx tsc --noEmit`
Expected: No errors

**Step 6: Commit**

```bash
git add backend/src/services/gymSyncService.ts backend/src/__tests__/services/gymSyncService.test.ts
git commit -m "feat(service): add IBJJF gym sync service with change detection"
```

---

## Task 7: Create Gym Sync Lambda Handler

**Files:**
- Create: `backend/src/handlers/gymSync.ts`

**Step 1: Create the handler**

Create `backend/src/handlers/gymSync.ts`:

```typescript
import type { ScheduledEvent, Context } from 'aws-lambda';
import { syncIBJJFGyms, type IBJJFGymSyncResult } from '../services/gymSyncService.js';

interface GymSyncEvent extends Partial<ScheduledEvent> {
  forceSync?: boolean;
}

interface GymSyncResponse {
  success: boolean;
  result: IBJJFGymSyncResult;
}

export async function handler(
  event: GymSyncEvent,
  context: Context
): Promise<GymSyncResponse> {
  console.log('Starting IBJJF gym sync', {
    requestId: context.awsRequestId,
    source: event.source || 'manual',
    forceSync: event.forceSync || false,
  });

  try {
    const result = await syncIBJJFGyms({
      forceSync: event.forceSync,
    });

    console.log('Gym sync completed', {
      requestId: context.awsRequestId,
      skipped: result.skipped,
      fetched: result.fetched,
      saved: result.saved,
      duration: result.duration,
      error: result.error,
    });

    // Throw if there was an error to trigger CloudWatch alarm
    if (result.error) {
      throw new Error(`Gym sync failed: ${result.error}`);
    }

    return {
      success: true,
      result,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    console.error('Gym sync failed with unexpected error', {
      requestId: context.awsRequestId,
      error: message,
    });

    throw error; // Re-throw to trigger CloudWatch alarm
  }
}
```

**Step 2: Verify TypeScript compiles**

Run: `cd backend && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add backend/src/handlers/gymSync.ts
git commit -m "feat(handler): add gym sync Lambda handler"
```

---

## Task 8: Add SNS AlertsTopic to SAM Template

**Files:**
- Modify: `backend/template.yaml`

**Step 1: Add Parameters for alert email**

Add after existing Parameters section:

```yaml
  AlertEmail:
    Type: String
    Default: ''
    Description: Email address for CloudWatch alarm notifications
```

**Step 2: Add SNS Topic resource**

Add in Resources section (before the Alarms):

```yaml
  # SNS Topic for Alerts
  AlertsTopic:
    Type: AWS::SNS::Topic
    Properties:
      TopicName: !Sub ${Stage}-bjj-alerts
      DisplayName: BJJ Tournament Tracker Alerts

  AlertsEmailSubscription:
    Type: AWS::SNS::Subscription
    Condition: HasAlertEmail
    Properties:
      TopicArn: !Ref AlertsTopic
      Protocol: email
      Endpoint: !Ref AlertEmail
```

**Step 3: Add Condition for email**

Add in Conditions section (create if doesn't exist):

```yaml
Conditions:
  HasAlertEmail: !Not [!Equals [!Ref AlertEmail, '']]
```

**Step 4: Verify template**

Run: `cd backend && sam validate`
Expected: Template is valid

**Step 5: Commit**

```bash
git add backend/template.yaml
git commit -m "feat(infra): add SNS AlertsTopic for alarm notifications"
```

---

## Task 9: Add GymSyncFunction to SAM Template

**Files:**
- Modify: `backend/template.yaml`

**Step 1: Add GymSyncFunction resource**

Add after existing Lambda functions:

```yaml
  GymSyncFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: !Sub bjj-gym-sync-${Stage}
      Handler: dist/handlers/gymSync.handler
      CodeUri: .
      Description: Syncs IBJJF gym data weekly
      Timeout: 900
      MemorySize: 256
      Policies:
        - DynamoDBCrudPolicy:
            TableName: !Ref TournamentsTable
      Environment:
        Variables:
          DYNAMODB_TABLE: !Ref TournamentsTable
      Events:
        WeeklySchedule:
          Type: ScheduleV2
          Properties:
            ScheduleExpression: "cron(0 6 ? * SUN *)"
            Description: Weekly IBJJF gym sync (Sunday 6am UTC)
    Metadata:
      BuildMethod: esbuild
      BuildProperties:
        Minify: true
        Target: es2022
        Sourcemap: true
        EntryPoints:
          - src/handlers/gymSync.ts
        External:
          - '@aws-sdk/*'
```

**Step 2: Add CloudWatch Alarm for GymSync**

Add after other alarms:

```yaml
  GymSyncFunctionErrorAlarm:
    Type: AWS::CloudWatch::Alarm
    Properties:
      AlarmName: !Sub ${Stage}-gym-sync-errors
      AlarmDescription: Alarm when Gym Sync function has errors
      MetricName: Errors
      Namespace: AWS/Lambda
      Dimensions:
        - Name: FunctionName
          Value: !Ref GymSyncFunction
      Statistic: Sum
      Period: 300
      EvaluationPeriods: 1
      Threshold: 1
      ComparisonOperator: GreaterThanOrEqualToThreshold
      TreatMissingData: notBreaching
      AlarmActions:
        - !Ref AlertsTopic
      OKActions:
        - !Ref AlertsTopic
```

**Step 3: Verify template**

Run: `cd backend && sam validate`
Expected: Template is valid

**Step 4: Commit**

```bash
git add backend/template.yaml
git commit -m "feat(infra): add GymSyncFunction with weekly schedule and alarm"
```

---

## Task 10: Add Dev Server Route for Manual Sync

**Files:**
- Modify: `backend/src/dev-server.ts`

**Step 1: Find dev-server.ts and add gym sync route**

Add import at top:

```typescript
import { syncIBJJFGyms } from './services/gymSyncService.js';
```

Add route after other routes:

```typescript
// Manual gym sync endpoint
app.post('/gym-sync', async (req, res) => {
  const forceSync = req.query.force === 'true';
  console.log(`[DevServer] Starting IBJJF gym sync (force=${forceSync})`);

  try {
    const result = await syncIBJJFGyms({ forceSync });
    res.json({ success: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
  }
});
```

**Step 2: Verify dev server starts**

Run: `cd backend && npm run dev`
Expected: Server starts without errors

**Step 3: Commit**

```bash
git add backend/src/dev-server.ts
git commit -m "feat(dev-server): add manual gym sync endpoint"
```

---

## Task 11: Update Existing Alarms with AlarmActions

**Files:**
- Modify: `backend/template.yaml`

**Step 1: Add AlarmActions to existing alarms**

Update `TournamentsFunctionErrorAlarm` and `SyncFunctionErrorAlarm` to include:

```yaml
      AlarmActions:
        - !Ref AlertsTopic
      OKActions:
        - !Ref AlertsTopic
```

**Step 2: Verify template**

Run: `cd backend && sam validate`
Expected: Template is valid

**Step 3: Commit**

```bash
git add backend/template.yaml
git commit -m "feat(infra): connect existing alarms to AlertsTopic"
```

---

## Task 12: Final Integration Test

**Step 1: Run all backend tests**

Run: `cd backend && npm test`
Expected: All tests pass

**Step 2: Build the project**

Run: `cd backend && sam build`
Expected: Build succeeds

**Step 3: Test locally**

Run in terminal 1: `cd backend && docker compose up -d && npm run dev`

Run in terminal 2:
```bash
# Test gym count check
curl -X POST "http://localhost:3001/gym-sync"

# Test force sync (will take ~8 min)
curl -X POST "http://localhost:3001/gym-sync?force=true"
```

**Step 4: Verify gym data**

```bash
curl "http://localhost:3001/gyms?org=IBJJF&search=10th"
```

Expected: Returns IBJJF gyms matching "10th"

**Step 5: Commit any final fixes**

```bash
git add -A
git commit -m "chore: final integration verification"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | IBJJF academy types | fetchers/types.ts |
| 2 | Extended SourceGymItem + GymSyncMetaItem | db/types.ts |
| 3 | Gym sync meta queries | db/gymQueries.ts |
| 4 | IBJJF gym fetcher with pagination | fetchers/ibjjfGymFetcher.ts |
| 5 | Update upsertSourceGym for extended fields | db/gymQueries.ts |
| 6 | Gym sync service with change detection | services/gymSyncService.ts |
| 7 | Gym sync Lambda handler | handlers/gymSync.ts |
| 8 | SNS AlertsTopic | template.yaml |
| 9 | GymSyncFunction + EventBridge | template.yaml |
| 10 | Dev server manual sync route | dev-server.ts |
| 11 | Connect existing alarms to SNS | template.yaml |
| 12 | Integration test | Manual |

**Total commits:** 12
