# BJJComps Planner-First Redesign

**Date:** 2025-12-28
**Status:** Approved for implementation

## Overview

This document defines a fundamental shift in the user experience: from browse-first to planner-first. The season planner becomes the central entry point, not a paywalled destination buried at the end of a disjointed flow.

**Primary persona:** Overwhelmed parent with 1-2 kids competing who needs guidance on which tournaments to pick.

---

## The Problem with Current Flow

```
Tournaments → Heart → Login → Wishlist → "Add Athletes" (why?) → Profile → Planner
```

Issues:
- Value prop (intelligent schedule generation) is buried at the end
- Users don't understand why they need to add athletes before seeing benefit
- Wishlist feels like a cart when user is "still shopping"
- Flow is disjointed with no clear destination

---

## New Flow: Planner-First

```
Landing → "Plan Your Season" → Quick Setup → Free Planner → Upgrade for AI
```

Key changes:
1. Planner is the ENTRY point, not the destination
2. No login required until user wants to save
3. Athlete info collected WITH clear context (to show relevant tournaments)
4. Free version shows tournaments, paid version optimizes them

---

## Screen Designs

### 1. Landing Page

Hero CTA shifts from generic "Browse Tournaments" to outcome-focused:

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│   Plan Your Kid's Tournament Season                     │
│   in 60 Seconds                                         │
│                                                         │
│   See every IBJJF & JJWL tournament that fits           │
│   your athlete's division — no more spreadsheets.       │
│                                                         │
│   [ Start Planning → ]                                  │
│                                                         │
│   No account required                                   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 2. Quick Setup (No Login)

Single page, minimal friction:

