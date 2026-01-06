# Tournament Tracking Feature - Next Steps

**Date:** 2026-01-06
**Status:** Ready for implementation
**Context:** Code cleanup completed and committed (605052d). Feature is functional but needs testing, UX polish, and integration improvements.

---

## Current State

### ✅ Completed
- Core tracking functionality (add/remove from wishlist)
- Optimistic UI updates with rollback on error
- Race condition protection (duplicate prevention)
- Hook architecture following codebase patterns
- ScoreboardTournamentCard UI with track button
- Query caching and retry logic
- Date utilities for tournament display

### 🎯 Working Features
- Users can track/untrack tournaments from the tournament list
- Tracked tournaments show yellow glow and "✓ TRACKING" button state
- Login redirect for unauthenticated users
- Loading states during mutations
- Error toasts on failure with automatic rollback

---

## Gaps and Missing Pieces

### 1. **No Tests for New Hooks** (High Priority)
**Issue:** The new hooks (`useAddToWishlist`, `useRemoveFromWishlist`) have no test coverage.

**What's Needed:**
- Unit tests for `useAddToWishlist`:
  - Optimistic update adds tournament to cache
  - Duplicate prevention works (rapid clicks)
  - Rollback on API error
  - Invalidates cache on success
- Unit tests for `useRemoveFromWishlist`:
  - Optimistic update removes from cache
  - Rollback on API error
  - Invalidates cache on success
- Integration test for track/untrack flow

**Location:** `frontend/src/__tests__/hooks/`

---

### 2. **No Wishlist/Tracked Tournaments Page** (High Priority)
**Issue:** Users can track tournaments but have no way to view their tracked list.

**What's Needed:**
- New page at `/tournaments/tracked` or `/wishlist`
- Shows all tracked tournaments in a grid/list
- Filter/sort options (by date, by location, by organization)
- Bulk actions (untrack all past tournaments, export to calendar)
- Empty state with call-to-action to browse tournaments

**Design Considerations:**
- Should this be a protected route (auth required)?
- Should it use the same ScoreboardTournamentCard component?
- Should it show different information than the main list?
- Should tracked tournaments show in the main list with visual distinction?

**Files to Create:**
- `frontend/src/app/(protected)/wishlist/page.tsx`
- `frontend/src/components/tournaments/WishlistPage.tsx` (or similar)

---

### 3. **No Visual Distinction in Main Tournament List** (Medium Priority)
**Issue:** Users can't easily see which tournaments they're already tracking when browsing.

**What's Needed:**
- Visual indicator on tournament cards in main list when already tracked
- Options:
  - Badge/tag saying "Tracked"
  - Different card styling (already has yellow glow)
  - Filter to show/hide tracked tournaments
  - Count of tracked tournaments in header

**Current Behavior:**
- ScoreboardTournamentCard already shows yellow glow and "✓ TRACKING" button
- But when viewing many tournaments, this could be more prominent

**Improvement Ideas:**
- Add a filter dropdown: "All | Tracked | Not Tracked"
- Add tracked count to page header: "Showing 47 tournaments (3 tracked)"
- Make the yellow glow more prominent or add a corner badge

---

### 4. **No Tournament Notifications/Reminders** (Medium Priority)
**Issue:** Users track tournaments but have no reminders as dates approach.

**What's Needed:**
- Email reminders (7 days before, 1 day before)
- In-app notification system
- User preferences for notification timing
- Backend Lambda for scheduled notifications

**Technical Requirements:**
- EventBridge scheduled rule
- Lambda to check upcoming tournaments
- SES for email sending
- User notification preferences in DynamoDB

**Out of Scope for Now:** This requires backend work. Consider as Phase 2.

---

### 5. **No Analytics/Tracking** (Low Priority)
**Issue:** No visibility into feature usage.

**What to Track:**
- Track button clicks (add/remove)
- Most tracked tournaments
- Tracked tournament characteristics (org, location, date range)
- User engagement (how many tournaments do users typically track?)

**Implementation:**
- Simple event logging to backend
- Optional analytics dashboard in admin panel

---

### 6. **No Offline Support** (Low Priority)
**Issue:** Tracking/untracking requires network connection.

**What's Needed:**
- Service worker for offline capability
- Queue mutations when offline
- Sync when connection restored
- Visual indicator of offline state

**Out of Scope for Now:** Consider as Phase 3 enhancement.

---

## Recommended Implementation Order

### Phase 1: Testing & Core UX (This Session)
**Priority:** High
**Time Estimate:** 2-3 hours

1. **Write tests for new hooks** ⭐ CRITICAL
   - Test files: `useAddToWishlist.test.ts`, `useRemoveFromWishlist.test.ts`
   - Mock TanStack Query and auth store
   - Test optimistic updates, error handling, duplicate prevention

2. **Create wishlist/tracked tournaments page**
   - Design decision: Route location and auth protection
   - Reuse ScoreboardTournamentCard or create new variant?
   - Add navigation link to main nav

