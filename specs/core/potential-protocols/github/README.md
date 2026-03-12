# GitHub as a Social Protocol for JKLB

**Status:** Research spec (not yet implementation-ready)
**Date:** March 2026
**Author:** Jake Simonds + Claude

---

## 1. Overview

GitHub is, underneath the code, a social network. Users follow each other, star repositories, comment on issues and PRs, react with emoji, fork projects, and publish releases. The GitHub home dashboard is literally a social feed of activity from people you follow and repos you watch.

This spec explores how to surface GitHub's social layer through JKLB -- turning stars, commits, issues, PRs, and reactions into cards you navigate with j/k, like with l, and boost with b.

### Why GitHub?

- Massive user base (100M+ developers)
- Rich social graph (follows, stars, forks, watchers)
- Excellent API with native CORS support (no proxy needed)
- Emoji reactions map cleanly to JKLB actions
- Many developers already have `gh` CLI authenticated -- potential for zero-friction onboarding
- GitHub activity is inherently interesting content that no other social client surfaces this way

---

## 2. GitHub's Social Feed -- What's In It

### 2.1 The Dashboard Feed

The GitHub home dashboard (github.com) shows activity from:
- Repositories you watch/star
- Users you follow
- Your own activity

As of late 2025, GitHub split the dashboard into two views:
- **Home dashboard**: customizable lists of recent pull requests, issues, and agent tasks
- **Feed page** (github.com/feed): the traditional activity stream, moved to its own page

### 2.2 Event Types Available via API

GitHub exposes 16 event types through its Events API. These are the raw building blocks for a JKLB feed:

| Event Type | What Happened | JKLB Card Potential |
|---|---|---|
| **WatchEvent** | Someone starred a repo | High -- "X starred Y" is inherently social |
| **CreateEvent** | Branch, tag, or repo created | Medium -- repo creation is interesting, branch creation is noise |
| **PushEvent** | Commits pushed | High -- the core of GitHub activity |
| **IssuesEvent** | Issue opened/closed/reopened | High -- conversation starters |
| **IssueCommentEvent** | Comment on issue or PR | High -- the actual social content |
| **PullRequestEvent** | PR opened/closed/merged | High -- collaborative work |
| **PullRequestReviewEvent** | PR review submitted | Medium -- reviews are social but technical |
| **PullRequestReviewCommentEvent** | Inline review comment | Low -- too granular for a feed |
| **ForkEvent** | Someone forked a repo | Medium -- shows interest/adoption |
| **ReleaseEvent** | Release published | High -- milestone moments |
| **DiscussionEvent** | Discussion created | High -- GitHub Discussions are explicitly social |
| **CommitCommentEvent** | Comment on a commit | Low -- rare and usually automated |
| **DeleteEvent** | Branch/tag deleted | Low -- noise |
| **GollumEvent** | Wiki page created/updated | Low -- rare |
| **MemberEvent** | Collaborator added | Low -- administrative |
| **PublicEvent** | Repo went public | Medium -- notable but rare |

### 2.3 Data Retention

As of January 2025, GitHub changed event data retention from 90 days to **30 days**. Events older than 30 days are excluded from the API regardless of count. Maximum 300 events per response, paginated.

---

## 3. GitHub API Endpoints for Social Data

### 3.1 REST API -- Events (The Feed)

The Events API is the closest thing to a social feed. All endpoints return JSON arrays of event objects.

**Your personalized feed (activity from people you follow + repos you watch):**
```
GET https://api.github.com/users/{username}/received_events
```
- Authenticated: includes private events
- Unauthenticated: public events only
- No special token permissions required for fine-grained PATs
- Max 300 events, paginated with `?page=N&per_page=30`

**A specific user's public activity:**
```
GET https://api.github.com/users/{username}/events
```

**A specific user's public activity (public only, no auth needed):**
```
GET https://api.github.com/users/{username}/events/public
```

**All public events (firehose):**
```
GET https://api.github.com/events
```

