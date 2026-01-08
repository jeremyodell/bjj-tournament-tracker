# Gym Unification (IBJJF + JJWL) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Unify gyms from IBJJF and JJWL into master gym entities with fuzzy matching, enabling cross-org gym lookups.

**Architecture:** Master gym entities store canonical gym data. Source gyms (IBJJF/JJWL) link via `masterGymId`. Fuzzy matching runs during sync: 90%+ auto-links, 70-89% creates pending matches for admin review. Admin UI at `/admin/gym-matches` for reviewing pending matches.

**Tech Stack:** TypeScript, DynamoDB (single-table), AWS Lambda, Next.js 15, TanStack Query, Zustand

---

## Task 1: Add Master Gym and Pending Match Types

**Files:**
- Modify: `backend/src/db/types.ts`

**Step 1: Write the type definitions**

Add key builders and interfaces for master gym and pending match entities:

```typescript
// Add after buildGymSyncMetaPK (around line 41)

export const buildMasterGymPK = (id: string): string =>
  `MASTERGYM#${id}`;

export const buildPendingMatchPK = (id: string): string =>
  `PENDINGMATCH#${id}`;

// Add after GymSyncMetaItem interface (around line 217)

export interface MasterGymItem {
  PK: string; // MASTERGYM#{uuid}
  SK: 'META';
  GSI1PK: 'MASTERGYMS';
  GSI1SK: string; // {canonicalName}
  id: string;
  canonicalName: string;
  country: string | null;
  city: string | null;
  address: string | null;
  website: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MatchSignals {
  nameSimilarity: number;
  cityBoost: number;
  affiliationBoost: number;
}

export interface PendingMatchItem {
  PK: string; // PENDINGMATCH#{uuid}
  SK: 'META';
  GSI1PK: 'PENDINGMATCHES';
  GSI1SK: string; // {status}#{createdAt}
  id: string;
  ibjjfGymId: string;
  ibjjfGymName: string;
  ibjjfCity: string | null;
  ibjjfCountry: string | null;
  jjwlGymId: string;
  jjwlGymName: string;
  confidence: number;
  matchSignals: MatchSignals;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  reviewedAt: string | null;
}
```

**Step 2: Update DynamoDBItem union type**

Add to the union (around line 230):

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
  | GymSyncMetaItem
  | MasterGymItem
  | PendingMatchItem;
```

**Step 3: Verify TypeScript compiles**

Run: `cd backend && npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add backend/src/db/types.ts
git commit -m "feat(types): add MasterGymItem and PendingMatchItem types"
```

---

## Task 2: Add Master Gym DB Queries

**Files:**
- Create: `backend/src/db/masterGymQueries.ts`
- Create: `backend/src/__tests__/db/masterGymQueries.test.ts`

**Step 1: Write the failing tests**

Create `backend/src/__tests__/db/masterGymQueries.test.ts`:

```typescript
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('@aws-sdk/lib-dynamodb', () => ({
  PutCommand: jest.fn().mockImplementation((params) => params),
  GetCommand: jest.fn().mockImplementation((params) => params),
  QueryCommand: jest.fn().mockImplementation((params) => params),
  UpdateCommand: jest.fn().mockImplementation((params) => params),
}));

jest.mock('../../db/client.js', () => ({
  docClient: {
    send: jest.fn(),
  },
  TABLE_NAME: 'test-table',
  GSI1_NAME: 'GSI1',
}));

import {
  createMasterGym,
  getMasterGym,
  searchMasterGyms,
  linkSourceGymToMaster,
} from '../../db/masterGymQueries.js';
import { docClient } from '../../db/client.js';
import type { MasterGymItem } from '../../db/types.js';

describe('masterGymQueries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createMasterGym', () => {
    it('creates a master gym with generated UUID', async () => {
      const sendMock = jest.spyOn(docClient, 'send');
      sendMock.mockResolvedValue({});

      const result = await createMasterGym({
        canonicalName: 'Gracie Barra Orlando',
        city: 'Orlando',
        country: 'USA',
      });

      expect(result.id).toBeDefined();
      expect(result.canonicalName).toBe('Gracie Barra Orlando');
      expect(sendMock).toHaveBeenCalled();
    });
  });

  describe('getMasterGym', () => {
    it('returns master gym when found', async () => {
      const mockGym: MasterGymItem = {
        PK: 'MASTERGYM#123',
        SK: 'META',
        GSI1PK: 'MASTERGYMS',
        GSI1SK: 'Gracie Barra Orlando',
        id: '123',
        canonicalName: 'Gracie Barra Orlando',
        city: 'Orlando',
        country: 'USA',
        address: null,
        website: null,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      };

      const sendMock = jest.spyOn(docClient, 'send');
      sendMock.mockResolvedValue({ Item: mockGym });

      const result = await getMasterGym('123');

      expect(result).toEqual(mockGym);
    });

    it('returns null when not found', async () => {
      const sendMock = jest.spyOn(docClient, 'send');
      sendMock.mockResolvedValue({});

      const result = await getMasterGym('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('searchMasterGyms', () => {
    it('searches by name prefix', async () => {
      const mockGyms: MasterGymItem[] = [
        {
          PK: 'MASTERGYM#1',
          SK: 'META',
          GSI1PK: 'MASTERGYMS',
          GSI1SK: 'Gracie Barra Orlando',
          id: '1',
          canonicalName: 'Gracie Barra Orlando',
          city: 'Orlando',
          country: 'USA',
          address: null,
          website: null,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
      ];

      const sendMock = jest.spyOn(docClient, 'send');
      sendMock.mockResolvedValue({ Items: mockGyms });

      const result = await searchMasterGyms('Gracie');

      expect(result).toHaveLength(1);
      expect(result[0].canonicalName).toBe('Gracie Barra Orlando');
    });
  });

  describe('linkSourceGymToMaster', () => {
    it('updates source gym with masterGymId', async () => {
      const sendMock = jest.spyOn(docClient, 'send');
      sendMock.mockResolvedValue({});

      await linkSourceGymToMaster('IBJJF', '12345', 'master-uuid');

      expect(sendMock).toHaveBeenCalled();
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd backend && npm test -- masterGymQueries.test.ts`
Expected: FAIL (module not found)

**Step 3: Write the implementation**

Create `backend/src/db/masterGymQueries.ts`:

```typescript
import { randomUUID } from 'crypto';
import { PutCommand, GetCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME, GSI1_NAME } from './client.js';
import { buildMasterGymPK, buildSourceGymPK } from './types.js';
import type { MasterGymItem } from './types.js';

export interface CreateMasterGymInput {
  canonicalName: string;
  city?: string | null;
  country?: string | null;
  address?: string | null;
  website?: string | null;
}

/**
 * Create a new master gym entity
 */
export async function createMasterGym(
  input: CreateMasterGymInput
): Promise<MasterGymItem> {
  const id = randomUUID();
  const now = new Date().toISOString();

  const item: MasterGymItem = {
    PK: buildMasterGymPK(id),
    SK: 'META',
    GSI1PK: 'MASTERGYMS',
    GSI1SK: input.canonicalName,
    id,
    canonicalName: input.canonicalName,
    city: input.city ?? null,
    country: input.country ?? null,
    address: input.address ?? null,
    website: input.website ?? null,
    createdAt: now,
    updatedAt: now,
  };

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: item,
    })
  );

  return item;
}

/**
 * Get a master gym by ID
 */
export async function getMasterGym(id: string): Promise<MasterGymItem | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: buildMasterGymPK(id),
        SK: 'META',
      },
    })
  );

  return (result.Item as MasterGymItem) || null;
}

/**
 * Search master gyms by name prefix
 */
export async function searchMasterGyms(
  namePrefix: string,
  limit = 20
): Promise<MasterGymItem[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: GSI1_NAME,
      KeyConditionExpression: 'GSI1PK = :pk AND begins_with(GSI1SK, :prefix)',
      ExpressionAttributeValues: {
        ':pk': 'MASTERGYMS',
        ':prefix': namePrefix,
      },
      Limit: limit,
    })
  );

  return (result.Items || []) as MasterGymItem[];
}

/**
 * Link a source gym to a master gym
 */
export async function linkSourceGymToMaster(
  org: 'IBJJF' | 'JJWL',
  externalId: string,
  masterGymId: string
): Promise<void> {
  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: buildSourceGymPK(org, externalId),
        SK: 'META',
      },
      UpdateExpression: 'SET masterGymId = :mid, updatedAt = :now',
      ExpressionAttributeValues: {
        ':mid': masterGymId,
        ':now': new Date().toISOString(),
      },
    })
  );
}

/**
 * Unlink a source gym from its master gym
 */
export async function unlinkSourceGymFromMaster(
  org: 'IBJJF' | 'JJWL',
  externalId: string
): Promise<void> {
  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: buildSourceGymPK(org, externalId),
        SK: 'META',
      },
      UpdateExpression: 'SET masterGymId = :null, updatedAt = :now',
      ExpressionAttributeValues: {
        ':null': null,
        ':now': new Date().toISOString(),
      },
    })
  );
}
```

**Step 4: Run tests to verify they pass**

Run: `cd backend && npm test -- masterGymQueries.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/src/db/masterGymQueries.ts backend/src/__tests__/db/masterGymQueries.test.ts
git commit -m "feat(db): add master gym queries"
```

---

## Task 3: Add Pending Match DB Queries

**Files:**
- Create: `backend/src/db/pendingMatchQueries.ts`
- Create: `backend/src/__tests__/db/pendingMatchQueries.test.ts`

**Step 1: Write the failing tests**

Create `backend/src/__tests__/db/pendingMatchQueries.test.ts`:

```typescript
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('@aws-sdk/lib-dynamodb', () => ({
  PutCommand: jest.fn().mockImplementation((params) => params),
  GetCommand: jest.fn().mockImplementation((params) => params),
  QueryCommand: jest.fn().mockImplementation((params) => params),
  UpdateCommand: jest.fn().mockImplementation((params) => params),
}));

jest.mock('../../db/client.js', () => ({
  docClient: {
    send: jest.fn(),
  },
  TABLE_NAME: 'test-table',
  GSI1_NAME: 'GSI1',
}));

import {
  createPendingMatch,
  getPendingMatch,
  listPendingMatches,
  updatePendingMatchStatus,
} from '../../db/pendingMatchQueries.js';
import { docClient } from '../../db/client.js';
import type { PendingMatchItem, MatchSignals } from '../../db/types.js';

describe('pendingMatchQueries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createPendingMatch', () => {
    it('creates a pending match with generated UUID', async () => {
      const sendMock = jest.spyOn(docClient, 'send');
      sendMock.mockResolvedValue({});

      const signals: MatchSignals = {
        nameSimilarity: 75,
        cityBoost: 15,
        affiliationBoost: 0,
      };

      const result = await createPendingMatch({
        ibjjfGymId: 'ibjjf-123',
        ibjjfGymName: 'Gracie Barra Orlando',
        ibjjfCity: 'Orlando',
        ibjjfCountry: 'USA',
        jjwlGymId: 'jjwl-456',
        jjwlGymName: 'GB Orlando',
        confidence: 85,
        matchSignals: signals,
      });

      expect(result.id).toBeDefined();
      expect(result.status).toBe('pending');
      expect(result.confidence).toBe(85);
      expect(sendMock).toHaveBeenCalled();
    });
  });

  describe('listPendingMatches', () => {
    it('lists matches by status', async () => {
      const mockMatches: PendingMatchItem[] = [
        {
          PK: 'PENDINGMATCH#1',
          SK: 'META',
          GSI1PK: 'PENDINGMATCHES',
          GSI1SK: 'pending#2026-01-01T00:00:00Z',
          id: '1',
          ibjjfGymId: 'ibjjf-123',
          ibjjfGymName: 'Gracie Barra Orlando',
          ibjjfCity: 'Orlando',
          ibjjfCountry: 'USA',
          jjwlGymId: 'jjwl-456',
          jjwlGymName: 'GB Orlando',
          confidence: 85,
          matchSignals: { nameSimilarity: 70, cityBoost: 15, affiliationBoost: 0 },
          status: 'pending',
          createdAt: '2026-01-01T00:00:00Z',
          reviewedAt: null,
        },
      ];

      const sendMock = jest.spyOn(docClient, 'send');
      sendMock.mockResolvedValue({ Items: mockMatches });

      const result = await listPendingMatches('pending');

      expect(result.items).toHaveLength(1);
      expect(result.items[0].status).toBe('pending');
    });
  });

  describe('updatePendingMatchStatus', () => {
    it('updates status to approved', async () => {
      const sendMock = jest.spyOn(docClient, 'send');
      sendMock.mockResolvedValue({});

      await updatePendingMatchStatus('match-123', 'approved');

      expect(sendMock).toHaveBeenCalled();
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd backend && npm test -- pendingMatchQueries.test.ts`
Expected: FAIL (module not found)

**Step 3: Write the implementation**

Create `backend/src/db/pendingMatchQueries.ts`:

```typescript
import { randomUUID } from 'crypto';
import { PutCommand, GetCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME, GSI1_NAME } from './client.js';
import { buildPendingMatchPK } from './types.js';
import type { PendingMatchItem, MatchSignals } from './types.js';

export interface CreatePendingMatchInput {
  ibjjfGymId: string;
  ibjjfGymName: string;
  ibjjfCity: string | null;
  ibjjfCountry: string | null;
  jjwlGymId: string;
  jjwlGymName: string;
  confidence: number;
  matchSignals: MatchSignals;
}

/**
 * Create a new pending match
 */
export async function createPendingMatch(
  input: CreatePendingMatchInput
): Promise<PendingMatchItem> {
  const id = randomUUID();
  const now = new Date().toISOString();

  const item: PendingMatchItem = {
    PK: buildPendingMatchPK(id),
    SK: 'META',
    GSI1PK: 'PENDINGMATCHES',
    GSI1SK: `pending#${now}`,
    id,
    ibjjfGymId: input.ibjjfGymId,
    ibjjfGymName: input.ibjjfGymName,
    ibjjfCity: input.ibjjfCity,
    ibjjfCountry: input.ibjjfCountry,
    jjwlGymId: input.jjwlGymId,
    jjwlGymName: input.jjwlGymName,
    confidence: input.confidence,
    matchSignals: input.matchSignals,
    status: 'pending',
    createdAt: now,
    reviewedAt: null,
  };

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: item,
    })
  );

  return item;
}

