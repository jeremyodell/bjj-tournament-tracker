# Pressure Test: IBJJF Gym Data Loading

**Date:** 2026-01-04
**Sign-off:** Confirmed
**Timestamp:** 2026-01-04T12:45:00Z

## Original Idea

Create the code to load the data for the IBJJF gyms from https://ibjjf.com/api/v1/academies/list.json, building on existing JJWL gym infrastructure. Only sync if total records have changed.

## Scope Drift Check

| Component | Verdict | Justification |
|-----------|---------|---------------|
| `ibjjfGymFetcher.ts` | ✓ Direct | Directly loads IBJJF gym data |
| Extended `SourceGymItem` schema | ✓ Direct | Stores IBJJF's richer fields |
| Sequential pagination with delay | ✓ Direct | Handles the 429-page API |
| `GymSyncMetaItem` for change detection | ✓ Direct | Requested "only sync if changed" |
| `syncIBJJFGyms()` service function | ✓ Direct | Orchestrates the sync |
| `GymSyncFunction` Lambda + EventBridge | ✓ Justified | Enables on-demand sync of just IBJJF |
| CloudWatch Alarm + SNS | ✓ Justified | Essential - must know about errors |

**Result:** No scope creep. All components trace to original problem.

## Assumptions Challenged

### Assumption 1: IBJJF API will remain stable
**Challenge:** APIs change without notice. What if they add rate limiting, auth, or change the endpoint?
**Response:** They will change eventually. Alerting will catch it, then fix manually. No way to future-proof against unknown changes.
**Status:** Acknowledged

### Assumption 2: Checking `totalRecords` is sufficient to detect changes
**Challenge:** What if IBJJF adds 5 gyms and removes 5 on the same day? totalRecords unchanged but data changed.
**Response:** Acceptable trade-off. Added `forceSync` parameter to bypass check when needed.
**Status:** Accepted with mitigation

### Assumption 3: 200ms delay between pages is sufficient
**Challenge:** 429 requests over ~8 minutes might trigger protection. What if blocked mid-sync?
**Response:** Will test and slow down if needed. Start with 200ms as baseline.
**Status:** Acknowledged - will adjust based on testing

### Assumption 4: Weekly sync is frequent enough
**Challenge:** New gyms might not appear for up to 7 days.
**Response:** Acceptable. Major gyms are target market. Can run on-demand if one is missing.
**Status:** Accepted

## Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| IBJJF API changes/blocks us | Medium | Alerting catches it, fix manually |
| Rate limiting mid-sync | Medium | Start 200ms, adjust if needed |
| 15-min Lambda timeout exceeded | Low | Accept, adjust later if needed |
| SNS AlertsTopic doesn't exist | High | Create it in SAM template |

## YAGNI Decisions

**Essential (v1):**
- Extended schema fields (country, city, address, etc.)
- Change detection (`totalRecords` check)
- Force sync parameter (bypass change detection)
- Weekly EventBridge schedule
- CloudWatch Alarm + SNS

**Deferred:**
- None

## Edge Cases

### 1. Malformed JSON on page 217 of 429
**Response:** Skip malformed JSON, send alert to notify. Continue with remaining pages.

### 2. Gym name with special characters breaking GSI1SK pattern
**Response:** Send alert to be aware and determine what to do. May need to sanitize names.

### 3. New schema deployed but sync hasn't run yet
**Response:** Existing JJWL gyms will have null for new optional fields. This is expected and fine - fields are optional.

## Design Additions from Pressure Test

1. **`forceSync` parameter** - Added to bypass `totalRecords` check when manual full reload is needed (addresses Assumption 2 edge case)

2. **Create AlertsTopic** - SNS topic must be added to SAM template (Risk #4)
