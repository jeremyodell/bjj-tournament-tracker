# Stories: IBJJF Gym Data Loading

**Date:** 2026-01-04
**Total:** 9 stories
**Ready for upload:** Yes

## Dependency Graph

```
Story 1: Add IBJJF types and extended schema
    ↓
    ├─→ Story 2: Add gym sync meta queries ← blocked by Story 1
    │       ↓
    ├─→ Story 3: Create IBJJF gym fetcher ← blocked by Story 1
    │       ↓
    └─→ Story 4: Update gym queries for IBJJF fields ← blocked by Story 1, Story 3
            ↓
        Story 5: Create gym sync service ← blocked by Story 2, Story 3, Story 4
            ↓
        ├─→ Story 6: Create gym sync Lambda handler ← blocked by Story 5
        │       ↓
        │   Story 7: Add AWS infrastructure for gym sync ← blocked by Story 6
        │
        └─→ Story 8: Add dev server gym sync route ← blocked by Story 5

Story 9: Integration testing and verification ← blocked by Stories 7, 8
```

## Stories

---

### Story 1: Add IBJJF Types and Extended Schema

#### Summary
Add TypeScript types for IBJJF academy API responses and extend SourceGymItem schema with optional IBJJF-specific fields.

#### Acceptance Criteria
- [ ] IBJJFAcademy and IBJJFAcademiesResponse types added to fetchers/types.ts
- [ ] SourceGymItem extended with optional fields: country, countryCode, city, address, federation, website, responsible
- [ ] GymSyncMetaItem type added for change detection tracking
- [ ] buildGymSyncMetaPK key builder added
- [ ] DynamoDBItem union type updated to include GymSyncMetaItem
- [ ] TypeScript compiles without errors

