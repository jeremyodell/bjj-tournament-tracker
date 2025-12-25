# Tournament Tracker & Wishlist - Project Requirements

## Document Info
- **Version:** 1.0
- **Last Updated:** December 21, 2025
- **Status:** Requirements Gathering Complete - Ready for User Stories

---

## 1. Executive Summary

### Product Vision
A two-sided application for the BJJ community that helps **gyms** manage tournament attendance and communication, while helping **parents** plan, budget, and track their athletes' competitive seasons.

### Core Value Propositions

| User | Problem | Solution |
|------|---------|----------|
| **Gym Owner** | Communicating tournament plans to parents is manual and scattered | Select tournaments, generate AI-drafted email packets, view registered athletes on game day |
| **Parent** | Planning a competition season requires juggling multiple sites, spreadsheets, and budgets | Unified wishlist, budget optimizer, real-time schedule and result notifications |

### Platform
- AWS-native architecture
- Web application (mobile-responsive)
- Native mobile app for push notifications

---

## 2. User Types & Subscriptions

### 2.1 Parent (Tiered Subscription)

#### Free Tier
- View full tournament list (IBJJF, JJWL)
- Save tournaments to wishlist
- Manage athlete profiles (name, belt, age, weight, division)

#### Paid Tier
- Everything in Free, plus:
- Budget estimator per tournament (travel + registration + hotel)
- Budget optimizer ("$5k budget, build my schedule")
- Follow gyms and/or individual athletes
- Push notifications (registration deadlines, schedule releases, game day alerts, results)
- Schedule downloads filtered by gym
- Results tracking with manual entry (placement, submission, points, competitor count)

### 2.2 Gym Owner (Flat Monthly Subscription)
- Select tournaments the gym will attend (binary: going / not going)
- Generate AI-drafted email packets with selected tournaments
- View which gym athletes are registered (once data available from IBJJF/JJWL)
- Download gym-filtered schedules on game day
- **Post-MVP:** Assign coaches to mats or athletes

### 2.3 Coach (Post-MVP)
- Assigned by gym owner to specific mats or athletes
- Filtered view of assigned athletes' schedules
- Push notifications for assigned athletes

---

## 3. Domain Model

### 3.1 Entity Relationship Overview

```
┌─────────────────┐
│  Organization   │  (metadata only for MVP)
│─────────────────│
│ id              │
│ name            │
│ logo_url        │
└────────┬────────┘
         │ 1:many
         ▼
┌─────────────────┐       ┌─────────────────┐
│      Gym        │       │   Tournament    │
│─────────────────│       │─────────────────│
│ id              │       │ id              │
│ name            │       │ name            │
│ organization_id │       │ organization    │  (IBJJF, JJWL)
│ location        │       │ date_start      │
│ owner_email     │       │ date_end        │
│ subscription    │       │ location        │
└────────┬────────┘       │ venue           │
         │                │ registration_   │
         │                │   open_date     │
         │                │ registration_   │
         │                │   close_date    │
         │                │ early_fee       │
         │                │ regular_fee     │
         │                │ late_fee        │
         │                │ divisions[]     │
         │                └────────┬────────┘
         │                         │
         │    ┌────────────────────┤
         │    │                    │
         ▼    ▼                    ▼
┌─────────────────┐       ┌─────────────────┐
│ GymTournament   │       │    Schedule     │
│─────────────────│       │─────────────────│
│ gym_id          │       │ id              │
│ tournament_id   │       │ tournament_id   │
│ status (going)  │       │ athlete_name    │
│ created_at      │       │ gym_name        │
└─────────────────┘       │ division        │
                          │ mat_number      │
                          │ estimated_time  │
                          │ bracket_position│
                          │ status          │
                          │ last_updated    │
                          └─────────────────┘

┌─────────────────┐
│     Parent      │
│─────────────────│
│ id              │
│ email           │
│ home_address    │
│ nearest_airport │
│ subscription_   │
│   tier          │
│ gym_id (claimed)│  ◄── trust-based, self-declared
└────────┬────────┘
         │ 1:many
         ▼
┌─────────────────┐       ┌─────────────────┐
│    Athlete      │       │    Wishlist     │
│─────────────────│       │─────────────────│
│ id              │       │ id              │
│ parent_id       │       │ parent_id       │
│ name            │       │ athlete_id      │
│ belt_rank       │       │ tournament_id   │
│ age_division    │       │ status          │  (interested, registered, completed)
│ weight_class    │       │ cost_estimate   │
│ ibjjf_id        │  ◄── │ travel_mode     │  (drive, fly)
│   (optional)    │  for │ manual_overrides│
│ jjwl_id         │  future                │
│   (optional)    │  matching              │
└─────────────────┘       └────────┬────────┘
                                   │
                                   ▼ (when status = completed)
                          ┌─────────────────┐
                          │     Result      │
                          │─────────────────│
                          │ id              │
                          │ wishlist_id     │
                          │ placement       │  (gold, silver, bronze, etc.)
                          │ submission_type │
                          │ points_scored   │
                          │ competitor_count│
                          │ source          │  (manual, ibjjf_api, jjwl_api)
                          └─────────────────┘

┌─────────────────┐
│    Following    │
│─────────────────│
│ id              │
│ parent_id       │
│ follow_type     │  (gym, athlete)
│ target_id       │  (gym_id or external athlete identifier)
│ created_at      │
└─────────────────┘
```