/**
 * Get a pending match by ID
 */
export async function getPendingMatch(id: string): Promise<PendingMatchItem | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: buildPendingMatchPK(id),
        SK: 'META',
      },
    })
  );

  return (result.Item as PendingMatchItem) || null;
}

/**
 * List pending matches by status
 */
export async function listPendingMatches(
  status: 'pending' | 'approved' | 'rejected',
  limit = 50,
  lastKey?: Record<string, unknown>
): Promise<{ items: PendingMatchItem[]; lastKey?: Record<string, unknown> }> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: GSI1_NAME,
      KeyConditionExpression: 'GSI1PK = :pk AND begins_with(GSI1SK, :status)',
      ExpressionAttributeValues: {
        ':pk': 'PENDINGMATCHES',
        ':status': `${status}#`,
      },
      Limit: limit,
      ExclusiveStartKey: lastKey,
      ScanIndexForward: false, // Newest first
    })
  );

  return {
    items: (result.Items || []) as PendingMatchItem[],
    lastKey: result.LastEvaluatedKey,
  };
}

/**
 * Update pending match status
 */
export async function updatePendingMatchStatus(
  id: string,
  status: 'approved' | 'rejected'
): Promise<void> {
  const now = new Date().toISOString();

  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: buildPendingMatchPK(id),
        SK: 'META',
      },
      UpdateExpression: 'SET #status = :status, GSI1SK = :gsi1sk, reviewedAt = :now',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':status': status,
        ':gsi1sk': `${status}#${now}`,
        ':now': now,
      },
    })
  );
}

