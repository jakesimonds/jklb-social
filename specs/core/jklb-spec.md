# JKLB Specification v0.2

A keyboard-first, single-viewport client specification for any social feed.

## 0. Philosophy

JKLB is not just a Bluesky client. It's a way to consume **any feed of human activity** — social media, fitness tracking, code activity, community forums — through a structured, mindful, keyboard-driven experience.

If a platform has a feed of things that can be turned into cards, and those cards can be liked or acted on, it can be JKLB. Strava activities, GitHub events, Slack messages, Mastodon statuses, Bluesky posts, Farcaster casts — the card is the universal unit. You wrap the network's native content in a card, and the JKLB UX does the rest: one thing at a time, keyboard navigation, big profile pictures, no engagement counts, no infinite scroll.

The goal is to give users **agency** over how they consume social experiences: customization, keybindings to make interaction effortless, and large profile photos and cover images to give context — so it's not just a post in a feed competing for attention, it's highlighted, and you know who made it because you can see their face.

### Lazy Fetching Opportunity

Because JKLB shows one post at a time, you have a natural advantage: **the human is slow**. The heuristic is simple — once something is in front of the human's face and they're reading it, that's your cue to do expensive work. Fetch the next post's media. Resolve link previews. Warm up avatar caches. You know what's coming next in the queue, so start loading it while the human is occupied with what's on screen now.

Implementations should treat "human is reading" as the trigger for background work, not "app is idle." The moment a post lands on stage, start fetching anything the next few posts will need. The serial display model makes this particularly easy — there's no ambiguity about what's next. Within the limits of a pure static client, there's real room to make things feel instant by front-loading work behind the scenes.

### LLM Integration — Current and Future

**Current state (v0.2):** The only LLM-related feature is the `?` key, which copies the current post to the clipboard in a format suitable for pasting into an LLM conversation (see section 6.6). There is no built-in LLM processing, no API calls to language models, and no AI-driven curation. The `?` key is a clipboard operation, nothing more.

**Future direction (not yet in reference implementation — do not build):** A future version will support LLM-powered feed curation for whitelisted users. The flow: given ~500 eligible posts and a natural language instruction from the user (e.g., "show me posts about distributed systems" or "find the funniest takes from today"), an LLM curates a subset (e.g., 50 posts, or however many the user requests) and presents those as the feed. This turns JKLB from "browse everything" into "browse what matters to you, as defined by you in plain language."

This feature does not exist yet and should not be built until the reference implementation ships it. However, implementations should not make architectural choices that would make this hard to add later — e.g., don't hardcode the assumption that feed posts always come directly from the network adapter. The adapter's `fetchFeed()` returning a `JKLBPost[]` already provides the right seam: a future LLM layer would sit between the raw fetch and the UI, filtering/reordering the posts before they reach the stage.

### Visual Design

The easiest path for a new implementation is to copy the UI of the Bluesky reference client. But you don't have to. If you're a better designer, make it look better — the spec defines behavior and structure, not pixel-perfect layouts. As long as you follow the rules (single viewport, keyboard-first, one card at a time, no engagement counts, Memphis aesthetic), the visual execution is yours.

---

## 1. Core Principles

These are non-negotiable. Every JKLB implementation must follow all of them.

### 1.1 Single Viewport, No Scrolling

Everything fits on one screen. The stage does not scroll. Content is displayed in a fixed layout.

**Exception:** Settings panel content may scroll internally on very narrow viewports.

### 1.2 Keyboard-First

All primary actions are accessible via single-key hotkeys. Mouse/touch works as a fallback, but keyboard is the intended interaction mode.

### 1.3 One Post at a Time

The main content area (the Stage) shows exactly one post at a time. No infinite scroll, no multi-post views. The user sees one thing, acts on it, moves on.

### 1.4 Text Is Sacred

Post text is never truncated. Full text is always shown. If the post is too long, reduce font size — do not cut text.

### 1.5 No Engagement Counts

No like counts, repost counts, or reply counts displayed on posts. This is a deliberate design choice for mindful consumption.

### 1.6 Pure Client Architecture

No backend server. The app is a static site that communicates directly with the network's API. Deployable to any static hosting (Cloudflare Pages, Netlify, GitHub Pages, etc.).

