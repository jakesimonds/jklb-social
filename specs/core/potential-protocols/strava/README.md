# Strava Protocol Spec for JKLB

Research date: March 2026

## TL;DR — Feasibility Verdict

**Strava as a JKLB protocol is effectively blocked by policy, not by technology.**

The Strava API v3 exists and works. OAuth is standard and doable. But three compounding problems make a social client impossible under the current API agreement:

1. **No feed endpoint** — There is no API endpoint to fetch activities from followed athletes. You can only fetch the authenticated user's own activities.
2. **No write social actions** — You cannot give kudos or post comments via the API. These are read-only (GET) endpoints.
3. **API agreement explicitly bans this use case** — As of November 2024, Strava's API agreement prohibits displaying one user's data to any other user, prohibits building competitive applications, and prohibits web scraping.

Building a JKLB Strava adapter would require violating Strava's terms of service. The rest of this spec documents the technical details for reference, in case the policy landscape changes.

---

## 1. What Strava's Social Feed Contains

Strava's native feed (visible in the app and on strava.com) contains:

- **Activities** — Runs, rides, swims, hikes, etc. Each has a title, description, distance, duration, elevation, pace/speed, map, photos, and activity type
- **Kudos** — Strava's version of a "like." Users tap a thumbs-up on activities
- **Comments** — Text comments on activities
- **Club posts** — Text posts within club discussion boards
- **Group activities** — Activities that were recorded simultaneously with other users
- **Segments** — Starred segments and leaderboard entries (KOMs/QOMs/CRs)
- **Challenges** — Monthly/weekly challenges and badges

The feed is chronological, showing activities from athletes the user follows, plus club activity.

---

## 2. Strava API v3 — Endpoint Inventory

Base URL: `https://www.strava.com/api/v3`

### 2.1 Activity Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/athlete/activities` | List authenticated athlete's own activities |
| GET | `/activities/{id}` | Get a single activity by ID |
| POST | `/activities` | Create a manual activity |
| PUT | `/activities/{id}` | Update an activity (title, description, type, gear) |
| GET | `/activities/{id}/comments` | List comments on an activity (READ ONLY) |
| GET | `/activities/{id}/kudos` | List athletes who gave kudos (READ ONLY) |
| GET | `/activities/{id}/laps` | List laps |
| GET | `/activities/{id}/zones` | Get HR/power zones for the activity |
| GET | `/activities/{id}/streams` | Get time-series data (GPS, HR, power, etc.) |

### 2.2 Athlete Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/athlete` | Get authenticated athlete profile |
| GET | `/athletes/{id}/stats` | Get athlete's all-time statistics |
| GET | `/athlete/zones` | Get HR/power zone configuration |

### 2.3 Club Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/athlete/clubs` | List clubs the athlete belongs to |
| GET | `/clubs/{id}` | Get club details |
| GET | `/clubs/{id}/members` | List club members |
| GET | `/clubs/{id}/admins` | List club admins |
| GET | `/clubs/{id}/activities` | List recent activities by club members |

### 2.4 Other Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/segments/{id}` | Segment details |
| GET | `/segments/explore` | Find segments in a geographic area |
| GET | `/routes/{id}` | Route details |
| GET | `/gears/{id}` | Equipment details |
| POST | `/uploads` | Upload an activity file (FIT, GPX, TCX) |

### 2.5 What's Missing (Critical)

| Missing Capability | Impact |
|---|---|
| **No feed endpoint** | Cannot fetch followed athletes' activities. `/athlete/activities` only returns YOUR activities. There is no `/feed` or `/athlete/following/activities` endpoint. |
| **No POST kudos** | Cannot give kudos via API. Only `GET /activities/{id}/kudos` exists (read who gave kudos). |
| **No POST comments** | Cannot post comments via API. Only `GET /activities/{id}/comments` exists (read existing comments). |
| **No follow/unfollow** | Cannot manage social graph via API. |
| **No notifications** | No endpoint for inbound social interactions. |

