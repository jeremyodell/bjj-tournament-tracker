# Stories: Gym Social Tournament Experience

**Date:** 2026-01-04
**Total:** 12 stories
**Ready for upload:** Yes

---

## Dependency Graph

```
Story 1: Cross-Org Gym Search API
    ↓
Story 3: Gym Search Hook & API Client ← blocked by Story 1
    ↓
    ├─→ Story 4: GymSearchAutocomplete ← blocked by Story 3
    │       ↓
    │       ├─→ Story 9: Onboarding Gym Selection ← blocked by Story 2, Story 4
    │       └─→ Story 10: Profile Gym Settings ← blocked by Story 2, Story 4
    │
    └─→ Story 5: Gym Roster Hook ← blocked by Story 3
            ↓
            └─→ Story 6: TeammatesBadge ← blocked by Story 5
                    ↓
                    ├─→ Story 7: TournamentCard Integration ← blocked by Story 6
                    └─→ Story 8: Tournament Detail Page ← blocked by Story 5, Story 6

Story 2: Athlete Gym Fields (parallel with Story 1)
    ↓
    ├─→ Story 9: Onboarding Gym Selection
    └─→ Story 10: Profile Gym Settings

Story 11: Daily Roster Sync Lambda (no dependencies - can run in parallel)

Story 12: Polish & Integration Testing ← blocked by all others
```

**Parallelization opportunities:**
- Stories 1, 2, 11 can start immediately (no blockers)
- Stories 9, 10 can be worked in parallel once Story 4 completes

---

## Stories

### Story 1: Cross-Org Gym Search API

#### Summary
Add backend support for searching gyms across both JJWL and IBJJF orgs simultaneously.

#### Acceptance Criteria
- [ ] `searchGymsAcrossOrgs()` query function searches both orgs in parallel
- [ ] Results combined, sorted by name, limited to 20
- [ ] `GET /gyms?search=X` (no org param) uses cross-org search
- [ ] Unit tests pass for new query and handler logic

#### Technical Notes
- Add `searchGymsAcrossOrgs()` to `backend/src/db/gymQueries.ts`
- Update `backend/src/handlers/gyms.ts` to detect missing `org` param
- TDD: Write failing tests first

#### Test Approach
- `npm test -- gymQueries.test.ts` for query
- `npm test -- handlers/gyms.test.ts` for handler

#### Dependencies
- Blocked by: None
- Blocks: Story 3 (Gym Search Hook)

#### Labels
`backend`, `api`, `database`

---

### Story 2: Athlete Gym Fields

#### Summary
Ensure athlete records can store gym association (`gymSourceId`, `gymName`).

#### Acceptance Criteria
- [ ] `createAthlete` accepts `gymSourceId` and `gymName` fields
- [ ] `updateAthlete` can modify gym fields
- [ ] Frontend `Athlete` type includes gym fields
- [ ] Backend tests verify persistence

#### Technical Notes
- Fields may already exist in `AthleteItem` type - verify and add tests
- Update `frontend/src/lib/api.ts` with gym fields on `Athlete` interface

#### Test Approach
- `npm test -- athleteQueries` for backend
- `npm run build` for frontend type verification

#### Dependencies
- Blocked by: None
- Blocks: Story 9 (Onboarding), Story 10 (Profile)

#### Labels
`backend`, `frontend`, `database`

---

### Story 3: Gym Search Hook & API Client

#### Summary
Add frontend API functions and TanStack Query hook for gym search.

#### Acceptance Criteria
- [ ] `searchGyms()` function in `api.ts` calls backend
- [ ] `fetchGymRoster()` function for roster fetching
- [ ] `useGymSearch` hook with 2+ char minimum, 30s cache
- [ ] Empty query returns empty array without API call

#### Technical Notes
- Add `Gym` and `GymRoster` types to `frontend/src/lib/api.ts`
- Create `frontend/src/hooks/useGymSearch.ts`
- TDD: Write hook tests first

#### Test Approach
- `npm test -- useGymSearch` for hook behavior

#### Dependencies
- Blocked by: Story 1 (Cross-Org Search API)
- Blocks: Story 4 (Autocomplete), Story 5 (Roster Hook)

#### Labels
`frontend`, `api`

---

### Story 4: GymSearchAutocomplete Component

#### Summary
Build reusable gym search autocomplete with org badges and selection state.

#### Acceptance Criteria
- [ ] Input shows placeholder "Search for your gym..."
- [ ] Results appear after 2+ characters typed
- [ ] Each result shows gym name, city, org badge (cyan/magenta)
- [ ] Selecting gym calls `onSelect` callback and closes dropdown
- [ ] Selected gym shows as chip with "Change" button

#### Technical Notes
- Create `frontend/src/components/gym/GymSearchAutocomplete.tsx`
- Use `useGymSearch` hook
- Follow "Midnight Arena" design system

