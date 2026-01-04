# IBJJF Gym Fetcher Design

**Issue:** ODE-25 - Create IBJJF gym fetcher
**Date:** 2026-01-04

## Overview

Implement a fetcher to retrieve academy data from the IBJJF API with sequential pagination and rate limiting.

## Architecture

### File Structure

**New file:** `backend/src/fetchers/ibjjfGymFetcher.ts`

**Exports:**
- `sanitizeGymName(name: string): string`
- `mapIBJJFAcademyToGym(academy: IBJJFAcademy): IBJJFNormalizedGym`
- `parseIBJJFAcademiesResponse(data: unknown): { gyms: IBJJFNormalizedGym[], totalRecords: number }`
- `fetchIBJJFGymPage(page: number): Promise<IBJJFAcademiesResponse>`
- `fetchIBJJFGymCount(): Promise<number>`
- `fetchAllIBJJFGyms(onProgress?: ProgressCallback): Promise<IBJJFNormalizedGym[]>`

### API Interaction

- **Endpoint:** `https://ibjjf.com/api/academies` with pagination params
- **Headers:** `{ 'x-requested-with': 'XMLHttpRequest' }` to avoid 406 error
- **Page size:** Fixed at 20 (cannot be changed)
- **Response format:** `{ data: IBJJFAcademy[], totalRecords: number, filteredRecords: number }`

### Pagination Strategy

Sequential pagination with 200ms delay between requests:

```typescript
async function fetchAllIBJJFGyms(onProgress?: (page: number, total: number) => void) {
  const allGyms: IBJJFNormalizedGym[] = [];
  let page = 0;
  let totalPages = 1;

  while (page < totalPages) {
    try {
      const response = await fetchIBJJFGymPage(page);
      totalPages = Math.ceil(response.totalRecords / 20);
      allGyms.push(...parseAndMap(response.data));
      onProgress?.(page + 1, totalPages);
    } catch (error) {
      console.warn(`[IBJJFGymFetcher] Page ${page} failed, skipping:`, error);
    }

    await delay(200);
    page++;
  }

  return allGyms;
}
```

Error handling: Log and skip malformed pages rather than failing entire sync.

## Implementation Details

### sanitizeGymName

```typescript
export function sanitizeGymName(name: string): string {
  return name.replace(/#/g, '').trim();
}
```

Removes `#` characters that break GSI1SK (DynamoDB sort key).

### mapIBJJFAcademyToGym

```typescript
export function mapIBJJFAcademyToGym(academy: IBJJFAcademy): IBJJFNormalizedGym {
  return {
    org: 'IBJJF',
    externalId: String(academy.id),
    name: sanitizeGymName(academy.name),
    country: academy.country || undefined,
    countryCode: academy.countryCode || undefined,
    city: academy.city || undefined,
    address: academy.address || undefined,
    federation: academy.federation || undefined,
    website: academy.site || undefined,
    responsible: academy.responsible || undefined,
  };
}
```

### parseIBJJFAcademiesResponse

- Validates response has `data` array and `totalRecords` number
- Filters entries missing required fields (`id`, `name`)
- Logs warnings for skipped entries
- Returns `{ gyms: IBJJFNormalizedGym[], totalRecords: number }`

## Testing

**File:** `backend/src/__tests__/fetchers/ibjjfGymFetcher.test.ts`

### sanitizeGymName tests
- Removes `#` characters from middle of string
- Removes multiple `#` characters
- Trims leading/trailing whitespace
- Handles empty string
- Returns unchanged string with no `#`

### mapIBJJFAcademyToGym tests
- Maps all fields correctly
- Converts numeric `id` to string `externalId`
- Sanitizes name
- Handles missing optional fields

### parseIBJJFAcademiesResponse tests
- Parses valid response with multiple academies
- Filters entries with missing `id`
- Filters entries with missing/empty `name`
- Returns empty array for invalid response formats
- Extracts `totalRecords` correctly

## Dependencies

- Uses existing types from `fetchers/types.ts`: `IBJJFAcademy`, `IBJJFAcademiesResponse`, `IBJJFNormalizedGym`
- Follows JJWL gym fetcher pattern