3. **Add filter to main tournament list**
   - Dropdown: "All | Tracked | Not Tracked"
   - Update TournamentList component
   - Show tracked count in header

### Phase 2: Enhancements (Future Session)
**Priority:** Medium
**Time Estimate:** 3-4 hours

4. **Calendar export functionality**
   - "Add to Calendar" button on tracked tournaments
   - Generate .ics file with tournament details
   - Support multiple calendar formats

5. **Better visual distinction**
   - Corner badge on tracked tournaments
   - More prominent styling
   - Hover states and transitions

6. **Tournament comparison**
   - Compare multiple tracked tournaments side-by-side
   - Distance, dates, cost (if available)
   - Help users decide which to attend

### Phase 3: Notifications (Future Sprint)
**Priority:** Low
**Time Estimate:** 4-6 hours (includes backend)

7. **Email reminder system**
   - Backend Lambda for scheduled checks
   - User notification preferences
   - Email templates
   - EventBridge scheduling

8. **In-app notifications**
   - Notification bell icon
   - Unread count
   - Mark as read functionality

---

## Technical Decisions Needed

### Question 1: Wishlist Page Route
**Options:**
- A) `/wishlist` (simple, clear)
- B) `/tournaments/tracked` (more explicit)
- C) `/profile/wishlist` (grouped with user features)

**Recommendation:** Option A - `/wishlist` is concise and commonly understood.

---

### Question 2: Should Tracked Tournaments Show in Main List?
**Options:**
- A) Show all tournaments, mark which are tracked (current behavior)
- B) Filter out tracked tournaments by default
- C) Add a toggle to show/hide tracked

**Recommendation:** Option A with filter added (see Phase 1, item 3)

---

### Question 3: Test Coverage Strategy
**Options:**
- A) Just test new hooks (useAddToWishlist, useRemoveFromWishlist)
- B) Also test ScoreboardTournamentCard integration
- C) Full integration test of track/untrack flow

**Recommendation:** A + C - Test hooks in isolation, then integration test

---

## Files Likely to Change

### Phase 1 (Testing & Core UX)
```
frontend/src/__tests__/hooks/
  ├── useAddToWishlist.test.ts          (CREATE)
  ├── useRemoveFromWishlist.test.ts     (CREATE)
  └── useWishlist.test.ts                (CREATE)

frontend/src/app/(protected)/wishlist/
  └── page.tsx                           (CREATE)

frontend/src/components/tournaments/
  ├── TournamentList.tsx                 (MODIFY - add filter)
  └── WishlistPage.tsx                   (CREATE)

frontend/src/components/filters/
  └── TournamentFilter.tsx               (CREATE)
```

### Phase 2 (Enhancements)
```
frontend/src/lib/
  └── calendar.ts                        (CREATE - .ics generation)

frontend/src/components/tournaments/
  ├── CalendarExportButton.tsx          (CREATE)
  └── TournamentComparison.tsx          (CREATE)
```

### Phase 3 (Notifications - Backend)
```
backend/src/handlers/
  └── notifications.ts                   (CREATE)

backend/src/services/
  └── notificationService.ts             (CREATE)

backend/template.yaml                    (MODIFY - add EventBridge rule)
```

---

## Success Criteria

### Phase 1 Complete When:
- [ ] All new hooks have test coverage (>80%)
- [ ] Users can view their tracked tournaments on dedicated page
- [ ] Users can filter tournaments by tracked status
- [ ] Empty states are helpful and actionable
- [ ] All tests passing, build clean

### Phase 2 Complete When:
- [ ] Users can export tournaments to calendar
- [ ] Visual distinction is clear and consistent
- [ ] Tournament comparison helps decision-making

### Phase 3 Complete When:
- [ ] Users receive email reminders for upcoming tournaments
- [ ] Users can configure notification preferences
- [ ] In-app notifications work reliably

---

## Open Questions for Next Session

1. Should the wishlist page show tournaments in chronological order or grouped by status (upcoming/past)?
2. Should past tracked tournaments automatically be removed from the wishlist?
3. Should there be a limit on how many tournaments a user can track?
4. Should tracking be synced across devices (already is via backend, just confirming UX)
5. Should we show related tournaments (same location, same weekend) on the wishlist page?

---

## Prompt for Next Session

**Start with:**
"Implement Phase 1 of the tournament tracking next steps: write tests for the new hooks (useAddToWishlist, useRemoveFromWishlist, useWishlist), create the wishlist page, and add a filter to the main tournament list."

**Reference:**
- This plan: `docs/plans/2026-01-06-tournament-tracking-next-steps.md`
- Latest code: commit 605052d
- CLAUDE.md for testing requirements and patterns

**First Steps:**
1. Read this plan
2. Decide on wishlist page route and design
3. Write hook tests following existing test patterns
4. Create wishlist page with filter functionality
5. Run tests and build before committing

**Success Looks Like:**
- Clean, well-tested code
- Intuitive UX for viewing tracked tournaments
- Helpful filters and empty states
- All tests passing