### 2.6 Rate Limits

| Limit Type | 15-min Window | Daily |
|---|---|---|
| Overall (all endpoints) | 200 requests | 2,000 requests |
| Read endpoints (non-upload) | 100 requests | 1,000 requests |

- Rate limit status returned in headers: `X-RateLimit-Limit`, `X-RateLimit-Usage`
- Exceeding limits returns `429 Too Many Requests`
- 15-minute windows reset at :00, :15, :30, :45
- Daily limit resets at midnight UTC
- Rate limit increases available only through formal review process

---

## 3. Authentication — OAuth 2.0

### 3.1 The Flow

Strava uses standard OAuth 2.0 Authorization Code flow.

**Step 1: Register an app** at `https://www.strava.com/settings/api`
- Get `client_id` and `client_secret`
- Set callback domain (localhost/127.0.0.1 whitelisted for dev)

**Step 2: Redirect user to authorize**
```
GET https://www.strava.com/oauth/authorize
  ?client_id={CLIENT_ID}
  &redirect_uri={REDIRECT_URI}
  &response_type=code
  &scope=read,activity:read
  &approval_prompt=auto
```

**Step 3: User authorizes, Strava redirects back with code**
```
{REDIRECT_URI}?code={AUTH_CODE}&scope=read,activity:read
```

**Step 4: Exchange code for tokens**
```
POST https://www.strava.com/oauth/token
  client_id={CLIENT_ID}
  client_secret={CLIENT_SECRET}
  code={AUTH_CODE}
  grant_type=authorization_code
```

Returns:
```json
{
  "token_type": "Bearer",
  "access_token": "abc123...",
  "refresh_token": "def456...",
  "expires_at": 1568775134,
  "expires_in": 21600,
  "athlete": { "id": 12345, "firstname": "Jake", ... }
}
```

**Step 5: Refresh tokens (access tokens expire after 6 hours)**
```
POST https://www.strava.com/oauth/token
  client_id={CLIENT_ID}
  client_secret={CLIENT_SECRET}
  refresh_token={REFRESH_TOKEN}
  grant_type=refresh_token
```

### 3.2 Available Scopes

| Scope | Description |
|-------|-------------|
| `read` | Public segments, routes, profile data, posts, events, club feeds, leaderboards |
| `read_all` | Private routes, segments, events |
| `profile:read_all` | All profile info regardless of privacy settings |
| `profile:write` | Update weight, FTP; star segments |
| `activity:read` | Read activities with Everyone/Followers visibility |
| `activity:read_all` | Read all activities including "Only You" visibility |
| `activity:write` | Create/edit activities and uploads |

For a JKLB read-only feed: `read,activity:read` would suffice.

### 3.3 "Sign in with Google" — Does It Complicate Things?

**No.** How the user signed up for Strava (Google, Facebook, Apple, email) does not affect OAuth for third-party apps. The OAuth flow authenticates against Strava's own identity system, not the upstream identity provider. Jake's Google sign-in for Strava is irrelevant — the third-party app redirects to Strava, Strava handles its own login (however the user logs in), and returns tokens.

One caveat: "Google Sign-in will not work for applications using a mobile webview" — but this only matters for mobile apps embedding a webview, not for a desktop web app like JKLB.

### 3.4 Auth for a Web App (JKLB's Architecture)

JKLB is a pure client-side app (static site, no backend). This creates a problem:

- The token exchange (Step 4) requires the `client_secret`
- `client_secret` cannot be exposed in client-side JavaScript
- Strava does NOT support PKCE (Proof Key for Code Exchange), which would solve this

**Options:**
1. **Cloudflare Worker proxy** — A tiny serverless function that holds the `client_secret` and proxies the token exchange. This is the standard approach and fits JKLB's Cloudflare Pages deployment model.
2. **Manual token paste** — User gets tokens from Strava's API settings page and pastes them. Terrible UX, but technically works for a personal tool.

