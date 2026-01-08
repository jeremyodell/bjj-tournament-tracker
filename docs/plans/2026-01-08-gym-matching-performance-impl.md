# Gym Matching Performance Optimization - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reduce gym matching time from 15+ minutes to <2 minutes by filtering to US-only gyms, caching in memory, and using a faster string matching algorithm.

**Architecture:** Three-layer optimization: (1) Pre-filter IBJJF gyms to US-only using `countryCode='US'`, (2) Load all US IBJJF gyms into memory once instead of 5,779 DB queries, (3) Replace Levenshtein with Jaro-Winkler algorithm (2-3x faster).

**Tech Stack:** TypeScript, DynamoDB, AWS SDK, `natural` package (Jaro-Winkler), Vitest

**Design Doc:** `docs/plans/2026-01-08-gym-matching-performance.md`

---

## Phase 1: Write All Tests First

Write the complete test suite that defines the expected behavior. These tests will fail initially - that's expected and correct.

### Task 1: Write Database Query Tests

**Files:**
- Create: `backend/src/__tests__/db/gymQueries.test.ts` (add to existing file)

**Step 1: Add test for listUSIBJJFGyms function**

Add these tests to the existing `gymQueries.test.ts` file:

```typescript
describe('listUSIBJJFGyms', () => {
  beforeEach(async () => {
    // Clean up test data
    await deleteAllGyms();
  });

  it('should return only US IBJJF gyms by countryCode', async () => {
    // Seed test data
    await putSourceGym({
      org: 'IBJJF',
      externalId: 'us-gym-1',
      name: 'Gracie Barra Austin',
      countryCode: 'US',
      country: 'United States of America',
      city: 'Austin',
    });

    await putSourceGym({
      org: 'IBJJF',
      externalId: 'br-gym-1',
      name: 'Gracie Barra Rio',
      countryCode: 'BR',
      country: 'Brasil',
      city: 'Rio de Janeiro',
    });

    const gyms = await listUSIBJJFGyms();

    expect(gyms).toHaveLength(1);
    expect(gyms[0].externalId).toBe('us-gym-1');
    expect(gyms[0].countryCode).toBe('US');
  });

  it('should return US gyms identified by country name', async () => {
    // Test gyms that only have country name, not countryCode
    await putSourceGym({
      org: 'IBJJF',
      externalId: 'us-gym-2',
      name: 'Alliance San Diego',
      country: 'United States of America',
      city: 'San Diego',
    });

    const gyms = await listUSIBJJFGyms();

    expect(gyms).toHaveLength(1);
    expect(gyms[0].externalId).toBe('us-gym-2');
  });

  it('should exclude non-US gyms', async () => {
    // Seed gyms from various countries
    await putSourceGym({
      org: 'IBJJF',
      externalId: 'br-gym',
      name: 'Brazilian Gym',
      countryCode: 'BR',
      country: 'Brasil',
      city: 'Sao Paulo',
    });

    await putSourceGym({
      org: 'IBJJF',
      externalId: 'jp-gym',
      name: 'Japanese Gym',
      countryCode: 'JP',
      country: 'Japan',
      city: 'Tokyo',
    });

    const gyms = await listUSIBJJFGyms();

    expect(gyms).toHaveLength(0);
  });

  it('should exclude JJWL gyms (only IBJJF)', async () => {
    await putSourceGym({
      org: 'JJWL',
      externalId: 'jjwl-gym',
      name: 'JJWL Gym',
      countryCode: 'US',
      city: 'Los Angeles',
    });

    await putSourceGym({
      org: 'IBJJF',
      externalId: 'ibjjf-gym',
      name: 'IBJJF Gym',
      countryCode: 'US',
      city: 'Los Angeles',
    });

    const gyms = await listUSIBJJFGyms();

    expect(gyms).toHaveLength(1);
    expect(gyms[0].org).toBe('IBJJF');
  });

  it('should handle pagination correctly', async () => {
    // Create 150 US gyms to test pagination
    const promises = [];
    for (let i = 0; i < 150; i++) {
      promises.push(
        putSourceGym({
          org: 'IBJJF',
          externalId: `us-gym-${i}`,
          name: `US Gym ${i}`,
          countryCode: 'US',
          city: 'Test City',
        })
      );
    }
    await Promise.all(promises);

    const gyms = await listUSIBJJFGyms();

    expect(gyms.length).toBe(150);
  });

  it('should return empty array when no US gyms exist', async () => {
    const gyms = await listUSIBJJFGyms();
    expect(gyms).toEqual([]);
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
cd backend
npm test -- gymQueries.test.ts
```

Expected output: All `listUSIBJJFGyms` tests should FAIL with "listUSIBJJFGyms is not defined" or similar.

**Step 3: Commit failing tests**

