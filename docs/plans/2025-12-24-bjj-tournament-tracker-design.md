# BJJ Tournament Tracker - Design Document

**Date:** 2025-12-24
**Status:** Approved for implementation

## Overview

A web application for BJJ athletes and parents to discover tournaments from multiple organizations (IBJJF, JJWL, and future sources), maintain a wishlist, and track which athletes will attend each event.

## Key Decisions

### Critical Questions Answered

| # | Question | Decision |
|---|----------|----------|
| Q25 | Database | DynamoDB single-table |
| Q26 | Compute | Lambda + API Gateway |
| Q1 | Authentication | Cognito |
| Q6 | Wishlist before athletes? | Yes, assign athletes later |
| Q12 | Multiple athletes per tournament | One entry, multiple athletes attached |
| Q8 | Data strategy | Live fetching + seed fallback |

### Deferred to Phase 2

- Social login (Google, Apple)
- Email verification
- Travel/hotel cost estimation
- Map view
- GDPR compliance tooling
- Notes field on wishlist entries
- File storage (S3)

### Sensible Defaults Applied

- Email/password auth only for MVP
- NIST password guidelines (8+ chars)
- Profile completion optional for wishlisting
- Gym membership is trust-based
- Show both if tournament appears in multiple sources
- Default wishlist status = "Interested"
- Unlimited wishlist entries
- Mobile-first design
- shadcn/ui component library
- List view with pagination
- Parent consent model for minors
- Moderate rate limiting (60 req/min)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                     │
│                    Next.js (App Router)                             │
│               (Amplify Hosting or Lambda@Edge)                      │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       API GATEWAY                                    │
│            • REST API with Cognito Authorizer                       │
│            • Rate limiting (60 req/min)                             │
│            • CORS for frontend domain                               │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    LAMBDA FUNCTIONS                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │ Tournaments  │  │  Wishlist    │  │   Profile    │              │
│  │  (public)    │  │ (protected)  │  │ (protected)  │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐                                 │
│  │ Sync Job     │  │   Athletes   │                                 │
│  │ (scheduled)  │  │ (protected)  │                                 │
│  └──────────────┘  └──────────────┘                                 │
└─────────────────────────────────────────────────────────────────────┘
                                │
                ┌───────────────┼───────────────┐
                ▼               ▼               ▼
        ┌────────────┐  ┌────────────┐  ┌────────────┐
        │  DynamoDB  │  │  Cognito   │  │ EventBridge│
        │ (single-   │  │ User Pool  │  │ (scheduler)│
        │  table)    │  │            │  │            │
        └────────────┘  └────────────┘  └────────────┘
```

### Key Components

- **Next.js Frontend:** SSR for SEO on public pages, client-side for protected pages
- **API Gateway:** REST API with Cognito authorizer, rate limiting
- **Lambda Functions:** Thin handlers, business logic in services layer
- **DynamoDB:** Single-table design for all entities
- **Cognito:** User authentication, password reset, token management
- **EventBridge:** Schedules daily tournament sync job

---

## DynamoDB Single-Table Design

### Table Structure

| PK | SK | Key Attributes |
|----|----|----|
| **Users** |
| `USER#<cognito_sub>` | `PROFILE` | email, name, homeCity, homeState, nearestAirport, gymName, createdAt |
| `USER#<cognito_sub>` | `ATHLETE#<ulid>` | name, beltRank, birthYear, weight, createdAt |
| **Wishlists** |
| `USER#<cognito_sub>` | `WISH#<tournament_id>` | status, athleteIds[], createdAt |
| **Tournaments** |
| `TOURN#<org>#<extId>` | `META` | name, org, city, venue, startDate, endDate, gi, nogi, kids, registrationUrl |

### Access Patterns

| Pattern | Query |
|---------|-------|
| Get user profile | PK = `USER#<sub>`, SK = `PROFILE` |
| List user's athletes | PK = `USER#<sub>`, SK begins_with `ATHLETE#` |
| List user's wishlist | PK = `USER#<sub>`, SK begins_with `WISH#` |
| Get single tournament | PK = `TOURN#<org>#<extId>`, SK = `META` |
| List all tournaments | GSI1 query |
| Filter by date range | GSI1 with between condition |

### Global Secondary Index (GSI1)

| GSI1PK | GSI1SK | Use Case |
|--------|--------|----------|
| `TOURNAMENTS` | `<startDate>#<org>#<id>` | List all, sorted by date |

---

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| **Tournaments** |
| GET | `/tournaments` | No | List with filters (date, org, city, gi/nogi) |
| GET | `/tournaments/{id}` | No | Single tournament details |
| **Auth** |
| POST | `/auth/register` | No | Create account |
| POST | `/auth/login` | No | Login |
| POST | `/auth/refresh` | No | Refresh tokens |
| POST | `/auth/forgot-password` | No | Initiate reset |
| POST | `/auth/reset-password` | No | Complete reset |
| **Profile** |
| GET | `/profile` | Yes | Get current user profile |
| PUT | `/profile` | Yes | Update profile |
| **Athletes** |
| GET | `/athletes` | Yes | List user's athletes |
| POST | `/athletes` | Yes | Create athlete |
| PUT | `/athletes/{id}` | Yes | Update athlete |
| DELETE | `/athletes/{id}` | Yes | Delete athlete |
| **Wishlist** |
| GET | `/wishlist` | Yes | List user's wishlist |
| POST | `/wishlist` | Yes | Add tournament |
| PUT | `/wishlist/{id}` | Yes | Update (status, athletes) |
| DELETE | `/wishlist/{id}` | Yes | Remove from wishlist |
| **Admin** |
| POST | `/admin/sync` | Admin | Trigger manual sync |

