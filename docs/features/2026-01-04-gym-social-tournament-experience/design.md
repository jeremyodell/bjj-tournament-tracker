# Design: Gym Social Tournament Experience

**Date:** 2026-01-04
**Original idea:** Enhance UI/UX for viewing tournaments, seeing gym teammates registered, with future support for bracket notifications and live updates.

---

## Scope

This design covers **Phase 1: Gym Social Features** - enabling athletes to see which teammates from their gym are registered at tournaments.

Future phases (not in this design):
- Bracket publication notifications
- Live match updates during tournaments

---

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Roster data strategy | Hybrid caching | Fetch on-demand, cache 24h, daily background sync for upcoming tournaments |
| Info shown | Full details | Name + division (belt, age, weight) so users know who's in their bracket |
| UI placement | Badge + inline + detail | At-a-glance counts, quick peek, and full detail view |
| Gym association | User-level setting | One gym per account, changeable anytime |
| Gym selection | Search autocomplete | Query both JJWL + IBJJF orgs, user picks from results |
| Missing gym | Must be in list | No manual entry; gym must be registered with JJWL/IBJJF |
| Onboarding | During planner setup | Capture gym early as part of "sales pitch" |
| Background sync window | 60 days | Sync rosters for tournaments within 60 days |

---

## Data Model

### User Profile Extension

Add gym fields to `UserProfileItem`:

```typescript
export interface UserProfileItem {
  // ... existing fields
  gymSourceId: string | null;  // e.g., "JJWL#5713" or "IBJJF#12345"
  gymName: string | null;      // Denormalized for display
}
```

### Roster Caching (existing)

`TournamentGymRosterItem` already exists:

```typescript
export interface TournamentGymRosterItem {
  PK: string;           // TOURN#{org}#{tournamentId}
  SK: string;           // GYMROSTER#{gymExternalId}
  gymExternalId: string;
  gymName: string;
  athletes: Array<{
    name: string;
    belt: string;
    ageDiv: string;
    weight: string;
    gender: string;
  }>;
  athleteCount: number;
  fetchedAt: string;
}
```

---

## API Endpoints

### New Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/gyms/search` | GET | Search gyms across JJWL + IBJJF |
| `/profile/gym` | PUT | Set user's gym |
| `/tournaments/{id}/roster` | GET | Get cached roster for user's gym |
| `/tournaments/{id}/roster/refresh` | POST | Force refresh roster from source |

### Gym Search

```
GET /gyms/search?q=gracie+barra

Response:
{
  "results": [
    { "gymSourceId": "JJWL#5713", "name": "Gracie Barra Austin", "org": "JJWL", "city": "Austin, TX" },
    { "gymSourceId": "IBJJF#12345", "name": "Gracie Barra Round Rock", "org": "IBJJF", "city": "Round Rock, TX" }
  ]
}
```

### Set User Gym

```
PUT /profile/gym
{
  "gymSourceId": "JJWL#5713",
  "gymName": "Gracie Barra Austin"
}
```

### Get Tournament Roster

```
GET /tournaments/IBJJF/austin-open-2026/roster

Response:
{
  "gymName": "Gracie Barra Austin",
  "athleteCount": 5,
  "fetchedAt": "2026-01-04T10:00:00Z",
  "athletes": [
    { "name": "Tommy Smith", "belt": "Yellow", "ageDiv": "Kids", "weight": "Rooster", "gender": "M" },
    { "name": "Sarah Martinez", "belt": "White", "ageDiv": "Kids", "weight": "Light", "gender": "F" },
    { "name": "Marcus Johnson", "belt": "Purple", "ageDiv": "Adult", "weight": "Medium", "gender": "M" }
  ]
}
```

### Roster Fetch Logic

```
1. Check cache (TournamentGymRosterItem)
2. If fresh (< 24 hours), return cached data
3. If stale or missing, fetch from JJWL/IBJJF API
4. Store in cache, return to client
```

---

## Frontend Components

### Tournament Card Badge

On browse view, show teammate count for logged-in users with a gym:

```
┌─────────────────────────────────────┐
│  IBJJF Austin Open                  │
│  Jan 25, 2026 • Austin, TX          │
│                                     │
│  [Gi] [NoGi] [Kids]                 │
│                                     │
│  ┌──────────────────┐               │
│  │ 👥 5 teammates   │  ← clickable  │
│  └──────────────────┘               │
└─────────────────────────────────────┘
```

