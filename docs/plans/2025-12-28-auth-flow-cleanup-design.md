# Authenticated Flow Cleanup Design

## Overview

Unify the anonymous planner-first flow (`/plan`) with the authenticated user experience. Currently, login redirects to `/wishlist` and authenticated users have a separate athlete management flow that's disconnected from the new `/plan` experience.

## Goals

1. Make `/plan` the universal "My Season" entry point for all users
2. Seamlessly transition anonymous users to authenticated state
3. Let authenticated users select from existing athletes or create new ones
4. Keep `/wishlist` as a separate "Saved Tournaments" view

## Design

### Login & Redirect Logic

When a user logs in, check two conditions and redirect accordingly:

| setupStore has data? | Has athletes? | Redirect to |
|---------------------|---------------|-------------|
| Yes | Any | `/plan/verify` |
| No | 0 | `/plan` |
| No | 1 | `/plan/results` (auto-select) |
| No | 2+ | `/plan/select` |

**Files affected:**
- `frontend/src/app/(auth)/login/page.tsx` - smart redirect logic
- `frontend/src/components/auth/LoginModal.tsx` - same logic after modal login
- `frontend/src/components/shared/AuthButton.tsx` - "My Season" → `/plan`

---

### Verification Flow (`/plan/verify`)

**When:** User has `setupStore` data and just logged in

**Purpose:** Let them confirm/edit the athlete info before saving to backend

**UI:**
- Pre-filled form with data from `setupStore` (name, age, belt, weight, location)
- Heading: "Confirm [Name]'s Info"
- Subtext: "We'll save this to your account"
- All fields editable (same inputs as `QuickSetupForm`)
- "Save & Continue" button

**On submit:**
1. Call backend API to create athlete (POST `/athletes`)
2. Clear `setupStore` (data now lives in backend)
3. Redirect to `/plan/results`

**Edge case:** If user closes browser and returns later (setupStore cleared), they go through normal authenticated flow.

**Files:**
- Create: `frontend/src/app/plan/verify/page.tsx`
- Reuse: `QuickSetupForm` component with different submit behavior

---

### Athlete Selection (`/plan/select`)

**When:** Authenticated user with 2+ athletes visits `/plan`

**Purpose:** Let them pick which athlete to plan for

**UI:**
- Heading: "Who's competing?"
- List of athlete cards (name, belt, weight, age)
- Each card is clickable → navigates to `/plan/results`
- "Add New Athlete" button at bottom → goes to `/plan` setup form (with flag to show form)

**On select:**
1. Store selected `athleteId` in `setupStore`
2. Populate `setupStore` with that athlete's data
3. Redirect to `/plan/results`

**Single athlete shortcut:** If user has exactly 1 athlete, skip this page - auto-select and go to `/plan/results`.

**Files:**
- Create: `frontend/src/app/plan/select/page.tsx`
- Modify: `frontend/src/stores/setupStore.ts` - add `loadFromAthlete(athlete)` action and `athleteId` field

---

### Updated `/plan` Page Behavior

Adapts based on auth state:

| Authenticated? | Has athletes? | Show |
|----------------|---------------|------|
| No | N/A | Setup form (current) |
| Yes | 0 | Setup form (creates athlete on submit) |
| Yes | 1 | Redirect to `/plan/results` |
| Yes | 2+ | Redirect to `/plan/select` |

**For authenticated users with 0 athletes:**
- Same `QuickSetupForm` UI
- On submit: create athlete in backend immediately
- Then redirect to `/plan/results`

**Files:**
- Modify: `frontend/src/app/plan/page.tsx` - add auth-aware routing logic
- Modify: `frontend/src/components/setup/QuickSetupForm.tsx` - accept optional `onCreateAthlete` prop

---

### Navigation & Wishlist Changes

**AuthButton:**
- "My Season" link: `/wishlist` → `/plan`

**Wishlist page (`/wishlist`):**
- Keep as "Saved Tournaments" view
- Remove "Add Athletes to Get Started" CTA
- Add "Back to My Season" → `/plan`

**Profile page:**
- Keep athlete management as-is
- "View Season Plan" on athlete cards continues to work (athletes accessible via `/plan/select`)

**Files:**
- Modify: `frontend/src/components/shared/AuthButton.tsx`
- Modify: `frontend/src/app/(protected)/wishlist/page.tsx`

---

### `/plan/results` for Authenticated Users

**Data flow:**
1. User selects athlete (or comes from `/plan/verify`)
2. `setupStore` populated with athlete data + `athleteId`
3. `FreePlannerView` renders using `setupStore` (unchanged)
4. Save/favorite actions sync to backend for authenticated users

**Behavior changes:**
- Anonymous "Save" → shows `LoginModal`
- Authenticated "Save" → saves favorites to backend via API
- Heart/favorite: uses `favoritesStore` locally, syncs to backend for auth users

**Guard logic:**
- Not authenticated AND `!setupStore.isComplete` → redirect to `/plan`
- Authenticated AND no athlete selected → redirect to `/plan`

**Files:**
- Modify: `frontend/src/app/plan/results/page.tsx` - auth-aware guards
- Modify: `frontend/src/components/plan/FreePlannerView.tsx` - auth-aware save/favorite

---

## Implementation Tasks

1. **Update setupStore** - Add `athleteId` field and `loadFromAthlete()` action
2. **Create `/plan/verify` page** - Verification form for post-login athlete creation
3. **Create `/plan/select` page** - Athlete picker for multi-athlete users
4. **Update `/plan` page** - Auth-aware routing logic
5. **Update login redirect** - Smart redirect based on state
6. **Update LoginModal** - Same smart redirect logic
7. **Update AuthButton** - "My Season" → `/plan`
8. **Update wishlist page** - Remove athlete CTA, add back link
9. **Update FreePlannerView** - Auth-aware save/favorite behavior
10. **Update `/plan/results` guards** - Auth-aware redirect logic

## Testing

- Anonymous user completes `/plan` → logs in → sees verify → athlete created → results
- Anonymous user logs in directly (no setupStore) → redirects to `/plan`
- Authenticated user with 1 athlete → `/plan` → auto-redirects to results
- Authenticated user with 2+ athletes → `/plan` → sees select → picks one → results
- Authenticated user creates new athlete from select page
- Favorites sync to backend for authenticated users
- Wishlist page accessible and shows saved tournaments
