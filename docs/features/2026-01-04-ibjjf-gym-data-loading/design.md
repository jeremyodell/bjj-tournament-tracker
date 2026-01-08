# Design: IBJJF Gym Data Loading

**Date:** 2026-01-04
**Status:** Approved
**Scope:** Backend only (fetcher, sync service, infrastructure)

## Overview

Load and sync gym/academy data from the IBJJF API to enable gym-based features (roster lookup, teammate tracking). Builds on the existing JJWL gym infrastructure, extending the schema to support IBJJF's richer data.

### Key Decisions Made

1. **Extended schema** - Add optional fields to `SourceGymItem` for IBJJF data (country, city, address, federation, website) while maintaining JJWL compatibility
2. **Sequential pagination** - Fetch 429 pages one at a time with 200ms delay to avoid rate limiting (~8 min for full sync)
3. **Change detection** - Check `totalRecords` before syncing; skip if unchanged to save API calls
4. **Separate schedule** - Weekly EventBridge trigger (Sundays 6am UTC), independent from daily tournament sync
5. **Email alerts** - CloudWatch Alarm + SNS for sync failure notifications

## Data Model

### Extended SourceGymItem

```typescript
export interface SourceGymItem {
  PK: string;           // SRCGYM#{org}#{externalId}
  SK: 'META';
  GSI1PK: 'GYMS';
  GSI1SK: string;       // {org}#{name}
  org: 'JJWL' | 'IBJJF';
  externalId: string;
  name: string;
  masterGymId: string | null;
  createdAt: string;
  updatedAt: string;

  // Optional IBJJF-specific fields
  country?: string | null;
  countryCode?: string | null;
  city?: string | null;
  address?: string | null;
  federation?: string | null;  // e.g., "USBJJF", "CBJJ"
  website?: string | null;
  responsible?: string | null; // Head instructor/owner
}
```

### GymSyncMetaItem (New)

Tracks sync state to enable "skip if unchanged" optimization:

```typescript
export interface GymSyncMetaItem {
  PK: 'GYMSYNC#IBJJF';
  SK: 'META';
  totalRecords: number;
  lastSyncAt: string;
  lastChangeAt: string;  // When totalRecords actually changed
}
```

## External API

### IBJJF Academies API

```
GET https://ibjjf.com/api/v1/academies/list.json?page={n}

Headers:
- Accept: application/json
- X-Requested-With: XMLHttpRequest
- Referer: https://ibjjf.com/

Response:
{
  "pagination": {
    "page": 1,
    "pageSize": 20,      // Fixed, cannot be changed
    "lastPage": 429,
    "totalRecords": 8576
  },
  "list": [
    {
      "id": 13240,
      "name": "FIGHT ACADEMY JMF",
      "federationAbbr": "CBJJ",
      "country": "Brasil",
      "countryAbbr": "BR",
      "city": "Manaus",
      "responsible": "Alex Taveira de Lira",
      "address": "Rua Cacique, 543, Colonia Terra Nova, Manaus, Amazonas, Brasil",
      "website": null
    }
  ]
}
```

**Constraints:**
- Page size fixed at 20 (pageSize parameter ignored)
- 429 pages total (~8,576 gyms)
- Requires XMLHttpRequest header to avoid 406 error

## IBJJF Gym Fetcher

### Types

```typescript
interface IBJJFAcademy {
  id: number;
  name: string;
  federationAbbr: string;
  country: string;
  countryAbbr: string;
  city: string;
  responsible: string;
  address: string;
  website: string | null;
}

interface IBJJFAcademiesResponse {
  pagination: {
    page: number;
    pageSize: number;
    lastPage: number;
    totalRecords: number;
  };
  list: IBJJFAcademy[];
}
```

### Core Functions

