# Build Plan

The order in which v1.0 gets built, as vertical slices. Each slice ends in something that runs and
can be checked. Its "Done when" check must pass before the next slice starts.

- **What** each ID means is in `docs/REQUIREMENTS.md` (the SRS). **How** to build it is in
  `docs/DESIGN.md`. This file only says **when**. If it disagrees with either doc, the doc wins:
  flag it and fix it with `/spec-change`.
- Scope is still gated by SRS §11. A slice never switches on work tagged for a later release.
- One slice, or one part of a slice, per branch (`feat/<short-name>`). Cite the slice in the PR.
- When a slice is finished, mark it **Done** in the status table and add a CHANGELOG entry.

## Status

| Slice | Name | Status |
|---|---|---|
| 0 | Rails | **Done** |
| 1 | Core primitives | **Done** |
| 2 | Persistence | **Done** |
| 3 | Schedule engine | **Done** |
| 4 | Shell, design system, Today (read-only) | **Done** |
| 5 | Start a plan from a template | **Done** |
| 6 | Log a session | **Done** |
| ✓ | Checkpoint: gym test (runs alongside 7–9) | |
| 7 | PRs and history | Next |
| 8 | Double progression | |
| 9 | Week and progress | |
| 10 | Missed workouts and schedule changes | |
| 11 | Cycle Review and Final Review | |
| 12 | Plan builder | |
| 13 | Skill Library | |
| 14 | Settings and data safety | |
| 15 | Release hardening and v1.0 | |

---

## Before and alongside the slices

These aren't code, but they have long lead times, so they run in parallel from the start.

- Apple and Google developer accounts.
- The privacy policy page (NFR-13), needed for both store listings.
- **Recruit 12+ Android testers now.** Play requires a closed test before production (NFR-15), and
  Slice 15 can't finish until it has run its full period.
- Give OQ-1 (template exercise lists) and the `explanations.json` copy review an owner and a date.
  Slice 5 seeds placeholders; Slice 15 can't ship with them.

---

## Foundations

### Slice 0 — Rails

Expo + TypeScript strict, ESLint with the `src/core` / `src/data` / `src/services` import
boundaries, Prettier, Jest with the `better-sqlite3` adapter, GitHub Actions (tsc → lint → test →
licence check → AC-coverage script), `src/config/release.ts` flags, MIT licence, README, CHANGELOG,
`THIRD_PARTY_NOTICES.md`, both docs at `docs/`.

- **IDs:** NFR-10, NFR-13, NFR-14, SRS §1.3, D-18.
- **Done when:** a blank app boots on iOS and Android, CI is green, and boundary violations fail lint.

### Slice 1 — Core primitives

`units.ts`, `rounding.ts`, `dates.ts`, `loads.ts`, `e1rm.ts`. Table-driven tests under all three CI
time zones, including the month, leap-year and DST cases in DESIGN §9.4.

- **IDs:** FR-12.1, FR-1.6, FR-3.2, FR-3.5 (formula), FR-3.6, FR-3.12. AC-8, AC-10 (maths), AC-54,
  AC-61–63 (maths).
- **Done when:** 100% line and branch coverage in these files, and a kg↔lb rounding test proves
  176.4 lb displays as 175 lb.

### Slice 2 — Persistence

The full DESIGN §4 schema for all releases, Drizzle migrations, repositories, the seeded Skill
Library, the settings singleton, the storage location and the OS backup config.

- **IDs:** FR-1.1, FR-1.2, FR-1.8, NFR-2, NFR-4, DESIGN §2.7.
- **Done when:** migrations run on device and in tests, and the repository and constraint tests pass.

### Slice 3 — Schedule engine

Generation from phase blueprints, week/cycle/cycle-group indexing, partial cycles, continuations,
deload generation, derived missed status and progress.

- **IDs:** FR-2.5, FR-2.11, FR-2.12 (generation), FR-2.15 (slots), FR-4.2, FR-4.3, FR-4.9,
  FR-4.11, FR-8.3. D-1, D-14, D-20, C-1. AC-2, AC-57, AC-70 (added by D-30).
- **Done when:** a 13-week beginner plan generates the week-7 deload and a Block 2 continuation
  numbered cycles 4–6, entirely in service tests with no UI (`src/services/startPlan.test.ts`).

---

## Core loop

### Slice 4 — Shell, design system, Today (read-only)

