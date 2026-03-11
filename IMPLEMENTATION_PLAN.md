# Implementation Plan

Updated: 2026-03-08

> See `IMPLEMENTATION_HISTORY.md` for completed work (Phases 1-69).
> Reference: `specs/LLM-integration-research/IMPLEMENTATION_PLAN.md` for full LLM curation plan (Phase 2).

---

### JKLB Premium — Feature Flag + Frontend

---

- [x] TASK-PREMIUM-1: Add JKLB Premium flag and whitelist ✓

  **Complexity:** Trivial
  **File(s):** `src/lib/flags.ts`, new `src/hooks/usePremium.ts`

  **Context:** JKLB Premium is a whitelisted tier that changes the feed UX. For now, the whitelist is a static array of Bluesky handles checked client-side. The only whitelisted handle right now is `jakesimonds.com`. The test account `elevatorselfies.bsky.social` is intentionally NOT on the whitelist so Jake can verify both paths.

  In `src/lib/flags.ts`:
  - Add `JKLB_PREMIUM_HANDLES: string[]` with `['jakesimonds.com']`
  - Export `isJklbPremium(handle: string): boolean` that checks the array

  Create `src/hooks/usePremium.ts`:
  - Import `useAuth` from `../lib/AuthContext`
  - Import `isJklbPremium` from `../lib/flags`
  - Export `usePremium()` hook that returns `{ isPremium: boolean }`
  - Reads `profile?.handle` from auth context, returns `isJklbPremium(handle)` (false if not logged in)

  **Done when:** `npm run build` passes. Importing `usePremium()` in any component returns `true` for `jakesimonds.com` and `false` for any other handle.

---