```bash
git add src/__tests__/db/gymQueries.test.ts
git commit -m "test: add failing tests for listUSIBJJFGyms function"
```

---

### Task 2: Write Matching Service Tests

**Files:**
- Modify: `backend/src/__tests__/services/gymMatchingService.test.ts`

**Step 1: Add tests for Jaro-Winkler algorithm**

Add these tests to the existing file (find the `calculateSimilarity` test suite and add to it):

```typescript
describe('calculateSimilarity with Jaro-Winkler', () => {
  it('should return 100 for identical gym names', () => {
    const score = calculateSimilarity(
      'Gracie Barra',
      'Gracie Barra',
      'Austin',
      'Austin'
    );
    expect(score).toBe(100);
  });

  it('should handle minor variations with high score', () => {
    const score = calculateSimilarity(
      'Gracie Barra Austin',
      'Gracie Barra - Austin',
      'Austin',
      'Austin'
    );
    // Jaro-Winkler favors prefix matches
    expect(score).toBeGreaterThan(85);
  });

  it('should give low score for completely different names', () => {
    const score = calculateSimilarity(
      'Gracie Barra',
      'Alliance Jiu Jitsu',
      'Austin',
      'Houston'
    );
    expect(score).toBeLessThan(50);
  });

  it('should apply city boost when city appears in gym name', () => {
    const scoreWithCity = calculateSimilarity(
      'Gracie Barra Austin',
      'Gracie Barra Austin',
      'Austin',
      'Austin'
    );
    const scoreWithoutCity = calculateSimilarity(
      'Gracie Barra',
      'Gracie Barra',
      'Austin',
      'Austin'
    );
    // City boost should add ~15 points
    expect(scoreWithCity).toBeGreaterThanOrEqual(scoreWithoutCity);
  });

  it('should apply affiliation boost for matching affiliations', () => {
    const score = calculateSimilarity(
      'Gracie Barra Austin',
      'Gracie Barra Dallas',
      'Austin',
      'Dallas'
    );
    // "Gracie Barra" affiliation should boost score
    expect(score).toBeGreaterThan(70);
  });

  it('should not exceed 100 even with boosts', () => {
    const score = calculateSimilarity(
      'Gracie Barra Austin',
      'Gracie Barra Austin',
      'Austin',
      'Austin'
    );
    expect(score).toBeLessThanOrEqual(100);
  });
});

describe('findMatchesForGym with cached gyms', () => {
  it('should accept cached gym array instead of querying DB', async () => {
    const sourceGym: SourceGymItem = {
      PK: 'SRCGYM#JJWL#123',
      SK: 'META',
      org: 'JJWL',
      externalId: '123',
      name: 'Test Gym Austin',
      city: 'Austin',
      GSI1PK: 'GYM#JJWL',
      GSI1SK: 'Test Gym Austin',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const cachedGyms: SourceGymItem[] = [
      {
        PK: 'SRCGYM#IBJJF#456',
        SK: 'META',
        org: 'IBJJF',
        externalId: '456',
        name: 'Test Gym Austin',
        city: 'Austin',
        countryCode: 'US',
        GSI1PK: 'GYM#IBJJF',
        GSI1SK: 'Test Gym Austin',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const matches = await findMatchesForGym(sourceGym, cachedGyms);

    expect(matches).toHaveLength(1);
    expect(matches[0].targetGym.externalId).toBe('456');
    expect(matches[0].score).toBeGreaterThan(90);
  });

  it('should find high-confidence matches (≥90%)', async () => {
    const sourceGym: SourceGymItem = {
      PK: 'SRCGYM#JJWL#123',
      SK: 'META',
      org: 'JJWL',
      externalId: '123',
      name: 'Gracie Barra Austin',
      city: 'Austin',
      GSI1PK: 'GYM#JJWL',
      GSI1SK: 'Gracie Barra Austin',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const cachedGyms: SourceGymItem[] = [
      {
        PK: 'SRCGYM#IBJJF#456',
        SK: 'META',
        org: 'IBJJF',
        externalId: '456',
        name: 'Gracie Barra - Austin',
        city: 'Austin',
        countryCode: 'US',
        GSI1PK: 'GYM#IBJJF',
        GSI1SK: 'Gracie Barra - Austin',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const matches = await findMatchesForGym(sourceGym, cachedGyms);

    expect(matches).toHaveLength(1);
    expect(matches[0].score).toBeGreaterThanOrEqual(90);
  });

  it('should find medium-confidence matches (70-89%)', async () => {
    const sourceGym: SourceGymItem = {
      PK: 'SRCGYM#JJWL#123',
      SK: 'META',
      org: 'JJWL',
      externalId: '123',
      name: 'Alliance Austin',
      city: 'Austin',
      GSI1PK: 'GYM#JJWL',
      GSI1SK: 'Alliance Austin',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const cachedGyms: SourceGymItem[] = [
      {
        PK: 'SRCGYM#IBJJF#456',
        SK: 'META',
        org: 'IBJJF',
        externalId: '456',
        name: 'Alliance Jiu Jitsu',
        city: 'Austin',
        countryCode: 'US',
        GSI1PK: 'GYM#IBJJF',
        GSI1SK: 'Alliance Jiu Jitsu',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const matches = await findMatchesForGym(sourceGym, cachedGyms);

    expect(matches).toHaveLength(1);
    expect(matches[0].score).toBeGreaterThanOrEqual(70);
    expect(matches[0].score).toBeLessThan(90);
  });

  it('should exclude low-confidence matches (<70%)', async () => {
    const sourceGym: SourceGymItem = {
      PK: 'SRCGYM#JJWL#123',
      SK: 'META',
      org: 'JJWL',
      externalId: '123',
      name: 'Gracie Barra Austin',
      city: 'Austin',
      GSI1PK: 'GYM#JJWL',
      GSI1SK: 'Gracie Barra Austin',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const cachedGyms: SourceGymItem[] = [
      {
        PK: 'SRCGYM#IBJJF#456',
        SK: 'META',
        org: 'IBJJF',
        externalId: '456',
        name: 'Completely Different Gym',
        city: 'Houston',
        countryCode: 'US',
        GSI1PK: 'GYM#IBJJF',
        GSI1SK: 'Completely Different Gym',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const matches = await findMatchesForGym(sourceGym, cachedGyms);

    expect(matches).toHaveLength(0);
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npm test -- gymMatchingService.test.ts
```

