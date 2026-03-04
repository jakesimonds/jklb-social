# Spec: ATmosphere Report

The ATmosphere Report shows non-Bluesky activity from Like Chorus members' PDSes. It's a discovery mechanism for new ATProto lexicons and apps — you see what your people are building and using beyond Bluesky.

---

## When It Appears

- First screen in the End flow (before Liked Posts Grid → Share)
- Triggered by **E key** or auto-transition at 100% progress
- Press **j** to continue past it

---

## How It Works

The app scans Like Chorus members' PDSes directly, looking for any records created in the last 24 hours that are NOT standard Bluesky (`app.bsky.*`, `chat.bsky.*`). Everything else shows up.

### Scan Details

- **Trigger:** Automatic, once per session, after first post loads
- **Concurrency:** 5 members scanned in parallel per batch
- **Timeout:** 10 seconds per PDS request
- **Records per collection:** Max 50 (single page, no pagination)
- **Time window:** Last 24 hours
- **Results are incremental** — UI updates as each batch completes
- **Cached** — opening the report again is instant (no rescan)

### What Gets Filtered Out

- `app.bsky.*` — standard Bluesky records (posts, likes, follows, etc.)
- `chat.bsky.*` — Bluesky DMs
- Records without a valid `createdAt` timestamp
- Records outside the 24-hour window

### What Shows Up

Anything else — Atmosphere posts, WhiteWind blog entries, Tangled repos/issues, Grain photos, Psky posts, Plonk pastes, Leaflet documents, Web Tiles, or any custom/unknown lexicon.

---

## UI Layout

```
┌──────────────────────────────────────────────────────────────┐
│ ATmosphere Report   99 records in last 24h    press j to    │
│                                                continue     │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ▶ network.cosmik  83                                        │
│                                                              │
│  ▶ at.margin  5                                              │
│                                                              │
│  ▶ sh.tangled  4                                             │
│                                                              │
│  ▶ dev.npmx  2                                               │
│                                                              │
│  ▶ pub.leaflet  2                                            │
│                                                              │
│  ▶ com.minomobi  1                                           │
│                                                              │
│  ▶ io.zzstoatzz  1                                           │
│                                                              │
│  ▶ site.standard  1                                          │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Header

- **Title:** "ATmosphere Report" (monospace, cyan)
- **During scan:** "scanning X/Y members..."
- **After scan:** "N records in last 24h"
- **Navigation hint:** "press j to continue"

### Directory Groups

Records are grouped by "directory" — the first two dot-segments of the collection NSID:
- `blue.atmosphere.post` → **blue.atmosphere**
- `com.whtwnd.blog.entry` → **com.whtwnd**
- `sh.tangled.repo.commit` → **sh.tangled**

Groups sorted by record count (most populated first). Each group is a collapsible row with ▶ indicator and count.

### Expanded View

Click a directory group to expand. Records appear in a responsive grid (1–3 columns depending on viewport width), sorted newest first.

Each **PDSEventCard** shows:

| Element | Position | Details |
|---------|----------|---------|
| Lexicon badge | Top-left | Human-readable name (e.g., "Atmosphere Post"), cyan |
| Timestamp | Top-right | Relative format: "now", "5m", "2h", "3d" |
| Author handle | Second row | `@handle`, yellow |
| Collection NSID | Second row | Full NSID, monospace, muted |
| Record key | Below NSID | `rkey: {key}`, low contrast |
| Text preview | Body | Extracted from `.text`, `.title`, `.body`, `.content`, `.code`, `.name` — max 150-200 chars |
| "Open in [Client]" | Bottom | Links to native app (Atmosphere.blue, WhiteWind, Tangled, Plonk, etc.) or pdsls.dev as fallback |

---

## Settings

- `atmosphereEnabled` exists in `FeedSettings` (default: **false**)
- **Not currently exposed in Settings panel UI** — no toggle exists yet
- When the report has no results: "No recent non-Bluesky activity from chorus members"

---

## Keyboard

| Key | Action |
|-----|--------|
| **j** | Close report, advance to Liked Posts Grid |
| **Escape** | Same as j |
| **k** | Go back (if in end flow) |

---

## Error Handling

- Failed PDS requests return empty (don't crash the scan)
- Partial results are shown even if some members time out
- Errors logged to console, not user-facing

---

## Key Files

| File | Purpose |
|------|---------|
| `src/hooks/useAtmosphereReport.ts` | Scan logic, state machine |
| `src/components/AtmosphereReport.tsx` | Full-screen view, grouping |
| `src/components/PDSEventCard.tsx` | Individual record card |
| `src/lib/pds.ts` | PDS query utilities |

---

*This is the source of truth. If code disagrees with this doc, the code is wrong.*
