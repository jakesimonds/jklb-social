// Settings utilities for russAbbot mobile
// Adapted from src/lib/settings.ts — localStorage → AsyncStorage
// All load/save functions are async

import type { Settings, FeedSettings, CredibleExitSettings, LLMSettings, MusicSettings } from './types';
import { loadSettings, saveSettings } from './storage';

/**
 * Default Values
 * These match the spec in settings-modal.md
 */

export const DEFAULT_CREDIBLE_EXIT_PROMPT =
  'How are you feeling after this session? What did you notice about your social media use?';

export const DEFAULT_EXPLANATION_PROMPT =
  "What is this post about? Max 30 words. Define slang/memes/references if needed. Include links if you know them. If it's nonsense or you don't know, just say so.";

export const DEFAULT_FEED_SETTINGS: FeedSettings = {
  chorusEnabled: true,
  algoFeed: null,  // Chronological (Following) — same as Bluesky's default
  atmosphereEnabled: false,  // Off by default — experimental feature
  coverPhotoEnabled: true,
  coverPhotoPosition: 'tile',
  postTextSize: 'medium',
  threadViewMode: 'scroll',
};

export const DEFAULT_CREDIBLE_EXIT_SETTINGS: CredibleExitSettings = {
  postsBeforePrompt: 20,
  prompt: DEFAULT_CREDIBLE_EXIT_PROMPT,
};

export const DEFAULT_LLM_SETTINGS: LLMSettings = {
  explanationPrompt: DEFAULT_EXPLANATION_PROMPT,
};

export const DEFAULT_MUSIC_SETTINGS: MusicSettings = {
  enabled: false,
  selectedTrackUri: null,
};

export const DEFAULT_CREDIBLE_EXIT_ENABLED = true;

export const DEFAULT_SETTINGS: Settings = {
  feed: DEFAULT_FEED_SETTINGS,
  credibleExit: DEFAULT_CREDIBLE_EXIT_SETTINGS,
  llm: DEFAULT_LLM_SETTINGS,
  music: DEFAULT_MUSIC_SETTINGS,
  credibleExitEnabled: DEFAULT_CREDIBLE_EXIT_ENABLED,
};

/**
 * Load settings from AsyncStorage, merging with defaults
 * This ensures new settings fields are always present even if
 * the user has an older saved settings object
 */
export async function getSettings(): Promise<Settings> {
  const saved = await loadSettings();
  if (!saved) {
    return DEFAULT_SETTINGS;
  }

  // Deep merge with defaults to handle partial/outdated saved settings
  const savedFeed = saved.feed ?? {};
  return {
    feed: {
      chorusEnabled: savedFeed.chorusEnabled ?? DEFAULT_FEED_SETTINGS.chorusEnabled,
      algoFeed: savedFeed.algoFeed ?? DEFAULT_FEED_SETTINGS.algoFeed,
      atmosphereEnabled: savedFeed.atmosphereEnabled ?? DEFAULT_FEED_SETTINGS.atmosphereEnabled,
      coverPhotoEnabled: savedFeed.coverPhotoEnabled ?? DEFAULT_FEED_SETTINGS.coverPhotoEnabled,
      coverPhotoPosition: savedFeed.coverPhotoPosition ?? DEFAULT_FEED_SETTINGS.coverPhotoPosition,
      postTextSize: savedFeed.postTextSize ?? DEFAULT_FEED_SETTINGS.postTextSize,
      threadViewMode: savedFeed.threadViewMode ?? DEFAULT_FEED_SETTINGS.threadViewMode,
    },
    credibleExit: {
      ...DEFAULT_CREDIBLE_EXIT_SETTINGS,
      ...saved.credibleExit,
    },
    llm: {
      // Always use the new default explanation prompt (fixes stale storage)
      explanationPrompt: DEFAULT_EXPLANATION_PROMPT,
    },
    music: {
      enabled: saved.music?.enabled ?? DEFAULT_MUSIC_SETTINGS.enabled,
      selectedTrackUri: saved.music?.selectedTrackUri ?? DEFAULT_MUSIC_SETTINGS.selectedTrackUri,
    },
    credibleExitEnabled: saved.credibleExitEnabled ?? DEFAULT_CREDIBLE_EXIT_ENABLED,
  };
}

/**
 * Save settings to AsyncStorage
 */
export async function updateSettings(settings: Settings): Promise<void> {
  await saveSettings(settings);
}

/**
 * Update a specific section of settings
 */
export async function updateFeedSettings(feed: Partial<FeedSettings>): Promise<Settings> {
  const current = await getSettings();
  const updated: Settings = {
    ...current,
    feed: {
      ...current.feed,
      ...feed,
    },
  };
  await saveSettings(updated);
  return updated;
}

export async function updateCredibleExitSettings(credibleExit: Partial<CredibleExitSettings>): Promise<Settings> {
  const current = await getSettings();
  const updated: Settings = {
    ...current,
    credibleExit: {
      ...current.credibleExit,
      ...credibleExit,
    },
  };
  await saveSettings(updated);
  return updated;
}

export async function updateMusicSettings(music: Partial<MusicSettings>): Promise<Settings> {
  const current = await getSettings();
  const updated: Settings = {
    ...current,
    music: {
      ...current.music,
      ...music,
    },
  };
  await saveSettings(updated);
  return updated;
}

export async function updateLLMSettings(llm: Partial<LLMSettings>): Promise<Settings> {
  const current = await getSettings();
  const updated: Settings = {
    ...current,
    llm: {
      ...current.llm,
      ...llm,
    },
  };
  await saveSettings(updated);
  return updated;
}

/**
 * Reset settings to defaults
 */
export async function resetSettings(): Promise<Settings> {
  await saveSettings(DEFAULT_SETTINGS);
  return DEFAULT_SETTINGS;
}
