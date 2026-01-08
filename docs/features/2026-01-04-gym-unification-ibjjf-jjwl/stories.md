# Stories: Gym Unification (IBJJF + JJWL)

**Date:** 2026-01-04
**Total:** 8 stories
**Ready for upload:** Yes

## Dependency Graph

```
Story 1: Add data model types
    ↓
Story 2: Add master gym DB queries ← blocked by Story 1
    ↓
Story 3: Add pending match DB queries ← blocked by Story 1
    ↓
Story 4: Add fuzzy matching service ← blocked by Story 2, Story 3
    ↓
Story 5: Integrate matching into sync ← blocked by Story 4
    ↓
Story 6: Add admin API endpoints ← blocked by Story 2, Story 3
    ↓
Story 7: Add user gym search API ← blocked by Story 2
    ↓
Story 8: Wire admin UI to API ← blocked by Story 6

Story 9: Add masterGymId to athlete (parallel, blocked by Story 1)
```

## Stories

---

### Story 1: Add MasterGym and PendingMatch data types

**Summary**
Add TypeScript types and DynamoDB key builders for master gym and pending match entities.

**Acceptance Criteria**
- [ ] `MasterGymItem` interface defined with all fields (id, canonicalName, city, country, address, website, timestamps)
- [ ] `PendingMatchItem` interface defined with all fields (gym IDs, names, confidence, signals, status)
- [ ] `MatchSignals` interface defined (nameSimilarity, cityBoost, affiliationBoost)
- [ ] Key builders `buildMasterGymPK` and `buildPendingMatchPK` added
- [ ] `DynamoDBItem` union type updated
- [ ] TypeScript compiles without errors

**Technical Notes**
- Add to `backend/src/db/types.ts`
- Master gym PK pattern: `MASTERGYM#{uuid}`
- Pending match PK pattern: `PENDINGMATCH#{uuid}`
- GSI1 patterns: `MASTERGYMS` for gym search, `PENDINGMATCHES` with status prefix for filtering

**Test Approach**
Run `npx tsc --noEmit` to verify compilation.

**Dependencies**
- Blocked by: None
- Blocks: Story 2, Story 3, Story 9

**Suggested Labels**
`backend`, `database`

---

### Story 2: Add master gym database queries

**Summary**
Implement CRUD operations for master gym entities in DynamoDB.

**Acceptance Criteria**
- [ ] `createMasterGym()` creates master gym with UUID, returns item
- [ ] `getMasterGym()` retrieves by ID, returns null if not found
- [ ] `searchMasterGyms()` searches by name prefix via GSI1
- [ ] `linkSourceGymToMaster()` updates source gym's masterGymId
- [ ] `unlinkSourceGymFromMaster()` clears source gym's masterGymId
- [ ] All functions have unit tests with mocked DynamoDB

**Technical Notes**
- Create `backend/src/db/masterGymQueries.ts`
- Create `backend/src/__tests__/db/masterGymQueries.test.ts`
- Use existing patterns from `gymQueries.ts`
- UUID generated via `crypto.randomUUID()`

**Test Approach**
Mock `docClient.send()` and verify correct commands are sent.

**Dependencies**
- Blocked by: Story 1
- Blocks: Story 4, Story 6, Story 7

**Suggested Labels**
`backend`, `database`, `testing`

---

### Story 3: Add pending match database queries

**Summary**
Implement CRUD operations for pending match entities in DynamoDB.

**Acceptance Criteria**
- [ ] `createPendingMatch()` creates pending match with UUID
- [ ] `getPendingMatch()` retrieves by ID
- [ ] `listPendingMatches()` lists by status (pending/approved/rejected) via GSI1
- [ ] `updatePendingMatchStatus()` updates status and reviewedAt timestamp
- [ ] `findExistingPendingMatch()` checks for duplicate pending matches
- [ ] All functions have unit tests

**Technical Notes**
- Create `backend/src/db/pendingMatchQueries.ts`
- Create `backend/src/__tests__/db/pendingMatchQueries.test.ts`
- GSI1SK format: `{status}#{createdAt}` for sorting by date within status

**Test Approach**
Mock `docClient.send()` and verify correct commands.

