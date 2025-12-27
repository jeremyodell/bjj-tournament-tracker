import { Amplify } from 'aws-amplify';
import { signIn, signUp, signOut, getCurrentUser, fetchAuthSession, confirmSignUp, resendSignUpCode } from '@aws-amplify/auth';

// Dev mode - bypasses Cognito for local testing
const IS_DEV_MODE = process.env.NEXT_PUBLIC_DEV_MODE === 'true';

// Dev mode storage key
const DEV_USER_KEY = 'dev-auth-user';

// Configure Amplify - values come from environment (skip in dev mode)
const userPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID;
const userPoolClientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;

// Debug: Log config status (remove in production)
if (typeof window !== 'undefined') {
  console.log('[Auth Config]', {
    IS_DEV_MODE,
    hasUserPoolId: !!userPoolId,
    hasClientId: !!userPoolClientId,
    userPoolId: userPoolId ? userPoolId.substring(0, 10) + '...' : 'NOT SET',
  });
}

if (!IS_DEV_MODE && userPoolId && userPoolClientId) {
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId,
        userPoolClientId,
      }
    }
  });
} else if (!IS_DEV_MODE) {
  console.error('[Auth] Cognito not configured - missing environment variables');
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

export async function login(email: string, password: string): Promise<AuthUser> {
  if (IS_DEV_MODE) {
    // Dev mode: accept any email/password, create mock user
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay
    const user: AuthUser = { userId: `dev-${Date.now()}`, email };
    setDevUser(user);
    console.log('[DEV MODE] Logged in as:', email);
    return user;
  }

  const result = await signIn({ username: email, password });
  if (result.isSignedIn) {
    const user = await getCurrentUser();
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
  if (IS_DEV_MODE) {
    return getDevUser();
  }

  try {
    const user = await getCurrentUser();
    const session = await fetchAuthSession();
    const email = session.tokens?.idToken?.payload?.email as string;
    return { userId: user.userId, email };
  } catch {
    return null;
  }
}