### 3.2 Key Relationships

| Relationship | Type | Description |
|--------------|------|-------------|
| Organization → Gym | 1:many | A gym belongs to one org (or none) |
| Gym → GymTournament | 1:many | Gym's selected tournaments |
| Parent → Athlete | 1:many | Parent manages multiple children |
| Parent → Gym | many:1 | Parent claims membership (trust-based) |
| Parent → Wishlist | 1:many | Parent's tournament plans per athlete |
| Wishlist → Result | 1:1 | Completed tournaments have results |
| Parent → Following | 1:many | Parent follows gyms or athletes |
| Tournament → Schedule | 1:many | Tournament has many schedule entries |

---

## 4. Feature Specifications

### 4.1 Tournament Data Management

#### 4.1.1 Tournament Ingestion
- **Source:** IBJJF and JJWL (API + scraping fallback)
- **Data already loaded:** Full 2026 calendar
- **Sync frequency:** TBD for new tournaments; schedules sync Thursday/Friday before event
- **Extensibility:** Architecture must support adding new organizations

#### 4.1.2 Tournament Attributes
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Internal identifier |
| external_id | String | IBJJF/JJWL identifier |
| source_org | Enum | IBJJF, JJWL |
| name | String | |
| date_start | Date | |
| date_end | Date | |
| city | String | |
| state | String | |
| country | String | |
| venue_name | String | |
| venue_address | String | For distance calculations |
| registration_open | DateTime | |
| registration_close | DateTime | |
| early_bird_deadline | DateTime | |
| early_bird_fee | Decimal | |
| regular_fee | Decimal | |
| late_fee | Decimal | |
| divisions | JSON | Array of available age/belt/weight divisions |
| schedule_url | String | Link to official schedule |
| results_url | String | Link to official results |

---

### 4.2 Parent Features

#### 4.2.1 Athlete Profile Management
**User Story Context:** Parent manages their children's competition profiles.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| name | String | Yes | Display name |
| belt_rank | Enum | Yes | white, blue, purple, brown, black |
| age_division | String | Yes | e.g., "Juvenile 1", "Adult", "Master 2" |
| weight_class | String | Yes | e.g., "Rooster", "Light Feather" |
| ibjjf_id | String | No | For future automated matching |
| jjwl_id | String | No | For future automated matching |

**Acceptance Criteria:**
- Parent can add unlimited athletes to their account
- Parent can edit athlete details at any time
- Athlete profiles persist across sessions
- Dashboard shows all athletes in unified view

#### 4.2.2 Tournament Wishlist
**User Story Context:** Parent plans their family's competition calendar.

**Wishlist States:**
```
Interested → Registered → Completed
     │            │            │
     │            │            └── Results entry unlocked
     │            └── Manual confirmation by parent
     └── Added to planning, included in budget
```

**Per-Wishlist-Entry Data:**
| Field | Type | Notes |
|-------|------|-------|
| tournament_id | FK | |
| athlete_id | FK | Which child is competing |
| status | Enum | interested, registered, completed |
| travel_mode | Enum | drive, fly (auto-suggested, manually overridable) |
| cost_estimate | JSON | Breakdown of registration, travel, hotel |
| manual_overrides | JSON | Parent can override any cost component |
| notes | Text | Free-form parent notes |

**Acceptance Criteria:**
- Parent selects tournament, then selects which athlete(s) are attending
- Same tournament can have multiple athletes (siblings)
- Total cost auto-calculates across all wishlisted tournaments
- Parent can filter wishlist by athlete, date range, status

