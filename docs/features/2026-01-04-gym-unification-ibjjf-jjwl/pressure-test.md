# Pressure Test: Gym Unification (IBJJF + JJWL)

**Date:** 2026-01-04
**Sign-off:** Confirmed
**Timestamp:** 2026-01-04T12:00:00Z

## Original Idea

Tie IBJJF and JJWL gyms together with our own ID and common name, allowing cross-org gym lookups.

## Scope Drift Check

| Component | Status | Notes |
|-----------|--------|-------|
| Master Gym Entity | ✓ Essential | "our own ID and common name" |
| Fuzzy Matching Algorithm | ✓ Essential | "tie them together" |
| Pending Match Entity | ✓ Essential | Supports uncertain matches |
| Sync Integration | ✓ Essential | Automatic matching during sync |
| Admin UI for Review | ✓ Essential | 70-89% case handling |
| User Gym Selection API | ✓ Essential | Enables "cross-org gym lookups" |
| Athlete → Gym Linking | ✓ Essential | Confirmed for v1 |
| Future Capabilities | Deferred | Stats/leaderboards not in v1 |

## Assumptions Challenged

### Assumption 1: Auto-link accuracy at 90%+
**Challenge:** Could produce false positives with similar names in same city.
**Response:** Unlikely scenario - combination of name + city + affiliation signals provides high accuracy.
**Status:** Accepted (low risk)

### Assumption 2: JJWL names include location info
**Challenge:** Inconsistent naming (abbreviations, no location) could limit city boost effectiveness.
**Response:** Planned for - names without location still match on similarity, just without boost.
**Status:** Accepted (design handles gracefully)

### Assumption 3: Performance (<5s for 3,500 gyms)
**Challenge:** Could cause sync timeouts if counts grow or algorithm is compute-intensive.
**Response:** Unlikely - 3,500 gyms is a small dataset for in-memory operations.
**Status:** Accepted (low risk)

### Assumption 4: Admin review capacity
**Challenge:** Hundreds of pending matches could cause backlog and review fatigue.
**Response:** Initial wave may be larger but ongoing volume should be low.
**Status:** Accepted (manageable)

## Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| False positive auto-links | Medium | Auto-linked tab allows audit; add unlink capability |
| Matching misses valid pairs | Low | Can re-run matching with adjusted thresholds later |
| Admin auth bypass | Medium | Hardcoded admin list acceptable for v1; proper roles later |

## YAGNI Decisions

### Essential (v1)
1. Master Gym Entity + DB schema
2. Fuzzy matching algorithm
3. Pending Match Entity
4. Sync integration (match during gym sync)
5. Admin UI (pending/auto-linked/rejected tabs)
6. Admin API endpoints
7. User gym search API (`/gyms/search`)
8. Athlete → masterGymId field
9. Unlink capability for false positives

### Deferred (future)
1. Cross-org statistics/leaderboards

## Edge Cases

### 1. Gym exists in JJWL but not IBJJF
**Handling:** Create master gym with single source linked. Single-source master gyms are valid.

### 2. Same JJWL gym matches multiple IBJJF gyms above 70%
**Handling:** Flag all matches for review. Don't auto-pick one - let admin decide.

### 3. Admin approves wrong match
**Handling:** Add unlink/remove button to admin UI to undo incorrect links.

### 4. Gym sync fails mid-way through matching
**Handling:** Sync is idempotent - only adds new records, doesn't update existing. Safe to re-run.

## Design Updates from Pressure Test

1. Single-source master gyms are valid (JJWL-only or IBJJF-only)
2. Multiple match candidates → all flagged for admin review
3. Admin UI needs unlink capability (added to v1 scope)
4. Sync is idempotent (safe to re-run on failure)
