# Workout Planner

A free, offline-first iOS and Android app for following structured strength-training plans.

Open the app and see today's workout in one tap: the current week at a glance, where you are
in the plan, loads calculated from your training max, PR detection, and end-of-cycle reviews
that suggest an increase you confirm, edit or decline.

No accounts, no backend, no tracking, no ads, no paywalls. All data lives on the device.

## Status

Slices 0–3 of 15 are done ([docs/BUILD_PLAN.md](docs/BUILD_PLAN.md)): tooling and CI, the core
training maths, the SQLite schema and repositories, and the schedule engine, all tested with no UI.
The screens start at Slice 4.

## Why I built this

I was running my training out of Notion: one database row per workout, stretched across a 12-week
plan. It worked, but it couldn't calculate loads from a training max, it couldn't tell me what was
missed, and adjusting the schedule after a missed week meant editing rows by hand.

Every app that did those things wanted a subscription for them. So this one is free — no paywalls,
no premium tier, no ads, no accounts, no tracking, and no running costs to pass on (SRS §1.3). It
works entirely offline, because a gym is the worst place to depend on a signal.

It is also built the way I'd want to build software professionally: a written specification before
any code, requirement IDs traced from the spec through the tests to the commits, and CI that has to
be green (SRS §1.4).

## Screenshots

_Pending — the UI starts at Slice 4 ([docs/BUILD_PLAN.md](docs/BUILD_PLAN.md))._

## Stack

React Native 0.86 + Expo SDK 57 · React 19 · TypeScript 6 (strict) · Expo Router · SQLite via
Drizzle · Jest (Node + jest-expo projects) · Node 22 · MIT licensed.

## Documentation

| File | What it is |
|---|---|
| [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md) | The SRS — **what** to build (FR-*, NFR-*, AC-*). Source of truth. |
| [docs/DESIGN.md](docs/DESIGN.md) | The design — **how** it is built (D-*, C-*). |
| [docs/BUILD_PLAN.md](docs/BUILD_PLAN.md) | The build order — **when**, as 16 vertical slices with exit checks and status. |
| [docs/SETUP.md](docs/SETUP.md) | One-time repository setup and the working rhythm. |
| [docs/RELEASE_CHECKLIST.md](docs/RELEASE_CHECKLIST.md) | Manual on-device checks before a store build. |
| [CLAUDE.md](CLAUDE.md) | Always-loaded instructions for Claude Code. |
| [CHANGELOG.md](CHANGELOG.md) | Released changes. |

If the SRS and the design disagree, the SRS wins. Both are long — search for the ID you need
rather than reading them end to end.

## Development

```sh
npm ci
npm run check      # typecheck, lint, format check, tests, AC coverage — what CI runs
npm test           # all Jest projects
npm run test:core  # pure-logic tests with coverage
npm run check:ac   # acceptance criteria for this release that still lack a test
npx expo start     # run the app
```

Scope is gated by release: only requirements tagged for the current release in SRS §11 are
built, and later work sits behind `isEnabled(...)` in [src/config/release.ts](src/config/release.ts).

## Working with Claude Code

The repository is configured for [Claude Code](https://claude.com/claude-code):

- `CLAUDE.md` and `.claude/rules/*.md` — always-loaded and path-scoped instructions
- `.claude/skills/` — `/next-step`, `/implement`, `/ac-test`, `/spec-change`, `/release-check`
- `.claude/agents/` — read-only `spec-reviewer` and `architecture-reviewer`
- `.claude/hooks/` — layer and determinism guards, formatting, and a pre-finish typecheck

## Licence

MIT — see [LICENSE](LICENSE). Bundled third-party software is listed in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
