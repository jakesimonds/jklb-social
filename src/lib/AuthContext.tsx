// Auth Context for russAbbot
// Provides app-wide access to authentication state with automatic session management

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import type { Agent } from '@atproto/api';
import type { UserProfile } from '../types';
import {
  initializeAuth,
  signIn,
  createAgentFromSession,
  saveSessionToStorage,
  loadSessionFromStorage,
  signOutAndClearStorage,
  OAuthError,
  type OAuthSession,
} from './auth';

/**
 * Auth context state
 */
interface AuthState {
  /** Whether auth is still initializing */
  isInitializing: boolean;
  /** Whether a login/logout operation is in progress */
  isLoading: boolean;
  /** The authenticated agent for API calls, or null if not logged in */
  agent: Agent | null;
  /** The current user's profile, or null if not logged in */
  profile: UserProfile | null;
  /** The current OAuth session, or null if not logged in */
  session: OAuthSession | null;
  /** Error message from last operation, or null */
  error: string | null;
}

/**
 * Auth context value (state + actions)
 */
interface AuthContextValue extends AuthState {
  /** Initiate login with the given handle */
  login: (handle: string) => Promise<void>;
  /** Log out the current user */
  logout: () => Promise<void>;
  /** Clear any error state */
  clearError: () => void;
  /** Check if user is authenticated */
  isAuthenticated: boolean;
}

/**
 * Create context with undefined default (will be set by provider)
 */
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Provider component props
 */
interface AuthProviderProps {
  children: ReactNode;
}

/**
 * AuthProvider
 * Wraps the app and provides authentication state with automatic session management
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [isInitializing, setIsInitializing] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [session, setSession] = useState<OAuthSession | null>(null);
  const [agent, setAgent] = useState<Agent | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Initialize auth on mount - check for existing session or OAuth callback
  useEffect(() => {
    async function init() {
      try {
        const existingSession = await initializeAuth();
        if (existingSession) {
          setSession(existingSession);
          const newAgent = createAgentFromSession(existingSession);
          setAgent(newAgent);

          // Try cached profile first for instant render
          const cached = loadSessionFromStorage();
          if (cached) {
            const cachedProfile: UserProfile = {
              did: cached.did,
              handle: cached.handle,
            };
            setProfile(cachedProfile);
            setIsInitializing(false); // Let the app render NOW

            // Background refresh for fresh avatar/displayName
            newAgent.getProfile({ actor: existingSession.did }).then(response => {
              const freshProfile: UserProfile = {
                did: response.data.did,
                handle: response.data.handle,
                displayName: response.data.displayName,
                avatar: response.data.avatar,
                description: response.data.description,
              };
              setProfile(freshProfile);
              saveSessionToStorage(existingSession, freshProfile);
            }).catch(err => {
              console.error('Background profile refresh failed:', err);
            });
            return; // Skip the blocking profile fetch below
          }

          // No cache — fall through to blocking fetch (first-time login)
          try {
            const profileResponse = await newAgent.getProfile({
              actor: existingSession.did,
            });
            const userProfile: UserProfile = {
              did: profileResponse.data.did,
              handle: profileResponse.data.handle,
              displayName: profileResponse.data.displayName,
              avatar: profileResponse.data.avatar,
              description: profileResponse.data.description,
            };
            setProfile(userProfile);

            // Save session info to localStorage for quick access
            await saveSessionToStorage(existingSession, userProfile);
          } catch (profileError) {
            console.error('Failed to fetch profile:', profileError);
            // Still set a minimal profile from session
            setProfile({
              did: existingSession.did,
              handle: existingSession.did.split(':').pop() || existingSession.did,
            });
          }
        }
      } catch (err) {
        console.error('Auth initialization failed:', err);
        setError('Failed to initialize authentication');
      } finally {
        setIsInitializing(false);
      }
    }

    init();
  }, []);

  // Login handler
  const login = useCallback(async (handle: string) => {
    setIsLoading(true);
    setError(null);

    try {
      // This will redirect the browser to the PDS authorization page
      // The page will redirect back after auth, and initializeAuth will
      // pick up the callback on the next mount
      await signIn(handle);
      // Note: This code won't execute because signIn redirects the browser
    } catch (err) {
      setIsLoading(false);
      console.error('Login error:', err);
      if (err instanceof OAuthError) {
        setError(err.message);
      } else {
        const msg = err instanceof Error ? err.message : String(err);
        setError(`Login failed: ${msg}`);
      }
    }
  }, []);

  // Logout handler
  const logout = useCallback(async () => {
    if (!session) return;

    setIsLoading(true);
    try {
      // Sign out and clear session from localStorage
      await signOutAndClearStorage(session);
    } catch {
      // Even if revocation fails, local state is cleared
    }

    setSession(null);
    setAgent(null);
    setProfile(null);
    setIsLoading(false);
  }, [session]);

  // Clear error handler
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value: AuthContextValue = {
    isInitializing,
    isLoading,
    agent,
    profile,
    session,
    error,
    login,
    logout,
    clearError,
    isAuthenticated: session !== null && agent !== null,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Custom hook to use auth context
 * Throws if used outside of AuthProvider
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