### 1.7 Free to Run

A JKLB implementation should cost nothing to host. The reference implementation runs entirely on Cloudflare's free tier — static site on Cloudflare Pages, plus a simple Cloudflare Worker for the one feature that needs server-side logic (the JKLB Award post). If your implementation requires paid infrastructure, indexes, databases, or anything beyond what a free Cloudflare Worker can handle, that's a red flag. Simplify the design.

### 1.8 Memphis Aesthetic

Bold 90s design language. The signature palette:
- Hot pink: `#e91e63`
- Cyan: `#00bcd4`
- Yellow: `#ffeb3b`
- Dark navy background: `#1a1a2e`

Implementations may adjust accent colors but must maintain the dark background + bold accent structure.

---

## 2. Network Requirements

For a social network to support a JKLB implementation, it must provide:

### 2.1 Required

| Capability | Description |
|-----------|-------------|
| **Posts** | Text content with optional media (images, video, links) |
| **Authentication** | A way for users to log in and establish a session (OAuth redirect, API key, signer key, etc.) |
| **Feed** | A way to fetch a serial sequence of posts. Chronological, algorithmic, or any other ordering. |
| **Post Actions** | Ability to like/favorite and boost/repost posts |
| **Escape Hatch** | A native app or website the user can be linked to. Every clickable entity (posts, profiles, mentions, hashtags) should be able to link back to the source platform. This is non-negotiable. |

### 2.2 Nice to Have

| Capability | Description | Used For |
|-----------|-------------|----------|
| Reply | Ability to post replies to existing posts | R key action, composer |
| Profile pictures (avatars) | User profile images | Chorus, post display, profile hover |
| Profile bios | User description text | Profile hover popup |
| Cover photos / banners | User header images | Post background display |
| Notifications | Inbound interaction feed (likes, replies, follows, etc.) | Beginning flow, Chorus population |
| Multiple feeds | More than one feed option | Middle card feed selector |
| Threads | Fetching parent/child posts in a conversation | Thread view (T key) |
| Quote posts | Embedding one post inside another | Quote display, Q key action |
| Follow/Unfollow | Managing social graph | F key action |
| Mentions | Inline @-mentions of users in post text | Colored mention rendering, clickable escape hatch |
| Hashtags | Inline #-tags in post text | Colored hashtag rendering, clickable escape hatch |

---

## 3. UI Structure

### 3.1 Two Zones

The app has exactly two visual zones:

**The Chorus** — the top bar and right sidebar. Contains:
- **JKLB buttons** (top-left): 4 square cells, always present. Functional nav buttons that double as the logo.
- **Chorus avatars** (top bar + right bar): square profile pics of recent interactors. See section 7.
- **PWD component** (top-right): shows current phase or login form.
- **Action buttons** (right bar, bottom): O, Space, S as square cells. Plus a plain "log out" button.

**The Stage** (center) — the main content area. Only ONE component is ever on stage. The entire app flow is a serial sequence of single components appearing on stage, one at a time.

Stage constraints:
- Max-width: 600px (900px on wide viewports)
- Vertically centered
- No scroll

### 3.2 Grid Structure

```css
grid-template-rows: 96px 1fr;
grid-template-columns: 1fr 96px;
grid-template-areas:
  "top-bar top-bar"
  "stage   right-bar";
```

### 3.3 Responsive Degradation

As viewport narrows, elements drop in order:
1. Chorus avatars disappear first
2. Right bar collapses
3. JKLB buttons hide
4. PWD + login form persist last

---

## 4. The Three Acts

The session has structure. Implementations must support the Middle act. Beginning and End are optional but encouraged (Tier 3).

### 4.1 Beginning — "What happened while you were away" (Optional)

**Requires:** Notifications API from the network.

The Beginning flow shows the user what happened while they were away. At minimum, this means showing notification profile pictures. At maximum, it's a full serial walkthrough of each notification category, one at a time on stage (as the Bluesky reference implementation does).

**Notification categories (when available):**

