# IBJJF Gym Fetcher Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement a fetcher to retrieve academy data from IBJJF API with sequential pagination and rate limiting.

**Architecture:** Create `ibjjfGymFetcher.ts` following the JJWL gym fetcher pattern. Uses direct fetch with XMLHttpRequest header, sequential pagination with 200ms delay, and graceful error handling for malformed pages.

**Tech Stack:** TypeScript, Node.js fetch API, Jest for testing

---

## Task 1: Create sanitizeGymName function with tests

**Files:**
- Create: `backend/src/fetchers/ibjjfGymFetcher.ts`
- Create: `backend/src/__tests__/fetchers/ibjjfGymFetcher.test.ts`

**Step 1: Write the failing tests**

Create test file `backend/src/__tests__/fetchers/ibjjfGymFetcher.test.ts`:

```typescript
import { describe, it, expect } from '@jest/globals';
import { sanitizeGymName } from '../../fetchers/ibjjfGymFetcher.js';

describe('ibjjfGymFetcher', () => {
  describe('sanitizeGymName', () => {
    it('removes # character from name', () => {
      expect(sanitizeGymName('Team #1 BJJ')).toBe('Team 1 BJJ');
    });

    it('removes multiple # characters', () => {
      expect(sanitizeGymName('Gym #1 #2 #3')).toBe('Gym 1 2 3');
    });

    it('trims whitespace', () => {
      expect(sanitizeGymName('  Test Gym  ')).toBe('Test Gym');
    });

    it('handles empty string', () => {
      expect(sanitizeGymName('')).toBe('');
    });

    it('returns unchanged string with no # or whitespace', () => {
      expect(sanitizeGymName('Normal Gym Name')).toBe('Normal Gym Name');
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd backend && npm test -- --testPathPattern=ibjjfGymFetcher`
Expected: FAIL - Cannot find module

**Step 3: Write minimal implementation**

Create `backend/src/fetchers/ibjjfGymFetcher.ts`:

```typescript
/**
 * Sanitize gym name by removing # characters (breaks GSI1SK) and trimming whitespace
 */
export function sanitizeGymName(name: string): string {
  return name.replace(/#/g, '').trim();
}
```

**Step 4: Run tests to verify they pass**

Run: `cd backend && npm test -- --testPathPattern=ibjjfGymFetcher`
Expected: PASS - 5 tests passing

**Step 5: Commit**

```bash
git add backend/src/fetchers/ibjjfGymFetcher.ts backend/src/__tests__/fetchers/ibjjfGymFetcher.test.ts
git commit -m "feat(fetchers): add sanitizeGymName function (ODE-25)"
```

---

## Task 2: Create mapIBJJFAcademyToGym function with tests

**Files:**
- Modify: `backend/src/fetchers/ibjjfGymFetcher.ts`
- Modify: `backend/src/__tests__/fetchers/ibjjfGymFetcher.test.ts`

**Step 1: Write the failing tests**

Add to test file:

