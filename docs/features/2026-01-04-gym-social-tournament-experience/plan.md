# Gym Social Tournament Experience Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable athletes to see which teammates from their gym are registered at tournaments.

**Architecture:** User selects gym during onboarding (stored on athlete). Tournament cards show org-colored teammate badge when teammates exist. Clicking expands inline list (first 3). Tournament detail page shows full roster grouped by division. Roster data fetched on-demand, cached 24h, with manual refresh and daily background sync for upcoming tournaments.

**Tech Stack:** Next.js 15, TypeScript, TanStack Query, Zustand, AWS Lambda, DynamoDB, EventBridge

**Dependency:** Master gym matching ticket must complete first (enables cross-org gym lookup)

---

## Phase 1: Backend - Cross-Org Gym Search

### Task 1.1: Add cross-org gym search query

**Files:**
- Modify: `backend/src/db/gymQueries.ts`
- Test: `backend/src/__tests__/db/gymQueries.test.ts`

**Step 1: Write the failing test**

Add to `backend/src/__tests__/db/gymQueries.test.ts`:

```typescript
describe('searchGymsAcrossOrgs', () => {
  it('searches both JJWL and IBJJF orgs and returns combined results', async () => {
    // Insert test gyms in both orgs
    await upsertSourceGym({ org: 'JJWL', externalId: '100', name: 'Gracie Austin' });
    await upsertSourceGym({ org: 'IBJJF', externalId: '200', name: 'Gracie Barra Austin' });

    const results = await searchGymsAcrossOrgs('Gracie');

    expect(results.length).toBeGreaterThanOrEqual(2);
    expect(results.some(g => g.org === 'JJWL')).toBe(true);
    expect(results.some(g => g.org === 'IBJJF')).toBe(true);
  });

  it('limits results to 20 total', async () => {
    const results = await searchGymsAcrossOrgs('A');
    expect(results.length).toBeLessThanOrEqual(20);
  });

  it('returns empty array when no matches', async () => {
    const results = await searchGymsAcrossOrgs('ZZZNONEXISTENT');
    expect(results).toEqual([]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd backend && npm test -- --testPathPattern=gymQueries.test.ts --testNamePattern="searchGymsAcrossOrgs"`

Expected: FAIL with "searchGymsAcrossOrgs is not a function"

**Step 3: Write minimal implementation**

Add to `backend/src/db/gymQueries.ts`:

```typescript
/**
 * Search gyms across all orgs (JJWL + IBJJF)
 * Returns combined results sorted by name
 */
export async function searchGymsAcrossOrgs(
  namePrefix: string,
  limit = 20
): Promise<SourceGymItem[]> {
  // Search both orgs in parallel
  const [jjwlGyms, ibjjfGyms] = await Promise.all([
    searchGyms('JJWL', namePrefix, limit),
    searchGyms('IBJJF', namePrefix, limit),
  ]);

  // Combine and sort by name
  const combined = [...jjwlGyms, ...ibjjfGyms];
  combined.sort((a, b) => a.name.localeCompare(b.name));

  // Limit total results
  return combined.slice(0, limit);
}
```

**Step 4: Run test to verify it passes**

Run: `cd backend && npm test -- --testPathPattern=gymQueries.test.ts --testNamePattern="searchGymsAcrossOrgs"`

Expected: PASS

**Step 5: Commit**

```bash
git add backend/src/db/gymQueries.ts backend/src/__tests__/db/gymQueries.test.ts
git commit -m "feat(db): add cross-org gym search query"
```

---

### Task 1.2: Update gyms handler for cross-org search

**Files:**
- Modify: `backend/src/handlers/gyms.ts`
- Modify: `backend/src/__tests__/handlers/gyms.test.ts`
- Modify: `backend/src/__tests__/utils/testHelpers.ts`

**Step 1: Write the failing test**

Add to `backend/src/__tests__/handlers/gyms.test.ts`:

```typescript
describe('GET /gyms (cross-org search)', () => {
  it('searches across all orgs when org param omitted', async () => {
    const mockGyms = [
      { org: 'JJWL' as const, externalId: '123', name: 'Gracie Austin', PK: 'x', SK: 'META' as const, GSI1PK: 'GYMS', GSI1SK: 'x', masterGymId: null, createdAt: '2026-01-01', updatedAt: '2026-01-01' },
      { org: 'IBJJF' as const, externalId: '456', name: 'Gracie Barra', PK: 'x', SK: 'META' as const, GSI1PK: 'GYMS', GSI1SK: 'x', masterGymId: null, createdAt: '2026-01-01', updatedAt: '2026-01-01' },
    ];
    jest.spyOn(gymQueries, 'searchGymsAcrossOrgs').mockResolvedValue(mockGyms);

    const event = createGymsSearchEvent({ search: 'Gracie' }); // No org param
    const result = await handler(event, context);

    expect(result.statusCode).toBe(200);
    expect(gymQueries.searchGymsAcrossOrgs).toHaveBeenCalledWith('Gracie');
    const body = parseResponseBody<{ gyms: unknown[] }>(result);
    expect(body.gyms).toHaveLength(2);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd backend && npm test -- --testPathPattern=handlers/gyms.test.ts --testNamePattern="cross-org"`

Expected: FAIL

**Step 3: Write minimal implementation**

Update `backend/src/handlers/gyms.ts` - modify the search handler:

```typescript
import { searchGyms, searchGymsAcrossOrgs, getSourceGym, getGymRoster } from '../db/gymQueries.js';

// In gymsHandler, update the GET /gyms block:
if (method === 'GET' && !pathOrg && !externalId) {
  const searchQuery = event.queryStringParameters?.search || '';
  const orgFilter = event.queryStringParameters?.org as 'JJWL' | 'IBJJF' | undefined;

  let gyms;
  if (orgFilter) {
    if (orgFilter !== 'JJWL' && orgFilter !== 'IBJJF') {
      throw new ValidationError('org must be JJWL or IBJJF');
    }
    gyms = await searchGyms(orgFilter, searchQuery);
  } else {
    // Cross-org search when no org specified
    gyms = await searchGymsAcrossOrgs(searchQuery);
  }

  return jsonResponse(200, {
    gyms: gyms.map((g) => ({
      org: g.org,
      externalId: g.externalId,
      name: g.name,
      city: g.city ?? null,
    })),
  });
}
```

**Step 4: Run test to verify it passes**

Run: `cd backend && npm test -- --testPathPattern=handlers/gyms.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add backend/src/handlers/gyms.ts backend/src/__tests__/handlers/gyms.test.ts
git commit -m "feat(api): support cross-org gym search"
```

---

## Phase 2: Backend - Athlete Gym Association

### Task 2.1: Update athlete queries for gym fields

**Files:**
- Modify: `backend/src/db/athleteQueries.ts`
- Modify: `backend/src/__tests__/db/athleteQueries.test.ts` (create if missing)

**Step 1: Verify athlete creation accepts gymSourceId/gymName**