/**
 * Check if a pending match already exists for these two gyms
 */
export async function findExistingPendingMatch(
  ibjjfGymId: string,
  jjwlGymId: string
): Promise<PendingMatchItem | null> {
  // Query all pending matches and filter
  // This is acceptable for the expected volume
  const result = await listPendingMatches('pending', 250);

  return result.items.find(
    (m) => m.ibjjfGymId === ibjjfGymId && m.jjwlGymId === jjwlGymId
  ) || null;
}
```

**Step 4: Run tests to verify they pass**

Run: `cd backend && npm test -- pendingMatchQueries.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/src/db/pendingMatchQueries.ts backend/src/__tests__/db/pendingMatchQueries.test.ts
git commit -m "feat(db): add pending match queries"
```

---

## Task 4: Add Fuzzy Matching Service

**Files:**
- Create: `backend/src/services/gymMatchingService.ts`
- Create: `backend/src/__tests__/services/gymMatchingService.test.ts`

**Step 1: Write the failing tests**

Create `backend/src/__tests__/services/gymMatchingService.test.ts`:

```typescript
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../db/gymQueries.js');
jest.mock('../../db/masterGymQueries.js');
jest.mock('../../db/pendingMatchQueries.js');

import {
  normalizeGymName,
  calculateNameSimilarity,
  calculateMatchScore,
  findMatchesForGym,
} from '../../services/gymMatchingService.js';
import type { SourceGymItem } from '../../db/types.js';