#### 4.2.3 Budget Estimator
**User Story Context:** Parent sees estimated cost for a specific tournament.

**Cost Components:**
| Component | Calculation Method |
|-----------|-------------------|
| Registration fee | From tournament data (early/regular/late based on current date) |
| Ground travel | Distance × $0.XX per mile (configurable) |
| Airfare | Nearest airport → destination airport estimate |
| Hotel | Tournament nights × average hotel rate for area |
| Per diem | Optional: configurable daily amount |

**Auto-Suggest Logic:**
- If distance < X miles → suggest drive
- If distance >= X miles → suggest fly
- Parent can override

**Acceptance Criteria:**
- Estimate calculates automatically when tournament added to wishlist
- Parent can override any component manually
- Estimate updates if tournament fees change
- Parent's home address and airport stored in profile

#### 4.2.4 Budget Optimizer (AI-Powered)
**User Story Context:** "I have $5,000 for the year. Build me an optimal tournament schedule."

**Input Parameters:**
| Parameter | Type | Required |
|-----------|------|----------|
| total_budget | Decimal | Yes |
| date_range_start | Date | Yes |
| date_range_end | Date | Yes |
| min_tournaments_per_month | Integer | No (default: 0) |
| max_tournaments_per_month | Integer | No (default: unlimited) |
| preferred_organizations | Array | No (default: all) |
| athlete_id | FK | Yes (to filter by eligible divisions) |
| home_location | Address | From profile |
| nearest_airport | Airport code | From profile |

**Output:**
1. **Recommended Plan:** Single best schedule that maximizes tournaments within budget
2. **Alternative Options:** 2-3 variations (e.g., fewer tournaments with buffer, regional focus, etc.)
3. **Per-Tournament Breakdown:** Registration + travel + hotel for each
4. **Total Cost:** Sum with comparison to budget

**Acceptance Criteria:**
- Optimizer filters tournaments by athlete's eligible divisions
- Optimizer respects all constraints
- Parent can tweak parameters and re-run
- Parent can accept a plan (adds all tournaments to wishlist as "interested")

#### 4.2.5 Following (Gyms & Athletes)
**User Story Context:** Parent wants updates on other gyms or specific competitors.

**Follow Types:**
| Type | What Parent Sees |
|------|------------------|
| Follow Gym | Schedule + results for ALL athletes from that gym |
| Follow Athlete | Schedule + results for that specific athlete only |

**Data Access Rules:**
- Following only provides access to PUBLIC data (from IBJJF/JJWL)
- Following does NOT expose internal gym data (which tournaments gym selected, etc.)
- No privacy opt-out; all data is scraped from public sources

**Acceptance Criteria:**
- Parent can search for gyms by name
- Parent can search for athletes by name
- Parent can follow unlimited gyms/athletes
- Followed entities appear in notification preferences
- Parent can unfollow at any time

#### 4.2.6 Schedule & Results Tracking
**User Story Context:** Parent tracks their athletes and followed entities on game day.

**Schedule View:**
- Displays all schedule entries for:
  - Parent's own athletes (via wishlist → registered tournaments)
  - Followed gyms (all their athletes)
  - Followed individual athletes
- Filterable by: tournament, athlete, gym, time range
- Downloadable as PDF or calendar file

**Results View:**
- Real-time updates during tournament (5-minute polling)
- Manual entry for parent's own athletes
- Auto-populated when available from IBJJF/JJWL

**Result Data:**
| Field | Type |
|-------|------|
| placement | Enum (gold, silver, bronze, 4th, etc.) |
| submission_type | String (optional) |
| points_scored | Integer |
| competitor_count | Integer |

**Acceptance Criteria:**
- Schedule updates every 5 minutes on game day
- Parent receives push notification when tracked athlete is ~30 min from competing
- Parent can manually enter results if not auto-populated
- Results persist historically for athlete record

---

### 4.3 Gym Owner Features

#### 4.3.1 Tournament Selection
**User Story Context:** Gym owner marks which tournaments the gym will attend.

**Functionality:**
- View full tournament list (same as parents)
- Toggle "Going" status (binary for MVP)
- Filter by date, location, organization

**Acceptance Criteria:**
- Owner can select/deselect tournaments at any time
- Selected tournaments appear in gym's "calendar" view
- Changes trigger notification to gym members (paid parents who claimed this gym) — **Post-MVP**

