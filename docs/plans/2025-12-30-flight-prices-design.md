# Flight Price Integration Design

**Date:** 2025-12-30
**Status:** Draft

---

## Overview & Goals

### Problem

The current planner uses crude distance-based flight estimates ($200-$600 based on mileage). Real flight prices vary significantly by route, season, and availability. Paid users need accurate travel costs for budget planning.

### Goals

1. Provide real flight prices from Amadeus API for paid users
2. Cache prices efficiently to minimize API costs
3. Support real-time price fetching when new users join
4. Clean UX with transparent pricing sources

### Non-Goals

- Flight booking (just estimates for planning)
- Hotel/accommodation pricing (future feature)
- International currency conversion (USD only for now)

### Feature Gating

| Tier | Experience |
|------|------------|
| Free | Drive costs only (IRS mileage). Flight prices show "Upgrade for flight prices" |
| Paid | Real Amadeus prices with detailed tooltips |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FLIGHT PRICE SYSTEM                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                        DAILY CRON FLOW                               │    │
│  │                                                                      │    │
│  │  EventBridge ────▶ SQS ────▶ FlightPriceLambda ────▶ DynamoDB       │    │
│  │  (schedule:                  │                                       │    │
│  │   cron 4am UTC)              ▼                                       │    │
│  │                         Amadeus API                                  │    │
│  │                                                                      │    │
│  │  Logic:                                                              │    │
│  │  1. Get all known user airports from DynamoDB                       │    │
│  │  2. Get all tournaments with expired/missing prices                 │    │
│  │  3. Filter: only tournaments outside drive range                    │    │
│  │  4. Apply Smart TTL: skip if cache still valid                      │    │
│  │  5. Fetch from Amadeus, store results                               │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                     NEW AIRPORT FLOW (Real-time)                    │    │
│  │                                                                      │    │
│  │  Frontend                         Backend                            │    │
│  │  ────────                         ───────                            │    │
│  │                                                                      │    │
│  │  1. Page load ──────────────────▶ Connect WebSocket                 │    │
│  │     (establish WS connection)     Store connectionId in DynamoDB    │    │
│  │                                                                      │    │
│  │  2. User selects airport ───────▶ POST /api/airports                │    │
│  │     { airport: "DFW" }            │                                  │    │
│  │                                   ▼                                  │    │
│  │                              EventBridge                             │    │
│  │                              { type: "airport.added",                │    │
│  │                                airport: "DFW",                       │    │
│  │                                userId: "..." }                       │    │
│  │                                   │                                  │    │
│  │                                   ▼                                  │    │
│  │                                  SQS                                 │    │
│  │                                   │                                  │    │
│  │                                   ▼                                  │    │
│  │                           FlightPriceLambda                          │    │
│  │                           - Fetch all tournament prices for DFW     │    │
│  │                           - Store in DynamoDB                        │    │
│  │                           - Lookup WS connectionId by userId        │    │
│  │                                   │                                  │    │
│  │                                   ▼                                  │    │
│  │  3. WebSocket receives ◀──────── API Gateway WebSocket push         │    │
│  │     { type: "prices_ready",       { type: "prices_ready",           │    │
│  │       airport: "DFW" }              airport: "DFW" }                │    │
│  │                                                                      │    │
│  │  4. Frontend fetches ───────────▶ GET /api/flight-prices?airport=DFW│    │
│  │     and displays prices                                              │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Components

| Component | Purpose |
|-----------|---------|
| EventBridge | Scheduling (daily cron) + event routing (airport.added) |
| SQS | Reliable message delivery with retries and DLQ |
| FlightPriceLambda | Fetches from Amadeus, stores in DynamoDB, pushes via WebSocket |
| API Gateway WebSocket | Real-time push to frontend when prices ready |
| DynamoDB | Flight price cache + WebSocket connection tracking |

---

## Data Model

### DynamoDB Entities

