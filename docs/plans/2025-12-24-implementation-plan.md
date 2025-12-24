# BJJ Tournament Tracker V2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a serverless BJJ tournament tracker with Next.js frontend, Lambda backend, DynamoDB storage, and Cognito auth.

**Architecture:** Next.js (SSR for SEO) → API Gateway → Lambda handlers → DynamoDB single-table. Cognito handles auth. EventBridge triggers daily tournament sync from IBJJF/JJWL APIs.

**Tech Stack:** TypeScript, Next.js 14, AWS Lambda, DynamoDB, Cognito, API Gateway, EventBridge, TanStack Query, Zustand, shadcn/ui, Tailwind CSS

---

## Phase 1: Project Setup & Infrastructure

### Task 1.1: Initialize Backend Project

**Files:**
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/.eslintrc.json`
- Create: `backend/jest.config.js`

**Step 1: Create backend directory and package.json**

```bash
cd /home/jeremyodell/dev/projects/bjj-tournament-tracker/.worktrees/v2-implementation
mkdir -p backend/src
```

```json
// backend/package.json
{
  "name": "bjj-tournament-tracker-backend",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "build": "tsc",
    "lint": "eslint src --ext .ts"
  },
  "dependencies": {
    "@aws-sdk/client-dynamodb": "^3.700.0",
    "@aws-sdk/lib-dynamodb": "^3.700.0",
    "@aws-sdk/client-cognito-identity-provider": "^3.700.0",
    "zod": "^3.24.0",
    "ulid": "^2.3.0",
    "axios": "^1.7.0"
  },
  "devDependencies": {
    "@types/aws-lambda": "^8.10.145",
    "@types/jest": "^29.5.0",
    "@types/node": "^22.0.0",
    "jest": "^29.7.0",
    "ts-jest": "^29.2.0",
    "typescript": "^5.7.0",
    "eslint": "^9.0.0",
    "@typescript-eslint/eslint-plugin": "^8.0.0",
    "@typescript-eslint/parser": "^8.0.0"
  }
}
```

**Step 2: Create tsconfig.json**

```json
// backend/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

**Step 3: Create jest.config.js**

```javascript
// backend/jest.config.js
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
      },
    ],
  },
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts'],
};
```

**Step 4: Install dependencies**

Run: `cd backend && npm install`
Expected: Dependencies installed, package-lock.json created

**Step 5: Commit**

```bash
git add backend/
git commit -m "feat: initialize backend project with TypeScript and Jest"
```

---

### Task 1.2: Create DynamoDB Client and Types

**Files:**
- Create: `backend/src/db/client.ts`
- Create: `backend/src/db/types.ts`
- Create: `backend/src/__tests__/db/types.test.ts`

**Step 1: Write types test**

```typescript
// backend/src/__tests__/db/types.test.ts
import { describe, it, expect } from '@jest/globals';
import {
  TournamentItem,
  UserProfileItem,
  AthleteItem,
  WishlistItem,
  buildTournamentPK,
  buildUserPK,
  buildAthleteSK,
  buildWishlistSK,
} from '../../db/types.js';

describe('DynamoDB key builders', () => {
  it('builds tournament PK correctly', () => {
    const pk = buildTournamentPK('IBJJF', 'ext123');
    expect(pk).toBe('TOURN#IBJJF#ext123');
  });

  it('builds user PK correctly', () => {
    const pk = buildUserPK('cognito-sub-123');
    expect(pk).toBe('USER#cognito-sub-123');
  });

  it('builds athlete SK correctly', () => {
    const sk = buildAthleteSK('01HQXYZ');
    expect(sk).toBe('ATHLETE#01HQXYZ');
  });

  it('builds wishlist SK correctly', () => {
    const sk = buildWishlistSK('TOURN#IBJJF#ext123');
    expect(sk).toBe('WISH#TOURN#IBJJF#ext123');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd backend && npm test`
Expected: FAIL with "Cannot find module '../../db/types.js'"

**Step 3: Write types implementation**

```typescript
// backend/src/db/types.ts

// Key builders
export const buildTournamentPK = (org: string, externalId: string): string =>
  `TOURN#${org}#${externalId}`;

export const buildUserPK = (cognitoSub: string): string =>
  `USER#${cognitoSub}`;

export const buildAthleteSK = (athleteId: string): string =>
  `ATHLETE#${athleteId}`;

export const buildWishlistSK = (tournamentPK: string): string =>
  `WISH#${tournamentPK}`;

// Entity types
export interface TournamentItem {
  PK: string; // TOURN#<org>#<externalId>
  SK: 'META';
  GSI1PK: 'TOURNAMENTS';
  GSI1SK: string; // <startDate>#<org>#<externalId>
  org: 'IBJJF' | 'JJWL';
  externalId: string;
  name: string;
  city: string;
  venue: string | null;
  country: string | null;
  startDate: string; // ISO date
  endDate: string; // ISO date
  gi: boolean;
  nogi: boolean;
  kids: boolean;
  registrationUrl: string | null;
  bannerUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfileItem {
  PK: string; // USER#<cognitoSub>
  SK: 'PROFILE';
  email: string;
  name: string | null;
  homeCity: string | null;
  homeState: string | null;
  nearestAirport: string | null;
  gymName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AthleteItem {
  PK: string; // USER#<cognitoSub>
  SK: string; // ATHLETE#<ulid>
  athleteId: string;
  name: string;
  beltRank: string | null;
  birthYear: number | null;
  weightClass: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WishlistItem {
  PK: string; // USER#<cognitoSub>
  SK: string; // WISH#<tournamentPK>
  tournamentPK: string;
  status: 'interested' | 'registered' | 'attending';
  athleteIds: string[];
  createdAt: string;
  updatedAt: string;
}

export type DynamoDBItem =
  | TournamentItem
  | UserProfileItem
  | AthleteItem
  | WishlistItem;
```

**Step 4: Run test to verify it passes**

Run: `cd backend && npm test`
Expected: PASS

**Step 5: Create DynamoDB client**

```typescript
// backend/src/db/client.ts
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
});

export const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
  },
});