---

## Backend Structure

```
src/
├── handlers/              # Lambda entry points (thin)
│   ├── tournaments.ts
│   ├── auth.ts
│   ├── profile.ts
│   ├── athletes.ts
│   ├── wishlist.ts
│   └── sync.ts
│
├── services/              # Business logic (testable)
│   ├── tournamentService.ts
│   ├── profileService.ts
│   ├── athleteService.ts
│   ├── wishlistService.ts
│   └── syncService.ts
│
├── db/                    # DynamoDB access
│   ├── client.ts
│   ├── queries.ts
│   └── mappers.ts
│
├── fetchers/              # External APIs
│   ├── ibjjfFetcher.ts
│   ├── jjwlFetcher.ts
│   └── mappers/
│
└── shared/                # Utilities
    ├── auth.ts
    ├── validation.ts
    └── errors.ts
```

---

## Frontend Structure (Next.js)

### Tech Stack

- Next.js 14+ (App Router)
- TanStack Query (client-side data fetching)
- Zustand (auth state)
- shadcn/ui + Tailwind CSS
- AWS Amplify (Cognito integration)

### Page Structure

```
app/
├── (marketing)/              # Public, SEO-optimized
│   ├── page.tsx              # Landing page (SSG)
│   └── layout.tsx
│
├── tournaments/              # Public, SEO-optimized
│   ├── page.tsx              # List (SSR)
│   └── [id]/page.tsx         # Detail (SSR)
│
├── (auth)/                   # Auth pages (SSG)
│   ├── login/page.tsx
│   └── register/page.tsx
│
├── (protected)/              # Behind auth
│   ├── wishlist/page.tsx
│   ├── profile/page.tsx
│   └── layout.tsx            # Auth guard
│
└── layout.tsx                # Root layout

components/
├── layout/
├── tournaments/
├── wishlist/
├── profile/
└── ui/

hooks/
├── useTournaments.ts
├── useWishlist.ts
├── useAthletes.ts
└── useAuth.ts
```

### Rendering Strategy

| Page | Render | Why |
|------|--------|-----|
| Landing `/` | SSG | Marketing, rarely changes |
| Tournament list | SSR | Filters in URL, SEO |
| Tournament detail | SSR + cache | SEO, shareable |
| Login/Register | SSG | Static forms |
| Wishlist | Client | Private, no SEO |
| Profile | Client | Private, no SEO |

---

## Tournament Sync

### Flow

```
EventBridge (daily 2AM)
       │
       ▼
   Lambda sync.ts
       │
   ┌───┴───┐
   ▼       ▼
IBJJF    JJWL
 API      API
   │       │
   └───┬───┘
       ▼
   DynamoDB upsert
```

### Sync Logic

- Fetch both sources in parallel
- Each source fails independently (one failing doesn't block the other)
- Map to unified Tournament format
- Batch write to DynamoDB (upsert by org + externalId)
- Log results and errors to CloudWatch

### Adding New Sources

1. Create `src/fetchers/newOrgFetcher.ts`
2. Create `src/fetchers/mappers/newOrgMapper.ts`
3. Add to `syncService.ts` sources array
4. Deploy

No database changes required.

---

## Error Handling

### Backend Errors

```typescript
class AppError extends Error {
  constructor(message: string, statusCode: number, code: string)
}

class NotFoundError extends AppError      // 404
class ValidationError extends AppError    // 400
class UnauthorizedError extends AppError  // 401
```

### Error Scenarios

| Scenario | Handling |
|----------|----------|
| Sync: API down | Log, continue with other sources, alert |
| Sync: Both down | Log, existing data remains, retry next cycle |
| Invalid input | 400 + Zod validation message |
| Not authenticated | 401, frontend redirects to login |
| Not found | 404 + message |
| Duplicate wishlist | Idempotent, return existing |
| DynamoDB throttled | SDK retries with backoff |
| Invalid Cognito token | API Gateway rejects pre-Lambda |

### Frontend Error Handling

- TanStack Query: retry 5xx errors twice, don't retry 4xx
- Global mutation error handler shows toast
- 401 errors trigger logout and redirect

### Monitoring

CloudWatch Alarms:
- Sync job failures → Email
- Lambda error rate > 1% → Email
- API Gateway 5xx > 0.5% → Email
- DynamoDB throttling → Email

---

## Testing Strategy

### Testing Pyramid

```
         ┌─────────┐
         │   E2E   │  Cypress - critical paths only
         └────┬────┘
    ┌─────────┴─────────┐
    │   Integration     │  Jest + DynamoDB Local
    └─────────┬─────────┘
┌─────────────┴─────────────┐
│        Unit Tests         │  Jest/Vitest - services, mappers
└───────────────────────────┘
```

### Backend Tests

**Unit:** Services, mappers, utilities (no external deps)

**Integration:** Lambda handlers with DynamoDB Local (Docker)

### Frontend Tests

**Component:** Vitest + Testing Library

**E2E:** Cypress for critical paths (browse → login → wishlist)

### Test Commands

```json
{
  "test": "jest",
  "test:unit": "jest --testPathPattern=__tests__/.*.test.ts",
  "test:integration": "docker-compose up -d dynamodb && jest --testPathPattern=integration",
  "test:e2e": "cypress run",
  "test:coverage": "jest --coverage"
}
```

---

## Phase 2 Features (Deferred)

- Social login (Google, Apple)
- Email verification flow
- Travel/hotel cost estimation
- Map view for tournaments
- GDPR compliance (data export/delete)
- Notes field on wishlist entries
- File uploads (athlete photos)
- iCal export
- Push notifications for registration deadlines
