# Paid Features Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the complete user flow from free tournament browsing to paid season planning, including authentication, wishlist, athlete management, and the AI-powered season planner.

**Architecture:** Next.js frontend with Zustand for auth state, Cognito for authentication. Backend extends existing Lambda/DynamoDB structure with new endpoints for users, athletes, and wishlist. Season planner uses client-side AI logic initially, with cost estimation based on scraped registration fees and flight API.

**Tech Stack:** Next.js 16, React 19, Zustand, TanStack Query, AWS Cognito, DynamoDB, Lambda, Zod validation

---

## Phase 1: Authentication Foundation

### Task 1.1: Add Cognito SDK to Frontend

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/src/lib/auth.ts`

**Step 1: Install AWS Amplify Auth**

Run: `cd frontend && npm install @aws-amplify/auth aws-amplify`
Expected: Dependencies added to package.json

**Step 2: Create auth configuration**

```typescript
// frontend/src/lib/auth.ts
import { Amplify } from 'aws-amplify';
import { signIn, signUp, signOut, getCurrentUser, fetchAuthSession, confirmSignUp, resendSignUpCode } from '@aws-amplify/auth';

// Configure Amplify - values come from environment
Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || '',
      userPoolClientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || '',
    }
  }
});

export interface AuthUser {
  userId: string;
  email: string;
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const result = await signIn({ username: email, password });
  if (result.isSignedIn) {
    const user = await getCurrentUser();
    return { userId: user.userId, email };
  }
  throw new Error('Sign in failed');
}

export async function register(email: string, password: string): Promise<void> {
  await signUp({
    username: email,
    password,
    options: { userAttributes: { email } }
  });
}

export async function confirmRegistration(email: string, code: string): Promise<void> {
  await confirmSignUp({ username: email, confirmationCode: code });
}

export async function resendConfirmationCode(email: string): Promise<void> {
  await resendSignUpCode({ username: email });
}

export async function logout(): Promise<void> {
  await signOut();
}

export async function getSession(): Promise<{ accessToken: string; userId: string } | null> {
  try {
    const session = await fetchAuthSession();
    const user = await getCurrentUser();
    const accessToken = session.tokens?.accessToken?.toString();
    if (!accessToken) return null;
    return { accessToken, userId: user.userId };
  } catch {
    return null;
  }
}