export const TABLE_NAME = process.env.DYNAMODB_TABLE || 'bjj-tournament-tracker';
export const GSI1_NAME = 'GSI1';
```

**Step 6: Commit**

```bash
git add backend/src/
git commit -m "feat: add DynamoDB types and client"
```

---

### Task 1.3: Create Shared Error Types

**Files:**
- Create: `backend/src/shared/errors.ts`
- Create: `backend/src/__tests__/shared/errors.test.ts`

**Step 1: Write errors test**

```typescript
// backend/src/__tests__/shared/errors.test.ts
import { describe, it, expect } from '@jest/globals';
import {
  AppError,
  NotFoundError,
  ValidationError,
  UnauthorizedError,
} from '../../shared/errors.js';

describe('Custom errors', () => {
  it('AppError has correct properties', () => {
    const error = new AppError('test message', 400, 'TEST_ERROR');
    expect(error.message).toBe('test message');
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('TEST_ERROR');
    expect(error instanceof Error).toBe(true);
  });

  it('NotFoundError has 404 status', () => {
    const error = new NotFoundError('Tournament');
    expect(error.message).toBe('Tournament not found');
    expect(error.statusCode).toBe(404);
    expect(error.code).toBe('NOT_FOUND');
  });

  it('ValidationError has 400 status', () => {
    const error = new ValidationError('Invalid email');
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('VALIDATION_ERROR');
  });

  it('UnauthorizedError has 401 status', () => {
    const error = new UnauthorizedError();
    expect(error.statusCode).toBe(401);
    expect(error.code).toBe('UNAUTHORIZED');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd backend && npm test`
Expected: FAIL

**Step 3: Write errors implementation**

```typescript
// backend/src/shared/errors.ts
export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number,
    public code: string
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends AppError {
  constructor(details: string) {
    super(details, 400, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class UnauthorizedError extends AppError {
  constructor() {
    super('Authentication required', 401, 'UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}
```

**Step 4: Run test to verify it passes**

Run: `cd backend && npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/src/
git commit -m "feat: add custom error types"
```

---

## Phase 2: Tournament Fetchers

### Task 2.1: Create IBJJF Fetcher

**Files:**
- Create: `backend/src/fetchers/ibjjfFetcher.ts`
- Create: `backend/src/fetchers/types.ts`
- Create: `backend/src/__tests__/fetchers/ibjjfFetcher.test.ts`

**Step 1: Create fetcher types**

```typescript
// backend/src/fetchers/types.ts
export interface IBJJFEvent {
  id: number;
  name: string;
  region: string;
  city: string;
  local: string | null; // venue
  startDay: number;
  endDay: number;
  month: string;
  year: number;
  eventGroups: string[];
  pageUrl: string;
}

export interface JJWLEvent {
  id: number;
  name: string;
  city: string;
  place: string | null; // venue
  datebeg: string;
  dateend: string;
  GI: string; // "0" or "1"
  NOGI: string; // "0" or "1"
  picture: string | null;
  urlfriendly: string;
}

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
}
```

**Step 2: Write IBJJF mapper test**

```typescript
// backend/src/__tests__/fetchers/ibjjfFetcher.test.ts
import { describe, it, expect } from '@jest/globals';
import { mapIBJJFToTournament, parseIBJJFDate } from '../../fetchers/ibjjfFetcher.js';
import type { IBJJFEvent } from '../../fetchers/types.js';

describe('parseIBJJFDate', () => {
  it('parses Jan correctly', () => {
    expect(parseIBJJFDate(15, 'Jan', 2025)).toBe('2025-01-15');
  });

  it('parses Dec correctly', () => {
    expect(parseIBJJFDate(1, 'Dec', 2025)).toBe('2025-12-01');
  });

  it('pads single digit days', () => {
    expect(parseIBJJFDate(5, 'Mar', 2025)).toBe('2025-03-05');
  });
});

describe('mapIBJJFToTournament', () => {
  const baseEvent: IBJJFEvent = {
    id: 123,
    name: 'Pan American',
    region: 'USA',
    city: 'Irvine',
    local: 'Pyramid',
    startDay: 15,
    endDay: 17,
    month: 'Mar',
    year: 2025,
    eventGroups: ['GI', 'NOGI'],
    pageUrl: '/events/pan-2025',
  };

  it('maps basic fields correctly', () => {
    const result = mapIBJJFToTournament(baseEvent);
    expect(result.org).toBe('IBJJF');
    expect(result.externalId).toBe('123');
    expect(result.name).toBe('Pan American');
    expect(result.city).toBe('Irvine');
    expect(result.venue).toBe('Pyramid');
  });

  it('parses dates correctly', () => {
    const result = mapIBJJFToTournament(baseEvent);
    expect(result.startDate).toBe('2025-03-15');
    expect(result.endDate).toBe('2025-03-17');
  });

  it('maps GI/NOGI flags from eventGroups', () => {
    const result = mapIBJJFToTournament(baseEvent);
    expect(result.gi).toBe(true);
    expect(result.nogi).toBe(true);
  });

  it('detects kids from eventGroups', () => {
    const kidsEvent = { ...baseEvent, eventGroups: ['KIDS'] };
    const result = mapIBJJFToTournament(kidsEvent);
    expect(result.kids).toBe(true);
  });

  it('builds registration URL', () => {
    const result = mapIBJJFToTournament(baseEvent);
    expect(result.registrationUrl).toBe('https://ibjjf.com/events/pan-2025');
  });
});
```

**Step 3: Run test to verify it fails**

Run: `cd backend && npm test`
Expected: FAIL

**Step 4: Write IBJJF fetcher implementation**

```typescript
// backend/src/fetchers/ibjjfFetcher.ts
import axios from 'axios';
import type { IBJJFEvent, NormalizedTournament } from './types.js';

const IBJJF_API_URL = 'https://ibjjf.com/api/v1/events/calendar.json';

const MONTH_MAP: Record<string, string> = {
  Jan: '01', Feb: '02', Mar: '03', Apr: '04',
  May: '05', Jun: '06', Jul: '07', Aug: '08',
  Sep: '09', Oct: '10', Nov: '11', Dec: '12',
};

export function parseIBJJFDate(day: number, month: string, year: number): string {
  const monthNum = MONTH_MAP[month] || '01';
  const dayStr = day.toString().padStart(2, '0');
  return `${year}-${monthNum}-${dayStr}`;
}

export function mapIBJJFToTournament(event: IBJJFEvent): NormalizedTournament {
  const groups = event.eventGroups.map((g) => g.toUpperCase());

  return {
    org: 'IBJJF',
    externalId: String(event.id),
    name: event.name,
    city: event.city,
    venue: event.local || null,
    country: event.region || null,
    startDate: parseIBJJFDate(event.startDay, event.month, event.year),
    endDate: parseIBJJFDate(event.endDay, event.month, event.year),
    gi: groups.includes('GI'),
    nogi: groups.includes('NOGI') || groups.includes('NO-GI'),
    kids: groups.includes('KIDS'),
    registrationUrl: event.pageUrl
      ? `https://ibjjf.com${event.pageUrl}`
      : null,
    bannerUrl: null,
  };
}

export async function fetchIBJJFTournaments(): Promise<NormalizedTournament[]> {
  const response = await axios.get<IBJJFEvent[]>(IBJJF_API_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; BJJTracker/1.0)',
    },
    timeout: 10000,
  });

  return response.data.map(mapIBJJFToTournament);
}
```

**Step 5: Run test to verify it passes**

Run: `cd backend && npm test`
Expected: PASS

**Step 6: Commit**

```bash
git add backend/src/
git commit -m "feat: add IBJJF fetcher with mapper"
```

---

### Task 2.2: Create JJWL Fetcher

**Files:**
- Create: `backend/src/fetchers/jjwlFetcher.ts`
- Create: `backend/src/__tests__/fetchers/jjwlFetcher.test.ts`

**Step 1: Write JJWL mapper test**

```typescript
// backend/src/__tests__/fetchers/jjwlFetcher.test.ts
import { describe, it, expect } from '@jest/globals';
import { mapJJWLToTournament } from '../../fetchers/jjwlFetcher.js';
import type { JJWLEvent } from '../../fetchers/types.js';

describe('mapJJWLToTournament', () => {
  const baseEvent: JJWLEvent = {
    id: 456,
    name: 'World League Open',
    city: 'Las Vegas',
    place: 'Convention Center',
    datebeg: '2025-04-10',
    dateend: '2025-04-12',
    GI: '1',
    NOGI: '1',
    picture: 'https://jjwl.com/img/event.jpg',
    urlfriendly: 'world-league-open-2025',
  };

  it('maps basic fields correctly', () => {
    const result = mapJJWLToTournament(baseEvent);
    expect(result.org).toBe('JJWL');
    expect(result.externalId).toBe('456');
    expect(result.name).toBe('World League Open');
    expect(result.city).toBe('Las Vegas');
    expect(result.venue).toBe('Convention Center');
  });

  it('parses dates correctly', () => {
    const result = mapJJWLToTournament(baseEvent);
    expect(result.startDate).toBe('2025-04-10');
    expect(result.endDate).toBe('2025-04-12');
  });

  it('maps GI flag from string "1"', () => {
    const result = mapJJWLToTournament(baseEvent);
    expect(result.gi).toBe(true);
  });

  it('maps NOGI flag from string "0"', () => {
    const noGiEvent = { ...baseEvent, NOGI: '0' };
    const result = mapJJWLToTournament(noGiEvent);
    expect(result.nogi).toBe(false);
  });

  it('builds registration URL', () => {
    const result = mapJJWLToTournament(baseEvent);
    expect(result.registrationUrl).toBe(
      'https://www.jjworldleague.com/events/world-league-open-2025'
    );
  });

  it('maps banner URL', () => {
    const result = mapJJWLToTournament(baseEvent);
    expect(result.bannerUrl).toBe('https://jjwl.com/img/event.jpg');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd backend && npm test`
Expected: FAIL

**Step 3: Write JJWL fetcher implementation**

```typescript
// backend/src/fetchers/jjwlFetcher.ts
import axios from 'axios';
import type { JJWLEvent, NormalizedTournament } from './types.js';

const JJWL_API_URL = 'https://www.jjworldleague.com/ajax/new_load_events.php';

export function mapJJWLToTournament(event: JJWLEvent): NormalizedTournament {
  return {
    org: 'JJWL',
    externalId: String(event.id),
    name: event.name,
    city: event.city,
    venue: event.place || null,
    country: null,
    startDate: event.datebeg,
    endDate: event.dateend,
    gi: event.GI === '1',
    nogi: event.NOGI === '1',
    kids: false, // JJWL doesn't have kids flag
    registrationUrl: event.urlfriendly
      ? `https://www.jjworldleague.com/events/${event.urlfriendly}`
      : null,
    bannerUrl: event.picture || null,
  };
}

export async function fetchJJWLTournaments(): Promise<NormalizedTournament[]> {
  const response = await axios.post<JJWLEvent[]>(
    JJWL_API_URL,
    {},
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (compatible; BJJTracker/1.0)',
      },
      timeout: 10000,
    }
  );

  return response.data.map(mapJJWLToTournament);
}
```

**Step 4: Run test to verify it passes**

Run: `cd backend && npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/src/
git commit -m "feat: add JJWL fetcher with mapper"
```

---

### Task 2.3: Create Sync Service

**Files:**
- Create: `backend/src/services/syncService.ts`
- Create: `backend/src/__tests__/services/syncService.test.ts`

**Step 1: Write sync service test**

```typescript
// backend/src/__tests__/services/syncService.test.ts
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { syncAllTournaments } from '../../services/syncService.js';
import * as ibjjfFetcher from '../../fetchers/ibjjfFetcher.js';
import * as jjwlFetcher from '../../fetchers/jjwlFetcher.js';
import type { NormalizedTournament } from '../../fetchers/types.js';

// Mock the fetchers
jest.mock('../../fetchers/ibjjfFetcher.js');
jest.mock('../../fetchers/jjwlFetcher.js');

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

**Step 2: Run test to verify it fails**

Run: `cd backend && npm test`
Expected: FAIL

**Step 3: Write sync service implementation**

```typescript
// backend/src/services/syncService.ts
import { fetchIBJJFTournaments } from '../fetchers/ibjjfFetcher.js';
import { fetchJJWLTournaments } from '../fetchers/jjwlFetcher.js';
import { upsertTournaments } from '../db/queries.js';
import type { NormalizedTournament } from '../fetchers/types.js';

export interface SyncResult {
  ibjjf: { fetched: number; saved: number; error?: string };
  jjwl: { fetched: number; saved: number; error?: string };
}

export interface SyncOptions {
  dryRun?: boolean;
}

async function fetchSource(
  name: string,
  fetcher: () => Promise<NormalizedTournament[]>,
  options: SyncOptions
): Promise<{ fetched: number; saved: number; error?: string }> {
  try {
    const tournaments = await fetcher();
    const fetched = tournaments.length;

    if (options.dryRun) {
      return { fetched, saved: 0 };
    }

    const saved = await upsertTournaments(tournaments);
    return { fetched, saved };
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

**Step 4: Create stub for upsertTournaments**

```typescript
// backend/src/db/queries.ts
import type { NormalizedTournament } from '../fetchers/types.js';

export async function upsertTournaments(
  tournaments: NormalizedTournament[]
): Promise<number> {
  // TODO: Implement DynamoDB batch write
  return tournaments.length;
}
```

**Step 5: Run test to verify it passes**

Run: `cd backend && npm test`
Expected: PASS

**Step 6: Commit**

```bash
git add backend/src/
git commit -m "feat: add sync service with parallel fetching"
```

---

## Phase 3: Tournament API

### Task 3.1: Create Tournament Queries

**Files:**
- Modify: `backend/src/db/queries.ts`
- Create: `backend/src/__tests__/db/queries.test.ts`

**Step 1: Write tournament queries test**

```typescript
// backend/src/__tests__/db/queries.test.ts
import { describe, it, expect } from '@jest/globals';
import {
  buildTournamentFilters,
  buildGSI1Query,
} from '../../db/queries.js';

describe('buildTournamentFilters', () => {
  it('builds org filter', () => {
    const result = buildTournamentFilters({ org: 'IBJJF' });
    expect(result.FilterExpression).toContain('org = :org');
    expect(result.ExpressionAttributeValues[':org']).toBe('IBJJF');
  });

  it('builds date range filter', () => {
    const result = buildTournamentFilters({
      startAfter: '2025-01-01',
      startBefore: '2025-12-31',
    });
    expect(result.FilterExpression).toContain('startDate >= :startAfter');
    expect(result.FilterExpression).toContain('startDate <= :startBefore');
  });

  it('builds gi/nogi filters', () => {
    const result = buildTournamentFilters({ gi: true, nogi: false });
    expect(result.FilterExpression).toContain('gi = :gi');
    expect(result.ExpressionAttributeValues[':gi']).toBe(true);
  });

  it('builds city filter with contains', () => {
    const result = buildTournamentFilters({ city: 'Las Vegas' });
    expect(result.FilterExpression).toContain('contains(city, :city)');
  });
});

describe('buildGSI1Query', () => {
  it('queries GSI1 for all tournaments', () => {
    const result = buildGSI1Query({});
    expect(result.KeyConditionExpression).toBe('GSI1PK = :pk');
    expect(result.ExpressionAttributeValues[':pk']).toBe('TOURNAMENTS');
  });

  it('adds date range to key condition', () => {
    const result = buildGSI1Query({
      startAfter: '2025-01-01',
      startBefore: '2025-12-31',
    });
    expect(result.KeyConditionExpression).toContain('GSI1SK BETWEEN');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd backend && npm test`
Expected: FAIL

**Step 3: Write query builders implementation**

```typescript
// backend/src/db/queries.ts (replace existing content)
import { QueryCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME, GSI1_NAME } from './client.js';
import { buildTournamentPK } from './types.js';
import type { TournamentItem } from './types.js';
import type { NormalizedTournament } from '../fetchers/types.js';

export interface TournamentFilters {
  org?: 'IBJJF' | 'JJWL';
  startAfter?: string;
  startBefore?: string;
  city?: string;
  gi?: boolean;
  nogi?: boolean;
  kids?: boolean;
  search?: string;
}

export function buildTournamentFilters(filters: TournamentFilters): {
  FilterExpression?: string;
  ExpressionAttributeValues: Record<string, unknown>;
  ExpressionAttributeNames?: Record<string, string>;
} {
  const conditions: string[] = [];
  const values: Record<string, unknown> = {};
  const names: Record<string, string> = {};

  if (filters.org) {
    conditions.push('org = :org');
    values[':org'] = filters.org;
  }

  if (filters.startAfter) {
    conditions.push('startDate >= :startAfter');
    values[':startAfter'] = filters.startAfter;
  }

  if (filters.startBefore) {
    conditions.push('startDate <= :startBefore');
    values[':startBefore'] = filters.startBefore;
  }

  if (filters.city) {
    conditions.push('contains(city, :city)');
    values[':city'] = filters.city;
  }

  if (filters.gi !== undefined) {
    conditions.push('gi = :gi');
    values[':gi'] = filters.gi;
  }

  if (filters.nogi !== undefined) {
    conditions.push('nogi = :nogi');
    values[':nogi'] = filters.nogi;
  }

  if (filters.kids !== undefined) {
    conditions.push('kids = :kids');
    values[':kids'] = filters.kids;
  }

  if (filters.search) {
    conditions.push('contains(#name, :search)');
    values[':search'] = filters.search;
    names['#name'] = 'name';
  }

  return {
    FilterExpression: conditions.length > 0 ? conditions.join(' AND ') : undefined,
    ExpressionAttributeValues: values,
    ExpressionAttributeNames: Object.keys(names).length > 0 ? names : undefined,
  };
}

export function buildGSI1Query(filters: TournamentFilters): {
  KeyConditionExpression: string;
  ExpressionAttributeValues: Record<string, unknown>;
} {
  const values: Record<string, unknown> = { ':pk': 'TOURNAMENTS' };

  if (filters.startAfter && filters.startBefore) {
    return {
      KeyConditionExpression: 'GSI1PK = :pk AND GSI1SK BETWEEN :start AND :end',
      ExpressionAttributeValues: {
        ...values,
        ':start': filters.startAfter,
        ':end': filters.startBefore + 'Z', // Ensure end is inclusive
      },
    };
  }

  return {
    KeyConditionExpression: 'GSI1PK = :pk',
    ExpressionAttributeValues: values,
  };
}

export async function queryTournaments(
  filters: TournamentFilters,
  limit = 50,
  lastKey?: Record<string, unknown>
): Promise<{ items: TournamentItem[]; lastKey?: Record<string, unknown> }> {
  const gsi1Query = buildGSI1Query(filters);
  const filterParams = buildTournamentFilters(filters);

  const command = new QueryCommand({
    TableName: TABLE_NAME,
    IndexName: GSI1_NAME,
    ...gsi1Query,
    FilterExpression: filterParams.FilterExpression,
    ExpressionAttributeValues: {
      ...gsi1Query.ExpressionAttributeValues,
      ...filterParams.ExpressionAttributeValues,
    },
    ExpressionAttributeNames: filterParams.ExpressionAttributeNames,
    Limit: limit,
    ExclusiveStartKey: lastKey,
    ScanIndexForward: true, // Ascending by date
  });

  const result = await docClient.send(command);

  return {
    items: (result.Items || []) as TournamentItem[],
    lastKey: result.LastEvaluatedKey,
  };
}

export async function upsertTournaments(
  tournaments: NormalizedTournament[]
): Promise<number> {
  const now = new Date().toISOString();
  const batches: NormalizedTournament[][] = [];

  // Split into batches of 25 (DynamoDB limit)
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
              createdAt: now,
              updatedAt: now,
            } satisfies TournamentItem,
          },
        })),
      },
    });

    await docClient.send(command);
    saved += batch.length;
  }

  return saved;
}
```

**Step 4: Run test to verify it passes**

Run: `cd backend && npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/src/
git commit -m "feat: add tournament query builders"
```

---

### Task 3.2: Create Tournament Service

**Files:**
- Create: `backend/src/services/tournamentService.ts`
- Create: `backend/src/__tests__/services/tournamentService.test.ts`

**Step 1: Write tournament service test**

```typescript
// backend/src/__tests__/services/tournamentService.test.ts
import { describe, it, expect } from '@jest/globals';
import { validateTournamentFilters, formatTournamentResponse } from '../../services/tournamentService.js';
import type { TournamentItem } from '../../db/types.js';

describe('validateTournamentFilters', () => {
  it('accepts valid filters', () => {
    const result = validateTournamentFilters({
      org: 'IBJJF',
      startAfter: '2025-01-01',
      gi: 'true',
    });
    expect(result.org).toBe('IBJJF');
    expect(result.startAfter).toBe('2025-01-01');
    expect(result.gi).toBe(true);
  });

  it('rejects invalid org', () => {
    expect(() =>
      validateTournamentFilters({ org: 'INVALID' })
    ).toThrow();
  });

  it('parses boolean strings', () => {
    const result = validateTournamentFilters({ gi: 'true', nogi: 'false' });
    expect(result.gi).toBe(true);
    expect(result.nogi).toBe(false);
  });

  it('ignores empty values', () => {
    const result = validateTournamentFilters({ org: '', city: undefined });
    expect(result.org).toBeUndefined();
    expect(result.city).toBeUndefined();
  });
});

describe('formatTournamentResponse', () => {
  const item: TournamentItem = {
    PK: 'TOURN#IBJJF#123',
    SK: 'META',
    GSI1PK: 'TOURNAMENTS',
    GSI1SK: '2025-03-15#IBJJF#123',
    org: 'IBJJF',
    externalId: '123',
    name: 'Pan American',
    city: 'Irvine',
    venue: 'Pyramid',
    country: 'USA',
    startDate: '2025-03-15',
    endDate: '2025-03-17',
    gi: true,
    nogi: true,
    kids: false,
    registrationUrl: 'https://ibjjf.com/pan',
    bannerUrl: null,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  };

  it('formats tournament for API response', () => {
    const result = formatTournamentResponse(item);
    expect(result.id).toBe('TOURN#IBJJF#123');
    expect(result.name).toBe('Pan American');
    expect(result).not.toHaveProperty('PK');
    expect(result).not.toHaveProperty('SK');
    expect(result).not.toHaveProperty('GSI1PK');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd backend && npm test`
Expected: FAIL

**Step 3: Write tournament service implementation**

```typescript
// backend/src/services/tournamentService.ts
import { z } from 'zod';
import { queryTournaments } from '../db/queries.js';
import { NotFoundError } from '../shared/errors.js';
import type { TournamentItem } from '../db/types.js';
import type { TournamentFilters } from '../db/queries.js';

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
});

export function validateTournamentFilters(
  params: Record<string, string | undefined>
): TournamentFilters & { limit: number } {
  // Remove empty strings
  const cleaned = Object.fromEntries(
    Object.entries(params).filter(([_, v]) => v !== '' && v !== undefined)
  );
  return filtersSchema.parse(cleaned);
}

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
}

export function formatTournamentResponse(item: TournamentItem): TournamentResponse {
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
  };
}

export async function listTournaments(
  params: Record<string, string | undefined>,
  lastKey?: string
): Promise<{
  tournaments: TournamentResponse[];
  nextCursor?: string;
}> {
  const filters = validateTournamentFilters(params);
  const parsedLastKey = lastKey ? JSON.parse(Buffer.from(lastKey, 'base64').toString()) : undefined;

  const { items, lastKey: newLastKey } = await queryTournaments(
    filters,
    filters.limit,
    parsedLastKey
  );

  return {
    tournaments: items.map(formatTournamentResponse),
    nextCursor: newLastKey
      ? Buffer.from(JSON.stringify(newLastKey)).toString('base64')
      : undefined,
  };
}

export async function getTournament(id: string): Promise<TournamentResponse> {
  // Query by PK
  const { items } = await queryTournaments({}, 1);
  const item = items.find((t) => t.PK === id);

  if (!item) {
    throw new NotFoundError('Tournament');
  }

  return formatTournamentResponse(item);
}
```

**Step 4: Run test to verify it passes**

Run: `cd backend && npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/src/
git commit -m "feat: add tournament service with validation"
```

---

### Task 3.3: Create Tournament Lambda Handler

**Files:**
- Create: `backend/src/handlers/tournaments.ts`
- Create: `backend/src/handlers/middleware/errorHandler.ts`
- Create: `backend/src/__tests__/handlers/tournaments.test.ts`

**Step 1: Write error handler**

```typescript
// backend/src/handlers/middleware/errorHandler.ts
import type { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';
import { ZodError } from 'zod';
import { AppError } from '../../shared/errors.js';

type Handler = APIGatewayProxyHandler;

export function withErrorHandler(handler: Handler): Handler {
  return async (event, context) => {
    try {
      return await handler(event, context);
    } catch (error) {
      console.error('Handler error:', error);

      if (error instanceof AppError) {
        return {
          statusCode: error.statusCode,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            error: error.code,
            message: error.message,
          }),
        };
      }

      if (error instanceof ZodError) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            error: 'VALIDATION_ERROR',
            message: error.errors[0]?.message || 'Invalid input',
            details: error.errors,
          }),
        };
      }

      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'INTERNAL_ERROR',
          message: 'Something went wrong',
        }),
      };
    }
  };
}

