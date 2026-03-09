import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { TEST_CURATED_URIS } from './curator-test-fixtures';

type CuratorStatus = 'idle' | 'working' | 'ready';

interface CuratorState {
  status: CuratorStatus;
  curatedUris: string[];
  requestedCount: number;
  userPrompt: string;
}

interface CuratorContextValue extends CuratorState {
  startCuration: (prompt: string, count: number) => void;
  getCuratedPosts: () => string[];
  reset: () => void;
}

const CuratorContext = createContext<CuratorContextValue | undefined>(undefined);

function getInitialPrompt(): string {
  return localStorage.getItem('jklb-feed-preference') ?? '';
}

function getInitialCount(): number {
  const stored = localStorage.getItem('jklb-curator-count');
  if (stored) {
    const parsed = parseInt(stored, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 50) return parsed;
  }
  return 20;
}

export function CuratorProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<CuratorStatus>('idle');
  const [curatedUris, setCuratedUris] = useState<string[]>([]);
  const [requestedCount, setRequestedCount] = useState<number>(getInitialCount);
  const [userPrompt, setUserPrompt] = useState<string>(getInitialPrompt);

  const startCuration = useCallback((prompt: string, count: number) => {
    setUserPrompt(prompt);
    setRequestedCount(count);
    setStatus('working');

    // Save to localStorage
    localStorage.setItem('jklb-feed-preference', prompt);
    localStorage.setItem('jklb-curator-count', String(count));

    // Simulate curator work — 8 second delay, then ready with test URIs
    setTimeout(() => {
      setCuratedUris(TEST_CURATED_URIS.slice(0, count));
      setStatus('ready');
    }, 8000);
  }, []);

  const getCuratedPosts = useCallback(() => {
    return curatedUris;
  }, [curatedUris]);

  const reset = useCallback(() => {
    setStatus('idle');
    setCuratedUris([]);
  }, []);

  const value: CuratorContextValue = {
    status,
    curatedUris,
    requestedCount,
    userPrompt,
    startCuration,
    getCuratedPosts,
    reset,
  };

  return (
    <CuratorContext.Provider value={value}>
      {children}
    </CuratorContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCurator(): CuratorContextValue {
  const context = useContext(CuratorContext);
  if (context === undefined) {
    throw new Error('useCurator must be used within a CuratorProvider');
  }
  return context;
}