export async function getAuthenticatedUser(): Promise<AuthUser | null> {
  try {
    const user = await getCurrentUser();
    const session = await fetchAuthSession();
    const email = session.tokens?.idToken?.payload?.email as string;
    return { userId: user.userId, email };
  } catch {
    return null;
  }
}
```

**Step 3: Add environment variables template**

```bash
# Add to frontend/.env.local.example
NEXT_PUBLIC_COGNITO_USER_POOL_ID=us-east-1_XXXXXX
NEXT_PUBLIC_COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Step 4: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/lib/auth.ts
git commit -m "feat: add Cognito auth configuration"
```

---

### Task 1.2: Create Auth Store with Zustand

**Files:**
- Create: `frontend/src/stores/authStore.ts`

**Step 1: Create the auth store**

```typescript
// frontend/src/stores/authStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  login as authLogin,
  logout as authLogout,
  register as authRegister,
  confirmRegistration,
  getAuthenticatedUser,
  getSession,
  type AuthUser
} from '@/lib/auth';

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  // Actions
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  confirmSignUp: (email: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isLoading: true,
      isAuthenticated: false,

      login: async (email: string, password: string) => {
        set({ isLoading: true });
        try {
          const user = await authLogin(email, password);
          set({ user, isAuthenticated: true, isLoading: false });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      register: async (email: string, password: string) => {
        set({ isLoading: true });
        try {
          await authRegister(email, password);
          set({ isLoading: false });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      confirmSignUp: async (email: string, code: string) => {
        set({ isLoading: true });
        try {
          await confirmRegistration(email, code);
          set({ isLoading: false });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      logout: async () => {
        set({ isLoading: true });
        try {
          await authLogout();
          set({ user: null, isAuthenticated: false, isLoading: false });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      checkAuth: async () => {
        set({ isLoading: true });
        try {
          const user = await getAuthenticatedUser();
          set({
            user,
            isAuthenticated: !!user,
            isLoading: false
          });
        } catch {
          set({ user: null, isAuthenticated: false, isLoading: false });
        }
      },

      getAccessToken: async () => {
        const session = await getSession();
        return session?.accessToken || null;
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
);
```

**Step 2: Commit**

```bash
git add frontend/src/stores/authStore.ts
git commit -m "feat: add Zustand auth store"
```

---

### Task 1.3: Create Login Page

**Files:**
- Create: `frontend/src/app/(auth)/login/page.tsx`
- Create: `frontend/src/app/(auth)/layout.tsx`

**Step 1: Create auth layout**

```typescript
// frontend/src/app/(auth)/layout.tsx
import { BeltWeaveBackground } from '@/components/landing/BeltWeaveBackground';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-black relative flex items-center justify-center">
      <BeltWeaveBackground />
      <div className="relative z-10 w-full max-w-md px-4">
        {children}
      </div>
    </div>
  );
}
```

**Step 2: Create login page**

```typescript
// frontend/src/app/(auth)/login/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      await login(email, password);
      router.push('/wishlist');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    }
  };

  return (
    <div
      className="p-8 rounded-2xl border"
      style={{
        background: 'rgba(255, 255, 255, 0.03)',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(24px)',
      }}
    >
      <h1 className="text-2xl font-bold text-center mb-6">Sign In</h1>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2 opacity-80">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 focus:border-[#d4af37] focus:outline-none transition-colors"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2 opacity-80">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 focus:border-[#d4af37] focus:outline-none transition-colors"
            required
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3 rounded-lg font-semibold transition-all duration-300 hover:scale-[1.02]"
          style={{
            background: 'linear-gradient(135deg, #d4af37 0%, #c9a227 100%)',
            color: '#000',
          }}
        >
          {isLoading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm opacity-60">
        Don&apos;t have an account?{' '}
        <Link href="/register" className="text-[#d4af37] hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add frontend/src/app/\(auth\)/
git commit -m "feat: add login page"
```

---

### Task 1.4: Create Registration Page

**Files:**
- Create: `frontend/src/app/(auth)/register/page.tsx`
- Create: `frontend/src/app/(auth)/confirm/page.tsx`

**Step 1: Create registration page**

```typescript
// frontend/src/app/(auth)/register/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';

export default function RegisterPage() {
  const router = useRouter();
  const { register, isLoading } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    try {
      await register(email, password);
      router.push(`/confirm?email=${encodeURIComponent(email)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    }
  };

  return (
    <div
      className="p-8 rounded-2xl border"
      style={{
        background: 'rgba(255, 255, 255, 0.03)',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(24px)',
      }}
    >
      <h1 className="text-2xl font-bold text-center mb-6">Create Account</h1>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2 opacity-80">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 focus:border-[#d4af37] focus:outline-none transition-colors"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2 opacity-80">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 focus:border-[#d4af37] focus:outline-none transition-colors"
            required
            minLength={8}
          />
          <p className="mt-1 text-xs opacity-50">At least 8 characters</p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2 opacity-80">Confirm Password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 focus:border-[#d4af37] focus:outline-none transition-colors"
            required
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3 rounded-lg font-semibold transition-all duration-300 hover:scale-[1.02]"
          style={{
            background: 'linear-gradient(135deg, #d4af37 0%, #c9a227 100%)',
            color: '#000',
          }}
        >
          {isLoading ? 'Creating account...' : 'Create Account'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm opacity-60">
        Already have an account?{' '}
        <Link href="/login" className="text-[#d4af37] hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
```

**Step 2: Create confirmation page**

```typescript
// frontend/src/app/(auth)/confirm/page.tsx
'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { resendConfirmationCode } from '@/lib/auth';

function ConfirmForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || '';
  const { confirmSignUp, isLoading } = useAuthStore();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [resending, setResending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      await confirmSignUp(email, code);
      router.push('/login');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Confirmation failed');
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await resendConfirmationCode(email);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend code');
    }
    setResending(false);
  };

  return (
    <div
      className="p-8 rounded-2xl border"
      style={{
        background: 'rgba(255, 255, 255, 0.03)',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(24px)',
      }}
    >
      <h1 className="text-2xl font-bold text-center mb-2">Verify Email</h1>
      <p className="text-center text-sm opacity-60 mb-6">
        We sent a code to {email}
      </p>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2 opacity-80">Confirmation Code</label>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 focus:border-[#d4af37] focus:outline-none transition-colors text-center text-2xl tracking-widest"
            required
            maxLength={6}
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3 rounded-lg font-semibold transition-all duration-300 hover:scale-[1.02]"
          style={{
            background: 'linear-gradient(135deg, #d4af37 0%, #c9a227 100%)',
            color: '#000',
          }}
        >
          {isLoading ? 'Verifying...' : 'Verify Email'}
        </button>
      </form>

      <button
        onClick={handleResend}
        disabled={resending}
        className="mt-4 w-full text-center text-sm text-[#d4af37] hover:underline disabled:opacity-50"
      >
        {resending ? 'Sending...' : 'Resend code'}
      </button>
    </div>
  );
}

export default function ConfirmPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ConfirmForm />
    </Suspense>
  );
}
```

**Step 3: Commit**

```bash
git add frontend/src/app/\(auth\)/
git commit -m "feat: add registration and confirmation pages"
```

---

### Task 1.5: Update Navigation with Auth State

**Files:**
- Modify: `frontend/src/components/landing/LandingNav.tsx`
- Create: `frontend/src/components/shared/AuthButton.tsx`

**Step 1: Create AuthButton component**

```typescript
// frontend/src/components/shared/AuthButton.tsx
'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';

export function AuthButton() {
  const { user, isAuthenticated, isLoading, logout, checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (isLoading) {
    return (
      <div className="w-20 h-10 rounded-lg bg-white/5 animate-pulse" />
    );
  }

  if (isAuthenticated && user) {
    return (
      <div className="flex items-center gap-4">
        <Link
          href="/wishlist"
          className="text-sm font-medium opacity-80 hover:opacity-100 transition-opacity"
        >
          My Season
        </Link>
        <button
          onClick={() => logout()}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 hover:bg-white/10"
          style={{ border: '1px solid rgba(255, 255, 255, 0.2)' }}
        >
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <Link
      href="/login"
      className="px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 hover:scale-105"
      style={{
        background: 'linear-gradient(135deg, #d4af37 0%, #c9a227 100%)',
        color: '#000',
      }}
    >
      Sign In
    </Link>
  );
}
```

**Step 2: Update LandingNav to use AuthButton**

Read the current LandingNav first, then update it to include the AuthButton.

**Step 3: Commit**

```bash
git add frontend/src/components/shared/AuthButton.tsx frontend/src/components/landing/LandingNav.tsx
git commit -m "feat: add auth button to navigation"
```

---

## Phase 2: Wishlist Feature

### Task 2.1: Create Wishlist Backend Types and Queries

**Files:**
- Modify: `backend/src/db/types.ts` (already has WishlistItem - verify)
- Create: `backend/src/db/wishlistQueries.ts`

**Step 1: Create wishlist query functions**

```typescript
// backend/src/db/wishlistQueries.ts
import { QueryCommand, PutCommand, DeleteCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from './client.js';
import { buildUserPK, buildWishlistSK, type WishlistItem } from './types.js';

export async function getUserWishlist(userId: string): Promise<WishlistItem[]> {
  const command = new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
    ExpressionAttributeValues: {
      ':pk': buildUserPK(userId),
      ':skPrefix': 'WISH#',
    },
  });

  const result = await docClient.send(command);
  return (result.Items || []) as WishlistItem[];
}

export async function addToWishlist(
  userId: string,
  tournamentPK: string
): Promise<WishlistItem> {
  const now = new Date().toISOString();
  const item: WishlistItem = {
    PK: buildUserPK(userId),
    SK: buildWishlistSK(tournamentPK),
    tournamentPK,
    status: 'interested',
    athleteIds: [],
    createdAt: now,
    updatedAt: now,
  };

  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: item,
  }));

  return item;
}

export async function removeFromWishlist(
  userId: string,
  tournamentPK: string
): Promise<void> {
  await docClient.send(new DeleteCommand({
    TableName: TABLE_NAME,
    Key: {
      PK: buildUserPK(userId),
      SK: buildWishlistSK(tournamentPK),
    },
  }));
}

export async function getWishlistItem(
  userId: string,
  tournamentPK: string
): Promise<WishlistItem | null> {
  const result = await docClient.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: {
      PK: buildUserPK(userId),
      SK: buildWishlistSK(tournamentPK),
    },
  }));

  return (result.Item as WishlistItem) || null;
}

export async function updateWishlistItem(
  userId: string,
  tournamentPK: string,
  updates: Partial<Pick<WishlistItem, 'status' | 'athleteIds'>>
): Promise<WishlistItem | null> {
  const existing = await getWishlistItem(userId, tournamentPK);
  if (!existing) return null;

  const updated: WishlistItem = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: updated,
  }));

  return updated;
}
```

**Step 2: Commit**

```bash
git add backend/src/db/wishlistQueries.ts
git commit -m "feat: add wishlist database queries"
```

---

### Task 2.2: Create Wishlist Lambda Handler

**Files:**
- Create: `backend/src/handlers/wishlist.ts`
- Create: `backend/src/handlers/middleware/authMiddleware.ts`

**Step 1: Create auth middleware**

```typescript
// backend/src/handlers/middleware/authMiddleware.ts
import type { APIGatewayProxyEvent } from 'aws-lambda';
import { UnauthorizedError } from '../../shared/errors.js';

export interface AuthContext {
  userId: string;
  email: string;
}

export function extractAuthContext(event: APIGatewayProxyEvent): AuthContext {
  // Cognito authorizer adds claims to requestContext
  const claims = event.requestContext.authorizer?.claims;

  if (!claims || !claims.sub) {
    throw new UnauthorizedError();
  }

  return {
    userId: claims.sub as string,
    email: claims.email as string,
  };
}
```

**Step 2: Create wishlist handler**

```typescript
// backend/src/handlers/wishlist.ts
import type { APIGatewayProxyHandler } from 'aws-lambda';
import { withErrorHandler, jsonResponse } from './middleware/errorHandler.js';
import { extractAuthContext } from './middleware/authMiddleware.js';
import {
  getUserWishlist,
  addToWishlist,
  removeFromWishlist,
  updateWishlistItem
} from '../db/wishlistQueries.js';
import { queryTournamentsByPKs } from '../db/queries.js';
import { ValidationError } from '../shared/errors.js';

const wishlistHandler: APIGatewayProxyHandler = async (event) => {
  const auth = extractAuthContext(event);
  const method = event.httpMethod;
  const tournamentId = event.pathParameters?.tournamentId;

  // GET /wishlist - list all wishlist items with tournament details
  if (method === 'GET' && !tournamentId) {
    const wishlistItems = await getUserWishlist(auth.userId);

    // Fetch tournament details for each wishlist item
    const tournamentPKs = wishlistItems.map(w => w.tournamentPK);
    const tournaments = await queryTournamentsByPKs(tournamentPKs);

    // Combine wishlist items with tournament details
    const result = wishlistItems.map(item => ({
      ...item,
      tournament: tournaments.find(t => t.PK === item.tournamentPK) || null,
    }));

    return jsonResponse(200, { wishlist: result });
  }

  // POST /wishlist - add tournament to wishlist
  if (method === 'POST') {
    const body = JSON.parse(event.body || '{}');
    const { tournamentId: tid } = body;

    if (!tid) {
      throw new ValidationError('tournamentId is required');
    }

    const item = await addToWishlist(auth.userId, tid);
    return jsonResponse(201, item);
  }

  // PUT /wishlist/:tournamentId - update wishlist item
  if (method === 'PUT' && tournamentId) {
    const body = JSON.parse(event.body || '{}');
    const { status, athleteIds } = body;

    const updated = await updateWishlistItem(auth.userId, tournamentId, { status, athleteIds });
    if (!updated) {
      throw new ValidationError('Wishlist item not found');
    }
    return jsonResponse(200, updated);
  }

  // DELETE /wishlist/:tournamentId - remove from wishlist
  if (method === 'DELETE' && tournamentId) {
    await removeFromWishlist(auth.userId, tournamentId);
    return jsonResponse(204, null);
  }

  return jsonResponse(405, { error: 'Method not allowed' });
};

export const handler = withErrorHandler(wishlistHandler);
```

**Step 3: Add helper to queries.ts for fetching tournaments by PKs**

```typescript
// Add to backend/src/db/queries.ts

export async function queryTournamentsByPKs(pks: string[]): Promise<TournamentItem[]> {
  if (pks.length === 0) return [];

  // BatchGet has a limit of 100 items
  const batches: string[][] = [];
  for (let i = 0; i < pks.length; i += 100) {
    batches.push(pks.slice(i, i + 100));
  }

  const results: TournamentItem[] = [];

  for (const batch of batches) {
    const command = new BatchGetCommand({
      RequestItems: {
        [TABLE_NAME]: {
          Keys: batch.map(pk => ({ PK: pk, SK: 'META' })),
        },
      },
    });

    const result = await docClient.send(command);
    const items = result.Responses?.[TABLE_NAME] || [];
    results.push(...(items as TournamentItem[]));
  }

  return results;
}
```

**Step 4: Commit**

```bash
git add backend/src/handlers/wishlist.ts backend/src/handlers/middleware/authMiddleware.ts backend/src/db/queries.ts
git commit -m "feat: add wishlist Lambda handler"
```

---

### Task 2.3: Add Heart Icon to Tournament Card

**Files:**
- Modify: `frontend/src/components/tournaments/TournamentCard.tsx`
- Create: `frontend/src/hooks/useWishlist.ts`
- Modify: `frontend/src/lib/api.ts`

**Step 1: Add wishlist API functions**

```typescript
// Add to frontend/src/lib/api.ts

export interface WishlistItem {
  PK: string;
  SK: string;
  tournamentPK: string;
  status: 'interested' | 'registered' | 'attending';
  athleteIds: string[];
  createdAt: string;
  updatedAt: string;
  tournament?: Tournament;
}

export async function fetchWishlist(accessToken: string): Promise<{ wishlist: WishlistItem[] }> {
  const response = await api.get('/wishlist', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return response.data;
}

export async function addToWishlist(accessToken: string, tournamentId: string): Promise<WishlistItem> {
  const response = await api.post('/wishlist',
    { tournamentId },
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  return response.data;
}

export async function removeFromWishlist(accessToken: string, tournamentId: string): Promise<void> {
  await api.delete(`/wishlist/${encodeURIComponent(tournamentId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}
```

**Step 2: Create useWishlist hook**

```typescript
// frontend/src/hooks/useWishlist.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchWishlist, addToWishlist, removeFromWishlist, type WishlistItem } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

export function useWishlist() {
  const { isAuthenticated, getAccessToken } = useAuthStore();

  return useQuery({
    queryKey: ['wishlist'],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('Not authenticated');
      return fetchWishlist(token);
    },
    enabled: isAuthenticated,
    staleTime: 30 * 1000, // 30 seconds
  });
}

export function useWishlistMutations() {
  const queryClient = useQueryClient();
  const { getAccessToken } = useAuthStore();

  const addMutation = useMutation({
    mutationFn: async (tournamentId: string) => {
      const token = await getAccessToken();
      if (!token) throw new Error('Not authenticated');
      return addToWishlist(token, tournamentId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wishlist'] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (tournamentId: string) => {
      const token = await getAccessToken();
      if (!token) throw new Error('Not authenticated');
      return removeFromWishlist(token, tournamentId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wishlist'] });
    },
  });

  return { addMutation, removeMutation };
}

export function useIsInWishlist(tournamentId: string): boolean {
  const { data } = useWishlist();
  if (!data) return false;
  return data.wishlist.some(item => item.tournamentPK === tournamentId);
}
```

**Step 3: Update TournamentCard with heart icon**

Add heart icon to the top-right of TournamentCard. When clicked:
- If authenticated: toggle wishlist state
- If not authenticated: show login modal/redirect

**Step 4: Commit**

```bash
git add frontend/src/lib/api.ts frontend/src/hooks/useWishlist.ts frontend/src/components/tournaments/TournamentCard.tsx
git commit -m "feat: add heart icon to tournament cards for wishlist"
```

---

### Task 2.4: Create Wishlist Page

**Files:**
- Create: `frontend/src/app/(protected)/wishlist/page.tsx`
- Create: `frontend/src/app/(protected)/layout.tsx`
- Create: `frontend/src/components/wishlist/WishlistCard.tsx`

**Step 1: Create protected layout with auth guard**

```typescript
// frontend/src/app/(protected)/layout.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { LandingNav } from '@/components/landing/LandingNav';

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { isAuthenticated, isLoading, checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#d4af37] border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-black">
      <LandingNav />
      <main className="pt-20">
        {children}
      </main>
    </div>
  );
}
```

**Step 2: Create WishlistCard component**

```typescript
// frontend/src/components/wishlist/WishlistCard.tsx
'use client';

import type { WishlistItem } from '@/lib/api';
import { useWishlistMutations } from '@/hooks/useWishlist';

interface WishlistCardProps {
  item: WishlistItem;
}

export function WishlistCard({ item }: WishlistCardProps) {
  const { removeMutation } = useWishlistMutations();
  const tournament = item.tournament;

  if (!tournament) {
    return null;
  }

  const startDate = new Date(tournament.startDate);
  const formattedDate = startDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const isIBJJF = tournament.org === 'IBJJF';
  const accentColor = isIBJJF ? '#00F0FF' : '#FF2D6A';

  return (
    <div
      className="p-4 rounded-xl border flex items-center justify-between gap-4"
      style={{
        background: 'rgba(255, 255, 255, 0.03)',
        borderColor: 'rgba(255, 255, 255, 0.1)',
      }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span
            className="px-2 py-0.5 rounded text-xs font-bold"
            style={{ background: `${accentColor}20`, color: accentColor }}
          >
            {tournament.org}
          </span>
          <span className="text-sm opacity-60">{formattedDate}</span>
        </div>
        <h3 className="font-semibold truncate">{tournament.name}</h3>
        <p className="text-sm opacity-60 truncate">
          {tournament.city}{tournament.country ? `, ${tournament.country}` : ''}
        </p>
      </div>

      <button
        onClick={() => removeMutation.mutate(item.tournamentPK)}
        disabled={removeMutation.isPending}
        className="p-2 rounded-lg hover:bg-white/10 transition-colors text-red-400"
        title="Remove from wishlist"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  );
}
```

**Step 3: Create wishlist page**

```typescript
// frontend/src/app/(protected)/wishlist/page.tsx
'use client';

import Link from 'next/link';
import { useWishlist } from '@/hooks/useWishlist';
import { WishlistCard } from '@/components/wishlist/WishlistCard';

export default function WishlistPage() {
  const { data, isLoading, error } = useWishlist();

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">My Wishlist</h1>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-white/5 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">My Wishlist</h1>
        <div className="text-red-400">Error loading wishlist</div>
      </div>
    );
  }

  const wishlist = data?.wishlist || [];

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">My Wishlist</h1>

      {wishlist.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-xl opacity-60 mb-4">No tournaments saved yet</p>
          <Link
            href="/tournaments"
            className="inline-flex px-6 py-3 rounded-lg font-semibold transition-all hover:scale-105"
            style={{
              background: 'linear-gradient(135deg, #d4af37 0%, #c9a227 100%)',
              color: '#000',
            }}
          >
            Browse Tournaments
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {wishlist.map((item) => (
            <WishlistCard key={item.SK} item={item} />
          ))}
        </div>
      )}

      {wishlist.length > 0 && (
        <div className="mt-8 p-4 rounded-xl border text-center"
          style={{
            background: 'rgba(212, 175, 55, 0.1)',
            borderColor: 'rgba(212, 175, 55, 0.3)',
          }}
        >
          <p className="mb-3 opacity-80">Ready to plan your season?</p>
          <Link
            href="/profile"
            className="inline-flex px-6 py-3 rounded-lg font-semibold transition-all hover:scale-105"
            style={{
              background: 'linear-gradient(135deg, #d4af37 0%, #c9a227 100%)',
              color: '#000',
            }}
          >
            Add Athletes to Get Started
          </Link>
        </div>
      )}
    </div>
  );
}
```

**Step 4: Commit**

```bash
git add frontend/src/app/\(protected\)/ frontend/src/components/wishlist/
git commit -m "feat: add wishlist page"
```

---

## Phase 3: Athlete Management

### Task 3.1: Create Athletes Backend

**Files:**
- Create: `backend/src/db/athleteQueries.ts`
- Create: `backend/src/handlers/athletes.ts`

**Step 1: Create athlete query functions**

```typescript
// backend/src/db/athleteQueries.ts
import { QueryCommand, PutCommand, DeleteCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { ulid } from 'ulid';
import { docClient, TABLE_NAME } from './client.js';
import { buildUserPK, buildAthleteSK, type AthleteItem } from './types.js';

export interface CreateAthleteInput {
  name: string;
  beltRank?: string;
  birthYear?: number;
  gender?: string;
  weight?: number;
  gymName?: string;
}

export async function getUserAthletes(userId: string): Promise<AthleteItem[]> {
  const command = new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
    ExpressionAttributeValues: {
      ':pk': buildUserPK(userId),
      ':skPrefix': 'ATHLETE#',
    },
  });

  const result = await docClient.send(command);
  return (result.Items || []) as AthleteItem[];
}

export async function createAthlete(
  userId: string,
  input: CreateAthleteInput
): Promise<AthleteItem> {
  const athleteId = ulid();
  const now = new Date().toISOString();

  const item: AthleteItem = {
    PK: buildUserPK(userId),
    SK: buildAthleteSK(athleteId),
    athleteId,
    name: input.name,
    beltRank: input.beltRank || null,
    birthYear: input.birthYear || null,
    weightClass: input.weight ? `${input.weight}lbs` : null,
    createdAt: now,
    updatedAt: now,
  };

  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: item,
  }));

  return item;
}

export async function getAthlete(userId: string, athleteId: string): Promise<AthleteItem | null> {
  const result = await docClient.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: {
      PK: buildUserPK(userId),
      SK: buildAthleteSK(athleteId),
    },
  }));

  return (result.Item as AthleteItem) || null;
}

export async function updateAthlete(
  userId: string,
  athleteId: string,
  input: Partial<CreateAthleteInput>
): Promise<AthleteItem | null> {
  const existing = await getAthlete(userId, athleteId);
  if (!existing) return null;

  const updated: AthleteItem = {
    ...existing,
    name: input.name ?? existing.name,
    beltRank: input.beltRank ?? existing.beltRank,
    birthYear: input.birthYear ?? existing.birthYear,
    weightClass: input.weight ? `${input.weight}lbs` : existing.weightClass,
    updatedAt: new Date().toISOString(),
  };

  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: updated,
  }));

  return updated;
}