export function jsonResponse(
  statusCode: number,
  body: unknown
): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(body),
  };
}
```

**Step 2: Write tournaments handler test**

```typescript
// backend/src/__tests__/handlers/tournaments.test.ts
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { handler } from '../../handlers/tournaments.js';

// Mock the service
jest.mock('../../services/tournamentService.js', () => ({
  listTournaments: jest.fn().mockResolvedValue({
    tournaments: [
      { id: 'TOURN#IBJJF#123', name: 'Pan American', org: 'IBJJF' },
    ],
    nextCursor: undefined,
  }),
  getTournament: jest.fn().mockResolvedValue({
    id: 'TOURN#IBJJF#123',
    name: 'Pan American',
    org: 'IBJJF',
  }),
}));

const mockContext: Context = {} as Context;

function createEvent(overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent {
  return {
    httpMethod: 'GET',
    path: '/tournaments',
    pathParameters: null,
    queryStringParameters: null,
    body: null,
    headers: {},
    multiValueHeaders: {},
    isBase64Encoded: false,
    requestContext: {} as any,
    resource: '',
    stageVariables: null,
    multiValueQueryStringParameters: null,
    ...overrides,
  };
}

describe('tournaments handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GET /tournaments returns list', async () => {
    const event = createEvent({
      httpMethod: 'GET',
      path: '/tournaments',
    });

    const result = await handler(event, mockContext, () => {});

    expect(result).toBeDefined();
    expect(result!.statusCode).toBe(200);
    const body = JSON.parse(result!.body);
    expect(body.tournaments).toHaveLength(1);
  });

  it('GET /tournaments with filters passes params', async () => {
    const event = createEvent({
      queryStringParameters: { org: 'IBJJF', gi: 'true' },
    });

    const result = await handler(event, mockContext, () => {});

    expect(result!.statusCode).toBe(200);
  });

  it('GET /tournaments/:id returns single tournament', async () => {
    const event = createEvent({
      pathParameters: { id: 'TOURN#IBJJF#123' },
    });

    const result = await handler(event, mockContext, () => {});

    expect(result!.statusCode).toBe(200);
    const body = JSON.parse(result!.body);
    expect(body.id).toBe('TOURN#IBJJF#123');
  });
});
```

**Step 3: Run test to verify it fails**

Run: `cd backend && npm test`
Expected: FAIL

**Step 4: Write tournaments handler**

```typescript
// backend/src/handlers/tournaments.ts
import type { APIGatewayProxyHandler } from 'aws-lambda';
import { withErrorHandler, jsonResponse } from './middleware/errorHandler.js';
import { listTournaments, getTournament } from '../services/tournamentService.js';

