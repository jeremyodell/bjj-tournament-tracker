# Flight Price Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILLS:
> - Use `superpowers:executing-plans` to implement this plan task-by-task
> - Use `superpowers:test-driven-development` for all code tasks
> - Use `superpowers:requesting-code-review` after completing each major section
> - Use `superpowers:verification-before-completion` before marking any task complete

**Goal:** Add real-time flight price fetching via Amadeus API for paid users, with EventBridge + SQS + WebSocket architecture.

**Architecture:** Daily cron pre-fetches prices for known airports. New airports trigger real-time fetch via EventBridge → SQS → Lambda → WebSocket push. Prices cached in DynamoDB with smart TTL.

**Tech Stack:** AWS SAM, EventBridge, SQS, API Gateway WebSocket, Lambda, DynamoDB, Amadeus API, React/TypeScript

**Design Doc:** `docs/plans/2025-12-30-flight-prices-design.md`

---

## Phase 1: Backend Infrastructure

### Task 1.1: Add DynamoDB Entities for Flight Prices

**Files:**
- Modify: `backend/src/db/types.ts`
- Create: `backend/src/db/flightPriceQueries.ts`
- Create: `backend/src/__tests__/db/flightPriceQueries.test.ts`

**Step 1: Add types to `backend/src/db/types.ts`**

```typescript
// Add key builders
export const buildFlightPK = (originAirport: string, destinationCity: string): string =>
  `FLIGHT#${originAirport}#${destinationCity}`;

export const buildAirportPK = (iataCode: string): string =>
  `AIRPORT#${iataCode}`;

export const buildWsConnPK = (connectionId: string): string =>
  `WSCONN#${connectionId}`;

// Add entity types
export interface FlightPriceItem {
  PK: string; // FLIGHT#{originAirport}#{destinationCity}
  SK: string; // {tournamentStartDate}
  price: number | null;
  currency: 'USD';
  airline: string | null;
  fetchedAt: string;
  expiresAt: string;
  source: 'amadeus' | 'estimated_range';
  rangeMin: number | null;
  rangeMax: number | null;
  originAirport: string;
  destinationCity: string;
  tournamentStartDate: string;
  ttl: number;
}

export interface KnownAirportItem {
  PK: string; // AIRPORT#{iataCode}
  SK: 'META';
  GSI1PK: 'AIRPORTS';
  GSI1SK: string; // {iataCode}
  iataCode: string;
  userCount: number;
  lastFetchedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WsConnectionItem {
  PK: string; // WSCONN#{connectionId}
  SK: 'META';
  GSI1PK: string; // USER#{userId}
  GSI1SK: 'WSCONN';
  connectionId: string;
  userId: string;
  pendingAirport: string | null;
  connectedAt: string;
  ttl: number;
}
```

**Step 2: Write failing tests for flight price queries**

Create `backend/src/__tests__/db/flightPriceQueries.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import {
  saveFlightPrice,
  getFlightPrice,
  getFlightPricesForAirport,
  getExpiredFlightPrices,
} from '../../db/flightPriceQueries';
import { FlightPriceItem } from '../../db/types';

describe('flightPriceQueries', () => {
  describe('saveFlightPrice', () => {
    it('should save a flight price', async () => {
      const price: Omit<FlightPriceItem, 'PK' | 'SK' | 'ttl'> = {
        originAirport: 'DFW',
        destinationCity: 'Miami',
        tournamentStartDate: '2025-02-15',
        price: 287,
        currency: 'USD',
        airline: 'American',
        fetchedAt: '2025-01-01T00:00:00Z',
        expiresAt: '2025-01-02T00:00:00Z',
        source: 'amadeus',
        rangeMin: null,
        rangeMax: null,
      };

      await saveFlightPrice(price);
      const result = await getFlightPrice('DFW', 'Miami', '2025-02-15');

      expect(result).not.toBeNull();
      expect(result?.price).toBe(287);
      expect(result?.airline).toBe('American');
    });
  });

  describe('getFlightPricesForAirport', () => {
    it('should return all prices for an origin airport', async () => {
      // Save multiple prices
      await saveFlightPrice({
        originAirport: 'DFW',
        destinationCity: 'Miami',
        tournamentStartDate: '2025-02-15',
        price: 287,
        currency: 'USD',
        airline: null,
        fetchedAt: '2025-01-01T00:00:00Z',
        expiresAt: '2025-01-02T00:00:00Z',
        source: 'amadeus',
        rangeMin: null,
        rangeMax: null,
      });

      await saveFlightPrice({
        originAirport: 'DFW',
        destinationCity: 'Las Vegas',
        tournamentStartDate: '2025-03-10',
        price: 199,
        currency: 'USD',
        airline: null,
        fetchedAt: '2025-01-01T00:00:00Z',
        expiresAt: '2025-01-02T00:00:00Z',
        source: 'amadeus',
        rangeMin: null,
        rangeMax: null,
      });

      const results = await getFlightPricesForAirport('DFW');
      expect(results.length).toBeGreaterThanOrEqual(2);
    });
  });
});
```

**Step 3: Run tests to verify they fail**

Run: `cd backend && npm test -- --grep "flightPriceQueries"`
Expected: FAIL with "Cannot find module"

**Step 4: Implement flight price queries**

Create `backend/src/db/flightPriceQueries.ts`:

```typescript
import { dbClient } from './client';
import {
  buildFlightPK,
  FlightPriceItem,
} from './types';

const TABLE_NAME = process.env.DYNAMODB_TABLE || 'bjj-tournament-tracker-dev';

export async function saveFlightPrice(
  price: Omit<FlightPriceItem, 'PK' | 'SK' | 'ttl'>
): Promise<void> {
  const item: FlightPriceItem = {
    PK: buildFlightPK(price.originAirport, price.destinationCity),
    SK: price.tournamentStartDate,
    ttl: Math.floor(new Date(price.expiresAt).getTime() / 1000),
    ...price,
  };

  await dbClient.put({
    TableName: TABLE_NAME,
    Item: item,
  });
}

export async function getFlightPrice(
  originAirport: string,
  destinationCity: string,
  tournamentStartDate: string
): Promise<FlightPriceItem | null> {
  const result = await dbClient.get({
    TableName: TABLE_NAME,
    Key: {
      PK: buildFlightPK(originAirport, destinationCity),
      SK: tournamentStartDate,
    },
  });

  return (result.Item as FlightPriceItem) || null;
}

export async function getFlightPricesForAirport(
  originAirport: string
): Promise<FlightPriceItem[]> {
  const result = await dbClient.query({
    TableName: TABLE_NAME,
    KeyConditionExpression: 'begins_with(PK, :pk)',
    ExpressionAttributeValues: {
      ':pk': `FLIGHT#${originAirport}#`,
    },
  });

  return (result.Items as FlightPriceItem[]) || [];
}

export async function getExpiredFlightPrices(): Promise<FlightPriceItem[]> {
  const now = new Date().toISOString();

  const result = await dbClient.scan({
    TableName: TABLE_NAME,
    FilterExpression: 'begins_with(PK, :prefix) AND expiresAt < :now',
    ExpressionAttributeValues: {
      ':prefix': 'FLIGHT#',
      ':now': now,
    },
  });

  return (result.Items as FlightPriceItem[]) || [];
}
```

**Step 5: Run tests to verify they pass**

Run: `cd backend && npm test -- --grep "flightPriceQueries"`
Expected: PASS

**Step 6: Commit**

```bash
git add backend/src/db/types.ts backend/src/db/flightPriceQueries.ts backend/src/__tests__/db/flightPriceQueries.test.ts
git commit -m "feat(db): add flight price DynamoDB entities and queries"
```

---

### Task 1.2: Add Known Airport Queries

**Files:**
- Create: `backend/src/db/airportQueries.ts`
- Create: `backend/src/__tests__/db/airportQueries.test.ts`

**Step 1: Write failing tests**

Create `backend/src/__tests__/db/airportQueries.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  saveKnownAirport,
  getKnownAirport,
  listKnownAirports,
  incrementAirportUserCount,
} from '../../db/airportQueries';

