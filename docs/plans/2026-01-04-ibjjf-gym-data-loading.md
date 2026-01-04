# IBJJF Gym Data Loading Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Load and sync ~8,500 gym/academy records from the IBJJF API to enable gym-based features.

**Architecture:** Extend existing JJWL gym infrastructure with IBJJF-specific fields, add change detection via sync metadata, and create a weekly scheduled Lambda with CloudWatch alerting.

**Tech Stack:** TypeScript, AWS Lambda, DynamoDB, EventBridge, SNS, SAM/CloudFormation

---

## Task 1: Add IBJJF Types to fetchers/types.ts (ODE-23)

**Files:**
- Modify: `backend/src/fetchers/types.ts`

**Step 1: Add IBJJF academy types**

Add after line 75 (after `JJWLRosterAthlete`):

```typescript
// IBJJF Academy from API
export interface IBJJFAcademy {
  id: number;
  name: string;
  country: string;
  countryCode: string;
  city: string;
  address: string;
  federation: string;
  site: string;
  responsible: string;
}

// IBJJF API response structure
export interface IBJJFAcademiesResponse {
  data: IBJJFAcademy[];
  totalRecords: number;
  filteredRecords: number;
}

// Extended normalized gym with IBJJF fields
export interface IBJJFNormalizedGym extends NormalizedGym {
  country?: string;
  countryCode?: string;
  city?: string;
  address?: string;
  federation?: string;
  website?: string;
  responsible?: string;
}
```

**Step 2: Run TypeScript check**

Run: `cd backend && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add backend/src/fetchers/types.ts
git commit -m "feat(types): add IBJJF academy types for gym sync"
```

---

## Task 2: Add GymSyncMetaItem Type and Key Builder (ODE-23)

**Files:**
- Modify: `backend/src/db/types.ts`

**Step 1: Add key builder for gym sync meta**

Add after line 38 (after `buildGymRosterSK`):

```typescript
export const buildGymSyncMetaPK = (org: string): string =>
  `GYMSYNC#${org}`;
```

**Step 2: Add GymSyncMetaItem interface**

Add after line 196 (after `TournamentGymRosterItem`):

```typescript
// Gym sync metadata for change detection
export interface GymSyncMetaItem {
  PK: string; // GYMSYNC#{org}
  SK: 'META';
  org: 'JJWL' | 'IBJJF';
  totalRecords: number;
  lastSyncAt: string;
  lastChangeAt: string; // When totalRecords last changed
}
```

**Step 3: Extend SourceGymItem with optional IBJJF fields**

Modify `SourceGymItem` (lines 168-179) to add optional fields:

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
  // Optional IBJJF fields
  country?: string | null;
  countryCode?: string | null;
  city?: string | null;
  address?: string | null;
  federation?: string | null;
  website?: string | null;
  responsible?: string | null;
  createdAt: string;
  updatedAt: string;
}
```

**Step 4: Update DynamoDBItem union type**

Add `GymSyncMetaItem` to the union (around line 208):

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

**Step 5: Run TypeScript check and tests**

Run: `cd backend && npx tsc --noEmit && npm test`
Expected: All pass

**Step 6: Commit**

```bash
git add backend/src/db/types.ts
git commit -m "feat(types): add GymSyncMetaItem and extend SourceGymItem for IBJJF"
```

---

## Task 3: Add Gym Sync Meta Queries (ODE-24)

**Files:**
- Modify: `backend/src/db/gymQueries.ts`
- Create: `backend/src/__tests__/db/gymSyncMetaQueries.test.ts`

**Step 1: Write failing test for getGymSyncMeta**

Create `backend/src/__tests__/db/gymSyncMetaQueries.test.ts`:

```typescript
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { getGymSyncMeta, updateGymSyncMeta } from '../../db/gymQueries.js';
import { docClient } from '../../db/client.js';
import type { GymSyncMetaItem } from '../../db/types.js';

jest.mock('../../db/client.js', () => ({
  docClient: {
    send: jest.fn(),
  },
  TABLE_NAME: 'bjj-tournament-tracker-test',
  GSI1_NAME: 'GSI1',
}));

const mockSend = docClient.send as jest.MockedFunction<typeof docClient.send>;

describe('gymSyncMetaQueries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getGymSyncMeta', () => {
    it('should return sync meta when found', async () => {
      const mockMeta: GymSyncMetaItem = {
        PK: 'GYMSYNC#IBJJF',
        SK: 'META',
        org: 'IBJJF',
        totalRecords: 8573,
        lastSyncAt: '2026-01-01T00:00:00Z',
        lastChangeAt: '2026-01-01T00:00:00Z',
      };

      mockSend.mockResolvedValueOnce({ Item: mockMeta } as never);

      const result = await getGymSyncMeta('IBJJF');

      expect(result).not.toBeNull();
      expect(result?.totalRecords).toBe(8573);
      expect(result?.org).toBe('IBJJF');
    });

    it('should return null when not found (first sync)', async () => {
      mockSend.mockResolvedValueOnce({ Item: undefined } as never);

      const result = await getGymSyncMeta('IBJJF');

      expect(result).toBeNull();
    });

    it('should query with correct key structure', async () => {
      mockSend.mockResolvedValueOnce({ Item: undefined } as never);

      await getGymSyncMeta('IBJJF');

      const input = mockSend.mock.calls[0][0].input as any;
      expect(input.Key.PK).toBe('GYMSYNC#IBJJF');
      expect(input.Key.SK).toBe('META');
    });
  });

  describe('updateGymSyncMeta', () => {
    it('should update lastChangeAt when totalRecords changes', async () => {
      mockSend.mockResolvedValueOnce({} as never);

      await updateGymSyncMeta('IBJJF', 8573, 8500);

      const input = mockSend.mock.calls[0][0].input as any;
      expect(input.Item.PK).toBe('GYMSYNC#IBJJF');
      expect(input.Item.totalRecords).toBe(8573);
      expect(input.Item.lastChangeAt).toBeDefined();
    });

    it('should preserve lastChangeAt when totalRecords unchanged', async () => {
      const existingChangeAt = '2026-01-01T00:00:00Z';
      mockSend.mockResolvedValueOnce({} as never);

      await updateGymSyncMeta('IBJJF', 8573, 8573, existingChangeAt);

      const input = mockSend.mock.calls[0][0].input as any;
      expect(input.Item.lastChangeAt).toBe(existingChangeAt);
    });

    it('should set lastChangeAt to now for first sync (no previous)', async () => {
      mockSend.mockResolvedValueOnce({} as never);

      await updateGymSyncMeta('IBJJF', 8573);

      const input = mockSend.mock.calls[0][0].input as any;
      expect(input.Item.lastChangeAt).toBeDefined();
      // lastChangeAt should be recent (within last second)
      const changeTime = new Date(input.Item.lastChangeAt).getTime();
      expect(Date.now() - changeTime).toBeLessThan(1000);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd backend && npm test -- --testPathPattern=gymSyncMetaQueries`
Expected: FAIL - getGymSyncMeta and updateGymSyncMeta not defined

**Step 3: Implement getGymSyncMeta and updateGymSyncMeta**

Add to `backend/src/db/gymQueries.ts` after line 9:

```typescript
import { buildGymSyncMetaPK } from './types.js';
import type { GymSyncMetaItem } from './types.js';
```

Then add the functions before `batchUpsertGyms`:

```typescript
/**
 * Get sync metadata for a gym source (for change detection)
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
 * Update sync metadata after a sync run
 * @param org - The gym source org
 * @param totalRecords - Current total records from API
 * @param previousTotal - Previous total records (for change detection)
 * @param existingChangeAt - Existing lastChangeAt to preserve if unchanged
 */
export async function updateGymSyncMeta(
  org: 'JJWL' | 'IBJJF',
  totalRecords: number,
  previousTotal?: number,
  existingChangeAt?: string
): Promise<void> {
  const now = new Date().toISOString();

  // Determine lastChangeAt: update if records changed, preserve if same
  let lastChangeAt: string;
  if (previousTotal === undefined || previousTotal !== totalRecords) {
    lastChangeAt = now;
  } else {
    lastChangeAt = existingChangeAt || now;
  }

  const item: GymSyncMetaItem = {
    PK: buildGymSyncMetaPK(org),
    SK: 'META',
    org,
    totalRecords,
    lastSyncAt: now,
    lastChangeAt,
  };

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: item,
    })
  );
}
```

**Step 4: Run test to verify it passes**

Run: `cd backend && npm test -- --testPathPattern=gymSyncMetaQueries`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/src/db/gymQueries.ts backend/src/__tests__/db/gymSyncMetaQueries.test.ts
git commit -m "feat(db): add gym sync meta queries for change detection"
```

---

## Task 4: Create IBJJF Gym Fetcher (ODE-25)

**Files:**
- Create: `backend/src/fetchers/ibjjfGymFetcher.ts`
- Create: `backend/src/__tests__/fetchers/ibjjfGymFetcher.test.ts`

**Step 1: Write failing test**

Create `backend/src/__tests__/fetchers/ibjjfGymFetcher.test.ts`:

```typescript
import { describe, it, expect } from '@jest/globals';
import {
  sanitizeGymName,
  mapIBJJFAcademyToGym,
  parseIBJJFAcademiesResponse,
} from '../../fetchers/ibjjfGymFetcher.js';
import type { IBJJFAcademy, IBJJFAcademiesResponse } from '../../fetchers/types.js';

