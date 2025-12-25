# Use Case 1: Tournament Viewing & Wishlist

## Document Info
- **Version:** 0.1 (Draft - Pending Clarification)
- **Created:** December 23, 2025
- **Status:** Clarifying Questions

---

## 1. Use Case Summary

**Core User Flow:**
A parent can browse all available tournaments (IBJJF, JJWL) and add selected tournaments to a personal wishlist for planning purposes.

**Actors:**
- Anonymous visitor (can browse)
- Authenticated parent (can browse + wishlist)

**Scope for This Analysis:**
- User registration and authentication
- Tournament listing and filtering
- Wishlist management (add/remove/view)
- Basic athlete profile creation (required for wishlist context)

---

## 2. Clarifying Questions

Before proceeding with detailed design, the following questions need answers:

### 2.1 Authentication & Identity

| # | Question | Why It Matters | Options |
|---|----------|----------------|---------|
| Q1 | Should we use AWS Cognito (per requirements) or adapt the existing JWT-based auth from the prototype? | Affects architecture, cost, and development time | A) Cognito from scratch, B) Port prototype auth, C) Cognito with prototype patterns |
| Q2 | Which social login providers should be supported for MVP? | Cognito setup and frontend OAuth flows differ by provider | A) Google only, B) Google + Apple, C) Google + Apple + Facebook, D) Email/password only for MVP |
| Q3 | Is email verification required before a user can wishlist? | Impacts onboarding friction vs. data quality | A) Required, B) Optional (prompt later), C) Not required |
| Q4 | Should passwords have specific complexity requirements? | Security vs. UX balance | A) Standard (8+ chars, mixed case, number), B) Minimal (8+ chars), C) NIST guidelines (no complexity, length only) |

### 2.2 User Registration & Onboarding

| # | Question | Why It Matters | Options |
|---|----------|----------------|---------|
| Q5 | For MVP, can a user wishlist tournaments before completing their full profile (home address, airport)? | Address/airport are needed for cost estimation but may not be needed for basic wishlist | A) Required upfront, B) Prompt when adding to wishlist, C) Completely optional for MVP |
| Q6 | Can a user wishlist tournaments before creating any athlete profiles? | Determines if wishlist is "tournament-only" or "tournament+athlete" from day one | A) Must create athlete first, B) Can wishlist tournament, then assign athlete later |
| Q7 | When claiming gym membership, is any validation performed? | Trust-based per requirements, but confirming scope | A) Pure trust (self-declare), B) Email domain matching, C) Gym owner approval |

### 2.3 Tournament Data

| # | Question | Why It Matters | Options |
|---|----------|----------------|---------|
| Q8 | The requirements mention "2026 data already loaded." Should we use static seeded data or live API fetching for MVP? | Affects data freshness and API reliability concerns | A) Static seed only, B) Live fetching + fallback to seed, C) Live fetching only |
| Q9 | The requirements specify additional fields (registration fees, early/late deadlines, divisions) that the current fetchers don't capture. What's the MVP data scope? | Scraper enhancement effort vs. feature completeness | A) Use existing fetcher data (name, dates, city, gi/nogi), B) Enhance fetchers to capture fees/deadlines, C) Manual data entry for missing fields |
| Q10 | How should we handle tournaments that exist in both IBJJF and JJWL systems (if any)? | Deduplication strategy | A) Show both, B) Prefer one source, C) Merge records |
| Q11 | Should tournament data include estimated hotel costs and travel distances for MVP? | Cost estimation feature scope | A) Yes (pre-compute), B) Calculate on-demand when wishlisted, C) Defer to Phase 2 |

### 2.4 Wishlist Behavior

| # | Question | Why It Matters | Options |
|---|----------|----------------|---------|
| Q12 | Can a parent add the same tournament multiple times for different athletes (siblings)? | Data model: one wishlist entry per tournament vs. per tournament+athlete | A) Yes, per-athlete entries, B) No, one entry with multiple athletes attached |
| Q13 | What happens when an anonymous user tries to add to wishlist? | UX flow for conversion | A) Prompt login/register immediately, B) Store in localStorage, sync after login, C) Block with message |
| Q14 | Should the initial wishlist status be "Interested" or should the user select a status? | Workflow simplicity | A) Always "Interested", B) Let user choose, C) Smart default based on registration dates |
| Q15 | Is there a maximum number of tournaments a user can wishlist? | Prevent abuse, manage costs | A) Unlimited, B) Free tier limit (e.g., 10), C) Per-athlete limit |
| Q16 | Should wishlist entries include notes from day one? | Feature scope | A) Yes, notes field available, B) No, add in Phase 2 |