#### 4.3.2 AI Email Packet Generator
**User Story Context:** Gym owner wants to communicate tournament plans to parents.

**Workflow:**
1. Owner selects one or more tournaments
2. System generates AI-drafted email including:
   - List of tournaments with dates, locations, registration deadlines
   - Estimated costs (optional)
   - Call-to-action (customizable)
3. Owner can edit/customize the draft
4. Owner downloads as PDF or copies email text
5. Owner sends via their own email system (not our CRM)

**Packet Contents:**
- Cover letter (AI-generated, editable)
- Tournament table:
  - Name
  - Dates
  - Location
  - Registration deadline
  - Fees
- Optional: gym branding (logo, colors)

**Acceptance Criteria:**
- AI generates coherent, professional email draft
- Owner can regenerate if unsatisfied
- Owner can manually edit any content
- Export as PDF or copyable text
- Owner can generate quarterly, annually, or ad-hoc

#### 4.3.3 Registered Athletes View
**User Story Context:** Gym owner sees which of their athletes registered for a tournament.

**Data Source:** IBJJF/JJWL registration data (when available)

**Functionality:**
- For each selected tournament, show list of registered athletes from this gym
- Requires matching gym name in IBJJF/JJWL data to our gym record

**Matching Logic (MVP):**
- Fuzzy match on gym name
- Manual confirmation if ambiguous

**Acceptance Criteria:**
- Registration list populates when data available from source
- Owner can see athlete name, division, registration date
- Owner can download as PDF/CSV

#### 4.3.4 Game Day Schedule View
**User Story Context:** Gym owner needs consolidated view of when all gym athletes compete.

**Functionality:**
- Aggregated schedule for all gym athletes at a given tournament
- Sortable by time, mat, athlete name
- Real-time updates (5-minute polling)

**Acceptance Criteria:**
- Schedule is filterable by mat number
- Schedule is downloadable as PDF
- "Upcoming" section shows next 60 minutes of matches

---

### 4.4 Coach Features (Post-MVP)

#### 4.4.1 Coach Assignment
- Gym owner assigns coaches to:
  - Specific mats (coach monitors all action on that mat)
  - Specific athletes (coach follows that athlete regardless of mat)
  - Auto-assign (system distributes athletes across available coaches)

#### 4.4.2 Coach Notifications
- Push notifications when assigned athlete is ~30 min from competing
- Filtered view showing only assigned athletes

#### 4.4.3 Auto-Assign Logic (TBD)
- Options: round-robin, load balance by match count, belt-rank affinity
- Requires further requirements gathering

---

### 4.5 Notifications

#### 4.5.1 Notification Types

| Notification | Trigger | Channels | User Types |
|--------------|---------|----------|------------|
| Registration deadline approaching | X days before close | Email, Push | Parent (paid) |
| Fee change | Tournament updates fees | Email | Parent (paid) |
| Schedule released | Thursday/Friday before tournament | Email, Push | Parent (paid), Gym Owner |
| Game day: athlete competing soon | Athlete's match in ~30 min | Push | Parent (paid), following users |
| Result recorded | Match complete (5-min lag) | Push | Parent (paid), following users |
| Gym selected new tournament | Gym owner toggles "going" | Email | Gym members — **Post-MVP** |

#### 4.5.2 Notification Preferences
- Users can enable/disable per notification type
- Users can choose channel per type (email only, push only, both)

#### 4.5.3 Implementation Notes
- Email: Amazon SES or SNS
- Push: Amazon Pinpoint or SNS + mobile app integration
- Must handle timezone conversion for game day alerts

---

## 5. Data Sync & Integration

### 5.1 Tournament Data Pipeline

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  IBJJF / JJWL   │────▶│  Ingestion      │────▶│   DynamoDB /    │
│  (API + Scrape) │     │  Lambda         │     │   Aurora        │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌─────────────────┐
                        │  Normalization  │
                        │  (unified       │
                        │   schema)       │
                        └─────────────────┘
```

**Sync Frequencies:**
| Data Type | Frequency |
|-----------|-----------|
| Tournament list | Daily (or on-demand when new events posted) |
| Registration data | Daily (when available) |
| Schedules | Once when released (Thu/Fri), then every 5 min on game day |
| Results | Every 5 min during tournament |

### 5.2 Schedule Sync on Game Day

```
EventBridge (every 5 min)
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│  Schedule Sync  │────▶│  Detect Changes │
│  Lambda         │     │                 │
└─────────────────┘     └────────┬────────┘
                                 │
                     ┌───────────┴───────────┐
                     ▼                       ▼
              ┌─────────────┐         ┌─────────────┐
              │  Update DB  │         │  Fan-out    │
              │             │         │  Notifier   │
              └─────────────┘         └──────┬──────┘
                                             │
                                    ┌────────┴────────┐
                                    ▼                 ▼
                              ┌──────────┐      ┌──────────┐
                              │  Email   │      │   Push   │
                              │  (SES)   │      │(Pinpoint)│
                              └──────────┘      └──────────┘