describe('ibjjfGymFetcher', () => {
  describe('sanitizeGymName', () => {
    it('removes # characters that break GSI1SK', () => {
      expect(sanitizeGymName('Team #1 BJJ')).toBe('Team 1 BJJ');
    });

    it('trims whitespace', () => {
      expect(sanitizeGymName('  Alliance Atlanta  ')).toBe('Alliance Atlanta');
    });

    it('handles multiple # characters', () => {
      expect(sanitizeGymName('##Best#Gym##')).toBe('BestGym');
    });

    it('handles name with only # and whitespace', () => {
      expect(sanitizeGymName('  # # #  ')).toBe('');
    });
  });

  describe('mapIBJJFAcademyToGym', () => {
    it('maps all fields correctly', () => {
      const academy: IBJJFAcademy = {
        id: 12345,
        name: 'Alliance Atlanta',
        country: 'United States',
        countryCode: 'US',
        city: 'Atlanta',
        address: '123 Main St',
        federation: 'IBJJF',
        site: 'https://allianceatlanta.com',
        responsible: 'John Smith',
      };

      const result = mapIBJJFAcademyToGym(academy);

      expect(result.org).toBe('IBJJF');
      expect(result.externalId).toBe('12345');
      expect(result.name).toBe('Alliance Atlanta');
      expect(result.country).toBe('United States');
      expect(result.countryCode).toBe('US');
      expect(result.city).toBe('Atlanta');
      expect(result.address).toBe('123 Main St');
      expect(result.federation).toBe('IBJJF');
      expect(result.website).toBe('https://allianceatlanta.com');
      expect(result.responsible).toBe('John Smith');
    });

    it('sanitizes name with # characters', () => {
      const academy: IBJJFAcademy = {
        id: 1,
        name: 'Team #1',
        country: '',
        countryCode: '',
        city: '',
        address: '',
        federation: '',
        site: '',
        responsible: '',
      };

      const result = mapIBJJFAcademyToGym(academy);
      expect(result.name).toBe('Team 1');
    });

    it('handles empty optional fields', () => {
      const academy: IBJJFAcademy = {
        id: 999,
        name: 'Test Gym',
        country: '',
        countryCode: '',
        city: '',
        address: '',
        federation: '',
        site: '',
        responsible: '',
      };

      const result = mapIBJJFAcademyToGym(academy);

      expect(result.country).toBe('');
      expect(result.website).toBe('');
    });
  });

  describe('parseIBJJFAcademiesResponse', () => {
    it('parses valid response', () => {
      const response: IBJJFAcademiesResponse = {
        data: [
          {
            id: 1,
            name: 'Gym A',
            country: 'US',
            countryCode: 'US',
            city: 'NYC',
            address: '123 St',
            federation: 'IBJJF',
            site: '',
            responsible: '',
          },
          {
            id: 2,
            name: 'Gym B',
            country: 'BR',
            countryCode: 'BR',
            city: 'Rio',
            address: '456 Ave',
            federation: 'IBJJF',
            site: '',
            responsible: '',
          },
        ],
        totalRecords: 2,
        filteredRecords: 2,
      };

      const result = parseIBJJFAcademiesResponse(response);

      expect(result.gyms).toHaveLength(2);
      expect(result.totalRecords).toBe(2);
    });

    it('filters entries with empty name after sanitization', () => {
      const response: IBJJFAcademiesResponse = {
        data: [
          { id: 1, name: 'Valid Gym', country: '', countryCode: '', city: '', address: '', federation: '', site: '', responsible: '' },
          { id: 2, name: '###', country: '', countryCode: '', city: '', address: '', federation: '', site: '', responsible: '' },
        ],
        totalRecords: 2,
        filteredRecords: 2,
      };

      const result = parseIBJJFAcademiesResponse(response);

      expect(result.gyms).toHaveLength(1);
      expect(result.gyms[0].name).toBe('Valid Gym');
    });

    it('filters entries with id <= 0', () => {
      const response: IBJJFAcademiesResponse = {
        data: [
          { id: 1, name: 'Valid Gym', country: '', countryCode: '', city: '', address: '', federation: '', site: '', responsible: '' },
          { id: 0, name: 'Zero ID', country: '', countryCode: '', city: '', address: '', federation: '', site: '', responsible: '' },
          { id: -1, name: 'Negative ID', country: '', countryCode: '', city: '', address: '', federation: '', site: '', responsible: '' },
        ],
        totalRecords: 3,
        filteredRecords: 3,
      };

      const result = parseIBJJFAcademiesResponse(response);

      expect(result.gyms).toHaveLength(1);
    });

    it('handles null/undefined response', () => {
      const result = parseIBJJFAcademiesResponse(null as any);

      expect(result.gyms).toHaveLength(0);
      expect(result.totalRecords).toBe(0);
    });

    it('handles response without data array', () => {
      const result = parseIBJJFAcademiesResponse({ totalRecords: 0 } as any);

      expect(result.gyms).toHaveLength(0);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd backend && npm test -- --testPathPattern=ibjjfGymFetcher`
Expected: FAIL - module not found

**Step 3: Implement ibjjfGymFetcher.ts**

Create `backend/src/fetchers/ibjjfGymFetcher.ts`:

```typescript
import type {
  IBJJFAcademy,
  IBJJFAcademiesResponse,
  IBJJFNormalizedGym,
} from './types.js';

const IBJJF_ACADEMIES_URL =
  'https://ibjjf.com/api/academies/list';
const PAGE_SIZE = 20;
const RATE_LIMIT_DELAY_MS = 200;

/**
 * Sanitize gym name - remove # characters that break GSI1SK pattern
 */
export function sanitizeGymName(name: string): string {
  return name.replace(/#/g, '').trim();
}

/**
 * Map IBJJF academy to extended normalized gym format
 */
export function mapIBJJFAcademyToGym(academy: IBJJFAcademy): IBJJFNormalizedGym {
  return {
    org: 'IBJJF',
    externalId: String(academy.id),
    name: sanitizeGymName(academy.name),
    country: academy.country,
    countryCode: academy.countryCode,
    city: academy.city,
    address: academy.address,
    federation: academy.federation,
    website: academy.site,
    responsible: academy.responsible,
  };
}

/**
 * Parse and validate IBJJF academies response
 */
export function parseIBJJFAcademiesResponse(
  response: unknown
): { gyms: IBJJFNormalizedGym[]; totalRecords: number } {
  if (!response || typeof response !== 'object') {
    console.warn('[IBJJFGymFetcher] Invalid response format');
    return { gyms: [], totalRecords: 0 };
  }

  const data = response as Partial<IBJJFAcademiesResponse>;

  if (!Array.isArray(data.data)) {
    console.warn('[IBJJFGymFetcher] Response data is not an array');
    return { gyms: [], totalRecords: data.totalRecords || 0 };
  }

  const gyms = data.data
    .filter((item): item is IBJJFAcademy => {
      if (!item || typeof item !== 'object') return false;
      const academy = item as Record<string, unknown>;
      if (typeof academy.id !== 'number' || academy.id <= 0) return false;
      if (typeof academy.name !== 'string') return false;
      const sanitized = sanitizeGymName(academy.name);
      return sanitized.length > 0;
    })
    .map(mapIBJJFAcademyToGym);

  return {
    gyms,
    totalRecords: data.totalRecords || 0,
  };
}

/**
 * Fetch a single page of IBJJF academies
 */
export async function fetchIBJJFGymPage(
  page: number
): Promise<{ gyms: IBJJFNormalizedGym[]; totalRecords: number }> {
  const start = page * PAGE_SIZE;

  const response = await fetch(
    `${IBJJF_ACADEMIES_URL}?start=${start}&length=${PAGE_SIZE}`,
    {
      headers: {
        accept: 'application/json',
        'x-requested-with': 'XMLHttpRequest',
      },
    }
  );

  if (!response.ok) {
    throw new Error(
      `IBJJF academies API returned ${response.status}: ${response.statusText}`
    );
  }

  const data = await response.json();
  return parseIBJJFAcademiesResponse(data);
}

/**
 * Fetch just the totalRecords count (for change detection)
 */
export async function fetchIBJJFGymCount(): Promise<number> {
  const { totalRecords } = await fetchIBJJFGymPage(0);
  return totalRecords;
}

/**
 * Progress callback for monitoring long-running sync
 */
export type ProgressCallback = (current: number, total: number) => void;

/**
 * Fetch all IBJJF academies with sequential pagination
 * ~429 pages at 20 items/page = ~8 minutes with 200ms delay
 */
export async function fetchAllIBJJFGyms(
  onProgress?: ProgressCallback
): Promise<IBJJFNormalizedGym[]> {
  console.log('[IBJJFGymFetcher] Starting full sync...');

  // First request to get total count
  const firstPage = await fetchIBJJFGymPage(0);
  const { totalRecords } = firstPage;
  const totalPages = Math.ceil(totalRecords / PAGE_SIZE);

  console.log(
    `[IBJJFGymFetcher] Total records: ${totalRecords}, pages: ${totalPages}`
  );

  const allGyms: IBJJFNormalizedGym[] = [...firstPage.gyms];
  onProgress?.(1, totalPages);

  // Fetch remaining pages sequentially with rate limiting
  for (let page = 1; page < totalPages; page++) {
    try {
      await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY_MS));
      const { gyms } = await fetchIBJJFGymPage(page);
      allGyms.push(...gyms);
      onProgress?.(page + 1, totalPages);

      if ((page + 1) % 50 === 0) {
        console.log(
          `[IBJJFGymFetcher] Progress: ${page + 1}/${totalPages} pages`
        );
      }
    } catch (error) {
      console.error(
        `[IBJJFGymFetcher] Error on page ${page}, skipping:`,
        error instanceof Error ? error.message : error
      );
      // Continue with next page on error
    }
  }

  console.log(`[IBJJFGymFetcher] Fetched ${allGyms.length} gyms total`);
  return allGyms;
}
```

**Step 4: Run tests to verify they pass**

Run: `cd backend && npm test -- --testPathPattern=ibjjfGymFetcher`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/src/fetchers/ibjjfGymFetcher.ts backend/src/__tests__/fetchers/ibjjfGymFetcher.test.ts
git commit -m "feat(fetchers): add IBJJF gym fetcher with pagination"
```

---

## Task 5: Update upsertSourceGym for IBJJF Fields (ODE-26)

**Files:**
- Modify: `backend/src/db/gymQueries.ts`
- Modify: `backend/src/__tests__/db/gymQueries.test.ts`

**Step 1: Write failing test for IBJJF extended fields**

Add to `backend/src/__tests__/db/gymQueries.test.ts` in the `upsertSourceGym` describe block:

```typescript
it('should handle IBJJF extended fields', async () => {
  mockSend.mockResolvedValueOnce({} as never);

  const gym = {
    org: 'IBJJF' as const,
    externalId: 'ibjjf-123',
    name: 'Alliance Atlanta',
    country: 'United States',
    countryCode: 'US',
    city: 'Atlanta',
    address: '123 Main St',
    federation: 'IBJJF',
    website: 'https://alliance.com',
    responsible: 'John Smith',
  };

  await upsertSourceGym(gym);

  const input = mockSend.mock.calls[0][0].input as any;
  expect(input.Item.country).toBe('United States');
  expect(input.Item.countryCode).toBe('US');
  expect(input.Item.city).toBe('Atlanta');
  expect(input.Item.address).toBe('123 Main St');
  expect(input.Item.federation).toBe('IBJJF');
  expect(input.Item.website).toBe('https://alliance.com');
  expect(input.Item.responsible).toBe('John Smith');
});

it('should set IBJJF fields to null when not provided (JJWL compat)', async () => {
  mockSend.mockResolvedValueOnce({} as never);

  const gym: NormalizedGym = {
    org: 'JJWL',
    externalId: 'jjwl-456',
    name: 'JJWL Academy',
  };

  await upsertSourceGym(gym);

  const input = mockSend.mock.calls[0][0].input as any;
  expect(input.Item.country).toBeNull();
  expect(input.Item.city).toBeNull();
});
```

**Step 2: Run test to verify it fails**

Run: `cd backend && npm test -- --testPathPattern=gymQueries`
Expected: FAIL - IBJJF fields not being persisted

**Step 3: Update upsertSourceGym to handle extended fields**

Modify `upsertSourceGym` in `backend/src/db/gymQueries.ts`:

```typescript
import type { NormalizedGym } from '../fetchers/types.js';
import type { IBJJFNormalizedGym } from '../fetchers/types.js';

/**
 * Upsert a source gym (from JJWL, IBJJF, etc.)
 * Handles both basic NormalizedGym and extended IBJJFNormalizedGym
 */
export async function upsertSourceGym(
  gym: NormalizedGym | IBJJFNormalizedGym
): Promise<void> {
  const now = new Date().toISOString();

  // Type assertion to access optional IBJJF fields
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
    // IBJJF extended fields (null for JJWL gyms)
    country: extendedGym.country ?? null,
    countryCode: extendedGym.countryCode ?? null,
    city: extendedGym.city ?? null,
    address: extendedGym.address ?? null,
    federation: extendedGym.federation ?? null,
    website: extendedGym.website ?? null,
    responsible: extendedGym.responsible ?? null,
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
```

**Step 4: Run tests to verify they pass**

Run: `cd backend && npm test -- --testPathPattern=gymQueries`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/src/db/gymQueries.ts backend/src/__tests__/db/gymQueries.test.ts
git commit -m "feat(db): extend upsertSourceGym to handle IBJJF fields"
```

---

## Task 6: Create IBJJF Gym Sync Service (ODE-27)

**Files:**
- Modify: `backend/src/services/gymSyncService.ts`
- Modify: `backend/src/__tests__/services/gymSyncService.test.ts`

**Step 1: Write failing tests for syncIBJJFGyms**

Add to `backend/src/__tests__/services/gymSyncService.test.ts`:

```typescript
import {
  syncJJWLGyms,
  syncIBJJFGyms,
} from '../../services/gymSyncService.js';
import * as ibjjfGymFetcher from '../../fetchers/ibjjfGymFetcher.js';
import * as gymQueries from '../../db/gymQueries.js';

// Add mocks for IBJJF functions
jest.mock('../../fetchers/ibjjfGymFetcher.js');
jest.mock('../../db/gymQueries.js');

const mockFetchIBJJFGymCount = ibjjfGymFetcher.fetchIBJJFGymCount as jest.MockedFunction<typeof ibjjfGymFetcher.fetchIBJJFGymCount>;
const mockFetchAllIBJJFGyms = ibjjfGymFetcher.fetchAllIBJJFGyms as jest.MockedFunction<typeof ibjjfGymFetcher.fetchAllIBJJFGyms>;
const mockGetGymSyncMeta = gymQueries.getGymSyncMeta as jest.MockedFunction<typeof gymQueries.getGymSyncMeta>;
const mockUpdateGymSyncMeta = gymQueries.updateGymSyncMeta as jest.MockedFunction<typeof gymQueries.updateGymSyncMeta>;
const mockBatchUpsertGyms = gymQueries.batchUpsertGyms as jest.MockedFunction<typeof gymQueries.batchUpsertGyms>;

describe('syncIBJJFGyms', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should skip sync when totalRecords unchanged', async () => {
    mockFetchIBJJFGymCount.mockResolvedValue(8573);
    mockGetGymSyncMeta.mockResolvedValue({
      PK: 'GYMSYNC#IBJJF',
      SK: 'META',
      org: 'IBJJF',
      totalRecords: 8573,
      lastSyncAt: '2026-01-01T00:00:00Z',
      lastChangeAt: '2026-01-01T00:00:00Z',
    });

    const result = await syncIBJJFGyms();

    expect(result.skipped).toBe(true);
    expect(result.fetched).toBe(0);
    expect(mockFetchAllIBJJFGyms).not.toHaveBeenCalled();
  });

  it('should perform full sync when totalRecords changed', async () => {
    mockFetchIBJJFGymCount.mockResolvedValue(8600);
    mockGetGymSyncMeta.mockResolvedValue({
      PK: 'GYMSYNC#IBJJF',
      SK: 'META',
      org: 'IBJJF',
      totalRecords: 8573,
      lastSyncAt: '2026-01-01T00:00:00Z',
      lastChangeAt: '2026-01-01T00:00:00Z',
    });
    mockFetchAllIBJJFGyms.mockResolvedValue([
      { org: 'IBJJF', externalId: '1', name: 'Gym 1' },
      { org: 'IBJJF', externalId: '2', name: 'Gym 2' },
    ]);
    mockBatchUpsertGyms.mockResolvedValue(2);
    mockUpdateGymSyncMeta.mockResolvedValue();

    const result = await syncIBJJFGyms();

    expect(result.skipped).toBe(false);
    expect(result.fetched).toBe(2);
    expect(result.saved).toBe(2);
    expect(mockFetchAllIBJJFGyms).toHaveBeenCalled();
    expect(mockUpdateGymSyncMeta).toHaveBeenCalledWith('IBJJF', 8600, 8573, expect.any(String));
  });

  it('should perform full sync on first run (no previous meta)', async () => {
    mockFetchIBJJFGymCount.mockResolvedValue(8573);
    mockGetGymSyncMeta.mockResolvedValue(null);
    mockFetchAllIBJJFGyms.mockResolvedValue([]);
    mockBatchUpsertGyms.mockResolvedValue(0);
    mockUpdateGymSyncMeta.mockResolvedValue();

    const result = await syncIBJJFGyms();

    expect(result.skipped).toBe(false);
    expect(mockFetchAllIBJJFGyms).toHaveBeenCalled();
  });

  it('should force sync even when totalRecords unchanged', async () => {
    mockFetchIBJJFGymCount.mockResolvedValue(8573);
    mockGetGymSyncMeta.mockResolvedValue({
      PK: 'GYMSYNC#IBJJF',
      SK: 'META',
      org: 'IBJJF',
      totalRecords: 8573,
      lastSyncAt: '2026-01-01T00:00:00Z',
      lastChangeAt: '2026-01-01T00:00:00Z',
    });
    mockFetchAllIBJJFGyms.mockResolvedValue([]);
    mockBatchUpsertGyms.mockResolvedValue(0);
    mockUpdateGymSyncMeta.mockResolvedValue();

    const result = await syncIBJJFGyms({ forceSync: true });

    expect(result.skipped).toBe(false);
    expect(mockFetchAllIBJJFGyms).toHaveBeenCalled();
  });

  it('should return error on API failure', async () => {
    mockFetchIBJJFGymCount.mockRejectedValue(new Error('API down'));

    const result = await syncIBJJFGyms();

    expect(result.error).toBe('API down');
    expect(result.skipped).toBe(false);
    expect(result.fetched).toBe(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd backend && npm test -- --testPathPattern=gymSyncService`
Expected: FAIL - syncIBJJFGyms not defined

**Step 3: Implement syncIBJJFGyms**

Add to `backend/src/services/gymSyncService.ts`:

```typescript
import {
  fetchIBJJFGymCount,
  fetchAllIBJJFGyms,
} from '../fetchers/ibjjfGymFetcher.js';
import {
  batchUpsertGyms,
  getGymSyncMeta,
  updateGymSyncMeta,
} from '../db/gymQueries.js';

export interface IBJJFGymSyncResult {
  skipped: boolean;
  fetched: number;
  saved: number;
  duration?: number;
  error?: string;
}

export interface IBJJFSyncOptions {
  forceSync?: boolean;
  onProgress?: (current: number, total: number) => void;
}

/**
 * Sync IBJJF gyms with change detection.
 * Skips full sync if totalRecords hasn't changed (unless forceSync=true).
 */
export async function syncIBJJFGyms(
  options: IBJJFSyncOptions = {}
): Promise<IBJJFGymSyncResult> {
  const { forceSync = false, onProgress } = options;
  const startTime = Date.now();

  try {
    // Get current count from API
    const totalRecords = await fetchIBJJFGymCount();

    // Get previous sync metadata
    const meta = await getGymSyncMeta('IBJJF');
    const previousTotal = meta?.totalRecords;
    const existingChangeAt = meta?.lastChangeAt;

    // Skip if unchanged (unless force)
    if (!forceSync && meta && previousTotal === totalRecords) {
      console.log(
        `[GymSyncService] IBJJF unchanged (${totalRecords} records), skipping sync`
      );
      return {
        skipped: true,
        fetched: 0,
        saved: 0,
        duration: Date.now() - startTime,
      };
    }

    console.log(
      `[GymSyncService] IBJJF sync starting: ${previousTotal || 0} -> ${totalRecords} records`
    );

    // Fetch all gyms
    const gyms = await fetchAllIBJJFGyms(onProgress);

    // Batch upsert to database
    const saved = await batchUpsertGyms(gyms);

    // Update sync metadata
    await updateGymSyncMeta('IBJJF', totalRecords, previousTotal, existingChangeAt);

    const duration = Date.now() - startTime;
    console.log(
      `[GymSyncService] IBJJF sync complete: ${gyms.length} fetched, ${saved} saved in ${duration}ms`
    );

    return {
      skipped: false,
      fetched: gyms.length,
      saved,
      duration,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[GymSyncService] IBJJF sync failed:', message);
    return {
      skipped: false,
      fetched: 0,
      saved: 0,
      duration: Date.now() - startTime,
      error: message,
    };
  }
}
```

**Step 4: Run tests**

Run: `cd backend && npm test -- --testPathPattern=gymSyncService`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/src/services/gymSyncService.ts backend/src/__tests__/services/gymSyncService.test.ts
git commit -m "feat(services): add IBJJF gym sync with change detection"
```

---

## Task 7: Create Gym Sync Lambda Handler (ODE-28)

**Files:**
- Create: `backend/src/handlers/gymSync.ts`
- Create: `backend/src/__tests__/handlers/gymSync.test.ts`

**Step 1: Write failing test**

Create `backend/src/__tests__/handlers/gymSync.test.ts`:

```typescript
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { handler } from '../../handlers/gymSync.js';
import * as gymSyncService from '../../services/gymSyncService.js';

jest.mock('../../services/gymSyncService.js');

const mockSyncIBJJFGyms = gymSyncService.syncIBJJFGyms as jest.MockedFunction<
  typeof gymSyncService.syncIBJJFGyms
>;

describe('gymSync handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should call syncIBJJFGyms and return success', async () => {
    mockSyncIBJJFGyms.mockResolvedValue({
      skipped: false,
      fetched: 8573,
      saved: 8573,
      duration: 480000,
    });

    const result = await handler(
      { forceSync: false },
      { awsRequestId: 'test-123' } as any
    );

    expect(result.success).toBe(true);
    expect(result.result.fetched).toBe(8573);
    expect(mockSyncIBJJFGyms).toHaveBeenCalledWith({ forceSync: false });
  });

  it('should pass forceSync from event', async () => {
    mockSyncIBJJFGyms.mockResolvedValue({
      skipped: false,
      fetched: 100,
      saved: 100,
    });

    await handler({ forceSync: true }, { awsRequestId: 'test-456' } as any);

    expect(mockSyncIBJJFGyms).toHaveBeenCalledWith({ forceSync: true });
  });

  it('should throw on sync error to trigger CloudWatch alarm', async () => {
    mockSyncIBJJFGyms.mockResolvedValue({
      skipped: false,
      fetched: 0,
      saved: 0,
      error: 'API timeout',
    });

    await expect(
      handler({}, { awsRequestId: 'test-789' } as any)
    ).rejects.toThrow('IBJJF gym sync failed: API timeout');
  });

  it('should return skipped result without error', async () => {
    mockSyncIBJJFGyms.mockResolvedValue({
      skipped: true,
      fetched: 0,
      saved: 0,
    });

    const result = await handler({}, { awsRequestId: 'test-skip' } as any);

    expect(result.success).toBe(true);
    expect(result.result.skipped).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd backend && npm test -- --testPathPattern=handlers/gymSync`
Expected: FAIL - module not found

**Step 3: Implement gymSync handler**

Create `backend/src/handlers/gymSync.ts`:

```typescript
import type { Context, ScheduledEvent } from 'aws-lambda';
import { syncIBJJFGyms, type IBJJFGymSyncResult } from '../services/gymSyncService.js';

interface GymSyncEvent {
  forceSync?: boolean;
}

interface GymSyncResponse {
  success: boolean;
  result: IBJJFGymSyncResult;
}

export async function handler(
  event: GymSyncEvent | ScheduledEvent,
  context: Context
): Promise<GymSyncResponse> {
  const requestId = context.awsRequestId;
  const source = 'source' in event ? event.source : 'manual';
  const forceSync = 'forceSync' in event ? event.forceSync === true : false;

  console.log(`[GymSync] Starting sync`, {
    requestId,
    source,
    forceSync,
  });

  const result = await syncIBJJFGyms({ forceSync });

  console.log(`[GymSync] Sync complete`, {
    requestId,
    ...result,
  });

  // Throw on error to trigger CloudWatch alarm
  if (result.error) {
    throw new Error(`IBJJF gym sync failed: ${result.error}`);
  }

  return {
    success: true,
    result,
  };
}
```

**Step 4: Run tests**

Run: `cd backend && npm test -- --testPathPattern=handlers/gymSync`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/src/handlers/gymSync.ts backend/src/__tests__/handlers/gymSync.test.ts
git commit -m "feat(handlers): add gym sync Lambda handler"
```

---

## Task 8: Add Dev Server Gym Sync Route (ODE-29)

**Files:**
- Modify: `backend/src/dev-server.ts`

**Step 1: Import sync service**

Add after line 21:

```typescript
const { syncIBJJFGyms } = await import('./services/gymSyncService.js');
```

**Step 2: Add POST /gym-sync route**

Add before the health check route (around line 139):

```typescript
// Gym sync route (for local testing)
app.post('/gym-sync', async (req: Request, res: Response) => {
  const forceSync = req.query.force === 'true';
  console.log(`[DevServer] Starting IBJJF gym sync (force=${forceSync})`);

  try {
    const result = await syncIBJJFGyms({ forceSync });
    res.json(result);
  } catch (error) {
    console.error('[DevServer] Gym sync error:', error);
    res.status(500).json({
      error: 'SYNC_FAILED',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});
```

**Step 3: Update banner to show new endpoint**

Update the banner (around line 160) to add:

```
║    POST /gym-sync                  Sync IBJJF gyms          ║
```

**Step 4: Verify dev server starts**

Run: `cd backend && npm run dev`
Expected: Server starts without errors, shows new endpoint in banner

**Step 5: Commit**

```bash
git add backend/src/dev-server.ts
git commit -m "feat(dev-server): add gym sync route for local testing"
```

---

## Task 9: Add SAM Infrastructure (ODE-30)

**Files:**
- Modify: `backend/template.yaml`

**Step 1: Add AlertEmail parameter**

Add after `GoogleMapsApiKey` parameter (around line 69):

```yaml
  AlertEmail:
    Type: String
    Default: ''
    Description: Email address for sync failure alerts (optional)
```

**Step 2: Add HasAlertEmail condition**

Add to Conditions section (around line 820):

```yaml
  HasAlertEmail: !Not
    - !Equals
      - !Ref AlertEmail
      - ''
```

**Step 3: Add AlertsTopic SNS resource**

Add after DynamoDB Table section (before Cognito):

```yaml
  # ============================================
  # SNS Alerts Topic
  # ============================================
  AlertsTopic:
    Type: AWS::SNS::Topic
    Condition: HasAlertEmail
    Properties:
      TopicName: !Sub bjj-tournament-alerts-${Stage}
      Tags:
        - Key: Project
          Value: bjj-tournament-tracker
        - Key: Environment
          Value: !Ref Stage

  AlertsEmailSubscription:
    Type: AWS::SNS::Subscription
    Condition: HasAlertEmail
    Properties:
      TopicArn: !Ref AlertsTopic
      Protocol: email
      Endpoint: !Ref AlertEmail
```

**Step 4: Add GymSyncFunction Lambda**

Add after GymsFunction (around line 467):

```yaml
  GymSyncFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: !Sub bjj-tournament-tracker-gym-sync-${Stage}
      Handler: dist/handlers/gymSync.handler
      CodeUri: .
      Description: Weekly IBJJF gym data sync
      Timeout: 900  # 15 minutes for ~8 min sync
      MemorySize: 256
      Policies:
        - DynamoDBCrudPolicy:
            TableName: !Ref TournamentsTable
      Events:
        WeeklySchedule:
          Type: Schedule
          Properties:
            Schedule: cron(0 6 ? * SUN *)
            Description: Weekly gym sync at 6 AM UTC on Sundays
            Enabled: true
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

  GymSyncFunctionErrorAlarm:
    Type: AWS::CloudWatch::Alarm
    Condition: HasAlertEmail
    Properties:
      AlarmName: !Sub ${Stage}-gym-sync-errors
      AlarmDescription: Alarm when Gym Sync function has errors
      MetricName: Errors
      Namespace: AWS/Lambda
      Statistic: Sum
      Period: 300
      EvaluationPeriods: 1
      Threshold: 1
      ComparisonOperator: GreaterThanOrEqualToThreshold
      Dimensions:
        - Name: FunctionName
          Value: !Ref GymSyncFunction
      AlarmActions:
        - !Ref AlertsTopic
      OKActions:
        - !Ref AlertsTopic
```

**Step 5: Add outputs**

Add to Outputs section:

```yaml
  GymSyncFunctionArn:
    Description: Gym Sync Lambda Function ARN
    Value: !GetAtt GymSyncFunction.Arn

  AlertsTopicArn:
    Condition: HasAlertEmail
    Description: SNS Topic ARN for alerts
    Value: !Ref AlertsTopic
```

**Step 6: Validate and build**

Run:
```bash
cd backend
sam validate
sam build
```
Expected: Both pass

**Step 7: Commit**

```bash
git add backend/template.yaml
git commit -m "feat(infra): add gym sync Lambda with weekly schedule and alerts"
```

---

## Task 10: Integration Testing (ODE-31)

**Step 1: Run all backend tests**

Run: `cd backend && npm test`
Expected: All tests pass

**Step 2: Run TypeScript check**

Run: `cd backend && npx tsc --noEmit`
Expected: No errors

**Step 3: Run SAM build**

Run: `cd backend && sam build`
Expected: Build succeeds

**Step 4: Test dev server (manual)**

1. Start local DynamoDB: `docker compose up -d`
2. Start dev server: `npm run dev`
3. Test gym sync: `curl -X POST "http://localhost:3001/gym-sync"`
4. Verify response contains `{ "skipped": false, "fetched": ..., "saved": ... }`
5. Query IBJJF gyms: `curl "http://localhost:3001/api/gyms?org=IBJJF&search=10th"`
6. Verify IBJJF gyms are returned

**Step 5: Commit any fixes**

If any issues were found and fixed:

```bash
git add -A
git commit -m "fix: address integration test issues"
```

---

## Summary

| Task | Story | Files | Status |
|------|-------|-------|--------|
| 1 | ODE-23 | fetchers/types.ts | - |
| 2 | ODE-23 | db/types.ts | - |
| 3 | ODE-24 | db/gymQueries.ts, tests | - |
| 4 | ODE-25 | fetchers/ibjjfGymFetcher.ts, tests | - |
| 5 | ODE-26 | db/gymQueries.ts, tests | - |
| 6 | ODE-27 | services/gymSyncService.ts, tests | - |
| 7 | ODE-28 | handlers/gymSync.ts, tests | - |
| 8 | ODE-29 | dev-server.ts | - |
| 9 | ODE-30 | template.yaml | - |
| 10 | ODE-31 | Integration testing | - |
