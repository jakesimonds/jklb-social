# Spec: Settings Panel

Minimal. Three settings.

---

## Panel Behavior

- Opens via `s` hotkey or S button in right bar
- Renders as a panel overlay on the stage (stack model — see app-architecture.md)
- Closes via Escape, `s` toggle, or J/K (which pops and advances)
- Changes apply immediately (no "Save" button)
- Settings persist to localStorage

---

## Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| **Tutorial cards** | Toggle | ON | Show tutorial cards during Beginning flow |
| **Text Size** | Button group | Medium | Small / Medium / Large — scales post text |
| **Music (from your plyr.fm likes)** | Toggle + 3 Dropdowns | OFF | Per-phase track selection from user's plyr.fm likes |

That's it. Three settings.

### Music Detail

When the Music toggle is ON, three dropdowns appear — one per phase:

| Dropdown | Phase | Default |
|----------|-------|---------|
| **Beginning** | First act (notifications) | null (no track) |
| **Middle** | Second act (feed browsing) | null (no track) |
| **End** | Third act (reflection/share) | null (no track) |

Each dropdown is populated from the user's plyr.fm liked tracks. The app resolves the user's PDS to find their Player FM likes, then resolves each track into a playable URL.

---

## What Was Removed

These are no longer toggleable — they're always on or always off:

| Former Setting | New State | Rationale |
|----------------|-----------|-----------|
| Cover Photo | Always ON | Part of the design, not optional |
| Cover Photo Position | Removed | Single position, not configurable |
| Thread View Mode | Always Scroll | Single mode, no toggle needed |
| Credible Exit | Removed | E key always available, no toggle |
| Like Chorus Visible | Always ON | Chorus is core UI, not optional |

---

## Persistence

```typescript
interface MusicSettings {
  enabled: boolean;
  beginning: string | null;
  middle: string | null;
  end: string | null;
}

interface Settings {
  feed: FeedSettings;        // includes postTextSize
  credibleExit: CredibleExitSettings;
  llm: LLMSettings;
  music: MusicSettings;
  credibleExitEnabled: boolean;
  tutorial: boolean;
}
```

Only `tutorial`, `postTextSize` (inside `feed`), and `music` are exposed in the Settings panel UI. The other fields (`feed.algoFeed`, `credibleExit`, `llm`, etc.) are set programmatically elsewhere (e.g., Middle card dropdown, internal defaults).

Stored in localStorage under `russabbot-settings`.

**Migration:** When loading old settings format, ignore removed fields. Default new fields. The old `music.selectedTrackUri` field is migrated to per-phase fields once and then dropped.

---

## What's NOT in Settings

- Algorithm selection → Middle card dropdown
- Post count → Middle card slider
- Feed configuration → Middle card

---

## Technical Notes

- Implemented in `src/components/SettingsPanel.tsx`
- Settings context in `src/lib/SettingsContext.tsx`
- Types in `src/types/index.ts`

---

*This is the source of truth. If code disagrees with this doc, the code is wrong.*
