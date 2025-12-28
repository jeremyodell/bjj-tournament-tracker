# Planner-First Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. After each task, use superpowers:requesting-code-review for review.

**Goal:** Transform the user experience from browse-first to planner-first, where users enter athlete info upfront and see relevant tournaments immediately.

**Architecture:** New `/plan` route as entry point with quick setup form. Stores athlete info in local state until login. Free tier shows filtered tournament list, paid tier adds AI optimization. Existing planner components reused where possible.

**Tech Stack:** Next.js 14 (App Router), React, TypeScript, Tailwind CSS, Zustand, Vitest for testing

**Design Doc:** `docs/plans/2025-12-28-planner-first-redesign-design.md`

---

## Phase 1: Core Planner Flow

### Task 1: Set Up Test Infrastructure

**Files:**
- Create: `frontend/src/__tests__/setup.ts`
- Create: `frontend/src/__tests__/utils.tsx`
- Modify: `frontend/vitest.config.ts`

**Step 1: Create test setup file**

Create `frontend/src/__tests__/setup.ts`:
```typescript
import '@testing-library/jest-dom/vitest';
```

**Step 2: Create test utilities**

Create `frontend/src/__tests__/utils.tsx`:
```typescript
import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';

// Add providers as needed
function AllTheProviders({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function customRender(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return render(ui, { wrapper: AllTheProviders, ...options });
}

export * from '@testing-library/react';
export { customRender as render };
```

**Step 3: Update vitest config**

Modify `frontend/vitest.config.ts` to add setup file:
```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
    css: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

**Step 4: Install testing dependencies**

Run: `npm install -D @testing-library/react @testing-library/jest-dom @testing-library/user-event`

**Step 5: Verify test setup works**

Create a smoke test `frontend/src/__tests__/smoke.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';

describe('Test setup', () => {
  it('works', () => {
    expect(true).toBe(true);
  });
});
```

Run: `npm test -- --run`
Expected: PASS

**Step 6: Commit**

```bash
git add -A
git commit -m "test: set up vitest with React Testing Library"
```

---

### Task 2: Create Setup Store for Anonymous Athlete Data

**Files:**
- Create: `frontend/src/stores/setupStore.ts`
- Create: `frontend/src/__tests__/stores/setupStore.test.ts`

**Step 1: Write the failing test**

Create `frontend/src/__tests__/stores/setupStore.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { useSetupStore } from '@/stores/setupStore';