| Category | What It Shows | Network Requirement |
|----------|--------------|-------------------|
| Likes | Your posts that were liked, with liker avatars | Notification: like |
| Boosts | Your posts that were boosted, with booster avatars | Notification: repost |
| New Followers | Profile cards for new followers | Notification: follow |
| Quote Posts | Posts that quoted your content | Notification: quote |
| Replies | Posts that replied to your content | Notification: reply |
| Mentions | Posts that @-mentioned you | Notification: mention |

Rules:
- Empty categories are silently skipped
- J/K navigate within and between categories
- Chorus starts empty; avatars populate as the user progresses through notifications
- Implementations have flexibility in how notifications are presented — the key requirement is that the user sees who interacted with them before they start browsing the feed

### 4.2 Middle — "Browse your feed" (Required)

The core experience. One post at a time on stage.

**Entry:** Middle card (transition screen) with:
- Feed/algorithm selection dropdown (if network supports multiple feeds)
- Post count slider: 5-100
- J to start

**During feed:**
- All keybindings active (see section 6)
- E key triggers End flow (or ends session if End not implemented)
- Progress bar showing posts seen / total

**Reply filtering:**
- Posts that are replies are filtered out of the feed. This is absolute — no exceptions. Reply filtering is client-side (the adapter returns all posts, the client drops replies).
- To see replies to a post, the user presses T for thread view.

### 4.3 End — "Menu and reflect" (Optional)

A grid menu of action buttons appears when the user finishes their feed (presses E) or reaches the end of their post count. Each button is a self-contained plugin.

**Required buttons (every implementation):**
| Button | What It Does |
|--------|-------------|
| Another Session | Reset to Beginning (or Middle if Beginning not implemented) |
| Log Out | End session, clear auth |

**Optional buttons (encouraged):**
| Button | What It Does |
|--------|-------------|
| JKLB Award Nomination | Pick favorite post from liked posts, share it |
| Stats | Session numbers: posts seen, likes, boosts, etc. |
| Custom / User-defined | Any self-contained action — can be as simple as opening a link |

The End grid is a plugin system. Implementations can add their own buttons. A button can be:
- A link (opens URL in new tab)
- A sub-flow (navigates to a new stage view, e.g., liked posts picker)
- An instant action (copy to clipboard, restart, log out)

Future spec versions may define a formal plugin interface for user-created End buttons.

---

## 5. Tutorial

JKLB includes an inline tutorial system. Tutorial cards are interspersed into the experience at natural points — they appear on stage just like posts do, explaining what the user can do at that moment (e.g., "press j to go to the next post" before the first post, "press l to like" when actions become available).

- **On by default** for new users
- **Togglable off** in settings (S key → Tutorial → Off)
- Tutorial cards are regular stage items — j/k navigates past them like any other card
- The tutorial should teach by doing, not by lecturing — brief, contextual hints at the moment they're relevant

The reference implementation's tutorial is still being iterated on. When it stabilizes, this section will include the specific card sequence and content guidelines.

---

## 6. Keybindings

All keybindings are registered centrally. No component-level key handlers. The handler reads the current view state to determine which keys are active.

### 6.1 Key Display Convention

When keys are shown to users:
- Always lowercase
- Color per key: `j` = pink, `k` = cyan, `l` = pink, `b` = yellow, others alternate

### 6.2 Always Active

| Key | Action |
|-----|--------|
| `j` / down | Next in flow (pops panel first if open) |
| `k` / up | Previous in flow (pops panel first if open) |
| `Space` | Toggle hotkeys reference panel |
| `s` | Toggle settings panel |
| `Esc` / `Backspace` | Close panel, exit fullscreen, exit thread view |

### 6.3 Post Actions (Middle, and actionable Beginning items)

| Key | Action | Adapter Method |
|-----|--------|---------------|
| `l` | Like / Unlike | `toggleLike(postId)` |
| `b` | Boost / Un-boost | `toggleBoost(postId)` |
| `r` | Reply (opens composer) | `reply(postId, text)` |
| `q` | Quote post (opens composer) | `quotePost(postId, text)` |
| `f` | Follow / Unfollow author | `toggleFollow(authorId)` |
| `o` | Open first link in post | (client-side, no adapter call) |
| `v` | View post on native platform (escape hatch) | (client-side, opens URL) |
| `t` | Toggle thread view | `fetchThread(postId)` |
| `e` | Jump to ending | (client-side, triggers End flow) |
| `?` | Save post to clipboard for LLM context | (client-side, see 6.6) |
| `c` | Toggle cover photo z-index | (client-side) |
| `;` | Toggle video sound (mute/unmute) | (client-side) |
| `Enter` | Open fullscreen media viewer | (client-side, see 6.7) |