describe('gymMatchingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('normalizeGymName', () => {
    it('lowercases and removes common suffixes', () => {
      expect(normalizeGymName('Gracie Barra Orlando BJJ')).toBe('gracie barra orlando');
      expect(normalizeGymName('Alliance Academy')).toBe('alliance');
      expect(normalizeGymName('ATOS JIU JITSU')).toBe('atos');
    });

    it('collapses whitespace', () => {
      expect(normalizeGymName('Gracie   Barra   Orlando')).toBe('gracie barra orlando');
    });
  });

  describe('calculateNameSimilarity', () => {
    it('returns 100 for identical names', () => {
      expect(calculateNameSimilarity('gracie barra', 'gracie barra')).toBe(100);
    });

    it('returns high score for similar names', () => {
      const score = calculateNameSimilarity('gracie barra orlando', 'gb orlando');
      expect(score).toBeGreaterThan(40);
      expect(score).toBeLessThan(80);
    });

    it('returns low score for different names', () => {
      const score = calculateNameSimilarity('alliance', 'checkmat');
      expect(score).toBeLessThan(40);
    });
  });

  describe('calculateMatchScore', () => {
    it('applies city boost when city appears in name', () => {
      const ibjjfGym: Partial<SourceGymItem> = {
        name: 'Gracie Barra Orlando',
        city: 'Orlando',
      };
      const jjwlGym: Partial<SourceGymItem> = {
        name: 'GB Orlando',
      };

      const result = calculateMatchScore(
        ibjjfGym as SourceGymItem,
        jjwlGym as SourceGymItem
      );

      expect(result.signals.cityBoost).toBe(15);
    });

    it('applies affiliation boost for known affiliations', () => {
      const ibjjfGym: Partial<SourceGymItem> = {
        name: 'Gracie Barra Houston',
      };
      const jjwlGym: Partial<SourceGymItem> = {
        name: 'Gracie Barra TX',
      };

      const result = calculateMatchScore(
        ibjjfGym as SourceGymItem,
        jjwlGym as SourceGymItem
      );

      expect(result.signals.affiliationBoost).toBe(10);
    });

    it('returns total score combining all signals', () => {
      const ibjjfGym: Partial<SourceGymItem> = {
        name: 'Gracie Barra Orlando',
        city: 'Orlando',
      };
      const jjwlGym: Partial<SourceGymItem> = {
        name: 'GB Orlando',
      };

      const result = calculateMatchScore(
        ibjjfGym as SourceGymItem,
        jjwlGym as SourceGymItem
      );

      expect(result.totalScore).toBe(
        result.signals.nameSimilarity +
        result.signals.cityBoost +
        result.signals.affiliationBoost
      );
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd backend && npm test -- gymMatchingService.test.ts`
Expected: FAIL (module not found)

**Step 3: Write the implementation**

Create `backend/src/services/gymMatchingService.ts`:

```typescript
import { listGyms } from '../db/gymQueries.js';
import {
  createMasterGym,
  linkSourceGymToMaster,
} from '../db/masterGymQueries.js';
import {
  createPendingMatch,
  findExistingPendingMatch,
} from '../db/pendingMatchQueries.js';
import type { SourceGymItem, MatchSignals } from '../db/types.js';

// Known major affiliations for boost detection
const KNOWN_AFFILIATIONS = [
  'gracie barra',
  'alliance',
  'atos',
  'checkmat',
  'nova uniao',
  'carlson gracie',
  'ribeiro',
  'zenith',
  'unity',
  'dream art',
  'cicero costha',
  'gfteam',
  'soul fighters',
];

// Suffixes to remove during normalization
const REMOVE_SUFFIXES = [
  'bjj',
  'jiu jitsu',
  'jiu-jitsu',
  'jiujitsu',
  'brazilian jiu jitsu',
  'brazilian jiu-jitsu',
  'academy',
  'team',
  'hq',
  'headquarters',
];

export interface MatchResult {
  totalScore: number;
  signals: MatchSignals;
}

export interface GymMatchCandidate {
  gym: SourceGymItem;
  score: number;
  signals: MatchSignals;
}

/**
 * Normalize gym name for comparison
 */
export function normalizeGymName(name: string): string {
  let normalized = name.toLowerCase().trim();

  // Remove known suffixes
  for (const suffix of REMOVE_SUFFIXES) {
    normalized = normalized.replace(new RegExp(`\\s*${suffix}\\s*$`, 'i'), '');
    normalized = normalized.replace(new RegExp(`\\s*${suffix}\\s+`, 'i'), ' ');
  }

  // Collapse whitespace
  normalized = normalized.replace(/\s+/g, ' ').trim();

  return normalized;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculate name similarity (0-100)
 */
export function calculateNameSimilarity(name1: string, name2: string): number {
  const n1 = normalizeGymName(name1);
  const n2 = normalizeGymName(name2);

  if (n1 === n2) return 100;

  const maxLen = Math.max(n1.length, n2.length);
  if (maxLen === 0) return 100;

  const distance = levenshteinDistance(n1, n2);
  const similarity = ((maxLen - distance) / maxLen) * 100;

  return Math.round(similarity);
}

/**
 * Check if city appears in gym name
 */
function cityAppearsInName(city: string | null | undefined, name: string): boolean {
  if (!city) return false;
  const normalizedCity = city.toLowerCase().trim();
  const normalizedName = name.toLowerCase();
  return normalizedName.includes(normalizedCity);
}

/**
 * Detect if both names contain a known affiliation
 */
function detectSharedAffiliation(name1: string, name2: string): boolean {
  const n1 = name1.toLowerCase();
  const n2 = name2.toLowerCase();

  for (const affiliation of KNOWN_AFFILIATIONS) {
    if (n1.includes(affiliation) && n2.includes(affiliation)) {
      return true;
    }
  }

  // Check for common abbreviations
  if ((n1.includes('gb ') || n1.startsWith('gb')) &&
      (n2.includes('gracie barra') || n2.includes('gb '))) {
    return true;
  }

  return false;
}

/**
 * Calculate full match score with all signals
 */
export function calculateMatchScore(
  ibjjfGym: SourceGymItem,
  jjwlGym: SourceGymItem
): MatchResult {
  const nameSimilarity = calculateNameSimilarity(ibjjfGym.name, jjwlGym.name);

  // City boost: +15 if IBJJF city appears in JJWL name
  const cityBoost = cityAppearsInName(ibjjfGym.city, jjwlGym.name) ? 15 : 0;

  // Affiliation boost: +10 if both have same affiliation
  const affiliationBoost = detectSharedAffiliation(ibjjfGym.name, jjwlGym.name) ? 10 : 0;

  const signals: MatchSignals = {
    nameSimilarity,
    cityBoost,
    affiliationBoost,
  };

  // Cap total at 100
  const totalScore = Math.min(100, nameSimilarity + cityBoost + affiliationBoost);

  return { totalScore, signals };
}

/**
 * Find potential matches for a gym in the opposite org
 */
export async function findMatchesForGym(
  gym: SourceGymItem,
  targetOrg: 'IBJJF' | 'JJWL'
): Promise<GymMatchCandidate[]> {
  const candidates: GymMatchCandidate[] = [];

  // Load all gyms from target org
  let lastKey: Record<string, unknown> | undefined;
  const allTargetGyms: SourceGymItem[] = [];

  do {
    const result = await listGyms(targetOrg, 250, lastKey);
    allTargetGyms.push(...result.items);
    lastKey = result.lastKey;
  } while (lastKey);

  // Calculate scores for each
  for (const targetGym of allTargetGyms) {
    // Skip if already linked
    if (targetGym.masterGymId) continue;

    const [ibjjfGym, jjwlGym] = gym.org === 'IBJJF'
      ? [gym, targetGym]
      : [targetGym, gym];

    const { totalScore, signals } = calculateMatchScore(ibjjfGym, jjwlGym);

    // Only include if above minimum threshold
    if (totalScore >= 70) {
      candidates.push({
        gym: targetGym,
        score: totalScore,
        signals,
      });
    }
  }

  // Sort by score descending
  candidates.sort((a, b) => b.score - a.score);

  return candidates;
}

/**
 * Process matches for a newly synced gym
 * - Auto-link if score >= 90
 * - Create pending match if 70-89
 */
export async function processGymMatches(gym: SourceGymItem): Promise<{
  autoLinked: boolean;
  pendingCreated: number;
}> {
  // Skip if already linked
  if (gym.masterGymId) {
    return { autoLinked: false, pendingCreated: 0 };
  }

  const targetOrg = gym.org === 'IBJJF' ? 'JJWL' : 'IBJJF';
  const candidates = await findMatchesForGym(gym, targetOrg);

  let autoLinked = false;
  let pendingCreated = 0;

  for (const candidate of candidates) {
    const [ibjjfGym, jjwlGym] = gym.org === 'IBJJF'
      ? [gym, candidate.gym]
      : [candidate.gym, gym];

    if (candidate.score >= 90 && !autoLinked) {
      // Auto-link: create master gym and link both
      const masterGym = await createMasterGym({
        canonicalName: ibjjfGym.name, // Prefer IBJJF name
        city: ibjjfGym.city,
        country: ibjjfGym.country,
        address: ibjjfGym.address,
        website: ibjjfGym.website,
      });

      await linkSourceGymToMaster('IBJJF', ibjjfGym.externalId, masterGym.id);
      await linkSourceGymToMaster('JJWL', jjwlGym.externalId, masterGym.id);

      autoLinked = true;
      console.log(
        `[GymMatching] Auto-linked: "${ibjjfGym.name}" <-> "${jjwlGym.name}" (${candidate.score}%)`
      );
    } else if (candidate.score >= 70 && candidate.score < 90) {
      // Check if pending match already exists
      const existing = await findExistingPendingMatch(
        ibjjfGym.externalId,
        jjwlGym.externalId
      );

      if (!existing) {
        await createPendingMatch({
          ibjjfGymId: ibjjfGym.externalId,
          ibjjfGymName: ibjjfGym.name,
          ibjjfCity: ibjjfGym.city ?? null,
          ibjjfCountry: ibjjfGym.country ?? null,
          jjwlGymId: jjwlGym.externalId,
          jjwlGymName: jjwlGym.name,
          confidence: candidate.score,
          matchSignals: candidate.signals,
        });

        pendingCreated++;
        console.log(
          `[GymMatching] Pending: "${ibjjfGym.name}" <-> "${jjwlGym.name}" (${candidate.score}%)`
        );
      }
    }
  }

  return { autoLinked, pendingCreated };
}
```

**Step 4: Run tests to verify they pass**

Run: `cd backend && npm test -- gymMatchingService.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/src/services/gymMatchingService.ts backend/src/__tests__/services/gymMatchingService.test.ts
git commit -m "feat(services): add gym matching service with fuzzy matching"
```

---

## Task 5: Integrate Matching into Gym Sync

**Files:**
- Modify: `backend/src/services/gymSyncService.ts`
- Modify: `backend/src/__tests__/services/gymSyncService.test.ts`

**Step 1: Update the sync service**

Add matching integration to `syncJJWLGyms` and `syncIBJJFGyms`:

```typescript
// Add import at top
import { processGymMatches } from './gymMatchingService.js';

// Update syncJJWLGyms to run matching after upsert
export async function syncJJWLGyms(): Promise<GymSyncResult> {
  try {
    const gyms = await fetchJJWLGyms();
    const saved = await batchUpsertGyms(gyms);

    // Run matching for new gyms
    let autoLinked = 0;
    let pendingCreated = 0;

    for (const gym of gyms) {
      const sourceGym = await getSourceGym('JJWL', gym.externalId);
      if (sourceGym && !sourceGym.masterGymId) {
        const result = await processGymMatches(sourceGym);
        if (result.autoLinked) autoLinked++;
        pendingCreated += result.pendingCreated;
      }
    }

    console.log(`[GymSync] JJWL matching: ${autoLinked} auto-linked, ${pendingCreated} pending`);

    return {
      fetched: gyms.length,
      saved,
    };
  } catch (error) {
    // ... existing error handling
  }
}
```

**Step 2: Add test for matching integration**

Add to `gymSyncService.test.ts`:

```typescript
import * as gymMatchingService from '../../services/gymMatchingService.js';

// Add in beforeEach
jest.mock('../../services/gymMatchingService.js');

describe('syncJJWLGyms with matching', () => {
  it('runs matching for new gyms', async () => {
    const mockGyms: NormalizedGym[] = [
      { org: 'JJWL', externalId: '1', name: 'Gym A' },
    ];

    jest.spyOn(jjwlGymFetcher, 'fetchJJWLGyms').mockResolvedValue(mockGyms);
    jest.spyOn(gymQueries, 'batchUpsertGyms').mockResolvedValue(1);
    jest.spyOn(gymQueries, 'getSourceGym').mockResolvedValue({
      PK: 'SRCGYM#JJWL#1',
      SK: 'META',
      GSI1PK: 'GYMS',
      GSI1SK: 'JJWL#Gym A',
      org: 'JJWL',
      externalId: '1',
      name: 'Gym A',
      masterGymId: null,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    });
    jest.spyOn(gymMatchingService, 'processGymMatches').mockResolvedValue({
      autoLinked: false,
      pendingCreated: 1,
    });

    await syncJJWLGyms();

    expect(gymMatchingService.processGymMatches).toHaveBeenCalled();
  });
});
```

**Step 3: Run tests**

Run: `cd backend && npm test -- gymSyncService.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add backend/src/services/gymSyncService.ts backend/src/__tests__/services/gymSyncService.test.ts
git commit -m "feat(sync): integrate gym matching into sync flow"
```

---

## Task 6: Add Admin API Endpoints

**Files:**
- Create: `backend/src/handlers/adminMatches.ts`
- Create: `backend/src/__tests__/handlers/adminMatches.test.ts`
- Modify: `backend/template.yaml`

**Step 1: Write the failing tests**

Create `backend/src/__tests__/handlers/adminMatches.test.ts`:

```typescript
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('../../db/pendingMatchQueries.js');
jest.mock('../../db/masterGymQueries.js');
jest.mock('../../db/gymQueries.js');

import { handler } from '../../handlers/adminMatches.js';
import * as pendingMatchQueries from '../../db/pendingMatchQueries.js';
import type { APIGatewayProxyEvent, Context } from 'aws-lambda';

const mockContext: Context = {
  awsRequestId: 'test-123',
} as Context;

describe('adminMatches handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /admin/pending-matches', () => {
    it('returns pending matches', async () => {
      const mockMatches = [
        {
          id: '1',
          ibjjfGymName: 'Test Gym',
          jjwlGymName: 'Test',
          confidence: 85,
          status: 'pending',
        },
      ];

      jest.spyOn(pendingMatchQueries, 'listPendingMatches').mockResolvedValue({
        items: mockMatches as any,
      });

      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'GET',
        path: '/admin/pending-matches',
        queryStringParameters: { status: 'pending' },
      };

      const result = await handler(event as APIGatewayProxyEvent, mockContext);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.matches).toHaveLength(1);
    });
  });

  describe('POST /admin/pending-matches/{id}/approve', () => {
    it('approves a match and creates master gym', async () => {
      const mockMatch = {
        id: '1',
        ibjjfGymId: 'ibjjf-1',
        ibjjfGymName: 'Test IBJJF',
        ibjjfCity: 'Orlando',
        jjwlGymId: 'jjwl-1',
        jjwlGymName: 'Test JJWL',
        status: 'pending',
      };

      jest.spyOn(pendingMatchQueries, 'getPendingMatch').mockResolvedValue(mockMatch as any);
      jest.spyOn(pendingMatchQueries, 'updatePendingMatchStatus').mockResolvedValue();

      const event: Partial<APIGatewayProxyEvent> = {
        httpMethod: 'POST',
        path: '/admin/pending-matches/1/approve',
        pathParameters: { id: '1' },
      };

      const result = await handler(event as APIGatewayProxyEvent, mockContext);

      expect(result.statusCode).toBe(200);
      expect(pendingMatchQueries.updatePendingMatchStatus).toHaveBeenCalledWith('1', 'approved');
    });
  });
});
```

**Step 2: Write the handler**

Create `backend/src/handlers/adminMatches.ts`:

```typescript
import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import {
  listPendingMatches,
  getPendingMatch,
  updatePendingMatchStatus,
} from '../db/pendingMatchQueries.js';
import {
  createMasterGym,
  linkSourceGymToMaster,
  unlinkSourceGymFromMaster,
} from '../db/masterGymQueries.js';
import { getSourceGym } from '../db/gymQueries.js';

// Hardcoded admin list for MVP
const ADMIN_USER_IDS = ['admin-user-id-here'];

function isAdmin(userId: string | undefined): boolean {
  // TODO: Replace with proper role check
  return true; // Allow all for now during development
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Content-Type': 'application/json',
  };
}