```

### 5.3 Athlete Matching Strategy

**MVP:** Manual confirmation by parent
- When schedule shows "Johnny Smith - XYZ Academy"
- Parent with athlete "Johnny Smith" at gym "XYZ Academy" sees prompt to confirm match
- Match stored for future auto-resolution

**Future:**
- IBJJF/JJWL member ID stored on athlete profile
- Exact match on ID eliminates confirmation step

---

## 6. Technical Architecture (AWS)

### 6.1 Service Mapping

| Feature | AWS Services |
|---------|--------------|
| **Authentication** | Amazon Cognito (user pools, social login ready) |
| **Frontend Hosting** | AWS Amplify Hosting or S3 + CloudFront |
| **API Layer** | Amazon API Gateway + Lambda |
| **Database** | Amazon DynamoDB (single-table design) or Aurora Serverless v2 |
| **File Storage** | Amazon S3 (email packet PDFs, schedule downloads) |
| **AI (Email Generation)** | Amazon Bedrock (Claude) |
| **AI (Budget Optimizer)** | Amazon Bedrock (Claude) |
| **Scheduled Jobs** | Amazon EventBridge + Lambda |
| **Notifications - Email** | Amazon SES |
| **Notifications - Push** | Amazon Pinpoint |
| **Secrets Management** | AWS Secrets Manager |
| **Monitoring** | Amazon CloudWatch |

### 6.2 High-Level Architecture Diagram

```
                                    ┌─────────────────────────────────────┐
                                    │           Amazon Cognito            │
                                    │         (Authentication)            │
                                    └──────────────────┬──────────────────┘
                                                       │
┌──────────────────┐                                   │
│   Web/Mobile     │◀──────────────────────────────────┤
│   Frontend       │                                   │
│  (Amplify/S3+CF) │                                   │
└────────┬─────────┘                                   │
         │                                             │
         ▼                                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         Amazon API Gateway                              │
└────────┬──────────────────────────────────────────────────────┬─────────┘
         │                                                      │
         ▼                                                      ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  User Lambda    │  │ Tournament      │  │  Budget         │  │  Notification   │
│  (CRUD users,   │  │ Lambda          │  │  Optimizer      │  │  Lambda         │
│   athletes,     │  │ (list, filter,  │  │  Lambda         │  │  (fanout)       │
│   wishlists)    │  │  wishlist)      │  │  (Bedrock)      │  │                 │
└────────┬────────┘  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘
         │                    │                    │                    │
         └──────────┬─────────┴─────────┬──────────┘                    │
                    ▼                   ▼                               │
         ┌─────────────────┐  ┌─────────────────┐                       │
         │    DynamoDB     │  │ Amazon Bedrock  │                       │
         │   (all data)    │  │ (Claude/Nova)   │                       │
         └─────────────────┘  └─────────────────┘                       │
                                                                        │
                    ┌───────────────────────────────────────────────────┘
                    │
         ┌──────────┴──────────┐
         ▼                     ▼
┌─────────────────┐   ┌─────────────────┐
│   Amazon SES    │   │ Amazon Pinpoint │
│   (Email)       │   │ (Push)          │
└─────────────────┘   └─────────────────┘

                    ┌─────────────────────────────────────┐
                    │        Async / Scheduled Jobs       │
                    └─────────────────────────────────────┘
                                       │
         ┌─────────────────────────────┼─────────────────────────────┐
         ▼                             ▼                             ▼
┌─────────────────┐         ┌─────────────────┐           ┌─────────────────┐
│ Tournament Sync │         │  Schedule Sync  │           │  Results Sync   │
│ Lambda          │         │  Lambda         │           │  Lambda         │
│ (daily)         │         │  (5 min game    │           │  (5 min game    │
│                 │         │   day)          │           │   day)          │
└────────┬────────┘         └────────┬────────┘           └────────┬────────┘
         │                           │                             │
         └───────────────────────────┼─────────────────────────────┘
                                     ▼
                          ┌─────────────────┐
                          │  EventBridge    │
                          │  (Scheduler)    │
                          └─────────────────┘