**Starts with the `useLiveQuery` spike** carried over from Slice 0 (see `docs/SETUP.md`): Today
reads live data, so confirm it works with the Drizzle Expo driver before building on it.

Tokens, typography, the DESIGN §6.5 components, tab navigation, the first-launch disclaimer,
`content/explanations.json` and the ⓘ component. Then Today, plus its empty state when there is
no plan. On a device, Today's empty state offers **Load sample plan (dev)** in development mode
only (`__DEV__`, which includes Expo Go): a `src/services/dev` service builds the Beginner Strength shape (app code can't import
`test/fixtures`, and production bundles drop the service). This is where the visual direction
gets validated, before there are twelve screens to redo.

- **IDs:** FR-5, FR-6.1, FR-6.3, FR-7.1–7.5, FR-7.7, FR-7.8, NFR-7 checklist, contrast tests. AC-71
  (added by D-36).
- **Done when:** on a phone, a fresh install shows the disclaimer; after "I understand", Today
  shows the empty state; "Load sample plan (dev)" then shows this week's workout with loads, the
  ribbon, the progress meter and the week strip, in light and dark and at 200% text.

### Slice 5 — Start a plan from a template

The onboarding stack after the disclaimer (units, the "your data" note, and Get started: pick a
template, build a plan or skip; DESIGN §7.15 steps 3–5 and §7.1 launch rule 3), the Plans tab,
template detail, plan setup (start date, weekdays, 1RMs), the "Estimate it for me" flow, and the
two beginner template seeds.

- **IDs:** FR-2.1–2.3, FR-3.3, FR-3.3a, FR-3.3b, FR-4.1, FR-4.4, DESIGN §7.15. AC-1.
- **Blocked by OQ-1** for the final exercise lists. Seed with `TODO(OQ-1)` placeholders and keep the
  release-branch check that fails on them.
- **Done when:** install → disclaimer → pick Beginner Strength → Today shows Monday's workout.

### Slice 6 — Log a session

**Starts with the Android rest-timer notification spike** carried over from Slice 0: time a
background notification on a real Android phone (DESIGN §2.6). If it fires late, the in-app
countdown stays authoritative.

**Deferred:** the spike wasn't run before the slice closed, because no Android phone was to hand.
The measuring tool is built (More tab, development builds only). Run it at the gym-test checkpoint
or, at the latest, as the rest-timer item in `docs/RELEASE_CHECKLIST.md`, and record the result in
`docs/SETUP.md`.

The full logging flow: pre-filled sets, one-tap "done as planned", the inline RPE picker with RPE
required on main lifts and top sets, top-set display, warm-ups, failed sets, add/remove/swap (needs
a minimal skill picker), the rest timer with a background notification, keep-awake, crash
recovery, ad-hoc sessions, and the session summary with total volume.

- **IDs:** FR-9 except FR-9.12, FR-1.8 volume multiplier, FR-2.4 top-set prescription as consumed
  by sessions, FR-6.2 RPE tip. AC-3, AC-7, AC-31, AC-37, AC-38, AC-39, AC-40 (logging; its PR is
  Slice 7), AC-43 (the RPE tip), AC-44 (PRs from Slice 7), AC-55.
- FR-9.12 (edit or delete a past session) is built in Slice 7, with the PR replay it needs (AC-5).
- The single highest-value slice. After it, the app replaces the Notion setup for one workout at a
  time.

### Checkpoint — Gym test

Train with the app for 1–2 weeks as soon as Slice 6 is on a phone. Slices 7–9 carry on meanwhile.

- **Done when:** findings are logged, and DESIGN §6 and §7 are updated through `/spec-change`
  before Slice 10 starts. Screens built after this point follow the updated design.

### Slice 7 — PRs and history

Automatic detection on finish, the summary and Today highlights, the PR board, recalculation on
edit or delete, the session list and session detail.

- **IDs:** FR-9.12, FR-10.1–10.3, FR-10.5, FR-10.7, FR-11.1, FR-11.3. C-7. AC-4, AC-5, AC-23 (a
  PR never changes the 1RM or TM by itself).

### Slice 8 — Double progression

Working-load carry-forward, rep pre-fill, the increase badge and one-tap revert, "last time" data,
the neutral reduce hint, and pausing during deloads.

