# Filter Redesign Design

## Overview

Redesign the tournament filter system to be distance-based, mobile-friendly, and optimized for parents quickly finding nearby tournaments for their kids.

## Key Decisions

| Decision | Choice |
|----------|--------|
| Primary filter | Distance-based ("show me what's nearby") |
| Location input | "Near me" button + manual zip/city input |
| Distance selection | Preset buttons: 50mi, 100mi, 250mi, Any |
| Date filtering | Preset buttons: This Month, 30 Days, 60 Days, 90 Days, This Year |
| Format filters | Keep GI/NOGI/Kids as equal toggles |
| Text search | Remove entirely |
| Geocoding provider | Google Maps API |
| Geocoding strategy | Venue cache table to avoid re-geocoding |
| Low-confidence handling | Flag for admin review via CLI script |
| MVP approach | Ship everything together |

## Filter UI Layout

Mobile-first filter bar:

```
┌─────────────────────────────────────────────────┐
│  📍 Near me    [Dallas, TX]          ← Location │
│                                                 │
│  [50mi] [100mi] [250mi] [Any ✓]     ← Distance  │
│                                                 │
│  [This Month] [30 Days ✓] [60] [90] [Year]      │
│                                                 │
│  [GI] [NOGI] [Kids]  |  [IBJJF] [JJWL] ← Format │
│                                                 │
│                              [Clear Filters]    │
└─────────────────────────────────────────────────┘
```

**Behavior:**
- "Near me" button requests geolocation, shows city name when granted
- Manual input: tap location text to open zip/city input modal
- Distance buttons disabled until location is set
- "Any" distance = no location filter (shows all tournaments)
- All selections persist to URL params for shareability
- Location persists to localStorage across sessions

## Data Model Changes

### Tournament (updated)

```typescript
interface Tournament {
  // ... existing fields ...

  // New geocoding fields
  lat: number | null;
  lng: number | null;
  geocodeConfidence: 'high' | 'low' | 'failed' | null;
  venueId: string | null;  // FK to venue cache
}
```

### Venue (new table)

```typescript
interface Venue {
  id: string;
  name: string;           // "Memphis Cook Convention Center"
  city: string;           // "Memphis"
  country: string | null; // "USA"
  lat: number;
  lng: number;
  geocodeConfidence: 'high' | 'low';
  manualOverride: boolean; // true if admin corrected
  createdAt: string;
}
```

### DynamoDB Schema

**Venue table:**
- PK: `VENUE#${id}`
- SK: `VENUE#${id}`
- GSI1PK: `VENUE_LOOKUP`
- GSI1SK: `${normalizedName}#${normalizedCity}`

## Backend API Changes

### Updated Query Parameters

```typescript
interface TournamentQueryParams {
  // Existing
  org?: 'IBJJF' | 'JJWL';
  gi?: boolean;
  nogi?: boolean;
  kids?: boolean;
  startAfter?: string;   // ISO date
  startBefore?: string;  // ISO date

  // New - location filtering
  lat?: number;          // User's latitude
  lng?: number;          // User's longitude
  radiusMiles?: number;  // 50, 100, 250

  // Removed
  // search - no longer needed
  // city - replaced by lat/lng
}
```

### Distance Calculation

Use Haversine formula, post-filter in Lambda:
- Fetch all tournaments for date range
- Calculate distance for each
- Filter by radius
- Sort by distance ascending

This approach works for ~500 tournaments (<50ms). Optimize with geohash if dataset grows significantly.

### Response Addition

```typescript
interface TournamentResponse {
  // ... existing fields ...
  distanceMiles?: number;  // Calculated when lat/lng provided
}
```

## Geocoding Integration

### Geocoder Service

```typescript
// backend/src/services/geocoder.ts
interface GeocodeResult {
  lat: number;
  lng: number;
  confidence: 'high' | 'low';
  formattedAddress: string;
}

async function geocodeVenue(
  venue: string,
  city: string,
  country: string | null
): Promise<GeocodeResult | null>
```

### Confidence Scoring

