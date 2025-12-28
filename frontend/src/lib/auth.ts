import { Amplify } from 'aws-amplify';
import { signIn, signUp, signOut, getCurrentUser, fetchAuthSession, confirmSignUp, resendSignUpCode, signInWithRedirect } from '@aws-amplify/auth';

// Helper to add timeout to async operations
function withTimeout<T>(promise: Promise<T>, ms: number, errorMessage: string): Promise<T> {
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(errorMessage)), ms);
  });
  return Promise.race([promise, timeout]);
}

const AUTH_TIMEOUT = 10000; // 10 seconds

// Dev mode - bypasses Cognito for local testing
const IS_DEV_MODE = process.env.NEXT_PUBLIC_DEV_MODE === 'true';

// Dev mode storage key
const DEV_USER_KEY = 'dev-auth-user';

// Configure Amplify - values come from environment (skip in dev mode)
const userPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID;
const userPoolClientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;
const cognitoDomain = process.env.NEXT_PUBLIC_COGNITO_DOMAIN;

// Only configure on client side
if (typeof window !== 'undefined') {
  // Debug: Log config status
  console.log('[Auth Config]', {
    IS_DEV_MODE,
    hasUserPoolId: !!userPoolId,
    hasClientId: !!userPoolClientId,
    hasCognitoDomain: !!cognitoDomain,
    userPoolId: userPoolId ? userPoolId.substring(0, 10) + '...' : 'NOT SET',
  });

  if (!IS_DEV_MODE && userPoolId && userPoolClientId) {
    const redirectUrl = window.location.origin;

    Amplify.configure({
      Auth: {
        Cognito: {
          userPoolId,
          userPoolClientId,
          loginWith: cognitoDomain ? {
            oauth: {
              domain: cognitoDomain,
              scopes: ['email', 'openid', 'profile'],
              redirectSignIn: [redirectUrl],
              redirectSignOut: [redirectUrl],
              responseType: 'code',
              providers: ['Google'],
            }
          } : undefined,
        }
      }
    });
  } else if (!IS_DEV_MODE) {
    console.error('[Auth] Cognito not configured - missing environment variables');
  }
}

export interface AuthUser {
  userId: string;
  email: string;
}

// Dev mode helpers
function getDevUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(DEV_USER_KEY);
  return stored ? JSON.parse(stored) : null;
}