const tournamentsHandler: APIGatewayProxyHandler = async (event) => {
  const id = event.pathParameters?.id;

  // GET /tournaments/:id
  if (id) {
    const tournament = await getTournament(id);
    return jsonResponse(200, tournament);
  }

  // GET /tournaments
  const params = event.queryStringParameters || {};
  const cursor = params.cursor;
  delete params.cursor;

  const result = await listTournaments(params, cursor);
  return jsonResponse(200, result);
};

export const handler = withErrorHandler(tournamentsHandler);
```

**Step 5: Run test to verify it passes**

Run: `cd backend && npm test`
Expected: PASS

**Step 6: Commit**

```bash
git add backend/src/
git commit -m "feat: add tournaments Lambda handler"
```

---

## Phase 4: Frontend Setup

### Task 4.1: Initialize Next.js Project

**Files:**
- Create: `frontend/` (Next.js project)

**Step 1: Create Next.js app**

```bash
cd /home/jeremyodell/dev/projects/bjj-tournament-tracker/.worktrees/v2-implementation
npx create-next-app@latest frontend --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

**Step 2: Install additional dependencies**

```bash
cd frontend
npm install @tanstack/react-query zustand axios
npm install -D @testing-library/react @testing-library/jest-dom vitest @vitejs/plugin-react jsdom
```