export async function handler(
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> {
  const { httpMethod, path, pathParameters, queryStringParameters } = event;

  try {
    // GET /admin/pending-matches
    if (httpMethod === 'GET' && path.includes('/pending-matches') && !pathParameters?.id) {
      const status = (queryStringParameters?.status || 'pending') as 'pending' | 'approved' | 'rejected';
      const result = await listPendingMatches(status);

      return {
        statusCode: 200,
        headers: corsHeaders(),
        body: JSON.stringify({ matches: result.items }),
      };
    }

    // POST /admin/pending-matches/{id}/approve
    if (httpMethod === 'POST' && path.includes('/approve')) {
      const matchId = pathParameters?.id;
      if (!matchId) {
        return {
          statusCode: 400,
          headers: corsHeaders(),
          body: JSON.stringify({ error: 'Match ID required' }),
        };
      }

      const match = await getPendingMatch(matchId);
      if (!match) {
        return {
          statusCode: 404,
          headers: corsHeaders(),
          body: JSON.stringify({ error: 'Match not found' }),
        };
      }

      // Get source gyms for details
      const ibjjfGym = await getSourceGym('IBJJF', match.ibjjfGymId);

      // Create master gym
      const masterGym = await createMasterGym({
        canonicalName: match.ibjjfGymName,
        city: match.ibjjfCity,
        country: match.ibjjfCountry,
      });

      // Link both source gyms
      await linkSourceGymToMaster('IBJJF', match.ibjjfGymId, masterGym.id);
      await linkSourceGymToMaster('JJWL', match.jjwlGymId, masterGym.id);

      // Update match status
      await updatePendingMatchStatus(matchId, 'approved');

      return {
        statusCode: 200,
        headers: corsHeaders(),
        body: JSON.stringify({ success: true, masterGymId: masterGym.id }),
      };
    }

    // POST /admin/pending-matches/{id}/reject
    if (httpMethod === 'POST' && path.includes('/reject')) {
      const matchId = pathParameters?.id;
      if (!matchId) {
        return {
          statusCode: 400,
          headers: corsHeaders(),
          body: JSON.stringify({ error: 'Match ID required' }),
        };
      }

      await updatePendingMatchStatus(matchId, 'rejected');

      return {
        statusCode: 200,
        headers: corsHeaders(),
        body: JSON.stringify({ success: true }),
      };
    }

    // POST /admin/master-gyms/{id}/unlink
    if (httpMethod === 'POST' && path.includes('/unlink')) {
      const body = JSON.parse(event.body || '{}');
      const { org, externalId } = body;

      if (!org || !externalId) {
        return {
          statusCode: 400,
          headers: corsHeaders(),
          body: JSON.stringify({ error: 'org and externalId required' }),
        };
      }

      await unlinkSourceGymFromMaster(org, externalId);

      return {
        statusCode: 200,
        headers: corsHeaders(),
        body: JSON.stringify({ success: true }),
      };
    }

    return {
      statusCode: 404,
      headers: corsHeaders(),
      body: JSON.stringify({ error: 'Not found' }),
    };
  } catch (error) {
    console.error('[AdminMatches] Error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
}
```

**Step 3: Add to SAM template**

Add to `backend/template.yaml` under Resources:

```yaml
  AdminMatchesFunction:
    Type: AWS::Serverless::Function
    Properties:
      Handler: handlers/adminMatches.handler
      Runtime: nodejs20.x
      Timeout: 30
      MemorySize: 256
      Policies:
        - DynamoDBCrudPolicy:
            TableName: !Ref TournamentTable
      Events:
        GetPendingMatches:
          Type: Api
          Properties:
            Path: /admin/pending-matches
            Method: GET
        ApproveMatch:
          Type: Api
          Properties:
            Path: /admin/pending-matches/{id}/approve
            Method: POST
        RejectMatch:
          Type: Api
          Properties:
            Path: /admin/pending-matches/{id}/reject
            Method: POST
        UnlinkGym:
          Type: Api
          Properties:
            Path: /admin/master-gyms/{id}/unlink
            Method: POST
    Metadata:
      BuildMethod: esbuild
      BuildProperties:
        Minify: true
        Target: es2022
        Format: esm
        OutExtension:
          - .js=.mjs
        EntryPoints:
          - src/handlers/adminMatches.ts
```

**Step 4: Run tests**

Run: `cd backend && npm test -- adminMatches.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/src/handlers/adminMatches.ts backend/src/__tests__/handlers/adminMatches.test.ts backend/template.yaml
git commit -m "feat(api): add admin match review endpoints"
```

---

## Task 7: Add User Gym Search API

**Files:**
- Create: `backend/src/handlers/masterGyms.ts`
- Modify: `backend/template.yaml`

**Step 1: Write the handler**

Create `backend/src/handlers/masterGyms.ts`:

```typescript
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { searchMasterGyms, getMasterGym } from '../db/masterGymQueries.js';
import { listGyms } from '../db/gymQueries.js';
import type { MasterGymItem, SourceGymItem } from '../db/types.js';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Content-Type': 'application/json',
  };
}

interface MasterGymWithSources {
  id: string;
  canonicalName: string;
  city: string | null;
  country: string | null;
  sources: {
    IBJJF: string | null;
    JJWL: string | null;
  };
}

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const { httpMethod, path, pathParameters, queryStringParameters } = event;

  try {
    // GET /gyms/search?q=query
    if (httpMethod === 'GET' && path.includes('/search')) {
      const query = queryStringParameters?.q;
      if (!query || query.length < 2) {
        return {
          statusCode: 400,
          headers: corsHeaders(),
          body: JSON.stringify({ error: 'Query must be at least 2 characters' }),
        };
      }

      const masterGyms = await searchMasterGyms(query, 20);

      // Get source gym mappings
      const results: MasterGymWithSources[] = [];

      // Also search source gyms for unlinked gyms
      const [ibjjfGyms, jjwlGyms] = await Promise.all([
        listGyms('IBJJF', 50),
        listGyms('JJWL', 50),
      ]);

      // Include master gyms
      for (const mg of masterGyms) {
        // Find linked source gyms
        const ibjjfSource = ibjjfGyms.items.find(g => g.masterGymId === mg.id);
        const jjwlSource = jjwlGyms.items.find(g => g.masterGymId === mg.id);

        results.push({
          id: mg.id,
          canonicalName: mg.canonicalName,
          city: mg.city,
          country: mg.country,
          sources: {
            IBJJF: ibjjfSource?.externalId || null,
            JJWL: jjwlSource?.externalId || null,
          },
        });
      }

      return {
        statusCode: 200,
        headers: corsHeaders(),
        body: JSON.stringify({ gyms: results }),
      };
    }

    // GET /gyms/{id}
    if (httpMethod === 'GET' && pathParameters?.id) {
      const gym = await getMasterGym(pathParameters.id);
      if (!gym) {
        return {
          statusCode: 404,
          headers: corsHeaders(),
          body: JSON.stringify({ error: 'Gym not found' }),
        };
      }

      return {
        statusCode: 200,
        headers: corsHeaders(),
        body: JSON.stringify(gym),
      };
    }

    return {
      statusCode: 404,
      headers: corsHeaders(),
      body: JSON.stringify({ error: 'Not found' }),
    };
  } catch (error) {
    console.error('[MasterGyms] Error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
}
```

**Step 2: Add to SAM template**

Add to `backend/template.yaml`:

```yaml
  MasterGymsFunction:
    Type: AWS::Serverless::Function
    Properties:
      Handler: handlers/masterGyms.handler
      Runtime: nodejs20.x
      Timeout: 10
      MemorySize: 256
      Policies:
        - DynamoDBReadPolicy:
            TableName: !Ref TournamentTable
      Events:
        SearchGyms:
          Type: Api
          Properties:
            Path: /gyms/search
            Method: GET
        GetGym:
          Type: Api
          Properties:
            Path: /gyms/{id}
            Method: GET
    Metadata:
      BuildMethod: esbuild
      BuildProperties:
        Minify: true
        Target: es2022
        Format: esm
        OutExtension:
          - .js=.mjs
        EntryPoints:
          - src/handlers/masterGyms.ts
```

**Step 3: Build and verify**

Run: `cd backend && sam build`
Expected: Build Succeeded

**Step 4: Commit**

```bash
git add backend/src/handlers/masterGyms.ts backend/template.yaml
git commit -m "feat(api): add master gym search endpoint"
```

---

## Task 8: Add masterGymId to AthleteItem

**Files:**
- Modify: `backend/src/db/types.ts`
- Modify: `backend/src/handlers/athletes.ts`

**Step 1: Update AthleteItem type**

Add `masterGymId` field to `AthleteItem` in `types.ts`:

```typescript
export interface AthleteItem {
  // ... existing fields
  masterGymId: string | null; // Add this field
}
```

**Step 2: Update athlete handler to accept masterGymId**

In `athletes.ts`, update create/update to handle `masterGymId`:

```typescript
// In POST handler
const athlete: AthleteItem = {
  // ... existing fields
  masterGymId: body.masterGymId || null,
};

// In PUT handler
if (body.masterGymId !== undefined) {
  updateExpressions.push('masterGymId = :masterGymId');
  expressionValues[':masterGymId'] = body.masterGymId;
}
```

**Step 3: Commit**

```bash
git add backend/src/db/types.ts backend/src/handlers/athletes.ts
git commit -m "feat(athletes): add masterGymId field to athlete entity"
```

---

## Task 9: Wire Up Admin UI to API

**Files:**
- Modify: `frontend/src/components/admin/GymMatchesPage.tsx`
- Create: `frontend/src/hooks/useAdminMatches.ts`

**Step 1: Create the API hook**

Create `frontend/src/hooks/useAdminMatches.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { GymMatch } from '@/components/admin';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

async function fetchMatches(status: string): Promise<GymMatch[]> {
  const res = await fetch(`${API_URL}/admin/pending-matches?status=${status}`);
  if (!res.ok) throw new Error('Failed to fetch matches');
  const data = await res.json();
  return data.matches;
}

async function approveMatch(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/admin/pending-matches/${id}/approve`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to approve match');
}

async function rejectMatch(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/admin/pending-matches/${id}/reject`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to reject match');
}

export function useAdminMatches(status: 'pending' | 'approved' | 'rejected') {
  return useQuery({
    queryKey: ['admin-matches', status],
    queryFn: () => fetchMatches(status),
  });
}

export function useApproveMatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: approveMatch,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-matches'] });
    },
  });
}