### 6.4 Shift Modifiers

Shift = "go deeper into the current post":
| Key | Action |
|-----|--------|
| `Shift+o` | Cycle highlighted link (when post has multiple links) |
| `Shift+j` | Focus quoted post (actions target the quote) |
| `Shift+k` | Unfocus quoted post (actions target parent again) |

### 6.5 Panel Stack Model

Panels (settings, hotkeys, composer) are pushed onto a stack on top of the current stage position:
- **Action key while panel open:** Panel closes, action does NOT execute. User must press again.
- **J/K while panel open:** Pop panel, then navigate.
- **Escape while panel open:** Pop panel, stay at current position.

### 6.6 The `?` Key — LLM Context

The `?` key copies the current post to the clipboard in a format suitable for pasting into an LLM conversation. The format should include:
- The post text
- Author handle
- A note that this came from JKLB on [network name]
- The native URL for the post

Implementations should make the prompt template user-configurable (e.g., in settings), since different users will want to ask the LLM different things. The default might be something like: "Here's a post from [network] I'd like to discuss: [post text] — by @[handle] ([url])".

### 6.7 Fullscreen Media

When a post has media (images or video), pressing `Enter` opens a fullscreen overlay:
- **Images:** Fill the viewport. If the post has multiple images, left/right arrow keys navigate between them. A counter shows position (e.g., "2 / 4").
- **Video:** Fill the viewport. Playback continues from current position. `;` toggles sound.
- **Escape:** Close fullscreen, return to post view.

### 6.8 Video Behavior

- Videos autoplay muted when they appear on stage.
- `;` toggles sound on/off.
- Enter opens fullscreen video.
- Videos pause when navigating away from the post (j/k).

---

## 7. The Chorus (Encouraged)

**Requires:** Notifications API or some way to identify recent interactors.

The Chorus is the community presence indicator — square avatar tiles of people who recently interacted with you. It fills available space in the top bar and right sidebar.

### 7.1 Layout
- 72x72px square tiles with slight rounding
- Capacity calculated dynamically (ResizeObserver)
- Overflow from top bar flows to right bar
- Never scrolls — renders exactly as many avatars as fit

### 7.2 Hover Behavior
Hovering any avatar shows a popup with: display name, handle, bio. Click opens their profile on the native platform. The popup does NOT show the profile picture again (you already see it).

### 7.3 Progressive Fill (Beginning only)
If Beginning flow is implemented, the Chorus starts empty and fills as the user navigates through notification categories. Avatars animate from their stage position to the next open chorus slot.

---

## 8. Post Display

### 8.1 PostCard Structure

The universal post component:
- Left: Author avatar (with hover popup)
- Header: Author name, timestamp, action button hints, nav arrows
- Body: Full post text (never truncated)
- Media: images (grid), video (inline), link previews
- Quoted post: inline, recursive
- Cover photo: author banner behind the post (if available)
- Focus indicator: pink border when selected

### 8.2 Size Variants

| Size | Usage |
|------|-------|
| `sm` | Inside notification cards (Beginning), parent posts in reply context |
| `md` | Reserved for future use |
| `lg` | Feed browsing (Middle), actionable notifications |

### 8.3 Media Display

| Type | Behavior |
|------|----------|
| Images | Grid layout, constrained to viewport height |
| Video | Inline playback, `;` toggles sound |
| Link previews | Card with thumbnail, title, description |
| GIFs | Treated as media, auto-play |

### 8.4 Embeds Priority

When a post has multiple embed types:
1. Media (images/video) takes priority over link previews
2. Quoted post displays inline below media
3. Link preview only shows if no media is present

---

## 9. The Adapter Interface

See [adapter.ts](./adapter.ts) for the full TypeScript interface.