**Step 3: Add shadcn/ui**

```bash
npx shadcn@latest init -y
npx shadcn@latest add button card input select skeleton badge
```

**Step 4: Commit**

```bash
cd ..
git add frontend/
git commit -m "feat: initialize Next.js frontend with shadcn/ui"
```

---

### Task 4.2: Create API Client

**Files:**
- Create: `frontend/src/lib/api.ts`
- Create: `frontend/src/lib/types.ts`

**Step 1: Create types**

```typescript
// frontend/src/lib/types.ts
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
}

export interface TournamentFilters {
  org?: 'IBJJF' | 'JJWL';
  startAfter?: string;
  startBefore?: string;
  city?: string;
  gi?: boolean;
  nogi?: boolean;
  kids?: boolean;
  search?: string;
}

export interface PaginatedResponse<T> {
  tournaments: T[];
  nextCursor?: string;
}
```

**Step 2: Create API client**

```typescript
// frontend/src/lib/api.ts
import axios from 'axios';
import type { Tournament, TournamentFilters, PaginatedResponse } from './types';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

export async function fetchTournaments(
  filters: TournamentFilters = {},
  cursor?: string
): Promise<PaginatedResponse<Tournament>> {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      params.set(key, String(value));
    }
  });

  if (cursor) {
    params.set('cursor', cursor);
  }

  const response = await api.get<PaginatedResponse<Tournament>>(
    `/tournaments?${params.toString()}`
  );
  return response.data;
}

export async function fetchTournament(id: string): Promise<Tournament> {
  const response = await api.get<Tournament>(`/tournaments/${encodeURIComponent(id)}`);
  return response.data;
}

export default api;
```