```typescript
import { sanitizeGymName, mapIBJJFAcademyToGym } from '../../fetchers/ibjjfGymFetcher.js';
import type { IBJJFAcademy } from '../../fetchers/types.js';

// Add after sanitizeGymName describe block:

describe('mapIBJJFAcademyToGym', () => {
  it('maps all fields correctly', () => {
    const academy: IBJJFAcademy = {
      id: 12345,
      name: 'Gracie Barra',
      country: 'United States',
      countryCode: 'US',
      city: 'Irvine',
      address: '123 Main St',
      federation: 'IBJJF',
      site: 'https://graciebarra.com',
      responsible: 'Carlos Gracie Jr',
    };

    const result = mapIBJJFAcademyToGym(academy);

    expect(result.org).toBe('IBJJF');
    expect(result.externalId).toBe('12345');
    expect(result.name).toBe('Gracie Barra');
    expect(result.country).toBe('United States');
    expect(result.countryCode).toBe('US');
    expect(result.city).toBe('Irvine');
    expect(result.address).toBe('123 Main St');
    expect(result.federation).toBe('IBJJF');
    expect(result.website).toBe('https://graciebarra.com');
    expect(result.responsible).toBe('Carlos Gracie Jr');
  });

  it('converts numeric id to string externalId', () => {
    const academy: IBJJFAcademy = {
      id: 99999,
      name: 'Test',
      country: '',
      countryCode: '',
      city: '',
      address: '',
      federation: '',
      site: '',
      responsible: '',
    };

    const result = mapIBJJFAcademyToGym(academy);

    expect(result.externalId).toBe('99999');
    expect(typeof result.externalId).toBe('string');
  });

  it('sanitizes name by removing # characters', () => {
    const academy: IBJJFAcademy = {
      id: 1,
      name: 'Team #1 BJJ',
      country: '',
      countryCode: '',
      city: '',
      address: '',
      federation: '',
      site: '',
      responsible: '',
    };

    const result = mapIBJJFAcademyToGym(academy);

    expect(result.name).toBe('Team 1 BJJ');
  });

  it('handles empty optional fields as undefined', () => {
    const academy: IBJJFAcademy = {
      id: 1,
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

    expect(result.country).toBeUndefined();
    expect(result.countryCode).toBeUndefined();
    expect(result.city).toBeUndefined();
    expect(result.address).toBeUndefined();
    expect(result.federation).toBeUndefined();
    expect(result.website).toBeUndefined();
    expect(result.responsible).toBeUndefined();
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd backend && npm test -- --testPathPattern=ibjjfGymFetcher`
Expected: FAIL - mapIBJJFAcademyToGym is not exported

**Step 3: Write minimal implementation**

Add to `backend/src/fetchers/ibjjfGymFetcher.ts`:

```typescript
import type { IBJJFAcademy, IBJJFNormalizedGym } from './types.js';

/**
 * Sanitize gym name by removing # characters (breaks GSI1SK) and trimming whitespace
 */
export function sanitizeGymName(name: string): string {
  return name.replace(/#/g, '').trim();
}

/**
 * Map IBJJF academy to normalized gym format
 */
export function mapIBJJFAcademyToGym(academy: IBJJFAcademy): IBJJFNormalizedGym {
  return {
    org: 'IBJJF',
    externalId: String(academy.id),
    name: sanitizeGymName(academy.name),
    country: academy.country || undefined,
    countryCode: academy.countryCode || undefined,
    city: academy.city || undefined,
    address: academy.address || undefined,
    federation: academy.federation || undefined,
    website: academy.site || undefined,
    responsible: academy.responsible || undefined,
  };
}
```

**Step 4: Run tests to verify they pass**

Run: `cd backend && npm test -- --testPathPattern=ibjjfGymFetcher`
Expected: PASS - 9 tests passing

**Step 5: Commit**

```bash
git add backend/src/fetchers/ibjjfGymFetcher.ts backend/src/__tests__/fetchers/ibjjfGymFetcher.test.ts
git commit -m "feat(fetchers): add mapIBJJFAcademyToGym function (ODE-25)"
```

---

## Task 3: Create parseIBJJFAcademiesResponse function with tests

**Files:**
- Modify: `backend/src/fetchers/ibjjfGymFetcher.ts`
- Modify: `backend/src/__tests__/fetchers/ibjjfGymFetcher.test.ts`

**Step 1: Write the failing tests**

Add to test file imports and describe block:

```typescript
import {
  sanitizeGymName,
  mapIBJJFAcademyToGym,
  parseIBJJFAcademiesResponse,
} from '../../fetchers/ibjjfGymFetcher.js';

// Add after mapIBJJFAcademyToGym describe block:

describe('parseIBJJFAcademiesResponse', () => {
  it('parses valid response with multiple academies', () => {
    const response = {
      data: [
        { id: 1, name: 'Gym A', country: 'US', countryCode: 'US', city: 'NYC', address: '', federation: '', site: '', responsible: '' },
        { id: 2, name: 'Gym B', country: 'BR', countryCode: 'BR', city: 'Rio', address: '', federation: '', site: '', responsible: '' },
      ],
      totalRecords: 100,
      filteredRecords: 2,
    };

    const result = parseIBJJFAcademiesResponse(response);

    expect(result.gyms).toHaveLength(2);
    expect(result.totalRecords).toBe(100);
    expect(result.gyms[0].externalId).toBe('1');
    expect(result.gyms[1].externalId).toBe('2');
  });

  it('filters entries with missing id', () => {
    const response = {
      data: [
        { id: 1, name: 'Valid Gym', country: '', countryCode: '', city: '', address: '', federation: '', site: '', responsible: '' },
        { name: 'No ID Gym', country: '', countryCode: '', city: '', address: '', federation: '', site: '', responsible: '' },
      ],
      totalRecords: 2,
      filteredRecords: 2,
    };

    const result = parseIBJJFAcademiesResponse(response);

    expect(result.gyms).toHaveLength(1);
    expect(result.gyms[0].name).toBe('Valid Gym');
  });

  it('filters entries with missing name', () => {
    const response = {
      data: [
        { id: 1, name: 'Valid Gym', country: '', countryCode: '', city: '', address: '', federation: '', site: '', responsible: '' },
        { id: 2, country: '', countryCode: '', city: '', address: '', federation: '', site: '', responsible: '' },
      ],
      totalRecords: 2,
      filteredRecords: 2,
    };

    const result = parseIBJJFAcademiesResponse(response);

    expect(result.gyms).toHaveLength(1);
    expect(result.gyms[0].name).toBe('Valid Gym');
  });

  it('filters entries with empty name', () => {
    const response = {
      data: [
        { id: 1, name: 'Valid Gym', country: '', countryCode: '', city: '', address: '', federation: '', site: '', responsible: '' },
        { id: 2, name: '', country: '', countryCode: '', city: '', address: '', federation: '', site: '', responsible: '' },
      ],
      totalRecords: 2,
      filteredRecords: 2,
    };

    const result = parseIBJJFAcademiesResponse(response);

    expect(result.gyms).toHaveLength(1);
  });

  it('filters entries with whitespace-only name', () => {
    const response = {
      data: [
        { id: 1, name: 'Valid Gym', country: '', countryCode: '', city: '', address: '', federation: '', site: '', responsible: '' },
        { id: 2, name: '   ', country: '', countryCode: '', city: '', address: '', federation: '', site: '', responsible: '' },
      ],
      totalRecords: 2,
      filteredRecords: 2,
    };

    const result = parseIBJJFAcademiesResponse(response);

    expect(result.gyms).toHaveLength(1);
  });

  it('returns empty array for non-object response', () => {
    const result = parseIBJJFAcademiesResponse('not an object');

    expect(result.gyms).toHaveLength(0);
    expect(result.totalRecords).toBe(0);
  });

  it('returns empty array for null response', () => {
    const result = parseIBJJFAcademiesResponse(null);

    expect(result.gyms).toHaveLength(0);
    expect(result.totalRecords).toBe(0);
  });

  it('returns empty array for missing data field', () => {
    const result = parseIBJJFAcademiesResponse({ totalRecords: 10 });

    expect(result.gyms).toHaveLength(0);
    expect(result.totalRecords).toBe(0);
  });

  it('returns empty array when data is not an array', () => {
    const result = parseIBJJFAcademiesResponse({ data: 'not array', totalRecords: 10 });

    expect(result.gyms).toHaveLength(0);
    expect(result.totalRecords).toBe(0);
  });

  it('extracts totalRecords correctly', () => {
    const response = {
      data: [
        { id: 1, name: 'Gym', country: '', countryCode: '', city: '', address: '', federation: '', site: '', responsible: '' },
      ],
      totalRecords: 8574,
      filteredRecords: 1,
    };

    const result = parseIBJJFAcademiesResponse(response);

    expect(result.totalRecords).toBe(8574);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd backend && npm test -- --testPathPattern=ibjjfGymFetcher`