**Flight Price Cache**

```
PK: FLIGHT#{originAirport}#{destinationCity}
SK: {tournamentStartDate}

Attributes:
  price: number              # e.g., 287
  currency: "USD"
  airline: string | null     # e.g., "American" (if Amadeus returns it)
  fetchedAt: string          # ISO timestamp
  expiresAt: string          # ISO timestamp (Smart TTL)
  source: "amadeus" | "estimated_range"
  rangeMin: number | null    # if source = estimated_range
  rangeMax: number | null    # if source = estimated_range
  ttl: number                # DynamoDB TTL for auto-cleanup
```

**WebSocket Connections**

```
PK: WSCONN#{connectionId}
SK: META

Attributes:
  userId: string
  airport: string | null     # which airport they're waiting on
  connectedAt: string
  ttl: number                # auto-expire after 24hrs
```

**Known Airports (for daily cron)**

```
PK: AIRPORT#{iataCode}
SK: META
GSI1PK: AIRPORTS
GSI1SK: {iataCode}

Attributes:
  iataCode: string           # e.g., "DFW"
  userCount: number          # how many users have this as home
  lastFetchedAt: string
  createdAt: string
```

### Smart TTL Logic

```typescript
function calculateExpiry(tournamentDate: Date): Date {
  const daysUntil = differenceInDays(tournamentDate, new Date());

  if (daysUntil < 30) return addHours(new Date(), 24);   // 24hr cache
  if (daysUntil < 90) return addDays(new Date(), 3);     // 3 day cache
  return addDays(new Date(), 7);                          // 7 day cache
}
```

---

## Amadeus Integration

### API Setup

**Endpoint:** `https://api.amadeus.com/v2/shopping/flight-offers`

**Authentication:** OAuth2 client credentials flow

```
POST https://api.amadeus.com/v1/security/oauth2/token
grant_type=client_credentials
client_id={AMADEUS_API_KEY}
client_secret={AMADEUS_API_SECRET}
```

### Flight Search Request

```typescript
interface AmadeusSearchParams {
  originLocationCode: string;      // "DFW"
  destinationLocationCode: string; // "MIA"
  departureDate: string;           // day before tournament start
  returnDate: string;              // day after tournament end
  adults: 1;                       // single traveler baseline
  currencyCode: "USD";
  max: 1;                          // just need cheapest option
}
```

### Destination Airport Resolution

Tournaments have city names, Amadeus needs airport codes:

```typescript
function getDestinationAirport(tournament: Tournament): string | null {
  // 1. Try exact city match in static airport dataset
  const match = airports.find(a =>
    a.city.toLowerCase() === tournament.city.toLowerCase()
  );
  if (match) return match.iataCode;

  // 2. Try nearest airport by lat/lng (if tournament geocoded)
  if (tournament.lat && tournament.lng) {
    return findNearestAirport(tournament.lat, tournament.lng);
  }

  // 3. No airport found - mark as unfetchable
  return null;
}
```

### When to Skip Flight Lookup

```typescript
function shouldFetchFlightPrice(
  homeAirport: Airport,
  tournament: Tournament,
  maxDriveHours: number
): boolean {
  const distance = calculateDistance(
    homeAirport.lat, homeAirport.lng,
    tournament.lat, tournament.lng
  );
  const driveHours = distance / 60;

  if (maxDriveHours === 0) {
    // User only flies - skip same city only
    return tournament.city !== homeAirport.city;
  }

  // Only fetch if outside drive range
  return driveHours > maxDriveHours;
}
```

---

## Fallback Pricing

When Amadeus returns no results or errors, show a price range based on similar routes.

### Fallback Logic