**Step 3: Commit**

```bash
git add frontend/src/lib/
git commit -m "feat: add API client and types"
```

---

### Task 4.3: Create Tournament Hooks

**Files:**
- Create: `frontend/src/hooks/useTournaments.ts`

**Step 1: Create hooks**

```typescript
// frontend/src/hooks/useTournaments.ts
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { fetchTournaments, fetchTournament } from '@/lib/api';
import type { TournamentFilters } from '@/lib/types';

export function useTournaments(filters: TournamentFilters = {}) {
  return useInfiniteQuery({
    queryKey: ['tournaments', filters],
    queryFn: ({ pageParam }) => fetchTournaments(filters, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
  });
}

export function useTournament(id: string) {
  return useQuery({
    queryKey: ['tournament', id],
    queryFn: () => fetchTournament(id),
    staleTime: 5 * 60 * 1000,
    retry: 2,
    enabled: !!id,
  });
}
```

**Step 2: Commit**

```bash
git add frontend/src/hooks/
git commit -m "feat: add tournament hooks with TanStack Query"
```

---

### Task 4.4: Create Tournament Components

**Files:**
- Create: `frontend/src/components/tournaments/TournamentCard.tsx`
- Create: `frontend/src/components/tournaments/TournamentList.tsx`
- Create: `frontend/src/components/tournaments/TournamentFilters.tsx`