export async function deleteAthlete(userId: string, athleteId: string): Promise<void> {
  await docClient.send(new DeleteCommand({
    TableName: TABLE_NAME,
    Key: {
      PK: buildUserPK(userId),
      SK: buildAthleteSK(athleteId),
    },
  }));
}
```

**Step 2: Create athletes handler**

```typescript
// backend/src/handlers/athletes.ts
import type { APIGatewayProxyHandler } from 'aws-lambda';
import { withErrorHandler, jsonResponse } from './middleware/errorHandler.js';
import { extractAuthContext } from './middleware/authMiddleware.js';
import {
  getUserAthletes,
  createAthlete,
  updateAthlete,
  deleteAthlete
} from '../db/athleteQueries.js';
import { ValidationError } from '../shared/errors.js';

const athletesHandler: APIGatewayProxyHandler = async (event) => {
  const auth = extractAuthContext(event);
  const method = event.httpMethod;
  const athleteId = event.pathParameters?.athleteId;

  // GET /athletes - list all athletes
  if (method === 'GET' && !athleteId) {
    const athletes = await getUserAthletes(auth.userId);
    return jsonResponse(200, { athletes });
  }

  // POST /athletes - create athlete
  if (method === 'POST') {
    const body = JSON.parse(event.body || '{}');

    if (!body.name) {
      throw new ValidationError('name is required');
    }

    const athlete = await createAthlete(auth.userId, body);
    return jsonResponse(201, athlete);
  }

  // PUT /athletes/:athleteId - update athlete
  if (method === 'PUT' && athleteId) {
    const body = JSON.parse(event.body || '{}');
    const updated = await updateAthlete(auth.userId, athleteId, body);

    if (!updated) {
      throw new ValidationError('Athlete not found');
    }

    return jsonResponse(200, updated);
  }

  // DELETE /athletes/:athleteId - delete athlete
  if (method === 'DELETE' && athleteId) {
    await deleteAthlete(auth.userId, athleteId);
    return jsonResponse(204, null);
  }

  return jsonResponse(405, { error: 'Method not allowed' });
};

