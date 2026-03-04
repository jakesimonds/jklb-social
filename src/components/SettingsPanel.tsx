/**
 * SettingsPanel - Settings for russAbbot
 *
 * Feed config (algorithm, post count) lives on the Middle card.
 * NOTE: Spec (settings-modal.md) says only 3 settings (Tutorial, Text Size, Music).
 * Code currently has 6 — Award Nomination, Like Chorus, and Cover Photo are not in spec.
 */

import { useSettings } from '../lib/SettingsContext';
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
        value={settings.music[phase] ?? ''}
        onChange={(e) => {
          const val = e.target.value;
          updateMusic({ [phase]: val === '' ? null : val });
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
    </div>
  );
}