#### Test Approach
- `npm test -- GymSearchAutocomplete` with mocked API

#### Dependencies
- Blocked by: Story 3 (Gym Search Hook)
- Blocks: Story 9 (Onboarding), Story 10 (Profile)

#### Labels
`frontend`

---

### Story 5: Gym Roster Hook

#### Summary
Create TanStack Query hook for fetching gym rosters at tournaments.

#### Acceptance Criteria
- [ ] `useGymRoster` hook fetches roster for specific tournament + gym
- [ ] Returns null when no gymExternalId provided
- [ ] 1-hour stale time (server handles 24h staleness)
- [ ] Enabled flag controls fetching

#### Technical Notes
- Create `frontend/src/hooks/useGymRoster.ts`
- Parse `gymSourceId` format: `"JJWL#5713"` → `{ org: "JJWL", externalId: "5713" }`

#### Test Approach
- `npm run build` to verify types

#### Dependencies
- Blocked by: Story 3 (Gym Search Hook - shared api.ts types)
- Blocks: Story 6 (TeammatesBadge), Story 8 (Tournament Detail)

#### Labels
`frontend`, `api`

---

### Story 6: TeammatesBadge Component

#### Summary
Create org-colored badge showing teammate count with inline expansion.

#### Acceptance Criteria
- [ ] Badge hidden when `athleteCount === 0`
- [ ] Shows "N teammate(s)" with org-appropriate color
- [ ] Click expands to show first 3 athletes with belt indicator
- [ ] "+N more" shown when >3 athletes, links to full view
- [ ] IBJJF = cyan (#00F0FF), JJWL = magenta (#FF2D6A)

#### Technical Notes
- Create `frontend/src/components/tournaments/TeammatesBadge.tsx`
- Belt color mapping: white, blue, purple, brown, black, yellow, orange, green, grey
- Slide-down animation on expand

#### Test Approach
- `npm test -- TeammatesBadge` for all states

#### Dependencies
- Blocked by: Story 5 (Gym Roster Hook - uses roster types)
- Blocks: Story 7 (TournamentCard), Story 8 (Tournament Detail)

#### Labels
`frontend`

---

### Story 7: TournamentCard Badge Integration

#### Summary
Add TeammatesBadge to tournament cards for logged-in users with gym set.

#### Acceptance Criteria
- [ ] Badge appears when `gymRoster.athleteCount > 0`
- [ ] Badge hidden when no roster or count is 0
- [ ] "View all" links to tournament detail page
- [ ] Positioned after event type tags

#### Technical Notes
- Modify `frontend/src/components/tournaments/TournamentCard.tsx`
- Add `gymRoster` and `onViewRoster` props

#### Test Approach
- `npm run build` to verify integration
- Manual test with seeded data

#### Dependencies
- Blocked by: Story 6 (TeammatesBadge)
- Blocks: None

#### Labels
`frontend`

---

### Story 8: Tournament Detail Page

#### Summary
Create tournament detail page with hero header and gym roster section.

#### Acceptance Criteria
- [ ] Route: `/tournaments/[org]/[id]`
- [ ] Hero shows banner image or org-colored gradient fallback
- [ ] Date block, org badge, location, event type tags, register link
- [ ] Back link returns to tournament list
- [ ] GymRosterSection shows grouped athletes by division
- [ ] Refresh button triggers API call
- [ ] "Updated X ago" timestamp displayed

#### Technical Notes
- Create `frontend/src/app/tournaments/[org]/[id]/page.tsx`
- Create `frontend/src/components/tournaments/TournamentHero.tsx`
- Create `frontend/src/components/tournaments/GymRosterSection.tsx`

#### Test Approach
- `npm run build` to verify page renders
- Manual test navigation and roster display

#### Dependencies
- Blocked by: Story 5 (useGymRoster), Story 6 (TeammatesBadge)
- Blocks: None

#### Labels
`frontend`

---

### Story 9: Onboarding Gym Selection

#### Summary
Add gym selection step to the planner setup flow.

#### Acceptance Criteria
- [ ] Step appears after athlete info, before location
- [ ] GymSearchAutocomplete for selection
- [ ] "Skip for now" button advances without gym
- [ ] Selected gym stored in setupStore
- [ ] Gym persisted to athlete record on account creation

#### Technical Notes
- Create `frontend/src/components/setup/GymSelectionStep.tsx`
- Add `selectedGym`, `skippedGym` fields to `setupStore.ts`
- Modify `QuickSetupForm.tsx` to include gym step

#### Test Approach
- `npm run build` to verify flow
- Manual test skip and selection paths

#### Dependencies
- Blocked by: Story 2 (Athlete Gym Fields), Story 4 (Autocomplete)
- Blocks: None

#### Labels
`frontend`

---

### Story 10: Profile Gym Settings

#### Summary
Add "My Gym" section to profile page for viewing/changing gym.

#### Acceptance Criteria
- [ ] Section shows current gym name and org
- [ ] "Change" button reveals GymSearchAutocomplete
- [ ] Selecting new gym updates athlete record via API
- [ ] Empty state shows search if no gym set

#### Technical Notes
- Modify `frontend/src/app/(protected)/profile/page.tsx`
- Use existing `updateMutation` to persist gym change

#### Test Approach
- Manual test gym change flow
- Verify API call updates athlete

#### Dependencies
- Blocked by: Story 2 (Athlete Gym Fields), Story 4 (Autocomplete)
- Blocks: None

#### Labels
`frontend`

---

### Story 11: Daily Roster Sync Lambda

#### Summary
Background job that pre-fetches rosters for upcoming tournaments.

#### Acceptance Criteria
- [ ] Lambda triggered daily at 3am UTC via EventBridge
- [ ] Syncs rosters for tournaments within 60 days
- [ ] Only syncs (tournament, gym) pairs where users have wishlisted
- [ ] Rate-limited: 10 concurrent requests, 1s delay between batches
- [ ] Logs success/failure counts

#### Technical Notes
- Create `backend/src/handlers/rosterSync.ts`
- Add EventBridge rule in `backend/template.yaml`
- Uses existing `syncGymRoster` service

#### Test Approach
- `npm test -- rosterSync` with mocked dependencies
- Manual invoke to verify behavior

#### Dependencies
- Blocked by: None (uses existing gym sync infrastructure)
- Blocks: None

#### Labels
`backend`, `api`

---

### Story 12: Polish & Integration Testing

#### Summary
Final polish including animations and full E2E verification.

#### Acceptance Criteria
- [ ] Slide-down animation added for badge expansion
- [ ] All backend tests pass
- [ ] All frontend tests pass
- [ ] Frontend build succeeds
- [ ] Manual E2E checklist completed:
  - [ ] Gym search returns results from both JJWL and IBJJF
  - [ ] Tournament card badge appears with correct org color
  - [ ] Badge click expands inline list
  - [ ] Tournament detail page displays correctly
  - [ ] Onboarding gym selection works (select and skip paths)
  - [ ] Profile gym settings allow viewing/changing gym

#### Technical Notes
- Add `@keyframes slideDown` to `globals.css`
- Run full test suites
- Complete manual testing checklist from plan

#### Test Approach
- `cd backend && npm test`
- `cd frontend && npm test`
- `cd frontend && npm run build`
- Manual E2E checklist

#### Dependencies
- Blocked by: All previous stories (1-11)
- Blocks: None

#### Labels
`testing`, `frontend`

---

## Summary

| Label | Count |
|-------|-------|
| frontend | 10 |
| backend | 3 |
| api | 5 |
| database | 2 |
| testing | 1 |

---

## Linear Upload

**Uploaded:** 2026-01-05T01:57:00Z
**Parent:** [ODE-43](https://linear.app/odell/issue/ODE-43/feature-gym-social-tournament-experience)

| Story | Issue | Title | Blocked By |
|-------|-------|-------|------------|
| 1 | [ODE-44](https://linear.app/odell/issue/ODE-44) | Cross-Org Gym Search API | - |
| 2 | [ODE-45](https://linear.app/odell/issue/ODE-45) | Athlete Gym Fields | - |
| 3 | [ODE-47](https://linear.app/odell/issue/ODE-47) | Gym Search Hook & API Client | ODE-44 |
| 4 | [ODE-48](https://linear.app/odell/issue/ODE-48) | GymSearchAutocomplete Component | ODE-47 |
| 5 | [ODE-49](https://linear.app/odell/issue/ODE-49) | Gym Roster Hook | ODE-47 |
| 6 | [ODE-50](https://linear.app/odell/issue/ODE-50) | TeammatesBadge Component | ODE-49 |
| 7 | [ODE-51](https://linear.app/odell/issue/ODE-51) | TournamentCard Badge Integration | ODE-50 |
| 8 | [ODE-52](https://linear.app/odell/issue/ODE-52) | Tournament Detail Page | ODE-49, ODE-50 |
| 9 | [ODE-53](https://linear.app/odell/issue/ODE-53) | Onboarding Gym Selection | ODE-45, ODE-48 |
| 10 | [ODE-54](https://linear.app/odell/issue/ODE-54) | Profile Gym Settings | ODE-45, ODE-48 |
| 11 | [ODE-46](https://linear.app/odell/issue/ODE-46) | Daily Roster Sync Lambda | - |
| 12 | [ODE-55](https://linear.app/odell/issue/ODE-55) | Polish & Integration Testing | All (ODE-44 to ODE-54) |