The Worker proxy approach is viable and consistent with how JKLB already handles its one server-side feature (the JKLB Award post).

### 3.5 Auth Verdict

*Auth is completely doable.* Standard OAuth 2.0, well-documented, works for third-party apps regardless of how the user signed up. The `client_secret` issue is solved with a lightweight Worker proxy. This is NOT the blocker.

---

## 4. The Three Dealbreakers

### 4.1 Dealbreaker #1: No Feed Endpoint

The Strava API does not expose a feed of followed athletes' activities. You can only get the authenticated user's own activities via `GET /athlete/activities`.

The only workaround would require every athlete the user follows to also authorize your app — then you poll each of their activities individually. This is absurd for a social feed client.

The club activities endpoint (`GET /clubs/{id}/activities`) does return other members' recent activities, but only within a specific club context.

### 4.2 Dealbreaker #2: No Social Write Actions

You cannot give kudos or post comments through the API. Both endpoints are read-only:

- `GET /activities/{id}/kudos` — lists who gave kudos (owner-only access)
- `GET /activities/{id}/comments` — lists comments

There is no `POST /activities/{id}/kudos` or `POST /activities/{id}/comments`.

This means JKLB's core interaction model (like = kudos, reply = comment) has no API support.

### 4.3 Dealbreaker #3: API Agreement Prohibits This Use Case

Strava's API Agreement (updated November 11, 2024) contains several provisions that explicitly block a social client:

**Cannot display other users' data:**
> "You may only display or disclose to an end user the specific Strava Data related to that user. For the avoidance of doubt, you may not display or disclose Strava Data related to other users, even if such data is publicly viewable on Strava's Platform."

**Cannot build competitive applications:**
> "You may not use the Strava API Materials in any manner that is competitive to Strava or the Strava Platform."

**Cannot scrape the web UI as a workaround:**
> "You may not use web scraping, web harvesting, or web data extraction methods to extract data from the Strava Platform."

**Cannot use AI/ML on the data:**
> "You may not use the Strava API Materials... for any model training related to artificial intelligence, machine learning or similar applications."

A JKLB Strava adapter — which would display a feed of followed athletes' activities in an alternative client — violates at minimum the first two provisions. Web scraping to work around API gaps violates the third.

---

## 5. Mapping Strava to JKLB's Data Model

If the dealbreakers were somehow resolved, here's how Strava maps to JKLB:

### 5.1 JKLBPost Mapping