- **IDs:** FR-3.15, FR-9.5, FR-2.15 (progression follows the workout). D-9, D-12, D-13, D-20,
  C-10. AC-28, AC-29, AC-56, AC-64.
- AC-64's second half (editing a workout changes every open appearance) is tested here at service
  level. The builder UI for it comes in Slice 12.

### Slice 9 — Week and progress

The calendar-week view with statuses, week stepping, the plan progress meter and adherence, and the
full plan overview grid.

- **IDs:** FR-8.1–8.4. D-7. AC-51.

---

## Keeping a plan alive

### Slice 10 — Missed workouts and schedule changes

The three missed-workout options, shift with both-direction validation, single move with the
same-day warning, skip, schedule history, undo, the plan auto-completion check, reminder
rescheduling, and the `reconcile` service.

- **IDs:** FR-4.5, FR-4.6, FR-4.7, FR-4.12–4.14, FR-7.6, FR-12.5. D-3, D-4, C-3, C-14. AC-6, AC-11,
  AC-12, AC-15, AC-19, AC-47, AC-48.
- Earlier than the builder, because a missed session happens on day two. A plan built from scratch
  can wait.

### Slice 11 — Cycle Review and Final Review

Review creation on cycle resolution, the pending banner and oldest-first ordering, suggestion maths
for all four rules including the top-set qualifying rule, accept/edit/keep/lower, the cycle lock,
late completion, the Final Review replacing the last cycle review, Program Summary, manual 1RM
updates between plans, and ending a plan early (with the "Review now / End without reviewing"
choice when a review is pending).

- **IDs:** FR-3.1, FR-3.4, FR-3.5, FR-3.7–3.11, FR-3.14, FR-4.15, FR-6.2 review tip. D-5, D-6, D-24,
  C-8, C-9, C-13. AC-14/14b/14c, AC-16, AC-17, AC-20, AC-24–27, AC-49, AC-50, AC-61–63, AC-65,
  AC-66, AC-68.
- Ending a plan early sits here rather than in Slice 10 because it has to handle pending reviews.
- **Done when:** a 2-week cycle finishes, the review opens, and "Increase all" moves cycle 3's loads
  and writes one history row.

---

## Completing v1.0

### Slice 12 — Plan builder

A single scrolling builder for one training phase: phase settings, cycle weeks with weekday pins,
the workout and set editor with all five load types including top sets, copy week, reorder and
supersets, adding skills from the library, inserting a deload inside a phase (draft plans only,
D-23), blueprint edits after start, and Plan Detail without
the load table.

- **IDs:** FR-1.7, FR-2.4, FR-2.6, FR-2.7, FR-2.9, FR-2.12 (insertion), FR-2.15 (editing). D-23,
  C-5. AC-30, AC-53.

### Slice 13 — Skill Library

Custom skill create/edit/archive, search and filters, per-unit increments, and the FR-1.10
snapshots and field locks surfaced in the editor.

- **IDs:** FR-1.3–1.6, FR-1.9, FR-1.10. D-16. AC-60.

### Slice 14 — Settings and data safety

Units, rest default, week start, increments, notifications, theme, JSON export and import with
validation and a pre-import backup, backup status and the 30-day reminder, the tips toggle,
About → Disclaimer, and the "Export raw database" option on the launch failure screen.

- **IDs:** FR-12.1–12.8, FR-5.3, FR-6.2, NFR-4 import rules, DESIGN §4.6 (raw export). AC-41,
  AC-42, AC-69.

### Slice 15 — Release hardening and v1.0

An accessibility pass, the cold-start budget, an airplane-mode run-through, a device backup restore
test, OQ-1 resolved with the seeds finalised and every `TODO(OQ-1)` removed, the product owner's
review of the `content/explanations.json` copy (§7.16), and the device
checklist (`docs/RELEASE_CHECKLIST.md`). Then TestFlight and the Play closed test, followed by the
release: store listings ("Data Not Collected") and privacy labels, screenshots, README and
CHANGELOG. Run `/release-check 1.0` before each store build.

- **IDs:** NFR-5, NFR-7, NFR-13, NFR-15. AC-9.
- **Done when:** the closed test has run its full period with no open P1 bugs, and v1.0.0 is live in
  both stores.

---

## After v1.0

- Run the OQ-2 cloud-backup spike before any FR-12.9 work.
- v1.1 scope is in SRS §11. Plan its slices here once v1.0 ships.
