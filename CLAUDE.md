# Workout Planner

A free, offline-first iOS and Android app for following structured strength-training plans. Built with React Native and Expo, TypeScript (strict), and SQLite through Drizzle. MIT licensed. No backend, no accounts, no tracking, zero running costs.

## Source of truth

- `docs/REQUIREMENTS.md` (the SRS) says **what** to build. `docs/DESIGN.md` says **how**. If they disagree, the SRS wins.
- Both files are long (over 1,000 lines each). **Don't read them whole.** Search for the ID you need, then read that section:
  - `grep -n "FR-4.6" docs/REQUIREMENTS.md`
  - `grep -n "§3.8\|D-21" docs/DESIGN.md`
- **Conflicts:** if a task, the existing code, or your own plan conflicts with either doc, stop and say so. Don't silently deviate. Propose a fix with `/spec-change`.
- **Open questions:** anything marked Open (SRS §9, DESIGN §1.2) is undecided. Ask; don't assume an answer.
- **Evidence-based training rules** (deloads, RPE, double progression, 1RM estimation, tapering) are deliberate. Don't simplify them; flag concerns instead.
- **Release scope:** build only what SRS §11 tags for the current release (`src/config/release.ts`). Work for later releases goes behind `isEnabled('<flag>')`.
- **Build order:** DESIGN §11 lists the build steps. Run `/next-step` to see where things stand.
- **Setup state:** `docs/SETUP.md` lists the one-time steps and which are still outstanding. Check it before assuming a toolchain command exists.

## Commands

- `npm run check`: everything CI runs locally (typecheck, lint, format check, tests, AC coverage). Run it before saying a task is done.
- `npm run typecheck`, `npm run lint`, `npm run format`
- `npm test`: all Jest projects. `npm run test:core`: pure-logic tests with coverage.
- `npx jest path/to/file.test.ts`: a single test file
- `npm run check:ac`: which acceptance criteria for this release still lack a test
- `npx expo start`: run the app (only when asked; it's interactive)

## Architecture (DESIGN §2)

Layers, from top to bottom:

1. `app/`: screens only
2. `src/ui/`: design-system components
3. `src/features/`: view-model hooks
4. `src/services/`: use cases, one transaction each
5. `src/data/` and `src/core/`

Rules:

- `src/core/` is pure TypeScript. It has no React, Expo, SQLite or Drizzle imports, and never reads the clock or makes random values or IDs. `today`, `now` and new IDs are passed in as arguments.
- `src/data/` imports only types from `src/core/`.
- Screens never import `src/data/`. Features may read through repository hooks, but **all writes go through `src/services/`**.
- Each service is one **exclusive** transaction (C-15) and ends by calling `reconcile(today)` when it changes plan state.
- `src/services/clock.ts` is the only place that reads the device clock.
- No business logic in components. Training maths (loads, e1RM, scheduling, reviews, progression, PRs) lives in `src/core/`.

## Domain essentials

- **Weights:** stored as kg (`REAL`). Rounding happens in the **display unit**, with ties rounded down (DESIGN §3.2).
- **Dates:** plan dates are `YYYY-MM-DD` local strings; event timestamps are UTC ISO strings. Never use `Date` for plan-date arithmetic; use `src/core/dates.ts`.
- **Stored vs derived:** TM, prescribed loads, missed status, progress and adherence are derived, never stored. The exception is prescribed loads, which are snapshotted into logs when a session starts.
- **Workouts and slots:** a workout is defined once per phase and placed on weekday slots (D-20). Double-progression state follows the workout.
- **Reviews and 1RMs:** Cycle Reviews belong to a cycle group (D-14). Pending reviews are refreshed or withdrawn by `reconcile` (D-21). A 1RM changes only when the user confirms it.

## Testing

- Test-first for anything in `src/core/` or `src/services/`. Target 100% coverage in `src/core/`.
- **Naming:** every acceptance criterion gets a test named after it, e.g. `describe('AC-25 Estimated suggestion', ...)`. CI checks this.
- **Worked numbers:** use the exact figures from the docs. If a doc example looks wrong, flag it rather than changing the expected value.
- **Tooling:** build plans with the fixtures in `test/fixtures/`. Service tests use in-memory SQLite (`better-sqlite3`) with the real migrations.

## Git and PRs

- **Branches:** one build-plan step or feature per branch, named `feat/<short-name>` or `fix/<short-name>`.
- **Commits:** Conventional Commits that cite IDs, e.g. `feat(core): estimated 1RM suggestion (FR-3.5, AC-25)`.
- **Never** push, force-push, merge or submit store builds unless asked.
- **Dependencies:** adding one needs a permitted licence (MIT, Apache-2.0, BSD, ISC; OFL-1.1 for fonts) and an entry in `THIRD_PARTY_NOTICES.md`. Ask before adding any dependency.
- **Never bump `expo`, `expo-*`, `react`, `react-native*` or `jest-expo` individually.** The SDK pins them as a set: upgrade the SDK, then `npx expo install --fix`, then `npx expo-doctor`.

## Definition of done

- `npm run check` passes.
- New behaviour cites its requirement IDs in tests and in the commit message.
- If the work revealed a doc gap, you've said so, and proposed a fix with `/spec-change` if needed.
- UI work meets the accessibility checklist (DESIGN §7.17): labels, 48 dp targets, dynamic type.