**Step 1: Create TournamentCard**

```typescript
// frontend/src/components/tournaments/TournamentCard.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Tournament } from '@/lib/types';

interface TournamentCardProps {
  tournament: Tournament;
}

export function TournamentCard({ tournament }: TournamentCardProps) {
  const formatDateRange = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };

    if (start === end) {
      return startDate.toLocaleDateString('en-US', { ...options, year: 'numeric' });
    }

    return `${startDate.toLocaleDateString('en-US', options)} - ${endDate.toLocaleDateString('en-US', { ...options, year: 'numeric' })}`;
  };

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg">{tournament.name}</CardTitle>
          <Badge variant={tournament.org === 'IBJJF' ? 'default' : 'secondary'}>
            {tournament.org}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>{tournament.city}{tournament.country ? `, ${tournament.country}` : ''}</p>
          <p>{formatDateRange(tournament.startDate, tournament.endDate)}</p>
          <div className="flex gap-2 pt-2">
            {tournament.gi && <Badge variant="outline">GI</Badge>}
            {tournament.nogi && <Badge variant="outline">NOGI</Badge>}
            {tournament.kids && <Badge variant="outline">KIDS</Badge>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

**Step 2: Create TournamentList**

```typescript
// frontend/src/components/tournaments/TournamentList.tsx
'use client';

import { useTournaments } from '@/hooks/useTournaments';
import { TournamentCard } from './TournamentCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import type { TournamentFilters } from '@/lib/types';

interface TournamentListProps {
  filters?: TournamentFilters;
}