The adapter is the only file an implementor needs to write to port JKLB to a new network. It abstracts all network-specific API calls behind a uniform interface.

### 9.1 Core Contract

Every adapter must implement:
- `startLogin()` / `resumeSession()` / `logout()` — authentication (supports redirect-based OAuth and non-redirect flows)
- `fetchFeed()` — get a page of posts (adapter returns `JKLBPost` objects; how it transforms from native format is internal)
- `toggleLike()` / `toggleBoost()` — basic write actions
- `reply()` / `quotePost()` — content creation (if capabilities allow)
- `getPostUrl()` / `getProfileUrl()` — escape hatch URL generation (V key, mention clicks, avatar clicks)

### 9.2 Optional Capabilities

Adapters declare what they support via a `capabilities` object:
- `notifications` — enables Beginning flow
- `multipleFeeds` — enables feed selector on Middle card
- `threads` — enables T key / thread view
- `quotePosts` — enables Q key / quote display
- `follow` — enables F key
- `coverPhotos` — enables author banners on posts
- `reply` — enables R key / composer
- `mentions` — enables colored, clickable @-mention rendering
- `hashtags` — enables colored, clickable #-hashtag rendering

The UI adapts based on declared capabilities. Missing capabilities gracefully degrade — buttons hide, features skip.

### 9.3 Persistence Boundary

- **The adapter owns all network-specific persistence** (tokens, sessions, credentials).
- **The client owns UI persistence** (settings, session stats, seen-post cursors).
- The adapter must not depend on the client for storage, and vice versa.

---

## 10. Settings

Minimal, opinionated settings. Accessible via S key.

| Setting | Options | Default |
|---------|---------|---------|
| Tutorial | On / Off | On (first session) |
| Text Size | Small / Medium / Large | Small |
| Background Music | On / Off | Off |
| LLM Prompt Template | Free text | (see 5.6) |

Settings persist in localStorage under a namespace keyed to the implementation (e.g., `jklb_bluesky_`, `jklb_farcaster_`).

### 10.1 Background Music (Optional)

Implementations may include per-phase background music (different tracks for Beginning, Middle, End). The AT Protocol reference implementation uses plyr.fm for this. Any implementation that wants music can use plyr.fm as well — it works across networks since it's independent of the social platform.

Music pauses automatically when the user plays a video (`;` to unmute), and resumes when they navigate away.

### 10.2 Action Feedback

When a user performs an action (like, boost, reply, follow), the UI must provide feedback that the action succeeded or failed.

**On web (desktop):** The recommended approach is visual state change on the action icon (e.g., a heart icon fills in with color when liked). A brief toast notification (a small message that appears and fades) is optional but not required.

**On mobile:** Toasts or equivalent feedback are more important because the swipe gesture doesn't have a persistent icon to change state on. See section 13 (Mobile).

---

## 11. Deployment

JKLB implementations are static sites. No backend required. The reference implementation runs entirely on Cloudflare's free tier and that's the bar — if it's not free to host, simplify until it is.

Recommended hosting:
- **Cloudflare Pages** (reference choice — free tier is generous)
- Netlify
- GitHub Pages
- Vercel

The build output is a `dist/` directory with HTML, CSS, JS, and assets.

### 11.1 CORS Considerations

Some networks don't allow direct browser-to-API requests (CORS restrictions). In these cases, a lightweight CORS proxy may be necessary. This is an acknowledged reality — the "pure client" principle means no application-specific backend logic, but a transparent pass-through proxy is acceptable when the network's API doesn't support browser CORS.

When a proxy is needed, keep it as thin as possible (a Cloudflare Worker or similar that adds CORS headers and passes requests through). The proxy should not contain business logic.

---

## 12. ViewState Model

The app's view is controlled by a single state object:

```typescript
interface ViewState {
  stage: StageView;         // Current position in the serial flow
  panel: PanelView | null;  // Optional ephemeral overlay
}
```

### 12.1 Stage Types

```typescript
type StageView =
  // Beginning (optional — requires notifications capability)
  | { type: 'tutorial'; id: string }
  | { type: 'unactionable'; index: number }  // likes & boosts
  | { type: 'follower'; index: number }
  | { type: 'reply-to-user'; index: number }
  | { type: 'mention'; index: number }
  | { type: 'quote-post'; index: number }
  // Middle (required)
  | { type: 'middle-card' }
  | { type: 'post'; index: number }
  | { type: 'thread'; postIndex: number }
  // End (optional)
  | { type: 'end-grid' }
```

