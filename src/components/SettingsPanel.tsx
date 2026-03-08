/**
 * SettingsPanel - Settings for russAbbot
 *
 * Feed config (algorithm, post count) lives on the Middle card.
 * NOTE: Spec (settings-modal.md) says only 3 settings (Tutorial, Text Size, Music).
 * Code currently has 6 — Award Nomination, Like Chorus, and Cover Photo are not in spec.
 */

import { useState, useEffect, useRef } from 'react';
import { useSettings } from '../lib/SettingsContext';
import { DEFAULT_MUSIC_SETTINGS } from '../lib/settings';
import { usePremium } from '../hooks/usePremium';
import type { PlayerFMTrack } from '../lib/pds';

/**
 * Toggle Switch Component
 */
function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center justify-between cursor-pointer">
      <span className="text-[var(--memphis-text)]">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          checked ? 'bg-[var(--memphis-cyan)]' : 'bg-[var(--memphis-border)]'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </label>
  );
}


/**
 * Post Text Size Settings (Small / Medium / Large)
 */
function TextSizeSettings() {
  const { settings, updateFeed } = useSettings();

  return (
    <div className="flex items-center justify-between">
      <span className="text-[var(--memphis-text)]">Text Size</span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => updateFeed({ postTextSize: 'small' })}
          className={`px-3 py-1 text-sm rounded-l-md border transition-colors ${
            settings.feed.postTextSize === 'small'
              ? 'bg-[var(--memphis-cyan)] text-[var(--memphis-bg)] border-[var(--memphis-cyan)]'
              : 'bg-[var(--memphis-bg)] text-[var(--memphis-text-muted)] border-[var(--memphis-border)] hover:border-[var(--memphis-cyan)]'
          }`}
        >
          Small
        </button>
        <button
          type="button"
          onClick={() => updateFeed({ postTextSize: 'medium' })}
          className={`px-3 py-1 text-sm border transition-colors ${
            settings.feed.postTextSize === 'medium'
              ? 'bg-[var(--memphis-cyan)] text-[var(--memphis-bg)] border-[var(--memphis-cyan)]'
              : 'bg-[var(--memphis-bg)] text-[var(--memphis-text-muted)] border-[var(--memphis-border)] hover:border-[var(--memphis-cyan)]'
          }`}
        >
          Medium
        </button>
        <button
          type="button"
          onClick={() => updateFeed({ postTextSize: 'large' })}
          className={`px-3 py-1 text-sm rounded-r-md border transition-colors ${
            settings.feed.postTextSize === 'large'
              ? 'bg-[var(--memphis-cyan)] text-[var(--memphis-bg)] border-[var(--memphis-cyan)]'
              : 'bg-[var(--memphis-bg)] text-[var(--memphis-text-muted)] border-[var(--memphis-border)] hover:border-[var(--memphis-cyan)]'
          }`}
        >
          Large
        </button>
      </div>
    </div>
  );
}

/**
 * Single phase track dropdown
 */