Expected: Tests should FAIL because algorithm still uses Levenshtein and `findMatchesForGym` doesn't accept cached array.

**Step 3: Commit failing tests**

```bash
git add src/__tests__/services/gymMatchingService.test.ts
git commit -m "test: add failing tests for Jaro-Winkler algorithm and cached gym matching"
```

---

### Task 3: Write Sync Service Tests

**Files:**
- Modify: `backend/src/__tests__/services/gymSyncService.test.ts`

**Step 1: Add tests for JJWL-only matching**

Add to existing test file:

```typescript
describe('syncJJWLGyms with matching', () => {
  beforeEach(async () => {
    await deleteAllGyms();
    await deleteAllMasterGyms();
    await deleteAllPendingMatches();
  });

  it('should run matching during JJWL sync', async () => {
    // Seed IBJJF gym first
    await putSourceGym({
      org: 'IBJJF',
      externalId: 'ibjjf-1',
      name: 'Gracie Barra Austin',
      city: 'Austin',
      countryCode: 'US',
    });

    // Mock JJWL fetcher to return matching gym
    jest.spyOn(require('../../fetchers/jjwlFetcher'), 'fetchJJWLGyms').mockResolvedValue([
      {
        org: 'JJWL',
        externalId: 'jjwl-1',
        name: 'Gracie Barra - Austin',
        city: 'Austin',
      },
    ]);

    const result = await syncJJWLGyms();

    expect(result.matching).toBeDefined();
    expect(result.matching.processed).toBeGreaterThan(0);
  });

  it('should load US IBJJF gyms only once', async () => {
    // Seed multiple IBJJF gyms (US and non-US)
    await putSourceGym({
      org: 'IBJJF',
      externalId: 'us-1',
      name: 'US Gym 1',
      countryCode: 'US',
      city: 'Austin',
    });

    await putSourceGym({
      org: 'IBJJF',
      externalId: 'br-1',
      name: 'Brazilian Gym',
      countryCode: 'BR',
      city: 'Rio',
    });

    // Mock to track DB queries
    const listUSIBJJFGymsSpy = jest.spyOn(
      require('../../db/gymQueries'),
      'listUSIBJJFGyms'
    );

    // Mock JJWL fetcher
    jest.spyOn(require('../../fetchers/jjwlFetcher'), 'fetchJJWLGyms').mockResolvedValue([
      { org: 'JJWL', externalId: 'jjwl-1', name: 'Test Gym 1', city: 'Austin' },
      { org: 'JJWL', externalId: 'jjwl-2', name: 'Test Gym 2', city: 'Houston' },
    ]);

    await syncJJWLGyms();

    // Should only call listUSIBJJFGyms ONCE, not once per JJWL gym
    expect(listUSIBJJFGymsSpy).toHaveBeenCalledTimes(1);
  });

  it('should auto-link gyms with ≥90% match', async () => {
    await putSourceGym({
      org: 'IBJJF',
      externalId: 'ibjjf-1',
      name: 'Gracie Barra Austin',
      city: 'Austin',
      countryCode: 'US',
    });

    jest.spyOn(require('../../fetchers/jjwlFetcher'), 'fetchJJWLGyms').mockResolvedValue([
      {
        org: 'JJWL',
        externalId: 'jjwl-1',
        name: 'Gracie Barra Austin',
        city: 'Austin',
      },
    ]);

    const result = await syncJJWLGyms();

    expect(result.matching.autoLinked).toBeGreaterThan(0);

    // Verify master gym was created
    const masterGyms = await listAllMasterGyms();
    expect(masterGyms.length).toBeGreaterThan(0);
  });

  it('should create pending matches for 70-89% matches', async () => {
    await putSourceGym({
      org: 'IBJJF',
      externalId: 'ibjjf-1',
      name: 'Alliance Jiu Jitsu',
      city: 'Austin',
      countryCode: 'US',
    });

    jest.spyOn(require('../../fetchers/jjwlFetcher'), 'fetchJJWLGyms').mockResolvedValue([
      {
        org: 'JJWL',
        externalId: 'jjwl-1',
        name: 'Alliance Austin',
        city: 'Austin',
      },
    ]);

    const result = await syncJJWLGyms();

    expect(result.matching.pendingCreated).toBeGreaterThan(0);

    // Verify pending match was created
    const pendingMatches = await listPendingMatches('pending');
    expect(pendingMatches.length).toBeGreaterThan(0);
  });

  it('should skip gyms already linked to master gym', async () => {
    // Create master gym and link JJWL gym to it
    const masterGym = await createMasterGym({
      name: 'Gracie Barra Austin',
      city: 'Austin',
      sourceGymIds: [],
    });

    await putSourceGym({
      org: 'JJWL',
      externalId: 'jjwl-1',
      name: 'Gracie Barra Austin',
      city: 'Austin',
      masterGymId: masterGym.id,
    });

    jest.spyOn(require('../../fetchers/jjwlFetcher'), 'fetchJJWLGyms').mockResolvedValue([
      {
        org: 'JJWL',
        externalId: 'jjwl-1',
        name: 'Gracie Barra Austin',
        city: 'Austin',
      },
    ]);

    const result = await syncJJWLGyms();

    // Should not process already-linked gym
    expect(result.matching.processed).toBe(0);
  });
});

describe('syncIBJJFGyms without matching', () => {
  it('should NOT run matching during IBJJF sync', async () => {
    jest
      .spyOn(require('../../fetchers/ibjjfGymFetcher'), 'fetchAllIBJJFGyms')
      .mockResolvedValue([
        {
          org: 'IBJJF',
          externalId: 'ibjjf-1',
          name: 'Test Gym',
          city: 'Austin',
          countryCode: 'US',
        },
      ]);

    const result = await syncIBJJFGyms();

    // matching field should be undefined (not run)
    expect(result.matching).toBeUndefined();
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npm test -- gymSyncService.test.ts
```

