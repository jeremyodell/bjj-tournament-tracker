# Design: Gym Unification (IBJJF + JJWL)

**Date:** 2026-01-04
**Original idea:** Tie IBJJF and JJWL gyms together with our own ID and common name, allowing cross-org gym lookups.

## Overview

Unify gyms from IBJJF and JJWL into a single master gym entity. This enables:
- User gym lookup regardless of which org they compete in
- Cross-org statistics (gym performance across both orgs)
- Roster consolidation (see all athletes from a gym)

## Data Model

### Master Gym Entity

```
PK: MASTERGYM#{uuid}
SK: META
GSI1PK: MASTERGYMS
GSI1SK: {canonicalName}
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | UUID we generate |
| `canonicalName` | string | Display name (initially from highest-confidence source) |
| `country` | string \| null | From IBJJF if available |
| `city` | string \| null | From IBJJF if available |
| `address` | string \| null | From IBJJF if available |
| `website` | string \| null | From IBJJF if available |
| `createdAt` | string | ISO timestamp |
| `updatedAt` | string | ISO timestamp |

### Source Gym Updates

The existing `SourceGymItem` already has `masterGymId: string | null`. This field gets populated when a match is confirmed (auto or manual).

### Pending Match Entity

```
PK: PENDINGMATCH#{uuid}
SK: META
GSI1PK: PENDINGMATCHES
GSI1SK: {status}#{createdAt}
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | UUID |
| `ibjjfGymId` | string | IBJJF external ID |
| `jjwlGymId` | string | JJWL external ID |
| `ibjjfGymName` | string | For display without extra lookup |
| `jjwlGymName` | string | For display without extra lookup |
| `confidence` | number | 0-100 score |
| `matchSignals` | object | What triggered the match (name similarity, city match, etc.) |
| `status` | string | `pending` / `approved` / `rejected` |
| `createdAt` | string | ISO timestamp |
| `reviewedAt` | string \| null | When admin reviewed |

## Matching Algorithm

### Fuzzy Matching Strategy

When a new gym is synced (from either org), run the matcher:

1. **Normalize names** - Lowercase, remove common suffixes ("BJJ", "Brazilian Jiu-Jitsu", "Academy", "Team"), collapse whitespace

2. **Calculate name similarity** - Use Levenshtein distance or Jaro-Winkler to get base score (0-100)

3. **Apply city boost** - If IBJJF gym's city appears in the JJWL gym name (e.g., "Orlando" in "GB Orlando"), boost score by 15 points

4. **Apply common affiliation boost** - If both names contain the same major affiliation ("Gracie Barra", "Alliance", "Atos", "CheckMat"), boost score by 10 points

### Confidence Tiers

| Score | Action |
|-------|--------|
| ≥90 | Auto-link: Create master gym (if none exists), link both sources |
| 70-89 | Suggest: Create pending match for admin review |
| <70 | Ignore: No match stored |

### Matching Direction

- When syncing IBJJF gyms: For each new IBJJF gym, search existing JJWL gyms for matches
- When syncing JJWL gyms: For each new JJWL gym, search existing IBJJF gyms for matches
- If a source gym already has a `masterGymId`, skip matching (already linked)

## Sync Integration

### Updated Sync Flow

```
1. Fetch gyms from source (IBJJF or JJWL)
2. Upsert source gyms to DynamoDB (existing)
3. For each upserted gym without masterGymId:
   a. Run fuzzy matcher against opposite org's gyms
   b. If score ≥90: auto-link (create/use master gym)
   c. If score 70-89: create pending match
   d. If score <70: leave unlinked
4. Update sync metadata (existing)
```

### New Service: `gymMatchingService.ts`

| Function | Description |
|----------|-------------|
| `findMatches(gym, targetOrg)` | Returns array of `{gym, score, signals}` |
| `autoLinkGyms(gym1, gym2)` | Creates master gym, updates both source gyms |
| `createPendingMatch(ibjjfGym, jjwlGym, score, signals)` | Stores suggestion for review |
| `approvePendingMatch(matchId)` | Admin approves → creates link |
| `rejectPendingMatch(matchId)` | Admin rejects → marks rejected |

### Performance

With ~3,000 IBJJF gyms and ~500 JJWL gyms:
- Load all gyms from target org into memory during sync
- Pre-normalize names once
- Run matching in batch (not per-gym API calls)
- Expected overhead: <5 seconds per sync

## Admin UI

### Route: `/admin/gym-matches`

Protected admin page with three tabs:

| Tab | Content |
|-----|---------|
| **Pending** | Matches awaiting review (70-89% confidence) |
| **Auto-linked** | Recently auto-linked gyms (≥90%) for audit |
| **Rejected** | Previously rejected matches (for reference) |

### Pending Match Card

```
┌─────────────────────────────────────────────────────┐
│  IBJJF: Gracie Barra Orlando                        │
│  📍 Orlando, FL, USA                                │
│                                                     │
│  ↔️  85% match                                      │
│                                                     │
│  JJWL: GB Orlando                                   │
│                                                     │
│  Signals: name_similarity: 82, city_boost: +15      │
│                                                     │
│  [✓ Approve]  [✗ Reject]  [🔍 View Gyms]            │
└─────────────────────────────────────────────────────┘
```

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/admin/pending-matches` | GET | List pending matches (paginated) |
| `/admin/pending-matches/{id}/approve` | POST | Approve and link |
| `/admin/pending-matches/{id}/reject` | POST | Reject match |
| `/admin/master-gyms` | GET | List master gyms with linked sources |
| `/admin/master-gyms/{id}` | PUT | Update canonical name/details |

### Auth

Requires admin role. Initially: check user ID against hardcoded admin list. Later: add `isAdmin` flag to user profile.

## Consuming Unified Gym Data

### User Gym Selection

When a user searches for their gym:

```
GET /gyms/search?q=gracie+barra+orlando
```

Returns master gyms with linked source IDs:

```json
{
  "id": "master-gym-uuid",
  "canonicalName": "Gracie Barra Orlando",
  "city": "Orlando",
  "country": "USA",
  "sources": {
    "IBJJF": "12345",
    "JJWL": "678"
  }
}
```

### Athlete → Gym Linking

Add to `AthleteItem`:

| Field | Type | Description |
|-------|------|-------------|
| `masterGymId` | string \| null | Links to unified gym |

### Future Capabilities

With athletes linked to master gyms:
- Count athletes per gym across both orgs
- Show gym tournament participation across IBJJF + JJWL
- Build gym leaderboards
- Roster consolidation: group athletes by master gym in tournament views