```
┌─────────────────────────────────────────────────────────┐
│   Let's find tournaments for your athlete               │
├─────────────────────────────────────────────────────────┤
│                                                         │
│   Where are you based?                                  │
│   [ Dallas, TX                                    ▼ ]   │
│                                                         │
│   Athlete's first name                                  │
│   [ Sofia                                           ]   │
│                                                         │
│   Age         Belt            Weight                    │
│   [ 10 ▼ ]    [ Gray ▼ ]      [ 60 lbs ▼ ]             │
│                                                         │
│   [ Show Me Tournaments → ]                             │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Notes:**
- Name is optional but personalizes the UI ("Sofia's 2025 Season")
- Age/belt/weight dropdowns pre-populated with common values
- Location uses autocomplete, stores nearest airport for travel calc
- No gender field — infer or ask later if needed for division filtering

### 3. Free Planner View

User lands here immediately after setup — no login, no paywall.

**Header:**
```
┌─────────────────────────────────────────────────────────┐
│  Sofia's 2025 Season                        [Save ↗]   │
│  Gray Belt • 60 lbs • Age 10                            │
│  Based near Dallas, TX                      [Edit]      │
└─────────────────────────────────────────────────────────┘
```

**Tournament List:**
```
┌─────────────────────────────────────────────────────────┐
│  14 tournaments match Sofia's division                  │
│                                                         │
│  [ All ] [ Nearby < 4hrs ] [ IBJJF ] [ JJWL ]          │
├─────────────────────────────────────────────────────────┤
│  ○  Feb 15-16 • Pan Kids                    ♡          │
│      Kissimmee, FL • 2hr 45min flight • IBJJF          │
│                                                         │
│  ○  Mar 8 • Dallas Open                     ♡          │
│      Dallas, TX • 20 min drive • IBJJF                 │
│                                                         │
│  ○  Mar 22 • Austin Spring Open             ♡          │
│      Austin, TX • 3 hr drive • JJWL                    │
│                                                         │
│  ... (scrollable list)                                  │
└─────────────────────────────────────────────────────────┘
```

**Free capabilities:**
- See all matching tournaments for the year
- Filter by distance, organization
- Heart/favorite tournaments (visual only until login)
- Click into tournament details

**Upgrade nudge (non-blocking):**
```
┌─────────────────────────────────────────────────────────┐
│  💡 Overwhelmed? Set your budget and let us pick the   │
│     best tournaments for Sofia.                         │
│                                             [Try It →]  │
└─────────────────────────────────────────────────────────┘
```

### 4. Paid Planner View

Same page, expanded capabilities after upgrade.

**Desktop Layout (split screen):**
```
┌─────────────────────────────────────────────────────────────────────────┐
│  Sofia's 2025 Season                                    [Save] [Share]  │
├─────────────────────────────┬───────────────────────────────────────────┤
│                             │                                           │
│  BUDGET                     │  YOUR OPTIMIZED SEASON                    │
│  ────────────────────────   │  ─────────────────────────────────────    │
│  Total: [$] [ 3,000    ]    │                                           │
│                             │  ✦ Feb 15-16 • Pan Kids         $680     │
│  Reserve for unannounced    │    Kissimmee, FL • Flight                 │
│  [$] [ 500 ]                │    Reg $150 + Travel $530                 │
│                             │    Status: [ Not registered ▼ ]           │
│  Available: $2,500          │    [ Lock ] [ Swap ] [ Remove ]           │
│                             │                                           │
│  ────────────────────────   │  ✦ Mar 8 • Dallas Open           $95     │
│  TRAVEL                     │    Dallas, TX • 20 min drive              │
│                             │    Reg $85 + Travel $10                   │
│  Max drive time:            │    Status: [ Registered ▼ ]               │
│  [●━━━━━━○] 4 hours         │    [ Lock ] [ Swap ] [ Remove ]           │
│                             │                                           │
│  Include flights?           │  ✦ Apr 26 • Houston Open        $180     │
│  [✓] Yes, within budget     │    Houston, TX • 4 hr drive               │
│                             │    Reg $100 + Travel $80                  │
│  ────────────────────────   │    [ Lock ] [ Swap ] [ Remove ]           │
│  PREFERENCES                │                                           │
│                             │  + 4 more tournaments                     │
│  Tournaments per month:     │                                           │
│  [ 1-2 ▼ ]                  ├───────────────────────────────────────────┤
│                             │  Budget: $2,340 / $2,500                  │
│  Organization mix:          │  ████████████████████░░░  7 tournaments   │
│  IBJJF [━━━●━━] JJWL        │                                           │
│                             │  [ Regenerate ]           [ Save Plan ]   │
│  ────────────────────────   │                                           │
│  MUST-GO (from favorites)   │                                           │
│                             │                                           │
│  ♥ Pan Kids (Feb) ✕         │                                           │
│  [ + Add from list ]        │                                           │
│                             │                                           │
└─────────────────────────────┴───────────────────────────────────────────┘
```

**Tournament status dropdown:**
- Not registered — shows reminders
- Registered — suppresses "closing soon" alerts
- Waitlisted — still shows updates
- Skipping — removes from plan

**AI behavior:**
- Respects must-go tournaments first
- Fills remaining budget with optimal mix
- Prefers drivable tournaments when possible
- Considers spacing (not 3 tournaments in one month)
- Respects org preference weighting
- Respects tournaments-per-month setting

**Mobile layout:**
- Full screen results with scrollable tournament cards
- Sticky bottom bar showing budget summary
- Floating button opens config sheet

---

## Login & Save Flow

**Core principle:** Login required to save anything. No local storage tricks.

**When login is triggered:**

| No Login Needed | Login Required |
|-----------------|----------------|
| Enter athlete info | Save plan |
| View free tournament list | Upgrade to paid |
| Heart favorites (visual only) | Persist favorites |
| Configure planner | Sync across devices |

**Save flow (free user):**
```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│   Save Sofia's Season                                   │
│                                                         │
│   Create a free account to save your plan and          │
│   favorites. We'll remind you when registration opens.  │
│                                                         │
│   [ Continue with Google ]                              │
│   [ Continue with Email ]                               │
│                                                         │
│   Already have an account? [ Sign in ]                  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Upgrade flow:**
```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│   Unlock Sofia's Optimized Season                       │
│                                                         │
│   ✓ AI-powered schedule based on your budget            │
│   ✓ Travel cost estimates (flights + driving)           │
│   ✓ Lock, swap, regenerate tournaments                  │
│   ✓ Registration reminders                              │
│                                                         │
│   [ $49/year ] ← Best value                             │
│   [ $5/month ]                                          │
│                                                         │
│   [ Continue with Google ]                              │
│   [ Continue with Email ]                               │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

After login/payment:
- Athlete info saved to account
- Hearted tournaments become saved
- Redirected back to same planner view (no jarring redirect)

---

## Navigation Structure

**Header:**
```
┌─────────────────────────────────────────────────────────────────────────┐
│  BJJComps          [ My Season ▼ ]    [ Tournaments ]       [ Login ]   │
└─────────────────────────────────────────────────────────────────────────┘
```

**"My Season" dropdown (logged in):**
```
┌─────────────────────────────┐
│  Sofia's Season        ← Active
│  Marcus's Season
│  ────────────────────────
│  + Add Athlete
│  ────────────────────────
│  Account Settings
└─────────────────────────────┘
```

**Page changes:**

| Old Page | New Role |
|----------|----------|
| `/tournaments` | Kept — reference, SEO, future gym owner use |
| `/wishlist` | Removed — favorites live inside planner |
| `/profile` | Simplified — account settings, athlete list |
| `/planner/[athleteId]` | Central hub — main experience |

---

## Multiple Athletes (Family Plan)

**Pricing:**
- Family Plan: $49/year
- Up to 4 athletes per account
- Gym owners pointed to separate Team Plans

```
┌─────────────────────────────────────────────────────────┐
│  Family Plan — $49/year                                 │
│  ────────────────────────────────────────────────────   │
│  • Up to 4 athletes                                     │
│  • AI-optimized season for each                         │
│  • Family calendar view                                 │
│  • Registration reminders                               │
│                                                         │
│  Running a gym? [ See Team Plans → ]                    │
└─────────────────────────────────────────────────────────┘
```

**Per-athlete data:**
- Division info (age, belt, weight)
- Budget
- Saved/locked tournaments
- Generated plan

**Shared across athletes:**
- Home location
- Account/subscription

**Navigation tabs:**
```
┌─────────────────────────────────────────────────────────────────────────┐
│                      [ Sofia ] [ Marcus ] [ Family ]                    │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Family Calendar View