Check `backend/src/db/athleteQueries.ts` - the `createAthlete` and `updateAthlete` functions should already accept these fields since `AthleteItem` has them. If not, add them.

**Step 2: Write test for gym field persistence**

Add to athlete queries test file:

```typescript
describe('athlete gym fields', () => {
  it('creates athlete with gym fields', async () => {
    const athlete = await createAthlete('user-123', {
      name: 'Test Athlete',
      gymSourceId: 'JJWL#5713',
      gymName: 'Pablo Silva BJJ',
    });

    expect(athlete.gymSourceId).toBe('JJWL#5713');
    expect(athlete.gymName).toBe('Pablo Silva BJJ');
  });

  it('updates athlete gym fields', async () => {
    const athlete = await createAthlete('user-123', { name: 'Test' });

    const updated = await updateAthlete('user-123', athlete.athleteId, {
      gymSourceId: 'IBJJF#12345',
      gymName: 'Gracie Barra Austin',
    });

    expect(updated?.gymSourceId).toBe('IBJJF#12345');
    expect(updated?.gymName).toBe('Gracie Barra Austin');
  });
});
```

**Step 3: Run tests**

Run: `cd backend && npm test -- --testPathPattern=athleteQueries`

**Step 4: Commit**

```bash
git add backend/src/db/athleteQueries.ts backend/src/__tests__/db/athleteQueries.test.ts
git commit -m "feat(db): verify athlete gym field support"
```

---

### Task 2.2: Update Athlete API type in frontend

**Files:**
- Modify: `frontend/src/lib/api.ts`

**Step 1: Add gym fields to Athlete interface**

Update in `frontend/src/lib/api.ts`:

```typescript
export interface Athlete {
  athleteId: string;
  name: string;
  beltRank: string | null;
  birthYear: number | null;
  weightClass: string | null;
  homeAirport: string | null;
  gymSourceId: string | null;
  gymName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAthleteInput {
  name: string;
  beltRank?: string;
  birthYear?: number;
  gender?: string;
  weight?: number;
  gymName?: string;
  gymSourceId?: string;
}
```

**Step 2: Build to verify types**

Run: `cd frontend && npm run build`

Expected: PASS

**Step 3: Commit**

```bash
git add frontend/src/lib/api.ts
git commit -m "feat(types): add gym fields to Athlete type"
```

---

## Phase 3: Frontend - Gym Search Component

### Task 3.1: Add gym search API function

**Files:**
- Modify: `frontend/src/lib/api.ts`

**Step 1: Add gym types and fetch function**

Add to `frontend/src/lib/api.ts`:

```typescript
// Gym types and API functions
export interface Gym {
  org: 'JJWL' | 'IBJJF';
  externalId: string;
  name: string;
  city: string | null;
}

export interface GymRoster {
  gymExternalId: string;
  gymName: string | null;
  athletes: Array<{
    name: string;
    belt: string;
    ageDiv: string;
    weight: string;
    gender: string;
  }>;
  athleteCount: number;
  fetchedAt: string | null;
}

export async function searchGyms(query: string): Promise<{ gyms: Gym[] }> {
  const params = new URLSearchParams({ search: query });
  const response = await api.get<{ gyms: Gym[] }>(`/gyms?${params.toString()}`);
  return response.data;
}

export async function fetchGymRoster(
  org: 'JJWL' | 'IBJJF',
  gymExternalId: string,
  tournamentId: string
): Promise<GymRoster> {
  const response = await api.get<GymRoster>(
    `/gyms/${org}/${gymExternalId}/roster/${tournamentId}`
  );
  return response.data;
}
```

**Step 2: Build to verify**

Run: `cd frontend && npm run build`

**Step 3: Commit**

```bash
git add frontend/src/lib/api.ts
git commit -m "feat(api): add gym search and roster fetch functions"
```

---

### Task 3.2: Create gym search hook

**Files:**
- Create: `frontend/src/hooks/useGymSearch.ts`
- Create: `frontend/src/__tests__/hooks/useGymSearch.test.tsx`

**Step 1: Write the failing test**

Create `frontend/src/__tests__/hooks/useGymSearch.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useGymSearch } from '@/hooks/useGymSearch';
import * as api from '@/lib/api';

vi.mock('@/lib/api');

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

describe('useGymSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty results for empty query', async () => {
    const { result } = renderHook(() => useGymSearch(''), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toEqual({ gyms: [] });
    });
  });

  it('searches gyms when query has 2+ characters', async () => {
    vi.mocked(api.searchGyms).mockResolvedValue({
      gyms: [{ org: 'JJWL', externalId: '123', name: 'Gracie Austin', city: 'Austin' }],
    });

    const { result } = renderHook(() => useGymSearch('Gra'), { wrapper });

    await waitFor(() => {
      expect(result.current.data?.gyms).toHaveLength(1);
    });
    expect(api.searchGyms).toHaveBeenCalledWith('Gra');
  });

  it('does not search when query is too short', async () => {
    const { result } = renderHook(() => useGymSearch('G'), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toEqual({ gyms: [] });
    });
    expect(api.searchGyms).not.toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- useGymSearch`

Expected: FAIL with module not found

**Step 3: Write minimal implementation**

Create `frontend/src/hooks/useGymSearch.ts`:

```typescript
import { useQuery } from '@tanstack/react-query';
import { searchGyms, type Gym } from '@/lib/api';

export function useGymSearch(query: string) {
  return useQuery({
    queryKey: ['gyms', 'search', query],
    queryFn: async () => {
      if (query.length < 2) {
        return { gyms: [] as Gym[] };
      }
      return searchGyms(query);
    },
    enabled: true,
    staleTime: 30000, // Cache for 30s
  });
}
```

**Step 4: Run test to verify it passes**

Run: `cd frontend && npm test -- useGymSearch`

Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/hooks/useGymSearch.ts frontend/src/__tests__/hooks/useGymSearch.test.tsx
git commit -m "feat(hooks): add useGymSearch hook"
```

---

### Task 3.3: Create GymSearchAutocomplete component

**Files:**
- Create: `frontend/src/components/gym/GymSearchAutocomplete.tsx`
- Create: `frontend/src/__tests__/components/GymSearchAutocomplete.test.tsx`

**Step 1: Write the failing test**

Create `frontend/src/__tests__/components/GymSearchAutocomplete.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GymSearchAutocomplete } from '@/components/gym/GymSearchAutocomplete';
import * as api from '@/lib/api';

vi.mock('@/lib/api');

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