```

### 6.3 DynamoDB Table Design (Single-Table)

**Partition Key (PK) / Sort Key (SK) Patterns:**

| Entity | PK | SK | Attributes |
|--------|----|----|------------|
| Parent | `PARENT#<id>` | `PROFILE` | email, home_address, airport, subscription, gym_id |
| Athlete | `PARENT#<id>` | `ATHLETE#<id>` | name, belt, age_div, weight |
| Wishlist | `PARENT#<id>` | `WISH#<tournament_id>#<athlete_id>` | status, cost_estimate, travel_mode |
| Result | `PARENT#<id>` | `RESULT#<wishlist_id>` | placement, submission, points, competitors |
| Following | `PARENT#<id>` | `FOLLOW#<type>#<target_id>` | created_at |
| Gym | `GYM#<id>` | `PROFILE` | name, org_id, location, owner_email, subscription |
| GymTournament | `GYM#<id>` | `TOURN#<tournament_id>` | status, created_at |
| Tournament | `TOURN#<id>` | `META` | all tournament fields |
| Tournament by Date | `TOURN_DATE#<yyyy-mm>` | `<date>#<id>` | (GSI for date-range queries) |
| Schedule Entry | `SCHED#<tournament_id>` | `<gym_name>#<athlete_name>` | mat, time, division, status |
| Organization | `ORG#<id>` | `PROFILE` | name, logo_url |

**Global Secondary Indexes (GSIs):**
1. **GSI1:** Query tournaments by date range
2. **GSI2:** Query schedule by gym name
3. **GSI3:** Query wishlists by tournament (for popularity metrics)

---

## 7. User Journeys

### 7.1 Parent: Onboarding → First Wishlist

```
1. Parent visits site
2. Creates account (email/password or social login via Cognito)
3. Selects subscription tier (free or paid)
4. If paid: Stripe checkout
5. Adds home address + nearest airport to profile
6. Optionally claims gym membership (search by name, self-declare)
7. Adds first athlete (name, belt, age, weight)
8. Browses tournament list
9. Adds tournament to wishlist, selects athlete(s) attending
10. System calculates cost estimate
11. Parent views wishlist dashboard with total projected cost
```

### 7.2 Parent: Budget Optimizer

```
1. Parent navigates to "Plan My Season"
2. Enters: budget, date range, min/max per month, preferred orgs
3. Selects athlete (for division filtering)
4. Clicks "Optimize"
5. System calls Bedrock with constraints + tournament data
6. System returns recommended plan + alternatives
7. Parent reviews, adjusts parameters if needed, re-runs
8. Parent accepts plan → all tournaments added to wishlist as "interested"
```

### 7.3 Parent: Game Day

```
1. Parent receives push notification: "Schedule released for Dallas Open"
2. Opens app, views schedule for their athletes
3. Receives push: "Johnny competes in ~30 min on Mat 5"
4. Watches match (in person or remotely)
5. If results not auto-populated, manually enters: Gold, armbar, 8 points, 6 competitors
6. Results saved to athlete history
```

### 7.4 Gym Owner: Tournament Selection & Email Packet

```
1. Gym owner logs in
2. Navigates to tournament list
3. Filters by date range, location radius
4. Toggles "Going" on 5 tournaments for Q1
5. Clicks "Generate Email Packet"
6. System calls Bedrock to draft email
7. Owner reviews, edits gym name and sign-off
8. Downloads PDF or copies email text
9. Sends via their own email system to parent list
```

### 7.5 Gym Owner: Game Day

```
1. Gym owner receives push: "Schedule released for Dallas Open"
2. Opens app, views consolidated gym schedule
3. Sees 12 athletes competing across 6 mats
4. Downloads PDF to print for coaching staff
5. Monitors "Upcoming" panel throughout day
6. Post-MVP: Assigns coaches to mats, coaches get their own alerts
```

---

## 8. API Endpoints (Draft)

