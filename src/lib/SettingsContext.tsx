// Settings Context for russAbbot
// Provides app-wide access to settings with automatic localStorage persistence

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { Settings, FeedSettings, CredibleExitSettings, LLMSettings, MusicSettings } from '../types';
import { getSettings, updateSettings, DEFAULT_SETTINGS } from './settings';
import { resetPostsViewed } from './session';

/**
 * Context value interface
 */
interface SettingsContextValue {
  settings: Settings;
  updateFeed: (feed: Partial<FeedSettings>) => void;
  updateAwardSettings: (awardSettings: Partial<CredibleExitSettings>) => void;
  updateLLM: (llm: Partial<LLMSettings>) => void;
  updateMusic: (music: Partial<MusicSettings>) => void;
  updateAwardEnabled: (enabled: boolean) => void;
  updateTutorial: (enabled: boolean) => void;
  resetToDefaults: () => void;
}

/**
 * Create context with undefined default (will be set by provider)
 */
const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

/**
 * Provider component props
 */
interface SettingsProviderProps {
  children: ReactNode;
}

/**
 * SettingsProvider
 * Wraps the app and provides settings state with automatic persistence
 */
export function SettingsProvider({ children }: SettingsProviderProps) {
  // Initialize state from localStorage
  const [settings, setSettings] = useState<Settings>(() => getSettings());

  // Persist settings to localStorage whenever they change
  useEffect(() => {
    updateSettings(settings);
  }, [settings]);


  // Update feed settings
  const updateFeed = useCallback((feed: Partial<FeedSettings>) => {
    setSettings(prev => ({
      ...prev,
      feed: {
        ...prev.feed,
        ...feed,
      },
    }));
  }, []);

  // Update award nomination settings
  // When post budget changes, reset postsViewed counter so user starts fresh
  const updateAwardSettings = useCallback((credibleExit: Partial<CredibleExitSettings>) => {
    setSettings(prev => {
      // If postsBeforePrompt (budget) is changing, reset the counter
      if (
        credibleExit.postsBeforePrompt !== undefined &&
        credibleExit.postsBeforePrompt !== prev.credibleExit.postsBeforePrompt
      ) {
        resetPostsViewed();
      }

      return {
        ...prev,
        credibleExit: {
          ...prev.credibleExit,
          ...credibleExit,
        },
      };
    });
  }, []);

  // Update music settings
  const updateMusic = useCallback((music: Partial<MusicSettings>) => {
    setSettings(prev => ({
      ...prev,
      music: {
        ...prev.music,
        ...music,
      },
    }));
  }, []);

  // Update LLM settings
  const updateLLM = useCallback((llm: Partial<LLMSettings>) => {
    setSettings(prev => ({
      ...prev,
      llm: {
        ...prev.llm,
        ...llm,
      },
    }));
  }, []);

  // Update award nomination enabled toggle
  // When toggled ON, reset postsViewed counter so user starts fresh from opt-in moment
  const updateAwardEnabled = useCallback((enabled: boolean) => {
    if (enabled) {
      resetPostsViewed();
    }
    setSettings(prev => ({
      ...prev,
      credibleExitEnabled: enabled,
    }));
  }, []);

  // Update tutorial setting
  const updateTutorial = useCallback((enabled: boolean) => {
    setSettings(prev => ({
      ...prev,
      tutorial: enabled,
    }));
  }, []);

  // Reset all settings to defaults
  const resetToDefaults = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
  }, []);

  const value: SettingsContextValue = {
    settings,
    updateFeed,
    updateAwardSettings,
    updateLLM,
    updateMusic,
    updateAwardEnabled,
    updateTutorial,
    resetToDefaults,
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

/**
 * Custom hook to use settings context
 * Throws if used outside of SettingsProvider
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