Expected: FAIL - parseIBJJFAcademiesResponse is not exported

**Step 3: Write minimal implementation**

Add to `backend/src/fetchers/ibjjfGymFetcher.ts`:

```typescript
export interface ParsedIBJJFResponse {
  gyms: IBJJFNormalizedGym[];
  totalRecords: number;
}

/**
 * Parse and validate IBJJF academies response
 */
export function parseIBJJFAcademiesResponse(data: unknown): ParsedIBJJFResponse {
  if (!data || typeof data !== 'object') {
    console.warn('[IBJJFGymFetcher] Response is not an object');
    return { gyms: [], totalRecords: 0 };
  }

  const response = data as Record<string, unknown>;

  if (!Array.isArray(response.data)) {
    console.warn('[IBJJFGymFetcher] Response.data is not an array');
    return { gyms: [], totalRecords: 0 };
  }

  const totalRecords =
    typeof response.totalRecords === 'number' ? response.totalRecords : 0;

  const gyms = response.data
    .filter((item): item is IBJJFAcademy => {
      if (!item || typeof item !== 'object') return false;
      const academy = item as Record<string, unknown>;

      const hasValidId = typeof academy.id === 'number';
      const hasValidName =
        typeof academy.name === 'string' && academy.name.trim().length > 0;

      if (!hasValidId) {
        console.warn('[IBJJFGymFetcher] Skipping entry with invalid id');
        return false;
      }
      if (!hasValidName) {
        console.warn(
          `[IBJJFGymFetcher] Skipping entry ${academy.id} with invalid name`
        );
        return false;
      }

      return true;
    })
    .map(mapIBJJFAcademyToGym);

  return { gyms, totalRecords };
}
```

**Step 4: Run tests to verify they pass**

Run: `cd backend && npm test -- --testPathPattern=ibjjfGymFetcher`
Expected: PASS - 19 tests passing

**Step 5: Commit**

```bash
git add backend/src/fetchers/ibjjfGymFetcher.ts backend/src/__tests__/fetchers/ibjjfGymFetcher.test.ts
git commit -m "feat(fetchers): add parseIBJJFAcademiesResponse function (ODE-25)"
```

---

## Task 4: Create fetchIBJJFGymPage and fetchIBJJFGymCount functions

**Files:**
- Modify: `backend/src/fetchers/ibjjfGymFetcher.ts`

**Step 1: Add the implementation**

Add constants and functions to `backend/src/fetchers/ibjjfGymFetcher.ts`:

```typescript
const IBJJF_ACADEMIES_URL = 'https://ibjjf.com/api/academies';
const PAGE_SIZE = 20;

/**
 * Fetch a single page of IBJJF academies
 */
export async function fetchIBJJFGymPage(
  page: number
): Promise<{ data: IBJJFAcademy[]; totalRecords: number }> {
  const start = page * PAGE_SIZE;
  const url = `${IBJJF_ACADEMIES_URL}?start=${start}&length=${PAGE_SIZE}`;

  console.log(`[IBJJFGymFetcher] Fetching page ${page} (start=${start})`);

  const response = await fetch(url, {
    headers: {
      accept: 'application/json, text/javascript, */*; q=0.01',
      'x-requested-with': 'XMLHttpRequest',
    },
  });

  if (!response.ok) {
    throw new Error(
      `IBJJF academies API returned ${response.status}: ${response.statusText}`
    );
  }

  const json = await response.json();
  const parsed = parseIBJJFAcademiesResponse(json);

  return {
    data: parsed.gyms as unknown as IBJJFAcademy[],
    totalRecords: parsed.totalRecords,
  };
}

/**
 * Fetch total count of IBJJF academies for change detection
 */
export async function fetchIBJJFGymCount(): Promise<number> {
  const url = `${IBJJF_ACADEMIES_URL}?start=0&length=1`;

  const response = await fetch(url, {
    headers: {
      accept: 'application/json, text/javascript, */*; q=0.01',
      'x-requested-with': 'XMLHttpRequest',
    },
  });

  if (!response.ok) {
    throw new Error(
      `IBJJF academies API returned ${response.status}: ${response.statusText}`
    );
  }

  const json = await response.json();
  const parsed = parseIBJJFAcademiesResponse(json);

  return parsed.totalRecords;
}
```