```typescript
// Quick check for change detection
async function fetchIBJJFGymCount(): Promise<number>

// Fetch single page
async function fetchIBJJFGymPage(page: number): Promise<IBJJFAcademiesResponse>

// Full sync with sequential pagination
async function fetchAllIBJJFGyms(): Promise<NormalizedGym[]> {
  const firstPage = await fetchIBJJFGymPage(1);
  const totalPages = firstPage.pagination.lastPage;
  const gyms = [...firstPage.list.map(mapToNormalized)];

  for (let page = 2; page <= totalPages; page++) {
    await sleep(200); // Rate limit protection
    const result = await fetchIBJJFGymPage(page);
    gyms.push(...result.list.map(mapToNormalized));
  }
  return gyms;
}

// Map API response to our schema
function mapIBJJFAcademyToNormalizedGym(academy: IBJJFAcademy): NormalizedGym
```

## Sync Service

### Sync Flow

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ EventBridge     │────▶│ Check totalRecords│────▶│ Changed?        │
│ (Sunday 6am)    │     │ from IBJJF API    │     │                 │
└─────────────────┘     └──────────────────┘     └────────┬────────┘
                                                          │
                        ┌──────────────────┐              │ No
                        │ Skip sync,       │◀─────────────┘
                        │ log "unchanged"  │
                        └──────────────────┘
                                                          │ Yes
                        ┌──────────────────┐              ▼
                        │ Fetch all pages  │◀─────────────┘
                        │ (429 pages, ~8min)│
                        └────────┬─────────┘
                                 │
                        ┌────────▼─────────┐
                        │ Upsert to DynamoDB│
                        │ Update sync meta  │
                        └──────────────────┘
```

### Sync Result Type

```typescript
interface IBJJFGymSyncResult {
  skipped: boolean;      // True if totalRecords unchanged
  previousTotal: number;
  currentTotal: number;
  fetched: number;
  saved: number;
  duration: number;      // ms
  error?: string;
}
```

## New Files

```
backend/src/
├── fetchers/
│   └── ibjjfGymFetcher.ts      # IBJJF academy API fetcher
├── handlers/
│   └── gymSync.ts              # Lambda handler for scheduled sync
└── __tests__/
    └── fetchers/
        └── ibjjfGymFetcher.test.ts
```

## Modified Files

```
backend/src/
├── db/
│   ├── types.ts                # Add optional fields to SourceGymItem
│   │                           # Add GymSyncMetaItem type
│   └── gymQueries.ts           # Add getGymSyncMeta, updateGymSyncMeta
├── fetchers/
│   └── types.ts                # Add IBJJFAcademy, IBJJFGymResponse types
└── services/
    └── gymSyncService.ts       # Add syncIBJJFGyms function
```

## Infrastructure (SAM Template)

### GymSyncFunction

```yaml
GymSyncFunction:
  Type: AWS::Serverless::Function
  Properties:
    FunctionName: !Sub bjj-gym-sync-${Stage}
    Handler: dist/handlers/gymSync.handler
    Timeout: 900  # 15 min (for full 8500+ gym sync)
    MemorySize: 256
    Policies:
      - DynamoDBCrudPolicy:
          TableName: !Ref TournamentsTable
    Events:
      WeeklySchedule:
        Type: ScheduleV2
        Properties:
          ScheduleExpression: "cron(0 6 ? * SUN *)"
```

### CloudWatch Alarm

```yaml
GymSyncErrorAlarm:
  Type: AWS::CloudWatch::Alarm
  Properties:
    AlarmName: !Sub bjj-gym-sync-errors-${Stage}
    MetricName: Errors
    Namespace: AWS/Lambda
    Dimensions:
      - Name: FunctionName
        Value: !Ref GymSyncFunction
    Statistic: Sum
    Period: 300
    EvaluationPeriods: 1
    Threshold: 1
    ComparisonOperator: GreaterThanOrEqualToThreshold
    AlarmActions:
      - !Ref AlertsTopic
```

## Out of Scope

- IBJJF roster fetching (different API pattern, separate ticket)
- Cross-source gym matching (`masterGymId` linking)
- Frontend gym search UI
- Gym detail page UI