describe('GymSearchAutocomplete', () => {
  const mockOnSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders input with placeholder', () => {
    render(<GymSearchAutocomplete onSelect={mockOnSelect} />, { wrapper });
    expect(screen.getByPlaceholderText(/search for your gym/i)).toBeInTheDocument();
  });

  it('shows results when typing', async () => {
    vi.mocked(api.searchGyms).mockResolvedValue({
      gyms: [
        { org: 'JJWL', externalId: '123', name: 'Gracie Austin', city: 'Austin, TX' },
        { org: 'IBJJF', externalId: '456', name: 'Gracie Barra', city: 'Round Rock, TX' },
      ],
    });

    render(<GymSearchAutocomplete onSelect={mockOnSelect} />, { wrapper });

    const input = screen.getByPlaceholderText(/search for your gym/i);
    await userEvent.type(input, 'Gracie');

    await waitFor(() => {
      expect(screen.getByText('Gracie Austin')).toBeInTheDocument();
    });
    expect(screen.getByText(/JJWL/)).toBeInTheDocument();
  });

  it('calls onSelect when gym is clicked', async () => {
    vi.mocked(api.searchGyms).mockResolvedValue({
      gyms: [{ org: 'JJWL', externalId: '123', name: 'Gracie Austin', city: 'Austin' }],
    });

    render(<GymSearchAutocomplete onSelect={mockOnSelect} />, { wrapper });

    await userEvent.type(screen.getByPlaceholderText(/search/i), 'Gracie');

    await waitFor(() => {
      expect(screen.getByText('Gracie Austin')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('Gracie Austin'));

    expect(mockOnSelect).toHaveBeenCalledWith({
      org: 'JJWL',
      externalId: '123',
      name: 'Gracie Austin',
      city: 'Austin',
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- GymSearchAutocomplete`

Expected: FAIL with module not found

**Step 3: Write minimal implementation**

Create `frontend/src/components/gym/GymSearchAutocomplete.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { useGymSearch } from '@/hooks/useGymSearch';
import type { Gym } from '@/lib/api';

interface GymSearchAutocompleteProps {
  onSelect: (gym: Gym) => void;
  placeholder?: string;
  selectedGym?: Gym | null;
}

export function GymSearchAutocomplete({
  onSelect,
  placeholder = 'Search for your gym...',
  selectedGym,
}: GymSearchAutocompleteProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const { data, isLoading } = useGymSearch(query);

  const handleSelect = (gym: Gym) => {
    onSelect(gym);
    setQuery('');
    setIsOpen(false);
  };

  const getOrgColor = (org: 'JJWL' | 'IBJJF') => {
    return org === 'IBJJF' ? '#00F0FF' : '#FF2D6A';
  };

  return (
    <div className="relative">
      {selectedGym ? (
        <div
          className="flex items-center justify-between px-4 py-3 rounded-xl border"
          style={{
            background: 'rgba(255, 255, 255, 0.03)',
            borderColor: getOrgColor(selectedGym.org),
          }}
        >
          <div>
            <div className="font-medium">{selectedGym.name}</div>
            <div className="text-sm text-white/60">
              <span
                className="font-semibold"
                style={{ color: getOrgColor(selectedGym.org) }}
              >
                {selectedGym.org}
              </span>
              {selectedGym.city && ` • ${selectedGym.city}`}
            </div>
          </div>
          <button
            onClick={() => onSelect(null as unknown as Gym)}
            className="text-white/40 hover:text-white/60 transition-colors"
          >
            Change
          </button>
        </div>
      ) : (
        <>
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(e.target.value.length >= 2);
            }}
            onFocus={() => query.length >= 2 && setIsOpen(true)}
            placeholder={placeholder}
            className="w-full px-4 py-3 rounded-xl border bg-transparent text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              borderColor: 'rgba(255, 255, 255, 0.08)',
            }}
          />

          {isOpen && (
            <div
              className="absolute z-50 w-full mt-2 rounded-xl border overflow-hidden"
              style={{
                background: 'rgba(0, 0, 0, 0.95)',
                borderColor: 'rgba(255, 255, 255, 0.08)',
                backdropFilter: 'blur(24px)',
              }}
            >
              {isLoading ? (
                <div className="px-4 py-3 text-white/40">Searching...</div>
              ) : data?.gyms.length === 0 ? (
                <div className="px-4 py-3 text-white/40">
                  No gyms found. Gym must be registered with JJWL or IBJJF.
                </div>
              ) : (
                data?.gyms.map((gym) => (
                  <button
                    key={`${gym.org}-${gym.externalId}`}
                    onClick={() => handleSelect(gym)}
                    className="w-full px-4 py-3 text-left hover:bg-white/5 transition-colors flex items-center justify-between"
                  >
                    <div>
                      <div className="font-medium">{gym.name}</div>
                      {gym.city && (
                        <div className="text-sm text-white/50">{gym.city}</div>
                      )}
                    </div>
                    <span
                      className="text-xs font-bold px-2 py-1 rounded"
                      style={{
                        background: `${getOrgColor(gym.org)}15`,
                        color: getOrgColor(gym.org),
                      }}
                    >
                      {gym.org}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `cd frontend && npm test -- GymSearchAutocomplete`

Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/components/gym/GymSearchAutocomplete.tsx frontend/src/__tests__/components/GymSearchAutocomplete.test.tsx
git commit -m "feat(components): add GymSearchAutocomplete component"
```

---

## Phase 4: Frontend - Teammate Badge on Tournament Cards

### Task 4.1: Create useGymRoster hook

**Files:**
- Create: `frontend/src/hooks/useGymRoster.ts`

**Step 1: Write the hook**

Create `frontend/src/hooks/useGymRoster.ts`:

```typescript
import { useQuery } from '@tanstack/react-query';
import { fetchGymRoster, type GymRoster } from '@/lib/api';

interface UseGymRosterParams {
  org: 'JJWL' | 'IBJJF';
  gymExternalId: string | null;
  tournamentId: string;
  enabled?: boolean;
}

export function useGymRoster({
  org,
  gymExternalId,
  tournamentId,
  enabled = true,
}: UseGymRosterParams) {
  return useQuery({
    queryKey: ['gymRoster', org, gymExternalId, tournamentId],
    queryFn: async () => {
      if (!gymExternalId) return null;
      return fetchGymRoster(org, gymExternalId, tournamentId);
    },
    enabled: enabled && !!gymExternalId,
    staleTime: 1000 * 60 * 60, // 1 hour (server handles 24h staleness)
  });
}

export function useGymRosters(
  tournaments: Array<{ org: 'JJWL' | 'IBJJF'; externalId: string }>,
  gymSourceId: string | null
) {
  // Parse gymSourceId: "JJWL#5713" -> { org: "JJWL", externalId: "5713" }
  const gymParts = gymSourceId?.split('#') ?? [];
  const gymOrg = gymParts[0] as 'JJWL' | 'IBJJF' | undefined;
  const gymExternalId = gymParts[1];

  // Only fetch rosters for tournaments matching the gym's org
  const relevantTournaments = tournaments.filter((t) => t.org === gymOrg);

  // Use parallel queries for each tournament
  const queries = relevantTournaments.map((t) => ({
    queryKey: ['gymRoster', t.org, gymExternalId, t.externalId],
    queryFn: async () => fetchGymRoster(t.org, gymExternalId!, t.externalId),
    enabled: !!gymExternalId,
    staleTime: 1000 * 60 * 60,
  }));

  return queries;
}
```

**Step 2: Build to verify**

Run: `cd frontend && npm run build`

**Step 3: Commit**

```bash
git add frontend/src/hooks/useGymRoster.ts
git commit -m "feat(hooks): add useGymRoster hook"
```

---

### Task 4.2: Create TeammatesBadge component

**Files:**
- Create: `frontend/src/components/tournaments/TeammatesBadge.tsx`
- Test: `frontend/src/__tests__/components/TeammatesBadge.test.tsx`

**Step 1: Write the failing test**

Create `frontend/src/__tests__/components/TeammatesBadge.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TeammatesBadge } from '@/components/tournaments/TeammatesBadge';

describe('TeammatesBadge', () => {
  const mockAthletes = [
    { name: 'Tommy Smith', belt: 'Yellow', ageDiv: 'Kids', weight: 'Rooster', gender: 'M' },
    { name: 'Sarah Martinez', belt: 'White', ageDiv: 'Kids', weight: 'Light', gender: 'F' },
    { name: 'Marcus Johnson', belt: 'Purple', ageDiv: 'Adult', weight: 'Medium', gender: 'M' },
  ];

  it('renders nothing when athleteCount is 0', () => {
    const { container } = render(
      <TeammatesBadge org="IBJJF" athletes={[]} athleteCount={0} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders badge with count', () => {
    render(<TeammatesBadge org="IBJJF" athletes={mockAthletes} athleteCount={3} />);
    expect(screen.getByText('3 teammates')).toBeInTheDocument();
  });

  it('uses cyan color for IBJJF', () => {
    render(<TeammatesBadge org="IBJJF" athletes={mockAthletes} athleteCount={3} />);
    const badge = screen.getByText('3 teammates').closest('button');
    expect(badge).toHaveStyle({ borderColor: '#00F0FF' });
  });

  it('uses magenta color for JJWL', () => {
    render(<TeammatesBadge org="JJWL" athletes={mockAthletes} athleteCount={3} />);
    const badge = screen.getByText('3 teammates').closest('button');
    expect(badge).toHaveStyle({ borderColor: '#FF2D6A' });
  });

  it('expands to show athletes on click', () => {
    render(<TeammatesBadge org="IBJJF" athletes={mockAthletes} athleteCount={3} />);

    fireEvent.click(screen.getByText('3 teammates'));

    expect(screen.getByText(/Tommy S\./)).toBeInTheDocument();
    expect(screen.getByText(/Sarah M\./)).toBeInTheDocument();
    expect(screen.getByText(/Marcus J\./)).toBeInTheDocument();
  });

  it('shows "+N more" when more than 3 athletes', () => {
    const manyAthletes = [
      ...mockAthletes,
      { name: 'Alex Chen', belt: 'Blue', ageDiv: 'Adult', weight: 'Light', gender: 'M' },
      { name: 'Jordan Lee', belt: 'White', ageDiv: 'Adult', weight: 'Heavy', gender: 'M' },
    ];

    render(<TeammatesBadge org="IBJJF" athletes={manyAthletes} athleteCount={5} />);

    fireEvent.click(screen.getByText('5 teammates'));

    expect(screen.getByText('+2 more')).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- TeammatesBadge`

Expected: FAIL

**Step 3: Write minimal implementation**

Create `frontend/src/components/tournaments/TeammatesBadge.tsx`:

```typescript
'use client';

import { useState } from 'react';
import type { GymRoster } from '@/lib/api';

interface TeammatesBadgeProps {
  org: 'JJWL' | 'IBJJF';
  athletes: GymRoster['athletes'];
  athleteCount: number;
  onViewAll?: () => void;
}

// Belt color mapping
const BELT_COLORS: Record<string, string> = {
  white: '#e5e5e5',
  blue: '#3b82f6',
  purple: '#a855f7',
  brown: '#92400e',
  black: '#1f1f1f',
  yellow: '#fbbf24',
  orange: '#f97316',
  green: '#22c55e',
  grey: '#6b7280',
  gray: '#6b7280',
};

export function TeammatesBadge({
  org,
  athletes,
  athleteCount,
  onViewAll,
}: TeammatesBadgeProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (athleteCount === 0) {
    return null;
  }

  const accentColor = org === 'IBJJF' ? '#00F0FF' : '#FF2D6A';
  const displayedAthletes = athletes.slice(0, 3);
  const remainingCount = athleteCount - 3;

  const formatName = (fullName: string) => {
    const parts = fullName.split(' ');
    if (parts.length === 1) return fullName;
    return `${parts[0]} ${parts[parts.length - 1][0]}.`;
  };

  const getBeltColor = (belt: string) => {
    const normalizedBelt = belt.toLowerCase();
    return BELT_COLORS[normalizedBelt] || '#6b7280';
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 hover:scale-105"
        style={{
          background: `${accentColor}10`,
          borderColor: accentColor,
          color: accentColor,
          border: `1px solid ${accentColor}40`,
        }}
      >
        <span>👥</span>
        <span>{athleteCount} teammate{athleteCount !== 1 ? 's' : ''}</span>
        <svg
          className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div
          className="mt-2 rounded-lg border overflow-hidden animate-slideDown"
          style={{
            background: 'rgba(0, 0, 0, 0.8)',
            borderColor: 'rgba(255, 255, 255, 0.08)',
          }}
        >
          {displayedAthletes.map((athlete, idx) => (
            <div
              key={idx}
              className="px-3 py-2 flex items-center gap-2 text-sm border-b last:border-b-0"
              style={{ borderColor: 'rgba(255, 255, 255, 0.05)' }}
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: getBeltColor(athlete.belt) }}
              />
              <span className="font-medium">{formatName(athlete.name)}</span>
              <span className="text-white/40">•</span>
              <span className="text-white/60 text-xs">
                {athlete.belt} • {athlete.ageDiv} {athlete.weight}
              </span>
            </div>
          ))}
          {remainingCount > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onViewAll?.();
              }}
              className="w-full px-3 py-2 text-sm text-left hover:bg-white/5 transition-colors"
              style={{ color: accentColor }}
            >
              +{remainingCount} more → View all
            </button>
          )}
        </div>
      )}
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `cd frontend && npm test -- TeammatesBadge`

Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/components/tournaments/TeammatesBadge.tsx frontend/src/__tests__/components/TeammatesBadge.test.tsx
git commit -m "feat(components): add TeammatesBadge with inline expansion"
```

---

### Task 4.3: Integrate TeammatesBadge into TournamentCard

**Files:**
- Modify: `frontend/src/components/tournaments/TournamentCard.tsx`

**Step 1: Add badge to TournamentCard**

Update `frontend/src/components/tournaments/TournamentCard.tsx`:

```typescript
'use client';

import type { Tournament } from '@/lib/types';
import { TeammatesBadge } from './TeammatesBadge';
import type { GymRoster } from '@/lib/api';

interface TournamentCardProps {
  tournament: Tournament;
  index?: number;
  gymRoster?: GymRoster | null;
  onViewRoster?: () => void;
}

export function TournamentCard({ tournament, index, gymRoster, onViewRoster }: TournamentCardProps) {
  // ... existing code ...

  // In the Bottom Section, after event type tags:
  return (
    <div /* existing wrapper */>
      <div className="p-4 sm:p-6 flex flex-col sm:flex-row gap-4 sm:gap-6">
        {/* ... existing date block and content ... */}

        <div className="flex-1 min-w-0 flex flex-col justify-between">
          {/* ... existing top section ... */}

          {/* Bottom Section */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t" style={{ borderColor: 'var(--glass-border)' }}>
            {/* Event type tags */}
            <div className="flex flex-wrap gap-2">
              {tournament.gi && (/* ... */)}
              {tournament.nogi && (/* ... */)}
              {tournament.kids && (/* ... */)}
            </div>

            <div className="flex items-center gap-3">
              {/* Teammates Badge */}
              {gymRoster && gymRoster.athleteCount > 0 && (
                <TeammatesBadge
                  org={tournament.org}
                  athletes={gymRoster.athletes}
                  athleteCount={gymRoster.athleteCount}
                  onViewAll={onViewRoster}
                />
              )}

              {/* View Details Link */}
              {tournament.registrationUrl && (
                <a /* ... existing code ... */>
                  <span>View</span>
                  {/* ... */}
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Build to verify**

Run: `cd frontend && npm run build`

**Step 3: Commit**

```bash
git add frontend/src/components/tournaments/TournamentCard.tsx
git commit -m "feat(TournamentCard): integrate TeammatesBadge"
```

---

## Phase 5: Tournament Detail Page

### Task 5.1: Create tournament detail page route

**Files:**
- Create: `frontend/src/app/tournaments/[org]/[id]/page.tsx`

**Step 1: Create the page**

Create `frontend/src/app/tournaments/[org]/[id]/page.tsx`:

```typescript
'use client';

import { use } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchTournament, type Tournament } from '@/lib/api';
import { TournamentHero } from '@/components/tournaments/TournamentHero';
import { GymRosterSection } from '@/components/tournaments/GymRosterSection';
import { useAthletes } from '@/hooks/useAthletes';
import { useAuthStore } from '@/stores/authStore';
import Link from 'next/link';

interface TournamentDetailPageProps {
  params: Promise<{ org: string; id: string }>;
}

export default function TournamentDetailPage({ params }: TournamentDetailPageProps) {
  const { org, id } = use(params);
  const tournamentId = `TOURN#${org}#${id}`;

  const { isAuthenticated } = useAuthStore();
  const { data: athletesData } = useAthletes();

  // Get user's gym from their first athlete (simplified)
  const userGym = athletesData?.athletes?.[0];
  const gymSourceId = userGym?.gymSourceId ?? null;

  const { data: tournament, isLoading, error } = useQuery({
    queryKey: ['tournament', tournamentId],
    queryFn: () => fetchTournament(tournamentId),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white/60">Loading tournament...</div>
      </div>
    );
  }

  if (error || !tournament) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <div className="text-white/60">Tournament not found</div>
        <Link href="/tournaments" className="text-cyan-400 hover:underline">
          Back to tournaments
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <TournamentHero tournament={tournament} />

      <main className="container mx-auto max-w-4xl px-4 py-8">
        {isAuthenticated && gymSourceId ? (
          <GymRosterSection
            tournament={tournament}
            gymSourceId={gymSourceId}
          />
        ) : (
          <div
            className="rounded-xl border p-6 text-center"
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              borderColor: 'rgba(255, 255, 255, 0.08)',
            }}
          >
            <p className="text-white/60 mb-4">
              {isAuthenticated
                ? 'Add your gym to see which teammates are competing'
                : 'Sign in to see teammates from your gym'}
            </p>
            <Link
              href={isAuthenticated ? '/profile' : '/login'}
              className="inline-flex px-4 py-2 rounded-lg text-sm font-medium bg-white/10 hover:bg-white/20 transition-colors"
            >
              {isAuthenticated ? 'Add Gym' : 'Sign In'}
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
```

**Step 2: Build to verify**

Run: `cd frontend && npm run build`

Expected: Will fail - need to create TournamentHero and GymRosterSection

**Step 3: Commit skeleton**

```bash
git add frontend/src/app/tournaments/\[org\]/\[id\]/page.tsx
git commit -m "feat(pages): add tournament detail page skeleton"
```

---

### Task 5.2: Create TournamentHero component

**Files:**
- Create: `frontend/src/components/tournaments/TournamentHero.tsx`

**Step 1: Create the component**

Create `frontend/src/components/tournaments/TournamentHero.tsx`:

```typescript
'use client';

import type { Tournament } from '@/lib/types';
import Link from 'next/link';

interface TournamentHeroProps {
  tournament: Tournament;
}

export function TournamentHero({ tournament }: TournamentHeroProps) {
  const accentColor = tournament.org === 'IBJJF' ? '#00F0FF' : '#FF2D6A';

  const startDate = new Date(tournament.startDate);
  const month = startDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  const day = startDate.getDate();
  const weekday = startDate.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();

  return (
    <div className="relative">
      {/* Hero Background */}
      <div
        className="h-48 sm:h-64"
        style={{
          background: tournament.bannerUrl
            ? `url(${tournament.bannerUrl}) center/cover`
            : `linear-gradient(135deg, ${accentColor}20 0%, ${accentColor}05 100%)`,
        }}
      />

      {/* Content Overlay */}
      <div className="container mx-auto max-w-4xl px-4">
        <div className="relative -mt-20">
          <Link
            href="/tournaments"
            className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors mb-4"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to tournaments
          </Link>

          <div
            className="rounded-2xl border p-6"
            style={{
              background: 'rgba(0, 0, 0, 0.8)',
              borderColor: 'rgba(255, 255, 255, 0.08)',
              backdropFilter: 'blur(24px)',
            }}
          >
            <div className="flex flex-col sm:flex-row gap-6">
              {/* Date Block */}
              <div
                className="flex-shrink-0 flex flex-col items-center justify-center w-24 h-28 rounded-xl border-l-2"
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  borderLeftColor: accentColor,
                  borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRight: '1px solid rgba(255, 255, 255, 0.08)',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                <div className="text-xs font-medium opacity-60 tracking-wider">{month}</div>
                <div className="text-4xl font-bold leading-none my-1" style={{ color: accentColor }}>
                  {day}
                </div>
                <div className="text-xs font-medium opacity-60 tracking-wider">{weekday}</div>
              </div>

              {/* Details */}
              <div className="flex-1 space-y-4">
                <div className="flex items-start gap-3">
                  <div
                    className="px-3 py-1 rounded-lg text-xs font-bold tracking-wider"
                    style={{
                      background: `${accentColor}15`,
                      color: accentColor,
                      border: `1px solid ${accentColor}40`,
                    }}
                  >
                    {tournament.org}
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-bold">{tournament.name}</h1>
                </div>

                <div className="flex items-center gap-2 text-white/60">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                    />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>
                    {tournament.venue ? `${tournament.venue}, ` : ''}
                    {tournament.city}
                    {tournament.country && `, ${tournament.country}`}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex gap-2">
                    {tournament.gi && (
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        GI
                      </span>
                    )}
                    {tournament.nogi && (
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-orange-500/10 text-orange-400 border border-orange-500/20">
                        NOGI
                      </span>
                    )}
                    {tournament.kids && (
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
                        KIDS
                      </span>
                    )}
                  </div>

                  {tournament.registrationUrl && (
                    <a
                      href={tournament.registrationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-auto px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 hover:scale-105"
                      style={{
                        background: `${accentColor}30`,
                        color: accentColor,
                        border: `1px solid ${accentColor}50`,
                      }}
                    >
                      Register →
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/tournaments/TournamentHero.tsx
git commit -m "feat(components): add TournamentHero component"
```

---

### Task 5.3: Create GymRosterSection component

**Files:**
- Create: `frontend/src/components/tournaments/GymRosterSection.tsx`

**Step 1: Create the component**

Create `frontend/src/components/tournaments/GymRosterSection.tsx`:

```typescript
'use client';

import { useState } from 'react';
import type { Tournament } from '@/lib/types';
import { useGymRoster } from '@/hooks/useGymRoster';
import { useQueryClient } from '@tanstack/react-query';
import { fetchGymRoster } from '@/lib/api';

interface GymRosterSectionProps {
  tournament: Tournament;
  gymSourceId: string;
}

const BELT_COLORS: Record<string, string> = {
  white: '#e5e5e5',
  blue: '#3b82f6',
  purple: '#a855f7',
  brown: '#92400e',
  black: '#1f1f1f',
  yellow: '#fbbf24',
  orange: '#f97316',
  green: '#22c55e',
  grey: '#6b7280',
  gray: '#6b7280',
};

export function GymRosterSection({ tournament, gymSourceId }: GymRosterSectionProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const queryClient = useQueryClient();

  // Parse gymSourceId: "JJWL#5713" -> { org: "JJWL", externalId: "5713" }
  const [gymOrg, gymExternalId] = gymSourceId.split('#') as ['JJWL' | 'IBJJF', string];

  // Only show roster if tournament org matches gym org
  const canShowRoster = tournament.org === gymOrg;

  const { data: roster, isLoading, error } = useGymRoster({
    org: tournament.org,
    gymExternalId: canShowRoster ? gymExternalId : null,
    tournamentId: tournament.externalId,
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Invalidate and refetch
      await queryClient.invalidateQueries({
        queryKey: ['gymRoster', tournament.org, gymExternalId, tournament.externalId],
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const accentColor = tournament.org === 'IBJJF' ? '#00F0FF' : '#FF2D6A';

  // Group athletes by division
  const groupedAthletes = roster?.athletes.reduce(
    (groups, athlete) => {
      const key = `${athlete.ageDiv} ${athlete.gender === 'M' ? 'Male' : 'Female'}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(athlete);
      return groups;
    },
    {} as Record<string, typeof roster.athletes>
  ) ?? {};

  const getBeltColor = (belt: string) => {
    return BELT_COLORS[belt.toLowerCase()] || '#6b7280';
  };

  const formatRelativeTime = (isoDate: string) => {
    const date = new Date(isoDate);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffHours < 1) return 'Just now';
    if (diffHours === 1) return '1 hour ago';
    if (diffHours < 24) return `${diffHours} hours ago`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return '1 day ago';
    return `${diffDays} days ago`;
  };

  if (!canShowRoster) {
    return (
      <div
        className="rounded-xl border p-6"
        style={{
          background: 'rgba(255, 255, 255, 0.03)',
          borderColor: 'rgba(255, 255, 255, 0.08)',
        }}
      >
        <p className="text-white/60">
          Roster not available for this tournament org. Your gym is registered with {gymOrg},
          but this is a {tournament.org} tournament.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div
        className="rounded-xl border p-6"
        style={{
          background: 'rgba(255, 255, 255, 0.03)',
          borderColor: 'rgba(255, 255, 255, 0.08)',
        }}
      >
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-white/10 rounded w-1/3" />
          <div className="h-4 bg-white/10 rounded w-full" />
          <div className="h-4 bg-white/10 rounded w-full" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="rounded-xl border p-6"
        style={{
          background: 'rgba(255, 255, 255, 0.03)',
          borderColor: 'rgba(255, 255, 255, 0.08)',
        }}
      >
        <p className="text-white/60">Roster data not available at the moment.</p>
        <button
          onClick={handleRefresh}
          className="mt-4 px-4 py-2 rounded-lg text-sm font-medium bg-white/10 hover:bg-white/20 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{
        background: 'rgba(255, 255, 255, 0.03)',
        borderColor: 'rgba(255, 255, 255, 0.08)',
      }}
    >
      {/* Header */}
      <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: 'rgba(255, 255, 255, 0.08)' }}>
        <div className="flex items-center gap-3">
          <span className="text-xl">👥</span>
          <div>
            <h2 className="font-semibold" style={{ color: accentColor }}>
              {roster?.gymName ?? 'Your Gym'}
            </h2>
            <p className="text-sm text-white/60">
              {roster?.athleteCount ?? 0} athlete{roster?.athleteCount !== 1 ? 's' : ''} registered
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {roster?.fetchedAt && (
            <span className="text-xs text-white/40">
              Updated {formatRelativeTime(roster.fetchedAt)}
            </span>
          )}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Roster */}
      <div className="px-6 py-4">
        {!roster || roster.athleteCount === 0 ? (
          <p className="text-white/60 text-center py-8">
            No teammates from your gym registered yet
          </p>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedAthletes).map(([division, athletes]) => (
              <div key={division}>
                <h3 className="text-sm font-semibold text-white/40 uppercase tracking-wider mb-3">
                  {division}
                </h3>
                <div className="space-y-2">
                  {athletes.map((athlete, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-3 px-4 py-3 rounded-lg"
                      style={{ background: 'rgba(255, 255, 255, 0.03)' }}
                    >
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ background: getBeltColor(athlete.belt) }}
                      />
                      <span className="font-medium">{athlete.name}</span>
                      <span className="text-white/40">•</span>
                      <span className="text-white/60 text-sm">
                        {athlete.belt} • {athlete.weight}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Build and verify**

Run: `cd frontend && npm run build`

**Step 3: Commit**

```bash
git add frontend/src/components/tournaments/GymRosterSection.tsx
git commit -m "feat(components): add GymRosterSection with grouped roster display"
```

---

## Phase 6: Onboarding Gym Selection

### Task 6.1: Create GymSelectionStep component

**Files:**
- Create: `frontend/src/components/setup/GymSelectionStep.tsx`

**Step 1: Create the component**

Create `frontend/src/components/setup/GymSelectionStep.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { GymSearchAutocomplete } from '@/components/gym/GymSearchAutocomplete';
import type { Gym } from '@/lib/api';

interface GymSelectionStepProps {
  selectedGym: Gym | null;
  onSelect: (gym: Gym | null) => void;
  onSkip: () => void;
  onContinue: () => void;
}

export function GymSelectionStep({
  selectedGym,
  onSelect,
  onSkip,
  onContinue,
}: GymSelectionStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Select Your Gym</h2>
        <p className="text-white/60">
          See which teammates are competing at tournaments
        </p>
      </div>

      <GymSearchAutocomplete
        onSelect={onSelect}
        selectedGym={selectedGym}
        placeholder="Search for your gym..."
      />

      <p className="text-sm text-white/40">
        <span className="inline-block mr-1">ℹ️</span>
        Gym not listed? It must be registered with JJWL or IBJJF to appear here.
      </p>

      <div className="flex items-center justify-between pt-4">
        <button
          onClick={onSkip}
          className="text-white/60 hover:text-white transition-colors text-sm"
        >
          Skip for now
        </button>

        <button
          onClick={onContinue}
          disabled={!selectedGym}
          className="px-6 py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105"
          style={{
            background: selectedGym ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
          }}
        >
          Continue →
        </button>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/setup/GymSelectionStep.tsx
git commit -m "feat(components): add GymSelectionStep for onboarding"
```

---

### Task 6.2: Integrate gym selection into QuickSetupForm

**Files:**
- Modify: `frontend/src/components/setup/QuickSetupForm.tsx`
- Modify: `frontend/src/stores/setupStore.ts`

**Step 1: Add gym fields to setupStore**

Update `frontend/src/stores/setupStore.ts`:

```typescript
import { create } from 'zustand';
import type { Athlete, Gym } from '@/lib/api';

interface SetupState {
  // ... existing fields ...

  // Gym
  selectedGym: Gym | null;
  skippedGym: boolean;

  // Actions
  setSelectedGym: (gym: Gym | null) => void;
  setSkippedGym: (skipped: boolean) => void;
  // ... existing actions ...
}

// Add to initialState:
const initialState = {
  // ... existing ...
  selectedGym: null as Gym | null,
  skippedGym: false,
};

// Add actions:
setSelectedGym: (gym) => set({ selectedGym: gym }),
setSkippedGym: (skipped) => set({ skippedGym: skipped }),
```

**Step 2: Update QuickSetupForm to include gym step**

Add gym selection step to the form flow (between athlete info and location).

**Step 3: Build and test**

Run: `cd frontend && npm run build && npm test`

**Step 4: Commit**

```bash
git add frontend/src/stores/setupStore.ts frontend/src/components/setup/QuickSetupForm.tsx
git commit -m "feat(setup): integrate gym selection into onboarding flow"
```

---

## Phase 7: Profile Gym Settings

### Task 7.1: Add gym section to profile page

**Files:**
- Modify: `frontend/src/app/(protected)/profile/page.tsx`

**Step 1: Add gym settings section**

Add to profile page:

```typescript
// Import GymSearchAutocomplete
import { GymSearchAutocomplete } from '@/components/gym/GymSearchAutocomplete';

// Add gym section in the profile page JSX
<section className="space-y-4">
  <h2 className="text-xl font-semibold">My Gym</h2>
  <p className="text-white/60 text-sm">
    See which teammates are competing at tournaments
  </p>

  {athlete?.gymSourceId ? (
    <div className="flex items-center justify-between p-4 rounded-xl border" style={{ background: 'rgba(255, 255, 255, 0.03)', borderColor: 'rgba(255, 255, 255, 0.08)' }}>
      <div>
        <div className="font-medium">{athlete.gymName}</div>
        <div className="text-sm text-white/60">{athlete.gymSourceId.split('#')[0]}</div>
      </div>
      <button onClick={() => setEditingGym(true)} className="text-cyan-400 hover:underline text-sm">
        Change
      </button>
    </div>
  ) : (
    <GymSearchAutocomplete
      onSelect={handleGymSelect}
      placeholder="Search for your gym..."
    />
  )}
</section>
```

**Step 2: Add handler to update athlete gym**

```typescript
const handleGymSelect = async (gym: Gym) => {
  if (!athlete) return;

  await updateMutation.mutateAsync({
    athleteId: athlete.athleteId,
    input: {
      gymSourceId: `${gym.org}#${gym.externalId}`,
      gymName: gym.name,
    },
  });
};
```

**Step 3: Commit**

```bash
git add frontend/src/app/\(protected\)/profile/page.tsx
git commit -m "feat(profile): add gym settings section"
```

---

## Phase 8: Backend - Daily Roster Sync

### Task 8.1: Create roster sync Lambda handler

**Files:**
- Create: `backend/src/handlers/rosterSync.ts`
- Test: `backend/src/__tests__/handlers/rosterSync.test.ts`

**Step 1: Write the failing test**

Create `backend/src/__tests__/handlers/rosterSync.test.ts`:

```typescript
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { mockContext } from '../utils/testHelpers.js';

jest.mock('../../db/queries.js');
jest.mock('../../db/wishlistQueries.js');
jest.mock('../../db/gymQueries.js');
jest.mock('../../services/gymSyncService.js');

import { handler } from '../../handlers/rosterSync.js';
import * as queries from '../../db/queries.js';
import * as wishlistQueries from '../../db/wishlistQueries.js';
import * as gymQueries from '../../db/gymQueries.js';
import * as gymSyncService from '../../services/gymSyncService.js';

const context = mockContext();

describe('rosterSync handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('syncs rosters for tournaments within 60 days', async () => {
    // Mock upcoming tournaments
    const mockTournaments = [
      { PK: 'TOURN#JJWL#100', org: 'JJWL', externalId: '100', startDate: '2026-02-01' },
    ];
    jest.spyOn(queries, 'getUpcomingTournaments').mockResolvedValue(mockTournaments);

    // Mock users with wishlisted tournaments
    jest.spyOn(wishlistQueries, 'getWishlistsForTournament').mockResolvedValue([
      { userId: 'user1', gymSourceId: 'JJWL#5713' },
    ]);

    jest.spyOn(gymSyncService, 'syncGymRoster').mockResolvedValue({ success: true, athleteCount: 5 });

    const event = { source: 'aws.events' };
    const result = await handler(event as any, context);

    expect(result.statusCode).toBe(200);
    expect(gymSyncService.syncGymRoster).toHaveBeenCalledWith('JJWL', '100', '5713');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd backend && npm test -- rosterSync`

**Step 3: Write minimal implementation**

Create `backend/src/handlers/rosterSync.ts`:

```typescript
import type { ScheduledEvent, Context } from 'aws-lambda';
import { getUpcomingTournaments } from '../db/queries.js';
import { getWishlistsForTournament } from '../db/wishlistQueries.js';
import { syncGymRoster } from '../services/gymSyncService.js';
import { getAthletesWithGym } from '../db/athleteQueries.js';

interface SyncResult {
  tournament: string;
  gym: string;
  success: boolean;
  athleteCount: number;
}

export const handler = async (event: ScheduledEvent, context: Context) => {
  console.log('Starting daily roster sync');

  // Get tournaments within next 60 days
  const daysAhead = 60;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() + daysAhead);

  const tournaments = await getUpcomingTournaments(cutoffDate.toISOString().split('T')[0]);
  console.log(`Found ${tournaments.length} upcoming tournaments`);

  // Collect unique (tournament, gym) pairs to sync
  const syncPairs = new Map<string, { org: 'JJWL' | 'IBJJF'; tournamentId: string; gymExternalId: string }>();

  for (const tournament of tournaments) {
    // Get users who have this tournament wishlisted
    const wishlists = await getWishlistsForTournament(tournament.PK);

    for (const wishlist of wishlists) {
      if (!wishlist.gymSourceId) continue;

      const [gymOrg, gymExternalId] = wishlist.gymSourceId.split('#');

      // Only sync if gym org matches tournament org
      if (gymOrg !== tournament.org) continue;

      const key = `${tournament.PK}#${gymExternalId}`;
      if (!syncPairs.has(key)) {
        syncPairs.set(key, {
          org: tournament.org,
          tournamentId: tournament.externalId,
          gymExternalId,
        });
      }
    }
  }

  console.log(`Syncing ${syncPairs.size} (tournament, gym) pairs`);

  // Sync each pair with rate limiting
  const results: SyncResult[] = [];
  const batchSize = 10;
  const delayMs = 1000;

  const pairs = Array.from(syncPairs.values());
  for (let i = 0; i < pairs.length; i += batchSize) {
    const batch = pairs.slice(i, i + batchSize);

    const batchResults = await Promise.all(
      batch.map(async (pair) => {
        try {
          const result = await syncGymRoster(pair.org, pair.tournamentId, pair.gymExternalId);
          return {
            tournament: `${pair.org}#${pair.tournamentId}`,
            gym: pair.gymExternalId,
            success: result.success,
            athleteCount: result.athleteCount,
          };
        } catch (error) {
          console.error(`Failed to sync ${pair.tournamentId}/${pair.gymExternalId}:`, error);
          return {
            tournament: `${pair.org}#${pair.tournamentId}`,
            gym: pair.gymExternalId,
            success: false,
            athleteCount: 0,
          };
        }
      })
    );

    results.push(...batchResults);

    // Rate limit between batches
    if (i + batchSize < pairs.length) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  const successCount = results.filter((r) => r.success).length;
  console.log(`Roster sync complete: ${successCount}/${results.length} successful`);

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Roster sync complete',
      total: results.length,
      successful: successCount,
    }),
  };
};
```

**Step 4: Run test to verify it passes**

Run: `cd backend && npm test -- rosterSync`

**Step 5: Commit**

```bash
git add backend/src/handlers/rosterSync.ts backend/src/__tests__/handlers/rosterSync.test.ts
git commit -m "feat(handlers): add daily roster sync Lambda"
```

---

### Task 8.2: Add EventBridge rule in SAM template

**Files:**
- Modify: `backend/template.yaml`

**Step 1: Add Lambda and EventBridge rule**

Add to `backend/template.yaml`:

```yaml
  RosterSyncFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: !Sub bjj-tournament-tracker-roster-sync-${Stage}
      Handler: dist/handlers/rosterSync.handler
      CodeUri: .
      Description: Daily sync of gym rosters for upcoming tournaments
      Timeout: 300  # 5 minutes
      Policies:
        - DynamoDBCrudPolicy:
            TableName: !Ref TournamentsTable
      Events:
        DailySchedule:
          Type: Schedule
          Properties:
            Schedule: cron(0 3 * * ? *)  # 3am UTC daily
            Description: Daily roster sync
    Metadata:
      BuildMethod: esbuild
      BuildProperties:
        Format: esm
        Target: es2022
        Sourcemap: true
        EntryPoints:
          - src/handlers/rosterSync.ts
        External:
          - '@aws-sdk/*'
```

**Step 2: Commit**

```bash
git add backend/template.yaml
git commit -m "infra(sam): add roster sync Lambda with daily EventBridge trigger"
```

---

## Phase 9: Integration Testing & Polish

### Task 9.1: Add slide-down animation CSS

**Files:**
- Modify: `frontend/src/app/globals.css`

**Step 1: Add animation**

Add to `frontend/src/app/globals.css`:

```css
@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-slideDown {
  animation: slideDown 0.2s ease-out;
}
```

**Step 2: Commit**

```bash
git add frontend/src/app/globals.css
git commit -m "style: add slideDown animation for teammate expansion"
```

---

### Task 9.2: Run full test suite

**Step 1: Run backend tests**

Run: `cd backend && npm test`

Expected: All tests pass

**Step 2: Run frontend tests**

Run: `cd frontend && npm test`

Expected: All tests pass

**Step 3: Run frontend build**

Run: `cd frontend && npm run build`

Expected: Build succeeds

---

### Task 9.3: Manual E2E testing checklist

1. **Gym Search:**
   - [ ] Search returns results from both JJWL and IBJJF
   - [ ] Results show org badge (cyan/magenta)
   - [ ] Selecting gym updates UI

2. **Tournament Card Badge:**
   - [ ] Badge appears when gym has athletes at tournament
   - [ ] Badge hidden when no athletes
   - [ ] Click expands inline list
   - [ ] First 3 athletes shown with "+N more"
   - [ ] Org-colored styling (IBJJF=cyan, JJWL=magenta)

3. **Tournament Detail Page:**
   - [ ] Hero header displays correctly
   - [ ] Roster section shows grouped athletes
   - [ ] Refresh button triggers API call
   - [ ] "Updated X ago" timestamp shows

4. **Onboarding:**
   - [ ] Gym selection step appears
   - [ ] Skip button works
   - [ ] Selected gym persists to athlete record

5. **Profile:**
   - [ ] Gym displays in profile
   - [ ] Can change gym

---

## Summary

**Total Tasks:** 21 tasks across 9 phases

**Key Dependencies:**
- Master gym matching ticket must complete first
- Existing gym infrastructure provides foundation

**New Files Created:**
- `frontend/src/hooks/useGymSearch.ts`
- `frontend/src/hooks/useGymRoster.ts`
- `frontend/src/components/gym/GymSearchAutocomplete.tsx`
- `frontend/src/components/tournaments/TeammatesBadge.tsx`
- `frontend/src/components/tournaments/TournamentHero.tsx`
- `frontend/src/components/tournaments/GymRosterSection.tsx`
- `frontend/src/components/setup/GymSelectionStep.tsx`
- `frontend/src/app/tournaments/[org]/[id]/page.tsx`
- `backend/src/handlers/rosterSync.ts`

**Modified Files:**
- `backend/src/db/gymQueries.ts` - add cross-org search
- `backend/src/handlers/gyms.ts` - support cross-org search
- `backend/template.yaml` - add roster sync Lambda
- `frontend/src/lib/api.ts` - add gym types and functions
- `frontend/src/stores/setupStore.ts` - add gym fields
- `frontend/src/components/tournaments/TournamentCard.tsx` - add badge
- `frontend/src/components/setup/QuickSetupForm.tsx` - add gym step
- `frontend/src/app/(protected)/profile/page.tsx` - add gym section
- `frontend/src/app/globals.css` - add animation