### 12.2 Panel Types

```typescript
type PanelView =
  | { type: 'settings' }
  | { type: 'hotkeys' }
  | { type: 'composer-reply'; targetPost: PostReference }
  | { type: 'composer-quote'; targetPost: PostReference }
```

### 12.3 Rendering Rule

```typescript
if (viewState.panel) {
  renderPanel(viewState.panel);
} else {
  renderStage(viewState.stage);
}
```

One component on stage, always. Flat switch on type. No nested conditionals.

---

## 13. Mobile (Optional)

JKLB is desktop-first, but a mobile implementation is a valid subset of the experience. The mobile app maps the four cardinal swipe directions to core actions:

| Gesture | Action |
|---------|--------|
| Swipe right | Next post (equivalent to `j`) |
| Swipe left | Previous post (equivalent to `k`) |
| Swipe up | Boost / Repost (equivalent to `b`) |
| Swipe down | Reply or Quote (opens composer, equivalent to `r`) |

Like is handled by tap (equivalent to `l`).

The mobile experience is a subset — no Chorus, no Beginning/End flows, no thread view. Just the feed, one card at a time, with swipe actions.

**Feedback is critical on mobile.** Since there are no persistent icons showing state, toast notifications (brief popup messages like "Liked!" or "Boosted!") must appear after every action so the user knows what happened.

---

## 14. Testing & Building a New Implementation

This section is for people (and LLMs) building a new JKLB implementation. It describes the recommended workflow and the testing layers.

### 14.1 Recommended Build Workflow

**Step 1: Get real data.** Before writing any UI code, collect 20+ real posts from your network's API that cover as many content types as possible: text-only, single image, multi-image gallery, video, link preview, quoted post, post with mentions, post with hashtags, long text, short text, posts with cover photos. Save these as fixture data (JSON). This is the most important step.

**Step 2: Make it look good.** Wire up the fixture data to your UI. Don't worry about auth or live API calls yet. Get the cards rendering correctly for every content type in your fixtures. This is where a human eye matters — does the text look right? Do images fill the space? Is the Memphis aesthetic working?

**Step 3: Wire up the adapter.** Implement `fetchFeed()` against the live API. Then auth (`startLogin()` / `resumeSession()`). Then write actions (`toggleLike()`, `toggleBoost()`). Test each one.

**Step 4: Run compliance checks.** Use the test layers below to verify your implementation follows the spec.

### 14.2 Testing Layers

#### Layer 1: Adapter Validation (unit tests)

Test that your adapter produces valid `JKLBPost` objects from raw network data. This is the fastest to build and the most useful for catching bugs early.

```typescript
// validateJKLBPost — checks structural correctness of adapter output
function validateJKLBPost(post: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const p = post as Record<string, unknown>;

  if (typeof p.id !== "string" || p.id === "")
    errors.push("id must be a non-empty string");
  if (typeof p.text !== "string")
    errors.push("text must be a string");
  if (typeof p.createdAt !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(p.createdAt))
    errors.push("createdAt must be ISO 8601 format");
  if (typeof p.nativeUrl !== "string" || !p.nativeUrl.startsWith("http"))
    errors.push("nativeUrl must be a valid URL (escape hatch)");
  if (typeof p.isLiked !== "boolean")
    errors.push("isLiked must be a boolean");
  if (typeof p.isBoosted !== "boolean")
    errors.push("isBoosted must be a boolean");

  // Author validation
  const author = p.author as Record<string, unknown> | undefined;
  if (!author || typeof author !== "object") {
    errors.push("author must be an object");
  } else {
    if (typeof author.id !== "string") errors.push("author.id must be a string");
    if (typeof author.handle !== "string") errors.push("author.handle must be a string");
    if (typeof author.displayName !== "string") errors.push("author.displayName must be a string");
    if (typeof author.profileUrl !== "string" || !(author.profileUrl as string).startsWith("http"))
      errors.push("author.profileUrl must be a valid URL (escape hatch)");
  }

  // Link facets validation
  if (Array.isArray(p.linkFacets)) {
    (p.linkFacets as Record<string, unknown>[]).forEach((f, i) => {
      if (typeof f.uri !== "string") errors.push(`linkFacets[${i}].uri must be a string`);
      if (typeof f.byteStart !== "number") errors.push(`linkFacets[${i}].byteStart must be a number`);
      if (typeof f.byteEnd !== "number") errors.push(`linkFacets[${i}].byteEnd must be a number`);
    });
  }

  return { valid: errors.length === 0, errors };
}
```

