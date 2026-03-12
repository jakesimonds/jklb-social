# Backend Architecture

*Last updated: March 11, 2026*

## Philosophy

jklb.social uses a **hybrid storage** model:

- **PDS (Personal Data Server)** is the canonical home for user records. Awards are ATProto-native — they live in custom Lexicon collections on each user's PDS, making them portable and verifiable.
- **Cloudflare KV** provides fast indexes and community-level state (counters, member directories, ephemeral post tracking). KV is the "read index" — if it disappeared, PDS records would still exist.
- **Cloudflare Pages Functions** (`/functions/api/*`) are the serverless backend. They auto-route to `/api/*` endpoints. No heavy backend, no database — just KV + PDS writes via raw XRPC calls.

The system is deliberately lightweight: each function authenticates as the `jklb.social` community Bluesky account to perform PDS operations on behalf of users.

---

## KV Namespaces

Defined in `wrangler.toml`:

| Binding | Purpose | ID |
|---|---|---|
| `NOMINATIONS` | Award nominations index (legacy, reserved) | `fc1a57395beb48949585d9c9b8607056` |
| `COMMUNITY_POSTS` | Ephemeral community photo posts (48h auto-delete) | `6484d4e2b2c54df0bae97bdd80918974` |
| `TROPHIES` | Trophy system — participation trophies, awards, member records | `028ad3d73d0c4b869ced62e4d83db8c5` |

---

## KV Key Patterns

### TROPHIES namespace

| Key | Type | Description |
|---|---|---|
| `participation:counter` | `string` (number as text) | Global sequential counter for participation trophy numbering |
| `member:{did}` | `JSON (CommunityMember)` | Full member record including all awards |
| `community:members` | `JSON (string[])` | Index of all member DIDs |

### COMMUNITY_POSTS namespace

| Key | Type | Description |
|---|---|---|
| `jklb:{rkey}` | `JSON (CommunityPostEntry)` | Tracks a community photo post for cleanup. Shape: `{ uri, cid, createdAt }` |

---

## API Endpoints

### `POST /api/community-post`

Posts a community photo to the `jklb.social` Bluesky account on behalf of a user.

**Request**: `multipart/form-data`
- `image` (File, required) — JPEG image
- `caption` (string, required) — must be one of: `"Look where I am"`, `"Look at this"`, `"Check this out"`, `"Felt cute"`
- `userHandle` (string, required) — poster's Bluesky handle
- `includeUsername` (string, optional) — `"false"` to omit mention; defaults to true
- `imageWidth` / `imageHeight` (string, optional) — for aspect ratio embed

**Response**: `{ ok: true, uri: string }`

**KV writes**: `COMMUNITY_POSTS` — stores `jklb:{rkey}` entry for 48h cleanup tracking

**PDS operations**: Creates an `app.bsky.feed.post` record on the jklb.social account with an image embed and optional mention facet. On each request, runs piggyback cleanup — deletes any tracked posts older than 48 hours from both PDS and KV.

**Related PDS collection**: `app.bsky.feed.post` (standard Bluesky post)

---

### `POST /api/participation`

Claims a participation trophy. Idempotent — returns existing trophy if already claimed.

**Request**: `application/json`
```
{ did: string, handle: string }
```

**Response**: `{ number: number, claimedAt: string }`

**KV writes** (TROPHIES namespace):
- Increments `participation:counter`
- Creates/updates `member:{did}` with participation trophy data
- Appends DID to `community:members` index if new

**Related PDS collection**: `social.jklb.participationTrophy`

---

### `GET /api/participation?did={did}`

Looks up a CommunityMember record by DID.

**Response**: Full `CommunityMember` object or `null`

---

### `POST /api/best-thing`

Records a "Best Thing I Saw" award action. Supports two actions:

**Give action** — records that a user nominated someone:
```
{
  action: "give",
  giverDid: string,
  giverHandle: string,
  recipientDid: string,
  subjectUri: string,
  nominationUri: string
}
```
Response: `{ ok: true, action: "give", giverDid: string }`

**Win action** — records that a user claimed a nomination:
```
{
  action: "win",
  winnerDid: string,
  winnerHandle: string,
  nominatedByDid: string,
  subjectUri: string
}
```
Response: `{ ok: true, action: "win", winnerDid: string }`

**KV writes** (TROPHIES namespace):
- Creates/updates `member:{did}` — appends to `bestThingISawGiven` or `bestThingISawWon` arrays
- Deduplicates by `nominationUri` (give) or `subjectUri + nominatedByDid` (win)
- Appends DID to `community:members` index if new member

**Related PDS collections**: `social.jklb.bestThingISawAwardGiver`, `social.jklb.bestThingISawAwardWinner`

---

### `GET /api/best-thing?did={did}`

Looks up a member's best-thing awards by DID.

**Response**: `{ given: [...], won: [...] }` — returns empty arrays if member not found

---

### `/api/nominations` (DEPRECATED)

Returns a 301 with `{ error, redirect }` pointing to `/api/best-thing`. Kept for backwards compatibility.

---

## PDS Collections

| Collection | Mode | Description |
|---|---|---|
| `social.jklb.participationTrophy` | claim (self-serve) | One-time participation trophy. Level 1 award. |
| `social.jklb.bestThingISawAwardGiver` | give (nominate) | Records that a user nominated someone's post. Level 2, repeatable. Requires `participationTrophy`. |
| `social.jklb.bestThingISawAwardWinner` | give (nominate) | Records that a user won (was nominated for) an award. |

Awards form a progressive chain: claim participation trophy (level 1) to unlock "Best Thing I Saw" nominations (level 2).

---

## CommunityMember Type

Defined in `src/types/awards.ts`:

```ts
type CommunityMember = {
  did: string;
  handle: string;
  joinedAt: string;
  awards: {
    participationTrophy: {
      number: number;
      claimedAt: string;
    } | null;
    bestThingISawGiven: Array<{
      recipientDid: string;
      subjectUri: string;
      nominationUri: string;
      givenAt: string;
    }>;
    bestThingISawWon: Array<{
      nominatedByDid: string;
      subjectUri: string;
      claimedAt: string;
    }>;
  };
};
```

---

## Environment Variables

Set in Cloudflare Pages dashboard (not in code):

| Variable | Used by | Purpose |
|---|---|---|
| `JKLB_APP_PASSWORD` | `community-post.ts` | App password for the jklb.social Bluesky account |
| `JKLB_DID` | `community-post.ts` | DID of the jklb.social community account |

The `participation.ts` and `best-thing.ts` endpoints only use KV (no PDS auth needed) — PDS writes for awards happen client-side.
