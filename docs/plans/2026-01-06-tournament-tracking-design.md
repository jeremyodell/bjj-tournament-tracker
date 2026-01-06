# Tournament Tracking Feature Design

**Date:** 2026-01-06
**Status:** Approved
**Scope:** Core tracking functionality (Phase 1)

## Overview

Connect the "Track" button on tournament cards to the existing wishlist backend API. Allow logged-in users to track tournaments they're interested in, with tracked state persisting across sessions.

## What We're Building

### Core Feature
- Connect "Track" button on `ScoreboardTournamentCard` to existing wishlist backend
- Logged-in users click "Track" to save tournament to their wishlist via `POST /wishlist`
- Click again to untrack via `DELETE /wishlist/:tournamentId`
- Show tracked state on page load by checking if tournament exists in user's wishlist

### UI Changes
**Track Button States:**
- **Not tracking:** Gray outline, displays "TRACK"
- **Tracking:** Yellow solid background, displays "✓ TRACKING"

**Removed Elements:**
- "Who's Going" counter (will be added later with gym registration features)

**User Feedback:**
- Optimistic updates (instant UI feedback before backend confirms)
- Toast notifications on success/error
- Inline loading spinner on button during mutation

### Data Storage
- **Backend:** DynamoDB wishlist entries (`USER#{userId}` / `WISH#{tournamentPK}`)
- **Frontend:** TanStack Query cache with automatic sync
- **No localStorage:** Login required to track

## Frontend Architecture

### New React Query Hooks

**`useWishlist.ts`**
- Fetches user's tracked tournaments
- Returns: `{ data: WishlistItem[], isLoading, error }`
- Query key: `['wishlist', userId]`
- Enabled only when `isAuthenticated === true`
- Auto-refetches on window focus

**`useTrackTournament.ts`**
- Two mutations: track and untrack
- Optimistic updates with `onMutate` callback
- Error rollback with `onError`
- Cache invalidation with `onSuccess`
- Exports: `{ track, untrack, isTracking, isPending }`

### Component Updates

**`ScoreboardTournamentCard.tsx`**
- Import `useTrackTournament` and `useAuthStore`
- Remove mock tracking state
- Use `isTracking(tournament.id)` for button state
- Call `track()` or `untrack()` on button click
- Remove "Who's Going" counter section entirely
- Show loading spinner on button while mutation pending

**Auth-Gating**
- Non-logged-in users see "Sign in to track" tooltip on Track button
- Click redirects to `/login` page

## Error Handling & User Feedback

### Loading States

**On page load:**
- Tournament cards show tracked state from React Query cache
- If cache empty, show skeleton buttons briefly
- No blocking spinners - cards render immediately

**On track/untrack:**
- Button shows inline spinner
- Button disabled during mutation
- Optimistic update: state changes immediately, reverts on API error

### Error Handling

**Network errors:**
- Toast: "Failed to track tournament. Please try again."
- Button state reverts to previous
- Retry button in toast

**Auth errors (401):**
- Redirect to `/login?redirect=/tournaments`
- Return to tournaments page after login

**Rate limiting (429):**
- Toast: "Too many requests. Please wait a moment."
- Disable button for 5 seconds

**Success feedback:**
- Subtle toast: "Tournament tracked" (optional - can rely on just button state change)

### Toast Implementation
- Use `react-hot-toast` library OR build simple toast component
- Position: top-right
- Duration: 3s
- Slide-in animation

## Implementation Plan

### New Files

1. **`frontend/src/hooks/useWishlist.ts`**
   - React Query hook to fetch wishlist
   - Returns tracked tournament IDs for quick lookup

2. **`frontend/src/hooks/useTrackTournament.ts`**
   - Track/untrack mutations with optimistic updates
   - Error handling and cache invalidation

3. **`frontend/src/components/ui/Toast.tsx`** (if not using library)
   - Simple toast component
   - Context provider + `useToast()` hook

### Modified Files

1. **`frontend/src/components/tournaments/ScoreboardTournamentCard.tsx`**
   - Import and use tracking hooks
   - Remove mock state
   - Update button click handlers
   - Remove "Who's Going" counter
   - Add auth checks

2. **`frontend/src/lib/api.ts`**
   - No changes needed - wishlist API functions already exist

## Testing & Verification

### Manual Testing Checklist

**Logged-in user:**
- [ ] Click "Track" → button turns yellow, says "✓ TRACKING"
- [ ] Refresh page → tournament still shows as tracked
- [ ] Click "✓ TRACKING" → untrack, button returns to gray "TRACK"
- [ ] Track 3 different tournaments → all persist correctly
- [ ] Open in new tab → tracked tournaments show correct state

**Logged-out user:**
- [ ] Track button shows "Sign in to track" tooltip
- [ ] Click Track → redirects to login page
- [ ] After login → can track tournaments

**Error scenarios:**
- [ ] Disable network → track fails → shows error toast → button reverts
- [ ] Rapid clicking Track → only one request fires
- [ ] Backend returns 500 → shows error toast

**Performance:**
- [ ] Cards render instantly (no blocking on wishlist fetch)
- [ ] Optimistic updates feel instant (no visible lag)
- [ ] Page doesn't re-render all cards when tracking one

## Future Enhancements (Out of Scope)

- "Who's Going" counter with gym registration data
- "My Season" page showing all tracked tournaments
- Tournament detail modal
- Gym-based features (teammates competing, bracket matchups)

## Backend Requirements

**Already implemented:**
- ✅ `GET /wishlist` - List user's tracked tournaments
- ✅ `POST /wishlist` - Add tournament to wishlist
- ✅ `DELETE /wishlist/:tournamentId` - Remove from wishlist
- ✅ Cognito authentication with JWT tokens

**No backend changes needed for this feature.**
