// Settings utilities for russAbbot
// Defines default values and helper functions for user settings

import type { Settings, FeedSettings, CredibleExitSettings, LLMSettings, MusicSettings } from '../types';
import { loadSettings, saveSettings } from './storage';

// Re-export UI_TESTING_MODE from flags for backwards compatibility
export { UI_TESTING_MODE } from './flags';

/**
 * Default Values
 * These match the spec in settings-modal.md
 */

export const DEFAULT_AWARD_PROMPT =
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
  cardRadius: 20,
};

export const DEFAULT_AWARD_SETTINGS: CredibleExitSettings = {
  postsBeforePrompt: 20,
  prompt: DEFAULT_AWARD_PROMPT,
};

export const DEFAULT_LLM_SETTINGS: LLMSettings = {
  explanationPrompt: DEFAULT_EXPLANATION_PROMPT,
};

export const DEFAULT_MUSIC_SETTINGS: MusicSettings = {
  enabled: false,
  beginning: 'at://did:plc:hsqwcidfez66lwm3gxhfv5in/fm.plyr.track/3mgdxbah4fs2z', // "brain fog" — goose.art
  middle: 'at://did:plc:7mnpet2pvof2llhpcwattscf/fm.plyr.track/3m5humhf7h22w',    // "banana mix" — stellz
  end: 'at://did:plc:hsqwcidfez66lwm3gxhfv5in/fm.plyr.track/3mf3wujok2h2s',       // "missed my bus" — goose.art
};

export const DEFAULT_AWARD_ENABLED = true;

export const DEFAULT_TUTORIAL = true;

export const DEFAULT_SETTINGS: Settings = {
  feed: DEFAULT_FEED_SETTINGS,
  credibleExit: DEFAULT_AWARD_SETTINGS,
  llm: DEFAULT_LLM_SETTINGS,
  music: DEFAULT_MUSIC_SETTINGS,
  credibleExitEnabled: DEFAULT_AWARD_ENABLED,
  tutorial: DEFAULT_TUTORIAL,
};

/**
 * Load settings from localStorage, merging with defaults
 * This ensures new settings fields are always present even if
 * the user has an older saved settings object
 */
export function getSettings(): Settings {
  const saved = loadSettings();
  if (!saved) {
    return DEFAULT_SETTINGS;
  }

  // Deep merge with defaults to handle partial/outdated saved settings
  // Extract only the fields we still use (ignore deprecated chronoEnabled/chronoCount, theme)
  const savedFeed = saved.feed ?? {};
  // Handle migration from old 'journal' property name to 'credibleExit'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const savedAny = saved as any;
  const credibleExitData = saved.credibleExit ?? savedAny.journal;
  return {
    feed: {
      chorusEnabled: savedFeed.chorusEnabled ?? DEFAULT_FEED_SETTINGS.chorusEnabled,
      algoFeed: savedFeed.algoFeed ?? DEFAULT_FEED_SETTINGS.algoFeed,
      atmosphereEnabled: savedFeed.atmosphereEnabled ?? DEFAULT_FEED_SETTINGS.atmosphereEnabled,
      coverPhotoEnabled: savedFeed.coverPhotoEnabled ?? DEFAULT_FEED_SETTINGS.coverPhotoEnabled,
      coverPhotoPosition: savedFeed.coverPhotoPosition ?? DEFAULT_FEED_SETTINGS.coverPhotoPosition,
      postTextSize: savedFeed.postTextSize ?? DEFAULT_FEED_SETTINGS.postTextSize,
      cardRadius: savedFeed.cardRadius ?? DEFAULT_FEED_SETTINGS.cardRadius,
    },
    credibleExit: {
      ...DEFAULT_AWARD_SETTINGS,
      ...credibleExitData,
    },
    llm: {
      // Always use the new default explanation prompt (fixes stale localStorage)
      // Users can't customize this yet anyway, so no loss
      explanationPrompt: DEFAULT_EXPLANATION_PROMPT,
    },
    music: (() => {
      const m = saved.music ?? {};
      // Migrate old single-track setting to per-phase
      if (m.selectedTrackUri && !m.beginning) {
        return {
          enabled: m.enabled ?? DEFAULT_MUSIC_SETTINGS.enabled,
          beginning: m.selectedTrackUri,
          middle: m.selectedTrackUri,
          end: m.selectedTrackUri,
        };
      }
      return {
        enabled: m.enabled ?? DEFAULT_MUSIC_SETTINGS.enabled,
        beginning: m.beginning ?? DEFAULT_MUSIC_SETTINGS.beginning,
        middle: m.middle ?? DEFAULT_MUSIC_SETTINGS.middle,
        end: m.end ?? DEFAULT_MUSIC_SETTINGS.end,
      };
    })(),
    credibleExitEnabled: saved.credibleExitEnabled ?? DEFAULT_AWARD_ENABLED,
    tutorial: saved.tutorial ?? DEFAULT_TUTORIAL,
  };
}

/**
 * Save settings to localStorage
 */
export function updateSettings(settings: Settings): void {
  saveSettings(settings);
}

/**
 * Update a specific section of settings
 */
export function updateFeedSettings(feed: Partial<FeedSettings>): Settings {
  const current = getSettings();
  const updated: Settings = {
    ...current,
    feed: {
      ...current.feed,
      ...feed,
    },
  };
  saveSettings(updated);
  return updated;
}

export function updateAwardSettings(credibleExit: Partial<CredibleExitSettings>): Settings {
  const current = getSettings();
  const updated: Settings = {
    ...current,
    credibleExit: {
      ...current.credibleExit,
      ...credibleExit,
    },
  };
  saveSettings(updated);
  return updated;
}

export function updateMusicSettings(music: Partial<MusicSettings>): Settings {
  const current = getSettings();
  const updated: Settings = {
    ...current,
    music: {
      ...current.music,
      ...music,
    },
  };
  saveSettings(updated);
  return updated;
}

export function updateLLMSettings(llm: Partial<LLMSettings>): Settings {
  const current = getSettings();
  const updated: Settings = {
    ...current,
    llm: {
      ...current.llm,
      ...llm,
    },
  };
  saveSettings(updated);
  return updated;
}

/**
 * Reset settings to defaults
 */
export function resetSettings(): Settings {
  saveSettings(DEFAULT_SETTINGS);
  return DEFAULT_SETTINGS;
}
