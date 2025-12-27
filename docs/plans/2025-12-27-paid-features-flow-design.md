# BJJComps Paid Features & User Flow Design

**Date:** 2025-12-27
**Status:** Approved for implementation

## Overview

This document defines the user flow from free tournament browsing to paid season planning, including all screens, transitions, and the free/paid feature split.

---

## Free vs Paid Split

| Feature | Free | Paid |
|---------|------|------|
| Browse tournaments | ✓ | ✓ |
| Wishlist (unlimited saves) | ✓ | ✓ |
| Gym schedule (team calendar) | ✓ | ✓ |
| Live results (follow gym/athlete) | ✓ | ✓ |
| **Season planner (budget/AI)** | - | ✓ |
| **Travel cost estimates** | - | ✓ |

**Rationale:** Live results and gym schedule drive daily usage and word-of-mouth. They also depend on third-party data reliability, so keeping them free avoids complaints. The planner is where serious parents pay for decision-making help.

---

## Screen Structure

| Screen | URL | Auth Required | Paid |
|--------|-----|---------------|------|
| Landing | `/` | No | No |
| Tournaments | `/tournaments` | No | No |
| Tournament Detail | `/tournaments/:id` | No | No |
| Wishlist | `/wishlist` | Yes | No |
| Season Planner | `/planner/:athleteId` | Yes | Yes |
| Live Results | `/live/:tournamentId` | No | No |
| Gym Schedule | `/gym/:gymSlug` | No | No |
| Profile/Athletes | `/profile` | Yes | No |

---

## Navigation

**Primary Navigation (header):**
- Logo (BJJComps) → Home
- "Tournaments" → Browse all
- "Live" → Active tournaments with live results (only visible during events)
- "My Season" → Wishlist + Planner (requires login)
- Profile/Login button (right side)

---

## User Journeys

### Free User Journey
```
Landing → Browse Tournaments → Heart favorites →
  → Prompt to login to save wishlist →
  → View wishlist (free) →
  → "Plan My Season" button → Upgrade prompt
```

### Paid User Journey
```
Landing → Browse Tournaments → Heart favorites →
  → Wishlist → Select athlete →
  → Season Planner (set budget, airport, distance) →
  → AI generates optimized schedule →
  → Adjust and finalize
```

### Event Day Journey (free)
```
Tournaments → Click active tournament →
  → Live Results page →
  → Search for gym or athlete →
  → See mat assignments, times, live scores
```

### Gym Schedule Journey (free)
```
Live Results → Click gym name → Gym Schedule page
OR
Direct link shared by coach → Gym Schedule page
```

---

## Screen Designs

### Tournament Browsing & Wishlist

**Tournament Card Updates:**
- Heart icon (top right) - empty when not saved, filled gold when in wishlist
- Click heart → if logged in, adds to wishlist with subtle animation
- Click heart → if not logged in, modal: "Sign in to save tournaments"
- Registration status badge (if available): "Open", "Closing Soon", "Closed"

**Tournament Detail Page** `/tournaments/:id`:
- Hero with tournament banner (if available)
- Full details: venue, address, registration link, deadlines
- Large "Save to Wishlist" button
- During event: "View Live Results" button appears
- Map embed showing location
- Estimated travel section (teaser for free users): "Upgrade to see travel costs from your location"

**Wishlist Page** `/wishlist`:
- List of saved tournaments, sorted by date
- Each item shows: tournament info + "Remove" button
- Filter tabs: "All", "Upcoming", "Past"
- Empty state: "No tournaments saved yet. Browse tournaments to start building your season."
- Bottom sticky bar: "Ready to plan? Select an athlete to start."
- Clicking athlete → navigates to `/planner/:athleteId`

---

### Season Planner (Paid Feature)

**Entry Point:**
- From wishlist: "Plan [Athlete Name]'s Season" button
- From profile: Click athlete → "View Season Plan"

**One plan per athlete** - each athlete (kid) has their own season plan with their own budget/constraints.

**Layout - Desktop:**
- Left panel (40%): Configuration inputs
- Right panel (60%): Live-updating season calendar/list

**Layout - Mobile:**
- Full screen results with sticky bottom bar showing budget summary
- Tap bottom bar → slides up configuration sheet

**Configuration Inputs:**