### Inline Expansion

Clicking badge expands teammate list (first 3 + "View all"):

```
┌─────────────────────────────────────┐
│  IBJJF Austin Open                  │
│  ...                                │
│  ┌──────────────────┐               │
│  │ 👥 5 teammates ▼ │               │
│  └──────────────────┘               │
│  ┌─────────────────────────────────┐│
│  │ Tommy S. • Yellow • Kids Rooster││
│  │ Sarah M. • White • Kids Light   ││
│  │ Marcus J. • Purple • Adult Med  ││
│  │ +2 more → View all              ││
│  └─────────────────────────────────┘│
└─────────────────────────────────────┘
```

### Tournament Detail Page

**Route:** `/tournaments/[org]/[id]`

```
┌────────────────────────────────────────────────────┐
│  ← Back to tournaments                             │
│                                                    │
│  IBJJF Austin International Open                   │
│  January 25-26, 2026                               │
│  Austin Convention Center, Austin, TX              │
│                                                    │
│  [Gi] [NoGi] [Kids]     [Register →]               │
│                                                    │
├────────────────────────────────────────────────────┤
│                                                    │
│  👥 Gracie Barra Austin (5 athletes)    [Refresh]  │
│                                                    │
│  KIDS GI                                           │
│  ├─ Tommy Smith • Yellow • Rooster                 │
│  └─ Sarah Martinez • White • Light                 │
│                                                    │
│  ADULT NOGI                                        │
│  ├─ Marcus Johnson • Purple • Medium               │
│  ├─ Alex Chen • Blue • Light                       │
│  └─ Jordan Lee • White • Heavy                     │
│                                                    │
│  Last updated: 2 hours ago                         │
│                                                    │
└────────────────────────────────────────────────────┘
```

### Gym Selection (Onboarding)

Step in planner flow after athlete info:

```
┌────────────────────────────────────────────────────┐
│  Step 3 of 4: Select Your Gym                      │
│                                                    │
│  See which teammates are competing at tournaments  │
│                                                    │
│  ┌──────────────────────────────────────────────┐  │
│  │ 🔍 Search for your gym...                    │  │
│  └──────────────────────────────────────────────┘  │
│                                                    │
│  ┌──────────────────────────────────────────────┐  │
│  │ Gracie Barra Austin          JJWL            │  │
│  │ Austin, TX                                   │  │
│  ├──────────────────────────────────────────────┤  │
│  │ Gracie Barra Round Rock      IBJJF           │  │
│  │ Round Rock, TX                               │  │
│  └──────────────────────────────────────────────┘  │
│                                                    │
│  ℹ️ Gym not listed? It must be registered with     │
│     JJWL or IBJJF to appear here.                  │
│                                                    │
│  [Skip for now]                    [Continue →]    │
│                                                    │
└────────────────────────────────────────────────────┘
```

### Profile Settings

"My Gym" section with current gym display and change option.

---

## Background Sync

### Daily Cron Job

**Trigger:** EventBridge rule, daily at 3am UTC

**Logic:**
1. Find tournaments within next 60 days
2. Find users with wishlisted tournaments in that window
3. Get unique (tournament, gym) pairs from those users
4. For each pair, fetch roster from JJWL/IBJJF API
5. Update `TournamentGymRosterItem` cache

**Rate Limiting:**
- Process in batches
- Respect JJWL/IBJJF API rate limits
- Queue requests if needed

---

## Caching Strategy

| Scenario | Behavior |
|----------|----------|
| User views tournament, no cache | Fetch from API, cache, return |
| User views tournament, cache < 24h | Return cached data |
| User views tournament, cache > 24h | Return stale data, trigger background refresh |
| User clicks "Refresh" | Force fetch from API, update cache |

---

## Edge Cases & Error Handling

### No Gym Set
- Badge doesn't appear on tournament cards
- Tournament detail page shows: "Select your gym to see teammates" with link to profile

### Gym Has No Athletes at Tournament
- Badge doesn't appear (count = 0)
- Detail page shows: "No teammates from [Gym Name] registered yet"

### API Fetch Fails
- Return stale cached data if available
- Show "Couldn't refresh roster" toast with retry option
- If no cache exists, show "Roster unavailable" message

