/**
 * HotkeysPanel - Hotkeys content for ContentPanel
 *
 * This is the content-only version of HotkeysModal, designed to be rendered
 * inside a ContentPanel instead of as an overlay modal.
 *
 * Displays hotkeys organized by category for quick reference.
 * When rendered, it's visible. No isOpen prop needed.
 */

interface HotkeyItem {
  key: string;
  description: string;
  wide?: boolean;
}

interface HotkeyCategory {
  name: string;
  hotkeys: HotkeyItem[];
}

const HOTKEY_CATEGORIES: HotkeyCategory[] = [
  {
    name: 'important',
    hotkeys: [
      { key: 'j / ↓', description: 'next' },
      { key: 'k / ↑', description: 'previous' },
      { key: 'l', description: 'like / unlike' },
      { key: 'b', description: 'boost / un-boost' },
      { key: 'v', description: 'view on bluesky (seriously! jklb.social is not and never will be feature complete. I use v to view on bluesky all the time!)', wide: true },
    ],
  },
  {
    name: 'less important',
    hotkeys: [
      { key: 'r', description: 'reply' },
      { key: 'q', description: 'quote post' },
      { key: 'e', description: 'jump to End section' },
      { key: '?', description: 'save post to clipboard' },
      { key: 'f', description: 'follow / unfollow author' },
      { key: 'o', description: 'open link' },
      { key: 'shift+o', description: 'cycle highlighted link' },
      { key: 'shift+j', description: 'focus quoted post' },
      { key: 'shift+k', description: 'back to main post' },
      { key: 't', description: 'toggle thread view' },
      { key: 's', description: 'settings' },
      { key: 'Space', description: 'this panel' },
      { key: ';', description: 'toggle video sound' },
      { key: 'c', description: 'toggle cover photo to front' },
      { key: 'Esc / ⌫', description: 'close / back' },
    ],
  },
];

/**
 * HotkeysPanel - Hotkeys content for ContentPanel
 * No modal wrapper, no overlay - just the content to render inside ContentPanel
 */
export function HotkeysPanel() {
  return (
    <div className="space-y-3">
      {HOTKEY_CATEGORIES.map((category) => (
        <div key={category.name}>
          <h3 className="text-sm font-semibold text-[var(--memphis-pink)] mb-1.5 lowercase">
            {category.name}
          </h3>
          <div className="grid grid-cols-2 gap-1.5">
            {category.hotkeys.map((hotkey) => (
              <div
                key={hotkey.key}
                className={`flex items-center gap-2${hotkey.wide ? ' col-span-2' : ''}`}
              >
                <kbd className="inline-flex items-center justify-center min-w-[2.5rem] px-2 py-0.5 bg-[var(--memphis-bg)] border border-[var(--memphis-border)] rounded-md text-xs font-mono text-[var(--memphis-cyan)] shadow-sm">
                  {hotkey.key}
                </kbd>
                <span className="text-sm text-[var(--memphis-text)]">
                  {hotkey.description}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Footer hint */}
      <div className="pt-2 border-t border-[var(--memphis-border)] text-center">
        <p className="text-xs text-[var(--memphis-text-muted)]">
          Press{' '}
          <kbd className="px-1 py-0.5 bg-[var(--memphis-bg)] border border-[var(--memphis-border)] rounded text-xs">
            Space
          </kbd>
          {' '}or{' '}
          <kbd className="px-1 py-0.5 bg-[var(--memphis-bg)] border border-[var(--memphis-border)] rounded text-xs">
            Esc
          </kbd>
          {' '}to close
        </p>
      </div>
    </div>
  );
}
