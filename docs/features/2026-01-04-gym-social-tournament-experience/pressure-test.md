# Pressure Test: Gym Social Tournament Experience

**Date:** 2026-01-04
**Sign-off:** Confirmed
**Timestamp:** 2026-01-04

## Original Idea

Enhance UI/UX for viewing tournaments, seeing gym teammates registered, with future support for bracket notifications and live updates.

---

## Scope Drift Check

All components trace to original problem:

| Component | Status |
|-----------|--------|
| Tournament detail page | ✓ Directly addresses "viewing tournaments" |
| Gym teammate badges on browse | ✓ Directly addresses "seeing gym teammates registered" |
| Inline teammate expansion | ✓ Directly addresses "seeing gym teammates registered" |
| Gym search/selection | ✓ Required to enable teammate features |
| User profile gym setting | ✓ Required to enable teammate features |
| Roster caching + sync | ✓ Required for performance of teammate features |
| Onboarding gym step | ✓ Justified - reduces friction later; "Skip" provides escape hatch |
| "Remind later" prompt | ✓ Lightweight alternative to forcing gym selection |

**Result:** No scope creep detected.

---

## Assumptions Challenged

### Assumption 1: JJWL/IBJJF APIs reliably return roster data
**Challenge:** APIs may be undocumented, rate-limited, or return incomplete data.
**Resolution:** API failures require alerting + manual intervention/fix.

### Assumption 2: Users will know their gym name well enough to find it
**Challenge:** Gym names vary across sources.
**Resolution:** Accepted - users know their gym name; search will surface it.

### Assumption 3: One gym per user is sufficient
**Challenge:** Parents with kids at different gyms may be frustrated.
**Resolution:** Keep user-level gym. Stated limitation: "We support families training at one gym." Users with kids at multiple gyms can pick their primary.

### Assumption 4: 24-hour cache freshness is acceptable
**Challenge:** Registration happens in bursts; stale data could miss recent signups.
**Resolution:** Mitigated by manual "Refresh" button on tournament detail page.

### Assumption 5: Master gym matching will work across sources
**Challenge:** Same gym may be registered differently in JJWL vs IBJJF.
**Resolution:** Handled by separate ticket (master-child gym relationship). This feature depends on that work.

---

## Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| JJWL/IBJJF APIs unavailable or rate-limited | High | Alerting + manual intervention |
| Master gym matching ticket not complete | High | Dependency - must complete first |
| Roster data incomplete or malformed | Medium | Graceful fallback, show "partial data" |
| User's gym not in either org database | Low | Clear messaging: "Gym must be registered with JJWL/IBJJF" |

---

## YAGNI Decisions

### Essential (v1):
1. Teammate badge on tournament cards
2. Inline expansion (first 3 teammates)
3. Tournament detail page with full roster
4. Gym search/selection in onboarding
5. Gym setting in profile
6. Manual refresh button
7. Daily background sync (60 days)
8. "Remind later" prompt for skipped gym
9. Hero header with banner image

### Deferred:
None - all items marked essential.

---

## Edge Cases

### 1. API down when user views tournament (no cache exists)
**Resolution:** Show "Roster data not available at the moment" message.

### 2. Gym has 100+ athletes at a large tournament
**Resolution:** Expected for big gyms - design must handle gracefully (virtualized list or grouped by division).

### 3. User changes gym mid-season
**Resolution:** No issue - roster data is always fresh from source APIs, no historical context stored. New gym's teammates show immediately.

---

## Dependencies

- **Master gym matching ticket** must complete before this feature can work across JJWL/IBJJF sources.