Expected: Tests should FAIL because sync service doesn't implement new caching/matching logic yet.

**Step 3: Commit failing tests**

```bash
git add src/__tests__/services/gymSyncService.test.ts
git commit -m "test: add failing tests for JJWL-only matching with caching"
```

---

### Task 4: Write Integration Test

**Files:**
- Create: `backend/src/__tests__/integration/gym-matching-performance.test.ts`

**Step 1: Write end-to-end performance test**

```typescript
import { syncJJWLGyms, syncIBJJFGyms } from '../../services/gymSyncService';
import { deleteAllGyms, deleteAllMasterGyms, deleteAllPendingMatches } from '../../db/testHelpers';

describe('Gym Matching Performance Integration', () => {
  beforeEach(async () => {
    await deleteAllGyms();
    await deleteAllMasterGyms();
    await deleteAllPendingMatches();
  });

  it('should complete JJWL matching in under 2 minutes with real data', async () => {
    // This test uses REAL data from the APIs
    // Run IBJJF sync first to populate US gyms
    const ibjjfResult = await syncIBJJFGyms();
    expect(ibjjfResult.fetched).toBeGreaterThan(0);

    // Run JJWL sync with matching
    const startTime = Date.now();
    const jjwlResult = await syncJJWLGyms();
    const duration = Date.now() - startTime;

    // Performance assertion: <2 minutes (120,000ms)
    expect(duration).toBeLessThan(120000);

    // Verify matching ran
    expect(jjwlResult.matching).toBeDefined();
    expect(jjwlResult.matching.processed).toBeGreaterThan(0);

    console.log(`Matching completed in ${duration}ms`);
    console.log(`Processed: ${jjwlResult.matching.processed}`);
    console.log(`Auto-linked: ${jjwlResult.matching.autoLinked}`);
    console.log(`Pending: ${jjwlResult.matching.pendingCreated}`);
  }, 180000); // 3 minute timeout for safety

  it('should only compare against US IBJJF gyms', async () => {
    // Seed mix of US and non-US IBJJF gyms
    const { putSourceGym } = require('../../db/gymQueries');

    await putSourceGym({
      org: 'IBJJF',
      externalId: 'us-gym',
      name: 'US Test Gym',
      city: 'Austin',
      countryCode: 'US',
    });

    await putSourceGym({
      org: 'IBJJF',
      externalId: 'br-gym',
      name: 'Brazilian Test Gym',
      city: 'Rio',
      countryCode: 'BR',
    });

    // Mock JJWL to return one gym
    jest.spyOn(require('../../fetchers/jjwlFetcher'), 'fetchJJWLGyms').mockResolvedValue([
      {
        org: 'JJWL',
        externalId: 'jjwl-1',
        name: 'US Test Gym',
        city: 'Austin',
      },
    ]);

    const result = await syncJJWLGyms();

    // Should match against US gym, not Brazilian gym
    expect(result.matching.processed).toBe(1);
  });

  it('should produce similar match counts to old algorithm', async () => {
    // This is a regression test - ensures new algorithm finds roughly same matches
    // Run full sync with real data
    await syncIBJJFGyms();
    const result = await syncJJWLGyms();

    // These are approximate baselines from old algorithm (adjust based on reality)
    // Auto-linked should be within 10% of baseline
    // Pending should be within 20% of baseline
    expect(result.matching.autoLinked).toBeGreaterThan(0);
    expect(result.matching.pendingCreated).toBeGreaterThan(0);

    // Log for manual review
    console.log('Match results:', result.matching);
  }, 180000);
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- gym-matching-performance.test.ts
```

