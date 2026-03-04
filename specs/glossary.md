# Glossary

Key terms used throughout the codebase and specs.

## Architecture

### The Chorus
The top bar and right sidebar. Contains JKLB buttons, Like Chorus avatars, PWD component, and action buttons. See app-architecture.md.

### The Stage
The center content area. Only ONE component is ever on stage at a time. See app-architecture.md.

### ViewState
The single source of truth for what's displayed. Has two levels: `stage` (position in serial flow) and `panel` (optional ephemeral overlay). See app-architecture.md.

### PWD
The component in the upper-right of the Chorus showing the current phase (Beginning / Middle / End) when logged in, or the login form when logged out.

### Like Chorus
Square avatar grid of users who recently interacted with you. Fills available space in top bar and right sidebar. See like-chorus.md.

> **Voice memo note:** Transcription software consistently renders "Like Chorus" as "Light Chorus." If you see "light chorus" or "Light Chorus" anywhere — specs, transcripts, task descriptions — it means **Like Chorus**. As in "I like you," not illumination.

### ATmosphere Report
Full-screen view in the End flow showing non-Bluesky activity from Like Chorus members' PDSes. Groups records by lexicon directory (e.g., `sh.tangled`, `blue.atmosphere`). A discovery mechanism for new ATProto apps and lexicons. See atmosphere-report.md.

### End Screen
(NOT YET IMPLEMENTED) Future replacement for the fixed End flow — a grid of plugin buttons. Each button can be as simple as a hyperlink or open its own modal. Built-in examples: stats, share a picture, nominate for JKLB award, log out. Third parties could build their own via a Claude Code skill. See end-screen.md.

## Three Acts

### Beginning
First act. Notification walkthrough: likes, boosts, followers, quote posts, replies, mentions. See beginning-flow.md.

### Middle
Second act. Feed browsing, one post at a time. See middle-flow.md.

### End
Third act. Reflection and sharing. Triggered by E key. See end-flow.md.

## Components

### PostCard
The main component for displaying a single post. Has three size variants via `size` prop: `sm` (small — likes/boosts, parent posts in replies), `md` (medium — future use), `lg` (large — default, feed browsing). Text is sacred — never truncated at any size.

### ProfileHover
Popup shown when hovering any profile picture anywhere in the app. Shows bio, handle, click-to-Bluesky. Never shows the profile picture again (you already see it).

### Tutorial Card
Instructional card that can appear anywhere in the serial flow. Placement determined by rules in `src/lib/tutorials.ts`. Toggled via Tutorial setting.

### Settings Panel
Panel overlay with three settings: Tutorial, Text Size, Background Music. See settings-modal.md.

### Thread View
Scrollable list view of all posts in a thread. Entered with `t` key. A fallback feature, not a priority.

### JKLB.social Account
Community Bluesky account owned by the app, not a person. Holds award nominations, community photos, and other ephemeral content. Users post to it through End Screen buttons. See jklb-account.md.

## Technical

### PDS
ATProtocol Personal Data Server. Where user data is stored. Can be bsky.social or any self-hosted server.

### Handle
User's ATProtocol identifier (e.g., alice.bsky.social). Used for authentication and display.

### DID
Permanent unique identifier for an ATProtocol user. Format: `did:plc:xxxxx`. Does not change even if handle changes.

### Agent
The `@atproto/api` BskyAgent instance used for all API calls.

---

*This is the source of truth. If code disagrees with this doc, the code is wrong.*