**Events for a specific repo:**
```
GET https://api.github.com/repos/{owner}/{repo}/events
```

#### Polling Optimization

The Events API is designed for polling, not real-time:
- Use `ETag` header for conditional requests (304 Not Modified = no new events, doesn't consume rate limit)
- `X-Poll-Interval` header tells you how often to poll (typically 60 seconds)
- Event latency: 30 seconds to 6 hours depending on server load

#### Event Object Shape

```json
{
  "id": "12345678901",
  "type": "WatchEvent",
  "actor": {
    "id": 1234567,
    "login": "octocat",
    "display_login": "octocat",
    "gravatar_id": "",
    "url": "https://api.github.com/users/octocat",
    "avatar_url": "https://avatars.githubusercontent.com/u/1234567?v=4"
  },
  "repo": {
    "id": 9876543,
    "name": "owner/repo-name",
    "url": "https://api.github.com/repos/owner/repo-name"
  },
  "payload": {
    "action": "started"
  },
  "public": true,
  "created_at": "2026-03-07T12:00:00Z"
}
```

The `payload` varies by event type and contains the meat of the data (issue body, commit messages, PR description, comment text, etc).

### 3.2 REST API -- Starring

**List repos the authenticated user has starred:**
```
GET https://api.github.com/user/starred
```

**List repos a specific user has starred:**
```
GET https://api.github.com/users/{username}/starred
```

**Star a repo (write action):**
```
PUT https://api.github.com/user/starred/{owner}/{repo}
```
Returns 204 No Content on success.

**Unstar a repo:**
```
DELETE https://api.github.com/user/starred/{owner}/{repo}
```

**List who starred a repo (stargazers):**
```
GET https://api.github.com/repos/{owner}/{repo}/stargazers
```

**Timestamp media type:** Use `Accept: application/vnd.github.star+json` to get `starred_at` timestamps with starred repos.

### 3.3 REST API -- Reactions

GitHub supports 8 reaction types on issues, PRs, comments, and discussions:

| Content Value | Emoji | Potential JKLB Mapping |
|---|---|---|
| `+1` | thumbs up | Like (l key) |
| `-1` | thumbs down | (no mapping -- JKLB doesn't do downvotes) |
| `laugh` | face with tears of joy | (display only) |
| `heart` | red heart | Like (l key) -- alternative |
| `hooray` | party popper | (display only) |
| `rocket` | rocket | **Boost (b key)** -- Jake's idea |
| `eyes` | eyes | (display only) |
| `confused` | confused face | (no mapping) |

**List reactions on an issue:**
```
GET https://api.github.com/repos/{owner}/{repo}/issues/{issue_number}/reactions
```

**Create a reaction on an issue:**
```
POST https://api.github.com/repos/{owner}/{repo}/issues/{issue_number}/reactions
Content-Type: application/json

{ "content": "rocket" }
```

**Create a reaction on an issue comment:**
```
POST https://api.github.com/repos/{owner}/{repo}/issues/comments/{comment_id}/reactions
Content-Type: application/json

{ "content": "+1" }
```

**Delete a reaction:**
```
DELETE https://api.github.com/repos/{owner}/{repo}/issues/{issue_number}/reactions/{reaction_id}
```

Reactions are also available on:
- Commit comments: `/repos/{owner}/{repo}/comments/{comment_id}/reactions`
- PR review comments: `/repos/{owner}/{repo}/pulls/comments/{comment_id}/reactions`
- Team discussions: `/orgs/{org}/teams/{team_slug}/discussions/{discussion_number}/reactions`
- Discussion comments: via GraphQL

### 3.4 REST API -- Followers (Social Graph)

**List who the authenticated user follows:**
```
GET https://api.github.com/user/following
```

**List a user's followers:**
```
GET https://api.github.com/users/{username}/followers
```

**Follow a user:**
```
PUT https://api.github.com/user/following/{username}
```

**Unfollow a user:**
```
DELETE https://api.github.com/user/following/{username}
```

### 3.5 REST API -- Feeds (Atom)

```
GET https://api.github.com/feeds
```

Returns URLs for various Atom feeds:
- `timeline_url` -- your dashboard timeline
- `user_url` -- template for any user's public activity
- `current_user_public_url` -- your public activity
- `current_user_url` -- your private + public activity (requires auth)
- `current_user_actor_url` -- your actions
- `current_user_organization_urls` -- org-specific feeds

These return Atom XML, not JSON. Less useful for JKLB than the Events API, but worth knowing about.

### 3.6 GraphQL API

The GraphQL API is more flexible for complex queries. Relevant queries:

**User profile + social data:**
```graphql
query {
  user(login: "octocat") {
    login
    name
    bio
    avatarUrl
    followers(first: 10) {
      totalCount
      nodes { login avatarUrl }
    }
    following(first: 10) {
      totalCount
      nodes { login avatarUrl }
    }
    starredRepositories(first: 10) {
      totalCount
      nodes { nameWithOwner description stargazerCount }
    }
  }
}
```

**Contribution activity (commit calendar):**
```graphql
query {
  user(login: "octocat") {
    contributionsCollection(from: "2026-01-01T00:00:00Z", to: "2026-03-07T00:00:00Z") {
      contributionCalendar {
        totalContributions
        weeks {
          contributionDays {
            contributionCount
            date
          }
        }
      }
      totalCommitContributions
      totalIssueContributions
      totalPullRequestContributions
      totalPullRequestReviewContributions
    }
  }
}
```

**GraphQL endpoint:**
```
POST https://api.github.com/graphql
Authorization: bearer {token}
Content-Type: application/json

{ "query": "..." }
```

GraphQL rate limit: 5,000 points per hour (each query costs a variable number of points based on complexity).

---

## 4. Authentication

### 4.1 Auth Options Ranked by User Experience

#### Option A: Leverage Existing `gh` CLI Token (Best UX, Desktop Only)

If the user has GitHub CLI installed and authenticated (`gh auth login`), we can read their token:

```bash
gh auth token
# outputs: gho_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

The token is stored in the system keychain (macOS Keychain, Windows Credential Manager, etc.) or in `~/.config/gh/hosts.yml`.

**Flow for JKLB:**
1. On first launch, check if `gh` is installed and authenticated
2. If yes, prompt: "We found your GitHub CLI session. Use it? [Y/n]"
3. Read the token and use it for API calls

**Limitation:** This only works for desktop/CLI contexts, not a pure browser app. JKLB is a static web app, so we cannot shell out to `gh auth token`. However, we could:
- Provide a settings field where the user pastes their token (from running `gh auth token` in terminal)
- Store it in localStorage (encrypted or not -- it's a client-side app anyway)

**Verdict:** Good for power users. Offer as an option alongside OAuth.

#### Option B: OAuth App -- Web Application Flow (Best for Browser)

This is the standard flow for web apps. GitHub supports it with PKCE (as of July 2025).

**Step 1: Redirect user to authorize**
```
GET https://github.com/login/oauth/authorize
  ?client_id={CLIENT_ID}
  &redirect_uri={REDIRECT_URI}
  &scope=read:user
  &state={RANDOM_STATE}
  &code_challenge={PKCE_CHALLENGE}
  &code_challenge_method=S256
```

**Step 2: User approves, GitHub redirects back with code**
```
https://jklb.social/github?code={CODE}&state={STATE}
```

**Step 3: Exchange code for token**
```
POST https://github.com/login/oauth/access_token
Content-Type: application/json
Accept: application/json

{
  "client_id": "{CLIENT_ID}",
  "client_secret": "{CLIENT_SECRET}",
  "code": "{CODE}",
  "redirect_uri": "{REDIRECT_URI}",
  "code_verifier": "{PKCE_VERIFIER}"
}
```

**Problem:** This requires a `client_secret`, which cannot be embedded in a static site. Solutions:
1. **Cloudflare Worker** for token exchange (thin proxy, no business logic) -- this is the JKLB pattern for server-side needs
2. **GitHub App with device flow** (Option C below) -- avoids the secret entirely

**Response:**
```json
{
  "access_token": "gho_16C7e42F292c6912E7710c838347Ae178B4a",
  "scope": "read:user",
  "token_type": "bearer"
}
```

#### Option C: OAuth Device Flow (Best for Pure Client)

No redirect needed. No client secret needed for the initial flow. Works perfectly for static sites.

**Step 1: Request device code**
```
POST https://github.com/login/device/code
Content-Type: application/json

{
  "client_id": "{CLIENT_ID}",
  "scope": "read:user"
}
```

**Response:**
```json
{
  "device_code": "3584d83530557fdd1f46af8289938c8ef79f9dc5",
  "user_code": "WDJB-MJHT",
  "verification_uri": "https://github.com/login/device",
  "expires_in": 900,
  "interval": 5
}
```

**Step 2: Show user the code, they go to github.com/login/device and enter it**

**Step 3: Poll for completion**
```
POST https://github.com/login/oauth/access_token
Content-Type: application/json
Accept: application/json

{
  "client_id": "{CLIENT_ID}",
  "device_code": "{DEVICE_CODE}",
  "grant_type": "urn:ietf:params:oauth:grant-type:device_code"
}
```

Poll every `interval` seconds until user completes auth (up to 15 minutes).

**Verdict:** This is the recommended primary auth flow for JKLB GitHub. No secrets needed in the client, works in any browser, clean UX ("enter this code on GitHub").

#### Option D: Personal Access Token (Paste-In)

User creates a token at github.com/settings/tokens and pastes it into JKLB settings.

- Simplest to implement
- No OAuth app registration needed
- User controls exact permissions
- Worst UX (requires leaving JKLB, navigating GitHub settings, creating token, copying, pasting)

**Verdict:** Offer as fallback for users who prefer it or have existing tokens.

### 4.2 Required Scopes / Permissions

For read-only social feed access:

| Scope (Classic) | Fine-Grained Permission | What It Unlocks |
|---|---|---|
| _(no scope)_ | _(no permission)_ | Public events, public repos, public user profiles |
| `read:user` | Account: read | Private profile data, email |
| `user:follow` | _(account level)_ | Follow/unfollow users |
| `public_repo` | Contents: read | React to issues/PRs on public repos |

**Minimum viable:** No scopes at all. Public events and profiles are accessible without any scope. Authentication just gives you higher rate limits (5,000/hr vs 60/hr) and access to your personalized received_events feed.

**Recommended:** `read:user` for personalized feed + profile data.

**For write actions (reactions, starring):** `public_repo` scope (classic) or fine-grained with appropriate repository permissions.

### 4.3 Rate Limits

| Auth State | REST Limit | GraphQL Limit |
|---|---|---|
| Unauthenticated | 60 requests/hour | Not available |
| Authenticated (PAT/OAuth) | 5,000 requests/hour | 5,000 points/hour |
| GitHub App (installation) | 5,000-15,000 requests/hour | 5,000 points/hour |

At 5,000 requests/hour, JKLB has plenty of headroom. A typical session might use:
- 1 call to fetch received_events (up to 300 events)
- 1 call per event to fetch full details (if needed) -- but most data is in the event payload
- A handful of write calls (reactions, stars)

With ETag polling, most subsequent fetches return 304 and don't consume rate limit.

---

## 5. Mapping GitHub to JKLB's Feed Model

### 5.1 What Is a "Post"?

GitHub doesn't have "posts" -- it has events. The adapter transforms events into JKLBPost objects. Here's the mapping:

| GitHub Event | JKLBPost.text | JKLBPost.media | Card Feel |
|---|---|---|---|
| **IssuesEvent** (opened) | Issue title + body (truncated) | Link preview to issue | Like a blog post announcement |
| **IssueCommentEvent** | Comment body | Link preview to issue | Like a reply/thread post |
| **PullRequestEvent** (opened/merged) | PR title + body (truncated) | Link preview to PR | Like a status update |
| **PushEvent** | Commit messages (joined) | null | Like a microblog post |
| **WatchEvent** (star) | "{actor} starred {repo}: {repo.description}" | null | Like a retweet/boost |
| **ReleaseEvent** | Release name + body | Link preview to release | Like an announcement |
| **ForkEvent** | "{actor} forked {repo}" | null | Like a share |
| **CreateEvent** (repo) | "{actor} created {repo}: {description}" | null | Like a "new project" post |
| **DiscussionEvent** | Discussion title + body | Link preview to discussion | Like a forum post |

### 5.2 What Is a "Like"?

**A like (l key) = a +1 reaction** on the underlying GitHub object.

- On an issue event card: adds a +1 reaction to the issue
- On a comment event card: adds a +1 reaction to the comment
- On a PR event card: adds a +1 reaction to the PR
- On a star/push/fork event: like is not applicable (no reaction target) -- the l key could be disabled, or it could star the repo instead

Alternative mapping: **Like = Star the repo** associated with any event. This is simpler and always available.

**Recommended:** Like = +1 reaction when a reaction target exists, star the repo when it doesn't. Display both states.

### 5.3 What Is a "Boost"?

**A boost (b key) = a rocket reaction** on the underlying GitHub object.

This is Jake's original insight. The rocket emoji is GitHub's closest analog to a "boost" or "signal boost." It says "this is awesome, pay attention to it."

- On an issue card: rocket reaction on the issue
- On a comment card: rocket reaction on the comment
- On a PR card: rocket reaction on the PR
- On events without a reaction target: star the repo (if not already starred)

### 5.4 What Is a "Reply"?

**A reply (r key) = a comment** on the underlying issue or PR.

- On an issue card: opens composer, posts an issue comment
- On a PR card: opens composer, posts a PR comment
- On a comment card: opens composer, posts a reply comment
- On star/push/fork events: reply is not available (disable r key)

### 5.5 What Is a "Follow"?

**Follow (f key) = follow the event actor** (the GitHub user who performed the action).

Straightforward mapping. GitHub's follow API is simple.

### 5.6 Escape Hatch URLs

Every card links back to GitHub (v key):

| Event Type | Native URL |
|---|---|
| IssuesEvent | `https://github.com/{owner}/{repo}/issues/{number}` |
| IssueCommentEvent | `https://github.com/{owner}/{repo}/issues/{number}#issuecomment-{id}` |
| PullRequestEvent | `https://github.com/{owner}/{repo}/pull/{number}` |
| PushEvent | `https://github.com/{owner}/{repo}/commits/{branch}` |
| WatchEvent | `https://github.com/{owner}/{repo}` |
| ReleaseEvent | `https://github.com/{owner}/{repo}/releases/tag/{tag}` |
| ForkEvent | `https://github.com/{actor}/{repo}` |
| CreateEvent (repo) | `https://github.com/{owner}/{repo}` |

Profile URLs: `https://github.com/{login}`

### 5.7 Adapter Identity Fields

```typescript
const adapter: Partial<NetworkAdapter> = {
  networkName: "GitHub",
  postNoun: "event",       // or "activity"
  boostNoun: "rocket",     // or "boost"
  likeNoun: "thumbs up",   // or "+1"
  nativeClientName: "GitHub",
  nativeClientUrl: "https://github.com",
};
```

### 5.8 Capabilities Declaration

```typescript
const capabilities: NetworkCapabilities = {
  notifications: true,    // GitHub has a notifications API
  multipleFeeds: true,    // received_events vs public events vs repo-specific
  threads: true,          // issue/PR comment threads
  quotePosts: false,      // GitHub doesn't have quote-posts
  follow: true,           // follow/unfollow users
  coverPhotos: false,     // GitHub profiles don't have banners
  reply: true,            // comment on issues/PRs
  mentions: true,         // @username mentions in comments
  hashtags: false,        // GitHub doesn't use hashtags
};
```

---

## 6. Feed Options (Multiple Feeds)

JKLB supports a feed selector on the Middle card. GitHub could offer:

| Feed ID | Name | API Endpoint |
|---|---|---|
| `received` | "My Feed" | `GET /users/{username}/received_events` |
| `personal` | "My Activity" | `GET /users/{username}/events` |
| `public` | "Public Feed" | `GET /events` |
| `starred:{owner}/{repo}` | "{repo} Activity" | `GET /repos/{owner}/{repo}/events` |

The "My Feed" (received_events) is the default -- it's the equivalent of the GitHub dashboard, showing activity from people you follow and repos you watch.

---

## 7. Notifications (Beginning Flow)

GitHub has a Notifications API that could power the Beginning flow:

```
GET https://api.github.com/notifications
```

This returns threads (issues/PRs/discussions) where the user has been:
- Mentioned
- Assigned
- Review-requested
- Subscribed (watching)
- Directly commented on

**Mapping to JKLB notification categories:**

| JKLB Category | GitHub Notification Reason |
|---|---|
| Mentions | `mention` reason |
| Replies | `comment`, `author` reason |
| Likes | Not directly available (no "someone reacted to your issue" notification) |
| Boosts | Not directly available |
| New Followers | Not available via Notifications API (would need separate polling) |

**Limitation:** GitHub's notification model is thread-based (centered on issues/PRs), not action-based (centered on likes/reactions). The Beginning flow would look different from Bluesky's -- more like "issues that need your attention" than "people who liked your posts."

---

## 8. CORS and Pure Client Feasibility

**Good news: GitHub's REST API supports CORS natively.**

GitHub returns `Access-Control-Allow-Origin: *` on API responses. Direct browser-to-API requests work without a proxy. This is a major win for JKLB's pure-client architecture.

**The one exception:** The OAuth token exchange endpoint (`POST /login/oauth/access_token`) does NOT support CORS when a client_secret is required. This is why the Device Flow (Option C in Section 4) is recommended -- it avoids the client_secret entirely.

If the web application OAuth flow is used instead, a thin Cloudflare Worker would be needed solely for the token exchange step. After that, all API calls go directly from browser to api.github.com.

---

## 9. Feasibility Assessment

### 9.1 What Works Well

- **CORS support** -- no proxy needed for API calls (huge win)
- **Device Flow auth** -- no server-side secrets needed
- **Events API** -- provides a ready-made social feed
- **Reactions** -- clean mapping to like/boost
- **Starring** -- natural social action
- **Follow/unfollow** -- simple API
- **Rate limits** -- 5,000/hr is more than enough
- **Rich event payloads** -- most data is inline, reducing follow-up API calls
- **User avatars** -- GitHub profiles have good avatar support (Chorus works)

### 9.2 What's Tricky

- **Events are not posts.** The adapter must synthesize readable "post text" from heterogeneous event types. A PushEvent with 20 commits needs to be summarized. An IssueCommentEvent needs its comment body extracted. Each event type has a different payload shape.
- **No unified "like" state.** Unlike Bluesky where every post has `viewer.like`, GitHub events don't carry "did I react to this?" state. The adapter would need to check reactions separately per reactable object.
- **Write actions require knowing the target type.** Liking (reacting to) an issue requires the issue number and repo. The adapter must parse this from the event and store it for later action.
- **30-day event retention.** The feed only goes back 30 days. Older activity is gone.
- **No cover photos.** GitHub profiles don't have banners -- the C key and cover photo features won't apply.
- **Comment threading is different.** GitHub threads are issue/PR threads, not conversation threads. The T key would open the full issue/PR comment thread, which could be very long.
- **Mixed content types.** A GitHub feed mixes code activity, social activity, and administrative events. Filtering out noise (branch deletions, member additions) is important.

### 9.3 What Won't Work

- **Quote posts** -- GitHub has no quote mechanism
- **Hashtags** -- GitHub doesn't use hashtags (labels exist but aren't inline)
- **Engagement counts** -- JKLB deliberately hides these, so this is actually fine
- **Real-time updates** -- Events API has 30s to 6hr latency, but JKLB's poll-when-user-is-reading model handles this naturally

### 9.4 Effort Estimate

| Component | Difficulty | Notes |
|---|---|---|
| Auth (Device Flow) | Low | Well-documented, no server needed |
| Feed fetching (Events API) | Medium | Straightforward API, but event-to-post transformation has many cases |
| Event-to-JKLBPost transformation | **High** | 10+ event types, each with different payload shapes. This is the bulk of the work. |
| Like action (reactions) | Medium | Need to track reactable object type + ID per card |
| Boost action (rocket reaction) | Medium | Same complexity as like |
| Reply action (comments) | Medium | Only works on issues/PRs, need to determine target type |
| Follow/unfollow | Low | Simple API |
| Thread view | Medium | Fetch issue/PR comments as thread |
| Notifications (Beginning) | Medium | Different model than Bluesky -- thread-based, not action-based |
| Escape hatch URLs | Low | URL templates are predictable |

**Overall: Medium difficulty.** The hardest part is the event-to-post transformation layer -- there are many event types and each has unique payload structures. But the API itself is clean, CORS works, and auth is straightforward.

---

## 10. Suggested Implementation Approach

### Phase 1: Read-Only Feed (MVP)

**Goal:** Browse GitHub social activity through JKLB with j/k navigation.

1. Register a GitHub OAuth App (for Device Flow client_id)
2. Implement Device Flow auth in the adapter
3. Implement `fetchFeed()` using `GET /users/{username}/received_events`
4. Build event-to-JKLBPost transformers for the top 5 event types:
   - IssuesEvent
   - IssueCommentEvent
   - PullRequestEvent
   - PushEvent
   - WatchEvent
5. Filter out low-value events (DeleteEvent, GollumEvent, MemberEvent)
6. Wire up escape hatch URLs (v key)

**Capabilities for Phase 1:**
```typescript
{
  notifications: false,
  multipleFeeds: false,
  threads: false,
  quotePosts: false,
  follow: false,
  coverPhotos: false,
  reply: false,
  mentions: false,
  hashtags: false,
}
```

### Phase 2: Write Actions

7. Implement `toggleLike()` -- add/remove +1 reaction (or star repo as fallback)
8. Implement `toggleBoost()` -- add/remove rocket reaction (or star repo)
9. Implement `toggleFollow()` -- follow/unfollow event actors
10. Track reactable object references (type + owner + repo + number) per event card

### Phase 3: Comments and Threads

11. Implement `reply()` -- post comments on issues/PRs
12. Implement `fetchThread()` -- load issue/PR comment threads
13. Add remaining event type transformers (ReleaseEvent, ForkEvent, CreateEvent, DiscussionEvent)

### Phase 4: Notifications and Polish

14. Implement `fetchNotifications()` for Beginning flow
15. Add multiple feed options (personal activity, public feed, repo-specific)
16. Implement mention facets for @username references in comments
17. Polish card rendering for each event type

### Fixture Data Checklist

Collect real events from the API covering:
- Issue opened (short body)
- Issue opened (long body with markdown)
- Issue comment (with @mentions)
- PR opened
- PR merged
- Push with 1 commit
- Push with many commits (tests summarization)
- Star event
- Fork event
- Release event (with release notes)
- Repo creation
- Discussion created
- User with avatar
- User without avatar (tests fallback)
- Event on a private repo (tests auth-gated visibility)

---

## 11. Open Questions for Jake

1. **Event filtering:** Should JKLB show ALL event types or curate to the most social ones? Recommendation: start with a whitelist of high-value events (Issues, PRs, Comments, Stars, Releases) and add more based on feedback.

2. **Like semantics:** When the user presses l on a star event (which has no reaction target), should it (a) star the repo, (b) do nothing, or (c) something else?

3. **Feed naming:** What should the default feed be called? "My Feed", "Dashboard", "Following Activity"?

4. **PushEvent rendering:** A push with 10 commits -- show all commit messages? Just the first? A summary like "X pushed 10 commits to owner/repo"?

5. **Markdown rendering:** GitHub issues and comments use markdown. Should JKLB render markdown in cards, or strip it to plain text? The spec says "plain text" but GitHub content is inherently markdown.

6. **Priority:** Where does GitHub rank vs. other potential protocols (Strava, Margin, etc.) for implementation order?

---

## Appendix A: Example API Calls

```bash
# Get your personalized feed (auth required)
curl -H "Authorization: bearer ghp_xxxx" \
  https://api.github.com/users/jakesimonds/received_events

# Get anyone's public activity (no auth needed but rate-limited)
curl https://api.github.com/users/torvalds/events/public

# Star a repo
curl -X PUT -H "Authorization: bearer ghp_xxxx" \
  https://api.github.com/user/starred/owner/repo

# Add a rocket reaction to an issue
curl -X POST -H "Authorization: bearer ghp_xxxx" \
  -H "Content-Type: application/json" \
  -d '{"content":"rocket"}' \
  https://api.github.com/repos/owner/repo/issues/42/reactions

# Follow a user
curl -X PUT -H "Authorization: bearer ghp_xxxx" \
  https://api.github.com/user/following/octocat

# Device Flow: Step 1 - request device code
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"client_id":"YOUR_CLIENT_ID","scope":"read:user"}' \
  https://github.com/login/device/code

# Device Flow: Step 2 - poll for token
curl -X POST \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"client_id":"YOUR_CLIENT_ID","device_code":"DEVICE_CODE","grant_type":"urn:ietf:params:oauth:grant-type:device_code"}' \
  https://github.com/login/oauth/access_token

# GraphQL: user profile
curl -X POST -H "Authorization: bearer ghp_xxxx" \
  -H "Content-Type: application/json" \
  -d '{"query":"{ viewer { login name bio avatarUrl followers { totalCount } following { totalCount } } }"}' \
  https://api.github.com/graphql

# Get notifications
curl -H "Authorization: bearer ghp_xxxx" \
  https://api.github.com/notifications
```

---

## Appendix B: Key Reference Links

- GitHub REST API Events: https://docs.github.com/en/rest/activity/events
- GitHub Event Types: https://docs.github.com/en/rest/using-the-rest-api/github-event-types
- GitHub REST API Feeds: https://docs.github.com/en/rest/activity/feeds
- GitHub REST API Reactions: https://docs.github.com/en/rest/reactions/reactions
- GitHub REST API Starring: https://docs.github.com/en/rest/activity/starring
- GitHub REST API Followers: https://docs.github.com/en/rest/users/followers
- GitHub OAuth Scopes: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps
- GitHub OAuth Authorization Flow: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps
- GitHub PKCE Support (July 2025): https://github.blog/changelog/2025-07-14-pkce-support-for-oauth-and-github-app-authentication/
- GitHub CORS/JSONP: https://docs.github.com/en/rest/using-the-rest-api/using-cors-and-jsonp-to-make-cross-origin-requests
- GitHub Rate Limits: https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api
- GitHub GraphQL API: https://docs.github.com/en/graphql
- GitHub Fine-Grained PAT Permissions: https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens
- GitHub Event Data Retention Change: https://github.blog/changelog/2024-11-08-upcoming-changes-to-data-retention-for-events-api-atom-feed-timeline-and-dashboard-feed-features/
- GitHub Dashboard Updates (2025): https://github.blog/changelog/2025-10-28-home-dashboard-update-in-public-preview/
