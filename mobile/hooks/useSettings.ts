// useSettings hook for russAbbot mobile
// Loads settings from AsyncStorage on mount, provides update functions
// Both the main screen and settings screen consume this hook

import { useState, useEffect, useCallback } from 'react';
import type { Settings, FeedSettings, CredibleExitSettings } from '../lib/types';
import {
  getSettings,
  updateSettings,
  updateFeedSettings as updateFeedSettingsStorage,
  updateCredibleExitSettings as updateCredibleExitStorage,
  DEFAULT_SETTINGS,
} from '../lib/settings';

export interface UseSettingsReturn {
  settings: Settings;
  isLoading: boolean;
  updateFeed: (feed: Partial<FeedSettings>) => Promise<void>;
  updateCredibleExit: (ce: Partial<CredibleExitSettings>) => Promise<void>;
  reload: () => Promise<void>;
}

export function useSettings(): UseSettingsReturn {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    const loaded = await getSettings();
    setSettings(loaded);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const updateFeed = useCallback(async (feed: Partial<FeedSettings>) => {
    const updated = await updateFeedSettingsStorage(feed);
    setSettings(updated);
  }, []);

  const updateCredibleExit = useCallback(async (ce: Partial<CredibleExitSettings>) => {
    const updated = await updateCredibleExitStorage(ce);
    setSettings(updated);
  }, []);

  return {
    settings,
    isLoading,
    updateFeed,
    updateCredibleExit,
    reload: load,
  };
}
