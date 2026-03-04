// Authentication utilities for russAbbot
// Handles ATProtocol OAuth flow and session management

import {
  BrowserOAuthClient,
  atprotoLoopbackClientMetadata,
  type OAuthSession,
} from '@atproto/oauth-client-browser';
import { Agent } from '@atproto/api';
import {
  saveAuthSession,
  loadAuthSession,
  clearAuthSession,
} from './storage';
import type { AuthSession, UserProfile } from '../types';

/**
 * Result of resolving a handle to its PDS
 */
export interface HandleResolution {
  did: string;
  pdsUrl: string;
}

/**
 * Error thrown when handle resolution fails
 */
export class HandleResolutionError extends Error {
  readonly handle: string;

  constructor(message: string, handle: string) {
    super(message);
    this.name = 'HandleResolutionError';
    this.handle = handle;
  }
}

/**
 * Error thrown when OAuth flow fails
 */
export class OAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OAuthError';
  }
}

/**
 * Public ATProtocol services that can be used for handle resolution
 */
const PUBLIC_RESOLVERS = [
  'https://bsky.social',
  'https://public.api.bsky.app',
];

/**
 * DID Document service entry type
 */
interface DidService {
  id: string;
  type: string;
  serviceEndpoint: string;
}

/**
 * DID Document structure (partial - only what we need)
 */
interface DidDocument {
  id: string;
  alsoKnownAs?: string[];
  service?: DidService[];
}

// Module-level OAuth client singleton
let oauthClient: BrowserOAuthClient | null = null;

/**
 * Check if we're running on localhost/loopback
 */
function isLoopback(): boolean {
  const { hostname } = window.location;
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

/**
 * Builds the localhost OAuth client ID with scope encoded in the URL.
 * Format: http://localhost?redirect_uri=http://127.0.0.1:PORT/&scope=atproto%20transition:generic
 */
function buildLocalhostClientId(): string {
  const { port } = window.location;
  const redirectUri = `http://127.0.0.1:${port}/`;
  const scope = 'atproto transition:generic';

  return `http://localhost?redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}`;
}

/**
 * Gets or creates the singleton BrowserOAuthClient instance.
 * The client handles OAuth flow, token storage, and session management.
 */
export async function getOAuthClient(): Promise<BrowserOAuthClient> {
  if (oauthClient) {
    return oauthClient;
  }

  if (isLoopback()) {
    // Development mode: use localhost client ID format with scope in URL
    // Per ATProto OAuth spec, localhost clients encode params in the client_id URL
    const clientId = buildLocalhostClientId();

    // Use atprotoLoopbackClientMetadata helper to generate proper metadata from the client_id
    const metadata = atprotoLoopbackClientMetadata(clientId);

    oauthClient = new BrowserOAuthClient({
      handleResolver: 'https://bsky.social',
      clientMetadata: metadata,
    });
  } else {
    // Production mode: load metadata from URL
    // The client_id is the URL to the oauth-client-metadata.json file
    const clientId = `${window.location.origin}/oauth-client-metadata.json`;

    oauthClient = await BrowserOAuthClient.load({
      clientId,
      handleResolver: 'https://bsky.social',
    });
  }

  return oauthClient;
}

/**
 * Initializes the OAuth client and checks for existing sessions or callbacks.
 * This should be called once on app mount.
 *
 * @returns The active OAuthSession if one exists, or undefined
 */
export async function initializeAuth(): Promise<OAuthSession | undefined> {
  const client = await getOAuthClient();

  try {
    // init() will:
    // 1. Restore existing session if valid
    // 2. Process OAuth callback if present in URL
    // 3. Return undefined if no session
    const result = await client.init();

    if (result?.session) {
      // Clean up URL after OAuth callback
      if (window.location.hash || window.location.search) {
        const cleanUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, '', cleanUrl);
      }
      return result.session;
    }

    return undefined;
  } catch (error) {
    console.error('Failed to initialize auth:', error);
    return undefined;
  }
}