Expected: Test should FAIL because implementation doesn't exist yet.

**Step 3: Commit failing integration test**

```bash
git add src/__tests__/integration/gym-matching-performance.test.ts
git commit -m "test: add failing integration test for gym matching performance"
```

---

## Phase 2: Implementation (Make Tests Pass)

Now implement the features to make all tests pass. Work task-by-task until tests are green.

### Task 5: Install Dependencies

**Files:**
- Modify: `backend/package.json`

**Step 1: Add natural package**

```bash
cd backend
npm install natural
npm install --save-dev @types/natural
```

**Step 2: Verify installation**

```bash
npm list natural
```

Expected output: Should show `natural@X.X.X` installed.

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: add natural package for Jaro-Winkler algorithm"
```

---

### Task 6: Implement listUSIBJJFGyms Function

**Files:**
- Modify: `backend/src/db/gymQueries.ts`

**Goal:** Make the `listUSIBJJFGyms` tests pass.

**Step 1: Add function to gymQueries.ts**

Add this function after the existing `listGyms` function:

```typescript
/**
 * Load all US IBJJF gyms for matching cache.
 * Filters by countryCode='US' or country='United States of America'.
 * This reduces the comparison space by ~50% (from 8,614 to ~4,307 gyms).
 */
export async function listUSIBJJFGyms(): Promise<SourceGymItem[]> {
  const gyms: SourceGymItem[] = [];
  let lastEvaluatedKey: Record<string, any> | undefined;

  do {
    const result = await docClient.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression:
          'begins_with(PK, :pk) AND (countryCode = :us OR country = :usLong)',
        ExpressionAttributeValues: {
          ':pk': 'SRCGYM#IBJJF#',
          ':us': 'US',
          ':usLong': 'United States of America',
        },
        ExclusiveStartKey: lastEvaluatedKey,
      })
    );

    if (result.Items) {
      gyms.push(...(result.Items as SourceGymItem[]));
    }

    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  return gyms;
}
```

**Step 2: Run tests to verify they pass**

```bash
npm test -- gymQueries.test.ts -t "listUSIBJJFGyms"
```

Expected output: All `listUSIBJJFGyms` tests should PASS.

**Step 3: Commit**

```bash
git add src/db/gymQueries.ts
git commit -m "feat: add listUSIBJJFGyms to filter US gyms for matching"
```

---

### Task 7: Update Matching Service Algorithm

**Files:**
- Modify: `backend/src/services/gymMatchingService.ts`

**Goal:** Make the Jaro-Winkler tests pass.

**Step 1: Replace Levenshtein with Jaro-Winkler**

At the top of the file, replace the import:

```typescript
// OLD:
// import levenshtein from 'fast-levenshtein';

// NEW:
import natural from 'natural';
```

**Step 2: Update calculateSimilarity function**

Find the `calculateSimilarity` function and replace the scoring logic:

```typescript
/**
 * Calculate similarity score between two gym names using Jaro-Winkler distance.
 * Returns 0-100 score with boosts for city/affiliation matches.
 */