Shows all athletes on one timeline:

```
┌─────────────────────────────────────────────────────────────────────────┐
│  2025 Family Calendar                                   [ + Add Trip ]  │
│  Sofia • Marcus                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  FEBRUARY                                                               │
│  ───────────────────────────────────────────────────────────────────    │
│  Feb 15-16 │ Pan Kids              │ Sofia, Marcus  │ Kissimmee, FL    │
│            │ ✈ Flight              │ $1,180 total   │ [ View Trip → ]  │
│                                                                         │
│  MARCH                                                                  │
│  ───────────────────────────────────────────────────────────────────    │
│  Mar 8     │ Dallas Open           │ Sofia          │ Dallas, TX       │
│            │ 🚗 20 min             │ $95            │ [ View → ]       │
│  ───────────────────────────────────────────────────────────────────    │
│  Mar 22    │ Austin Spring Open    │ Marcus         │ Austin, TX       │
│            │ 🚗 3 hr               │ $120           │ [ View → ]       │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│  2025 TOTALS                                                            │
│  Sofia: 7 tournaments • $2,340                                          │
│  Marcus: 5 tournaments • $1,680                                         │
│  Family total: $4,020 (saved $400 on shared trips)                      │
└─────────────────────────────────────────────────────────────────────────┘
```

**Features:**
- Chronological view across all athletes
- Overlapping tournaments grouped as single "trips"
- Shows combined cost when siblings attend same event
- Links to individual athlete planners for adjustments

---

## Notifications & Reminders

**Notification types:**

| Notification | Default | Notes |
|--------------|---------|-------|
| Registration opens | On | |
| Registration closing soon (48hr) | On | Suppressed if status = "Registered" |
| New tournament matches athlete | On | |
| Tournament date/venue change | On | |
| Bracket released | On | |

**Email example:**
```
Subject: Registration opens tomorrow for Pan Kids

Hey Jane,

Registration for Pan Kids opens tomorrow (Jan 15) at 10am ET.
This tournament is in Sofia and Marcus's season plans.

[ Register on IBJJF.com → ]

Tournament: Feb 15-16, Kissimmee, FL
Divisions: Sofia (Gray/60lbs), Marcus (Yellow/55lbs)
```

**In-app notification center:**
```
┌─────────────────────────────────────────────────────────┐
│  Notifications                              [ Settings ]│
├─────────────────────────────────────────────────────────┤
│  🔴 TODAY                                               │
│  Pan Kids registration opens in 2 hours                 │
│  Sofia, Marcus • [ Register → ]                         │
├─────────────────────────────────────────────────────────┤
│  ○  YESTERDAY                                           │
│  Dallas Open added to IBJJF calendar                    │
│  Matches Sofia's plan • [ View → ]                      │
├─────────────────────────────────────────────────────────┤
│  ○  JAN 10                                              │
│  New JJWL tournament announced: Houston Spring          │
│  4 hr drive, fits Marcus's budget • [ Add? ]            │
└─────────────────────────────────────────────────────────┘
```

---

## Free vs Paid Summary

| Feature | Free | Paid |
|---------|------|------|
| Quick setup (location + athlete) | ✓ | ✓ |
| See matching tournaments | ✓ | ✓ |
| Filter by distance, org | ✓ | ✓ |
| Save plan (requires login) | ✓ | ✓ |
| Heart/favorite tournaments | ✓ | ✓ |
| Registration reminders | ✓ | ✓ |
| Set budget | - | ✓ |
| Travel cost estimates | - | ✓ |
| AI-optimized schedule | - | ✓ |
| Lock/swap/regenerate | - | ✓ |
| Family calendar view | - | ✓ |

---

## Future Considerations (Not in Scope)

- **Gym owner / Team Plans:** Same planner concept, different entity (gym instead of athlete), per-seat pricing
- **Tournaments page interaction model:** How gym owners and manual explorers use it
- **Live results integration:** Showing results for tournaments in your plan
- **Travel booking integration:** Affiliate links for flights/hotels

---

## Implementation Priority

### Phase 1: Core Planner Flow
1. Landing page update (new hero CTA)
2. Quick setup page (location + athlete)
3. Free planner view (tournament list with filters)
4. Login/save flow
5. Basic paid planner (budget, manual lock/remove)

### Phase 2: AI & Optimization
6. Travel cost estimation
7. AI schedule generation
8. Swap/regenerate functionality
9. Must-go tournaments from favorites

### Phase 3: Multi-Athlete
10. Add additional athletes
11. Family calendar view
12. Shared trip detection

### Phase 4: Notifications
13. Registration reminder emails
14. In-app notification center
15. Tournament status tracking (registered/waitlisted)