### 2.5 Frontend & UX

| # | Question | Why It Matters | Options |
|---|----------|----------------|---------|
| Q17 | Mobile-first or desktop-first responsive design? | CSS/component architecture approach | A) Mobile-first, B) Desktop-first, C) Simultaneous (design system) |
| Q18 | Is there a preferred UI component library or design system? | Consistency, development speed | A) Tailwind + Headless UI, B) Material UI, C) shadcn/ui, D) Custom from scratch |
| Q19 | Should the tournament list support map view in addition to list view? | Geospatial UX, complexity | A) List only for MVP, B) List + map, C) List + calendar view |
| Q20 | Pagination or infinite scroll for tournament list? | UX pattern, implementation approach | A) Pagination, B) Infinite scroll, C) "Load more" button |

### 2.6 Security & Compliance

| # | Question | Why It Matters | Options |
|---|----------|----------------|---------|
| Q21 | Are there COPPA compliance requirements since athletes may be minors? | Legal, data handling, consent flows | A) Yes, full COPPA compliance, B) Parent consent flow only, C) Not applicable (parent is data subject) |
| Q22 | Is GDPR compliance required for EU users? | Data processing, right to deletion, consent | A) Yes, full GDPR, B) Block EU for MVP, C) Not required |
| Q23 | Should API endpoints be rate-limited? How aggressively? | Abuse prevention, cost control | A) Aggressive (10 req/min), B) Moderate (60 req/min), C) Light (300 req/min) |
| Q24 | Should we implement CAPTCHA for registration? | Bot prevention vs. UX friction | A) Yes (reCAPTCHA v3), B) Yes but only after failed attempts, C) No for MVP |

### 2.7 Database & Infrastructure

| # | Question | Why It Matters | Options |
|---|----------|----------------|---------|
| Q25 | Requirements specify DynamoDB single-table design. The prototype uses PostgreSQL/Prisma. Which approach for the new build? | Major architectural decision | A) DynamoDB single-table, B) DynamoDB multi-table, C) Aurora PostgreSQL Serverless, D) RDS PostgreSQL |
| Q26 | Should we design for Lambda (serverless) or container-based (ECS/Fargate) backend? | Cost model, cold starts, architectural patterns | A) Lambda + API Gateway, B) ECS/Fargate, C) Hybrid (Lambda for async, containers for API) |
| Q27 | For file storage (user avatars, future PDF exports), confirm S3 is the target? | Standard AWS pattern | A) Yes, S3, B) CloudFront + S3, C) Defer file storage to later |

### 2.8 Cost Estimation (Scope Clarification)

| # | Question | Why It Matters | Options |
|---|----------|----------------|---------|
| Q28 | Should the MVP wishlist include basic cost estimation, or is that strictly Phase 2? | Feature scope, API integrations needed | A) Include basic estimate (registration fee only), B) Include full estimate (registration + travel + hotel), C) No estimation for MVP |
| Q29 | If cost estimation is included, what's the source for travel costs? | API dependency | A) Google Maps API (distance), B) Simple distance calculation, C) Manual entry by user |
| Q30 | If cost estimation is included, what's the source for hotel costs? | API dependency | A) Google Hotels API, B) Average per-city static data, C) User-entered estimate |

---

## 3. Assumptions (Pending Confirmation)

The following assumptions are made provisionally. If any are incorrect, please flag:

| # | Assumption | Rationale | Impact if Wrong |
|---|------------|-----------|-----------------|
| A1 | The "parent" user type is the only user type for Use Case 1 (gym owners handled separately) | Requirements show distinct user types | Would need to add gym owner auth flows |
| A2 | Free tier parents can wishlist tournaments (paid tier adds cost estimation) | Requirements show wishlist in free tier | May need to gate wishlist behind payment |
| A3 | Athletes are children/minors managed by parents, not self-registering adults | Terminology in requirements | Adult athletes might need different profile model |
| A4 | Tournament data is read-only for all users (no user-submitted tournaments) | Requirements show IBJJF/JJWL as sources | Would need moderation system if user-submitted |
| A5 | The wishlist is private to each parent (not shared/public) | No sharing mentioned in requirements | Would need visibility controls |
| A6 | Session duration follows standard web practices (e.g., 24h active, 7d remember me) | Not specified | May need stricter/looser session handling |