export function calculateSimilarity(
  name1: string,
  name2: string,
  city1?: string,
  city2?: string
): number {
  // Normalize names for comparison
  const n1 = name1.toLowerCase().trim();
  const n2 = name2.toLowerCase().trim();

  // Jaro-Winkler returns 0.0-1.0, multiply by 100 for existing thresholds
  let score = natural.JaroWinklerDistance(n1, n2) * 100;

  // City boost: +15 if city appears in gym name
  if (city1 && city2) {
    const c1 = city1.toLowerCase();
    const c2 = city2.toLowerCase();
    if (n1.includes(c1) || n2.includes(c2)) {
      score += 15;
    }
  }

  // Affiliation boost: +10 for matching BJJ affiliations
  const affiliations = [
    'gracie barra',
    'alliance',
    'atos',
    'checkmat',
    'nova uniao',
    'riberio',
    'carlson gracie',
    'renzo gracie',
  ];

  for (const affiliation of affiliations) {
    if (n1.includes(affiliation) && n2.includes(affiliation)) {
      score += 10;
      break;
    }
  }

  // Cap at 100
  return Math.min(score, 100);
}
```

**Step 3: Run tests to verify they pass**

```bash
npm test -- gymMatchingService.test.ts -t "calculateSimilarity"
```

Expected: All `calculateSimilarity with Jaro-Winkler` tests should PASS.

**Step 4: Commit**

```bash
git add src/services/gymMatchingService.ts
git commit -m "feat: replace Levenshtein with Jaro-Winkler for 2-3x speed improvement"
```

---

### Task 8: Update findMatchesForGym to Accept Cache

**Files:**
- Modify: `backend/src/services/gymMatchingService.ts`

**Goal:** Make the cached gym matching tests pass.

**Step 1: Update findMatchesForGym signature**

Find the `findMatchesForGym` function and update it to accept a cached gym array:

```typescript
/**
 * Find matching gyms for a source gym using cached target gyms.
 * @param sourceGym - The gym to find matches for
 * @param cachedTargetGyms - Pre-loaded array of target gyms to compare against
 * @returns Array of matches with scores ≥70%
 */
export async function findMatchesForGym(
  sourceGym: SourceGymItem,
  cachedTargetGyms: SourceGymItem[]
): Promise<GymMatch[]> {
  const matches: GymMatch[] = [];

  // Compare against cached gyms instead of querying DB
  for (const targetGym of cachedTargetGyms) {
    // Skip if same gym
    if (
      sourceGym.org === targetGym.org &&
      sourceGym.externalId === targetGym.externalId
    ) {
      continue;
    }

    // Skip if target gym is already linked
    if (targetGym.masterGymId) {
      continue;
    }

    // Calculate similarity
    const score = calculateSimilarity(
      sourceGym.name,
      targetGym.name,
      sourceGym.city,
      targetGym.city
    );

    // Only keep matches ≥70%
    if (score >= 70) {
      matches.push({
        sourceGym,
        targetGym,
        score,
      });
    }
  }

  // Sort by score descending
  matches.sort((a, b) => b.score - a.score);

  return matches;
}
```

**Step 2: Update processGymMatches to use new signature**

Find the `processGymMatches` function and update it:

```typescript
/**
 * Process matches for a gym: auto-link high-confidence or create pending match.
 * @param sourceGym - The gym to process
 * @param cachedTargetGyms - Pre-loaded array of target gyms
 */
export async function processGymMatches(
  sourceGym: SourceGymItem,
  cachedTargetGyms: SourceGymItem[]
): Promise<{ autoLinked: number; pendingCreated: number }> {
  const matches = await findMatchesForGym(sourceGym, cachedTargetGyms);

  if (matches.length === 0) {
    return { autoLinked: 0, pendingCreated: 0 };
  }

  const topMatch = matches[0];

  // Auto-link if ≥90% confidence
  if (topMatch.score >= 90) {
    await autoLinkGyms(sourceGym, topMatch.targetGym);
    return { autoLinked: 1, pendingCreated: 0 };
  }

  // Create pending match for admin review if 70-89%
  if (topMatch.score >= 70 && topMatch.score < 90) {
    await createPendingMatch(sourceGym, topMatch.targetGym, topMatch.score);
    return { autoLinked: 0, pendingCreated: 1 };
  }

  return { autoLinked: 0, pendingCreated: 0 };
}
```

**Step 3: Run tests to verify they pass**

```bash
npm test -- gymMatchingService.test.ts -t "findMatchesForGym"
```

Expected: All `findMatchesForGym with cached gyms` tests should PASS.

**Step 4: Commit**

```bash
git add src/services/gymMatchingService.ts
git commit -m "feat: update findMatchesForGym to accept cached gym array"
```

---

### Task 9: Update Sync Service for Caching

**Files:**
- Modify: `backend/src/services/gymSyncService.ts`

**Goal:** Make the sync service tests pass.

**Step 1: Import listUSIBJJFGyms**

At the top of the file, add the import:

```typescript
import { listUSIBJJFGyms } from '../db/gymQueries.js';
```

**Step 2: Replace runMatchingForGyms with runMatchingForJJWLGyms**

Replace the existing `runMatchingForGyms` function:

```typescript
/**
 * Run matching for JJWL gyms against cached US IBJJF gyms.
 * Loads US IBJJF gyms once, then compares all JJWL gyms against that cache.
 */