**Step 2: Verify TypeScript compiles**

Run: `cd backend && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add backend/src/fetchers/ibjjfGymFetcher.ts
git commit -m "feat(fetchers): add fetchIBJJFGymPage and fetchIBJJFGymCount (ODE-25)"
```

---

## Task 5: Create fetchAllIBJJFGyms function with pagination

**Files:**
- Modify: `backend/src/fetchers/ibjjfGymFetcher.ts`

**Step 1: Add the implementation**

Add types and function to `backend/src/fetchers/ibjjfGymFetcher.ts`:

```typescript
export type ProgressCallback = (current: number, total: number) => void;

/**
 * Delay helper for rate limiting
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch all IBJJF academies with sequential pagination
 */
export async function fetchAllIBJJFGyms(
  onProgress?: ProgressCallback
): Promise<IBJJFNormalizedGym[]> {
  console.log('[IBJJFGymFetcher] Starting full gym sync...');

  const allGyms: IBJJFNormalizedGym[] = [];
  let page = 0;
  let totalPages = 1;

  while (page < totalPages) {
    try {
      const start = page * PAGE_SIZE;
      const url = `${IBJJF_ACADEMIES_URL}?start=${start}&length=${PAGE_SIZE}`;

      const response = await fetch(url, {
        headers: {
          accept: 'application/json, text/javascript, */*; q=0.01',
          'x-requested-with': 'XMLHttpRequest',
        },
      });

      if (!response.ok) {
        throw new Error(
          `IBJJF academies API returned ${response.status}: ${response.statusText}`
        );
      }

      const json = await response.json();
      const parsed = parseIBJJFAcademiesResponse(json);

      if (page === 0) {
        totalPages = Math.ceil(parsed.totalRecords / PAGE_SIZE);
        console.log(
          `[IBJJFGymFetcher] Total records: ${parsed.totalRecords}, pages: ${totalPages}`
        );
      }

      allGyms.push(...parsed.gyms);
      onProgress?.(page + 1, totalPages);
    } catch (error) {
      console.warn(
        `[IBJJFGymFetcher] Page ${page} failed, skipping:`,
        error instanceof Error ? error.message : error
      );
    }

    if (page < totalPages - 1) {
      await delay(200);
    }
    page++;
  }

  console.log(`[IBJJFGymFetcher] Fetched ${allGyms.length} gyms total`);
  return allGyms;
}
```

**Step 2: Verify TypeScript compiles**

Run: `cd backend && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add backend/src/fetchers/ibjjfGymFetcher.ts
git commit -m "feat(fetchers): add fetchAllIBJJFGyms with pagination (ODE-25)"
```

---

## Task 6: Run full test suite and verify

**Step 1: Run all backend tests**

Run: `cd backend && npm test`
Expected: All tests pass

**Step 2: Run TypeScript check**

Run: `cd backend && npx tsc --noEmit`
Expected: No errors

**Step 3: Final commit if any cleanup needed**

```bash
git add -A
git commit -m "chore: cleanup after ODE-25 implementation"
```

---

## Summary

| Task | Description | Tests |
|------|-------------|-------|
| 1 | sanitizeGymName | 5 |
| 2 | mapIBJJFAcademyToGym | 4 |
| 3 | parseIBJJFAcademiesResponse | 10 |
| 4 | fetchIBJJFGymPage + fetchIBJJFGymCount | TypeScript only |
| 5 | fetchAllIBJJFGyms | TypeScript only |
| 6 | Full verification | All tests |

**Total:** ~19 unit tests covering mapping, parsing, and sanitization.