```typescript
async function getFlightPrice(
  origin: string,
  destination: string,
  tournamentDate: string
): Promise<FlightPrice> {
  // 1. Try Amadeus
  const amadeusPrice = await fetchFromAmadeus(origin, destination, tournamentDate);
  if (amadeusPrice) {
    return {
      price: amadeusPrice.price,
      source: "amadeus",
      airline: amadeusPrice.airline
    };
  }

  // 2. Calculate range from similar routes
  const range = await calculateRangeFromSimilarRoutes(origin, destination);
  if (range) {
    return {
      source: "estimated_range",
      rangeMin: range.min,
      rangeMax: range.max
    };
  }

  // 3. Last resort: distance-based estimate
  const distance = getDistanceBetweenAirports(origin, destination);
  return {
    source: "estimated_range",
    rangeMin: estimateByDistance(distance, 0.8),
    rangeMax: estimateByDistance(distance, 1.2)
  };
}
```

### Similar Routes Calculation

```typescript
async function calculateRangeFromSimilarRoutes(
  origin: string,
  destination: string
): Promise<{ min: number; max: number } | null> {
  const destAirport = getAirport(destination);
  const originAirport = getAirport(origin);
  const targetDistance = getDistance(originAirport, destAirport);

  // Query cached prices for similar routes
  const similarPrices = await db.query({
    // Same origin to similar distance destinations
    // OR similar distance origins to same destination
    filter: (route) => {
      const routeDistance = getRouteDistance(route);
      return Math.abs(routeDistance - targetDistance) < 500; // +/- 500 miles
    }
  });

  if (similarPrices.length < 3) return null;

  // 10th and 90th percentile
  const sorted = similarPrices.sort((a, b) => a.price - b.price);
  return {
    min: sorted[Math.floor(sorted.length * 0.1)].price,
    max: sorted[Math.floor(sorted.length * 0.9)].price
  };
}
```

---

## Airport Selection UX

### Static Airport Dataset

Use OpenFlights data trimmed to commercial airports (~3,000 airports):

```typescript
interface Airport {
  iataCode: string;      // "DFW"
  name: string;          // "Dallas/Fort Worth International"
  city: string;          // "Dallas"
  country: string;       // "United States"
  lat: number;
  lng: number;
}

// Bundled as JSON, ~300KB after trimming
import airports from '@/data/airports.json';
```

### Selection Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  AIRPORT SELECTION                                              │
│                                                                  │
│  Step 1: Auto-detect on page load                               │
│  ┌─────────────────────────────────────────┐                    │
│  │  Based on your location:                │                    │
│  │                                         │                    │
│  │    Dallas/Fort Worth (DFW)              │                    │
│  │    23 miles away                        │                    │
│  │                                         │                    │
│  │    [Use DFW]    [Choose different]      │                    │
│  └─────────────────────────────────────────┘                    │
│                                                                  │
│  Step 2: If user clicks "Choose different"                      │
│  ┌─────────────────────────────────────────┐                    │
│  │  Search airports                        │                    │
│  │ ┌─────────────────────────────────┐     │                    │
│  │ │ aus                             │     │                    │
│  │ └─────────────────────────────────┘     │                    │
│  │                                         │                    │
│  │   Austin-Bergstrom (AUS)                │                    │
│  │   Austin, United States                 │                    │
│  │                                         │                    │
│  │   Melbourne (AUS)                       │                    │
│  │   Melbourne, Australia                  │                    │
│  │                                         │                    │
│  └─────────────────────────────────────────┘                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Search Implementation

```typescript
function searchAirports(query: string): Airport[] {
  const q = query.toLowerCase().trim();
  if (q.length < 2) return [];

  return airports
    .filter(a =>
      a.iataCode.toLowerCase().includes(q) ||
      a.city.toLowerCase().includes(q) ||
      a.name.toLowerCase().includes(q)
    )
    .slice(0, 10); // Limit results
}

function findNearestAirport(lat: number, lng: number): Airport {
  return airports.reduce((nearest, airport) => {
    const dist = calculateDistance(lat, lng, airport.lat, airport.lng);
    return dist < nearest.distance
      ? { airport, distance: dist }
      : nearest;
  }, { airport: airports[0], distance: Infinity }).airport;
}
```