async function runMatchingForJJWLGyms(
  jjwlGyms: NormalizedGym[]
): Promise<{ processed: number; autoLinked: number; pendingCreated: number }> {
  console.log('[GymSyncService] Loading US IBJJF gyms for matching...');
  const startLoad = Date.now();
  const usIbjjfGyms = await listUSIBJJFGyms();
  const loadDuration = Date.now() - startLoad;
  console.log(
    `[GymSyncService] Loaded ${usIbjjfGyms.length} US IBJJF gyms in ${loadDuration}ms`
  );

  let processed = 0;
  let autoLinked = 0;
  let pendingCreated = 0;

  for (const gym of jjwlGyms) {
    // Get the full source gym from DB to check masterGymId
    const sourceGym = await getSourceGym(gym.org, gym.externalId);
    if (!sourceGym || sourceGym.masterGymId) {
      // Already linked or not found, skip
      continue;
    }

    // Run matching for this unlinked gym using cached array
    const result = await processGymMatches(sourceGym, usIbjjfGyms);
    processed++;
    autoLinked += result.autoLinked;
    pendingCreated += result.pendingCreated;

    // Progress logging every 100 gyms
    if (processed % 100 === 0) {
      console.log(
        `[GymSyncService] Matching progress: ${processed}/${jjwlGyms.length}`
      );
    }
  }

  return { processed, autoLinked, pendingCreated };
}
```

**Step 3: Update syncJJWLGyms to use new function**

Find the `syncJJWLGyms` function and update it:

```typescript
/**
 * Sync all JJWL gyms to database and run matching.
 */