---

## 4. Technical Components (High-Level)

Pending question resolution, here's the anticipated component breakdown:

### 4.1 Authentication Layer

```
┌─────────────────────────────────────────────────────────────────┐
│                        Amazon Cognito                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │ User Pool   │  │ Identity    │  │ Social      │             │
│  │ (email/pw)  │  │ Pool        │  │ Providers   │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API Gateway                                │
│  • JWT validation via Cognito Authorizer                       │
│  • Rate limiting                                                │
│  • CORS configuration                                           │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 API Endpoints (Use Case 1)

| Category | Method | Path | Auth Required | Description |
|----------|--------|------|---------------|-------------|
| **Auth** | POST | `/auth/register` | No | Create parent account |
| **Auth** | POST | `/auth/login` | No | Login, return tokens |
| **Auth** | POST | `/auth/refresh` | Refresh token | Refresh access token |
| **Auth** | POST | `/auth/logout` | Yes | Invalidate session |
| **Profile** | GET | `/parents/me` | Yes | Get current parent profile |
| **Profile** | PUT | `/parents/me` | Yes | Update profile |
| **Athletes** | GET | `/parents/me/athletes` | Yes | List parent's athletes |
| **Athletes** | POST | `/parents/me/athletes` | Yes | Create athlete |
| **Athletes** | PUT | `/parents/me/athletes/{id}` | Yes | Update athlete |
| **Athletes** | DELETE | `/parents/me/athletes/{id}` | Yes | Delete athlete |
| **Tournaments** | GET | `/tournaments` | No | List tournaments (public) |
| **Tournaments** | GET | `/tournaments/{id}` | No | Get tournament details |
| **Wishlist** | GET | `/wishlist` | Yes | List user's wishlist |
| **Wishlist** | POST | `/wishlist` | Yes | Add to wishlist |
| **Wishlist** | PUT | `/wishlist/{id}` | Yes | Update wishlist entry |
| **Wishlist** | DELETE | `/wishlist/{id}` | Yes | Remove from wishlist |

### 4.3 Data Model (DynamoDB Single-Table - Provisional)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ PK                    │ SK                              │ Attributes         │
├──────────────────────────────────────────────────────────────────────────────┤
│ PARENT#<cognito_sub>  │ PROFILE                         │ email, name,       │
│                       │                                 │ subscription_tier, │
│                       │                                 │ home_address,      │
│                       │                                 │ nearest_airport,   │
│                       │                                 │ gym_id, created_at │
├──────────────────────────────────────────────────────────────────────────────┤
│ PARENT#<cognito_sub>  │ ATHLETE#<athlete_id>            │ name, belt_rank,   │
│                       │                                 │ age_division,      │
│                       │                                 │ weight_class       │
├──────────────────────────────────────────────────────────────────────────────┤
│ PARENT#<cognito_sub>  │ WISH#<tournament_id>#<athlete_id>│ status, travel_mode│
│                       │                                 │ cost_estimate,     │
│                       │                                 │ notes, created_at  │
├──────────────────────────────────────────────────────────────────────────────┤
│ TOURN#<id>            │ META                            │ name, org, city,   │
│                       │                                 │ start_date, end_date│
│                       │                                 │ gi, nogi, fees...  │
├──────────────────────────────────────────────────────────────────────────────┤
│ TOURN_DATE#<yyyy-mm>  │ <date>#<id>                     │ (GSI for date range│
│                       │                                 │  queries)          │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 4.4 Frontend Component Tree

```
App
├── Routes
│   ├── / (Home)
│   │   └── TournamentListPage
│   │       ├── FilterBar
│   │       │   ├── DateRangeFilter
│   │       │   ├── OrgFilter (IBJJF/JJWL)
│   │       │   ├── LocationFilter
│   │       │   └── EventTypeFilter (Gi/NoGi/Kids)
│   │       ├── TournamentGrid/List
│   │       │   └── TournamentCard
│   │       │       ├── TournamentInfo
│   │       │       └── WishlistButton
│   │       └── Pagination
│   │
│   ├── /tournaments/:id
│   │   └── TournamentDetailPage
│   │       ├── TournamentHeader
│   │       ├── TournamentDetails
│   │       ├── RegistrationInfo
│   │       └── WishlistAction
│   │
│   ├── /wishlist
│   │   └── WishlistPage (Protected)
│   │       ├── WishlistFilters
│   │       ├── WishlistSummary
│   │       └── WishlistTable
│   │           └── WishlistRow
│   │
│   ├── /profile
│   │   └── ProfilePage (Protected)
│   │       ├── ProfileForm
│   │       └── AthleteList
│   │           └── AthleteCard
│   │
│   ├── /login
│   │   └── LoginPage
│   │
│   └── /register
│       └── RegisterPage
│
├── Providers
│   ├── AuthProvider
│   ├── QueryClientProvider
│   └── ThemeProvider
│
└── Components (Shared)
    ├── Header
    ├── Footer
    ├── Modal
    ├── Toast
    └── LoadingSpinner