---

## Planner UI Integration

### PlannedTournament Type Updates

```typescript
interface PlannedTournament {
  tournament: Tournament;
  registrationCost: number;
  travelCost: number;
  travelType: 'drive' | 'fly';
  isLocked: boolean;
  // New fields
  flightPrice?: {
    price: number;
    source: 'amadeus' | 'estimated_range';
    rangeMin?: number;
    rangeMax?: number;
    airline?: string;
    fetchedAt: string;
    route: { origin: string; destination: string };
  };
}
```

### Display States

**Paid User - Real Price**

```
┌─────────────────────────────────────────────────────────────────┐
│  Miami Open - Jan 18-19                                         │
│  IBJJF - Miami, FL                                              │
│                                                                  │
│  [plane] $287                 [tag] $120                        │
│     ───────                        ─────                         │
│     hover tooltip:                 Registration                  │
│     ┌─────────────────────┐                                     │
│     │ DFW -> MIA          │                                     │
│     │ American Airlines   │                                     │
│     │ Checked Dec 30      │                                     │
│     │ Prices vary by date │                                     │
│     └─────────────────────┘                                     │
│                                                    Total: $407  │
│  [Change to drive v]                                            │
└─────────────────────────────────────────────────────────────────┘
```

**Paid User - Range Estimate**

```
┌─────────────────────────────────────────────────────────────────┐
│  Pan Championship - March 15-16                                 │
│  IBJJF - Kissimmee, FL                                          │
│                                                                  │
│  [plane] $350-$500          [tag] $150                          │
│     ─────────                                                    │
│     "Typically" badge                                            │
│     hover: "Based on similar routes"                            │
│                                                    Total: ~$575 │
└─────────────────────────────────────────────────────────────────┘
```

**Paid User - Drive**

```
┌─────────────────────────────────────────────────────────────────┐
│  Houston Open - Feb 8-9                                         │
│  JJWL - Houston, TX                                             │
│                                                                  │
│  [car] $214                  [tag] $80                          │
│     ─────                                                        │
│     240 mi round trip                                            │
│                                                    Total: $294  │
│  [Change to fly v]                                              │
└─────────────────────────────────────────────────────────────────┘
```

**Free User - Flight Gated**

```
┌─────────────────────────────────────────────────────────────────┐
│  World Championship - May 29-June 1                             │
│  IBJJF - Las Vegas, NV                                          │
│                                                                  │
│  [plane] Upgrade for flight prices    [tag] $200                │
│     ─────────────────────────                                    │
│     [See pricing ->]                                             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Override Modal

```
┌─────────────────────────────────────────────────────────────────┐
│  Change travel type                                      [x]    │
│                                                                  │
│  Miami Open - Jan 18-19                                         │
│                                                                  │
│  ( ) Fly - $287 (checked price)                                 │
│  ( ) Drive - $428 (640 mi x $0.67 x 2)                         │
│  ( ) Custom amount: [________]                                  │
│                                                                  │
│                                    [Cancel]  [Save]             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Summary of Decisions

| Decision | Choice |
|----------|--------|
| Data source | Amadeus API |
| Flight dates | Day before start -> day after end |
| Architecture | Hybrid: daily cron + on-demand for new airports |
| Messaging | EventBridge -> SQS -> Lambda |
| Real-time updates | API Gateway WebSocket |
| Airport selection | Geolocation + autocomplete (static dataset) |
| Fallback pricing | Range from similar routes |
| UI display | Price with tooltip details |
| Drive/fly logic | Based on maxDriveHours, user can override |
| When to fetch | Only outside drive range |
| Cache TTL | Smart: 24hr/3d/7d based on tournament proximity |
| Feature gating | Paid only (free sees drive costs, no flight prices) |
