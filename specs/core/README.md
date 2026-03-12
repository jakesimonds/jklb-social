# The JKLB Specification

A UX specification for building keyboard-first, single-viewport social media clients on any open social network.

## What This Is

The JKLB Specification defines a set of rules and interfaces that, when implemented against any social network with posts, authentication, and feeds, produces a consistent "JKLB experience" — a mindful, structured, keyboard-driven way to browse social media.

It is not a wire protocol. It does not define how networks talk to each other. It defines how a **client** should behave, and what it needs from the underlying network to function.

## Documents

| File | What It Covers |
|------|---------------|
| [jklb-spec.md](./jklb-spec.md) | The full specification — principles, requirements, UI structure, keybindings |
| [adapter.ts](./adapter.ts) | TypeScript `NetworkAdapter` interface — the contract an implementation must fulfill |
| [implementations.md](./implementations.md) | Current implementations and how to submit a new one |

## The Adapter Pattern

The spec defines a `NetworkAdapter` interface in TypeScript. To port JKLB to a new network, you implement this interface for your network's API. The adapter handles:

- Authentication (login/logout)
- Fetching a feed of posts
- Post actions (like, boost, reply, quote)
- Thread fetching
- Profile resolution

Everything else — the UI, the keybindings, the layout, the three-act structure — is defined by the spec and stays the same across implementations.

## Current Implementations

| Network | Protocol | Repo | Status |
|---------|----------|------|--------|
| Bluesky | AT Protocol | russAbbot (this repo) | Full (Tier 3) |
| Farcaster | Farcaster | farcaster-jklb | In progress (Tier 1) |
| The Forkiverse | ActivityPub / Mastodon | forkiverse-jklb | In progress (Tier 1) |

## Tiers

- **Tier 1 (Reader):** Feed browsing + navigation. Middle flow only.
- **Tier 2 (Participant):** Auth + write actions (like, boost, reply, quote).
- **Tier 3 (Full JKLB):** All three acts, Chorus, notifications, End screen.

All implementations must reach at least Tier 2 to be considered JKLB-compliant. Tier 1 is a valid development milestone but not a shipping state.

## Interested in building one?

See [implementations.md](./implementations.md) for details. Short version: message Jake.
