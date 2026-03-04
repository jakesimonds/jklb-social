// Authentication utilities for russAbbot mobile
// Wraps @atproto/oauth-client-expo for native OAuth flow

import { Agent } from '@atproto/api';
import {
  ExpoOAuthClient,
  type OAuthSession,
} from '@atproto/oauth-client-expo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';

export type { OAuthSession };

const REDIRECT_URI = 'social.jklb:/auth/callback';

// The native client metadata — must match what's served at this URL
const CLIENT_METADATA = {
  client_id:
    'https://jklb.social/oauth-client-metadata-native.json' as `https://${string}`,
  client_name: 'jklb',
  client_uri: 'https://jklb.social' as `https://${string}`,
  redirect_uris: [REDIRECT_URI] as [
    `${string}.${string}:/${string}`,
  ],
  grant_types: ['authorization_code', 'refresh_token'] as [
    'authorization_code',
    'refresh_token',
  ],
  response_types: ['code'] as ['code'],
  scope: 'atproto transition:generic',
  token_endpoint_auth_method: 'none' as const,
  application_type: 'native' as const,
  dpop_bound_access_tokens: true,
} as const;

const STORED_DID_KEY = 'jklb_oauth_did';

let oauthClient: ExpoOAuthClient | null = null;

function getClient(): ExpoOAuthClient {
  if (!oauthClient) {
    oauthClient = new ExpoOAuthClient({
      clientMetadata: CLIENT_METADATA,
      handleResolver: 'https://bsky.social',
    });
  }
  return oauthClient;
}

/**
 * Sign in with a handle. Opens system browser for OAuth authorization,
 * returns an OAuthSession on success.
 *
 * Uses a manual authorize→callback flow with expo-linking as a fallback,
 * because openAuthSessionAsync doesn't always capture the redirect on Android.
 */
export async function signIn(handle: string): Promise<OAuthSession> {
  const client = getClient();

  // First try the library's built-in signIn (uses openAuthSessionAsync)
  // If that fails with "cancelled", fall back to manual deep link capture
  try {
    const session = await client.signIn(handle);
    await AsyncStorage.setItem(STORED_DID_KEY, session.did);
    return session;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // If it wasn't a cancellation, it's a real error — rethrow
    if (!msg.includes('cancelled') && !msg.includes('dismiss')) {
      throw err;
    }
  }

  // Fallback: the redirect came through as a deep link instead of being
  // captured by openAuthSessionAsync. Check if we got a pending callback URL.
  if (pendingCallbackUrl) {
    const url = pendingCallbackUrl;
    pendingCallbackUrl = null;
    const session = await completeCallback(client, url);
    await AsyncStorage.setItem(STORED_DID_KEY, session.did);
    return session;
  }

  throw new Error('Authentication cancelled');
}

/**
 * Complete the OAuth callback from a redirect URL.
 * Extracts query params and calls the client's callback method.
 */
async function completeCallback(client: ExpoOAuthClient, url: string): Promise<OAuthSession> {
  const parsed = new URL(url);
  const params = parsed.searchParams;
  // Use the client's internal callback method (inherited from OAuthClient)
  const result = await (client as any).callback(params, {
    redirect_uri: REDIRECT_URI,
  });
  return result.session;
}

// Pending callback URL captured by the deep link listener
let pendingCallbackUrl: string | null = null;

/**
 * Set up a deep link listener that captures OAuth callback URLs.
 * Call this once at app startup (e.g. in _layout.tsx or AuthContext).
 */
export function setupCallbackListener(): () => void {
  const subscription = Linking.addEventListener('url', (event) => {
    if (event.url.startsWith('social.jklb:/auth/callback') ||
        event.url.startsWith('social.jklb://auth/callback')) {
      pendingCallbackUrl = event.url;
    }
  });
  return () => subscription.remove();
}

/**
 * Try to restore a previously authenticated session.
 * Returns null if no stored session exists or restoration fails.
 */
export async function restoreSession(): Promise<OAuthSession | null> {
  const did = await AsyncStorage.getItem(STORED_DID_KEY);
  if (!did) return null;

  try {
    const client = getClient();
    const session = await client.restore(did);
    return session;
  } catch (err) {
    console.error('Failed to restore session:', err);
    // Clear stale DID if restore fails
    await AsyncStorage.removeItem(STORED_DID_KEY);
    return null;
  }
}

/**
 * Sign out: revoke the session and clear stored DID.
 */
export async function signOut(session: OAuthSession): Promise<void> {
  try {
    await session.signOut();
  } catch (err) {
    console.error('Error revoking session:', err);
  }
  await AsyncStorage.removeItem(STORED_DID_KEY);
  oauthClient = null;
}

/**
 * Create an Agent from an OAuthSession for making API calls.
 * The agent automatically handles token refresh.
 */
export function createAgent(session: OAuthSession): Agent {
  return new Agent(session);
}
