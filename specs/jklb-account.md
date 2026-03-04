# Spec: JKLB.social Bluesky Account

> **Status: PARTIALLY IMPLEMENTED.** The community photo posting infra is specced in `community-infra.md`. The broader vision described here is not yet built.

---

## What It Is

`jklb.social` is a Bluesky account that serves as a **community resource**. It's not Jake's personal account — it belongs to the app and its users.

Users can post to this account through JKLB's End Screen buttons. The account holds community content that is often ephemeral (auto-deleting) or collaborative.

---

## Use Cases

### Award Nominations
When a user nominates a post for a JKLB award, the nomination lives on the jklb.social account. The author of the nominated post can accept or interact with it. The jklb.social feed becomes a record of what the community found noteworthy.

### Community Photos
Self-deleting photos posted from the End Screen directly to the jklb.social account. Photos auto-delete after 48 hours.

### Ephemeral Content
The account could hold other self-deleting or time-limited content — the pattern is: users contribute something, it lives on jklb.social for a while, then it cleans itself up.

### Message in a Bottle
(Future — see `end-screen.md`) A message stored in Cloudflare KV, shown to the next JKLB user, then deleted. This doesn't necessarily live on the Bluesky account — could be KV-only.

---

## Infrastructure

- **Bluesky account:** `jklb.social` (custom handle via DNS)
- **Posting mechanism:** Cloudflare Pages Functions (server-side, using app password)
- **Cleanup:** Piggyback on POST requests — scan KV for expired entries, delete via ATProto
- **Storage:** Cloudflare KV for tracking post URIs and expiration

---

## Relationship to End Screen

The jklb.social account is one of the key pieces that makes End Screen buttons possible. Several buttons post to or read from this account. See `specs/end-screen.md`.

---

*This spec will evolve as more community features are built.*
