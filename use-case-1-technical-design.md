# Use Case 1: Technical Design Document

## Tournament Viewing & Wishlist Management

**Version:** 1.0
**Created:** December 23, 2025
**Status:** Ready for Implementation

---

## Table of Contents

1. [Decision Summary](#1-decision-summary)
2. [System Architecture](#2-system-architecture)
3. [Database Design](#3-database-design)
4. [API Design](#4-api-design)
5. [Authentication](#5-authentication)
6. [Frontend Architecture](#6-frontend-architecture)
7. [Cost Estimation](#7-cost-estimation)
8. [Infrastructure](#8-infrastructure)
9. [Security](#9-security)
10. [Implementation Plan](#10-implementation-plan)

---

## 1. Decision Summary

### 1.1 Consolidated Answers

| Category | Decision |
|----------|----------|
| **Auth Provider** | AWS Cognito (with prototype patterns as reference) |
| **Social Login** | Email/password only for MVP |
| **Email Verification** | Not required |
| **Password Policy** | Standard (8+ chars, mixed case, number, special char) |
| **Profile Completion** | Optional - prompt for address when viewing cost estimate |
| **Athlete Requirement** | Must create at least one athlete before wishlisting |
| **Gym Membership** | Trust-based self-declaration |
| **Data Source** | Live API fetching only (IBJJF + JJWL) |
| **Tournament Fields** | Existing fetcher data (name, dates, city, venue, gi/nogi) |
| **Duplicate Handling** | Show both sources as separate entries |
| **Wishlist Model** | Separate entry per athlete (siblings = multiple entries) |
| **Anonymous Wishlist** | Show login required message (no localStorage) |
| **Default Status** | User chooses (Interested or Registered) |
| **Free Tier Limit** | 5 tournaments maximum |
| **Notes Field** | Deferred to later phase |
| **UI Framework** | shadcn/ui |
| **Responsive Design** | Design system approach (simultaneous) |
| **Tournament Views** | List view only for MVP |
| **Loading Pattern** | Infinite scroll |
| **COPPA** | Not applicable (parent is data subject) |
| **GDPR** | Not required for MVP |
| **Rate Limiting** | Light (300 req/min per user) |
| **CAPTCHA** | reCAPTCHA v3 on registration |
| **Database** | DynamoDB multi-table |
| **Compute** | Hybrid (Lambda for async, containers for API) |
| **File Storage** | S3 + CloudFront |
| **Cost Estimation** | Travel + hotel only (no registration fees for MVP) |
| **Travel Source** | Google Maps Distance Matrix API |
| **Hotel Source** | Hotel pricing API |
| **Address Handling** | Prompt when user tries to view cost estimate |

---

## 2. System Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                   CLIENTS                                        │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                  │
│  │   Web Browser   │  │   Mobile Web    │  │  Future Native  │                  │
│  │   (React SPA)   │  │   (Responsive)  │  │      App        │                  │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘                  │
└───────────┼─────────────────────┼─────────────────────┼──────────────────────────┘
            │                     │                     │
            └─────────────────────┼─────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              AWS CLOUDFRONT                                      │
│                         (CDN + Static Assets)                                   │
└────────────────────────────────┬────────────────────────────────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │                         │
                    ▼                         ▼
┌───────────────────────────┐    ┌───────────────────────────────────────────────┐
│      S3 (Frontend)        │    │              API GATEWAY                       │
│   React SPA Assets        │    │  • REST API endpoints                         │
│   + CloudFront Origin     │    │  • Cognito Authorizer                         │
└───────────────────────────┘    │  • Rate Limiting (300/min)                    │
                                 │  • Request Validation                          │
                                 └───────────────────┬───────────────────────────┘
                                                     │
                                 ┌───────────────────┴───────────────────┐
                                 │                                       │
                                 ▼                                       ▼
┌─────────────────────────────────────────┐    ┌─────────────────────────────────┐
│         ECS FARGATE CLUSTER             │    │         LAMBDA FUNCTIONS        │
│  ┌─────────────────────────────────┐    │    │  ┌─────────────────────────┐    │
│  │       API Service               │    │    │  │  Tournament Sync        │    │
│  │  • /tournaments                 │    │    │  │  (Daily cron)           │    │
│  │  • /parents                     │    │    │  └─────────────────────────┘    │
│  │  • /athletes                    │    │    │  ┌─────────────────────────┐    │
│  │  • /wishlist                    │    │    │  │  Cost Calculator        │    │
│  │  • /auth                        │    │    │  │  (On-demand)            │    │
│  └─────────────────────────────────┘    │    │  └─────────────────────────┘    │
└──────────────────┬──────────────────────┘    │  ┌─────────────────────────┐    │
                   │                           │  │  Image Processor        │    │
                   │                           │  │  (Resize avatars)       │    │
                   │                           │  └─────────────────────────┘    │
                   │                           └─────────────────┬───────────────┘
                   │                                             │
                   └─────────────────────┬───────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              DATA LAYER                                          │
│                                                                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                  │
│  │    DynamoDB     │  │    DynamoDB     │  │    DynamoDB     │                  │
│  │   tournaments   │  │     users       │  │    wishlists    │                  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘                  │
│                                                                                  │
│  ┌─────────────────┐  ┌─────────────────┐                                       │
│  │    DynamoDB     │  │       S3        │                                       │
│  │    athletes     │  │  (User Files)   │                                       │
│  └─────────────────┘  └─────────────────┘                                       │
└─────────────────────────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           EXTERNAL SERVICES                                      │
│                                                                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                  │
│  │  AWS Cognito    │  │  Google Maps    │  │  Hotel Pricing  │                  │
│  │  (Auth)         │  │  Distance API   │  │  API            │                  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘                  │
│                                                                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                  │
│  │  IBJJF API      │  │  JJWL API       │  │  reCAPTCHA v3   │                  │
│  │  (Tournaments)  │  │  (Tournaments)  │  │  (Bot protect)  │                  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Component Responsibilities

| Component | Responsibility |
|-----------|----------------|
| **CloudFront** | CDN for static assets, SSL termination, caching |
| **S3 (Frontend)** | Host React SPA build artifacts |
| **API Gateway** | REST API routing, auth, rate limiting, request validation |
| **ECS Fargate** | Stateless API containers, auto-scaling |
| **Lambda (Sync)** | Daily tournament data fetching from IBJJF/JJWL |
| **Lambda (Cost)** | On-demand cost calculation (Google Maps + Hotel API) |
| **DynamoDB** | Multi-table NoSQL storage |
| **Cognito** | User authentication, JWT tokens |

---

## 3. Database Design

### 3.1 DynamoDB Multi-Table Design

Using separate tables for clearer access patterns and independent scaling.

#### Table: `tournaments`

| Attribute | Type | Description |
|-----------|------|-------------|
| `id` | String (PK) | UUID |
| `org` | String | "IBJJF" or "JJWL" |
| `externalId` | String | Source system ID |
| `name` | String | Tournament name |
| `city` | String | City name |
| `state` | String | State/province |
| `country` | String | Country code |
| `venue` | String | Venue name |
| `venueAddress` | String | Full address for distance calc |
| `startDate` | String | ISO date (YYYY-MM-DD) |
| `endDate` | String | ISO date |
| `gi` | Boolean | Has gi divisions |
| `nogi` | Boolean | Has no-gi divisions |
| `kids` | Boolean | Has kids divisions |
| `registrationUrl` | String | External registration link |
| `bannerUrl` | String | Tournament banner image |
| `metadata` | Map | Source-specific extra data |
| `createdAt` | String | ISO timestamp |
| `updatedAt` | String | ISO timestamp |

**Global Secondary Indexes:**

| GSI Name | PK | SK | Purpose |
|----------|----|----|---------|
| `org-startDate-index` | `org` | `startDate` | Filter by org + date range |
| `startDate-index` | `startDate` | `id` | Date range queries |

---

#### Table: `users`

| Attribute | Type | Description |
|-----------|------|-------------|
| `id` | String (PK) | Cognito sub (UUID) |
| `email` | String | User email |
| `name` | String | Display name |
| `subscriptionTier` | String | "free" or "paid" |
| `homeAddress` | Map | {street, city, state, zip, country} |
| `nearestAirport` | String | Airport code (e.g., "IAH") |
| `gymId` | String | Self-declared gym (nullable) |
| `gymName` | String | Denormalized gym name |
| `createdAt` | String | ISO timestamp |
| `updatedAt` | String | ISO timestamp |

**Global Secondary Indexes:**

| GSI Name | PK | SK | Purpose |
|----------|----|----|---------|
| `email-index` | `email` | - | Lookup by email |

---

#### Table: `athletes`

| Attribute | Type | Description |
|-----------|------|-------------|
| `id` | String (PK) | UUID |
| `userId` | String | Parent's user ID |
| `name` | String | Athlete name |
| `beltRank` | String | white/blue/purple/brown/black |
| `ageDivision` | String | e.g., "Juvenile 1", "Adult" |
| `weightClass` | String | e.g., "Rooster", "Light Feather" |
| `ibjjfId` | String | Optional IBJJF member ID |
| `jjwlId` | String | Optional JJWL member ID |
| `createdAt` | String | ISO timestamp |
| `updatedAt` | String | ISO timestamp |

**Global Secondary Indexes:**

| GSI Name | PK | SK | Purpose |
|----------|----|----|---------|
| `userId-index` | `userId` | `createdAt` | Get all athletes for a user |

---

#### Table: `wishlists`

| Attribute | Type | Description |
|-----------|------|-------------|
| `id` | String (PK) | UUID |
| `userId` | String | Parent's user ID |
| `athleteId` | String | Athlete this entry is for |
| `tournamentId` | String | Tournament reference |
| `status` | String | "interested" or "registered" |
| `travelMode` | String | "drive" or "fly" (nullable) |
| `costEstimate` | Map | {travel, hotel, total} |
| `createdAt` | String | ISO timestamp |
| `updatedAt` | String | ISO timestamp |

**Global Secondary Indexes:**

| GSI Name | PK | SK | Purpose |
|----------|----|----|---------|
| `userId-index` | `userId` | `createdAt` | Get user's wishlist |
| `tournamentId-index` | `tournamentId` | `userId` | Check if user wishlisted |

**Composite Uniqueness:** Enforced in application layer (userId + athleteId + tournamentId)

---

### 3.2 Access Patterns

| Access Pattern | Table | Query |
|----------------|-------|-------|
| List all tournaments | tournaments | Scan with filters |
| List tournaments by org | tournaments | GSI: org-startDate-index |
| List tournaments by date range | tournaments | GSI: startDate-index |
| Get tournament by ID | tournaments | GetItem(id) |
| Get user by ID | users | GetItem(id) |
| Get user by email | users | GSI: email-index |
| List user's athletes | athletes | GSI: userId-index |
| Get athlete by ID | athletes | GetItem(id) |
| List user's wishlist | wishlists | GSI: userId-index |
| Check wishlist entry exists | wishlists | GSI: tournamentId-index + filter |
| Count user's wishlist | wishlists | GSI: userId-index (count) |

---

## 4. API Design

### 4.1 Base URL

```
Production: https://api.tournamenttracker.com/v1
Development: https://api-dev.tournamenttracker.com/v1
```

### 4.2 Authentication Endpoints

#### POST `/auth/register`

Create a new parent account.

**Request:**
```json
{
  "email": "parent@example.com",
  "password": "SecurePass123!",
  "name": "John Smith",
  "recaptchaToken": "03AGdBq24..."
}
```

**Response (201):**
```json
{
  "message": "Registration successful",
  "userId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Errors:**
- 400: Invalid input / Password requirements not met
- 409: Email already registered
- 422: reCAPTCHA verification failed

---

#### POST `/auth/login`

Authenticate user and return tokens.

**Request:**
```json
{
  "email": "parent@example.com",
  "password": "SecurePass123!"
}
```

**Response (200):**
```json
{
  "accessToken": "eyJhbGciOiJSUzI1NiIs...",
  "refreshToken": "eyJjdHkiOiJKV1QiLCJl...",
  "expiresIn": 3600,
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "parent@example.com",
    "name": "John Smith",
    "subscriptionTier": "free"
  }
}
```

**Errors:**
- 401: Invalid credentials
- 423: Account locked (too many attempts)

---

#### POST `/auth/refresh`

Refresh access token.

**Request:**
```json
{
  "refreshToken": "eyJjdHkiOiJKV1QiLCJl..."
}
```

**Response (200):**
```json
{
  "accessToken": "eyJhbGciOiJSUzI1NiIs...",
  "expiresIn": 3600
}
```

---

#### POST `/auth/logout`

Invalidate refresh token.

**Headers:** `Authorization: Bearer <accessToken>`

**Response (204):** No content

---

### 4.3 User Profile Endpoints

#### GET `/parents/me`

Get current user's profile.

**Headers:** `Authorization: Bearer <accessToken>`

**Response (200):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "parent@example.com",
  "name": "John Smith",
  "subscriptionTier": "free",
  "homeAddress": null,
  "nearestAirport": null,
  "gymId": null,
  "gymName": null,
  "createdAt": "2025-12-23T10:00:00Z"
}
```

---

#### PATCH `/parents/me`

Update current user's profile.

**Headers:** `Authorization: Bearer <accessToken>`

**Request:**
```json
{
  "name": "John Smith Jr.",
  "homeAddress": {
    "street": "123 Main St",
    "city": "Houston",
    "state": "TX",
    "zip": "77001",
    "country": "USA"
  },
  "nearestAirport": "IAH",
  "gymId": "gym-123",
  "gymName": "Gracie Barra Houston"
}
```

**Response (200):** Updated user object

---

### 4.4 Athlete Endpoints

#### GET `/athletes`

List current user's athletes.

**Headers:** `Authorization: Bearer <accessToken>`

**Response (200):**
```json
{
  "athletes": [
    {
      "id": "athlete-001",
      "name": "Johnny Smith",
      "beltRank": "white",
      "ageDivision": "Juvenile 1",
      "weightClass": "Rooster",
      "createdAt": "2025-12-23T10:00:00Z"
    }
  ],
  "total": 1
}
```

---

#### POST `/athletes`

Create a new athlete.

**Headers:** `Authorization: Bearer <accessToken>`

**Request:**
```json
{
  "name": "Johnny Smith",
  "beltRank": "white",
  "ageDivision": "Juvenile 1",
  "weightClass": "Rooster"
}
```

**Response (201):**
```json
{
  "id": "athlete-001",
  "name": "Johnny Smith",
  "beltRank": "white",
  "ageDivision": "Juvenile 1",
  "weightClass": "Rooster",
  "createdAt": "2025-12-23T10:00:00Z"
}
```

---

#### PATCH `/athletes/:id`

Update an athlete.

**Headers:** `Authorization: Bearer <accessToken>`

**Request:**
```json
{
  "weightClass": "Light Feather"
}
```

**Response (200):** Updated athlete object

**Errors:**
- 404: Athlete not found
- 403: Not owner of athlete

---

#### DELETE `/athletes/:id`

Delete an athlete.

**Headers:** `Authorization: Bearer <accessToken>`

**Response (204):** No content

**Side Effects:** Deletes all wishlist entries for this athlete

---

### 4.5 Tournament Endpoints

#### GET `/tournaments`

List tournaments with filtering and pagination.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `org` | string | Filter by "IBJJF" or "JJWL" |
| `startDate` | string | ISO date (tournaments on or after) |
| `endDate` | string | ISO date (tournaments on or before) |
| `city` | string | Partial match (case-insensitive) |
| `state` | string | Exact match |
| `country` | string | Exact match |
| `gi` | boolean | Has gi divisions |
| `nogi` | boolean | Has no-gi divisions |
| `kids` | boolean | Has kids divisions |
| `search` | string | Full-text search (name, city, venue) |
| `cursor` | string | Pagination cursor |
| `limit` | number | Results per page (default: 20, max: 50) |

**Response (200):**
```json
{
  "tournaments": [
    {
      "id": "tourn-001",
      "org": "IBJJF",
      "name": "Dallas International Open",
      "city": "Dallas",
      "state": "TX",
      "country": "USA",
      "venue": "Dallas Convention Center",
      "startDate": "2026-03-14",
      "endDate": "2026-03-15",
      "gi": true,
      "nogi": false,
      "kids": true,
      "registrationUrl": "https://ibjjf.com/events/dallas-open-2026",
      "bannerUrl": "https://cdn.example.com/banners/dallas.jpg"
    }
  ],
  "nextCursor": "eyJpZCI6InRvdXJuLTAyMCJ9",
  "hasMore": true,
  "total": 145
}
```

---

#### GET `/tournaments/:id`

Get tournament details.

**Response (200):**
```json
{
  "id": "tourn-001",
  "org": "IBJJF",
  "name": "Dallas International Open",
  "city": "Dallas",
  "state": "TX",
  "country": "USA",
  "venue": "Dallas Convention Center",
  "venueAddress": "650 S Griffin St, Dallas, TX 75202",
  "startDate": "2026-03-14",
  "endDate": "2026-03-15",
  "gi": true,
  "nogi": false,
  "kids": true,
  "registrationUrl": "https://ibjjf.com/events/dallas-open-2026",
  "bannerUrl": "https://cdn.example.com/banners/dallas.jpg",
  "metadata": {
    "region": "North America"
  }
}
```

---

### 4.6 Wishlist Endpoints

#### GET `/wishlist`

Get current user's wishlist.

**Headers:** `Authorization: Bearer <accessToken>`

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `athleteId` | string | Filter by athlete |
| `status` | string | Filter by "interested" or "registered" |
| `cursor` | string | Pagination cursor |
| `limit` | number | Results per page (default: 20) |

**Response (200):**
```json
{
  "wishlist": [
    {
      "id": "wish-001",
      "athleteId": "athlete-001",
      "athlete": {
        "id": "athlete-001",
        "name": "Johnny Smith"
      },
      "tournamentId": "tourn-001",
      "tournament": {
        "id": "tourn-001",
        "name": "Dallas International Open",
        "city": "Dallas",
        "state": "TX",
        "startDate": "2026-03-14",
        "endDate": "2026-03-15"
      },
      "status": "interested",
      "travelMode": "drive",
      "costEstimate": {
        "travel": 120.00,
        "hotel": 250.00,
        "total": 370.00
      },
      "createdAt": "2025-12-23T10:00:00Z"
    }
  ],
  "nextCursor": null,
  "hasMore": false,
  "total": 1,
  "limit": 5,
  "remaining": 4
}
```

---

#### POST `/wishlist`

Add tournament to wishlist.

**Headers:** `Authorization: Bearer <accessToken>`

**Request:**
```json
{
  "tournamentId": "tourn-001",
  "athleteId": "athlete-001",
  "status": "interested"
}
```

**Response (201):**
```json
{
  "id": "wish-001",
  "athleteId": "athlete-001",
  "tournamentId": "tourn-001",
  "status": "interested",
  "travelMode": null,
  "costEstimate": null,
  "createdAt": "2025-12-23T10:00:00Z"
}
```

**Errors:**
- 400: Invalid tournament or athlete ID
- 403: Athlete not owned by user
- 409: Entry already exists for this athlete + tournament
- 429: Wishlist limit reached (5 for free tier)

---

#### PATCH `/wishlist/:id`

Update wishlist entry.

**Headers:** `Authorization: Bearer <accessToken>`

**Request:**
```json
{
  "status": "registered",
  "travelMode": "fly"
}
```

**Response (200):** Updated wishlist entry

---

#### DELETE `/wishlist/:id`

Remove from wishlist.

**Headers:** `Authorization: Bearer <accessToken>`

**Response (204):** No content

---

#### POST `/wishlist/:id/calculate-cost`

Calculate/recalculate cost estimate for a wishlist entry.

**Headers:** `Authorization: Bearer <accessToken>`

**Response (200):**
```json
{
  "id": "wish-001",
  "costEstimate": {
    "travel": 120.00,
    "hotel": 250.00,
    "total": 370.00,
    "calculatedAt": "2025-12-23T10:00:00Z",
    "travelMode": "drive",
    "travelDetails": {
      "distanceMiles": 240,
      "ratePerMile": 0.50
    },
    "hotelDetails": {
      "nights": 2,
      "ratePerNight": 125.00
    }
  }
}
```

**Errors:**
- 400: User has no home address (returns `addressRequired: true`)

---

### 4.7 Error Response Format

All errors follow this structure:

```json
{
  "error": {
    "code": "WISHLIST_LIMIT_REACHED",
    "message": "Free tier allows maximum 5 tournaments in wishlist",
    "details": {
      "current": 5,
      "limit": 5,
      "tier": "free"
    }
  }
}
```

---

## 5. Authentication

### 5.1 AWS Cognito Configuration

#### User Pool Settings

```yaml
UserPool:
  Name: tournament-tracker-users

  # Password Policy
  PasswordPolicy:
    MinimumLength: 8
    RequireUppercase: true
    RequireLowercase: true
    RequireNumbers: true
    RequireSymbols: true

  # No email verification required
  AutoVerifiedAttributes: []

  # Standard attributes
  Schema:
    - Name: email
      Required: true
      Mutable: true
    - Name: name
      Required: true
      Mutable: true

  # Account recovery
  AccountRecoverySetting:
    RecoveryMechanisms:
      - Name: verified_email
        Priority: 1
```

#### App Client Settings

```yaml
AppClient:
  Name: tournament-tracker-web
  GenerateSecret: false  # SPA doesn't use secrets

  AuthFlows:
    - ALLOW_USER_SRP_AUTH
    - ALLOW_REFRESH_TOKEN_AUTH

  TokenValidity:
    AccessToken: 1 hour
    IdToken: 1 hour
    RefreshToken: 30 days

  PreventUserExistenceErrors: true
```

### 5.2 Authentication Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │     │ API Gateway │     │   Cognito   │     │  DynamoDB   │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │                   │
       │ POST /auth/register                   │                   │
       │──────────────────►│                   │                   │
       │                   │                   │                   │
       │                   │ Verify reCAPTCHA  │                   │
       │                   │──────────────────►│                   │
       │                   │◄──────────────────│                   │
       │                   │                   │                   │
       │                   │ SignUp            │                   │
       │                   │──────────────────►│                   │
       │                   │◄──────────────────│                   │
       │                   │                   │                   │
       │                   │ Create user record│                   │
       │                   │───────────────────────────────────────►
       │                   │◄───────────────────────────────────────
       │                   │                   │                   │
       │◄──────────────────│                   │                   │
       │ 201 Created       │                   │                   │
       │                   │                   │                   │
       │ POST /auth/login  │                   │                   │
       │──────────────────►│                   │                   │
       │                   │                   │                   │
       │                   │ InitiateAuth (SRP)│                   │
       │                   │──────────────────►│                   │
       │                   │◄──────────────────│                   │
       │                   │                   │                   │
       │◄──────────────────│                   │                   │
       │ 200 + tokens      │                   │                   │
       │                   │                   │                   │
       │ GET /parents/me   │                   │                   │
       │ + Bearer token    │                   │                   │
       │──────────────────►│                   │                   │
       │                   │                   │                   │
       │                   │ Validate JWT      │                   │
       │                   │──────────────────►│                   │
       │                   │◄──────────────────│                   │
       │                   │                   │                   │
       │                   │ Get user data     │                   │
       │                   │───────────────────────────────────────►
       │                   │◄───────────────────────────────────────
       │                   │                   │                   │
       │◄──────────────────│                   │                   │
       │ 200 + user data   │                   │                   │
```

### 5.3 Token Storage (Frontend)

```typescript
// tokens.ts
const TOKEN_KEY = 'auth_tokens';

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export const tokenStorage = {
  save(tokens: AuthTokens): void {
    // Access token in memory only (XSS protection)
    sessionStorage.setItem(TOKEN_KEY, JSON.stringify({
      accessToken: tokens.accessToken,
      expiresAt: tokens.expiresAt
    }));

    // Refresh token in httpOnly cookie (set by server)
    // Not accessible via JS
  },

  getAccessToken(): string | null {
    const data = sessionStorage.getItem(TOKEN_KEY);
    if (!data) return null;

    const { accessToken, expiresAt } = JSON.parse(data);
    if (Date.now() > expiresAt) {
      sessionStorage.removeItem(TOKEN_KEY);
      return null;
    }

    return accessToken;
  },

  clear(): void {
    sessionStorage.removeItem(TOKEN_KEY);
  }
};
```

---

## 6. Frontend Architecture

### 6.1 Technology Stack

| Layer | Technology |
|-------|------------|
| **Framework** | React 18 + TypeScript |
| **Build Tool** | Vite |
| **UI Components** | shadcn/ui (Radix primitives + Tailwind) |
| **Styling** | Tailwind CSS |
| **State Management** | TanStack Query (server state) + Zustand (client state) |
| **Routing** | React Router v6 |
| **Forms** | React Hook Form + Zod validation |
| **HTTP Client** | Axios |

### 6.2 Project Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── ui/                    # shadcn/ui components
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── input.tsx
│   │   │   ├── select.tsx
│   │   │   └── ...
│   │   ├── layout/
│   │   │   ├── Header.tsx
│   │   │   ├── Footer.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── PageContainer.tsx
│   │   ├── tournaments/
│   │   │   ├── TournamentCard.tsx
│   │   │   ├── TournamentList.tsx
│   │   │   ├── TournamentFilters.tsx
│   │   │   └── TournamentDetail.tsx
│   │   ├── wishlist/
│   │   │   ├── WishlistButton.tsx
│   │   │   ├── WishlistTable.tsx
│   │   │   ├── WishlistSummary.tsx
│   │   │   └── AddToWishlistDialog.tsx
│   │   ├── athletes/
│   │   │   ├── AthleteCard.tsx
│   │   │   ├── AthleteList.tsx
│   │   │   └── AthleteForm.tsx
│   │   └── auth/
│   │       ├── LoginForm.tsx
│   │       ├── RegisterForm.tsx
│   │       └── ProtectedRoute.tsx
│   │
│   ├── pages/
│   │   ├── HomePage.tsx
│   │   ├── TournamentsPage.tsx
│   │   ├── TournamentDetailPage.tsx
│   │   ├── WishlistPage.tsx
│   │   ├── ProfilePage.tsx
│   │   ├── AthletesPage.tsx
│   │   ├── LoginPage.tsx
│   │   └── RegisterPage.tsx
│   │
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useTournaments.ts
│   │   ├── useWishlist.ts
│   │   ├── useAthletes.ts
│   │   └── useInfiniteScroll.ts
│   │
│   ├── lib/
│   │   ├── api-client.ts
│   │   ├── auth.ts
│   │   ├── utils.ts
│   │   └── validators.ts
│   │
│   ├── stores/
│   │   ├── authStore.ts
│   │   └── filterStore.ts
│   │
│   ├── types/
│   │   ├── tournament.ts
│   │   ├── wishlist.ts
│   │   ├── athlete.ts
│   │   └── user.ts
│   │
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
│
├── public/
├── tailwind.config.js
├── tsconfig.json
├── vite.config.ts
└── package.json
```

### 6.3 Key Components

#### TournamentCard.tsx

```tsx
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, MapPin, Heart } from 'lucide-react';
import { Tournament } from '@/types/tournament';
import { useAuth } from '@/hooks/useAuth';
import { WishlistButton } from '@/components/wishlist/WishlistButton';
import { formatDateRange } from '@/lib/utils';

interface TournamentCardProps {
  tournament: Tournament;
}

export function TournamentCard({ tournament }: TournamentCardProps) {
  const { isAuthenticated } = useAuth();

  return (
    <Card className="hover:shadow-lg transition-shadow">
      {tournament.bannerUrl && (
        <div className="h-32 overflow-hidden rounded-t-lg">
          <img
            src={tournament.bannerUrl}
            alt={tournament.name}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <Badge variant={tournament.org === 'IBJJF' ? 'default' : 'secondary'}>
            {tournament.org}
          </Badge>
          <div className="flex gap-1">
            {tournament.gi && <Badge variant="outline">Gi</Badge>}
            {tournament.nogi && <Badge variant="outline">No-Gi</Badge>}
            {tournament.kids && <Badge variant="outline">Kids</Badge>}
          </div>
        </div>

        <h3 className="font-semibold text-lg mb-2 line-clamp-2">
          {tournament.name}
        </h3>

        <div className="space-y-1 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span>{formatDateRange(tournament.startDate, tournament.endDate)}</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            <span>{tournament.city}, {tournament.state}</span>
          </div>
        </div>
      </CardContent>

      <CardFooter className="p-4 pt-0 flex gap-2">
        <Button variant="outline" className="flex-1" asChild>
          <a href={`/tournaments/${tournament.id}`}>View Details</a>
        </Button>
        <WishlistButton tournament={tournament} />
      </CardFooter>
    </Card>
  );
}
```

#### WishlistButton.tsx

```tsx
import { Button } from '@/components/ui/button';
import { Heart } from 'lucide-react';
import { Tournament } from '@/types/tournament';
import { useAuth } from '@/hooks/useAuth';
import { useWishlist } from '@/hooks/useWishlist';
import { useState } from 'react';
import { AddToWishlistDialog } from './AddToWishlistDialog';
import { useToast } from '@/components/ui/use-toast';

interface WishlistButtonProps {
  tournament: Tournament;
}

export function WishlistButton({ tournament }: WishlistButtonProps) {
  const { isAuthenticated } = useAuth();
  const { isInWishlist, wishlistCount, limit } = useWishlist();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);

  const inWishlist = isInWishlist(tournament.id);

  const handleClick = () => {
    if (!isAuthenticated) {
      toast({
        title: 'Login Required',
        description: 'Please log in to add tournaments to your wishlist.',
        variant: 'default',
      });
      return;
    }

    if (wishlistCount >= limit && !inWishlist) {
      toast({
        title: 'Wishlist Limit Reached',
        description: `Free accounts can save up to ${limit} tournaments. Upgrade for unlimited.`,
        variant: 'destructive',
      });
      return;
    }

    setDialogOpen(true);
  };

  return (
    <>
      <Button
        variant={inWishlist ? 'default' : 'outline'}
        size="icon"
        onClick={handleClick}
      >
        <Heart className={`h-4 w-4 ${inWishlist ? 'fill-current' : ''}`} />
      </Button>

      <AddToWishlistDialog
        tournament={tournament}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  );
}
```

#### useInfiniteScroll.ts

```tsx
import { useInfiniteQuery } from '@tanstack/react-query';
import { useEffect, useRef, useCallback } from 'react';

interface UseInfiniteScrollOptions<T> {
  queryKey: unknown[];
  queryFn: (cursor?: string) => Promise<{
    data: T[];
    nextCursor: string | null;
    hasMore: boolean;
  }>;
  enabled?: boolean;
}

export function useInfiniteScroll<T>({
  queryKey,
  queryFn,
  enabled = true,
}: UseInfiniteScrollOptions<T>) {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
  } = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => queryFn(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled,
  });

  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    [fetchNextPage, hasNextPage, isFetchingNextPage]
  );

  useEffect(() => {
    const element = loadMoreRef.current;
    if (!element) return;

    observerRef.current = new IntersectionObserver(handleObserver, {
      threshold: 0.1,
    });

    observerRef.current.observe(element);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [handleObserver]);

  const items = data?.pages.flatMap((page) => page.data) ?? [];

  return {
    items,
    isLoading,
    error,
    isFetchingNextPage,
    hasNextPage,
    loadMoreRef,
  };
}
```

### 6.4 Routing Configuration

```tsx
// App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/components/auth/AuthProvider';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

import { Layout } from '@/components/layout/Layout';
import { HomePage } from '@/pages/HomePage';
import { TournamentsPage } from '@/pages/TournamentsPage';
import { TournamentDetailPage } from '@/pages/TournamentDetailPage';
import { WishlistPage } from '@/pages/WishlistPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { AthletesPage } from '@/pages/AthletesPage';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 2,
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              {/* Public routes */}
              <Route path="/" element={<HomePage />} />
              <Route path="/tournaments" element={<TournamentsPage />} />
              <Route path="/tournaments/:id" element={<TournamentDetailPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />

              {/* Protected routes */}
              <Route element={<ProtectedRoute />}>
                <Route path="/wishlist" element={<WishlistPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/athletes" element={<AthletesPage />} />
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}
```

---

## 7. Cost Estimation

### 7.1 Cost Calculation Flow

```
User clicks "Calculate Cost" on wishlist entry
                    │
                    ▼
┌─────────────────────────────────────────┐
│ Check: Does user have home address?     │
│                                         │
│ NO ──► Return { addressRequired: true } │
│        Frontend shows address prompt    │
│                                         │
│ YES ──► Continue                        │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│ Get tournament venue address            │
└─────────────────────────────────────────┘
                    │
          ┌────────┴────────┐
          ▼                 ▼
┌─────────────────┐ ┌─────────────────────┐
│ Google Maps API │ │ Hotel Pricing API   │
│ Distance Matrix │ │ (Amadeus/Booking)   │
└────────┬────────┘ └──────────┬──────────┘
         │                     │
         ▼                     ▼
┌─────────────────┐ ┌─────────────────────┐
│ Calculate:      │ │ Get average nightly │
│ - Distance      │ │ rate for area       │
│ - Travel mode   │ │ × tournament nights │
│ - Travel cost   │ │                     │
└────────┬────────┘ └──────────┬──────────┘
         │                     │
         └──────────┬──────────┘
                    ▼
┌─────────────────────────────────────────┐
│ Store estimate in wishlist entry        │
│ Return combined estimate to user        │
└─────────────────────────────────────────┘
```

### 7.2 Travel Cost Logic

```typescript
// cost-calculator.ts

interface TravelEstimate {
  mode: 'drive' | 'fly';
  distanceMiles: number;
  cost: number;
  details: {
    ratePerMile?: number;
    estimatedFlightCost?: number;
  };
}

const DRIVE_THRESHOLD_MILES = 400;
const MILEAGE_RATE = 0.655; // IRS 2024 rate

async function calculateTravelCost(
  origin: Address,
  destination: Address
): Promise<TravelEstimate> {
  // Get driving distance from Google Maps
  const distanceResult = await googleMapsClient.distancematrix({
    origins: [formatAddress(origin)],
    destinations: [formatAddress(destination)],
    units: 'imperial',
  });

  const distanceMiles = distanceResult.rows[0].elements[0].distance.value / 1609.34;

  // Determine travel mode
  if (distanceMiles < DRIVE_THRESHOLD_MILES) {
    return {
      mode: 'drive',
      distanceMiles,
      cost: Math.round(distanceMiles * MILEAGE_RATE * 2 * 100) / 100, // Round trip
      details: {
        ratePerMile: MILEAGE_RATE,
      },
    };
  }

  // For flights, use estimated cost based on distance
  // In production, integrate with flight API
  const estimatedFlightCost = estimateFlightCost(distanceMiles);

  return {
    mode: 'fly',
    distanceMiles,
    cost: estimatedFlightCost,
    details: {
      estimatedFlightCost,
    },
  };
}

function estimateFlightCost(distanceMiles: number): number {
  // Simplified estimation (in production, use Amadeus or similar)
  // Base cost + per-mile cost, with diminishing returns for longer flights
  const baseCost = 150;
  const perMileCost = 0.10;
  const maxCost = 600;

  const estimated = baseCost + (distanceMiles * perMileCost);
  return Math.min(estimated, maxCost);
}
```

### 7.3 Hotel Cost Logic

```typescript
// hotel-estimator.ts

interface HotelEstimate {
  nights: number;
  ratePerNight: number;
  total: number;
}

async function estimateHotelCost(
  tournament: Tournament,
  userAddress: Address
): Promise<HotelEstimate> {
  // Calculate nights needed (arrive day before, leave day after)
  const startDate = new Date(tournament.startDate);
  const endDate = new Date(tournament.endDate);
  const nights = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  // Check if local (no hotel needed)
  const distance = await getDistance(userAddress, tournament.venueAddress);
  if (distance < 50) {
    return {
      nights: 0,
      ratePerNight: 0,
      total: 0,
    };
  }

  // Get average hotel rate for the area
  // In production, use Amadeus Hotel API or similar
  const ratePerNight = await getAverageHotelRate(
    tournament.city,
    tournament.state,
    startDate
  );

  return {
    nights,
    ratePerNight,
    total: nights * ratePerNight,
  };
}

async function getAverageHotelRate(
  city: string,
  state: string,
  date: Date
): Promise<number> {
  // In production, call hotel pricing API
  // For MVP, use static averages by region
  const cityRates: Record<string, number> = {
    'Las Vegas': 150,
    'Dallas': 120,
    'Houston': 110,
    'Los Angeles': 175,
    'New York': 200,
    // ... more cities
  };

  return cityRates[city] || 125; // Default rate
}
```

### 7.4 Lambda Function (Cost Calculator)

```typescript
// lambda/cost-calculator/handler.ts

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export async function handler(event: {
  wishlistId: string;
  userId: string;
}) {
  // Get wishlist entry
  const wishlist = await docClient.send(new GetCommand({
    TableName: 'wishlists',
    Key: { id: event.wishlistId },
  }));

  if (!wishlist.Item || wishlist.Item.userId !== event.userId) {
    throw new Error('Wishlist entry not found');
  }

  // Get user (for address)
  const user = await docClient.send(new GetCommand({
    TableName: 'users',
    Key: { id: event.userId },
  }));

  if (!user.Item?.homeAddress) {
    return {
      statusCode: 400,
      body: JSON.stringify({ addressRequired: true }),
    };
  }

  // Get tournament (for venue)
  const tournament = await docClient.send(new GetCommand({
    TableName: 'tournaments',
    Key: { id: wishlist.Item.tournamentId },
  }));

  // Calculate costs
  const travelEstimate = await calculateTravelCost(
    user.Item.homeAddress,
    tournament.Item.venueAddress
  );

  const hotelEstimate = await estimateHotelCost(
    tournament.Item,
    user.Item.homeAddress
  );

  const costEstimate = {
    travel: travelEstimate.cost,
    hotel: hotelEstimate.total,
    total: travelEstimate.cost + hotelEstimate.total,
    travelMode: travelEstimate.mode,
    calculatedAt: new Date().toISOString(),
    travelDetails: travelEstimate.details,
    hotelDetails: {
      nights: hotelEstimate.nights,
      ratePerNight: hotelEstimate.ratePerNight,
    },
  };

  // Update wishlist entry
  await docClient.send(new UpdateCommand({
    TableName: 'wishlists',
    Key: { id: event.wishlistId },
    UpdateExpression: 'SET costEstimate = :cost, travelMode = :mode, updatedAt = :now',
    ExpressionAttributeValues: {
      ':cost': costEstimate,
      ':mode': travelEstimate.mode,
      ':now': new Date().toISOString(),
    },
  }));

  return {
    statusCode: 200,
    body: JSON.stringify({ costEstimate }),
  };
}
```

---

## 8. Infrastructure

### 8.1 AWS Services

| Service | Purpose | Configuration |
|---------|---------|---------------|
| **CloudFront** | CDN, SSL termination | Origins: S3 (static), ALB (API) |
| **S3** | Frontend hosting, user files | Versioning enabled, lifecycle rules |
| **API Gateway** | REST API | Regional, Cognito authorizer |
| **ECS Fargate** | API containers | 2 tasks min, auto-scale to 10 |
| **Lambda** | Async jobs | 1024MB, 30s timeout |
| **DynamoDB** | Database | On-demand capacity |
| **Cognito** | Authentication | User pool + app client |
| **Secrets Manager** | API keys | Google Maps, Hotel API keys |
| **EventBridge** | Scheduling | Tournament sync cron |
| **CloudWatch** | Monitoring | Logs, metrics, alarms |

### 8.2 Infrastructure Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                    VPC                                       │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                         Public Subnets                                │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐       │   │
│  │  │   NAT Gateway   │  │   NAT Gateway   │  │  ALB (API)      │       │   │
│  │  │   (AZ-a)        │  │   (AZ-b)        │  │                 │       │   │
│  │  └─────────────────┘  └─────────────────┘  └────────┬────────┘       │   │
│  └──────────────────────────────────────────────────────┼────────────────┘   │
│                                                         │                    │
│  ┌──────────────────────────────────────────────────────┼────────────────┐   │
│  │                        Private Subnets               │                │   │
│  │  ┌─────────────────┐  ┌─────────────────┐           │                │   │
│  │  │  ECS Fargate    │  │  ECS Fargate    │◄──────────┘                │   │
│  │  │  Task (AZ-a)    │  │  Task (AZ-b)    │                            │   │
│  │  └────────┬────────┘  └────────┬────────┘                            │   │
│  │           │                    │                                      │   │
│  │           └─────────┬──────────┘                                      │   │
│  │                     │                                                 │   │
│  │                     ▼                                                 │   │
│  │  ┌─────────────────────────────────────────────────────────────┐     │   │
│  │  │                    VPC Endpoints                             │     │   │
│  │  │  DynamoDB │ S3 │ Secrets Manager │ CloudWatch │ Cognito     │     │   │
│  │  └─────────────────────────────────────────────────────────────┘     │   │
│  └───────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           AWS Managed Services                               │
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │  DynamoDB    │  │   Cognito    │  │     S3       │  │  CloudWatch  │    │
│  │  (4 tables)  │  │  User Pool   │  │   Buckets    │  │    Logs      │    │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘    │
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                       │
│  │   Lambda     │  │ EventBridge  │  │   Secrets    │                       │
│  │  Functions   │  │  Scheduler   │  │   Manager    │                       │
│  └──────────────┘  └──────────────┘  └──────────────┘                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 8.3 ECS Task Definition

```json
{
  "family": "tournament-tracker-api",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::ACCOUNT:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::ACCOUNT:role/ecsTaskRole",
  "containerDefinitions": [
    {
      "name": "api",
      "image": "ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/tournament-tracker-api:latest",
      "portMappings": [
        {
          "containerPort": 8000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {"name": "NODE_ENV", "value": "production"},
        {"name": "AWS_REGION", "value": "us-east-1"}
      ],
      "secrets": [
        {
          "name": "GOOGLE_MAPS_API_KEY",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:ACCOUNT:secret:google-maps-key"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/tournament-tracker-api",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost:8000/health || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3
      }
    }
  ]
}
```

### 8.4 EventBridge Schedule (Tournament Sync)

```json
{
  "Name": "tournament-sync-daily",
  "ScheduleExpression": "cron(0 2 * * ? *)",
  "State": "ENABLED",
  "Target": {
    "Arn": "arn:aws:lambda:us-east-1:ACCOUNT:function:tournament-sync",
    "RoleArn": "arn:aws:iam::ACCOUNT:role/eventbridge-lambda-role"
  }
}
```

---

## 9. Security

### 9.1 Security Measures

| Layer | Measure | Implementation |
|-------|---------|----------------|
| **Network** | VPC isolation | Private subnets for compute |
| **Network** | WAF | CloudFront WAF rules |
| **Transport** | TLS 1.3 | CloudFront + ALB |
| **Auth** | JWT validation | Cognito authorizer |
| **Auth** | Token refresh | Short-lived access (1h) |
| **API** | Rate limiting | 300 req/min per user |
| **API** | Input validation | Zod schemas |
| **Bot** | reCAPTCHA v3 | Registration endpoint |
| **Data** | Encryption at rest | DynamoDB default |
| **Data** | Row-level security | User ID checks |
| **Secrets** | Secrets Manager | API keys, credentials |

### 9.2 API Gateway Authorizer

```yaml
Authorizer:
  Type: COGNITO_USER_POOLS
  IdentitySource: method.request.header.Authorization
  ProviderARNs:
    - !GetAtt UserPool.Arn
```

### 9.3 IAM Roles

#### ECS Task Role

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "dynamodb:Scan"
      ],
      "Resource": [
        "arn:aws:dynamodb:*:*:table/tournaments*",
        "arn:aws:dynamodb:*:*:table/users*",
        "arn:aws:dynamodb:*:*:table/athletes*",
        "arn:aws:dynamodb:*:*:table/wishlists*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject"
      ],
      "Resource": "arn:aws:s3:::tournament-tracker-files/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": "arn:aws:secretsmanager:*:*:secret:tournament-tracker/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "lambda:InvokeFunction"
      ],
      "Resource": "arn:aws:lambda:*:*:function:cost-calculator"
    }
  ]
}
```

### 9.4 reCAPTCHA Integration

```typescript
// middleware/recaptcha.ts

import axios from 'axios';

const RECAPTCHA_SECRET = process.env.RECAPTCHA_SECRET_KEY;
const RECAPTCHA_THRESHOLD = 0.5;

export async function verifyRecaptcha(token: string): Promise<boolean> {
  try {
    const response = await axios.post(
      'https://www.google.com/recaptcha/api/siteverify',
      null,
      {
        params: {
          secret: RECAPTCHA_SECRET,
          response: token,
        },
      }
    );

    const { success, score } = response.data;

    return success && score >= RECAPTCHA_THRESHOLD;
  } catch (error) {
    console.error('reCAPTCHA verification failed:', error);
    return false;
  }
}
```

---

## 10. Implementation Plan

### 10.1 Phase Breakdown

#### Phase 1: Foundation (Infrastructure + Auth)

**Deliverables:**
- [ ] AWS account setup and VPC configuration
- [ ] DynamoDB tables created
- [ ] Cognito User Pool configured
- [ ] API Gateway with Cognito authorizer
- [ ] ECS Fargate cluster and service
- [ ] CI/CD pipeline (GitHub Actions → ECR → ECS)
- [ ] CloudFront distribution for frontend

**APIs:**
- [ ] `POST /auth/register`
- [ ] `POST /auth/login`
- [ ] `POST /auth/refresh`
- [ ] `POST /auth/logout`
- [ ] `GET /health`

---

#### Phase 2: User & Athlete Management

**Deliverables:**
- [ ] User profile CRUD
- [ ] Athlete CRUD
- [ ] Frontend: Registration flow
- [ ] Frontend: Login flow
- [ ] Frontend: Profile page
- [ ] Frontend: Athletes page

**APIs:**
- [ ] `GET /parents/me`
- [ ] `PATCH /parents/me`
- [ ] `GET /athletes`
- [ ] `POST /athletes`
- [ ] `PATCH /athletes/:id`
- [ ] `DELETE /athletes/:id`

---

#### Phase 3: Tournament Data

**Deliverables:**
- [ ] Tournament sync Lambda (IBJJF + JJWL fetchers)
- [ ] EventBridge daily schedule
- [ ] Tournament listing with filters
- [ ] Tournament detail view
- [ ] Frontend: Tournaments page with infinite scroll
- [ ] Frontend: Tournament detail page
- [ ] Frontend: Filter components

**APIs:**
- [ ] `GET /tournaments`
- [ ] `GET /tournaments/:id`

---

#### Phase 4: Wishlist

**Deliverables:**
- [ ] Wishlist CRUD with limit enforcement
- [ ] Add-to-wishlist flow (requires athlete)
- [ ] Frontend: Wishlist button component
- [ ] Frontend: Add to wishlist dialog
- [ ] Frontend: Wishlist page

**APIs:**
- [ ] `GET /wishlist`
- [ ] `POST /wishlist`
- [ ] `PATCH /wishlist/:id`
- [ ] `DELETE /wishlist/:id`

---

#### Phase 5: Cost Estimation

**Deliverables:**
- [ ] Cost calculator Lambda
- [ ] Google Maps API integration
- [ ] Hotel pricing integration (or static data)
- [ ] Address prompt flow
- [ ] Frontend: Cost estimate display
- [ ] Frontend: Address entry modal

**APIs:**
- [ ] `POST /wishlist/:id/calculate-cost`

---

#### Phase 6: Polish & Launch

**Deliverables:**
- [ ] Error handling and user feedback
- [ ] Loading states and skeleton screens
- [ ] Mobile responsiveness testing
- [ ] Performance optimization
- [ ] CloudWatch dashboards and alarms
- [ ] Documentation
- [ ] Beta testing

---

### 10.2 File Structure (Backend)

```
backend/
├── src/
│   ├── config/
│   │   ├── aws.ts
│   │   ├── cognito.ts
│   │   └── env.ts
│   ├── middleware/
│   │   ├── auth.ts
│   │   ├── errorHandler.ts
│   │   ├── rateLimiter.ts
│   │   ├── recaptcha.ts
│   │   └── validation.ts
│   ├── routes/
│   │   ├── auth.ts
│   │   ├── parents.ts
│   │   ├── athletes.ts
│   │   ├── tournaments.ts
│   │   └── wishlist.ts
│   ├── services/
│   │   ├── authService.ts
│   │   ├── userService.ts
│   │   ├── athleteService.ts
│   │   ├── tournamentService.ts
│   │   └── wishlistService.ts
│   ├── repositories/
│   │   ├── userRepository.ts
│   │   ├── athleteRepository.ts
│   │   ├── tournamentRepository.ts
│   │   └── wishlistRepository.ts
│   ├── fetchers/
│   │   ├── ibjjfFetcher.ts
│   │   ├── jjwlFetcher.ts
│   │   └── mappers/
│   │       ├── ibjjfMapper.ts
│   │       └── jjwlMapper.ts
│   ├── types/
│   │   ├── user.ts
│   │   ├── athlete.ts
│   │   ├── tournament.ts
│   │   └── wishlist.ts
│   ├── utils/
│   │   ├── errors.ts
│   │   └── validators.ts
│   ├── app.ts
│   └── server.ts
├── lambda/
│   ├── tournament-sync/
│   │   └── handler.ts
│   └── cost-calculator/
│       └── handler.ts
├── Dockerfile
├── package.json
└── tsconfig.json
```

---

## Appendix A: Environment Variables

### Backend (ECS)

```env
NODE_ENV=production
AWS_REGION=us-east-1
COGNITO_USER_POOL_ID=us-east-1_xxxxxx
COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
DYNAMODB_TOURNAMENTS_TABLE=tournaments
DYNAMODB_USERS_TABLE=users
DYNAMODB_ATHLETES_TABLE=athletes
DYNAMODB_WISHLISTS_TABLE=wishlists
FREE_TIER_WISHLIST_LIMIT=5
```

### Backend (Secrets Manager)

```
tournament-tracker/google-maps-key
tournament-tracker/hotel-api-key
tournament-tracker/recaptcha-secret
```

### Frontend

```env
VITE_API_URL=https://api.tournamenttracker.com/v1
VITE_COGNITO_USER_POOL_ID=us-east-1_xxxxxx
VITE_COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
VITE_RECAPTCHA_SITE_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## Appendix B: API Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `UNAUTHORIZED` | 401 | Missing or invalid token |
| `FORBIDDEN` | 403 | Access denied to resource |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Resource already exists |
| `RECAPTCHA_FAILED` | 422 | reCAPTCHA verification failed |
| `WISHLIST_LIMIT_REACHED` | 429 | Free tier limit exceeded |
| `ADDRESS_REQUIRED` | 400 | Home address needed for cost calc |
| `ATHLETE_REQUIRED` | 400 | Must create athlete first |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

---

## Appendix C: Data Validation Schemas

```typescript
// validators.ts
import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string()
    .min(8)
    .regex(/[A-Z]/, 'Must contain uppercase')
    .regex(/[a-z]/, 'Must contain lowercase')
    .regex(/[0-9]/, 'Must contain number')
    .regex(/[^A-Za-z0-9]/, 'Must contain special character'),
  name: z.string().min(1).max(100),
  recaptchaToken: z.string(),
});

export const athleteSchema = z.object({
  name: z.string().min(1).max(100),
  beltRank: z.enum(['white', 'blue', 'purple', 'brown', 'black']),
  ageDivision: z.string().min(1).max(50),
  weightClass: z.string().min(1).max(50),
  ibjjfId: z.string().optional(),
  jjwlId: z.string().optional(),
});

export const wishlistCreateSchema = z.object({
  tournamentId: z.string().uuid(),
  athleteId: z.string().uuid(),
  status: z.enum(['interested', 'registered']),
});

export const addressSchema = z.object({
  street: z.string().min(1).max(200),
  city: z.string().min(1).max(100),
  state: z.string().min(1).max(50),
  zip: z.string().min(1).max(20),
  country: z.string().min(1).max(50),
});
```