- `high`: Single result with `location_type` = `ROOFTOP` or `RANGE_INTERPOLATED`
- `low`: Multiple results, `APPROXIMATE` location, or country mismatch
- `failed`: No results or API error

### Sync Flow

1. Fetch tournaments from IBJJF/JJWL (existing)
2. For each tournament:
   - Build venue key: `${venue}|${city}`
   - Check venue cache in DynamoDB
   - If cache miss → geocode → store in venue cache
   - Link tournament to venue, copy lat/lng
3. Write tournaments to DB (existing)
4. Log summary: "Geocoded 12 new venues, 3 low confidence"

### Cost Control

- Only geocode new venues (not seen before)
- ~500 tournaments but ~100 unique venues
- First sync: ~$0.50, subsequent syncs: pennies

## Frontend Implementation

### Filter State

```typescript
const [location, setLocation] = useState<{
  lat: number;
  lng: number;
  label: string;  // "Dallas, TX" or "Near me"
} | null>(null);

const [distance, setDistance] = useState<50 | 100 | 250 | 'any'>('any');
const [dateRange, setDateRange] = useState<'month' | '30' | '60' | '90' | 'year'>('30');
```

### Location Handling

- "Near me" → `navigator.geolocation.getCurrentPosition()`
- On success → reverse geocode for display label
- Manual input → modal with zip/city → forward geocode
- Persist to localStorage

### URL Sync

All filter state syncs to URL params:
```
?lat=32.7&lng=-96.8&d=100&date=30&gi=1
```

Enables sharing and bookmarking filtered views.

### Component Structure

```tsx
<FilterSection label="Location">
  <NearMeButton />
  <LocationDisplay onClick={openLocationModal} />
</FilterSection>

<FilterSection label="Distance">
  <PresetButtons values={[50, 100, 250, 'any']} />
</FilterSection>

<FilterSection label="Date">
  <PresetButtons values={['month', '30', '60', '90', 'year']} />
</FilterSection>

<FilterSection label="Format">
  <ToggleGroup values={['gi', 'nogi', 'kids']} />
  <Divider />
  <ToggleGroup values={['IBJJF', 'JJWL']} />
</FilterSection>
```

## Admin Review (CLI)

Script to review low-confidence geocodes:

```bash
npm run admin:review-venues
```

Features:
- Lists venues with `geocodeConfidence: 'low'`
- Shows geocoded location on map (opens browser)
- Prompts for confirmation or manual lat/lng entry
- Updates venue with `manualOverride: true`

## Implementation Order

### Phase 1: Backend Foundation
1. Add Google Maps API key to environment/secrets
2. Create venue cache table in DynamoDB
3. Build geocoder service (`backend/src/services/geocoder.ts`)
4. Update sync handler to geocode new venues
5. Add lat/lng fields to tournament records
6. Run initial sync to populate geocode data

### Phase 2: API Updates
1. Add `lat`, `lng`, `radiusMiles` query params to handler
2. Implement Haversine distance calculation
3. Add `distanceMiles` to response
4. Sort by distance when location filter active
5. Update date filtering for "This Year" option

### Phase 3: Frontend
1. Remove text search from filter component
2. Build location input (Near Me + manual)
3. Build distance preset buttons
4. Build date preset buttons (including This Year)
5. Sync all filter state to URL params
6. Persist location to localStorage

### Phase 4: Admin Tooling
1. CLI script to list low-confidence venues
2. CLI commands to confirm/edit venues

## Files to Modify

### Backend
- `backend/src/handlers/sync.ts` - Add geocoding to sync flow
- `backend/src/handlers/tournaments.ts` - Add distance filtering
- `backend/src/services/geocoder.ts` - New file
- `backend/src/db/venueCache.ts` - New file
- `backend/scripts/review-venues.ts` - New admin script

### Frontend
- `frontend/src/components/tournaments/TournamentFilters.tsx` - Complete rewrite
- `frontend/src/components/tournaments/LocationInput.tsx` - New component
- `frontend/src/lib/types.ts` - Update interfaces
- `frontend/src/hooks/useGeolocation.ts` - New hook
- `frontend/src/hooks/useFilterParams.ts` - New hook for URL sync