describe('airportQueries', () => {
  describe('saveKnownAirport', () => {
    it('should save a new airport', async () => {
      await saveKnownAirport('DFW');
      const result = await getKnownAirport('DFW');

      expect(result).not.toBeNull();
      expect(result?.iataCode).toBe('DFW');
      expect(result?.userCount).toBe(1);
    });
  });

  describe('incrementAirportUserCount', () => {
    it('should increment user count for existing airport', async () => {
      await saveKnownAirport('IAH');
      await incrementAirportUserCount('IAH');
      const result = await getKnownAirport('IAH');

      expect(result?.userCount).toBe(2);
    });
  });

  describe('listKnownAirports', () => {
    it('should list all known airports', async () => {
      await saveKnownAirport('AUS');
      const results = await listKnownAirports();

      expect(results.some(a => a.iataCode === 'AUS')).toBe(true);
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd backend && npm test -- --grep "airportQueries"`
Expected: FAIL

**Step 3: Implement airport queries**

Create `backend/src/db/airportQueries.ts`:

```typescript
import { dbClient } from './client';
import { buildAirportPK, KnownAirportItem } from './types';

const TABLE_NAME = process.env.DYNAMODB_TABLE || 'bjj-tournament-tracker-dev';

export async function saveKnownAirport(iataCode: string): Promise<void> {
  const now = new Date().toISOString();
  const item: KnownAirportItem = {
    PK: buildAirportPK(iataCode),
    SK: 'META',
    GSI1PK: 'AIRPORTS',
    GSI1SK: iataCode,
    iataCode,
    userCount: 1,
    lastFetchedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  await dbClient.put({
    TableName: TABLE_NAME,
    Item: item,
    ConditionExpression: 'attribute_not_exists(PK)',
  }).catch(async (err) => {
    if (err.name === 'ConditionalCheckFailedException') {
      await incrementAirportUserCount(iataCode);
    } else {
      throw err;
    }
  });
}

export async function getKnownAirport(iataCode: string): Promise<KnownAirportItem | null> {
  const result = await dbClient.get({
    TableName: TABLE_NAME,
    Key: {
      PK: buildAirportPK(iataCode),
      SK: 'META',
    },
  });

  return (result.Item as KnownAirportItem) || null;
}

export async function incrementAirportUserCount(iataCode: string): Promise<void> {
  await dbClient.update({
    TableName: TABLE_NAME,
    Key: {
      PK: buildAirportPK(iataCode),
      SK: 'META',
    },
    UpdateExpression: 'SET userCount = userCount + :inc, updatedAt = :now',
    ExpressionAttributeValues: {
      ':inc': 1,
      ':now': new Date().toISOString(),
    },
  });
}

export async function listKnownAirports(): Promise<KnownAirportItem[]> {
  const result = await dbClient.query({
    TableName: TABLE_NAME,
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :pk',
    ExpressionAttributeValues: {
      ':pk': 'AIRPORTS',
    },
  });

  return (result.Items as KnownAirportItem[]) || [];
}

export async function updateAirportLastFetched(iataCode: string): Promise<void> {
  await dbClient.update({
    TableName: TABLE_NAME,
    Key: {
      PK: buildAirportPK(iataCode),
      SK: 'META',
    },
    UpdateExpression: 'SET lastFetchedAt = :now, updatedAt = :now',
    ExpressionAttributeValues: {
      ':now': new Date().toISOString(),
    },
  });
}
```

**Step 4: Run tests to verify they pass**

Run: `cd backend && npm test -- --grep "airportQueries"`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/src/db/airportQueries.ts backend/src/__tests__/db/airportQueries.test.ts
git commit -m "feat(db): add known airport queries for tracking user airports"
```

---

### Task 1.3: Create Amadeus API Client

**Files:**
- Create: `backend/src/services/amadeusClient.ts`
- Create: `backend/src/__tests__/services/amadeusClient.test.ts`

**Step 1: Write failing tests**

Create `backend/src/__tests__/services/amadeusClient.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AmadeusClient } from '../../services/amadeusClient';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('AmadeusClient', () => {
  let client: AmadeusClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new AmadeusClient('test-key', 'test-secret');
  });

  describe('authenticate', () => {
    it('should obtain access token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'test-token',
          expires_in: 1799,
        }),
      });

      await client.authenticate();
      expect(client.isAuthenticated()).toBe(true);
    });
  });

  describe('searchFlights', () => {
    it('should return cheapest flight price', async () => {
      // Mock auth
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'token', expires_in: 1799 }),
      });

      // Mock flight search
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{
            price: { total: '287.00', currency: 'USD' },
            validatingAirlineCodes: ['AA'],
          }],
        }),
      });

      const result = await client.searchFlights({
        origin: 'DFW',
        destination: 'MIA',
        departureDate: '2025-02-14',
        returnDate: '2025-02-16',
      });

      expect(result).not.toBeNull();
      expect(result?.price).toBe(287);
      expect(result?.airline).toBe('AA');
    });

    it('should return null when no flights found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'token', expires_in: 1799 }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      });

      const result = await client.searchFlights({
        origin: 'DFW',
        destination: 'XXX',
        departureDate: '2025-02-14',
        returnDate: '2025-02-16',
      });

      expect(result).toBeNull();
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd backend && npm test -- --grep "AmadeusClient"`
Expected: FAIL

**Step 3: Implement Amadeus client**

Create `backend/src/services/amadeusClient.ts`:

```typescript
export interface FlightSearchParams {
  origin: string;
  destination: string;
  departureDate: string; // YYYY-MM-DD
  returnDate: string;    // YYYY-MM-DD
}

export interface FlightSearchResult {
  price: number;
  currency: string;
  airline: string | null;
}

export class AmadeusClient {
  private apiKey: string;
  private apiSecret: string;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;
  private baseUrl = 'https://api.amadeus.com';

  constructor(apiKey: string, apiSecret: string) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
  }

  async authenticate(): Promise<void> {
    const response = await fetch(`${this.baseUrl}/v1/security/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.apiKey,
        client_secret: this.apiSecret,
      }),
    });

    if (!response.ok) {
      throw new Error(`Amadeus auth failed: ${response.status}`);
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    this.tokenExpiry = new Date(Date.now() + data.expires_in * 1000);
  }

  isAuthenticated(): boolean {
    return !!this.accessToken && !!this.tokenExpiry && this.tokenExpiry > new Date();
  }

  private async ensureAuthenticated(): Promise<void> {
    if (!this.isAuthenticated()) {
      await this.authenticate();
    }
  }

  async searchFlights(params: FlightSearchParams): Promise<FlightSearchResult | null> {
    await this.ensureAuthenticated();

    const searchParams = new URLSearchParams({
      originLocationCode: params.origin,
      destinationLocationCode: params.destination,
      departureDate: params.departureDate,
      returnDate: params.returnDate,
      adults: '1',
      currencyCode: 'USD',
      max: '1',
    });

    const response = await fetch(
      `${this.baseUrl}/v2/shopping/flight-offers?${searchParams}`,
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      }
    );

    if (!response.ok) {
      console.error(`Amadeus search failed: ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (!data.data || data.data.length === 0) {
      return null;
    }

    const offer = data.data[0];
    return {
      price: parseFloat(offer.price.total),
      currency: offer.price.currency,
      airline: offer.validatingAirlineCodes?.[0] || null,
    };
  }
}

// Singleton instance
let amadeusClient: AmadeusClient | null = null;

export function getAmadeusClient(): AmadeusClient {
  if (!amadeusClient) {
    const apiKey = process.env.AMADEUS_API_KEY;
    const apiSecret = process.env.AMADEUS_API_SECRET;

    if (!apiKey || !apiSecret) {
      throw new Error('AMADEUS_API_KEY and AMADEUS_API_SECRET must be set');
    }

    amadeusClient = new AmadeusClient(apiKey, apiSecret);
  }

  return amadeusClient;
}
```

**Step 4: Run tests to verify they pass**

Run: `cd backend && npm test -- --grep "AmadeusClient"`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/src/services/amadeusClient.ts backend/src/__tests__/services/amadeusClient.test.ts
git commit -m "feat(amadeus): add Amadeus API client for flight search"
```

---

### Task 1.4: Create Flight Price Service

**Files:**
- Create: `backend/src/services/flightPriceService.ts`
- Create: `backend/src/__tests__/services/flightPriceService.test.ts`

**Step 1: Write failing tests**

Create `backend/src/__tests__/services/flightPriceService.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calculateSmartTTL,
  shouldFetchFlightPrice,
  fetchFlightPriceForTournament,
} from '../../services/flightPriceService';

describe('flightPriceService', () => {
  describe('calculateSmartTTL', () => {
    it('should return 24hr TTL for tournaments < 30 days away', () => {
      const tournamentDate = new Date();
      tournamentDate.setDate(tournamentDate.getDate() + 15);

      const expiry = calculateSmartTTL(tournamentDate);
      const hoursUntilExpiry = (expiry.getTime() - Date.now()) / (1000 * 60 * 60);

      expect(hoursUntilExpiry).toBeCloseTo(24, 0);
    });

    it('should return 3-day TTL for tournaments 30-90 days away', () => {
      const tournamentDate = new Date();
      tournamentDate.setDate(tournamentDate.getDate() + 60);

      const expiry = calculateSmartTTL(tournamentDate);
      const daysUntilExpiry = (expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24);

      expect(daysUntilExpiry).toBeCloseTo(3, 0);
    });

    it('should return 7-day TTL for tournaments > 90 days away', () => {
      const tournamentDate = new Date();
      tournamentDate.setDate(tournamentDate.getDate() + 120);

      const expiry = calculateSmartTTL(tournamentDate);
      const daysUntilExpiry = (expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24);

      expect(daysUntilExpiry).toBeCloseTo(7, 0);
    });
  });

  describe('shouldFetchFlightPrice', () => {
    const dfwAirport = { lat: 32.8998, lng: -97.0403, city: 'Dallas' };

    it('should return false for tournaments within drive range', () => {
      // Houston is ~4 hours from Dallas
      const houstonTournament = { lat: 29.7604, lng: -95.3698, city: 'Houston' };
      const maxDriveHours = 6;

      const result = shouldFetchFlightPrice(dfwAirport, houstonTournament, maxDriveHours);
      expect(result).toBe(false);
    });

    it('should return true for tournaments outside drive range', () => {
      // Miami is ~18 hours from Dallas
      const miamiTournament = { lat: 25.7617, lng: -80.1918, city: 'Miami' };
      const maxDriveHours = 6;

      const result = shouldFetchFlightPrice(dfwAirport, miamiTournament, maxDriveHours);
      expect(result).toBe(true);
    });

    it('should skip same city when maxDriveHours is 0', () => {
      const dallasTournament = { lat: 32.7767, lng: -96.7970, city: 'Dallas' };
      const maxDriveHours = 0;

      const result = shouldFetchFlightPrice(dfwAirport, dallasTournament, maxDriveHours);
      expect(result).toBe(false);
    });

    it('should fetch for other cities when maxDriveHours is 0', () => {
      const houstonTournament = { lat: 29.7604, lng: -95.3698, city: 'Houston' };
      const maxDriveHours = 0;

      const result = shouldFetchFlightPrice(dfwAirport, houstonTournament, maxDriveHours);
      expect(result).toBe(true);
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd backend && npm test -- --grep "flightPriceService"`
Expected: FAIL

**Step 3: Implement flight price service**

Create `backend/src/services/flightPriceService.ts`:

```typescript
import { getAmadeusClient } from './amadeusClient';
import { saveFlightPrice, getFlightPrice } from '../db/flightPriceQueries';
import { TournamentItem } from '../db/types';

interface Location {
  lat: number;
  lng: number;
  city: string;
}

// Haversine formula for distance
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3959; // Earth's radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function calculateSmartTTL(tournamentDate: Date): Date {
  const now = new Date();
  const daysUntil = Math.floor(
    (tournamentDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysUntil < 30) {
    // 24 hour cache
    return new Date(now.getTime() + 24 * 60 * 60 * 1000);
  } else if (daysUntil < 90) {
    // 3 day cache
    return new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  } else {
    // 7 day cache
    return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  }
}

export function shouldFetchFlightPrice(
  homeAirport: Location,
  tournament: Location,
  maxDriveHours: number
): boolean {
  if (maxDriveHours === 0) {
    // User only flies - skip same city only
    return tournament.city.toLowerCase() !== homeAirport.city.toLowerCase();
  }

  const distance = calculateDistance(
    homeAirport.lat,
    homeAirport.lng,
    tournament.lat,
    tournament.lng
  );
  const driveHours = distance / 60; // Assume 60 mph average

  return driveHours > maxDriveHours;
}

export async function fetchFlightPriceForTournament(
  originAirport: string,
  originLocation: Location,
  destinationAirportCode: string,
  tournament: TournamentItem,
  maxDriveHours: number
): Promise<void> {
  // Check if we should fetch
  if (!tournament.lat || !tournament.lng) {
    console.log(`Skipping ${tournament.name}: no coordinates`);
    return;
  }

  const tournamentLocation: Location = {
    lat: tournament.lat,
    lng: tournament.lng,
    city: tournament.city,
  };

  if (!shouldFetchFlightPrice(originLocation, tournamentLocation, maxDriveHours)) {
    console.log(`Skipping ${tournament.name}: within drive range`);
    return;
  }

  // Check cache
  const cached = await getFlightPrice(originAirport, tournament.city, tournament.startDate);
  if (cached && new Date(cached.expiresAt) > new Date()) {
    console.log(`Using cached price for ${originAirport} -> ${tournament.city}`);
    return;
  }

  // Calculate flight dates (day before start, day after end)
  const startDate = new Date(tournament.startDate);
  const endDate = new Date(tournament.endDate);
  const departureDate = new Date(startDate);
  departureDate.setDate(departureDate.getDate() - 1);
  const returnDate = new Date(endDate);
  returnDate.setDate(returnDate.getDate() + 1);

  // Fetch from Amadeus
  const client = getAmadeusClient();
  const result = await client.searchFlights({
    origin: originAirport,
    destination: destinationAirportCode,
    departureDate: departureDate.toISOString().split('T')[0],
    returnDate: returnDate.toISOString().split('T')[0],
  });

  const expiry = calculateSmartTTL(startDate);

  if (result) {
    await saveFlightPrice({
      originAirport,
      destinationCity: tournament.city,
      tournamentStartDate: tournament.startDate,
      price: result.price,
      currency: 'USD',
      airline: result.airline,
      fetchedAt: new Date().toISOString(),
      expiresAt: expiry.toISOString(),
      source: 'amadeus',
      rangeMin: null,
      rangeMax: null,
    });
  } else {
    // Store as null price - we'll calculate range later
    await saveFlightPrice({
      originAirport,
      destinationCity: tournament.city,
      tournamentStartDate: tournament.startDate,
      price: null,
      currency: 'USD',
      airline: null,
      fetchedAt: new Date().toISOString(),
      expiresAt: expiry.toISOString(),
      source: 'estimated_range',
      rangeMin: null,
      rangeMax: null,
    });
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `cd backend && npm test -- --grep "flightPriceService"`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/src/services/flightPriceService.ts backend/src/__tests__/services/flightPriceService.test.ts
git commit -m "feat(flights): add flight price service with smart TTL"
```

---

## Phase 2: AWS Infrastructure (SAM Template)

### Task 2.1: Add EventBridge, SQS, and WebSocket to SAM Template

**Files:**
- Modify: `backend/template.yaml`

**Step 1: Add resources to template.yaml**

Add the following resources to `backend/template.yaml`:

```yaml
# EventBridge
FlightPriceEventBus:
  Type: AWS::Events::EventBus
  Properties:
    Name: !Sub "bjj-flight-prices-${Stage}"

# SQS Queue
FlightPriceQueue:
  Type: AWS::SQS::Queue
  Properties:
    QueueName: !Sub "bjj-flight-price-queue-${Stage}"
    VisibilityTimeout: 300
    MessageRetentionPeriod: 86400
    RedrivePolicy:
      deadLetterTargetArn: !GetAtt FlightPriceDLQ.Arn
      maxReceiveCount: 3

FlightPriceDLQ:
  Type: AWS::SQS::Queue
  Properties:
    QueueName: !Sub "bjj-flight-price-dlq-${Stage}"
    MessageRetentionPeriod: 1209600

# EventBridge Rules
DailyFlightPriceRule:
  Type: AWS::Events::Rule
  Properties:
    Name: !Sub "daily-flight-price-fetch-${Stage}"
    EventBusName: !Ref FlightPriceEventBus
    ScheduleExpression: "cron(0 4 * * ? *)"
    State: ENABLED
    Targets:
      - Id: FlightPriceQueue
        Arn: !GetAtt FlightPriceQueue.Arn

NewAirportRule:
  Type: AWS::Events::Rule
  Properties:
    Name: !Sub "new-airport-added-${Stage}"
    EventBusName: !Ref FlightPriceEventBus
    EventPattern:
      source:
        - "bjj.airports"
      detail-type:
        - "airport.added"
    State: ENABLED
    Targets:
      - Id: FlightPriceQueue
        Arn: !GetAtt FlightPriceQueue.Arn

# SQS Policy for EventBridge
FlightPriceQueuePolicy:
  Type: AWS::SQS::QueuePolicy
  Properties:
    Queues:
      - !Ref FlightPriceQueue
    PolicyDocument:
      Statement:
        - Effect: Allow
          Principal:
            Service: events.amazonaws.com
          Action: sqs:SendMessage
          Resource: !GetAtt FlightPriceQueue.Arn

# WebSocket API
WebSocketApi:
  Type: AWS::ApiGatewayV2::Api
  Properties:
    Name: !Sub "bjj-websocket-${Stage}"
    ProtocolType: WEBSOCKET
    RouteSelectionExpression: "$request.body.action"

WebSocketStage:
  Type: AWS::ApiGatewayV2::Stage
  Properties:
    ApiId: !Ref WebSocketApi
    StageName: !Ref Stage
    AutoDeploy: true

# WebSocket Routes
ConnectRoute:
  Type: AWS::ApiGatewayV2::Route
  Properties:
    ApiId: !Ref WebSocketApi
    RouteKey: "$connect"
    AuthorizationType: NONE
    Target: !Sub "integrations/${ConnectIntegration}"

DisconnectRoute:
  Type: AWS::ApiGatewayV2::Route
  Properties:
    ApiId: !Ref WebSocketApi
    RouteKey: "$disconnect"
    Target: !Sub "integrations/${DisconnectIntegration}"

# WebSocket Lambda Function
WebSocketHandler:
  Type: AWS::Serverless::Function
  Properties:
    Handler: src/handlers/websocket.handler
    Runtime: nodejs20.x
    Timeout: 30
    Environment:
      Variables:
        DYNAMODB_TABLE: !Ref TournamentTable
    Policies:
      - DynamoDBCrudPolicy:
          TableName: !Ref TournamentTable

ConnectIntegration:
  Type: AWS::ApiGatewayV2::Integration
  Properties:
    ApiId: !Ref WebSocketApi
    IntegrationType: AWS_PROXY
    IntegrationUri: !Sub "arn:aws:apigateway:${AWS::Region}:lambda:path/2015-03-31/functions/${WebSocketHandler.Arn}/invocations"

DisconnectIntegration:
  Type: AWS::ApiGatewayV2::Integration
  Properties:
    ApiId: !Ref WebSocketApi
    IntegrationType: AWS_PROXY
    IntegrationUri: !Sub "arn:aws:apigateway:${AWS::Region}:lambda:path/2015-03-31/functions/${WebSocketHandler.Arn}/invocations"

WebSocketPermission:
  Type: AWS::Lambda::Permission
  Properties:
    Action: lambda:InvokeFunction
    FunctionName: !Ref WebSocketHandler
    Principal: apigateway.amazonaws.com
    SourceArn: !Sub "arn:aws:execute-api:${AWS::Region}:${AWS::AccountId}:${WebSocketApi}/*"

# Flight Price Lambda (SQS triggered)
FlightPriceFetcher:
  Type: AWS::Serverless::Function
  Properties:
    Handler: src/handlers/flightPriceFetcher.handler
    Runtime: nodejs20.x
    Timeout: 300
    MemorySize: 512
    Environment:
      Variables:
        DYNAMODB_TABLE: !Ref TournamentTable
        AMADEUS_API_KEY: !Ref AmadeusApiKey
        AMADEUS_API_SECRET: !Ref AmadeusApiSecret
        WEBSOCKET_ENDPOINT: !Sub "https://${WebSocketApi}.execute-api.${AWS::Region}.amazonaws.com/${Stage}"
    Policies:
      - DynamoDBCrudPolicy:
          TableName: !Ref TournamentTable
      - Statement:
          - Effect: Allow
            Action:
              - execute-api:ManageConnections
            Resource: !Sub "arn:aws:execute-api:${AWS::Region}:${AWS::AccountId}:${WebSocketApi}/*"
    Events:
      SQSEvent:
        Type: SQS
        Properties:
          Queue: !GetAtt FlightPriceQueue.Arn
          BatchSize: 1

# Parameters
Parameters:
  AmadeusApiKey:
    Type: String
    Default: ""
    NoEcho: true
  AmadeusApiSecret:
    Type: String
    Default: ""
    NoEcho: true

# Outputs
Outputs:
  WebSocketUrl:
    Description: WebSocket URL
    Value: !Sub "wss://${WebSocketApi}.execute-api.${AWS::Region}.amazonaws.com/${Stage}"
```

**Step 2: Validate template**

Run: `cd backend && sam validate`
Expected: Template is valid

**Step 3: Commit**

```bash
git add backend/template.yaml
git commit -m "infra: add EventBridge, SQS, WebSocket for flight prices"
```

---

## Phase 3: Lambda Handlers

### Task 3.1: WebSocket Connection Handler

**Files:**
- Create: `backend/src/handlers/websocket.ts`
- Create: `backend/src/__tests__/handlers/websocket.test.ts`
- Create: `backend/src/db/wsConnectionQueries.ts`

**Step 1: Write failing tests**

Create `backend/src/__tests__/handlers/websocket.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { handler } from '../../handlers/websocket';

vi.mock('../../db/wsConnectionQueries', () => ({
  saveConnection: vi.fn(),
  deleteConnection: vi.fn(),
}));

describe('websocket handler', () => {
  it('should handle $connect', async () => {
    const event = {
      requestContext: {
        connectionId: 'test-conn-id',
        routeKey: '$connect',
      },
      queryStringParameters: {
        userId: 'user-123',
      },
    };

    const result = await handler(event as any);
    expect(result.statusCode).toBe(200);
  });

  it('should handle $disconnect', async () => {
    const event = {
      requestContext: {
        connectionId: 'test-conn-id',
        routeKey: '$disconnect',
      },
    };

    const result = await handler(event as any);
    expect(result.statusCode).toBe(200);
  });
});
```

**Step 2: Implement WebSocket handler**

Create `backend/src/db/wsConnectionQueries.ts`:

```typescript
import { dbClient } from './client';
import { buildWsConnPK, WsConnectionItem } from './types';

const TABLE_NAME = process.env.DYNAMODB_TABLE || 'bjj-tournament-tracker-dev';

export async function saveConnection(
  connectionId: string,
  userId: string
): Promise<void> {
  const now = new Date();
  const ttl = Math.floor(now.getTime() / 1000) + 24 * 60 * 60; // 24 hours

  const item: WsConnectionItem = {
    PK: buildWsConnPK(connectionId),
    SK: 'META',
    GSI1PK: `USER#${userId}`,
    GSI1SK: 'WSCONN',
    connectionId,
    userId,
    pendingAirport: null,
    connectedAt: now.toISOString(),
    ttl,
  };

  await dbClient.put({
    TableName: TABLE_NAME,
    Item: item,
  });
}

export async function deleteConnection(connectionId: string): Promise<void> {
  await dbClient.delete({
    TableName: TABLE_NAME,
    Key: {
      PK: buildWsConnPK(connectionId),
      SK: 'META',
    },
  });
}

export async function getConnectionsForUser(userId: string): Promise<WsConnectionItem[]> {
  const result = await dbClient.query({
    TableName: TABLE_NAME,
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :pk AND GSI1SK = :sk',
    ExpressionAttributeValues: {
      ':pk': `USER#${userId}`,
      ':sk': 'WSCONN',
    },
  });

  return (result.Items as WsConnectionItem[]) || [];
}

export async function setPendingAirport(
  connectionId: string,
  airport: string
): Promise<void> {
  await dbClient.update({
    TableName: TABLE_NAME,
    Key: {
      PK: buildWsConnPK(connectionId),
      SK: 'META',
    },
    UpdateExpression: 'SET pendingAirport = :airport',
    ExpressionAttributeValues: {
      ':airport': airport,
    },
  });
}
```

Create `backend/src/handlers/websocket.ts`:

```typescript
import { APIGatewayProxyWebsocketEventV2 } from 'aws-lambda';
import { saveConnection, deleteConnection } from '../db/wsConnectionQueries';

export async function handler(event: APIGatewayProxyWebsocketEventV2) {
  const { connectionId, routeKey } = event.requestContext;

  try {
    switch (routeKey) {
      case '$connect': {
        const userId = event.queryStringParameters?.userId;
        if (!userId) {
          return { statusCode: 400, body: 'userId required' };
        }
        await saveConnection(connectionId, userId);
        return { statusCode: 200, body: 'Connected' };
      }

      case '$disconnect': {
        await deleteConnection(connectionId);
        return { statusCode: 200, body: 'Disconnected' };
      }

      default:
        return { statusCode: 400, body: 'Unknown route' };
    }
  } catch (error) {
    console.error('WebSocket error:', error);
    return { statusCode: 500, body: 'Internal error' };
  }
}
```

**Step 3: Run tests**

Run: `cd backend && npm test -- --grep "websocket handler"`
Expected: PASS

**Step 4: Commit**

```bash
git add backend/src/handlers/websocket.ts backend/src/db/wsConnectionQueries.ts backend/src/__tests__/handlers/websocket.test.ts
git commit -m "feat(ws): add WebSocket connection handler"
```

---

### Task 3.2: Flight Price Fetcher Lambda

**Files:**
- Create: `backend/src/handlers/flightPriceFetcher.ts`
- Create: `backend/src/__tests__/handlers/flightPriceFetcher.test.ts`

**Step 1: Write failing tests**

Create `backend/src/__tests__/handlers/flightPriceFetcher.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handler } from '../../handlers/flightPriceFetcher';
import { SQSEvent } from 'aws-lambda';

vi.mock('../../services/flightPriceService');
vi.mock('../../db/airportQueries');
vi.mock('../../db/queries');

describe('flightPriceFetcher handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should process airport.added event', async () => {
    const event: SQSEvent = {
      Records: [
        {
          body: JSON.stringify({
            'detail-type': 'airport.added',
            detail: {
              airport: 'DFW',
              userId: 'user-123',
            },
          }),
          messageId: '1',
          receiptHandle: 'handle',
          attributes: {} as any,
          messageAttributes: {},
          md5OfBody: '',
          eventSource: 'aws:sqs',
          eventSourceARN: 'arn',
          awsRegion: 'us-east-1',
        },
      ],
    };

    await expect(handler(event)).resolves.not.toThrow();
  });

  it('should process scheduled daily fetch', async () => {
    const event: SQSEvent = {
      Records: [
        {
          body: JSON.stringify({
            'detail-type': 'Scheduled Event',
          }),
          messageId: '1',
          receiptHandle: 'handle',
          attributes: {} as any,
          messageAttributes: {},
          md5OfBody: '',
          eventSource: 'aws:sqs',
          eventSourceARN: 'arn',
          awsRegion: 'us-east-1',
        },
      ],
    };

    await expect(handler(event)).resolves.not.toThrow();
  });
});
```

**Step 2: Implement flight price fetcher**

Create `backend/src/handlers/flightPriceFetcher.ts`:

```typescript
import { SQSEvent } from 'aws-lambda';
import { ApiGatewayManagementApi } from '@aws-sdk/client-apigatewaymanagementapi';
import { listKnownAirports, getKnownAirport } from '../db/airportQueries';
import { getConnectionsForUser } from '../db/wsConnectionQueries';
import { getAllTournaments } from '../db/queries';
import { fetchFlightPriceForTournament } from '../services/flightPriceService';
import { findNearestAirport, getAirportByCode } from '../data/airports';

const wsEndpoint = process.env.WEBSOCKET_ENDPOINT;

async function notifyUser(userId: string, message: object): Promise<void> {
  if (!wsEndpoint) return;

  const client = new ApiGatewayManagementApi({
    endpoint: wsEndpoint,
  });

  const connections = await getConnectionsForUser(userId);

  for (const conn of connections) {
    try {
      await client.postToConnection({
        ConnectionId: conn.connectionId,
        Data: Buffer.from(JSON.stringify(message)),
      });
    } catch (error: any) {
      if (error.statusCode === 410) {
        // Connection is gone, clean up
        console.log(`Stale connection: ${conn.connectionId}`);
      }
    }
  }
}

async function fetchPricesForAirport(
  airport: string,
  userId?: string
): Promise<void> {
  const airportData = getAirportByCode(airport);
  if (!airportData) {
    console.error(`Unknown airport: ${airport}`);
    return;
  }

  const tournaments = await getAllTournaments();
  const futureTournaments = tournaments.filter(
    (t) => new Date(t.startDate) > new Date()
  );

  console.log(`Fetching prices for ${airport} -> ${futureTournaments.length} tournaments`);

  for (const tournament of futureTournaments) {
    if (!tournament.lat || !tournament.lng) continue;

    const destAirport = findNearestAirport(tournament.lat, tournament.lng);
    if (!destAirport) continue;

    try {
      await fetchFlightPriceForTournament(
        airport,
        { lat: airportData.lat, lng: airportData.lng, city: airportData.city },
        destAirport.iataCode,
        tournament,
        6 // Default maxDriveHours, will be overridden per-user in frontend
      );
    } catch (error) {
      console.error(`Error fetching ${airport} -> ${tournament.city}:`, error);
    }
  }

  // Notify user if this was triggered by them
  if (userId) {
    await notifyUser(userId, {
      type: 'prices_ready',
      airport,
    });
  }
}

async function runDailyFetch(): Promise<void> {
  const airports = await listKnownAirports();
  console.log(`Daily fetch for ${airports.length} airports`);

  for (const airport of airports) {
    await fetchPricesForAirport(airport.iataCode);
  }
}

export async function handler(event: SQSEvent): Promise<void> {
  for (const record of event.Records) {
    const body = JSON.parse(record.body);

    if (body['detail-type'] === 'airport.added') {
      // New airport added by user
      const { airport, userId } = body.detail;
      await fetchPricesForAirport(airport, userId);
    } else if (body['detail-type'] === 'Scheduled Event') {
      // Daily cron
      await runDailyFetch();
    } else {
      console.log('Unknown event type:', body['detail-type']);
    }
  }
}
```

**Step 3: Run tests**

Run: `cd backend && npm test -- --grep "flightPriceFetcher"`
Expected: PASS

**Step 4: Commit**

```bash
git add backend/src/handlers/flightPriceFetcher.ts backend/src/__tests__/handlers/flightPriceFetcher.test.ts
git commit -m "feat(flights): add SQS-triggered flight price fetcher lambda"
```

---

## Phase 4: Frontend - Airport Selection

### Task 4.1: Add Static Airport Dataset

**Files:**
- Create: `frontend/src/data/airports.json` (trimmed OpenFlights data)
- Create: `frontend/src/lib/airports.ts`
- Create: `frontend/src/__tests__/lib/airports.test.ts`

**Step 1: Download and trim airport data**

Create script to fetch and trim OpenFlights data to ~3000 commercial airports with IATA codes. Save to `frontend/src/data/airports.json`.

**Step 2: Write failing tests**

Create `frontend/src/__tests__/lib/airports.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { searchAirports, findNearestAirport } from '@/lib/airports';

describe('airports', () => {
  describe('searchAirports', () => {
    it('should find airports by IATA code', () => {
      const results = searchAirports('DFW');
      expect(results.some((a) => a.iataCode === 'DFW')).toBe(true);
    });

    it('should find airports by city name', () => {
      const results = searchAirports('dallas');
      expect(results.some((a) => a.city.toLowerCase().includes('dallas'))).toBe(true);
    });

    it('should return empty for short queries', () => {
      const results = searchAirports('d');
      expect(results).toHaveLength(0);
    });

    it('should limit results to 10', () => {
      const results = searchAirports('new');
      expect(results.length).toBeLessThanOrEqual(10);
    });
  });

  describe('findNearestAirport', () => {
    it('should find DFW for Dallas coordinates', () => {
      const result = findNearestAirport(32.7767, -96.797);
      expect(result?.iataCode).toBe('DFW');
    });

    it('should find LAX for LA coordinates', () => {
      const result = findNearestAirport(34.0522, -118.2437);
      expect(result?.iataCode).toBe('LAX');
    });
  });
});
```

**Step 3: Implement airport utilities**

Create `frontend/src/lib/airports.ts`:

```typescript
import airportsData from '@/data/airports.json';

export interface Airport {
  iataCode: string;
  name: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
}

const airports: Airport[] = airportsData as Airport[];

export function searchAirports(query: string): Airport[] {
  const q = query.toLowerCase().trim();
  if (q.length < 2) return [];

  return airports
    .filter(
      (a) =>
        a.iataCode.toLowerCase().includes(q) ||
        a.city.toLowerCase().includes(q) ||
        a.name.toLowerCase().includes(q)
    )
    .slice(0, 10);
}

function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 3959;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function findNearestAirport(lat: number, lng: number): Airport | null {
  if (airports.length === 0) return null;

  let nearest = airports[0];
  let minDistance = calculateDistance(lat, lng, nearest.lat, nearest.lng);

  for (const airport of airports) {
    const dist = calculateDistance(lat, lng, airport.lat, airport.lng);
    if (dist < minDistance) {
      minDistance = dist;
      nearest = airport;
    }
  }

  return nearest;
}

export function getAirportByCode(code: string): Airport | null {
  return airports.find((a) => a.iataCode === code.toUpperCase()) || null;
}
```

**Step 4: Run tests**

Run: `cd frontend && npm test -- airports`
Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/data/airports.json frontend/src/lib/airports.ts frontend/src/__tests__/lib/airports.test.ts
git commit -m "feat(airports): add static airport dataset and search utilities"
```

---

### Task 4.2: Create Airport Selector Component

**Files:**
- Create: `frontend/src/components/planner/AirportSelector.tsx`
- Create: `frontend/src/__tests__/components/AirportSelector.test.tsx`

**Step 1: Write failing tests**

Create `frontend/src/__tests__/components/AirportSelector.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AirportSelector } from '@/components/planner/AirportSelector';

describe('AirportSelector', () => {
  it('should show auto-detected airport', async () => {
    const onSelect = vi.fn();

    // Mock geolocation
    const mockGeolocation = {
      getCurrentPosition: vi.fn().mockImplementation((success) =>
        success({
          coords: { latitude: 32.7767, longitude: -96.797 },
        })
      ),
    };
    Object.defineProperty(navigator, 'geolocation', {
      value: mockGeolocation,
    });

    render(<AirportSelector onSelect={onSelect} />);

    await waitFor(() => {
      expect(screen.getByText(/Dallas/i)).toBeInTheDocument();
    });
  });

  it('should allow searching for airports', async () => {
    const onSelect = vi.fn();
    render(<AirportSelector onSelect={onSelect} />);

    const searchButton = screen.getByText(/Choose different/i);
    fireEvent.click(searchButton);

    const input = screen.getByPlaceholderText(/Search airports/i);
    fireEvent.change(input, { target: { value: 'austin' } });

    await waitFor(() => {
      expect(screen.getByText(/AUS/)).toBeInTheDocument();
    });
  });

  it('should call onSelect when airport chosen', async () => {
    const onSelect = vi.fn();
    render(<AirportSelector onSelect={onSelect} selectedAirport={null} />);

    const searchButton = screen.getByText(/Choose different/i);
    fireEvent.click(searchButton);

    const input = screen.getByPlaceholderText(/Search airports/i);
    fireEvent.change(input, { target: { value: 'DFW' } });

    await waitFor(() => {
      const option = screen.getByText(/Dallas\/Fort Worth/);
      fireEvent.click(option);
    });

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ iataCode: 'DFW' })
    );
  });
});
```

**Step 2: Implement AirportSelector component**

Create `frontend/src/components/planner/AirportSelector.tsx`:

```tsx
'use client';

import { useState, useEffect } from 'react';
import { searchAirports, findNearestAirport, Airport } from '@/lib/airports';

interface AirportSelectorProps {
  selectedAirport: Airport | null;
  onSelect: (airport: Airport) => void;
}

export function AirportSelector({ selectedAirport, onSelect }: AirportSelectorProps) {
  const [detectedAirport, setDetectedAirport] = useState<Airport | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Airport[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const nearest = findNearestAirport(
            position.coords.latitude,
            position.coords.longitude
          );
          setDetectedAirport(nearest);
          setIsLoading(false);
        },
        () => {
          setIsLoading(false);
        }
      );
    } else {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (searchQuery.length >= 2) {
      setSearchResults(searchAirports(searchQuery));
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  if (selectedAirport) {
    return (
      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
        <div>
          <p className="font-medium">
            {selectedAirport.name} ({selectedAirport.iataCode})
          </p>
          <p className="text-sm text-gray-600">
            {selectedAirport.city}, {selectedAirport.country}
          </p>
        </div>
        <button
          onClick={() => setIsSearching(true)}
          className="text-blue-600 hover:underline text-sm"
        >
          Change
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
      </div>
    );
  }

  if (isSearching) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg">
        <input
          type="text"
          placeholder="Search airports..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full p-2 border rounded mb-2"
          autoFocus
        />
        {searchResults.length > 0 && (
          <ul className="max-h-48 overflow-y-auto">
            {searchResults.map((airport) => (
              <li
                key={airport.iataCode}
                onClick={() => {
                  onSelect(airport);
                  setIsSearching(false);
                  setSearchQuery('');
                }}
                className="p-2 hover:bg-gray-100 cursor-pointer rounded"
              >
                <span className="font-medium">{airport.name}</span>
                <span className="text-gray-500 ml-2">({airport.iataCode})</span>
                <p className="text-sm text-gray-600">
                  {airport.city}, {airport.country}
                </p>
              </li>
            ))}
          </ul>
        )}
        <button
          onClick={() => setIsSearching(false)}
          className="mt-2 text-gray-600 text-sm"
        >
          Cancel
        </button>
      </div>
    );
  }

  if (detectedAirport) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg">
        <p className="text-sm text-gray-600 mb-2">Based on your location:</p>
        <p className="font-medium">
          {detectedAirport.name} ({detectedAirport.iataCode})
        </p>
        <p className="text-sm text-gray-600 mb-3">
          {detectedAirport.city}, {detectedAirport.country}
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => onSelect(detectedAirport)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Use {detectedAirport.iataCode}
          </button>
          <button
            onClick={() => setIsSearching(true)}
            className="px-4 py-2 border rounded hover:bg-gray-100"
          >
            Choose different
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-gray-50 rounded-lg">
      <p className="text-gray-600 mb-2">Select your home airport:</p>
      <button
        onClick={() => setIsSearching(true)}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Search airports
      </button>
    </div>
  );
}
```

**Step 3: Run tests**

Run: `cd frontend && npm test -- AirportSelector`
Expected: PASS

**Step 4: Commit**

```bash
git add frontend/src/components/planner/AirportSelector.tsx frontend/src/__tests__/components/AirportSelector.test.tsx
git commit -m "feat(ui): add AirportSelector component with geolocation"
```

---

## Phase 5: Frontend - WebSocket & Price Display

### Task 5.1: Create WebSocket Hook

**Files:**
- Create: `frontend/src/hooks/useFlightPriceSocket.ts`
- Create: `frontend/src/__tests__/hooks/useFlightPriceSocket.test.ts`

(Implementation details follow same TDD pattern)

---

### Task 5.2: Update PlannedTournamentCard with Flight Prices

**Files:**
- Modify: `frontend/src/components/planner/PlannedTournamentCard.tsx`
- Modify: `frontend/src/stores/plannerStore.ts`

(Implementation details follow same TDD pattern)

---

### Task 5.3: Add Travel Override Modal

**Files:**
- Create: `frontend/src/components/planner/TravelOverrideModal.tsx`

(Implementation details follow same TDD pattern)

---

## Phase 6: API Endpoints

### Task 6.1: Add Flight Prices API Endpoint

**Files:**
- Create: `backend/src/handlers/flightPrices.ts`
- Modify: `backend/template.yaml` (add route)

(Implementation details follow same TDD pattern)

---

### Task 6.2: Add Airport Selection API Endpoint

**Files:**
- Create: `backend/src/handlers/airports.ts`
- Modify: `backend/template.yaml` (add route)

(Implementation details follow same TDD pattern - triggers EventBridge event)

---

## Phase 7: Integration & Testing

### Task 7.1: End-to-End Integration Test

**Files:**
- Create: `backend/src/__tests__/integration/flightPrices.integration.test.ts`

(Full flow test: select airport → EventBridge → SQS → Lambda → DynamoDB → WebSocket)

---

### Task 7.2: Frontend Integration Test

**Files:**
- Create: `frontend/src/__tests__/integration/flightPrices.test.tsx`

(Test planner with mocked flight prices)

---

## Deployment Checklist

- [ ] Add `AMADEUS_API_KEY` and `AMADEUS_API_SECRET` to AWS Secrets Manager
- [ ] Deploy backend: `sam build && sam deploy --parameter-overrides AmadeusApiKey=xxx AmadeusApiSecret=xxx`
- [ ] Add `NEXT_PUBLIC_WEBSOCKET_URL` to Vercel environment variables
- [ ] Deploy frontend (auto via git push)
- [ ] Verify WebSocket connection in browser console
- [ ] Test new airport flow end-to-end
- [ ] Monitor CloudWatch logs for Lambda errors
- [ ] Check DynamoDB for cached flight prices
