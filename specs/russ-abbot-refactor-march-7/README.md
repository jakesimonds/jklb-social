# Russ Abbot Refactor — March 7, 2026

## Goal

Refactor the Bluesky reference implementation so its internals follow the adapter pattern defined in `specs/core/adapter.ts`. **No behavior changes.** The app stays the same from the user's perspective — same look, same feel, same features. The internals change so that:

1. AT Protocol specifics are isolated behind a `BlueskyAdapter` that implements `NetworkAdapter`
2. UI code speaks only the universal `JKLBPost` / `JKLBAuthor` / `JKLBMedia` types
3. The `@atproto/api` import boundary stops at the adapter — nothing else imports it

This is a **refactor for portability**, not a rewrite. The reference implementation becomes the proof that the spec works.

## Documents

| File | What It Covers |
|------|---------------|
| [00-executive-summary.md](./00-executive-summary.md) | High-level overview, scope, and success criteria |
| [01-data-model.md](./01-data-model.md) | Type mapping: current `Post` -> `JKLBPost`, field-by-field |
| [02-adapter-implementation.md](./02-adapter-implementation.md) | Building the `BlueskyAdapter` class |
| [03-import-boundary.md](./03-import-boundary.md) | Full inventory of files that import `@atproto/api` and what to do about each |
| [04-ui-cleanup.md](./04-ui-cleanup.md) | Hardcoded Bluesky URLs, naming, and UI-layer coupling |
| [05-settings-and-misc.md](./05-settings-and-misc.md) | Settings gaps, composer limits, LLM prompt, minor issues |
| [06-task-sequence.md](./06-task-sequence.md) | Ordered Ralph tasks for executing this refactor |

## Principles

- **No behavior changes** — if a user can tell something changed, that's a bug
- **No new features** — resist the urge to improve while refactoring
- **Adapter owns the network** — all `@atproto/api` imports live in `src/adapters/bluesky/`
- **Types are the contract** — `specs/core/adapter.ts` types are the source of truth
- **Test with fixture data** — verify the adapter produces valid `JKLBPost` objects before wiring up
- **One PR per task** — keep changes reviewable