describe('setupStore', () => {
  beforeEach(() => {
    useSetupStore.getState().reset();
  });

  it('initializes with empty state', () => {
    const state = useSetupStore.getState();
    expect(state.athleteName).toBe('');
    expect(state.age).toBeNull();
    expect(state.belt).toBe('');
    expect(state.weight).toBe('');
    expect(state.location).toBe('');
    expect(state.isComplete).toBe(false);
  });

  it('updates athlete info', () => {
    const { setAthleteInfo } = useSetupStore.getState();
    setAthleteInfo({
      athleteName: 'Sofia',
      age: 10,
      belt: 'gray',
      weight: '60',
    });

    const state = useSetupStore.getState();
    expect(state.athleteName).toBe('Sofia');
    expect(state.age).toBe(10);
    expect(state.belt).toBe('gray');
    expect(state.weight).toBe('60');
  });

  it('updates location', () => {
    const { setLocation } = useSetupStore.getState();
    setLocation('Dallas, TX');

    expect(useSetupStore.getState().location).toBe('Dallas, TX');
  });

  it('computes isComplete when all required fields are set', () => {
    const { setAthleteInfo, setLocation } = useSetupStore.getState();

    setLocation('Dallas, TX');
    expect(useSetupStore.getState().isComplete).toBe(false);

    setAthleteInfo({
      athleteName: 'Sofia',
      age: 10,
      belt: 'gray',
      weight: '60',
    });

    expect(useSetupStore.getState().isComplete).toBe(true);
  });

  it('resets to initial state', () => {
    const { setAthleteInfo, setLocation, reset } = useSetupStore.getState();

    setLocation('Dallas, TX');
    setAthleteInfo({ athleteName: 'Sofia', age: 10, belt: 'gray', weight: '60' });
    reset();

    const state = useSetupStore.getState();
    expect(state.athleteName).toBe('');
    expect(state.location).toBe('');
    expect(state.isComplete).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run src/__tests__/stores/setupStore.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Write minimal implementation**

Create `frontend/src/stores/setupStore.ts`:
```typescript
import { create } from 'zustand';

interface AthleteInfo {
  athleteName?: string;
  age?: number | null;
  belt?: string;
  weight?: string;
}

interface SetupState {
  // Athlete info
  athleteName: string;
  age: number | null;
  belt: string;
  weight: string;

  // Location
  location: string;
  lat: number | null;
  lng: number | null;

  // Computed
  isComplete: boolean;

  // Actions
  setAthleteInfo: (info: AthleteInfo) => void;
  setLocation: (location: string, lat?: number, lng?: number) => void;
  reset: () => void;
}

const initialState = {
  athleteName: '',
  age: null,
  belt: '',
  weight: '',
  location: '',
  lat: null,
  lng: null,
  isComplete: false,
};

export const useSetupStore = create<SetupState>((set, get) => ({
  ...initialState,

  setAthleteInfo: (info) => {
    set((state) => {
      const newState = {
        ...state,
        athleteName: info.athleteName ?? state.athleteName,
        age: info.age !== undefined ? info.age : state.age,
        belt: info.belt ?? state.belt,
        weight: info.weight ?? state.weight,
      };
      return {
        ...newState,
        isComplete: isSetupComplete(newState),
      };
    });
  },

  setLocation: (location, lat, lng) => {
    set((state) => {
      const newState = {
        ...state,
        location,
        lat: lat ?? state.lat,
        lng: lng ?? state.lng,
      };
      return {
        ...newState,
        isComplete: isSetupComplete(newState),
      };
    });
  },

  reset: () => set(initialState),
}));

function isSetupComplete(state: Partial<SetupState>): boolean {
  return Boolean(
    state.location &&
    state.athleteName &&
    state.age &&
    state.belt &&
    state.weight
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- --run src/__tests__/stores/setupStore.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: add setupStore for anonymous athlete data"
```

---

### Task 3: Create Quick Setup Form Component

**Files:**
- Create: `frontend/src/components/setup/QuickSetupForm.tsx`
- Create: `frontend/src/__tests__/components/setup/QuickSetupForm.test.tsx`

**Step 1: Write the failing test**

Create `frontend/src/__tests__/components/setup/QuickSetupForm.test.tsx`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '../../utils';
import userEvent from '@testing-library/user-event';
import { QuickSetupForm } from '@/components/setup/QuickSetupForm';
import { useSetupStore } from '@/stores/setupStore';

describe('QuickSetupForm', () => {
  const mockOnComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useSetupStore.getState().reset();
  });

  it('renders all form fields', () => {
    render(<QuickSetupForm onComplete={mockOnComplete} />);

    expect(screen.getByLabelText(/where are you based/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/athlete.*name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/age/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/belt/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/weight/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /show me tournaments/i })).toBeInTheDocument();
  });

  it('submit button is disabled when form is incomplete', () => {
    render(<QuickSetupForm onComplete={mockOnComplete} />);

    const submitButton = screen.getByRole('button', { name: /show me tournaments/i });
    expect(submitButton).toBeDisabled();
  });

  it('enables submit button when all fields are filled', async () => {
    const user = userEvent.setup();
    render(<QuickSetupForm onComplete={mockOnComplete} />);

    await user.type(screen.getByLabelText(/where are you based/i), 'Dallas, TX');
    await user.type(screen.getByLabelText(/athlete.*name/i), 'Sofia');
    await user.selectOptions(screen.getByLabelText(/age/i), '10');
    await user.selectOptions(screen.getByLabelText(/belt/i), 'gray');
    await user.selectOptions(screen.getByLabelText(/weight/i), '60');

    const submitButton = screen.getByRole('button', { name: /show me tournaments/i });
    expect(submitButton).toBeEnabled();
  });

  it('calls onComplete when form is submitted', async () => {
    const user = userEvent.setup();
    render(<QuickSetupForm onComplete={mockOnComplete} />);

    await user.type(screen.getByLabelText(/where are you based/i), 'Dallas, TX');
    await user.type(screen.getByLabelText(/athlete.*name/i), 'Sofia');
    await user.selectOptions(screen.getByLabelText(/age/i), '10');
    await user.selectOptions(screen.getByLabelText(/belt/i), 'gray');
    await user.selectOptions(screen.getByLabelText(/weight/i), '60');

    await user.click(screen.getByRole('button', { name: /show me tournaments/i }));

    expect(mockOnComplete).toHaveBeenCalledTimes(1);
  });

  it('stores data in setupStore', async () => {
    const user = userEvent.setup();
    render(<QuickSetupForm onComplete={mockOnComplete} />);

    await user.type(screen.getByLabelText(/where are you based/i), 'Dallas, TX');
    await user.type(screen.getByLabelText(/athlete.*name/i), 'Sofia');
    await user.selectOptions(screen.getByLabelText(/age/i), '10');
    await user.selectOptions(screen.getByLabelText(/belt/i), 'gray');
    await user.selectOptions(screen.getByLabelText(/weight/i), '60');

    const state = useSetupStore.getState();
    expect(state.location).toBe('Dallas, TX');
    expect(state.athleteName).toBe('Sofia');
    expect(state.age).toBe(10);
    expect(state.belt).toBe('gray');
    expect(state.weight).toBe('60');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run src/__tests__/components/setup/QuickSetupForm.test.tsx`
Expected: FAIL with "Cannot find module"

**Step 3: Write implementation**

Create `frontend/src/components/setup/QuickSetupForm.tsx`:
```typescript
'use client';

import { useSetupStore } from '@/stores/setupStore';

interface QuickSetupFormProps {
  onComplete: () => void;
}

const AGE_OPTIONS = Array.from({ length: 13 }, (_, i) => i + 4); // 4-16
const BELT_OPTIONS = ['white', 'gray', 'yellow', 'orange', 'green', 'blue', 'purple', 'brown', 'black'];
const WEIGHT_OPTIONS = ['40', '45', '50', '55', '60', '65', '70', '75', '80', '85', '90', '95', '100', '110', '120', '130', '140', '150+'];

export function QuickSetupForm({ onComplete }: QuickSetupFormProps) {
  const {
    athleteName,
    age,
    belt,
    weight,
    location,
    isComplete,
    setAthleteInfo,
    setLocation,
  } = useSetupStore();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isComplete) {
      onComplete();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-md mx-auto">
      <h2 className="text-2xl font-bold text-center mb-8">
        Let&apos;s find tournaments for your athlete
      </h2>

      <div>
        <label htmlFor="location" className="block text-sm font-medium mb-2">
          Where are you based?
        </label>
        <input
          type="text"
          id="location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Dallas, TX"
          className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 focus:border-[#d4af37] focus:outline-none"
        />
      </div>

      <div>
        <label htmlFor="athleteName" className="block text-sm font-medium mb-2">
          Athlete&apos;s first name
        </label>
        <input
          type="text"
          id="athleteName"
          value={athleteName}
          onChange={(e) => setAthleteInfo({ athleteName: e.target.value })}
          placeholder="Sofia"
          className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 focus:border-[#d4af37] focus:outline-none"
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label htmlFor="age" className="block text-sm font-medium mb-2">
            Age
          </label>
          <select
            id="age"
            value={age ?? ''}
            onChange={(e) => setAthleteInfo({ age: e.target.value ? parseInt(e.target.value) : null })}
            className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 focus:border-[#d4af37] focus:outline-none"
          >
            <option value="">--</option>
            {AGE_OPTIONS.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="belt" className="block text-sm font-medium mb-2">
            Belt
          </label>
          <select
            id="belt"
            value={belt}
            onChange={(e) => setAthleteInfo({ belt: e.target.value })}
            className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 focus:border-[#d4af37] focus:outline-none capitalize"
          >
            <option value="">--</option>
            {BELT_OPTIONS.map((b) => (
              <option key={b} value={b} className="capitalize">{b}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="weight" className="block text-sm font-medium mb-2">
            Weight (lbs)
          </label>
          <select
            id="weight"
            value={weight}
            onChange={(e) => setAthleteInfo({ weight: e.target.value })}
            className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 focus:border-[#d4af37] focus:outline-none"
          >
            <option value="">--</option>
            {WEIGHT_OPTIONS.map((w) => (
              <option key={w} value={w}>{w}</option>
            ))}
          </select>
        </div>
      </div>

      <button
        type="submit"
        disabled={!isComplete}
        className="w-full py-4 rounded-full font-semibold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 disabled:hover:scale-100"
        style={{
          background: isComplete
            ? 'linear-gradient(135deg, #d4af37 0%, #c9a227 50%, #b8962a 100%)'
            : 'rgba(255,255,255,0.1)',
          color: isComplete ? '#000' : 'rgba(255,255,255,0.5)',
        }}
      >
        Show Me Tournaments
      </button>
    </form>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- --run src/__tests__/components/setup/QuickSetupForm.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: add QuickSetupForm component"
```

---

### Task 4: Create Plan Setup Page

**Files:**
- Create: `frontend/src/app/plan/page.tsx`
- Create: `frontend/src/app/plan/layout.tsx`

**Step 1: Create layout**

Create `frontend/src/app/plan/layout.tsx`:
```typescript
import { LandingNav } from '@/components/landing/LandingNav';

export default function PlanLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-black text-white">
      <LandingNav />
      {children}
    </div>
  );
}
```

**Step 2: Create page**

Create `frontend/src/app/plan/page.tsx`:
```typescript
'use client';

import { useRouter } from 'next/navigation';
import { QuickSetupForm } from '@/components/setup/QuickSetupForm';

export default function PlanSetupPage() {
  const router = useRouter();

  const handleComplete = () => {
    router.push('/plan/results');
  };

  return (
    <main className="container mx-auto px-4 py-16">
      <div className="max-w-lg mx-auto">
        <p className="text-center text-sm opacity-60 mb-12">
          No account required
        </p>
        <QuickSetupForm onComplete={handleComplete} />
      </div>
    </main>
  );
}
```

**Step 3: Verify build passes**

Run: `npm run build`
Expected: Build succeeds with new `/plan` route

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: add /plan setup page"
```

---

### Task 5: Create Free Planner Results View

**Files:**
- Create: `frontend/src/app/plan/results/page.tsx`
- Create: `frontend/src/components/plan/FreePlannerView.tsx`
- Create: `frontend/src/components/plan/PlannerHeader.tsx`
- Create: `frontend/src/__tests__/components/plan/FreePlannerView.test.tsx`

**Step 1: Write the failing test**

Create `frontend/src/__tests__/components/plan/FreePlannerView.test.tsx`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '../../utils';
import { FreePlannerView } from '@/components/plan/FreePlannerView';
import { useSetupStore } from '@/stores/setupStore';

// Mock the tournaments hook
vi.mock('@/hooks/useTournaments', () => ({
  useTournaments: () => ({
    data: {
      tournaments: [
        {
          id: '1',
          name: 'Pan Kids',
          city: 'Kissimmee, FL',
          startDate: '2025-02-15',
          endDate: '2025-02-16',
          org: 'IBJJF',
          kids: true,
        },
        {
          id: '2',
          name: 'Dallas Open',
          city: 'Dallas, TX',
          startDate: '2025-03-08',
          endDate: '2025-03-08',
          org: 'IBJJF',
          kids: true,
        },
      ],
    },
    isLoading: false,
    error: null,
  }),
}));

describe('FreePlannerView', () => {
  beforeEach(() => {
    useSetupStore.getState().reset();
    useSetupStore.getState().setAthleteInfo({
      athleteName: 'Sofia',
      age: 10,
      belt: 'gray',
      weight: '60',
    });
    useSetupStore.getState().setLocation('Dallas, TX');
  });

  it('displays athlete name in header', () => {
    render(<FreePlannerView />);
    expect(screen.getByText(/Sofia.*2025 Season/i)).toBeInTheDocument();
  });

  it('displays athlete info', () => {
    render(<FreePlannerView />);
    expect(screen.getByText(/Gray Belt/i)).toBeInTheDocument();
    expect(screen.getByText(/60/)).toBeInTheDocument();
    expect(screen.getByText(/Age 10/i)).toBeInTheDocument();
  });

  it('displays tournament count', () => {
    render(<FreePlannerView />);
    expect(screen.getByText(/2 tournaments/i)).toBeInTheDocument();
  });

  it('displays tournament list', () => {
    render(<FreePlannerView />);
    expect(screen.getByText('Pan Kids')).toBeInTheDocument();
    expect(screen.getByText('Dallas Open')).toBeInTheDocument();
  });

  it('shows upgrade nudge', () => {
    render(<FreePlannerView />);
    expect(screen.getByText(/overwhelmed/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try it/i })).toBeInTheDocument();
  });

  it('shows save button', () => {
    render(<FreePlannerView />);
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run src/__tests__/components/plan/FreePlannerView.test.tsx`
Expected: FAIL with "Cannot find module"

**Step 3: Create PlannerHeader component**

Create `frontend/src/components/plan/PlannerHeader.tsx`:
```typescript
'use client';

import { useSetupStore } from '@/stores/setupStore';

interface PlannerHeaderProps {
  onSave: () => void;
  onEdit: () => void;
}

export function PlannerHeader({ onSave, onEdit }: PlannerHeaderProps) {
  const { athleteName, age, belt, weight, location } = useSetupStore();

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">
          {athleteName}&apos;s 2025 Season
        </h1>
        <p className="text-sm opacity-60 mt-1">
          <span className="capitalize">{belt} Belt</span>
          {' • '}
          {weight} lbs
          {' • '}
          Age {age}
        </p>
        <p className="text-sm opacity-60">
          Based near {location}
          <button
            onClick={onEdit}
            className="ml-2 text-[#d4af37] hover:underline"
          >
            Edit
          </button>
        </p>
      </div>
      <button
        onClick={onSave}
        className="px-6 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors flex items-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
        </svg>
        Save
      </button>
    </div>
  );
}
```

**Step 4: Create FreePlannerView component**

Create `frontend/src/components/plan/FreePlannerView.tsx`:
```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTournaments } from '@/hooks/useTournaments';
import { useSetupStore } from '@/stores/setupStore';
import { PlannerHeader } from './PlannerHeader';
import { TournamentCard } from '@/components/tournaments/TournamentCard';
import { TournamentCardSkeleton } from '@/components/tournaments/TournamentCardSkeleton';

type FilterTab = 'all' | 'nearby' | 'ibjjf' | 'jjwl';

export function FreePlannerView() {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const { athleteName } = useSetupStore();

  // Fetch kids tournaments
  const { data, isLoading, error } = useTournaments({ kids: true });
  const tournaments = data?.tournaments || [];

  // Filter tournaments based on active tab
  const filteredTournaments = tournaments.filter((t) => {
    if (activeFilter === 'ibjjf') return t.org === 'IBJJF';
    if (activeFilter === 'jjwl') return t.org === 'JJWL';
    // TODO: nearby filter needs distance calculation
    return true;
  });

  const handleSave = () => {
    // Trigger login flow
    router.push('/login?redirect=/plan/results');
  };

  const handleEdit = () => {
    router.push('/plan');
  };

  const handleUpgrade = () => {
    router.push('/login?redirect=/plan/results&upgrade=true');
  };

  const filterTabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'nearby', label: 'Nearby < 4hrs' },
    { key: 'ibjjf', label: 'IBJJF' },
    { key: 'jjwl', label: 'JJWL' },
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <PlannerHeader onSave={handleSave} onEdit={handleEdit} />

      {/* Tournament count and filters */}
      <div className="mb-6">
        <p className="text-lg mb-4">
          <span className="font-semibold">{filteredTournaments.length} tournaments</span>
          {' '}match {athleteName}&apos;s division
        </p>

        <div className="flex flex-wrap gap-2">
          {filterTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveFilter(tab.key)}
              className={`px-4 py-2 rounded-full text-sm transition-colors ${
                activeFilter === tab.key
                  ? 'bg-[#d4af37] text-black'
                  : 'bg-white/10 hover:bg-white/20'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tournament list */}
      <div className="space-y-4 mb-8">
        {isLoading ? (
          <>
            <TournamentCardSkeleton />
            <TournamentCardSkeleton />
            <TournamentCardSkeleton />
          </>
        ) : error ? (
          <div className="text-red-400 text-center py-8">
            Error loading tournaments
          </div>
        ) : filteredTournaments.length === 0 ? (
          <div className="text-center py-8 opacity-60">
            No tournaments found
          </div>
        ) : (
          filteredTournaments.map((tournament) => (
            <TournamentCard
              key={tournament.id}
              tournament={tournament}
              showHeart={true}
            />
          ))
        )}
      </div>

      {/* Upgrade nudge */}
      <div
        className="p-4 rounded-xl border text-center"
        style={{
          background: 'rgba(212, 175, 55, 0.1)',
          borderColor: 'rgba(212, 175, 55, 0.3)',
        }}
      >
        <p className="mb-3">
          <span className="opacity-80">Overwhelmed?</span>
          {' '}
          Set your budget and let us pick the best tournaments for {athleteName}.
        </p>
        <button
          onClick={handleUpgrade}
          className="px-8 py-3 rounded-full font-semibold transition-all duration-300 hover:scale-105"
          style={{
            background: 'linear-gradient(135deg, #d4af37 0%, #c9a227 50%, #b8962a 100%)',
            color: '#000',
          }}
        >
          Try It
        </button>
      </div>
    </div>
  );
}
```

**Step 5: Create results page**

Create `frontend/src/app/plan/results/page.tsx`:
```typescript
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSetupStore } from '@/stores/setupStore';
import { FreePlannerView } from '@/components/plan/FreePlannerView';

export default function PlanResultsPage() {
  const router = useRouter();
  const { isComplete } = useSetupStore();

  // Redirect to setup if not complete
  useEffect(() => {
    if (!isComplete) {
      router.replace('/plan');
    }
  }, [isComplete, router]);

  if (!isComplete) {
    return null;
  }

  return <FreePlannerView />;
}
```

**Step 6: Run test to verify it passes**

Run: `npm test -- --run src/__tests__/components/plan/FreePlannerView.test.tsx`
Expected: PASS

**Step 7: Verify build passes**

Run: `npm run build`
Expected: Build succeeds

**Step 8: Commit**

```bash
git add -A
git commit -m "feat: add free planner view with tournament list"
```

---

### Task 6: Update Landing Page Hero CTA

**Files:**
- Modify: `frontend/src/components/landing/LandingHero.tsx`
- Create: `frontend/src/__tests__/components/landing/LandingHero.test.tsx`

**Step 1: Read current LandingHero**

Read `frontend/src/components/landing/LandingHero.tsx` to understand current structure.

**Step 2: Write the failing test**

Create `frontend/src/__tests__/components/landing/LandingHero.test.tsx`:
```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '../../utils';
import { LandingHero } from '@/components/landing/LandingHero';

describe('LandingHero', () => {
  it('displays planner-first headline', () => {
    render(<LandingHero />);
    expect(screen.getByText(/plan your.*tournament season/i)).toBeInTheDocument();
  });

  it('has primary CTA linking to /plan', () => {
    render(<LandingHero />);
    const cta = screen.getByRole('link', { name: /start planning/i });
    expect(cta).toHaveAttribute('href', '/plan');
  });

  it('shows no account required message', () => {
    render(<LandingHero />);
    expect(screen.getByText(/no account required/i)).toBeInTheDocument();
  });

  it('has secondary CTA for browsing tournaments', () => {
    render(<LandingHero />);
    const link = screen.getByRole('link', { name: /browse tournaments/i });
    expect(link).toHaveAttribute('href', '/tournaments');
  });
});
```

**Step 3: Run test to verify it fails**

Run: `npm test -- --run src/__tests__/components/landing/LandingHero.test.tsx`
Expected: FAIL (current hero doesn't match new copy)

**Step 4: Update LandingHero component**

Update the hero content to:
- Headline: "Plan Your Kid's Tournament Season in 60 Seconds"
- Subheadline: "See every IBJJF & JJWL tournament that fits your athlete's division — no more spreadsheets."
- Primary CTA: "Start Planning" → `/plan`
- Secondary link: "or Browse Tournaments" → `/tournaments`
- Add "No account required" below CTA

**Step 5: Run test to verify it passes**

Run: `npm test -- --run src/__tests__/components/landing/LandingHero.test.tsx`
Expected: PASS

**Step 6: Verify build passes**

Run: `npm run build`
Expected: Build succeeds

**Step 7: Commit**

```bash
git add -A
git commit -m "feat: update landing hero with planner-first messaging"
```

---

### Task 7: Add Heart/Favorite Functionality to Tournament Cards

**Files:**
- Modify: `frontend/src/components/tournaments/TournamentCard.tsx`
- Create: `frontend/src/stores/favoritesStore.ts`
- Create: `frontend/src/__tests__/stores/favoritesStore.test.ts`

**Step 1: Write the failing test for favorites store**

Create `frontend/src/__tests__/stores/favoritesStore.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { useFavoritesStore } from '@/stores/favoritesStore';

describe('favoritesStore', () => {
  beforeEach(() => {
    useFavoritesStore.getState().clear();
  });

  it('initializes with empty favorites', () => {
    const { favorites } = useFavoritesStore.getState();
    expect(favorites).toEqual([]);
  });

  it('adds a favorite', () => {
    const { addFavorite } = useFavoritesStore.getState();
    addFavorite('tournament-1');

    const { favorites } = useFavoritesStore.getState();
    expect(favorites).toContain('tournament-1');
  });

  it('removes a favorite', () => {
    const { addFavorite, removeFavorite } = useFavoritesStore.getState();
    addFavorite('tournament-1');
    removeFavorite('tournament-1');

    const { favorites } = useFavoritesStore.getState();
    expect(favorites).not.toContain('tournament-1');
  });

  it('toggles a favorite', () => {
    const { toggleFavorite, favorites } = useFavoritesStore.getState();

    toggleFavorite('tournament-1');
    expect(useFavoritesStore.getState().favorites).toContain('tournament-1');

    toggleFavorite('tournament-1');
    expect(useFavoritesStore.getState().favorites).not.toContain('tournament-1');
  });

  it('checks if tournament is favorited', () => {
    const { addFavorite, isFavorite } = useFavoritesStore.getState();
    addFavorite('tournament-1');

    expect(isFavorite('tournament-1')).toBe(true);
    expect(isFavorite('tournament-2')).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run src/__tests__/stores/favoritesStore.test.ts`
Expected: FAIL

**Step 3: Create favorites store**

Create `frontend/src/stores/favoritesStore.ts`:
```typescript
import { create } from 'zustand';

interface FavoritesState {
  favorites: string[];
  addFavorite: (tournamentId: string) => void;
  removeFavorite: (tournamentId: string) => void;
  toggleFavorite: (tournamentId: string) => void;
  isFavorite: (tournamentId: string) => boolean;
  clear: () => void;
}

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  favorites: [],

  addFavorite: (tournamentId) => {
    set((state) => ({
      favorites: state.favorites.includes(tournamentId)
        ? state.favorites
        : [...state.favorites, tournamentId],
    }));
  },

  removeFavorite: (tournamentId) => {
    set((state) => ({
      favorites: state.favorites.filter((id) => id !== tournamentId),
    }));
  },

  toggleFavorite: (tournamentId) => {
    const { favorites, addFavorite, removeFavorite } = get();
    if (favorites.includes(tournamentId)) {
      removeFavorite(tournamentId);
    } else {
      addFavorite(tournamentId);
    }
  },

  isFavorite: (tournamentId) => {
    return get().favorites.includes(tournamentId);
  },

  clear: () => set({ favorites: [] }),
}));
```

**Step 4: Run test to verify it passes**

Run: `npm test -- --run src/__tests__/stores/favoritesStore.test.ts`
Expected: PASS

**Step 5: Update TournamentCard with heart button**

Read current TournamentCard, then add:
- `showHeart` prop (optional, default false)
- Heart icon button that toggles favorite state
- Visual feedback (filled/empty heart)

**Step 6: Verify build passes**

Run: `npm run build`
Expected: Build succeeds

**Step 7: Commit**

```bash
git add -A
git commit -m "feat: add favorites store and heart button to tournament cards"
```

---

### Task 8: Create Login Modal for Save Action

**Files:**
- Create: `frontend/src/components/auth/LoginModal.tsx`
- Create: `frontend/src/__tests__/components/auth/LoginModal.test.tsx`

**Step 1: Write the failing test**

Create `frontend/src/__tests__/components/auth/LoginModal.test.tsx`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '../../utils';
import userEvent from '@testing-library/user-event';
import { LoginModal } from '@/components/auth/LoginModal';

describe('LoginModal', () => {
  const mockOnClose = vi.fn();

  it('renders when open', () => {
    render(<LoginModal isOpen={true} onClose={mockOnClose} context="save" />);
    expect(screen.getByText(/save.*season/i)).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(<LoginModal isOpen={false} onClose={mockOnClose} context="save" />);
    expect(screen.queryByText(/save.*season/i)).not.toBeInTheDocument();
  });

  it('shows Google login button', () => {
    render(<LoginModal isOpen={true} onClose={mockOnClose} context="save" />);
    expect(screen.getByRole('button', { name: /google/i })).toBeInTheDocument();
  });

  it('shows Email login button', () => {
    render(<LoginModal isOpen={true} onClose={mockOnClose} context="save" />);
    expect(screen.getByRole('button', { name: /email/i })).toBeInTheDocument();
  });

  it('shows sign in link for existing users', () => {
    render(<LoginModal isOpen={true} onClose={mockOnClose} context="save" />);
    expect(screen.getByText(/already have an account/i)).toBeInTheDocument();
  });

  it('calls onClose when backdrop is clicked', async () => {
    const user = userEvent.setup();
    render(<LoginModal isOpen={true} onClose={mockOnClose} context="save" />);

    // Click the backdrop (the overlay div)
    const backdrop = screen.getByTestId('modal-backdrop');
    await user.click(backdrop);

    expect(mockOnClose).toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run src/__tests__/components/auth/LoginModal.test.tsx`
Expected: FAIL

**Step 3: Create LoginModal component**

Create `frontend/src/components/auth/LoginModal.tsx`:
```typescript
'use client';

import { useSetupStore } from '@/stores/setupStore';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  context: 'save' | 'favorite' | 'upgrade';
}

export function LoginModal({ isOpen, onClose, context }: LoginModalProps) {
  const { athleteName } = useSetupStore();

  if (!isOpen) return null;

  const getTitle = () => {
    switch (context) {
      case 'save':
        return `Save ${athleteName}'s Season`;
      case 'favorite':
        return 'Save this tournament';
      case 'upgrade':
        return `Unlock ${athleteName}'s Optimized Season`;
    }
  };

  const getSubtitle = () => {
    switch (context) {
      case 'save':
      case 'favorite':
        return "Create a free account to save your plan and favorites. We'll remind you when registration opens.";
      case 'upgrade':
        return 'Get AI-powered tournament recommendations based on your budget and location.';
    }
  };

  const handleGoogleLogin = () => {
    // TODO: Implement Google OAuth
    window.location.href = '/api/auth/google';
  };

  const handleEmailLogin = () => {
    // TODO: Redirect to email login/signup
    window.location.href = '/register';
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      data-testid="modal-backdrop"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative bg-zinc-900 rounded-2xl p-8 max-w-md w-full border border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-2xl font-bold mb-2">{getTitle()}</h2>
        <p className="text-sm opacity-60 mb-8">{getSubtitle()}</p>

        <div className="space-y-3">
          <button
            onClick={handleGoogleLogin}
            className="w-full py-3 px-4 rounded-lg bg-white text-black font-medium flex items-center justify-center gap-3 hover:bg-gray-100 transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          <button
            onClick={handleEmailLogin}
            className="w-full py-3 px-4 rounded-lg bg-white/10 font-medium flex items-center justify-center gap-3 hover:bg-white/20 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Continue with Email
          </button>
        </div>

        <div className="mt-6 text-center text-sm opacity-60">
          Already have an account?{' '}
          <a href="/login" className="text-[#d4af37] hover:underline">
            Sign in
          </a>
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-lg hover:bg-white/10 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- --run src/__tests__/components/auth/LoginModal.test.tsx`
Expected: PASS

**Step 5: Verify build passes**

Run: `npm run build`
Expected: Build succeeds

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: add LoginModal for save/favorite actions"
```

---

### Task 9: Wire Up Login Modal to Free Planner

**Files:**
- Modify: `frontend/src/components/plan/FreePlannerView.tsx`
- Modify: `frontend/src/app/plan/results/page.tsx`

**Step 1: Update FreePlannerView to use LoginModal**

Add state for modal visibility and context:
```typescript
const [loginModalOpen, setLoginModalOpen] = useState(false);
const [loginContext, setLoginContext] = useState<'save' | 'favorite' | 'upgrade'>('save');

const handleSave = () => {
  setLoginContext('save');
  setLoginModalOpen(true);
};

const handleUpgrade = () => {
  setLoginContext('upgrade');
  setLoginModalOpen(true);
};

const handleFavorite = (tournamentId: string) => {
  setLoginContext('favorite');
  setLoginModalOpen(true);
};
```

Add LoginModal component at end of JSX:
```typescript
<LoginModal
  isOpen={loginModalOpen}
  onClose={() => setLoginModalOpen(false)}
  context={loginContext}
/>
```

**Step 2: Verify build passes**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: wire up LoginModal to FreePlannerView"
```

---

### Task 10: Update Navigation Header

**Files:**
- Modify: `frontend/src/components/layout/AppHeader.tsx`
- Modify: `frontend/src/components/landing/LandingNav.tsx`

**Step 1: Read current components**

Read both files to understand current structure.

**Step 2: Update LandingNav**

Add "My Season" link that goes to `/plan`:
- For logged-out users: links to `/plan`
- For logged-in users: links to `/plan/results` (or `/planner/[athleteId]` if they have athletes)

**Step 3: Update AppHeader**

Add dropdown for "My Season" showing:
- List of athletes with links to their planners
- "+ Add Athlete" option
- "Account Settings" link

**Step 4: Verify build passes**

Run: `npm run build`
Expected: Build succeeds

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: update navigation with My Season dropdown"
```

---

## End of Phase 1

After completing all tasks:

1. Run full test suite: `npm test -- --run`
2. Run build: `npm run build`
3. Manual smoke test the flow:
   - Visit `/` → Click "Start Planning"
   - Fill out form → Submit
   - See tournament list
   - Click heart → See login modal
   - Click "Save" → See login modal
   - Click "Try It" (upgrade) → See login modal

If all tests pass and smoke test works, Phase 1 is complete.

---

## Next Phases (Future Plans)

**Phase 2: AI & Optimization**
- Budget configuration
- Travel cost estimation
- AI schedule generation
- Swap/regenerate functionality

**Phase 3: Multi-Athlete**
- Add additional athletes (up to 4)
- Family calendar view
- Shared trip detection

**Phase 4: Notifications**
- Registration reminder emails
- In-app notification center
- Tournament status tracking