**Dependencies**
- Blocked by: Story 1
- Blocks: Story 4, Story 6

**Suggested Labels**
`backend`, `database`, `testing`

---

### Story 4: Add fuzzy matching service

**Summary**
Implement gym name fuzzy matching with Levenshtein distance, city boost, and affiliation detection.

**Acceptance Criteria**
- [ ] `normalizeGymName()` removes suffixes (BJJ, Academy, etc), lowercases, collapses whitespace
- [ ] `calculateNameSimilarity()` returns 0-100 score using Levenshtein distance
- [ ] `calculateMatchScore()` combines name similarity + city boost (+15) + affiliation boost (+10)
- [ ] `findMatchesForGym()` finds all candidates above 70% threshold
- [ ] `processGymMatches()` auto-links ≥90%, creates pending for 70-89%
- [ ] Known affiliations list includes major orgs (Gracie Barra, Alliance, Atos, etc)
- [ ] All functions have unit tests

**Technical Notes**
- Create `backend/src/services/gymMatchingService.ts`
- Create `backend/src/__tests__/services/gymMatchingService.test.ts`
- City boost applies when IBJJF city appears in JJWL gym name
- Affiliation boost applies when both names contain same major affiliation

**Test Approach**
Test normalization, similarity scoring, and match logic with various gym name pairs.

**Dependencies**
- Blocked by: Story 2, Story 3
- Blocks: Story 5

**Suggested Labels**
`backend`, `testing`

---

### Story 5: Integrate matching into gym sync

**Summary**
Run fuzzy matching during gym sync to auto-link and create pending matches.

**Acceptance Criteria**
- [ ] `syncJJWLGyms()` runs matching for new/unlinked gyms after upsert
- [ ] `syncIBJJFGyms()` runs matching for new/unlinked gyms after upsert
- [ ] Matching only runs for gyms without existing masterGymId
- [ ] Auto-linked count and pending count logged
- [ ] Sync remains idempotent (safe to re-run)
- [ ] Integration tests verify matching is called

**Technical Notes**
- Modify `backend/src/services/gymSyncService.ts`
- Update `backend/src/__tests__/services/gymSyncService.test.ts`
- Import `processGymMatches` from gymMatchingService
- Loop through synced gyms and process matches for unlinked ones

**Test Approach**
Mock `processGymMatches` and verify it's called with correct arguments during sync.

**Dependencies**
- Blocked by: Story 4
- Blocks: None

**Suggested Labels**
`backend`, `testing`

---

### Story 6: Add admin API endpoints for match review

**Summary**
Create Lambda endpoints for listing, approving, and rejecting pending matches.

**Acceptance Criteria**
- [ ] `GET /admin/pending-matches?status=pending` lists matches by status
- [ ] `POST /admin/pending-matches/{id}/approve` creates master gym and links both source gyms
- [ ] `POST /admin/pending-matches/{id}/reject` marks match as rejected
- [ ] `POST /admin/master-gyms/{id}/unlink` unlinks a source gym from master
- [ ] All endpoints return proper CORS headers
- [ ] SAM template updated with AdminMatchesFunction
- [ ] Handler has unit tests

**Technical Notes**
- Create `backend/src/handlers/adminMatches.ts`
- Create `backend/src/__tests__/handlers/adminMatches.test.ts`
- Add to `backend/template.yaml`
- Initially allow all users (TODO: add proper admin check later)

**Test Approach**
Mock DB queries and verify correct responses for each endpoint.

**Dependencies**
- Blocked by: Story 2, Story 3
- Blocks: Story 8

**Suggested Labels**
`backend`, `api`, `testing`

---

### Story 7: Add user gym search API

**Summary**
Create public API endpoint for searching master gyms with their linked source IDs.

**Acceptance Criteria**
- [ ] `GET /gyms/search?q=query` searches master gyms by name prefix
- [ ] Response includes canonical name, city, country, and linked source IDs
- [ ] `GET /gyms/{id}` retrieves single master gym
- [ ] Minimum query length of 2 characters enforced
- [ ] SAM template updated with MasterGymsFunction