### 8.1 Authentication
| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/register` | Create account |
| POST | `/auth/login` | Login (Cognito) |
| POST | `/auth/refresh` | Refresh token |

### 8.2 Parent
| Method | Path | Description |
|--------|------|-------------|
| GET | `/parents/me` | Get current parent profile |
| PUT | `/parents/me` | Update profile (address, airport, gym) |
| GET | `/parents/me/athletes` | List athletes |
| POST | `/parents/me/athletes` | Add athlete |
| PUT | `/parents/me/athletes/{id}` | Update athlete |
| DELETE | `/parents/me/athletes/{id}` | Remove athlete |

### 8.3 Wishlist
| Method | Path | Description |
|--------|------|-------------|
| GET | `/wishlist` | List all wishlist entries |
| POST | `/wishlist` | Add tournament to wishlist |
| PUT | `/wishlist/{id}` | Update status, cost overrides |
| DELETE | `/wishlist/{id}` | Remove from wishlist |
| POST | `/wishlist/{id}/result` | Add result (when completed) |

### 8.4 Budget
| Method | Path | Description |
|--------|------|-------------|
| POST | `/budget/estimate` | Get cost estimate for single tournament |
| POST | `/budget/optimize` | Run budget optimizer |

### 8.5 Tournaments
| Method | Path | Description |
|--------|------|-------------|
| GET | `/tournaments` | List tournaments (filterable) |
| GET | `/tournaments/{id}` | Get tournament details |
| GET | `/tournaments/{id}/schedule` | Get schedule (filterable by gym) |
| GET | `/tournaments/{id}/registrations` | Get registrations (gym owner, filtered to their gym) |

### 8.6 Gym
| Method | Path | Description |
|--------|------|-------------|
| GET | `/gyms/me` | Get current gym profile |
| PUT | `/gyms/me` | Update gym profile |
| GET | `/gyms/me/tournaments` | List gym's selected tournaments |
| POST | `/gyms/me/tournaments/{id}` | Mark tournament as "going" |
| DELETE | `/gyms/me/tournaments/{id}` | Remove "going" status |
| POST | `/gyms/me/email-packet` | Generate AI email packet |

### 8.7 Following
| Method | Path | Description |
|--------|------|-------------|
| GET | `/following` | List followed gyms/athletes |
| POST | `/following` | Follow a gym or athlete |
| DELETE | `/following/{id}` | Unfollow |

### 8.8 Notifications
| Method | Path | Description |
|--------|------|-------------|
| GET | `/notifications/preferences` | Get notification preferences |
| PUT | `/notifications/preferences` | Update preferences |

---

## 9. Milestones & Phasing

### Phase 1: Foundation (Weeks 1-3)
- [ ] AWS account setup, Cognito configuration
- [ ] DynamoDB table creation with access patterns
- [ ] Basic Lambda + API Gateway scaffolding
- [ ] Parent registration & authentication
- [ ] Athlete CRUD
- [ ] Gym owner registration & authentication

### Phase 2: Core Tournament Features (Weeks 4-6)
- [ ] Tournament data model & seed 2026 data
- [ ] Tournament list API with filtering
- [ ] Wishlist CRUD (add, update status, remove)
- [ ] Basic cost estimator (registration + distance-based travel)
- [ ] Gym tournament selection (going/not going)

### Phase 3: Budget Optimizer (Weeks 7-8)
- [ ] Bedrock integration for optimization
- [ ] Optimizer prompt engineering
- [ ] Optimizer API endpoint
- [ ] "Accept plan" → bulk wishlist add

### Phase 4: Schedule & Results (Weeks 9-11)
- [ ] Schedule ingestion pipeline (Lambda + EventBridge)
- [ ] Schedule storage & query APIs
- [ ] Results ingestion pipeline
- [ ] Manual result entry for parents
- [ ] Schedule download (PDF generation)

### Phase 5: Notifications (Weeks 12-13)
- [ ] SES integration for email
- [ ] Pinpoint integration for push
- [ ] Notification preference management
- [ ] Deadline reminder jobs
- [ ] Game day alert fanout

### Phase 6: AI Email Packet (Week 14)
- [ ] Bedrock integration for email drafting
- [ ] Email packet API
- [ ] PDF generation for packet download

### Phase 7: Following & Public Tracking (Weeks 15-16)
- [ ] Following model & APIs
- [ ] Schedule/results visibility for followed entities
- [ ] Notification fanout for followed entities

### Phase 8: Polish & Launch Prep (Weeks 17-18)
- [ ] End-to-end testing
- [ ] Performance optimization
- [ ] Monitoring & alerting setup
- [ ] Documentation
- [ ] Beta launch to single gym

---

## 10. Open Questions & Deferred Decisions

| Item | Status | Notes |
|------|--------|-------|
| Athlete matching logic | Deferred | Manual confirmation for MVP; future: IBJJF/JJWL IDs |
| Schedule data structure | Pending | Awaiting investigation of IBJJF/JJWL schedule format |
| Registration data availability | Pending | Depends on API/scraping capabilities |
| Auto-assign coach logic | Post-MVP | Requires further requirements gathering |
| Pricing tiers (parent) | Pending | Need to define feature gates per tier |
| Mobile app technology | Pending | React Native? Flutter? PWA? |
| Affiliate/referral program | Not discussed | May be relevant for gym acquisition |

---

## 11. Glossary

| Term | Definition |
|------|------------|
| **Athlete** | A competitor (adult or minor) managed by a parent account |
| **Belt Rank** | BJJ belt level: white, blue, purple, brown, black |
| **Division** | Competition category combining age, belt, and weight |
| **Following** | A parent tracking a gym or athlete for schedule/result updates |
| **GymTournament** | Junction entity indicating a gym is "going" to a tournament |
| **IBJJF** | International Brazilian Jiu-Jitsu Federation |
| **JJWL** | Jiu-Jitsu World League |
| **Wishlist** | A parent's planned tournaments for an athlete (interested → registered → completed) |
| **Packet** | AI-generated email document with tournament details for gym communication |

---

## 12. Appendix

### A. Sample Tournament Data (IBJJF)

```json
{
  "id": "ibjjf-2026-dallas-open",
  "source_org": "IBJJF",
  "name": "Dallas International Open",
  "date_start": "2026-03-14",
  "date_end": "2026-03-15",
  "city": "Dallas",
  "state": "TX",
  "country": "USA",
  "venue_name": "Dallas Convention Center",
  "venue_address": "650 S Griffin St, Dallas, TX 75202",
  "registration_open": "2026-01-15T00:00:00Z",
  "registration_close": "2026-03-10T23:59:59Z",
  "early_bird_deadline": "2026-02-15T23:59:59Z",
  "early_bird_fee": 95.00,
  "regular_fee": 115.00,
  "late_fee": 135.00,
  "divisions": [
    {"age": "Juvenile 1", "belt": "white", "weight": "Rooster"},
    {"age": "Juvenile 1", "belt": "white", "weight": "Light Feather"},
    {"age": "Adult", "belt": "blue", "weight": "Feather"}
  ]
}
```

### B. Sample Wishlist Entry

```json
{
  "id": "wish-12345",
  "parent_id": "parent-67890",
  "athlete_id": "athlete-11111",
  "tournament_id": "ibjjf-2026-dallas-open",
  "status": "interested",
  "travel_mode": "drive",
  "cost_estimate": {
    "registration": 95.00,
    "travel": 120.00,
    "hotel": 0,
    "per_diem": 50.00,
    "total": 265.00
  },
  "manual_overrides": {},
  "notes": "Staying with grandparents, no hotel needed"
}
```

### C. Sample Budget Optimizer Request

```json
{
  "total_budget": 5000.00,
  "date_range_start": "2026-01-01",
  "date_range_end": "2026-12-31",
  "min_tournaments_per_month": 0,
  "max_tournaments_per_month": 2,
  "preferred_organizations": ["IBJJF", "JJWL"],
  "athlete_id": "athlete-11111",
  "home_location": {
    "address": "123 Main St, Houston, TX 77001",
    "nearest_airport": "IAH"
  }
}
```

### D. Sample Budget Optimizer Response

```json
{
  "recommended_plan": {
    "tournaments": [
      {
        "tournament_id": "ibjjf-2026-houston-open",
        "name": "Houston International Open",
        "date": "2026-02-21",
        "cost": {
          "registration": 95.00,
          "travel": 0,
          "hotel": 0,
          "total": 95.00
        }
      },
      {
        "tournament_id": "ibjjf-2026-dallas-open",
        "name": "Dallas International Open",
        "date": "2026-03-14",
        "cost": {
          "registration": 95.00,
          "travel": 120.00,
          "hotel": 0,
          "total": 215.00
        }
      }
    ],
    "total_cost": 4850.00,
    "tournament_count": 12,
    "remaining_budget": 150.00
  },
  "alternatives": [
    {
      "name": "Regional Focus",
      "description": "Fewer tournaments, all within 300 miles",
      "total_cost": 3200.00,
      "tournament_count": 8
    },
    {
      "name": "Maximum Exposure",
      "description": "One national-level event per quarter",
      "total_cost": 4950.00,
      "tournament_count": 10
    }
  ]
}
```