```
┌─────────────────────────────────┐
│ Sofia's 2025 Season             │
├─────────────────────────────────┤
│ BUDGET                          │
│ Total: [$] [ 3,000 ]            │
│                                 │
│ Reserve for future events       │
│ [$] [ 500 ] (for unannounced    │
│              JJWL, etc.)        │
│ Available: $2,500               │
├─────────────────────────────────┤
│ LOCATION                        │
│ Home Airport: [ DFW           ] │
│ Max Drive: [●━━━━○] 4 hours     │
├─────────────────────────────────┤
│ SCHEDULE BALANCE                │
│ Tournaments per month:          │
│ [ 1 ▼ ] (1-3 options)           │
│                                 │
│ Org preference:                 │
│ IBJJF [━━━●━━━] JJWL            │
│        (balanced)               │
├─────────────────────────────────┤
│ MUST-GO TOURNAMENTS             │
│ [+] Add from wishlist           │
│ • Pan Kids (Feb) ✕              │
└─────────────────────────────────┘
```

**Results Panel - Interactions:**

Each recommended tournament card has:
- Full details + cost breakdown (Registration $X + Travel $X = $X)
- Travel type icon: car or plane
- "Must-go" badge on locked tournaments
- **"Lock"** button - makes it a must-go (won't be replaced)
- **"Remove"** button - removes it, AI immediately suggests replacement
- **"Swap"** button - shows 2-3 alternatives at similar cost

**Sticky Footer:**
```
Budget: $2,340 / $2,500 used │ Reserved: $500 │ 7 tournaments
[ Regenerate ] [ Save Plan ]
```

**AI Behavior:**
- Respects must-go tournaments first
- Fills remaining budget with optimal mix
- Prefers drivable tournaments when possible
- Considers spacing (not 3 tournaments in one month)
- Respects org preference weighting
- Respects tournaments-per-month setting

**Cost Calculation:**
- Registration fee (from tournament data)
- Travel cost: flight from home airport OR gas/mileage if within driving radius

---

### Live Results

**Live Results Page** `/live/:tournamentId`:

**Header:**
```
┌─────────────────────────────────────────────┐
│ Pan Kids 2025                    Day 1 of 2 │
│ Kissimmee, FL │ Feb 15-16        ● LIVE     │
└─────────────────────────────────────────────┘
```

**Search/Filter Bar:**
```
┌─────────────────────────────────────────────┐
│ [🔍 Search athlete or gym...              ] │
│                                             │
│ Following: [ Pablo Silva ✕ ] [ Sofia O. ✕ ] │
└─────────────────────────────────────────────┘
```

**Results View - Gym Mode:**
```
┌─────────────────────────────────────────────┐
│ PABLO SILVA (12 athletes competing)         │
├─────────────────────────────────────────────┤
│ ● LIVE   Sofia O. │ Mat 4 │ Semifinal       │
│          vs. Jane D. (Gracie Barra)         │
├─────────────────────────────────────────────┤
│ ○ 2:30pm  Marcus T. │ Mat 7 │ Quarterfinal  │
├─────────────────────────────────────────────┤
│ ✓ 10:15am  Riley S. │ 🥇 Gold               │
├─────────────────────────────────────────────┤
│ ✓ 9:45am   Jake P.  │ 🥈 Silver             │
└─────────────────────────────────────────────┘
```

**Status Icons:**
- ● Red dot = live now
- ○ Hollow = upcoming (shows time)
- ✓ Check = completed (shows result)

**Match Detail (tap to expand):**
- Weight class, age division, belt
- Bracket position
- Opponent info
- Result (when complete): win method, points

**Data Source:**
- Brackets scraped Thursday/Friday before event
- Live updates during event (scraping or API)

---

### Gym Schedule

**Gym Schedule Page** `/gym/:gymSlug`:

**Header:**
```
┌─────────────────────────────────────────────┐
│ 🥋 Pablo Silva Brazilian Jiu-Jitsu          │
│ Houston, TX                                 │
│ [ Follow Gym ] ← adds to your followed gyms │
└─────────────────────────────────────────────┘
```

**Tab Navigation:**
```
[ Team Calendar ] [ Live Now ] [ Results ]
```

**Tab 1: Team Calendar**
```
┌─────────────────────────────────────────────┐
│ FEBRUARY                                    │
├─────────────────────────────────────────────┤
│ Feb 15-16 │ Pan Kids         │ 12 athletes │
│           │ Kissimmee, FL    │ [ View → ]  │
├─────────────────────────────────────────────┤
│ Feb 22    │ Houston Open     │ 8 athletes  │
│           │ Houston, TX      │ [ View → ]  │
└─────────────────────────────────────────────┘
```

**Tab 2: Live Now** (only during active events)
Same as Live Results page, but filtered to this gym.

**Tab 3: Results**
```
┌─────────────────────────────────────────────┐
│ 2025 Season: 🥇 14  🥈 8  🥉 12              │
├─────────────────────────────────────────────┤
│ Jan 20 │ Austin Open                        │
│        │ Sofia O. 🥇 │ Marcus T. 🥈         │
└─────────────────────────────────────────────┘
```

**Data Source:**
- Gym affiliations scraped from tournament brackets (athletes listed with gym)
- User self-declaration for matching accounts to scraped athletes

---

### Profile & Athletes

**Profile Page** `/profile`:

```
┌─────────────────────────────────────────────┐
│ My Account                                  │
├─────────────────────────────────────────────┤
│ Email: parent@email.com                     │
│ [ Edit Profile ]                            │
├─────────────────────────────────────────────┤
│ Home Location (for travel estimates)        │
│ Airport: DFW - Dallas/Fort Worth            │
│ [ Update ]                                  │
├─────────────────────────────────────────────┤
│ Subscription: Pro Plan ✓                    │
│ [ Manage Subscription ]                     │
└─────────────────────────────────────────────┘
```

**Athletes Section:**
```
┌─────────────────────────────────────────────┐
│ My Athletes                    [ + Add ]    │
├─────────────────────────────────────────────┤
│ Sofia O.                                    │
│ Gray Belt │ Age 10 │ Female │ 60 lbs       │
│ Gym: Pablo Silva                            │
│ [ View Season Plan ] [ Edit ] [ ✕ ]        │
├─────────────────────────────────────────────┤
│ Marcus O.                                   │
│ Yellow Belt │ Age 8 │ Male │ 55 lbs        │
│ Gym: Pablo Silva                            │
│ [ View Season Plan ] [ Edit ] [ ✕ ]        │
└─────────────────────────────────────────────┘
```

**Add/Edit Athlete Modal:**
- Name, Belt, Age, Gender, Weight
- Gym: Autocomplete from known gyms (scraped from tournaments)
- If not found: "Don't see your gym? Type the name as it appears at tournaments"

---

## Transition Points & Upgrade Flow

### Paywall Trigger

When free user clicks "Plan [Athlete]'s Season":

```
┌─────────────────────────────────────────────┐
│ 🎯 Unlock Season Planner                    │
├─────────────────────────────────────────────┤
│ Get AI-powered tournament recommendations   │
│ based on your budget and location.          │
│                                             │
│ ✓ Set your season budget                    │
│ ✓ See travel cost estimates                 │
│ ✓ AI optimizes your schedule                │
│ ✓ One plan per athlete                      │
│                                             │
│ [ $X/month ] or [ $X/year (save 20%) ]     │
│                                             │
│ [ Maybe Later ]                             │
└─────────────────────────────────────────────┘
```

### Login Prompts (not paywall, just auth)

- Heart a tournament → "Sign in to save"
- Access /wishlist directly → Redirect to login
- Access /profile directly → Redirect to login

### Smooth Transitions

- After signup → Return to where they were
- After upgrade → Immediately into planner with their wishlist data

---

## Data Requirements

### From Existing Scrapers
- Tournament listings (IBJJF/JJWL) ✓ Already implemented

### New Data Needed
- Bracket data (scraped Thursday/Friday before events)
- Live results during events
- Gym affiliations (from bracket data)
- Registration fees (from tournament pages)
- Airport/location data for travel estimates

### User-Provided Data
- Home airport
- Athletes (name, belt, age, gender, weight, gym)
- Budget and preferences

---

## Implementation Priority

### Phase 1: Core Paid Flow
1. Heart/wishlist functionality on tournament cards
2. Wishlist page
3. Profile/Athletes management
4. Season Planner (basic - budget, location, must-gos)

### Phase 2: AI & Travel
5. Travel cost estimation (registration + flights/driving)
6. AI schedule optimization
7. Swap/remove/regenerate functionality

### Phase 3: Live Features
8. Bracket scraping (Thursday/Friday)
9. Live Results page
10. Gym Schedule page

### Phase 4: Polish
11. Historical results
12. Gym following
13. Notifications (optional future)