Use this against your fixture data:

```typescript
import fixtures from "./fixtures.json";

for (const raw of fixtures) {
  const post = adapter.transform(raw);
  const result = validateJKLBPost(post);
  if (!result.valid) {
    console.error("Invalid post:", result.errors, raw);
  }
}
```

#### Layer 2: Behavioral Tests (Playwright)

Test the JKLB experience itself — keyboard navigation, panel behavior, media. These run against your app in a browser.

```typescript
import { test, expect } from "@playwright/test";

test("j key advances to next post", async ({ page }) => {
  await page.goto("/");
  // Wait for feed to load (fixture or live data)
  await page.waitForSelector("[data-testid='post-card']");
  const firstPost = await page.locator("[data-testid='post-card']").textContent();
  await page.keyboard.press("j");
  const secondPost = await page.locator("[data-testid='post-card']").textContent();
  expect(secondPost).not.toBe(firstPost);
});

test("escape closes settings panel", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("s");
  await expect(page.locator("[data-testid='settings-panel']")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-testid='settings-panel']")).not.toBeVisible();
});

test("j key closes panel before navigating", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("s"); // open settings
  await expect(page.locator("[data-testid='settings-panel']")).toBeVisible();
  await page.keyboard.press("j"); // should close settings first
  await expect(page.locator("[data-testid='settings-panel']")).not.toBeVisible();
});

test("v key opens native platform URL", async ({ page, context }) => {
  await page.goto("/");
  await page.waitForSelector("[data-testid='post-card']");
  const [newPage] = await Promise.all([
    context.waitForEvent("page"),
    page.keyboard.press("v"),
  ]);
  expect(newPage.url()).toContain("http");
});
```

#### Layer 3: Compliance Tests

These verify the spec's non-negotiable rules. Run them against your deployed app or localhost.

```typescript
test("single viewport - no scrolling", async ({ page }) => {
  await page.goto("/");
  const scrollable = await page.evaluate(() =>
    document.documentElement.scrollHeight > window.innerHeight
  );
  expect(scrollable).toBe(false);
});

test("no engagement counts visible", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector("[data-testid='post-card']");
  // Check that no element shows like/repost/reply counts
  const text = await page.locator("[data-testid='post-card']").textContent();
  expect(text).not.toMatch(/\d+\s*(likes?|reposts?|replies|boosts?)/i);
});

test("text is never truncated", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector("[data-testid='post-text']");
  const isTruncated = await page.evaluate(() => {
    const el = document.querySelector("[data-testid='post-text']");
    if (!el) return false;
    const style = window.getComputedStyle(el);
    return style.overflow === "hidden" && style.textOverflow === "ellipsis";
  });
  expect(isTruncated).toBe(false);
});

test("reply filtering - no replies in feed", async ({ page }) => {
  await page.goto("/");
  // Navigate through all posts, check none are replies
  let hasMore = true;
  while (hasMore) {
    const isReply = await page.evaluate(() => {
      const card = document.querySelector("[data-testid='post-card']");
      return card?.getAttribute("data-is-reply") === "true";
    });
    expect(isReply).toBe(false);
    await page.keyboard.press("j");
    // Detect end of feed (implementation-specific)
    hasMore = await page.evaluate(() =>
      !!document.querySelector("[data-testid='post-card']")
    );
  }
});
```

### 14.3 Fixture Data Best Practices

Your fixture dataset should cover at least these content types:

- Plain text post (short)
- Plain text post (long — tests font size reduction)
- Single image
- Multi-image gallery (2, 3, 4 images)
- Video post
- Post with link preview
- Post with quoted post
- Quoted post that itself has media
- Post with @-mentions (if network supports)
- Post with #-hashtags (if network supports)
- Post with multiple links
- Post by a user with a cover photo / banner
- Post by a user with no avatar (tests fallback)
- A repost/boost (tests repostBy field)

20+ posts minimum. The more edge cases you cover in fixtures, the fewer surprises in production.

---

## 15. LLM-Driven Implementation

This spec is designed to be handed to an LLM with a terse instruction like "make JKLB work for [network]." The LLM will do most of the work. The human provides creative direction, visual taste, and judgment calls.

### 15.1 What the LLM Should Do

- Implement the adapter interface for the target network
- Set up the project (React + Vite + Tailwind, or equivalent)
- Wire up auth, feed fetching, and write actions
- Collect fixture data from the network's API
- Write and run the test layers (adapter validation, behavioral, compliance)
- Handle CORS proxy setup if needed (thin Cloudflare Worker)

### 15.2 What the Human Should Do

- Choose the network and provide API access / credentials
- Review the visual design (does it look good? does the Memphis aesthetic work?)
- Pick default background music tracks (artistic choice)
- Review fixture data coverage (are the 20+ posts representative?)
- Make judgment calls on edge cases the LLM flags

### 15.3 When to Flag the Human

If you're an LLM building a JKLB implementation, **stop and ask the human** when:

- **Infrastructure costs money.** If the network's API requires a paid proxy, a database, a search index, or anything beyond a free Cloudflare Worker — flag it. The human needs to decide if the complexity is worth it. JKLB projects should be free to run.
- **CORS is blocked and the workaround is complex.** A thin pass-through proxy is fine. If you need to implement token exchange, request signing, or session management on the server side, that's getting too heavy — flag it.
- **The network's content doesn't map cleanly to cards.** If posts are deeply nested (like Reddit threads), or primarily non-text (like Instagram), or require complex rendering (like GitHub diffs), the human should decide how to simplify.
- **Auth requires secrets that can't live in a static site.** Some OAuth flows need a client secret. That means a server-side token exchange. The human should decide if a Cloudflare Worker for that is acceptable.
- **You're about to make a design choice that affects the user experience.** The spec defines behavior, but there are always gray areas. When in doubt, show the human two options and let them pick.
- **You're unsure about fixture data coverage.** The human knows the network's culture — what kinds of posts are common, what edge cases matter.

### 15.4 Hosting Under jklb.social

Official JKLB implementations can be hosted under the jklb.social domain (e.g., jklb.social/farcaster). To qualify:

- Must meet Tier 2 (Participant) or higher
- Must be a static site deployable to Cloudflare Pages
- Must not require paid infrastructure or complex backend services
- The maintainer (Jake) will only host additional static sites that stay within Cloudflare's free tier

If your implementation needs its own Cloudflare Worker (for a CORS proxy or similar), that's a conversation — reach out before building it.

---

## Appendix A: Data Model

The universal `JKLBPost` type that all adapters produce. See [adapter.ts](./adapter.ts) for the full definition.

Key fields:
- `id` — unique identifier (network-specific format, opaque string)
- `author` — display name, handle, avatar URL, optional banner URL, profile URL (escape hatch)
- `text` — plain text content (adapters must strip HTML, reconstruct mentions, etc.)
- `linkFacets` — extracted links with byte positions for rich text rendering
- `mentionFacets` — extracted @-mentions with user ID, display text, profile URL, and byte positions. Clicking opens the native platform profile (escape hatch). Optional.
- `hashtagFacets` — extracted #-hashtags with tag text, native platform URL, and byte positions. Clicking opens the native hashtag view (escape hatch). Optional.
- `media` — images, video, link previews
- `quotedPost` — optional embedded post (recursive)
- `replyParentId` — optional, indicates this is a reply (used for client-side reply filtering)
- `createdAt` — ISO 8601 timestamp (adapters must normalize to this)
- `isLiked` / `isBoosted` — current user's interaction state
- `nativeUrl` — full URL to view this post on its native platform (escape hatch)

---

*This specification is maintained by Jake Simonds. Version 0.2 — March 2026.*
