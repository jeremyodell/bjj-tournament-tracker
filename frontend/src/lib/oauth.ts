// OAuth helpers for Cognito hosted UI

const COGNITO_DOMAIN = process.env.NEXT_PUBLIC_COGNITO_DOMAIN;
const CLIENT_ID = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;

/**
 * Get the OAuth callback URL based on current environment
 */
export function getCallbackUrl(): string {
  if (typeof window === 'undefined') {
    return 'http://localhost:3000';
  }
  return window.location.origin;
}

/**
 * Build Cognito hosted UI URL for Google OAuth
 */
export function getGoogleOAuthUrl(): string {
  if (!COGNITO_DOMAIN || !CLIENT_ID) {
    console.error('Missing Cognito configuration');
    return '/register';
  }

  const callbackUrl = getCallbackUrl();

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    scope: 'email openid profile',
    redirect_uri: callbackUrl,
    identity_provider: 'Google',
  });

  return `https://${COGNITO_DOMAIN}/oauth2/authorize?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(code: string): Promise<{
  access_token: string;
  id_token: string;
  refresh_token: string;
}> {
  if (!COGNITO_DOMAIN || !CLIENT_ID) {
    throw new Error('Missing Cognito configuration');
  }

  const callbackUrl = getCallbackUrl();

  const response = await fetch(`https://${COGNITO_DOMAIN}/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: CLIENT_ID,
      code,
      redirect_uri: callbackUrl,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  return response.json();
}
