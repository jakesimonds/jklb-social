# Spec: Login & Landing

The logged-out experience and authentication flow.

---

## Landing Page (Logged Out)

When not authenticated, the app shows:

### Top Bar
- **JKLB buttons** — left side, same as always
- **PWD component (right side)** — contains:
  - Handle input field (placeholder: "alice.bsky.social")
  - "Begin" button (triggers login)
  - Label: "your internet handle (BlueSky account)"

### Stage
- Empty or minimal branding

### Responsive Behavior
- As viewport shrinks: JKLB buttons disappear first
- "Begin" button + input persist last
- At smallest sizes, "Begin" can be slightly larger

### Handle Autocomplete
- As user types, show a dropdown of matching handles
- Uses `app.bsky.actor.searchActorsTypeahead` API
- Triggers after 3+ characters (don't spam the API)
- Dropdown shows: avatar, displayName, handle
- Click or Enter on a suggestion selects it
- Previous implementation had this; it was lost and needs to be restored

---

## Login Flow

1. User enters handle in input
2. Clicks "Begin" or presses Enter
3. `login(handle)` initiates ATProto OAuth flow
4. Redirect to Bluesky/PDS OAuth page
5. Redirect back to app with auth token
6. App detects authentication → Beginning phase starts

---

## OG Preview Image

For link sharing (social media cards), the app needs:
- `<meta property="og:image">` tag
- Image: the user's banner/cover photo (or a default JKLB branding image for logged-out state)
- Title: "jklb.social"
- Description: brief tagline

---

## Technical Notes

- Auth: `src/hooks/useAuth.ts`
- Login modal: `src/components/LoginModal.tsx`
- Inline login: embedded in `AppLayout.tsx` top bar
- Typeahead API: `agent.app.bsky.actor.searchActorsTypeahead({ q: term, limit: 5 })`

---

*This is the source of truth. If code disagrees with this doc, the code is wrong.*
