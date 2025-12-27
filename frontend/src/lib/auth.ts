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