function PhaseTrackSelect({
  label,
  phase,
  tracks,
  isLoadingTracks,
}: {
  label: string;
  phase: 'beginning' | 'middle' | 'end';
  tracks: PlayerFMTrack[];
  isLoadingTracks: boolean;
}) {
  const { settings, updateMusic } = useSettings();

  // Use default track if the user hasn't explicitly chosen something
  const currentValue = settings.music[phase];
  const effectiveValue = currentValue === 'none' ? '' : (currentValue ?? DEFAULT_MUSIC_SETTINGS[phase] ?? '');

  if (isLoadingTracks) {
    return (
      <div>
        <span className="text-[var(--memphis-text-muted)] text-xs">{label}</span>
        <select
          disabled
          className="w-full bg-[var(--memphis-bg)] border border-[var(--memphis-border)] rounded px-3 py-1.5 text-sm text-[var(--memphis-text-muted)] focus:outline-none opacity-60"
        >
          <option>Loading songs...</option>
        </select>
      </div>
    );
  }

  if (tracks.length === 0) {
    return null;
  }

  return (
    <div>
      <span className="text-[var(--memphis-text-muted)] text-xs">{label}</span>
      <select
        value={effectiveValue}
        onChange={(e) => {
          const val = e.target.value;
          updateMusic({ [phase]: val === '' ? 'none' : val });
        }}
        className="w-full bg-[var(--memphis-bg)] border border-[var(--memphis-border)] rounded px-3 py-1.5 text-sm text-[var(--memphis-text)] focus:border-[var(--memphis-cyan)] focus:outline-none"
      >
        <option value="">None</option>
        {tracks.map((track) => (
          <option key={track.uri} value={track.uri}>
            &quot;{track.title}&quot; — {track.artist}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * Background Music Settings (Toggle + Per-phase Song Dropdowns)
 */
function BackgroundMusicSettings({
  tracks,
  isLoadingTracks,
}: {
  tracks: PlayerFMTrack[];
  isLoadingTracks: boolean;
}) {
  const { settings, updateMusic } = useSettings();

  return (
    <div className="space-y-3">
      <Toggle
        checked={settings.music.enabled}
        onChange={(checked) => updateMusic({ enabled: checked })}
        label="Music (from your plyr.fm likes)"
      />
      {settings.music.enabled && (
        <div className="pl-4 space-y-2">
          {tracks.length === 0 && !isLoadingTracks ? (
            <p className="text-[var(--memphis-text-muted)] text-sm">Likes from plyr.fm will appear here</p>
          ) : (
            <>
              <PhaseTrackSelect label="Beginning" phase="beginning" tracks={tracks} isLoadingTracks={isLoadingTracks} />
              <PhaseTrackSelect label="Middle" phase="middle" tracks={tracks} isLoadingTracks={isLoadingTracks} />
              <PhaseTrackSelect label="End" phase="end" tracks={tracks} isLoadingTracks={isLoadingTracks} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Tutorial Toggle
 */
function TutorialSettings() {
  const { settings, updateTutorial } = useSettings();

  return (
    <Toggle
      checked={settings.tutorial}
      onChange={(checked) => updateTutorial(checked)}
      label="Tutorial cards"
    />
  );
}

/**
 * Premium Feed Settings — only renders for JKLB Premium users.
 * Post count stepper + freeform feed preference textarea.
 */
function PremiumFeedSettings() {
  const { isPremium } = usePremium();
  const { settings, updateAwardSettings } = useSettings();
  const [editingCount, setEditingCount] = useState<string | null>(null);
  const [preference, setPreference] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('jklb-feed-preference');
    if (saved) setPreference(saved);
  }, []);

  if (!isPremium) return null;

  const handlePreferenceChange = (value: string) => {
    setPreference(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      localStorage.setItem('jklb-feed-preference', value);
    }, 500);
  };

  return (
    <div className="pt-4 border-t border-[var(--memphis-border)] space-y-4">
      <h3 className="text-sm font-bold tracking-wider uppercase text-[var(--memphis-pink)]">
        JKLB Premium
      </h3>

      {/* Post count stepper */}
      <div>
        <label className="block text-[var(--memphis-text-muted)] text-xs mb-2">
          Posts before exit prompt
        </label>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              const val = settings.credibleExit.postsBeforePrompt - 5;
              if (val >= 5) updateAwardSettings({ postsBeforePrompt: val });
            }}
            className="w-8 h-8 flex items-center justify-center rounded bg-[var(--memphis-bg)] border border-[var(--memphis-border)] text-[var(--memphis-text)] hover:border-[var(--memphis-cyan)] transition-colors"
          >
            -
          </button>
          <input
            type="number"
            min={5}
            max={100}
            step={5}
            value={editingCount ?? settings.credibleExit.postsBeforePrompt}
            onFocus={(e) => setEditingCount(e.target.value)}
            onChange={(e) => {
              setEditingCount(e.target.value);
              const val = parseInt(e.target.value, 10);
              if (!isNaN(val) && val >= 5 && val <= 100) {
                updateAwardSettings({ postsBeforePrompt: val });
              }
            }}
            onBlur={() => {
              const val = parseInt(editingCount ?? '', 10);
              if (!isNaN(val)) {
                updateAwardSettings({ postsBeforePrompt: Math.max(5, Math.min(100, val)) });
              }
              setEditingCount(null);
            }}
            className="text-2xl font-bold text-[var(--memphis-text)] w-16 text-center bg-transparent border-b border-[var(--memphis-border)] focus:border-[var(--memphis-cyan)] outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <button
            type="button"
            onClick={() => {
              const val = settings.credibleExit.postsBeforePrompt + 5;
              if (val <= 100) updateAwardSettings({ postsBeforePrompt: val });
            }}
            className="w-8 h-8 flex items-center justify-center rounded bg-[var(--memphis-bg)] border border-[var(--memphis-border)] text-[var(--memphis-text)] hover:border-[var(--memphis-cyan)] transition-colors"
          >
            +
          </button>
        </div>
      </div>

      {/* Feed preference textarea */}
      <div>
        <label className="block text-[var(--memphis-text-muted)] text-xs mb-2">
          What do you want to see?
        </label>
        <textarea
          value={preference}
          onChange={(e) => handlePreferenceChange(e.target.value)}
          placeholder="e.g. 'no politics, no sports spoilers, show me tech and art posts'"
          rows={3}
          className="w-full bg-[var(--memphis-bg)] border border-[var(--memphis-border)] rounded px-3 py-2 text-sm text-[var(--memphis-text)] placeholder:text-[var(--memphis-text-muted)] focus:border-[var(--memphis-cyan)] focus:outline-none resize-none"
        />
      </div>
    </div>
  );
}

/**
 * SettingsPanel - Clean, minimal settings UI
 * Feed config (algorithm, post count) is on the Middle card.
 */
export function SettingsPanel({
  tracks = [],
  isLoadingTracks = false,
}: {
  tracks?: PlayerFMTrack[];
  isLoadingTracks?: boolean;
}) {
  return (
    <div className="space-y-6">
      {/* 1. Tutorial */}
      <TutorialSettings />

      {/* 2. Text Size */}
      <TextSizeSettings />

      {/* 3. Background Music */}
      <BackgroundMusicSettings tracks={tracks} isLoadingTracks={isLoadingTracks} />

      {/* 4. JKLB Premium (only renders for whitelisted users) */}
      <PremiumFeedSettings />
    </div>
  );
}
