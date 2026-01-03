# JJWL Gym Sync Design

**Date:** 2026-01-03
**Status:** Approved
**Scope:** Backend only (UI is a separate story)

## Overview

Enable roster lookup for tournaments by syncing gym data from JJWL. Users can link their athlete profile to a gym, then see which teammates are registered for upcoming tournaments.

### Primary Use Case

1. User sets their gym (e.g., "Pablo Silva BJJ")
2. User views a tournament (e.g., "JJWL Houston Open")
3. App shows "12 athletes from your gym are registered" with the roster

## Data Model

### SourceGym

Raw gym data from each source (JJWL now, IBJJF later).

```
PK: SRCGYM#{org}#{externalId}    e.g., SRCGYM#JJWL#5713
SK: META
GSI1PK: GYMS
GSI1SK: {org}#{name}             e.g., JJWL#Pablo Silva BJJ

Fields:
- org: "JJWL" | "IBJJF"
- externalId: string             // Original ID for API callbacks
- name: string
- masterGymId: string | null     // Future: links to canonical gym
- createdAt: string
- updatedAt: string
```

**Access patterns:**
- List all gyms by org: Query GSI1PK=`GYMS`, SK begins_with `{org}#`
- Search gyms: Query GSI1PK=`GYMS`, SK begins_with `{org}#{searchTerm}`
- Get gym by ID: GetItem PK=`SRCGYM#{org}#{id}`, SK=`META`

### TournamentGymRoster

Cached athlete list for a gym at a tournament.

```
PK: TOURN#{org}#{tournamentId}   // Same pattern as TournamentItem
SK: GYMROSTER#{gymExternalId}

Fields:
- gymExternalId: string
- gymName: string                // Denormalized for display
- athletes: Array<{
    name: string
    belt: string
    ageDiv: string
    weight: string
    gender: string
  }>
- athleteCount: number
- fetchedAt: string
```

**Access patterns:**
- Get roster for gym at tournament: GetItem
- Get all gym rosters for a tournament: Query PK, SK begins_with `GYMROSTER`

### AthleteItem Changes

Add gym fields to existing athlete schema:

```typescript
// New fields on AthleteItem
gymSourceId: string | null;  // e.g., "JJWL#5713"
gymName: string | null;      // Denormalized: "Pablo Silva BJJ"
```

## External APIs

### JJWL Gym List

```
GET https://www.jjworldleague.com/style2020_ajax/lists/gyms.php

Headers:
- accept: application/json
- x-requested-with: XMLHttpRequest

Response: Array<{ id: string, name: string }>
```

### JJWL Tournament Roster

```
POST https://www.jjworldleague.com/pages/hermes_ajax/events_competitors_list.php

Body (form-encoded):
- event_id: number
- academy_id: number

Response: DataTables format with athlete records
```

## Sync Architecture

### Gym Sync (Daily)

1. Fetch all gyms from JJWL API (simple HTTP, no browser)
2. Upsert to SourceGym table
3. Log count of new/updated gyms

### Roster Sync (Daily)

1. Query all AthleteItems to collect unique `gymSourceId` values
2. Query upcoming tournaments (next 60 days)
3. For each (gym, tournament) pair:
   - Fetch roster from JJWL API
   - Upsert to TournamentGymRoster
4. Log sync stats

**Design decision:** Scan athletes on-demand rather than tracking "active gyms" separately. Simpler, and scales fine for <1000 athletes.

## New Files

```
backend/src/
├── fetchers/
│   ├── jjwlGymFetcher.ts       # Fetch all gyms from JJWL
│   └── jjwlRosterFetcher.ts    # Fetch roster for gym+tournament
├── db/
│   ├── types.ts                # Add SourceGymItem, TournamentGymRosterItem
│   └── gymQueries.ts           # CRUD for gyms & rosters
├── handlers/
│   └── gyms.ts                 # API endpoints
└── services/
    └── gymSyncService.ts       # Orchestrates sync jobs
```

## API Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/gyms` | Public | Search gyms (query: `search`, `org`) |
| GET | `/gyms/:org/:externalId` | Public | Get gym details |
| GET | `/tournaments/:id/roster/:gymId` | Public | Get cached roster |

## Future Considerations

### Cross-Source Gym Matching (Not in scope)

The schema supports linking gyms across sources via `masterGymId`:

```
SourceGym (JJWL#5713) → masterGymId → MasterGym (canonical)
SourceGym (IBJJF#999) → masterGymId → MasterGym (same canonical)
```

Implementation deferred. For now, each SourceGym stands alone.

### IBJJF Integration (Separate ticket)

Same pattern applies:
1. Create `ibjjfGymFetcher.ts`
2. Sync to SourceGym with `org: "IBJJF"`
3. Roster fetcher for IBJJF events

## Out of Scope

- Frontend UI (separate story)
- IBJJF gym sync (separate ticket)
- Cross-source gym matching logic
- Push notifications for new registrations