| JKLBPost Field | Strava Source |
|---|---|
| `id` | Activity ID (numeric, stringified) |
| `author.id` | Athlete ID |
| `author.handle` | Athlete username (no @ prefix in Strava) |
| `author.displayName` | `firstname + " " + lastname` |
| `author.avatarUrl` | `athlete.profile` (or `profile_medium`) |
| `author.bannerUrl` | `null` (Strava has no banner/cover photos) |
| `author.bio` | Athlete bio (from detailed profile) |
| `author.profileUrl` | `https://www.strava.com/athletes/{id}` |
| `text` | Activity name + description + stats summary |
| `linkFacets` | Empty (Strava activities don't have inline links) |
| `mentionFacets` | Empty (no inline mentions in activities) |
| `hashtagFacets` | Empty (no hashtags in Strava) |
| `createdAt` | `start_date` (ISO 8601) |
| `media` | Activity photos (via `/activities/{id}/photos`), map polyline rendered as image |
| `quotedPost` | `null` (no quote concept) |
| `replyParentId` | `null` (activities aren't replies) |
| `repostBy` | `null` (no repost concept) |
| `isLiked` | Whether current user gave kudos (not available via API for others' activities) |
| `isBoosted` | `false` (no boost concept) |
| `nativeUrl` | `https://www.strava.com/activities/{id}` |

### 5.2 Social Action Mapping

| JKLB Action | Strava Equivalent | API Support |
|---|---|---|
| Like (L key) | Kudos | NO — read-only |
| Boost (B key) | N/A | No concept exists |
| Reply (R key) | Comment | NO — read-only |
| Quote (Q key) | N/A | No concept exists |
| Follow (F key) | Follow athlete | NO — not in API |
| Escape hatch (V key) | Open on strava.com | YES — URL constructable |

### 5.3 Post Text Construction

Since Strava activities aren't text posts, the adapter would need to construct a text representation:

```
Morning Run — 5.2 mi in 42:15
Pace: 8:07/mi | Elevation: 320 ft
Felt great today, perfect weather for a tempo run.
```

Components:
- Line 1: Activity name + distance + time
- Line 2: Pace/speed + elevation gain
- Line 3: User-written description (if any)

### 5.4 Club Activities as a Partial Workaround

`GET /clubs/{id}/activities` returns recent activities from club members. This is the closest thing to a "feed" in the API. A JKLB adapter could:

- Fetch the user's clubs via `GET /athlete/clubs`
- For each club, fetch `GET /clubs/{id}/activities`
- Merge and sort chronologically
- Display as a feed

This still violates the API agreement's data display restrictions, and clubs are a subset of who you follow, but it's the closest technical path.

---

## 6. Alternative Platforms Researched

### 6.1 Garmin Connect

- **API access**: Requires approval through the Garmin Connect Developer Program. Manual review process, biased toward commercial developers.
- **Social features**: Has challenges, social feed, and activity sharing — but the API is enterprise-focused and does not expose social graph data to individual developers.
- **Auth**: OAuth 2.0 with PKCE support
- **Verdict**: Even harder to access than Strava. Not a viable alternative.

### 6.2 Peloton

- **API**: Undocumented/unofficial. No public developer program.
- **Social features**: Minimal social feed. Leaderboards and following exist in-app.
- **Integration**: Works through Google Health Connect on Android, Apple HealthKit on iOS.
- **Verdict**: No official API, no social feed access. Not viable.

### 6.3 Under Armour / MapMyFitness

- **API**: Connected Fitness platform with OAuth 2.0 and SDKs.
- **Social features**: 200M+ users, social environment similar to Strava.
- **Verdict**: Most promising alternative in terms of API availability, but the social feed functionality and developer access would need deeper research.

### 6.4 ActivityPub / Federated Fitness

- **Status**: Some interest in building ActivityPub-based fitness tracking apps (e.g., Endurain), but nothing production-ready.
- **Concept**: Activities as ActivityPub objects would be ideal for JKLB's model — federated, open protocol, no API agreement restrictions.
- **Verdict**: Doesn't exist yet in any usable form. Worth watching.

### 6.5 Strava Web Scraping Libraries

Some open-source projects extend the Strava API via web scraping:

- **stravaweblib** (Python) — Adds activity downloads, equipment tracking. Does NOT add kudos, feed reading, or commenting.
- **strava-auto-kudos** (multiple implementations) — Browser automation (Selenium/Playwright) to give kudos by clicking buttons on the feed page. Fragile, slow, violates ToS.
- **Browser extensions** — Chrome extensions that auto-kudos when visiting the Strava feed page.

All scraping approaches violate the API agreement and are inherently fragile.

---

## 7. What Would Need to Change

For Strava to become a viable JKLB protocol, ANY of these would need to happen:

### 7.1 Strava Opens the API (Unlikely)

- Add a feed endpoint for followed athletes' activities
- Add POST endpoints for kudos and comments
- Relax the data display restrictions for authorized social clients

Strava has been moving in the opposite direction — restricting API access, not expanding it. This scenario is unlikely.

### 7.2 Community Application Exception

The API agreement mentions "Community Applications" (groups under 10,000 users) that may have different rules for displaying data across users. This would require Strava's explicit classification and approval. JKLB would need to apply for this status.

### 7.3 Personal-Use-Only Mode

A degraded adapter that only shows the authenticated user's OWN activities. This technically complies with the API agreement but defeats the purpose — it's not a social feed, it's a personal activity log. Still missing kudos/comment write capability.

### 7.4 Strava Partner Program

Commercial partners (e.g., Wahoo, Garmin, TrainingPeaks) may have expanded API access. This requires a business relationship with Strava and likely revenue sharing. Not appropriate for an open-source project.

---

## 8. Implementation Tasks (If Dealbreakers Were Resolved)

These tasks assume a future where Strava's API supports the necessary endpoints. Kept here so Ralph can pick them up if the situation changes.

### 8.1 Auth Layer
- Create Cloudflare Worker for OAuth token exchange (holds `client_secret`)
- Implement OAuth redirect flow with `read,activity:read` scopes
- Token storage in localStorage with 6-hour expiry tracking
- Automatic refresh token rotation
- Login UI with "Connect with Strava" button (Strava brand guidelines require specific button styling)

### 8.2 Adapter Implementation
- Implement `NetworkAdapter` interface from `adapter.ts`
- Activity-to-JKLBPost transformation (construct text from activity data)
- Activity photos as media attachments
- Map polyline rendering (Strava provides encoded polylines — would need a lightweight decoder)
- Handle pagination for activity lists (page/per_page params)

### 8.3 Feed Construction
- Fetch own activities via `GET /athlete/activities`
- Fetch club activities via `GET /clubs/{id}/activities` for each club
- Merge, deduplicate, sort chronologically
- Rate-limit-aware fetching (100 reads per 15 minutes)

### 8.4 Social Actions (Require Endpoints That Don't Exist)
- Kudos (like) — needs POST endpoint
- Comment (reply) — needs POST endpoint
- Follow/unfollow — needs endpoint

### 8.5 Escape Hatch URLs
- Activity: `https://www.strava.com/activities/{id}`
- Athlete: `https://www.strava.com/athletes/{id}`
- Club: `https://www.strava.com/clubs/{id}`
- Segment: `https://www.strava.com/segments/{id}`

---

## 9. Honest Assessment

### What works
- OAuth 2.0 is standard and doable (Google sign-in is irrelevant to third-party auth)
- Activity data is rich and maps well to JKLB's card model
- Rate limits are reasonable for personal use (1,000 reads/day)
- Escape hatch URLs are trivially constructable

### What's broken
- No feed of followed athletes — the fundamental social feature
- No write actions for social interactions (kudos, comments)
- API agreement explicitly prohibits building an alternative social client
- Web scraping workarounds violate ToS and are fragile
- Strava is actively restricting API access, not opening it

### Recommendation

**Do not build a Strava adapter.** The API agreement is clear: this use case is prohibited. Even if you built it as a personal tool, you'd be operating on borrowed time — one ToS enforcement action and the tokens get revoked.

If fitness social feeds are interesting for JKLB, the more productive path is:
1. Watch for ActivityPub-based fitness platforms (federated, open protocol)
2. Monitor Strava's API agreement for changes (unlikely but possible)
3. Explore Under Armour/MapMyFitness API as an alternative
4. Consider a "personal activity log" mode that only shows the user's own Strava data (compliant but not social)

---

## Sources

- [Strava API v3 Reference](https://developers.strava.com/docs/reference/)
- [Strava Authentication Docs](https://developers.strava.com/docs/authentication/)
- [Strava Rate Limits](https://developers.strava.com/docs/rate-limits/)
- [Strava API Agreement](https://www.strava.com/legal/api)
- [Updates to Strava's API Agreement (Press Release)](https://press.strava.com/articles/updates-to-stravas-api-agreement)
- [DCRainmaker: Strava's Changes to Kill Off Apps](https://www.dcrainmaker.com/2024/11/stravas-changes-to-kill-off-apps.html)
- [Strava Community: API Call for Kudos](https://communityhub.strava.com/developers-api-7/api-call-for-kudos-1972)
- [stravaweblib (web scraping library)](https://github.com/pR0Ps/stravaweblib)
- [Garmin Connect Developer Program](https://developer.garmin.com/gc-developer-program/)