/**
 * Initiates the OAuth sign-in flow for the given handle.
 * This will redirect the user to their PDS for authorization.
 *
 * @param handle - The user's ATProtocol handle (e.g., "alice.bsky.social")
 * @throws OAuthError if the sign-in fails
 */
export async function signIn(handle: string): Promise<void> {
  const cleanHandle = handle.startsWith('@') ? handle.slice(1) : handle;

  const client = await getOAuthClient();

  try {
    // signInRedirect will redirect the browser to the PDS authorization page
    // The promise never resolves because the page navigates away
    await client.signInRedirect(cleanHandle, {
      // Optional: pass state to preserve across redirect
      state: JSON.stringify({ returnTo: window.location.pathname }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new OAuthError(`Failed to start sign-in: ${message}`);
  }
}

/**
 * Creates an Agent instance from an OAuthSession.
 * The Agent can be used to make authenticated ATProtocol API calls.
 *
 * @param session - The active OAuthSession
 * @returns An Agent configured to use the session's credentials
 */
export function createAgentFromSession(session: OAuthSession): Agent {
  return new Agent(session);
}

/**
 * Signs out the current user by revoking their session.
 *
 * @param session - The session to revoke
 */
export async function signOut(session: OAuthSession): Promise<void> {
  const client = await getOAuthClient();

  try {
    await client.revoke(session.did);
  } catch (error) {
    console.error('Failed to revoke session:', error);
    // Still throw to notify caller, but session is likely invalid anyway
    throw new OAuthError('Failed to sign out');
  }
}

/**
 * Resolves a handle to its DID using the com.atproto.identity.resolveHandle endpoint
 *
 * @param handle - The user's handle (e.g., "alice.bsky.social" or "bob.example.com")
 * @returns The DID string (e.g., "did:plc:abc123...")
 * @throws HandleResolutionError if resolution fails
 */
async function resolveHandleToDid(handle: string): Promise<string> {
  // Clean handle - remove @ prefix if present
  const cleanHandle = handle.startsWith('@') ? handle.slice(1) : handle;

  // Try each public resolver in order
  for (const resolver of PUBLIC_RESOLVERS) {
    try {
      const url = `${resolver}/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(cleanHandle)}`;
      const response = await fetch(url);

      if (!response.ok) {
        continue; // Try next resolver
      }

      const data = await response.json() as { did: string };
      if (data.did) {
        return data.did;
      }
    } catch {
      // Try next resolver on network error
      continue;
    }
  }

  throw new HandleResolutionError(
    `Could not resolve handle "${cleanHandle}". Please check the handle is correct.`,
    cleanHandle
  );
}

/**
 * Resolves a DID to its DID Document
 * Supports both did:plc and did:web methods
 *
 * @param did - The DID to resolve
 * @returns The DID Document
 * @throws HandleResolutionError if resolution fails
 */
async function resolveDidDocument(did: string): Promise<DidDocument> {
  let url: string;

  if (did.startsWith('did:plc:')) {
    // did:plc uses the plc.directory resolution service
    url = `https://plc.directory/${did}`;
  } else if (did.startsWith('did:web:')) {
    // did:web resolves via .well-known endpoint on the domain
    const domain = did.replace('did:web:', '').replace(/%3A/g, ':');
    url = `https://${domain}/.well-known/did.json`;
  } else {
    throw new HandleResolutionError(
      `Unsupported DID method: ${did}`,
      did
    );
  }

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new HandleResolutionError(
        `Failed to resolve DID document for ${did}`,
        did
      );
    }

    return await response.json() as DidDocument;
  } catch (error) {
    if (error instanceof HandleResolutionError) {
      throw error;
    }
    throw new HandleResolutionError(
      `Network error resolving DID ${did}`,
      did
    );
  }
}

/**
 * Extracts the PDS service endpoint from a DID Document
 *
 * @param didDoc - The DID Document to extract from
 * @returns The PDS URL
 * @throws HandleResolutionError if no PDS service found
 */
function extractPdsEndpoint(didDoc: DidDocument): string {
  const pdsService = didDoc.service?.find(
    (s) => s.id.endsWith('#atproto_pds') && s.type === 'AtprotoPersonalDataServer'
  );

  if (!pdsService) {
    throw new HandleResolutionError(
      `No PDS service found in DID document for ${didDoc.id}`,
      didDoc.id
    );
  }

  return pdsService.serviceEndpoint;
}

/**
 * Resolves an ATProtocol handle to its PDS endpoint URL
 *
 * This is the main function used for login - given a handle like "alice.bsky.social"
 * or "bob.example.com", it returns the DID and PDS URL needed for OAuth authentication.
 *
 * The resolution process:
 * 1. Resolve handle → DID via com.atproto.identity.resolveHandle
 * 2. Resolve DID → DID Document
 * 3. Extract PDS endpoint from DID Document service array
 *
 * @param handle - The user's handle (e.g., "alice.bsky.social")
 * @returns Object containing the resolved DID and PDS URL
 * @throws HandleResolutionError if any step of resolution fails
 *
 * @example
 * const { did, pdsUrl } = await resolveHandleToPds('alice.bsky.social');
 * // did: 'did:plc:...'
 * // pdsUrl: 'https://bsky.network'
 */
export async function resolveHandleToPds(handle: string): Promise<HandleResolution> {
  // Step 1: Resolve handle to DID
  const did = await resolveHandleToDid(handle);

  // Step 2: Resolve DID to DID Document
  const didDoc = await resolveDidDocument(did);

  // Step 3: Extract PDS endpoint
  const pdsUrl = extractPdsEndpoint(didDoc);

  return { did, pdsUrl };
}

/**
 * Saves session info to localStorage for quick access.
 * This stores essential user info that can be used before OAuth client initializes.
 *
 * @param session - The OAuthSession to save info from
 * @param userProfile - Optional user profile with handle and display info
 */
export async function saveSessionToStorage(
  session: OAuthSession,
  userProfile?: UserProfile
): Promise<void> {
  const agent = new Agent(session);

  // If no profile provided, fetch it
  let profile = userProfile;
  if (!profile) {
    try {
      const response = await agent.getProfile({ actor: session.did });
      profile = {
        did: response.data.did,
        handle: response.data.handle,
        displayName: response.data.displayName,
        avatar: response.data.avatar,
        description: response.data.description,
      };
    } catch (error) {
      console.error('Failed to fetch profile for session storage:', error);
      // Save minimal info even without profile fetch
      profile = {
        did: session.did,
        handle: session.did, // fallback to DID if handle unknown
      };
    }
  }

  // Create AuthSession for localStorage
  // Note: We don't store actual tokens here - OAuth client handles that in IndexedDB
  // This is for quick profile access and handle display
  const authSession: AuthSession = {
    did: session.did,
    handle: profile.handle,
    accessJwt: '', // Not stored for security - OAuth client manages tokens
    refreshJwt: '', // Not stored for security - OAuth client manages tokens
    pdsUrl: '', // Will be populated if needed in future
  };

  saveAuthSession(authSession);
}

/**
 * Loads session info from localStorage.
 * Returns the stored AuthSession if it exists.
 */
export function loadSessionFromStorage(): AuthSession | null {
  return loadAuthSession();
}

/**
 * Clears session from localStorage.
 * Should be called alongside OAuth signOut.
 */
export function clearSessionFromStorage(): void {
  clearAuthSession();
}

/**
 * Signs out the current user completely.
 * Revokes the OAuth session and clears localStorage.
 *
 * @param session - The session to revoke
 */
export async function signOutAndClearStorage(session: OAuthSession): Promise<void> {
  // First clear localStorage
  clearSessionFromStorage();

  // Then revoke OAuth session
  const client = await getOAuthClient();
  try {
    await client.revoke(session.did);
  } catch (error) {
    console.error('Failed to revoke session:', error);
    // Session is cleared from localStorage anyway
  }
}

// Re-export types for convenience
export type { OAuthSession, AuthSession, UserProfile };