export const handler = withErrorHandler(athletesHandler);
```

**Step 3: Commit**

```bash
git add backend/src/db/athleteQueries.ts backend/src/handlers/athletes.ts
git commit -m "feat: add athletes backend"
```

---

### Task 3.2: Create Profile Page with Athletes

**Files:**
- Create: `frontend/src/app/(protected)/profile/page.tsx`
- Create: `frontend/src/components/profile/AthleteCard.tsx`
- Create: `frontend/src/components/profile/AddAthleteModal.tsx`
- Create: `frontend/src/hooks/useAthletes.ts`
- Modify: `frontend/src/lib/api.ts`

**Step 1: Add athletes API functions**

```typescript
// Add to frontend/src/lib/api.ts

export interface Athlete {
  athleteId: string;
  name: string;
  beltRank: string | null;
  birthYear: number | null;
  weightClass: string | null;
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
}

export async function fetchAthletes(accessToken: string): Promise<{ athletes: Athlete[] }> {
  const response = await api.get('/athletes', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return response.data;
}

export async function createAthlete(accessToken: string, input: CreateAthleteInput): Promise<Athlete> {
  const response = await api.post('/athletes', input, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return response.data;
}

export async function updateAthlete(accessToken: string, athleteId: string, input: Partial<CreateAthleteInput>): Promise<Athlete> {
  const response = await api.put(`/athletes/${athleteId}`, input, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return response.data;
}

export async function deleteAthlete(accessToken: string, athleteId: string): Promise<void> {
  await api.delete(`/athletes/${athleteId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}
```

**Step 2: Create useAthletes hook**

```typescript
// frontend/src/hooks/useAthletes.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchAthletes, createAthlete, updateAthlete, deleteAthlete, type CreateAthleteInput } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

export function useAthletes() {
  const { isAuthenticated, getAccessToken } = useAuthStore();

  return useQuery({
    queryKey: ['athletes'],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('Not authenticated');
      return fetchAthletes(token);
    },
    enabled: isAuthenticated,
  });
}

export function useAthleteMutations() {
  const queryClient = useQueryClient();
  const { getAccessToken } = useAuthStore();

  const createMutation = useMutation({
    mutationFn: async (input: CreateAthleteInput) => {
      const token = await getAccessToken();
      if (!token) throw new Error('Not authenticated');
      return createAthlete(token, input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['athletes'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ athleteId, input }: { athleteId: string; input: Partial<CreateAthleteInput> }) => {
      const token = await getAccessToken();
      if (!token) throw new Error('Not authenticated');
      return updateAthlete(token, athleteId, input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['athletes'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (athleteId: string) => {
      const token = await getAccessToken();
      if (!token) throw new Error('Not authenticated');
      return deleteAthlete(token, athleteId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['athletes'] });
    },
  });

  return { createMutation, updateMutation, deleteMutation };
}
```

**Step 3: Create profile page and components**

(Create AthleteCard, AddAthleteModal, and profile page following the design in the design doc)

**Step 4: Commit**

```bash
git add frontend/src/lib/api.ts frontend/src/hooks/useAthletes.ts frontend/src/app/\(protected\)/profile/ frontend/src/components/profile/
git commit -m "feat: add profile page with athlete management"
```

---

## Phase 4: Season Planner (Paid Feature)

### Task 4.1: Create Planner Store

**Files:**
- Create: `frontend/src/stores/plannerStore.ts`

**Step 1: Create planner store with all configuration options**

```typescript
// frontend/src/stores/plannerStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Tournament } from '@/lib/types';

export interface PlannerConfig {
  totalBudget: number;
  reserveBudget: number;
  homeAirport: string;
  maxDriveHours: number;
  tournamentsPerMonth: number;
  orgPreference: 'balanced' | 'ibjjf' | 'jjwl';
  mustGoTournaments: string[]; // tournament IDs
}

export interface PlannedTournament {
  tournament: Tournament;
  registrationCost: number;
  travelCost: number;
  travelType: 'drive' | 'fly';
  isLocked: boolean;
}

interface PlannerState {
  athleteId: string | null;
  config: PlannerConfig;
  plan: PlannedTournament[];
  isGenerating: boolean;

  // Actions
  setAthleteId: (athleteId: string) => void;
  updateConfig: (updates: Partial<PlannerConfig>) => void;
  addMustGo: (tournamentId: string) => void;
  removeMustGo: (tournamentId: string) => void;
  setPlan: (plan: PlannedTournament[]) => void;
  lockTournament: (tournamentId: string) => void;
  removeTournament: (tournamentId: string) => void;
  setIsGenerating: (isGenerating: boolean) => void;
  reset: () => void;
}

const defaultConfig: PlannerConfig = {
  totalBudget: 3000,
  reserveBudget: 500,
  homeAirport: '',
  maxDriveHours: 4,
  tournamentsPerMonth: 1,
  orgPreference: 'balanced',
  mustGoTournaments: [],
};

export const usePlannerStore = create<PlannerState>()(
  persist(
    (set) => ({
      athleteId: null,
      config: defaultConfig,
      plan: [],
      isGenerating: false,

      setAthleteId: (athleteId) => set({ athleteId }),

      updateConfig: (updates) => set((state) => ({
        config: { ...state.config, ...updates },
      })),

      addMustGo: (tournamentId) => set((state) => ({
        config: {
          ...state.config,
          mustGoTournaments: [...state.config.mustGoTournaments, tournamentId],
        },
      })),

      removeMustGo: (tournamentId) => set((state) => ({
        config: {
          ...state.config,
          mustGoTournaments: state.config.mustGoTournaments.filter(id => id !== tournamentId),
        },
      })),

      setPlan: (plan) => set({ plan }),

      lockTournament: (tournamentId) => set((state) => ({
        plan: state.plan.map(p =>
          p.tournament.id === tournamentId ? { ...p, isLocked: true } : p
        ),
        config: {
          ...state.config,
          mustGoTournaments: state.config.mustGoTournaments.includes(tournamentId)
            ? state.config.mustGoTournaments
            : [...state.config.mustGoTournaments, tournamentId],
        },
      })),

      removeTournament: (tournamentId) => set((state) => ({
        plan: state.plan.filter(p => p.tournament.id !== tournamentId),
      })),

      setIsGenerating: (isGenerating) => set({ isGenerating }),

      reset: () => set({ config: defaultConfig, plan: [], athleteId: null }),
    }),
    {
      name: 'planner-storage',
    }
  )
);
```

**Step 2: Commit**

```bash
git add frontend/src/stores/plannerStore.ts
git commit -m "feat: add planner store for season configuration"
```

---

### Task 4.2: Create Planner Page Layout

**Files:**
- Create: `frontend/src/app/(protected)/planner/[athleteId]/page.tsx`
- Create: `frontend/src/components/planner/PlannerConfig.tsx`
- Create: `frontend/src/components/planner/PlannerResults.tsx`
- Create: `frontend/src/components/planner/PlannedTournamentCard.tsx`

(Implement the split-screen layout from design doc with configuration on left, results on right)

**Step 3: Commit**

```bash
git add frontend/src/app/\(protected\)/planner/ frontend/src/components/planner/
git commit -m "feat: add season planner page layout"
```

---

### Task 4.3: Implement Plan Generation Logic

**Files:**
- Create: `frontend/src/lib/planGenerator.ts`

**Step 1: Create plan generation logic**

```typescript
// frontend/src/lib/planGenerator.ts
import type { Tournament } from '@/lib/types';
import type { PlannerConfig, PlannedTournament } from '@/stores/plannerStore';

// Haversine formula for distance calculation
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Estimate driving time from distance (assuming 60mph average)
function estimateDriveHours(distanceMiles: number): number {
  return distanceMiles / 60;
}

// Estimate costs
function estimateRegistrationCost(tournament: Tournament): number {
  // TODO: Get actual registration costs from scraped data
  // For now, use estimates based on org
  return tournament.org === 'IBJJF' ? 120 : 80;
}

function estimateTravelCost(
  distanceMiles: number,
  travelType: 'drive' | 'fly'
): number {
  if (travelType === 'drive') {
    // IRS mileage rate ~$0.67/mile, round trip
    return Math.round(distanceMiles * 2 * 0.67);
  } else {
    // Rough flight estimate based on distance
    if (distanceMiles < 500) return 200;
    if (distanceMiles < 1000) return 350;
    if (distanceMiles < 2000) return 450;
    return 600;
  }
}

export interface GeneratePlanInput {
  config: PlannerConfig;
  allTournaments: Tournament[];
  homeLocation: { lat: number; lng: number };
}

export function generatePlan(input: GeneratePlanInput): PlannedTournament[] {
  const { config, allTournaments, homeLocation } = input;
  const availableBudget = config.totalBudget - config.reserveBudget;

  // Filter to future tournaments
  const now = new Date();
  const futureTournaments = allTournaments.filter(t => new Date(t.startDate) > now);

  // Calculate costs and travel type for each tournament
  const tournamentsWithCosts = futureTournaments.map(tournament => {
    let distanceMiles = 0;
    if (tournament.lat && tournament.lng) {
      distanceMiles = calculateDistance(
        homeLocation.lat, homeLocation.lng,
        tournament.lat, tournament.lng
      );
    }

    const driveHours = estimateDriveHours(distanceMiles);
    const travelType: 'drive' | 'fly' = driveHours <= config.maxDriveHours ? 'drive' : 'fly';
    const registrationCost = estimateRegistrationCost(tournament);
    const travelCost = estimateTravelCost(distanceMiles, travelType);
    const totalCost = registrationCost + travelCost;

    return {
      tournament,
      registrationCost,
      travelCost,
      travelType,
      totalCost,
      distanceMiles,
      isLocked: config.mustGoTournaments.includes(tournament.id),
    };
  });

  // Start with must-go tournaments
  const plan: PlannedTournament[] = [];
  let remainingBudget = availableBudget;

  // Add must-go tournaments first
  for (const t of tournamentsWithCosts.filter(t => t.isLocked)) {
    plan.push({
      tournament: t.tournament,
      registrationCost: t.registrationCost,
      travelCost: t.travelCost,
      travelType: t.travelType,
      isLocked: true,
    });
    remainingBudget -= t.totalCost;
  }

  // Sort remaining by value (prefer cheaper, closer, preferred org)
  const remaining = tournamentsWithCosts
    .filter(t => !t.isLocked)
    .sort((a, b) => {
      // Apply org preference
      let scoreA = a.totalCost;
      let scoreB = b.totalCost;

      if (config.orgPreference === 'ibjjf') {
        if (a.tournament.org === 'IBJJF') scoreA *= 0.8;
        if (b.tournament.org === 'IBJJF') scoreB *= 0.8;
      } else if (config.orgPreference === 'jjwl') {
        if (a.tournament.org === 'JJWL') scoreA *= 0.8;
        if (b.tournament.org === 'JJWL') scoreB *= 0.8;
      }

      return scoreA - scoreB;
    });

  // Greedily add tournaments within budget and schedule constraints
  const monthCounts: Record<string, number> = {};

  for (const p of plan) {
    const month = p.tournament.startDate.substring(0, 7);
    monthCounts[month] = (monthCounts[month] || 0) + 1;
  }

  for (const t of remaining) {
    if (t.totalCost > remainingBudget) continue;

    const month = t.tournament.startDate.substring(0, 7);
    if ((monthCounts[month] || 0) >= config.tournamentsPerMonth) continue;

    plan.push({
      tournament: t.tournament,
      registrationCost: t.registrationCost,
      travelCost: t.travelCost,
      travelType: t.travelType,
      isLocked: false,
    });

    remainingBudget -= t.totalCost;
    monthCounts[month] = (monthCounts[month] || 0) + 1;
  }

  // Sort by date
  return plan.sort((a, b) =>
    new Date(a.tournament.startDate).getTime() - new Date(b.tournament.startDate).getTime()
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/lib/planGenerator.ts
git commit -m "feat: add AI plan generation logic"
```

---

## Phase 5: Upgrade Flow

### Task 5.1: Create Upgrade Modal

**Files:**
- Create: `frontend/src/components/shared/UpgradeModal.tsx`
- Create: `frontend/src/stores/subscriptionStore.ts`

(Create the upgrade modal from design doc with pricing options)

---

### Task 5.2: Add Paywall Check to Planner

**Files:**
- Modify: `frontend/src/app/(protected)/planner/[athleteId]/page.tsx`

(Add check for subscription status before showing planner, show upgrade modal if not subscribed)

---

## Phase 6: SAM Template Updates

### Task 6.1: Add New Lambda Functions to SAM

**Files:**
- Modify: `backend/template.yaml`

Add:
- WishlistFunction
- AthletesFunction
- API Gateway routes with Cognito authorizer

---

## Checkpoint Summary

| Phase | Description | Tasks |
|-------|-------------|-------|
| 1 | Authentication | 5 tasks |
| 2 | Wishlist | 4 tasks |
| 3 | Athletes | 2 tasks |
| 4 | Season Planner | 3 tasks |
| 5 | Upgrade Flow | 2 tasks |
| 6 | Infrastructure | 1 task |

**Total:** 17 tasks

---

## Future Phases (Not in This Plan)

- **Phase 7:** Live Results (bracket scraping, real-time updates)
- **Phase 8:** Gym Schedule (team calendar, coach view)
- **Phase 9:** Travel Cost API Integration (actual flight prices)
- **Phase 10:** Polish & Performance
