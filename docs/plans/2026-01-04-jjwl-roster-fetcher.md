# JJWL Roster Fetcher Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a fetcher to retrieve athlete rosters for a specific gym at a JJWL tournament.

**Architecture:** POST to JJWL's DataTables endpoint with event_id and academy_id, parse the response array into typed athlete objects.

**Tech Stack:** TypeScript, native fetch, Jest for testing

---

## Task 1: Write Parsing Tests

**Files:**
- Create: `backend/src/__tests__/fetchers/jjwlRosterFetcher.test.ts`

**Step 1: Create the test file with parseRosterResponse tests**

```typescript
// backend/src/__tests__/fetchers/jjwlRosterFetcher.test.ts
import { describe, it, expect } from '@jest/globals';
import { parseRosterResponse } from '../../fetchers/jjwlRosterFetcher.js';

describe('jjwlRosterFetcher', () => {
  describe('parseRosterResponse', () => {
    it('parses DataTables format response', () => {
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
      expect(result[1]).toEqual({
        name: 'Jane Smith',
        gender: 'Female',
        ageDiv: 'Juvenile (16-17)',
        belt: 'Purple',
        weight: 'Feather',
      });
    });

    it('handles empty data array', () => {
      const response = { data: [] };

      const result = parseRosterResponse(response);

      expect(result).toHaveLength(0);
    });

    it('handles missing data property', () => {
      const response = {};

      const result = parseRosterResponse(response as { data: unknown[] });

      expect(result).toHaveLength(0);
    });

    it('handles null data property', () => {
      const response = { data: null };

      const result = parseRosterResponse(response as { data: unknown[] });

      expect(result).toHaveLength(0);
    });

    it('filters out rows with empty names', () => {
      const response = {
        data: [
          ['Valid Name', '1', '10:00', 'Male', 'Adult', 'Blue', 'Light'],
          ['', '2', '11:00', 'Male', 'Adult', 'Blue', 'Light'],
          ['   ', '3', '12:00', 'Male', 'Adult', 'Blue', 'Light'],
        ],
      };

      const result = parseRosterResponse(response);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Valid Name');
    });

    it('filters out null rows', () => {
      const response = {
        data: [
          ['Valid Name', '1', '10:00', 'Male', 'Adult', 'Blue', 'Light'],
          null,
        ],
      };

      const result = parseRosterResponse(response as { data: unknown[] });

      expect(result).toHaveLength(1);
    });

    it('filters out rows with insufficient length', () => {
      const response = {
        data: [
          ['Valid Name', '1', '10:00', 'Male', 'Adult', 'Blue', 'Light'],
          ['Short Row', '1', '10:00'], // Only 3 elements
        ],
      };

      const result = parseRosterResponse(response as { data: unknown[] });

      expect(result).toHaveLength(1);
    });

    it('trims whitespace from all fields', () => {
      const response = {
        data: [
          ['  John Doe  ', '1', '10:00', '  Male  ', '  Adult  ', '  Blue  ', '  Light  '],
        ],
      };

      const result = parseRosterResponse(response);

      expect(result[0]).toEqual({
        name: 'John Doe',
        gender: 'Male',
        ageDiv: 'Adult',
        belt: 'Blue',
        weight: 'Light',
      });
    });

    it('handles missing optional fields gracefully', () => {
      const response = {
        data: [
          ['John Doe', '1', '10:00', null, undefined, '', 'Light'],
        ],
      };

      const result = parseRosterResponse(response as { data: unknown[] });

      expect(result[0]).toEqual({
        name: 'John Doe',
        gender: '',
        ageDiv: '',
        belt: '',
        weight: 'Light',
      });
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd backend && npm test -- --testPathPattern=jjwlRosterFetcher`
Expected: FAIL - Cannot find module '../../fetchers/jjwlRosterFetcher.js'

---

## Task 2: Implement parseRosterResponse

**Files:**
- Create: `backend/src/fetchers/jjwlRosterFetcher.ts`

**Step 1: Create the fetcher with parseRosterResponse**

```typescript
// backend/src/fetchers/jjwlRosterFetcher.ts
import type { JJWLRosterAthlete } from './types.js';

/**
 * Parse DataTables response into roster athletes.
 * DataTables returns rows as arrays: [name, mat, time, gender, ageDiv, belt, weight]
 */
export function parseRosterResponse(response: { data?: unknown[] }): JJWLRosterAthlete[] {
  if (!response.data || !Array.isArray(response.data)) {
    return [];
  }

  return response.data
    .filter((row): row is string[] => {
      if (!Array.isArray(row) || row.length < 7) return false;
      const name = row[0];
      return typeof name === 'string' && name.trim().length > 0;
    })
    .map((row) => ({
      name: row[0].trim(),
      gender: (row[3] ?? '').toString().trim(),
      ageDiv: (row[4] ?? '').toString().trim(),
      belt: (row[5] ?? '').toString().trim(),
      weight: (row[6] ?? '').toString().trim(),
    }));
}
```

**Step 2: Run tests to verify they pass**

Run: `cd backend && npm test -- --testPathPattern=jjwlRosterFetcher`
Expected: PASS - All 9 tests pass

**Step 3: Commit**

```bash
git add backend/src/__tests__/fetchers/jjwlRosterFetcher.test.ts backend/src/fetchers/jjwlRosterFetcher.ts
git commit -m "feat(fetcher): add JJWL roster response parser with tests"
```

---

## Task 3: Add fetchJJWLRoster Function

**Files:**
- Modify: `backend/src/fetchers/jjwlRosterFetcher.ts`

**Step 1: Add the fetch function**

Add after `parseRosterResponse`:

```typescript
const JJWL_ROSTER_URL = 'https://www.jjworldleague.com/pages/hermes_ajax/events_competitors_list.php';

/**
 * Fetch roster for a gym at a tournament from JJWL.
 * @param eventId - The JJWL tournament/event ID
 * @param academyId - The JJWL academy/gym ID
 */
export async function fetchJJWLRoster(
  eventId: string,
  academyId: string
): Promise<JJWLRosterAthlete[]> {
  console.log(`[JJWLRosterFetcher] Fetching roster for event ${eventId}, academy ${academyId}`);

  const formData = new URLSearchParams();
  formData.append('event_id', eventId);
  formData.append('academy_id', academyId);
  // DataTables server-side processing params
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

**Step 2: Verify TypeScript compiles**

Run: `cd backend && npx tsc --noEmit`
Expected: No errors

**Step 3: Run all tests to ensure nothing broke**

Run: `cd backend && npm test`
Expected: All tests pass

**Step 4: Commit**

```bash
git add backend/src/fetchers/jjwlRosterFetcher.ts
git commit -m "feat(fetcher): add fetchJJWLRoster function"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Write parsing tests | `__tests__/fetchers/jjwlRosterFetcher.test.ts` |
| 2 | Implement parseRosterResponse | `fetchers/jjwlRosterFetcher.ts` |
| 3 | Add fetchJJWLRoster function | `fetchers/jjwlRosterFetcher.ts` |

**Total commits:** 2