function setDevUser(user: AuthUser | null): void {
  if (typeof window === 'undefined') return;
  if (user) {
    localStorage.setItem(DEV_USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(DEV_USER_KEY);
  }
}

// Key for storing the return path after OAuth
const OAUTH_RETURN_PATH_KEY = 'oauth-return-path';

export function saveReturnPath(): void {
  if (typeof window === 'undefined') return;
  const path = window.location.pathname + window.location.search;
  // Don't save auth-related pages as return paths
  if (!path.startsWith('/login') && !path.startsWith('/register')) {
    sessionStorage.setItem(OAUTH_RETURN_PATH_KEY, path);
    console.log('[Auth] Saved return path:', path);
  }
}

export function getAndClearReturnPath(): string | null {
  if (typeof window === 'undefined') return null;
  const path = sessionStorage.getItem(OAUTH_RETURN_PATH_KEY);
  if (path) {
    sessionStorage.removeItem(OAUTH_RETURN_PATH_KEY);
    console.log('[Auth] Retrieved return path:', path);
  }
  return path;
}

export async function signInWithGoogle(): Promise<void> {
  if (IS_DEV_MODE) {
    console.log('[DEV MODE] Google sign-in not available in dev mode');
    return;
  }

  // Check if user is already authenticated
  try {
    const session = await fetchAuthSession();
    if (session.tokens?.idToken) {
      console.log('[Auth] signInWithGoogle: User already authenticated, skipping redirect');
      return;
    }
  } catch {
    // Not authenticated, continue with sign-in
  }

  // Save current path for redirect after OAuth
  saveReturnPath();

  console.log('[Auth] signInWithGoogle: starting Google OAuth...');
  await signInWithRedirect({ provider: 'Google' });
}

export async function login(email: string, password: string): Promise<AuthUser> {
  if (IS_DEV_MODE) {
    // Dev mode: accept any email/password, create mock user
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay
    const user: AuthUser = { userId: `dev-${Date.now()}`, email };
    setDevUser(user);
    console.log('[DEV MODE] Logged in as:', email);
    return user;
  }

  console.log('[Auth] login: starting sign in...');
  const result = await signIn({ username: email, password });
  console.log('[Auth] login: sign in result:', { isSignedIn: result.isSignedIn, nextStep: result.nextStep });
  if (result.isSignedIn) {
    console.log('[Auth] login: getting current user...');
    const user = await getCurrentUser();
    console.log('[Auth] login: user retrieved:', user.userId);
    return { userId: user.userId, email };
  }
  throw new Error('Sign in failed');
}

export async function register(email: string, password: string): Promise<void> {
  if (IS_DEV_MODE) {
    // Dev mode: skip registration, just log
    await new Promise(resolve => setTimeout(resolve, 500));
    console.log('[DEV MODE] Registered:', email);
    return;
  }

  await signUp({
    username: email,
    password,
    options: { userAttributes: { email } }
  });
}

export async function confirmRegistration(email: string, code: string): Promise<void> {
  if (IS_DEV_MODE) {
    // Dev mode: accept any code
    await new Promise(resolve => setTimeout(resolve, 500));
    console.log('[DEV MODE] Confirmed:', email);
    return;
  }

  await confirmSignUp({ username: email, confirmationCode: code });
}

export async function resendConfirmationCode(email: string): Promise<void> {
  if (IS_DEV_MODE) {
    console.log('[DEV MODE] Resent code to:', email);
    return;
  }

  await resendSignUpCode({ username: email });
}

export async function logout(): Promise<void> {
  if (IS_DEV_MODE) {
    setDevUser(null);
    console.log('[DEV MODE] Logged out');
    return;
  }

  await signOut();
}

export async function getSession(): Promise<{ accessToken: string; userId: string } | null> {
  if (IS_DEV_MODE) {
    const user = getDevUser();
    if (user) {
      return { accessToken: 'dev-token-' + user.userId, userId: user.userId };
    }
    return null;
  }

  try {
    console.log('[Auth] getSession: fetching auth session...');
    const session = await withTimeout(
      fetchAuthSession(),
      AUTH_TIMEOUT,
      'fetchAuthSession timed out'
    );
    console.log('[Auth] getSession: session fetched, getting user...');
    const user = await withTimeout(
      getCurrentUser(),
      AUTH_TIMEOUT,
      'getCurrentUser timed out'
    );
    console.log('[Auth] getSession: user fetched');
    // Use ID token (not access token) - Cognito authorizer needs email claim
    const idToken = session.tokens?.idToken?.toString();
    if (!idToken) {
      console.log('[Auth] getSession: no ID token in session');
      return null;
    }
    return { accessToken: idToken, userId: user.userId };
  } catch (error) {
    console.error('[Auth] getSession error:', error);
    return null;
  }
}

export async function getAuthenticatedUser(): Promise<AuthUser | null> {
  if (IS_DEV_MODE) {
    return getDevUser();
  }

  try {
    console.log('[Auth] getAuthenticatedUser: getting current user...');
    const user = await withTimeout(
      getCurrentUser(),
      AUTH_TIMEOUT,
      'getCurrentUser timed out'
    );
    console.log('[Auth] getAuthenticatedUser: user found, fetching session...');
    const session = await withTimeout(
      fetchAuthSession(),
      AUTH_TIMEOUT,
      'fetchAuthSession timed out'
    );
    console.log('[Auth] getAuthenticatedUser: session fetched');
    const email = session.tokens?.idToken?.payload?.email as string;
    return { userId: user.userId, email };
  } catch (error) {
    console.error('[Auth] getAuthenticatedUser error:', error);
    return null;
  }
}
