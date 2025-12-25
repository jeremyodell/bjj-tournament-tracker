# Filter Redesign Exploration

## Context

We're redesigning the tournament filter UI for the BJJ Tournament Tracker. The app helps parents find BJJ tournaments for their kids.

## Current State

**Frontend:** Next.js + Tailwind + React Query with infinite scroll
- Filters: Org (IBJJF/JJWL), Format (GI/NOGI/KIDS), Text search
- Text search input has INP performance issues (200ms+ blocking on focus)
- Filters trigger server-side queries (not client-side filtering)

**Backend Data Available:**
```typescript
interface Tournament {
  org: 'IBJJF' | 'JJWL';
  city: string;           // e.g., "Memphis"
  country: string | null; // e.g., "USA" (from IBJJF only)
  startDate: string;
  endDate: string;
  gi: boolean;
  nogi: boolean;
  kids: boolean;
  // NO state field currently
}
```

## The Problem

Users want to filter by:
- **State** (e.g., "Show me tournaments in Texas") - NOT AVAILABLE
- **Distance** (e.g., "Within 100 miles of me") - Would need lat/lng
- **Country**
- **Date range**
- **Format** (GI/NOGI/Kids/Adults)

**State data is missing** because:
- IBJJF calendar API returns only city + country, no state
- IBJJF event DETAIL pages DO have full address (street, city, state, zip)
- No event details API exists - would need to scrape each event page
- JJWL has even less data (city only, no country)

## Options to Get State Data

### Option 1: Enrich on Sync
- When sync Lambda runs, fetch each event's detail page via Puppeteer
- Extract full address from HTML
- Store state in database
- **Pros:** Complete data, one-time cost per event
- **Cons:** Slow sync (~10-15 min for 500 events), more scraping complexity

### Option 2: Lazy Enrichment
- Store basic data from calendar API
- When user views event detail, fetch and cache full address on-demand
- **Pros:** Fast sync, only fetches what's needed
- **Cons:** State not available for filtering until viewed, poor UX

### Option 3: Geocoding
- Use Google Maps / Mapbox API to convert "Memphis" → "Memphis, TN, USA"
- Add lat/lng for distance-based filtering
- **Pros:** Fast, enables "within X miles" feature, works for both orgs
- **Cons:** API costs (~$5/1000 requests), may have accuracy issues

### Option 4: Hybrid
- Geocode for MVP (quick win, enables distance filtering)
- Add full address scraping later as enhancement
- **Pros:** Ship something fast, iterate
- **Cons:** Two systems to maintain

## Filter UX Options

### Option A: Toggle-Only (No Text Search)
- Remove text search entirely (fixes INP issue)
- Use pill/button toggles for all filters
- Country dropdown, State dropdown (if US), Date range picker
- **Pros:** Fast, mobile-friendly, no typing needed
- **Cons:** Less flexible

### Option B: Smart Filters with Dropdowns
- Country → State cascading dropdowns
- Date range picker (next 30/60/90 days or custom)
- Format toggles (GI/NOGI/KIDS)
- Org toggles (IBJJF/JJWL)
- **Pros:** Precise filtering, familiar UX
- **Cons:** More UI complexity

### Option C: Location-First with Distance
- "Near me" button or location input
- Distance slider (25/50/100/250 miles)
- Date and format as secondary filters
- **Pros:** Most useful for parents, modern UX
- **Cons:** Requires geocoding, location permissions

### Option D: Chatbot/Conversational
- "Find me a kids GI tournament in Texas in January"
- AI parses intent and applies filters
- **Pros:** Natural, flexible
- **Cons:** Complex to build, unpredictable

## Questions to Explore

1. **Data strategy:** Which option for getting state/location data? (Scraping vs Geocoding vs Hybrid)

2. **Filter UX:** Which filter approach fits the parent use case best?

3. **MVP scope:** What's the minimum viable filter set to ship first?

4. **Backend support:** Does the backend currently support all these filter params? Need to verify.

5. **JJWL gap:** JJWL has less data - how do we handle mixed data quality?

## Files to Reference

- `frontend/src/components/tournaments/TournamentFilters.tsx` - Current filter UI
- `frontend/src/lib/types.ts` - Current data types
- `backend/src/fetchers/ibjjfFetcher.ts` - IBJJF data fetching
- `backend/src/fetchers/jjwlFetcher.ts` - JJWL data fetching
- `backend/src/fetchers/types.ts` - Backend data types

## Next Steps

1. Decide on data enrichment strategy (state/geocoding)
2. Design the new filter UI based on chosen data
3. Update backend to support new filter params
4. Implement frontend filter components
5. Test with real data