export function useRejectMatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: rejectMatch,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-matches'] });
    },
  });
}
```

**Step 2: Update GymMatchesPage to use hooks**

Update `frontend/src/components/admin/GymMatchesPage.tsx`:

```typescript
import { useAdminMatches, useApproveMatch, useRejectMatch } from '@/hooks/useAdminMatches';

export function GymMatchesPage() {
  const [activeTab, setActiveTab] = useState<TabType>('pending');
  const [searchQuery, setSearchQuery] = useState('');

  const { data: matches = [], isLoading, refetch } = useAdminMatches(activeTab);
  const approveMutation = useApproveMatch();
  const rejectMutation = useRejectMatch();

  const handleApprove = async (id: string) => {
    await approveMutation.mutateAsync(id);
  };

  const handleReject = async (id: string) => {
    await rejectMutation.mutateAsync(id);
  };

  // ... rest of component using real data
}
```

**Step 3: Verify build**

Run: `cd frontend && npm run build`
Expected: Build successful

**Step 4: Commit**

```bash
git add frontend/src/hooks/useAdminMatches.ts frontend/src/components/admin/GymMatchesPage.tsx
git commit -m "feat(frontend): wire admin UI to API endpoints"
```

---

## Task 10: Final Integration Test

**Step 1: Run all backend tests**

Run: `cd backend && npm test`
Expected: All tests pass

**Step 2: Run frontend build**

Run: `cd frontend && npm run build`
Expected: Build successful

**Step 3: Manual smoke test**

1. Start local DynamoDB: `cd backend && docker compose up -d`
2. Start backend: `cd backend && npm run dev`
3. Start frontend: `cd frontend && npm run dev`
4. Navigate to `http://localhost:3000/admin/gym-matches`
5. Verify tabs display, cards render, approve/reject work

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete gym unification feature"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Add types | `backend/src/db/types.ts` |
| 2 | Master gym queries | `backend/src/db/masterGymQueries.ts` |
| 3 | Pending match queries | `backend/src/db/pendingMatchQueries.ts` |
| 4 | Fuzzy matching service | `backend/src/services/gymMatchingService.ts` |
| 5 | Sync integration | `backend/src/services/gymSyncService.ts` |
| 6 | Admin API | `backend/src/handlers/adminMatches.ts` |
| 7 | Gym search API | `backend/src/handlers/masterGyms.ts` |
| 8 | Athlete masterGymId | `backend/src/db/types.ts`, `handlers/athletes.ts` |
| 9 | Frontend API hooks | `frontend/src/hooks/useAdminMatches.ts` |
| 10 | Integration test | Manual verification |