```

---

## 5. Security Considerations

### 5.1 Authentication Security

| Concern | Mitigation |
|---------|------------|
| Password storage | Cognito handles hashing (SRP protocol, bcrypt-equivalent) |
| Session hijacking | HTTP-only cookies, secure flag, SameSite=Strict |
| Token exposure | Short-lived access tokens (1h), refresh via HTTP-only cookie |
| Brute force | Cognito lockout policies, rate limiting |

### 5.2 API Security

| Concern | Mitigation |
|---------|------------|
| Unauthorized access | JWT verification on protected endpoints |
| Data exposure | Row-level security (user can only access own data) |
| Injection | Parameterized queries (DynamoDB SDK / Prisma) |
| CORS | Whitelist specific origins |
| Rate abuse | API Gateway throttling + per-user limits |

### 5.3 Data Privacy

| Concern | Mitigation |
|---------|------------|
| PII exposure | Encrypt at rest (DynamoDB default), TLS in transit |
| Child data | Parent consent model, no direct child accounts |
| Third-party data | Tournament data is public; no private data shared externally |

---

## 6. Open Items

After clarifying questions are answered, the following items require detailed design:

1. **Cognito User Pool Configuration** - Attributes, verification settings, password policy
2. **DynamoDB Access Patterns** - GSIs, query optimization for wishlist views
3. **Lambda Function Design** - Cold start mitigation, shared layers
4. **Frontend State Management** - React Query caching strategy, optimistic updates
5. **Error Handling Strategy** - User-facing error messages, logging
6. **Testing Strategy** - Unit, integration, E2E test coverage
7. **Deployment Pipeline** - CI/CD, environments (dev/staging/prod)
8. **Monitoring & Alerting** - CloudWatch dashboards, error thresholds

---

## 7. Next Steps

1. **Answer clarifying questions** (Section 2)
2. **Confirm or correct assumptions** (Section 3)
3. **Update this document** with decisions
4. **Proceed to detailed technical design**
5. **Create user stories and acceptance criteria**

---

## Appendix A: Existing Code Analysis

The `events-app` prototype provides working implementations of:

| Component | Location | Reusability |
|-----------|----------|-------------|
| IBJJF Fetcher | `backend/src/fetchers/ibjjfFetcher.ts` | **High** - Session-based scraping works |
| JJWL Fetcher | `backend/src/fetchers/jjwlFetcher.ts` | **High** - Public API, straightforward |
| Data Mappers | `backend/src/fetchers/mappers/` | **Medium** - Schema differs from requirements |
| Filter Service | `backend/src/services/filterService.ts` | **High** - Query patterns reusable |
| JWT Auth | `backend/src/services/authService.ts` | **Low** - Replacing with Cognito |
| React Query Hooks | `frontend/src/hooks/` | **High** - Pattern reusable |

### Key Technical Insights from Prototype:

1. **IBJJF requires session establishment** before API access (browser-like headers)
2. **JJWL is straightforward** - public POST endpoint, no auth
3. **Composite unique key** `(org, externalId)` prevents duplicate tournaments
4. **Filter service pattern** with Prisma `where` clause building is clean and extensible
5. **React Query** with 5-minute stale time works well for tournament data