#### Technical Notes
- Tasks 1-2 from implementation plan
- Fields are optional to maintain JJWL compatibility (JJWL gyms won't have these fields)
- GymSyncMetaItem uses PK pattern: `GYMSYNC#{org}` for per-org sync tracking

#### Test Approach
- Run `npx tsc --noEmit` to verify types compile
- Existing tests should continue to pass

#### Dependencies
- Blocked by: None
- Blocks: Story 2, Story 3, Story 4

#### Suggested Labels
backend, database

---

### Story 2: Add Gym Sync Meta Queries

#### Summary
Implement DynamoDB queries for storing and retrieving gym sync metadata, enabling change detection based on totalRecords.

#### Acceptance Criteria
- [ ] getGymSyncMeta(org) query implemented - returns GymSyncMetaItem or null
- [ ] updateGymSyncMeta(org, totalRecords) upsert implemented - updates lastSyncAt, conditionally updates lastChangeAt
- [ ] Unit tests for both functions pass
- [ ] TypeScript compiles without errors

#### Technical Notes
- Task 3 from implementation plan
- lastChangeAt only updates when totalRecords differs from previous value
- Uses GetCommand and PutCommand from DynamoDB DocumentClient

#### Test Approach
- Unit tests verify null handling for first run
- Unit tests verify record creation and updates
- Integration test with local DynamoDB (optional)

#### Dependencies
- Blocked by: Story 1
- Blocks: Story 5

#### Suggested Labels
backend, database, testing

---

### Story 3: Create IBJJF Gym Fetcher

#### Summary
Implement fetcher to retrieve academy data from IBJJF API with sequential pagination and rate limiting.

#### Acceptance Criteria
- [ ] sanitizeGymName function removes # characters (breaks GSI1SK)
- [ ] mapIBJJFAcademyToGym maps API response to extended normalized gym format
- [ ] parseIBJJFAcademiesResponse validates and parses API response, filters invalid entries
- [ ] fetchIBJJFGymPage fetches single page with correct headers
- [ ] fetchIBJJFGymCount returns totalRecords for change detection
- [ ] fetchAllIBJJFGyms implements sequential pagination with 200ms delay
- [ ] Progress callback supported for monitoring
- [ ] Unit tests for mapping and parsing functions pass

#### Technical Notes
- Task 4 from implementation plan
- IBJJF API requires XMLHttpRequest header to avoid 406 error
- Page size fixed at 20 (cannot be changed)
- ~429 pages, ~8 minutes for full sync
- Continue fetching on page errors (log and skip malformed pages)

#### Test Approach
- Unit tests for sanitizeGymName edge cases
- Unit tests for mapIBJJFAcademyToGym field mapping
- Unit tests for parseIBJJFAcademiesResponse validation/filtering
- Integration test against live API (manual, optional)

#### Dependencies
- Blocked by: Story 1
- Blocks: Story 4, Story 5

#### Suggested Labels
backend, api, testing

---

### Story 4: Update Gym Queries for IBJJF Fields

#### Summary
Extend upsertSourceGym function to handle IBJJF extended fields when inserting/updating gym records.

#### Acceptance Criteria
- [ ] upsertSourceGym accepts both NormalizedGym and IBJJFNormalizedGym
- [ ] Extended IBJJF fields (country, city, etc.) are persisted when present
- [ ] Fields default to null when not provided (JJWL compatibility)
- [ ] TypeScript compiles without errors

#### Technical Notes
- Task 5 from implementation plan
- Uses type assertion to access optional extended fields
- Nullish coalescing (??) to handle undefined fields

#### Test Approach
- Existing gym query tests continue to pass
- TypeScript compilation verifies type compatibility

#### Dependencies
- Blocked by: Story 1, Story 3
- Blocks: Story 5

#### Suggested Labels
backend, database

---

### Story 5: Create Gym Sync Service

#### Summary
Implement business logic for IBJJF gym synchronization with change detection to skip unchanged syncs.

#### Acceptance Criteria
- [ ] syncIBJJFGyms checks totalRecords before full sync
- [ ] Sync skipped when totalRecords unchanged (unless forceSync=true)
- [ ] Full sync fetches all pages and batch upserts to DynamoDB
- [ ] Sync metadata updated after successful sync
- [ ] Error handling returns structured result with error message
- [ ] Unit tests with mocked dependencies pass

#### Technical Notes
- Task 6 from implementation plan
- Returns IBJJFGymSyncResult with skipped, fetched, saved, duration, error fields
- Handles both expected errors (API failures) and unexpected errors

#### Test Approach
- Unit tests mock fetchIBJJFGymCount, fetchAllIBJJFGyms, getGymSyncMeta
- Test skip scenario when totalRecords unchanged
- Test full sync scenario when totalRecords changed
- Test forceSync=true overrides change detection
- Test error handling

#### Dependencies
- Blocked by: Story 2, Story 3, Story 4
- Blocks: Story 6, Story 8

#### Suggested Labels
backend, testing

---

### Story 6: Create Gym Sync Lambda Handler

#### Summary
Create AWS Lambda handler for the gym sync function, invocable by EventBridge schedule or manual trigger.

#### Acceptance Criteria
- [ ] Handler accepts forceSync parameter from event
- [ ] Handler logs requestId, source, and sync results
- [ ] Handler throws on sync error to trigger CloudWatch alarm
- [ ] Returns structured response with success flag and result
- [ ] TypeScript compiles without errors

#### Technical Notes
- Task 7 from implementation plan
- Uses AWS Lambda types: ScheduledEvent, Context
- Error thrown (not caught) to ensure CloudWatch metrics capture failures

#### Test Approach
- TypeScript compilation verifies handler signature
- Integration test via manual invocation (after deployment)

#### Dependencies
- Blocked by: Story 5
- Blocks: Story 7

#### Suggested Labels
backend

---

### Story 7: Add AWS Infrastructure for Gym Sync

#### Summary
Add SAM template resources for gym sync: SNS topic for alerts, Lambda function with EventBridge schedule, and CloudWatch alarm.

#### Acceptance Criteria
- [ ] AlertEmail parameter added (optional)
- [ ] HasAlertEmail condition added
- [ ] AlertsTopic SNS topic created
- [ ] AlertsEmailSubscription conditionally created when email provided
- [ ] GymSyncFunction Lambda with 15-min timeout and 256MB memory
- [ ] WeeklySchedule EventBridge rule (Sunday 6am UTC)
- [ ] GymSyncFunctionErrorAlarm CloudWatch alarm
- [ ] Existing alarms connected to AlertsTopic
- [ ] `sam validate` passes
- [ ] `sam build` succeeds

#### Technical Notes
- Tasks 8, 9, 11 from implementation plan
- Schedule: `cron(0 6 ? * SUN *)` = Sundays at 6:00 AM UTC
- Lambda needs 15-min timeout for ~8 min sync + buffer
- Alarm triggers on >= 1 error in 5-minute period

#### Test Approach
- `sam validate` verifies template syntax
- `sam build` verifies function builds
- Deploy to dev stage and verify resources created

#### Dependencies
- Blocked by: Story 6
- Blocks: Story 9

#### Suggested Labels
backend, infrastructure

---

### Story 8: Add Dev Server Gym Sync Route

#### Summary
Add manual gym sync endpoint to Express dev server for local testing.

#### Acceptance Criteria
- [ ] POST /gym-sync endpoint added to dev-server.ts
- [ ] ?force=true query param triggers forceSync
- [ ] Response includes sync result JSON
- [ ] Error responses return 500 with error message
- [ ] Dev server starts without errors

#### Technical Notes
- Task 10 from implementation plan
- Useful for local development and testing
- No authentication (dev server only)

#### Test Approach
- Start dev server, verify no errors
- Manual curl test: `curl -X POST http://localhost:3001/gym-sync`

#### Dependencies
- Blocked by: Story 5
- Blocks: Story 9

#### Suggested Labels
backend

---

### Story 9: Integration Testing and Verification

#### Summary
Run full test suite, build, and perform end-to-end local testing to verify all components work together.

#### Acceptance Criteria
- [ ] All backend unit tests pass (`npm test`)
- [ ] SAM build succeeds (`sam build`)
- [ ] Dev server starts with DynamoDB
- [ ] Manual gym sync via dev server works
- [ ] Force sync completes successfully (~8 min)
- [ ] IBJJF gyms queryable via /gyms endpoint
- [ ] Any fixes committed

#### Technical Notes
- Task 12 from implementation plan
- Full integration requires local DynamoDB running
- Force sync takes ~8 minutes, optional for CI

#### Test Approach
- Run `npm test` for all unit tests
- Run `sam build` for build verification
- Manual testing via curl commands
- Query verification: `curl "http://localhost:3001/gyms?org=IBJJF&search=10th"`

#### Dependencies
- Blocked by: Story 7, Story 8
- Blocks: None

#### Suggested Labels
testing

---

## Summary

| Story | Title | Labels | Blocked By |
|-------|-------|--------|------------|
| 1 | Add IBJJF types and extended schema | backend, database | None |
| 2 | Add gym sync meta queries | backend, database, testing | 1 |
| 3 | Create IBJJF gym fetcher | backend, api, testing | 1 |
| 4 | Update gym queries for IBJJF fields | backend, database | 1, 3 |
| 5 | Create gym sync service | backend, testing | 2, 3, 4 |
| 6 | Create gym sync Lambda handler | backend | 5 |
| 7 | Add AWS infrastructure for gym sync | backend, infrastructure | 6 |
| 8 | Add dev server gym sync route | backend | 5 |
| 9 | Integration testing and verification | testing | 7, 8 |

---

## Linear Upload

**Uploaded:** 2026-01-04T17:55:00Z
**Parent:** [ODE-22](https://linear.app/odell/issue/ODE-22/feature-ibjjf-gym-data-loading)

| Story | Issue | Blocked By |
|-------|-------|------------|
| 1 | [ODE-23](https://linear.app/odell/issue/ODE-23/add-ibjjf-types-and-extended-schema) | - |
| 2 | [ODE-24](https://linear.app/odell/issue/ODE-24/add-gym-sync-meta-queries) | ODE-23 |
| 3 | [ODE-25](https://linear.app/odell/issue/ODE-25/create-ibjjf-gym-fetcher) | ODE-23 |
| 4 | [ODE-26](https://linear.app/odell/issue/ODE-26/update-gym-queries-for-ibjjf-fields) | ODE-23, ODE-25 |
| 5 | [ODE-27](https://linear.app/odell/issue/ODE-27/create-gym-sync-service) | ODE-24, ODE-25, ODE-26 |
| 6 | [ODE-28](https://linear.app/odell/issue/ODE-28/create-gym-sync-lambda-handler) | ODE-27 |
| 7 | [ODE-30](https://linear.app/odell/issue/ODE-30/add-aws-infrastructure-for-gym-sync) | ODE-28 |
| 8 | [ODE-29](https://linear.app/odell/issue/ODE-29/add-dev-server-gym-sync-route) | ODE-27 |
| 9 | [ODE-31](https://linear.app/odell/issue/ODE-31/integration-testing-and-verification) | ODE-29, ODE-30 |