- [x] TASK-PREMIUM-2: Add Premium settings section (post count + preference textarea) ✓

  **Complexity:** Low
  **File(s):** `src/components/SettingsPanel.tsx`
  **Depends on:** TASK-PREMIUM-1

  **Context:** Premium users get feed configuration inside Settings instead of on the Middle card. This section only renders when `usePremium().isPremium === true`. It has two controls: a post count input (same +/- stepper and number input currently on the Middle card) and a freeform textarea for "what do you want to see."

  In `src/components/SettingsPanel.tsx`:

  1. Import `usePremium` from `../hooks/usePremium`
  2. Create a `PremiumFeedSettings` component:
     - Use `usePremium()` — if not premium, return null
     - Use `useSettings()` for the post count (same `settings.credibleExit.postsBeforePrompt` and `updateAwardSettings` used by `MiddleControls` in SectionCard.tsx)
     - Render a post count stepper (reuse the same +/- button + number input pattern from `MiddleControls` in SectionCard.tsx — copy the JSX, don't extract a shared component)
     - Render a textarea with label "What do you want to see?"
     - Placeholder: "e.g. 'no politics, no sports spoilers, show me tech and art posts'"
     - Textarea value: load from `localStorage.getItem('jklb-feed-preference')` on mount
     - On change: debounce 500ms, then `localStorage.setItem('jklb-feed-preference', value)`
     - Use `useState` for the textarea value and `useEffect` for the debounced save
  3. Add the section to the `SettingsPanel` return, after Background Music:
     - Wrap in a section with a "JKLB Premium" heading styled with `var(--memphis-pink)` accent
     - Visually separate from the other settings with a border-top or extra spacing

  **Done when:** `npm run build` passes. When logged in as `jakesimonds.com` and opening settings, a "JKLB Premium" section appears with post count controls and a textarea. When logged in as any other handle, this section does not appear.

---

- [x] TASK-PREMIUM-3: Skip Middle SectionCard for Premium users ✓

  **Complexity:** Low
  **File(s):** `src/App.tsx`, `src/components/AppLayout.tsx`
  **Depends on:** TASK-PREMIUM-1

  **Context:** Premium users don't need the "Choose Your Algorithm" Middle card because their feed config lives in Settings. When a Premium user finishes Beginning, they should skip straight to the feed (or the actions tutorial if enabled). The algorithm for Premium users is hardcoded to chronological for now (this will be replaced by LLM curation later).

  In `src/App.tsx`:

  1. Import `usePremium` from `./hooks/usePremium`
  2. Call `const { isPremium } = usePremium()` at the top of the main component
  3. Find the `useEffect` that transitions from Beginning to Middle card (around line 448-453):
     ```
     useEffect(() => {
       if (beginningDone) {
         setStage({ type: 'middle-card' });
       }
     }, [beginningDone, setStage]);
     ```
     Change it so Premium users skip middle-card:
     ```
     useEffect(() => {
       if (beginningDone) {
         if (isPremium) {
           if (settings.tutorial && !showedActionsTutorial) {
             setStage({ type: 'tutorial', id: 'actions' });
           } else {
             setStage({ type: 'post', index: 0 });
           }
         } else {
           setStage({ type: 'middle-card' });
         }
       }
     }, [beginningDone, setStage, isPremium]);
     ```
  4. For Premium users, hardcode chronological feed (`algoFeed: null`) as default. Add an effect:
     ```
     useEffect(() => {
       if (isPremium && isAuthenticated) {
         updateFeed({ algoFeed: null });
       }
     }, [isPremium, isAuthenticated]);
     ```
  5. Handle k-key back navigation: if a Premium user is at post index 0 and presses k, they should go back to Beginning's last stage (not middle-card). Check the back-navigation logic (around line 639-643) and ensure it doesn't route Premium users to middle-card.

  **Done when:** `npm run build` passes. When logged in as `jakesimonds.com`: after Beginning completes, the feed starts immediately (no "Choose Your Algorithm" card). When logged in as any other handle: the Middle card still appears as before. Pressing k at first post goes back appropriately for both user types.

---

---

- [x] TASK-PLYR-1: Add plyr.fm button to End Screen grid ✓

  **Complexity:** Trivial
  **File(s):** `src/components/end/EndScreenGrid.tsx`, `src/App.tsx`

  **Context:** plyr.fm is a music service — if users like tracks there, those likes become available as background music in JKLB's settings. We want a button on the End Screen that sends users to plyr.fm so they can discover music for their next session. This follows the exact same pattern as the "Glitch a JPEG" button: an entry in the `END_BUTTONS` array + a `window.open` in the handler.

  In `src/components/end/EndScreenGrid.tsx`:
  - Replace the first empty slot (`{ id: 'empty1', ... }`) with:
    `{ id: 'plyr', title: 'Check out plyr.fm', description: 'listen to your plyr.fm likes while you scroll JKLB' }`

  In `src/App.tsx`:
  - In the `onSelectButton` handler (near the `glitch` case around line 754), add:
    ```
    if (id === 'plyr') {
      window.open('https://plyr.fm', '_blank');
      return;
    }
    ```

  **Done when:** `npm run build` passes. End Screen shows "Check out plyr.fm" button. Clicking it opens plyr.fm in a new tab. Description on hover reads "listen to your plyr.fm likes while you scroll JKLB".

---

---

- [x] TASK-COMPOSE-1: Add Unthread, Bluesky, and Leaflet buttons to Compose modal ✓

  **Complexity:** Trivial
  **File(s):** `src/components/compose/ComposeModal.tsx`

  **Context:** The Compose modal (`ComposeModal.tsx`) has a 3-column grid with the composer spanning all 3 columns on top, and 3 `PlaceholderSlot` components (the "+" dashed boxes) in the bottom row. Replace those 3 placeholders with linked buttons to external ATProto compose tools. These follow the same `EndButton` hover pattern (title visible, description on hover) but are simpler — just clickable cards that open URLs.

  In `src/components/compose/ComposeModal.tsx`:
  - Replace the 3 `<PlaceholderSlot />` components with 3 link buttons:
    1. Title: "Unthread" → hover: "longer posts gracefully handled" → opens `https://unthread.at/` in new tab
    2. Title: "Bluesky" → hover: "native composer" → opens `https://bsky.app/` in new tab
    3. Title: "Leaflet" → hover: "start a blog" → opens `https://leaflet.pub/` in new tab
  - Style each button as a card matching the existing dashed-border placeholder dimensions (`aspect-square`, same grid cell size)
  - Use the same hover reveal pattern as `EndButton`: title shows by default, fades to description on hover
  - Remove the `PlaceholderSlot` component since it's no longer used
  - Also fix spacing: the "Press Enter to post, Esc to cancel" keyboard hint in `ComposerPanel.tsx` is cramped against the bottom of the composer area. Add `mb-2` or `pb-2` to the hint (or add some bottom padding to the composer container in ComposeModal) so it doesn't butt up against the button row.

  **Done when:** `npm run build` passes. Compose modal (press `c`) shows Unthread, Bluesky, and Leaflet buttons in the bottom row. Each opens the correct URL in a new tab. Keyboard hint has breathing room above the button row.

---

---

### Cover Photo Expansion + Logout Button

---

- [x] TASK-COVER-1: Lift cover photo to app-layout level ✓

  **Complexity:** Medium
  **File(s):** `src/components/AppLayout.tsx`, `src/index.css`

  **Context:** The cover photo (author banner) currently renders inside `.content-area` as an absolutely-positioned div at z-0. We want it to extend behind the entire app — behind the chorus avatars, the buttons, everything. To do this, move the cover photo render from inside the content area to the `.app-layout` container itself.

  **Ralph Instructions:**
  1. In `AppLayout.tsx`, find where the cover photo background div renders inside the content area (around line 760-770 for posts, 719-729 for beginning flow). It's an absolutely-positioned div with `absolute inset-0` and `opacity-40` and `z-0`.
  2. Move this div so it renders as a direct child of the `.app-layout` container instead, positioned `absolute inset-0 z-0`. It should be the first child so it sits behind everything.
  3. The banner URL source stays the same — it comes from `useAuthorBanner` hook, keyed to the current post's author.
  4. Make sure the cover photo div uses `pointer-events-none` so it doesn't intercept clicks.
  5. Keep the same styling: `backgroundRepeat: 'repeat-y'`, `backgroundSize: '100% auto'`, `backgroundPosition: 'top left'`, `opacity: 0.4`.
  6. The `.app-layout` container needs `position: relative` (if it doesn't already have it) so the absolute positioning works.
  7. When there is no banner image (null/undefined), don't render the div at all — the solid navy background shows through as normal.
  8. The beginning flow also has cover photo rendering — apply the same treatment there.
  - Acceptance: `npm run build` passes. Cover photo is visible behind the entire viewport including where the chorus bars are, not just the content area.

---

- [x] TASK-COVER-2: Make perimeter bars transparent ✓

  **Complexity:** Low
  **File(s):** `src/index.css`, `src/components/AppLayout.tsx`
  **Depends on:** TASK-COVER-1

  **Context:** Now that the cover photo extends behind the full layout, make the chorus perimeter bars (top bar and right bar) transparent so the cover photo shows through. The avatars, buttons, jklb logo, PWD, and all other content stay exactly where they are — only the background fill changes.

  **Ralph Instructions:**
  1. In `src/index.css`, find `.perimeter-bar` (or equivalent) which sets `background-color: var(--memphis-bg)`. Change it to `background-color: transparent`.
  2. Remove or set to `none` any `box-shadow` on the perimeter bars.
  3. Keep the border lines between chorus and content (they provide visual structure).
  4. Test that when there is NO cover photo, the layout still looks good — the cover photo div won't render, so the app-layout's navy background shows through the transparent bars, which should look the same as before.
  5. If the transparent bars look too bare without a cover photo, add a fallback: only make bars transparent when a cover photo is active. Otherwise keep solid navy. Use a CSS class toggle or inline style based on whether bannerUrl exists.
  - Acceptance: `npm run build` passes. When viewing a post with a banner image, the cover photo is visible behind the chorus bars. When there's no banner, bars look normal (solid navy). Avatars, buttons, PWD all remain in their current positions and are fully usable.

---

- [x] TASK-COVER-3: Style logout as a proper button in the right bar ✓

  **Complexity:** Trivial
  **File(s):** `src/components/AppLayout.tsx`

  **Context:** Logout currently renders as a text label in a `PerimeterCell` at the bottom of the right bar. It should look like a proper button matching the style of the hotkeys (space) and settings (s) cells — bordered, clickable, same visual weight. No hotkey needed, just click.

  **Ralph Instructions:**
  1. In `AppLayout.tsx`, find the logout `PerimeterCell` in the right bar (around line 1091-1099). It currently shows text "log out" and calls `onQuit()`.
  2. Style it to match the hotkeys and settings buttons above it — same border treatment, same hover states. Look at how the `space` (hotkeys) and `s` (settings) PerimeterCells are styled and match that.
  3. Keep the text as "log out" or shorten to a recognizable icon/label that fits the 72×72 cell.
  4. No hotkey binding needed — click/tap only.
  - Acceptance: `npm run build` passes. Logout button in the right bar visually matches the hotkeys and settings buttons. Clicking it still logs the user out.

---

### Cover Photo Expansion — Phase 2 (Always-Transparent Perimeter)

---

- [x] TASK-COVER-4: Make perimeter bars always transparent (remove conditional) ✓

  **Complexity:** Trivial
  **File(s):** `src/components/AppLayout.tsx`, `src/index.css`
  **Depends on:** TASK-COVER-2

  **Context:** TASK-COVER-2 made the top bar and right bar transparent only when a cover photo (`activeBanner`) is active. The new requirement is that these bars should ALWAYS be transparent — regardless of whether a cover photo is showing. The solid navy `--memphis-bg` background behind the bars was the old look; now the app-layout phase background (navy gradient) shows through directly. This means the `.perimeter-transparent` conditional class is no longer needed.

  **Ralph Instructions:**
  1. In `src/components/AppLayout.tsx`, line 911: the top bar div currently has `${activeBanner ? ' perimeter-transparent' : ''}`. Remove this ternary and always apply the `perimeter-transparent` class (or just remove the `.perimeter-bar` background entirely).
  2. Same for line 1011: the right bar div has the same conditional. Make it unconditional.
  3. In `src/index.css`, simplify: merge the `.perimeter-bar.perimeter-transparent` rule into `.perimeter-bar` itself — set `background-color: transparent` and `box-shadow: none` directly on `.perimeter-bar`. Then delete the `.perimeter-transparent` rule since it's no longer needed.
  4. Verify the layout looks correct without a cover photo — the phase background (`getPhaseBackground(phase)`) on `.app-layout` should show through the transparent bars, giving the same navy look as before.
  - Acceptance: `npm run build` passes. Top bar and right bar are always transparent. No visual regression when browsing posts without cover photos (navy background still shows through). Cover photos still display correctly when present.

---

- [x] TASK-COVER-5: Make hotkey footer transparent ✓

  **Complexity:** Trivial
  **File(s):** `src/index.css`

  **Context:** The `.hotkey-footer` (fixed bottom bar with "feature requests/bug reports | blog | thank you for trying this!") has `background-color: rgba(26, 26, 46, 0.8)` — a semi-transparent dark navy. Now that perimeter bars are always transparent, this footer should match. Make it fully transparent so the app background and cover photos show through behind the footer text.

  **Ralph Instructions:**
  1. In `src/index.css`, find `.hotkey-footer` (around line 486). Change `background-color: rgba(26, 26, 46, 0.8)` to `background-color: transparent`.
  2. Keep the text color, font size, opacity, hover behavior, and z-index the same — only the background changes.
  3. The text should still be readable against both the navy phase background and cover photos (the existing `opacity: 0.4` and hover-to-`0.7` handles this).
  - Acceptance: `npm run build` passes. Footer text floats over the background with no dark bar behind it. Text is still readable. Hover still brightens it.

---

- [x] TASK-COVER-6: Lift tutorial grid to app-layout level (same as cover photo) ✓

  **Complexity:** Low
  **File(s):** `src/components/AppLayout.tsx`

  **Context:** When `viewState.stage.type === 'tutorial'`, the content area gets a CSS grid-line background (lines 1098-1101 in AppLayout.tsx). But it only covers the content area, not the perimeter bars — so with transparent bars the grid looks boxed-in. The fix is the same pattern used for cover photos: render the grid as an `absolute inset-0` layer on the `.app-layout` container so it bleeds through the entire viewport, behind the chorus bars and everything.

  **Ralph Instructions:**
  1. In `src/components/AppLayout.tsx`, find the content area div (around line 1096-1101). Remove the conditional `style` prop that applies the grid background:
     ```
     style={viewState.stage.type === 'tutorial' ? {
       backgroundImage: 'linear-gradient(var(--memphis-border) 1px, transparent 1px), linear-gradient(90deg, var(--memphis-border) 1px, transparent 1px)',
       backgroundSize: '24px 24px',
     } : undefined}
     ```
     The content area div should just be `<div className="area-content content-area">` with no style prop.
  2. Add a new full-viewport grid layer, right next to the existing cover photo layer (around line 898-909). It follows the same pattern — `absolute inset-0`, `pointer-events-none`, low z-index. Render it only when `viewState.stage.type === 'tutorial'`:
     ```
     {viewState.stage.type === 'tutorial' && (
       <div
         className="absolute inset-0 z-0 pointer-events-none"
         style={{
           backgroundImage: 'linear-gradient(var(--memphis-border) 1px, transparent 1px), linear-gradient(90deg, var(--memphis-border) 1px, transparent 1px)',
           backgroundSize: '24px 24px',
         }}
       />
     )}
     ```
  3. Place this AFTER the cover photo div (or in place of it, since `activeBanner` is null during tutorials — they won't overlap). The grid should be visible behind the transparent top bar and right bar, filling the whole screen.
  - Acceptance: `npm run build` passes. Tutorial screen shows the grid-line pattern across the entire viewport — behind the chorus bars, behind the buttons, everywhere. TutorialCard content is still clearly readable on top of the grid.

---

---

### Curator Frontend Integration (Premium Feed Curation)

**Overview:** Premium users get a curated feed experience. The flow:
1. **Beginning** → Premium user sees a **Curator Card** (paragraph + post count slider)
2. User submits → curator request fires in background → user enters **Ghost Middle** (browses an algorithm with no progress tracking, just killing time)
3. **Loading indicator** in bottom-left shows the curator is working
4. When curator finishes → indicator becomes a **green checkmark**
5. User clicks checkmark → enters **Real Middle** (curated posts, progress bar, deterministic count)
6. After all curated posts → **End** (unchanged)

For development: hard-code test post URIs so the frontend flow works without the curator server.

---

- [x] TASK-CURFE-1: Create CuratorContext and hard-code test data ✓

  **Complexity:** Medium
  **File(s):** new `src/lib/CuratorContext.tsx`, new `src/lib/curator-test-fixtures.ts`
  **Depends on:** TASK-PREMIUM-1

  **Context:** The CuratorContext is the global state for the curation workflow. It tracks whether the curator is idle, working, or ready, and holds the curated post URIs. For now, we hard-code 50 real Bluesky post URIs as test fixtures so the frontend flow can be built and tested without the curator server.

  Create `src/lib/curator-test-fixtures.ts`:
  - Export `TEST_CURATED_URIS: string[]` — an array of 50 real `at://` post URIs
  - To get real URIs: fetch from `https://public.api.bsky.app/xrpc/app.bsky.feed.getFeed?feed=at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/whats-hot&limit=50` and extract the `post.uri` values
  - Alternatively, hard-code any 50 valid AT URIs (they just need to resolve via getPosts)

  Create `src/lib/CuratorContext.tsx`:
  - State shape:
    ```
    type CuratorState = {
      status: 'idle' | 'working' | 'ready'
      curatedUris: string[]       // the selected post URIs
      requestedCount: number      // how many the user asked for (1-50)
      userPrompt: string          // the user's preference paragraph
    }
    ```
  - Provider wraps the app (add to `src/App.tsx` or `src/main.tsx`)
  - Expose via `useCurator()` hook returning state + actions:
    - `startCuration(prompt: string, count: number)` — sets status to 'working', in a real version would call the server. For now: use `setTimeout` (8 seconds) then set status to 'ready' with the first `count` URIs from `TEST_CURATED_URIS`
    - `getCuratedPosts()` — returns the stored URIs
    - `reset()` — back to idle
  - `userPrompt` and `requestedCount` should initialize from localStorage:
    - `localStorage.getItem('jklb-feed-preference')` for prompt
    - `localStorage.getItem('jklb-curator-count')` for count (default 20)

  **Done when:** `npm run build` passes. `useCurator()` returns the correct state. Calling `startCuration()` transitions from idle → working → ready (after 8s delay) with test URIs.

---

- [x] TASK-CURFE-2: Build the Curator Card for Beginning ✓

  **Complexity:** Medium
  **File(s):** new `src/components/beginning/CuratorCard.tsx`, `src/components/beginning/BeginningView.tsx`, `src/hooks/useBeginning.ts`, `src/types/viewState.ts`
  **Depends on:** TASK-CURFE-1

  **Context:** Premium users see a Curator Card as the FIRST card in their Beginning flow — before any notification cards. It has a textarea for their preference paragraph and a slider for how many curated posts they want (1-50). Both are pre-filled from localStorage. Pressing Enter submits the card, kicks off the curator in the background, and advances to the next Beginning stage (notification walkthrough).

  Create `src/components/beginning/CuratorCard.tsx`:
  - Textarea: pre-filled from `useCurator().userPrompt` (which comes from localStorage)
  - Placeholder: "Describe what you want to see — e.g. 'no politics, some funny stuff, at least 10 recent posts'"
  - Post count slider: range input, 1-50, shows current value, pre-filled from `useCurator().requestedCount`
  - On change: save to localStorage immediately (`jklb-feed-preference` and `jklb-curator-count`)
  - Submit (Enter key or button): calls `useCurator().startCuration(prompt, count)` and advances Beginning
  - Style: match existing Beginning cards (SectionCard-like styling, same width/padding)
  - The card should feel like a quick config step, not a big form

  Wire into Beginning flow:
  - In `src/types/viewState.ts` or wherever Beginning stages are defined: add a `'curator'` stage
  - In `src/hooks/useBeginning.ts`: if `isPremium`, the first stage is `'curator'` instead of the normal first notification stage
  - In `src/components/beginning/BeginningView.tsx`: when stage is `'curator'`, render `<CuratorCard />`
  - Advancing from the curator card goes to the next normal Beginning stage (unactionable notifications or whatever comes first)

  Also: remove the preference textarea from `src/components/SettingsPanel.tsx` (the `PremiumFeedSettings` component's textarea, around lines 293-305). The post count stepper in Settings can stay — but the paragraph moves to the Curator Card. The localStorage key stays the same (`jklb-feed-preference`) so existing saved preferences carry over.

  **Done when:** `npm run build` passes. Premium users see the Curator Card first in Beginning. Textarea and slider are pre-filled from localStorage. Enter advances to the next stage and starts curation. Non-premium users see no change.

---

- [x] TASK-CURFE-3: Ghost Middle — browsing while curator works ✓

  **Complexity:** Medium
  **File(s):** `src/App.tsx`
  **Depends on:** TASK-CURFE-1, TASK-CURFE-2

  **Context:** After the premium user finishes Beginning (including the Curator Card), they enter "Ghost Middle" — they browse posts from an algorithm just like a normal user, but with NO progress tracking and NO end-section transition. This is just killing time while the curator works. The user should pick their algorithm (show them the middle-card algorithm picker), then browse freely.

  Changes to `src/App.tsx`:
  1. When `isPremium` and `beginningDone`: go to `middle-card` (the algorithm picker) instead of skipping it. REVERT the TASK-PREMIUM-3 behavior that skipped middle-card for premium users — premium users now need to pick an algorithm for Ghost Middle browsing.
  2. Remove the `useEffect` that forces `algoFeed: null` for premium users (lines 458-462). Let them pick.
  3. When `useCurator().status === 'working'`: disable the `postsBeforePrompt` end-section transition. The existing logic (around lines 1031-1046) checks post count and transitions to End — skip that check entirely while curator status is 'working' or 'idle'. Ghost Middle has no end.
  4. When the user clicks the checkmark (handled in TASK-CURFE-5), we'll transition them to the curated flow. For now, just make sure Ghost Middle doesn't auto-end.

  **Done when:** `npm run build` passes. Premium user goes Beginning → Curator Card → algorithm picker → browsing posts (no progress bar, no auto-end). Non-premium flow unchanged.

---

- [x] TASK-CURFE-4: Loading indicator and checkmark component ✓

  **Complexity:** Low
  **File(s):** new `src/components/CuratorIndicator.tsx`, `src/components/AppLayout.tsx`
  **Depends on:** TASK-CURFE-1

  **Context:** A small component fixed in the bottom-left corner that shows the curator's status. When the curator is working, it shows a subtle loading animation (pulsing dot, skeleton, or spinner). When the curator is ready, it turns into a green checkmark that the user can click. When idle, it's hidden.

  Create `src/components/CuratorIndicator.tsx`:
  - Reads from `useCurator()`
  - `status === 'idle'`: render nothing
  - `status === 'working'`: render a small pulsing dot or spinner, maybe with text like "curating..." in small type. Use `var(--memphis-pink)` or `var(--memphis-yellow)` for the accent color. Subtle, not distracting.
  - `status === 'ready'`: render a green checkmark icon (can be a simple CSS checkmark or Unicode ✓). Make it clickable — `onClick` prop passed from parent.
  - Position: `fixed bottom-4 left-4 z-50` — sits above everything, bottom-left corner
  - Keep it small (32-40px) so it doesn't compete with the content

  Add to `src/components/AppLayout.tsx`:
  - Import and render `<CuratorIndicator />` inside the app-layout container
  - Only render when `isPremium` is true
  - The `onClick` handler (for when checkmark is clicked) will be wired in TASK-CURFE-5 — for now, just `console.log('curator ready, user clicked checkmark')`

  **Done when:** `npm run build` passes. When `startCuration()` is called, a pulsing indicator appears in bottom-left. After 8 seconds (fake delay), it becomes a green checkmark. Clicking logs to console. Hidden when not premium or curator is idle.

---

- [x] TASK-CURFE-5: Real Middle — curated posts with progress bar ✓

  **Complexity:** High
  **File(s):** `src/App.tsx`, `src/hooks/useFeed.ts`, `src/components/AppLayout.tsx`
  **Depends on:** TASK-CURFE-3, TASK-CURFE-4

  **Context:** When the user clicks the green checkmark, they transition into the "Real Middle" — a deterministic feed of exactly N curated posts (where N is what they chose on the Curator Card). The progress bar shows their position (e.g. "12/30"). After the last curated post, they transition to End.

  Implementation:
  1. **Resolve curated URIs to full posts:** When the checkmark is clicked, take the `curatedUris` from CuratorContext and resolve them to full post objects. Use the AT Protocol `app.bsky.feed.getPosts` endpoint (supports up to 25 URIs per call, so batch into 2 calls for 50 posts). Call via the public API (`https://public.api.bsky.app`). Store the resolved posts.
  2. **Transition into curated mode:** When checkmark is clicked:
     - Set a flag in CuratorContext like `inCuratedMode: true`
     - Replace the current feed items with the resolved curated posts (use `setFeedItems` from useFeed)
     - Reset `currentItemIndex` to 0
     - Set stage to `{ type: 'post', index: 0 }`
  3. **Progress bar:** The existing progress tracking (postsBeforePrompt) should now work — it counts posts viewed and shows progress. Set `postsBeforePrompt` to the curator's `requestedCount` when entering curated mode. The progress bar that already exists should just work.
  4. **End transition:** When the user has viewed all N curated posts, the existing auto-end logic kicks in (since postsBeforePrompt is now set to N). This should just work.
  5. **Wire the checkmark click:** In AppLayout, the `CuratorIndicator` onClick should trigger steps 1-3 above.
  6. **Ghost Middle cleanup:** When transitioning to curated mode, the Ghost Middle posts are simply replaced. No need to preserve them.

  **Done when:** `npm run build` passes. Full flow works: Beginning → Curator Card → algorithm browse (Ghost Middle) → click checkmark → curated posts with progress bar → End. Uses hard-coded test URIs resolving via public API.

---

---

### Trophy System — Progressive Awards on End Screen

**Overview:** The end screen becomes a Slab. The award system is a progressive unlock chain: claim → give → claim → give. Each award is typed, and each interaction writes a record to the user's PDS + indexes in Cloudflare KV.

**The Award Type:**

```typescript
type AwardMode = 'claim' | 'give'

type AwardDefinition = {
  id: string                      // e.g. 'participationTrophy', 'bestThingISaw'
  name: string                    // display name
  level: number                   // 1, 2, 3... — ordering in Trophy Case
  collection: string              // e.g. 'social.jklb.participationTrophy'
  giverCollection?: string        // for 'give' mode: 'social.jklb.bestThingISawAwardGiver'
  winnerCollection?: string       // for 'give' mode: 'social.jklb.bestThingISawAwardWinner'
  mode: AwardMode                 // 'claim' = self-serve, 'give' = nominate someone
  oneTimeOnly: boolean            // participation = true, bestThingISaw = false
  prerequisite: string | null     // award id required before this unlocks
}
```

**Current awards (v1):**

| Level | Award | Mode | One-time | Prerequisite | Collections |
|-------|-------|------|----------|-------------|-------------|
| 1 | Participation Trophy | claim | yes | none | `social.jklb.participationTrophy` |
| 2 | Best Thing I Saw | give | no (repeatable) | participationTrophy | `social.jklb.bestThingISawAwardGiver` + `social.jklb.bestThingISawAwardWinner` |

**Future progression pattern:** claim → give → claim → give → ...

**The CommunityMember type (KV shape, key = DID):**

```typescript
type CommunityMember = {
  did: string
  handle: string
  joinedAt: string
  awards: {
    participationTrophy: {
      number: number
      claimedAt: string
    } | null
    bestThingISawGiven: Array<{
      recipientDid: string
      subjectUri: string
      nominationUri: string
      givenAt: string
    }>
    bestThingISawWon: Array<{
      nominatedByDid: string
      subjectUri: string
      claimedAt: string
    }>
  }
}
```

Additional index key: `community:members` — array of DIDs for "who's in the community" queries.

**PDS record types:**

- `social.jklb.participationTrophy` — `{ $type, number: int, createdAt: ISO }`
- `social.jklb.bestThingISawAwardGiver` — `{ $type, subject: at-uri, subjectCid, recipient: did, exitPost: at-uri, createdAt: ISO }` (one record per nomination, can have many)
- `social.jklb.bestThingISawAwardWinner` — `{ $type, nomination: at-uri, nominatedBy: did, subject: at-uri, createdAt: ISO }`

**Architecture:**
- **PDS** = source of truth for the user (their records, visible on pdsls.dev)
- **KV** = community index (who has what, sequential counter for participation numbers)
- **Dual-write**: every trophy writes to PDS first, then fire-and-forget POST to KV endpoint
- **End screen check**: `listRecords` against user's own PDS to determine state

**Endpoints:**
- `POST /api/participation` — claim participation trophy (increments counter, stores in KV, returns number)
- `GET/POST /api/best-thing` — store/retrieve Best Thing I Saw nominations and wins

**End screen → Slab architecture:**

The entire end screen is a Slab. Sub-flows are nested Slab content. Escape always goes back one level.

```
End Slab (3x3 grid)
├── see your session numbers (Slab content — stats)
├── Atmosphere Report (Slab content)
├── Copy '?' posts
├── [Active Award] (changes based on trophy state — see below)
├── Trophy Case (Slab with its own 3x3 grid — see below)
├── Another Session
├── Log Out
├── Glitch a JPEG (external link)
└── Check out plyr.fm (external link)
```

**Active Award square logic:**
- No participation trophy → "Claim your participation trophy"
- Has participation trophy → "Nominate Best Thing I Saw"

**Trophy Case square:**
- Before any trophies: greyed out, hover = "earn awards and they'll appear here"
- After any trophy: active, hover = "view your trophies and give awards"

**Trophy Case inner Slab (3x3 grid):**
- Square 1: "Participation Trophy" — level 1, always shows if earned. Click → pdsls.dev link to view record
- Square 2: "Best Thing I Saw" — level 2, shows if earned (you've given at least once). Click → "Give again" flow (pick post → nomination Slab). Hover on unlocked: "Give again"
- Squares 3-9: future awards, greyed out, hover = "reach level N to unlock"
- Locked squares show the level number, greyed out, as a teaser
- Clicking a locked square does nothing (or shows a tooltip about what's needed)

---

- [x] TASK-TROPHY-1: Award type definitions + CommunityMember type ✓

  **Complexity:** Low
  **File(s):** new `src/types/awards.ts`

  **Context:** Define the core types that the entire trophy system uses. These are shared across frontend components, hooks, and backend endpoints.

  Create `src/types/awards.ts`:
  - Export `AwardMode`, `AwardDefinition`, `CommunityMember` types as described in the overview above
  - Export `AWARDS` constant: an array of `AwardDefinition` objects for the two current awards (participationTrophy and bestThingISaw)
  - Export helper: `getAwardByLevel(level: number): AwardDefinition | undefined`
  - Export helper: `getNextAward(currentAwardId: string): AwardDefinition | undefined` — returns the next award in the chain based on prerequisite
  - Export helper: `isAwardUnlocked(awardId: string, memberAwards: CommunityMember['awards']): boolean` — checks if the prerequisite is met

  **Done when:** `npm run build` passes. Types are importable. `AWARDS` contains both current awards. Helpers return correct results for all award states.

---

- [x] TASK-TROPHY-2: Create `/api/participation` endpoint ✓

  **Complexity:** Medium
  **File(s):** new `functions/api/participation.ts`, `wrangler.toml`

  **Context:** Handles participation trophy claims. Atomically increments a global counter and stores the user's CommunityMember record in KV.

  Create `functions/api/participation.ts`:
  - `POST` handler:
    - Body: `{ did: string, handle: string }`
    - Read `counter` key from KV (default 0), increment by 1
    - Read existing member record by DID (may not exist yet)
    - If member already has `participationTrophy`, return existing record (idempotent, don't double-count)
    - Otherwise: write counter, create/update CommunityMember with `participationTrophy: { number: N, claimedAt: ISO }`
    - Update `community:members` index (append DID if not present)
    - Return `{ number: N, claimedAt: string }`
  - `GET` handler:
    - Query: `?did=did:plc:xxx`
    - Returns the full CommunityMember record from KV, or `null`
  - `OPTIONS` handler: CORS preflight (same pattern as community-post.ts)

  In `wrangler.toml`:
  - Add new KV namespace binding: `TROPHIES`

  **Done when:** `npm run build` passes. POST with a DID returns a sequential number. Calling POST twice with same DID returns same number (idempotent). GET returns the full member record.

---

- [x] TASK-TROPHY-3: Refactor `/api/nominations` → `/api/best-thing` ✓

  **Complexity:** Low
  **File(s):** new `functions/api/best-thing.ts`, `functions/api/nominations.ts` (delete or redirect), `wrangler.toml`
  **Depends on:** TASK-TROPHY-2

  **Context:** Rename the nominations endpoint and update it to use the CommunityMember model. Both giver and winner actions go through this endpoint.

  Create `functions/api/best-thing.ts`:
  - `POST` handler with `action` field in body:
    - `action: 'give'` — store a bestThingISawGiven entry in the giver's CommunityMember record
      - Body: `{ action: 'give', giverDid, giverHandle, recipientDid, subjectUri, nominationUri }`
      - Appends to `awards.bestThingISawGiven[]` array on the giver's record
    - `action: 'win'` — store a bestThingISawWon entry in the winner's CommunityMember record
      - Body: `{ action: 'win', winnerDid, winnerHandle, nominatedByDid, subjectUri }`
      - Appends to `awards.bestThingISawWon[]` array on the winner's record
  - `GET` handler:
    - Query: `?did=did:plc:xxx` — returns nominations for this person (from their CommunityMember record)
  - `OPTIONS` handler: CORS preflight

  Keep `functions/api/nominations.ts` as a thin redirect to `/api/best-thing` for any existing links.

  **Done when:** `npm run build` passes. Both give and win actions update the correct CommunityMember records in KV.

---

- [x] TASK-TROPHY-4: `useTrophies` hook — PDS trophy check ✓

  **Complexity:** Low
  **File(s):** new `src/hooks/useTrophies.ts`
  **Depends on:** TASK-TROPHY-1

  **Context:** Hook that checks the authenticated user's PDS for trophy records. Uses `com.atproto.repo.listRecords` to see what collections exist. Determines what the user sees on the end screen and in the Trophy Case.

  Create `src/hooks/useTrophies.ts`:
  - Export `useTrophies()` hook
  - Reads from auth context (`useAuth()`)
  - On mount, fetches:
    - `listRecords({ collection: 'social.jklb.participationTrophy', limit: 1 })`
    - `listRecords({ collection: 'social.jklb.bestThingISawAwardGiver', limit: 100 })`
    - `listRecords({ collection: 'social.jklb.bestThingISawAwardWinner', limit: 100 })`
  - Returns:
    ```
    {
      loading: boolean
      hasParticipationTrophy: boolean
      participationTrophy: { number: number, claimedAt: string } | null
      giverRecords: Array<{ uri: string, recipientDid: string, createdAt: string }>
      winnerRecords: Array<{ uri: string, nominatedByDid: string, createdAt: string }>
      hasGivenBestThing: boolean    // giverRecords.length > 0
      hasWonBestThing: boolean      // winnerRecords.length > 0
      refetch: () => void
    }
    ```
  - Cache results in state, don't re-fetch every render
  - Errors handled gracefully — empty collection = false/empty array

  **Done when:** `npm run build` passes. Hook returns correct state for users with no records, users with participation trophy only, and users with multiple award types.

---

- [x] TASK-TROPHY-5: End screen as Slab ✓

  **Complexity:** Medium
  **File(s):** `src/components/end/EndScreenGrid.tsx`, `src/components/end/EndButton.tsx`, `src/components/AppLayout.tsx`, `src/types/viewState.ts`
  **Depends on:** TASK-TROPHY-1, TASK-TROPHY-4

  **Context:** Refactor the end screen so it renders inside a Slab. The 3x3 button grid stays the same visually but now it's Slab content. Sub-flows (stats, atmosphere, participation claim, award nomination, trophy case) are all rendered as Slab content too — pushing/popping with Escape to go back.

  Changes:
  - The end screen stage (`end-grid`) now opens a Slab with the button grid as content
  - Add a `endSlabView` state: `'grid' | 'stats' | 'atmosphere' | 'participation-claim' | 'award-nominate' | 'trophy-case'`
  - Each sub-flow renders inside the same Slab, replacing the grid content
  - Escape from any sub-flow returns to the grid
  - Escape from the grid closes the Slab (or returns to the last post, same as current behavior)
  - The existing `EndSubFlowWrapper` component can be removed — the Slab handles the back-navigation pattern
  - Stats, Atmosphere Report components render as Slab content unchanged

  Update the 3x3 grid buttons:
  - Replace the two empty `+` slots with:
    - **Active Award**: `{ id: 'active-award' }` — dynamic based on `useTrophies()` state:
      - No participation trophy: title "Claim your participation trophy", description "writes a record to your PDS — join the community"
      - Has participation trophy: title "Nominate Best Thing I Saw", description "award your favorite post from this session"
    - **Trophy Case**: `{ id: 'trophy-case' }` —
      - No trophies: greyed out, title "Trophy Case", description "earn awards and they'll appear here", not clickable
      - Has trophies: title "Trophy Case", description "view your trophies and give awards"

  **Done when:** `npm run build` passes. End screen renders inside a Slab. All existing sub-flows (stats, atmosphere, clipboard, external links, another session, log out) work as before. Two new buttons appear in the grid (active award + trophy case). Navigation with Escape works correctly at all levels.

---

- [x] TASK-TROPHY-6: Participation trophy claim flow ✓

  **Complexity:** Medium
  **File(s):** new `src/components/end/ParticipationClaim.tsx`
  **Depends on:** TASK-TROPHY-2, TASK-TROPHY-4, TASK-TROPHY-5

  **Context:** When the user clicks "Claim your participation trophy" on the end grid, the Slab content switches to a claim flow. Confirm → write to PDS + KV → success with pdsls.dev link and optional share.

  Create `src/components/end/ParticipationClaim.tsx`:
  - Rendered as Slab content (replaces the grid inside the end Slab)
  - **Confirm state**:
    - Title: "Claim your participation trophy"
    - Body: "Writes a social.jklb.participationTrophy record to your PDS. Makes you eligible for future jklb.social community stuff."
    - "Claim" button (Enter to confirm)
  - **Loading state**: brief spinner while writing
  - **On confirm**:
    1. POST to `/api/participation` with `{ did, handle }` → get `{ number }`
    2. Write to PDS: `createRecord({ collection: 'social.jklb.participationTrophy', record: { $type: 'social.jklb.participationTrophy', number, createdAt: ISO } })`
    3. Transition to success state
  - **Success state**:
    - "You're participation trophy #N!"
    - Link: "View your record on pdsls.dev" → opens `https://pdsls.dev/at/${did}/social.jklb.participationTrophy`
    - "You're now eligible to nominate someone for a Best Thing I Saw award on your next session."
    - **Optional share** — uses the same editable-post-with-default-text pattern as the Best Thing I Saw nomination (see TASK-TROPHY-7). Prefill a default message like `"I just claimed participation trophy #N on jklb.social 🏆"` but render it in an editable textarea so the user can change it before posting. Skip button always available. This share composer is the same bones that TASK-TROPHY-7 refactors AwardNominationPanel into — both flows use one shared component with a prefilled-but-editable message + optional quote embed + Skip/Share buttons.
    - Escape returns to end grid
  - After success: call `useTrophies().refetch()` so grid updates (active award square changes to "Nominate Best Thing I Saw")

  **Done when:** `npm run build` passes. Full claim flow works end to end: click → confirm → PDS write + KV POST → success screen with number and pdsls.dev link. Trophy Case updates to show the new trophy.

---

- [x] TASK-TROPHY-7: Refactor Best Thing I Saw nomination flow ✓

  **Complexity:** Medium
  **File(s):** `src/components/end/LikedPostsGrid.tsx`, `src/components/end/AwardNominationPanel.tsx`, `src/lib/actions.ts`
  **Depends on:** TASK-TROPHY-3, TASK-TROPHY-4, TASK-TROPHY-5

  **Context:** The existing award nomination flow (LikedPostsGrid → AwardNominationPanel → share) gets refactored with new record names, rendered as Slab content, and the post text becomes editable. This refactor also establishes the **shared share-composer pattern** reused by the participation trophy claim (TASK-TROPHY-6).

  Refactor `AwardNominationPanel` into a general share composer:
  - Currently the post text is hardcoded and non-editable — change it to an **editable textarea** with a prefilled default message (e.g. `"I nominate @handle for a JKLB award for this post"`)
  - User can edit the message before posting, or skip entirely
  - Props: `defaultText: string`, optional `quotedPost`, `onPost`, `onSkip`, `isSubmitting`
  - Both the Best Thing I Saw nomination and the participation trophy share (TASK-TROPHY-6) use this same component — one with a quote embed, one without

  Rename records in `src/lib/actions.ts`:
  - `social.jklb.award.nomination` → `social.jklb.bestThingISawAwardGiver`
  - Update `createRecord` call's `$type` and `collection`
  - Fire-and-forget POST to `/api/best-thing` with `action: 'give'` instead of `/api/nominations`

  Render as Slab content:
  - LikedPostsGrid renders inside the end Slab (Slab view = `'award-nominate'`)
  - Picking a post transitions to AwardNominationPanel (still inside Slab)
  - Share creates the giver record, posts, and shows success
  - Escape from either step returns to the end grid

  The nomination share post should include a claim link: `jklb.social/claim?nomination=at://...`

  **Done when:** `npm run build` passes. Full flow: pick post → preview → share → giver record written with new collection name → claim link in post. Accessible from both active award square and trophy case.

---

- [x] TASK-TROPHY-8: Trophy Case Slab ✓

  **Complexity:** Medium
  **File(s):** new `src/components/end/TrophyCase.tsx`
  **Depends on:** TASK-TROPHY-4, TASK-TROPHY-5, TASK-TROPHY-6

  **Context:** The Trophy Case is a nested Slab inside the end Slab. It's a 3x3 grid where each square represents an award level. Earned awards are active, unearned are greyed out teasers.

  Create `src/components/end/TrophyCase.tsx`:
  - Reads from `useTrophies()` and `AWARDS` constant
  - Renders a 3x3 grid (same visual style as end grid buttons)
  - Square layout driven by `AWARDS` array — each award gets a square at its level position:
    - **Level 1 — Participation Trophy**:
      - Earned: shows "Participation Trophy #N", click → opens pdsls.dev link in new tab
      - Not earned: shouldn't happen (you need it to access Trophy Case), but handle gracefully
    - **Level 2 — Best Thing I Saw**:
      - Earned (hasGivenBestThing): shows "Best Thing I Saw", hover = "Give again", click → enters nomination flow (same as TASK-TROPHY-7)
      - Unlocked but not yet given: shows "Best Thing I Saw", hover = "Give your first nomination", click → enters nomination flow
      - Locked: greyed out, shows level number "2", hover = "claim level 1 to unlock"
    - **Levels 3-9**: greyed out, show level number, hover = "reach level N-1 to unlock"
  - Escape returns to end grid

  **Done when:** `npm run build` passes. Trophy Case shows all earned awards with correct interactions. Locked awards are greyed with teaser text. "Give again" enters the nomination flow. pdsls.dev links work.

---

- [x] TASK-TROPHY-9: Sparse claim page for winners ✓

  **Complexity:** Medium
  **File(s):** `src/claim/main.ts` (refactor), `src/claim/index.html`
  **Depends on:** TASK-TROPHY-2, TASK-TROPHY-3

  **Context:** The standalone claim page where award winners accept their trophy. Refactor to be super sparse, Slab-styled. Linked from the nomination share post.

  Refactor `src/claim/main.ts`:
  - Strip to bare essentials — centered Slab-like card on dark background
  - Show: "You've been nominated for a Best Thing I Saw award by @handle"
  - Show the nominated post (embedded/quoted)
  - "Claim" button: writes `social.jklb.bestThingISawAwardWinner` to winner's PDS
    - Record: `{ $type: 'social.jklb.bestThingISawAwardWinner', nomination: nominationUri, nominatedBy: awarderDid, subject: subjectUri, createdAt: ISO }`
  - POST to `/api/best-thing` with `action: 'win'` to index in KV
  - Success: "You won! View your record on pdsls.dev" + link
  - Auth: OAuth flow (user authenticates to write to their PDS)

  URL: `jklb.social/claim?nomination=at://...`

  **Done when:** `npm run build` passes. Claim page is sparse and Slab-styled. Winner can authenticate, claim, see record on pdsls.dev. KV updated.

---

---

### Slab Unification — PostCards + Slabs

> Reference: `specs/audit-march-11.md`, `specs/beginning-flow.md` (Slab-Based Rendering section), `specs/constitution.md` (UI Primitives section)
>
> Goal: The entire app renders two content primitives — PostCards (post content) and Slabs (everything else). This simplifies AppLayout from ~300 lines of rendering logic to ~50, and makes the codebase dramatically easier for sub-agents to maintain.

---

- [x] TASK-SLAB-1: Delete useUnreadNotifications hook ✓

  **Complexity:** Trivial
  **File(s):** `src/hooks/useUnreadNotifications.ts`, `src/hooks/index.ts`, `src/App.tsx`

  **Context:** This hook polls for unread notifications every 60 seconds after Beginning completes, but the `hasUnread` boolean it returns is never connected to any visible UI. It's dead code that makes unnecessary API calls. Delete it.

  1. Delete `src/hooks/useUnreadNotifications.ts`
  2. In `src/hooks/index.ts`: remove the export line for `useUnreadNotifications` and its type exports (`UseUnreadNotificationsParams`, `UseUnreadNotificationsReturn`)
  3. In `src/App.tsx`: remove the import of `useUnreadNotifications` from `'./hooks'`, and remove the call site (around line 148-152) where `useUnreadNotifications` is called and its destructured return values (`hasUnread`, `checkForUnread`, `clearUnread`) are assigned. Remove any references to those variables elsewhere in the file.
  4. Check if `hasUnreadNotifications` and `getTestNotifications` in `src/lib/notifications.ts` are used by anything else. If the only consumer was this hook, leave them for now (they may be useful later).

  **Done when:** `npm run build` passes. No more 60-second polling for unread notifications. No references to `useUnreadNotifications` anywhere in the codebase.

---

- [x] TASK-SLAB-2: Unify End Flow back-button behavior ✓

  **Complexity:** Low
  **File(s):** `src/components/end/SessionStats.tsx`, `src/components/LikedPostsGrid.tsx`, `src/components/AtmosphereReport.tsx`, `src/components/end/EndSubFlowWrapper.tsx`

  **Context:** End sub-flows have 4 different back-button patterns. The target: every sub-flow uses `EndSubFlowWrapper` for a visible "back to end menu" button, plus Escape returns to grid. The Slab's X button always exits the End flow entirely.

  Current state of each sub-flow:
  - **SessionStats** — has its own inline "← back" button at bottom-right + handles Escape and `k`. Should: wrap in EndSubFlowWrapper, remove the inline back button, remove the `k` key handler (keep Escape).
  - **LikedPostsGrid** — uses `k` key to go back, no visible back button, no Escape handler. Should: wrap in EndSubFlowWrapper, keep `k` for grid navigation within the liked posts but add Escape to return to end menu.
  - **AtmosphereReport** — handles Escape/Delete to close, no visible back button. Should: wrap in EndSubFlowWrapper, keep Escape handler (it already works correctly).
  - **TrophyCase** — already uses EndSubFlowWrapper + Escape. No changes needed.
  - **ParticipationClaim** — already uses EndSubFlowWrapper. No changes needed.

  Changes:

  1. **SessionStats.tsx:**
     - Import and wrap content in `EndSubFlowWrapper`
     - Remove the manual "← back" button JSX
     - Remove the `k` key handler from the useEffect (keep Escape calling `onBack`)
     - Pass `onBack` to EndSubFlowWrapper

  2. **LikedPostsGrid.tsx:**
     - Import and wrap content in `EndSubFlowWrapper`
     - Add Escape key handler that calls `onGoBack()`
     - Keep existing `k` behavior for post-selection navigation (k moves selection up within the grid, not back to end menu)
     - Pass `onGoBack` as EndSubFlowWrapper's `onBack`

  3. **AtmosphereReport.tsx:**
     - Import and wrap content in `EndSubFlowWrapper`
     - Pass `onClose` as EndSubFlowWrapper's `onBack`
     - Keep existing Escape/Delete handler

  **Done when:** `npm run build` passes. Every End sub-flow shows a visible "back to end menu" button (from EndSubFlowWrapper). Escape returns to grid from any sub-flow. No sub-flow uses `k` as "back to grid."

---

- [x] TASK-SLAB-3: Extend Slab with accentColor prop ✓

  **Complexity:** Trivial
  **File(s):** `src/components/Slab.tsx`

  **Context:** Slab currently hardcodes `border-[var(--memphis-pink)]` and `text-[var(--memphis-cyan)]` for title. To support Beginning notification types (each with their own accent color), Slab needs an optional `accentColor` prop.

  1. Add optional `accentColor?: string` to `SlabProps`
  2. Replace the hardcoded border color:
     - Current: `border-[var(--memphis-pink)]`
     - New: use inline `style` for `borderColor` when `accentColor` is provided, fall back to `var(--memphis-pink)` when not
  3. Replace the hardcoded shadow color:
     - Current: `shadow-[var(--memphis-pink)]/20`
     - New: use inline `style` for `boxShadow` when `accentColor` is provided
  4. Replace the hardcoded title color:
     - Current: `text-[var(--memphis-cyan)]`
     - New: use inline `style` for title `color` when `accentColor` is provided, fall back to `var(--memphis-cyan)`
  5. Make `onClose` optional — when `hideClose` is true and no `onClose` is provided, the header still renders but without the X button. Default `onClose` to a no-op if not provided.

  **Done when:** `npm run build` passes. Existing Slab usage (Settings, Hotkeys, End screens) looks identical (no visual changes). `<Slab accentColor="var(--memphis-cyan)" title="test">` renders with cyan border and title.

---

- [x] TASK-SLAB-4: Beginning notifications in Slabs ✓

  **Complexity:** Medium
  **File(s):** `src/components/beginning/BeginningView.tsx`, `src/components/beginning/UnactionableItemsView.tsx`, `src/components/beginning/NewFollowerCard.tsx`, `src/components/beginning/BeginningPostCard.tsx`, `src/components/TutorialCard.tsx`
  **Depends on:** TASK-SLAB-3

  **Context:** Each Beginning notification stage renders inside a Slab with a fun title and the appropriate accent color. This is the key task — once Beginning uses Slabs, the whole app is PostCards + Slabs. See `specs/beginning-flow.md` § "Slab-Based Rendering" for the full design.

  The section labels already exist in BeginningView.tsx — `sectionLabel` is passed to BeginningPostCard. The Slab title replaces these.

  1. **BeginningView.tsx** — wrap each case's return in a Slab:
     - `unactionable`: `<Slab title="your posts got some love" accentColor="var(--memphis-pink)" hideClose>`
     - `follower`: `<Slab title="somebody's ears are burning" accentColor="var(--memphis-cyan)" hideClose>`
     - `quotePost`: `<Slab title="you've been quote posted" accentColor="var(--memphis-yellow)" hideClose>`
     - `reply`: `<Slab title="your post got a reply" accentColor="var(--memphis-cyan)" hideClose>`
     - `mention`: `<Slab title="somebody's ears are burning" accentColor="var(--memphis-pink)" hideClose>`
     - Tutorial cards: `<Slab title={tutorialTitle} accentColor="var(--memphis-yellow)" hideClose>`
     - `curator`: leave as-is for now (Premium feature, separate concern)
     - `hideClose` is `true` on all Beginning Slabs — navigation is j/k, not Esc
  2. **UnactionableItemsView.tsx** — remove its own section header (`<h2>` with "Likes" / "Boosts"), "N of M" counter styling, and colored outline wrapper. The Slab provides the header and border. Keep the inner content (PostCards + avatar tiles).
  3. **NewFollowerCard.tsx** — remove its own section header and colored outline. Keep the follower card content (cover photo, avatar, bio, counts, action hints).
  4. **BeginningPostCard.tsx** — remove the `sectionLabel` prop rendering (the `<h2>` above the card) and the colored `border-2` outline wrapper. Keep the PostCard content. The `sectionLabel` prop can stay in the interface for now but won't be rendered.
  5. **TutorialCard.tsx** — remove its own wrapper chrome if it has any bespoke border/header styling. The Slab provides the wrapper.
  6. Move the "N of M" counter inside the Slab body (first child, small text, right-aligned or centered).

  **Done when:** `npm run build` passes. Beginning flow renders each notification stage inside a Slab with the appropriate title and accent color. Navigation (j/k), action keys, and chorus fill work identically to before. No visual chrome duplication (no double borders, no duplicate headers).

---

- [ ] TASK-SLAB-5: Simplify AppLayout stage rendering

  **Complexity:** Medium
  **File(s):** `src/components/AppLayout.tsx`
  **Depends on:** TASK-SLAB-2, TASK-SLAB-4

  **Context:** With Beginning in Slabs and End already in Slabs, AppLayout's stage rendering can be simplified. Every stage now renders either a PostCard or a Slab. The ~300-line conditional rendering section becomes a flat switch.

  1. Review the current stage rendering section in AppLayout.tsx (the large conditional block that checks `viewState.stage.type`)
  2. Refactor into a clean `switch (viewState.stage.type)` that maps each stage to its component:
     - Tutorial stages → Slab (via BeginningView)
     - Beginning stages → Slab (via BeginningView)
     - `middle-card` → SectionCard (or Slab if SectionCard is absorbed)
     - `post` → PostCard
     - `thread` → ScrollThread (leave as-is, out of scope)
     - End stages → Slab (already working)
  3. Panel rendering (`viewState.panel`) stays as-is — panels already render in Slabs
  4. Remove any dead conditional branches, redundant checks, or leftover ternary nesting
  5. If SectionCard (the "Choose Your Algorithm" middle card) can be trivially wrapped in a Slab, do it. If it's complex, leave for a follow-up.

  **Done when:** `npm run build` passes. AppLayout's stage rendering is a flat switch statement. No nested ternaries for content routing. App behavior is identical to before.

---

## Task Order

All CURFE and TROPHY tasks are complete.

**Slab Unification — PostCards + Slabs refactor:**

```
TASK-SLAB-1 (delete dead hook) ─── no deps, trivial cleanup
TASK-SLAB-2 (end back buttons) ─── no deps, small cleanup
TASK-SLAB-3 (extend Slab)      ─── no deps, prerequisite for SLAB-4
TASK-SLAB-4 (Beginning in Slabs)── depends on SLAB-3
TASK-SLAB-5 (AppLayout simplify)── depends on SLAB-2 + SLAB-4
```

**Parallel tracks:**
- Track A (cleanup): SLAB-1 + SLAB-2 (parallel, no deps)
- Track B (feature): SLAB-3 → SLAB-4 → SLAB-5
- SLAB-1 and SLAB-2 can run in parallel with Track B