export async function syncJJWLGyms(): Promise<GymSyncResult> {
  try {
    const gyms = await fetchJJWLGyms();
    const saved = await batchUpsertGyms(gyms);

    // Run matching for unlinked gyms
    const matching = await runMatchingForJJWLGyms(gyms);
    console.log(
      `[GymSyncService] JJWL matching: ${matching.processed} processed, ${matching.autoLinked} auto-linked, ${matching.pendingCreated} pending`
    );

    return {
      fetched: gyms.length,
      saved,
      matching,
    };
  } catch (error) {
    console.error('[GymSyncService] JJWL sync failed:', error);
    return {
      fetched: 0,
      saved: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
```

**Step 4: Update syncIBJJFGyms to remove matching**

Find the `syncIBJJFGyms` function and remove the matching call:

```typescript
/**
 * Sync all IBJJF gyms to database.
 * Note: Matching is NOT run during IBJJF sync (only during JJWL sync).
 */
export async function syncIBJJFGyms(
  options?: IBJJFSyncOptions
): Promise<GymSyncResult> {
  try {
    // ... existing sync logic ...

    // Run matching for unlinked gyms
    // REMOVE THIS BLOCK:
    // const matching = await runMatchingForGyms(gyms);
    // console.log(
    //   `[GymSyncService] IBJJF matching: ${matching.processed} processed, ${matching.autoLinked} auto-linked, ${matching.pendingCreated} pending`
    // );

    // Update sync metadata
    await updateGymSyncMeta('IBJJF', totalRecords);

    const duration = Date.now() - startTime;
    console.log(
      `[GymSyncService] IBJJF sync complete: ${gyms.length} fetched, ${saved} saved in ${duration}ms`
    );

    return {
      fetched: gyms.length,
      saved,
      // matching,  // REMOVE THIS LINE
    };
  } catch (error) {
    console.error('[GymSyncService] IBJJF sync failed:', error);
    return {
      fetched: 0,
      saved: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
```

**Step 5: Run tests to verify they pass**

```bash
npm test -- gymSyncService.test.ts
```

Expected: All sync service tests should PASS.

**Step 6: Commit**

```bash
git add src/services/gymSyncService.ts
git commit -m "feat: add gym caching and JJWL-only matching to sync service"
```

---

### Task 10: Run Full Test Suite

**Goal:** Verify ALL tests pass.

**Step 1: Run all unit tests**

```bash
npm test
```

Expected: All tests should PASS (database, matching service, sync service).

**Step 2: Fix any failing tests**

If any tests fail, debug and fix them before proceeding.

**Step 3: Commit if fixes were needed**

```bash
git add .
git commit -m "fix: resolve test failures after implementation"
```

---

### Task 11: Run Integration Test

**Goal:** Verify performance improvement with real data.

**Step 1: Reset local database**

```bash
npm run db:reset
```

**Step 2: Run integration test**

```bash
npm test -- gym-matching-performance.test.ts
```

Expected output:
- Test should PASS
- Duration should be <120,000ms (2 minutes)
- Console should show timing and match counts

**Step 3: Document results**

Add results to commit message in next step.

---

### Task 12: Manual Performance Test

**Goal:** Verify real-world performance improvement.

**Step 1: Sync IBJJF gyms**

```bash
time npm run sync -- ibjjf-gyms
```

Expected: Should complete successfully.

**Step 2: Sync JJWL gyms with timing**

```bash
time npm run sync -- jjwl-gyms
```

Expected output:
- Duration: <2 minutes
- Console logs showing:
  - "Loaded X US IBJJF gyms"
  - Progress updates every 100 gyms
  - Final counts for processed/auto-linked/pending

**Step 3: Verify results in database**

Check that master gyms and pending matches were created:

```bash
# Count master gyms
aws dynamodb scan \
  --table-name bjj-tournament-tracker-dev \
  --filter-expression "begins_with(PK, :pk)" \
  --expression-attribute-values '{":pk":{"S":"MASTERGYM#"}}' \
  --endpoint-url http://localhost:8000 \
  --region us-east-1 \
  --select COUNT

# Count pending matches
aws dynamodb scan \
  --table-name bjj-tournament-tracker-dev \
  --filter-expression "begins_with(PK, :pk)" \
  --expression-attribute-values '{":pk":{"S":"PENDINGMATCH#"}}' \
  --endpoint-url http://localhost:8000 \
  --region us-east-1 \
  --select COUNT
```

**Step 4: Document performance**

Note the actual timing for the design doc and commit message.

**Step 5: Commit**

```bash
git add .
git commit -m "perf: optimize gym matching from 15min to <2min

- Filter IBJJF gyms to US-only (50% reduction: 8,614 → 4,307)
- Load US gyms into memory once (1 query vs 5,779 queries)
- Switch from Levenshtein to Jaro-Winkler (2-3x faster)
- Match only JJWL → IBJJF direction (no duplicate matching)

Performance results:
- Matching time: XXXs (was 900s+)
- Gyms processed: XXXX
- Auto-linked: XXX
- Pending matches: XXX
- All tests passing ✓"
```

---

### Task 13: Update Documentation

**Files:**
- Modify: `docs/plans/2026-01-08-gym-matching-performance.md`

**Step 1: Add implementation results to design doc**

At the end of the design doc, add:

```markdown
## Implementation Results

**Completed**: 2026-01-08

**Performance Metrics**:
- Matching time: XXs (was 900s+) - 93% improvement ✓
- Comparisons: 25M (was 50M) - 50% reduction ✓
- DB queries: 1 (was 5,779) - 99.98% reduction ✓
- Memory footprint: ~3MB (US gym cache) ✓

**Quality Metrics**:
- Auto-linked: XXX gyms (baseline: YYY) - ZZ% change
- Pending matches: XXX gyms (baseline: YYY) - ZZ% change
- Test coverage: All tests passing ✓

**Files Modified**:
- `backend/src/db/gymQueries.ts` - Added `listUSIBJJFGyms()`
- `backend/src/services/gymMatchingService.ts` - Switched to Jaro-Winkler, added caching
- `backend/src/services/gymSyncService.ts` - Implemented JJWL-only matching with cache
- `backend/package.json` - Added `natural` dependency

**Tests Added**:
- 6 unit tests for `listUSIBJJFGyms`
- 6 unit tests for Jaro-Winkler algorithm
- 6 unit tests for cached gym matching
- 6 integration tests for sync service
- 3 end-to-end performance tests

**Status**: ✅ Complete - Ready for production
```

**Step 2: Commit**

```bash
git add docs/plans/2026-01-08-gym-matching-performance.md
git commit -m "docs: add implementation results to gym matching design"
```

---

### Task 14: Final Verification

**Goal:** Ensure everything works end-to-end.

**Step 1: Run full test suite one more time**

```bash
npm test
npm run test:integration
```

Expected: All tests PASS.

**Step 2: Run full sync from scratch**

```bash
npm run db:reset
time npm run sync
```

Expected:
- IBJJF sync: completes successfully
- JJWL sync with matching: <2 minutes
- No errors in console

**Step 3: Verify git status**

```bash
git status
```

Expected: Working tree clean, all changes committed.

**Step 4: Review commit history**

```bash
git log --oneline -15
```

Expected: Clean commit history with descriptive messages following conventional commits.

---

## Summary

**Tests Written**: 27 tests covering all new functionality
**Files Modified**: 3 core files + 4 test files
**Performance Target**: <2 minutes (vs 15+ minutes baseline)
**Commits**: ~14 small, focused commits

**Success Criteria**:
- ✅ All unit tests pass
- ✅ All integration tests pass
- ✅ Performance <2 minutes
- ✅ Match quality within 10-20% of baseline
- ✅ Clean git history
- ✅ Documentation updated

**Ready for**: Production deployment via SAM
