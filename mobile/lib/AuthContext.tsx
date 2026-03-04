// Auth Context for russAbbot mobile
// Provides app-wide access to authentication state

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import type { Agent } from '@atproto/api';
import type { OAuthSession } from '@atproto/oauth-client-expo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { UserProfile } from './types';
import { STORAGE_KEYS } from './types';
import { signIn, restoreSession, signOut, createAgent } from './auth';

interface AuthContextValue {
  isInitializing: boolean;
  isLoading: boolean;
  agent: Agent | null;
  profile: UserProfile | null;
  error: string | null;
  isAuthenticated: boolean;
  login: (handle: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isInitializing, setIsInitializing] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [session, setSession] = useState<OAuthSession | null>(null);
  const [agent, setAgent] = useState<Agent | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Try to restore session on mount
  useEffect(() => {
    async function init() {
      try {
        const restored = await restoreSession();
        if (restored) {
          setSession(restored);
          const newAgent = createAgent(restored);
          setAgent(newAgent);

          // Minimal profile immediately — let the app render
          setProfile({
            did: restored.did,
            handle: restored.did,
          });
          setIsInitializing(false); // Let the app render NOW

          // Background refresh for avatar/displayName
          newAgent.getProfile({ actor: restored.did }).then(res => {
            setProfile({
              did: res.data.did,
              handle: res.data.handle,
              displayName: res.data.displayName,
              avatar: res.data.avatar,
              description: res.data.description,
            });
          }).catch(err => {
            console.error('Background profile refresh failed:', err);
          });
          return; // Skip the finally block's setIsInitializing
        }
      } catch (err) {
        console.error('Auth init failed:', err);
        setError('Failed to initialize authentication');
      } finally {
        setIsInitializing(false);
      }
    }

    init();
  }, []);

  const login = useCallback(async (handle: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const newSession = await signIn(handle);
      setSession(newSession);
      const newAgent = createAgent(newSession);
      setAgent(newAgent);

      // Save handle for pre-filling on next login
      await AsyncStorage.setItem(STORAGE_KEYS.LAST_HANDLE, handle.trim());

      // Fetch user profile
      try {
        const res = await newAgent.getProfile({ actor: newSession.did });
        setProfile({
          did: res.data.did,
          handle: res.data.handle,
          displayName: res.data.displayName,
          avatar: res.data.avatar,
          description: res.data.description,
        });
      } catch {
        setProfile({
          did: newSession.did,
          handle: newSession.did,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Login failed: ${msg}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    if (!session) return;

    setIsLoading(true);
    try {
      await signOut(session);
    } catch {
      // Even if revocation fails, clear local state
    }

    // Clear saved handle so next login starts fresh
    await AsyncStorage.removeItem(STORAGE_KEYS.LAST_HANDLE);

    setSession(null);
    setAgent(null);
    setProfile(null);
    setIsLoading(false);
  }, [session]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value: AuthContextValue = {
    isInitializing,
    isLoading,
    agent,
    profile,
    error,
    isAuthenticated: session !== null && agent !== null,
    login,
    logout,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