### User's Gym Not in Source Org for Tournament
- JJWL tournament but user's gym is IBJJF-only
- Show: "Roster not available for this tournament org"

### Rate Limiting
- Queue refresh requests if hitting API limits
- Show: "Refresh queued, check back shortly"

---

## UI/UX Design Details

### Design System Integration

Follow the existing "Midnight Arena" design system:
- **Background:** Pure black `#000000` with subtle noise texture
- **Surfaces:** Glassmorphism `rgba(255,255,255,0.03)` with backdrop blur
- **Borders:** `rgba(255,255,255,0.08)`
- **Typography:** Satoshi variable font
- **Accents:** IBJJF = `#00F0FF` (cyan), JJWL = `#FF2D6A` (magenta), Gold = `#d4af37`

### UI/UX Decisions

| Element | Decision |
|---------|----------|
| **Badge color** | Org-colored (IBJJF = cyan, JJWL = magenta) - matches tournament card accent |
| **Belt indicators** | Full realistic palette: white, blue, purple, brown, black (adults) + yellow, orange, green, grey (kids) |
| **Detail page layout** | Hero header with large banner |
| **Expansion animation** | Slide down (pushes content below) |
| **Empty state (0 teammates)** | Hide badge entirely - no visual noise |
| **Gym search ordering** | By master gym name (not org-specific) |
| **Refresh behavior** | Inline loading - spinner replaces button, stale data stays visible |
| **Timestamps** | Relative format ("2 hours ago") |
| **Skip gym in onboarding** | Remind later - contextual prompt on first tournament view |
| **Mobile badge position** | Same as desktop - below event type tags |
| **Hero header style** | Banner image if available, org-colored gradient fallback |

### Belt Color Palette

```
Adult Belts:
- White:  #e5e5e5
- Blue:   #3b82f6
- Purple: #a855f7
- Brown:  #92400e
- Black:  #1f1f1f

Kids Belts:
- White:  #e5e5e5
- Yellow: #fbbf24
- Orange: #f97316
- Green:  #22c55e
- Grey:   #6b7280
```

### Tournament Detail Page - Hero Header

```
┌────────────────────────────────────────────────────────────────┐
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│ ░░░░░░░░░░░░░░░░ TOURNAMENT BANNER IMAGE ░░░░░░░░░░░░░░░░░░░░░ │
│ ░░░░░░░░░░░░░░░░ (or gradient fallback)  ░░░░░░░░░░░░░░░░░░░░░ │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ← Back                                                        │
│                                                                │
│  ┌────────┐                                                    │
│  │  JAN   │  IBJJF Austin International Open                   │
│  │   25   │  Austin Convention Center, Austin, TX              │
│  │  SAT   │                                                    │
│  └────────┘  [Gi] [NoGi] [Kids]         [Register →]           │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### Teammate Badge States

**With teammates (org-colored):**
```
IBJJF tournament:  ┌─────────────────┐
                   │ 👥 5 teammates ▼│  ← cyan border/text (#00F0FF)
                   └─────────────────┘

JJWL tournament:   ┌─────────────────┐
                   │ 👥 3 teammates ▼│  ← magenta border/text (#FF2D6A)
                   └─────────────────┘
```

**Zero teammates:** Badge hidden entirely

**No gym set:** Badge hidden, contextual reminder on first tournament view

### Onboarding Skip Flow

1. User clicks "Skip for now" on gym selection step
2. User continues through onboarding normally
3. First time user views a tournament (browse or detail):
   - Show subtle inline prompt: "Add your gym to see which teammates are competing"
   - Link to profile settings
   - Dismissable (don't show again after dismissed)

---

## Components to Build

### Backend
1. Gym search endpoint (query both orgs by master gym name)
2. Profile gym update endpoint
3. Tournament roster fetch endpoint (with caching)
4. Roster refresh endpoint
5. Daily roster sync Lambda

### Frontend
1. Gym search autocomplete component
2. Onboarding gym selection step
3. Tournament card teammate badge (org-colored)
4. Inline teammate expansion (slide-down animation)
5. Tournament detail page with hero header (`/tournaments/[org]/[id]`)
6. Profile gym settings section
7. "Add gym" reminder prompt (for users who skipped)

### Infrastructure
1. EventBridge rule for daily sync
2. Roster sync Lambda handler