**Technical Notes**
- Create `backend/src/handlers/masterGyms.ts`
- Add to `backend/template.yaml`
- Response format includes `sources: { IBJJF: string | null, JJWL: string | null }`

**Test Approach**
Mock DB queries and verify search results format.

**Dependencies**
- Blocked by: Story 2
- Blocks: None

**Suggested Labels**
`backend`, `api`

---

### Story 8: Wire admin UI to API

**Summary**
Connect the existing admin UI components to the real API endpoints.

**Acceptance Criteria**
- [ ] TanStack Query hook `useAdminMatches()` fetches matches by status
- [ ] `useApproveMatch()` mutation calls approve endpoint
- [ ] `useRejectMatch()` mutation calls reject endpoint
- [ ] Query invalidation on successful mutations
- [ ] `GymMatchesPage` uses real data instead of sample data
- [ ] Loading and error states handled
- [ ] Frontend builds successfully

**Technical Notes**
- Create `frontend/src/hooks/useAdminMatches.ts`
- Update `frontend/src/components/admin/GymMatchesPage.tsx`
- Remove sample data, use hooks for real data

**Test Approach**
Verify frontend build passes and manual test in browser.

**Dependencies**
- Blocked by: Story 6
- Blocks: None

**Suggested Labels**
`frontend`

---

### Story 9: Add masterGymId to athlete entity

**Summary**
Extend athlete entity to link athletes to master gyms.

**Acceptance Criteria**
- [ ] `AthleteItem` interface includes `masterGymId: string | null`
- [ ] POST `/athletes` accepts `masterGymId` in body
- [ ] PUT `/athletes/{id}` can update `masterGymId`
- [ ] TypeScript compiles without errors

**Technical Notes**
- Modify `backend/src/db/types.ts`
- Modify `backend/src/handlers/athletes.ts`
- Add to create and update logic

**Test Approach**
Verify existing athlete tests still pass, add test for masterGymId handling.

**Dependencies**
- Blocked by: Story 1
- Blocks: None (can run in parallel after Story 1)

**Suggested Labels**
`backend`, `database`

---

## Summary

| # | Title | Labels | Blocked By |
|---|-------|--------|------------|
| 1 | Add data model types | backend, database | None |
| 2 | Add master gym DB queries | backend, database, testing | 1 |
| 3 | Add pending match DB queries | backend, database, testing | 1 |
| 4 | Add fuzzy matching service | backend, testing | 2, 3 |
| 5 | Integrate matching into sync | backend, testing | 4 |
| 6 | Add admin API endpoints | backend, api, testing | 2, 3 |
| 7 | Add user gym search API | backend, api | 2 |
| 8 | Wire admin UI to API | frontend | 6 |
| 9 | Add masterGymId to athlete | backend, database | 1 |

---

## Linear Upload

**Uploaded:** 2026-01-04T23:17:00Z
**Parent:** [ODE-33](https://linear.app/odell/issue/ODE-33/feature-gym-unification-ibjjf-jjwl)

| Story | Issue | Title | Blocked By |
|-------|-------|-------|------------|
| 1 | [ODE-34](https://linear.app/odell/issue/ODE-34) | Add MasterGym and PendingMatch data types | - |
| 2 | [ODE-35](https://linear.app/odell/issue/ODE-35) | Add master gym database queries | ODE-34 |
| 3 | [ODE-36](https://linear.app/odell/issue/ODE-36) | Add pending match database queries | ODE-34 |
| 4 | [ODE-37](https://linear.app/odell/issue/ODE-37) | Add fuzzy matching service | ODE-35, ODE-36 |
| 5 | [ODE-38](https://linear.app/odell/issue/ODE-38) | Integrate matching into gym sync | ODE-37 |
| 6 | [ODE-39](https://linear.app/odell/issue/ODE-39) | Add admin API endpoints for match review | ODE-35, ODE-36 |
| 7 | [ODE-40](https://linear.app/odell/issue/ODE-40) | Add user gym search API | ODE-35 |
| 8 | [ODE-41](https://linear.app/odell/issue/ODE-41) | Wire admin UI to API | ODE-39 |
| 9 | [ODE-42](https://linear.app/odell/issue/ODE-42) | Add masterGymId to athlete entity | ODE-34 |