export function TournamentList({ filters = {} }: TournamentListProps) {
  const {
    data,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useTournaments(filters);

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-48" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center py-8 text-destructive">
        Error loading tournaments: {error.message}
      </div>
    );
  }

  const tournaments = data?.pages.flatMap((page) => page.tournaments) ?? [];

  if (tournaments.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No tournaments found matching your criteria.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {tournaments.map((tournament) => (
          <TournamentCard key={tournament.id} tournament={tournament} />
        ))}
      </div>

      {hasNextPage && (
        <div className="text-center">
          <Button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            variant="outline"
          >
            {isFetchingNextPage ? 'Loading...' : 'Load More'}
          </Button>
        </div>
      )}
    </div>
  );
}
```

**Step 3: Create TournamentFilters**

```typescript
// frontend/src/components/tournaments/TournamentFilters.tsx
'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { TournamentFilters as Filters } from '@/lib/types';

interface TournamentFiltersProps {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
}

export function TournamentFilters({ filters, onFiltersChange }: TournamentFiltersProps) {
  const [search, setSearch] = useState(filters.search || '');

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onFiltersChange({ ...filters, search: search || undefined });
  };

  const handleOrgChange = (value: string) => {
    onFiltersChange({
      ...filters,
      org: value === 'all' ? undefined : (value as 'IBJJF' | 'JJWL'),
    });
  };

  const handleFormatChange = (format: 'gi' | 'nogi' | 'kids') => {
    onFiltersChange({
      ...filters,
      [format]: filters[format] ? undefined : true,
    });
  };

  const handleClear = () => {
    setSearch('');
    onFiltersChange({});
  };

  return (
    <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
      <form onSubmit={handleSearchSubmit} className="flex gap-2">
        <Input
          placeholder="Search tournaments..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1"
        />
        <Button type="submit">Search</Button>
      </form>

      <div className="flex flex-wrap gap-4">
        <Select value={filters.org || 'all'} onValueChange={handleOrgChange}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Organization" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Orgs</SelectItem>
            <SelectItem value="IBJJF">IBJJF</SelectItem>
            <SelectItem value="JJWL">JJWL</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex gap-2">
          <Button
            variant={filters.gi ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleFormatChange('gi')}
          >
            GI
          </Button>
          <Button
            variant={filters.nogi ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleFormatChange('nogi')}
          >
            NOGI
          </Button>
          <Button
            variant={filters.kids ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleFormatChange('kids')}
          >
            Kids
          </Button>
        </div>

        <Button variant="ghost" size="sm" onClick={handleClear}>
          Clear Filters
        </Button>
      </div>
    </div>
  );
}
```

**Step 4: Commit**

```bash
git add frontend/src/components/
git commit -m "feat: add tournament components"
```

---

### Task 4.5: Create Tournaments Page

**Files:**
- Modify: `frontend/src/app/tournaments/page.tsx`
- Create: `frontend/src/app/providers.tsx`
- Modify: `frontend/src/app/layout.tsx`

**Step 1: Create providers**

```typescript
// frontend/src/app/providers.tsx
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000,
            retry: 2,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
```

**Step 2: Update layout**

```typescript
// frontend/src/app/layout.tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'BJJ Tournament Tracker',
  description: 'Find and track BJJ tournaments from IBJJF, JJWL, and more',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

**Step 3: Create tournaments page**

```typescript
// frontend/src/app/tournaments/page.tsx
'use client';

import { useState } from 'react';
import { TournamentList } from '@/components/tournaments/TournamentList';
import { TournamentFilters } from '@/components/tournaments/TournamentFilters';
import type { TournamentFilters as Filters } from '@/lib/types';

export default function TournamentsPage() {
  const [filters, setFilters] = useState<Filters>({});

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-8">BJJ Tournaments</h1>

      <div className="space-y-6">
        <TournamentFilters filters={filters} onFiltersChange={setFilters} />
        <TournamentList filters={filters} />
      </div>
    </div>
  );
}
```

**Step 4: Update home page to redirect**

```typescript
// frontend/src/app/page.tsx
import { redirect } from 'next/navigation';

export default function Home() {
  redirect('/tournaments');
}
```

**Step 5: Commit**

```bash
git add frontend/src/app/
git commit -m "feat: add tournaments page with filters"
```

---

## Phase 5: Remaining Backend (Auth, Profile, Wishlist)

### Task 5.1 - 5.6: Implement remaining backend services

Follow the same TDD pattern for:
- Auth service (Cognito integration)
- Profile service (CRUD)
- Athletes service (CRUD)
- Wishlist service (CRUD with athlete assignment)
- Sync Lambda handler (EventBridge trigger)

Each task follows the pattern:
1. Write failing test
2. Run test to verify it fails
3. Write implementation
4. Run test to verify it passes
5. Commit

---

## Phase 6: Remaining Frontend (Auth, Wishlist, Profile)

### Task 6.1 - 6.6: Implement remaining frontend pages

Follow the same pattern for:
- Auth store (Zustand + Amplify)
- Login/Register pages
- Protected route layout
- Wishlist page + components
- Profile page + athlete management

---

## Phase 7: Infrastructure (IaC)

### Task 7.1 - 7.4: AWS CDK or SAM setup

- DynamoDB table with GSI
- Lambda functions
- API Gateway with Cognito authorizer
- EventBridge scheduled rule
- Amplify Hosting for frontend

---

## Checkpoint Summary

| Phase | Tasks | Estimated Commits |
|-------|-------|-------------------|
| 1: Project Setup | 3 | 3 |
| 2: Fetchers | 3 | 3 |
| 3: Tournament API | 3 | 3 |
| 4: Frontend Setup | 5 | 5 |
| 5: Remaining Backend | 6 | 6 |
| 6: Remaining Frontend | 6 | 6 |
| 7: Infrastructure | 4 | 4 |

**Total:** ~30 tasks, ~30 commits
