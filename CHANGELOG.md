# Changelog

Notable changes to Workout Planner. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); releases follow the plan in
SRS §11 (v1.0 Core Loop, v1.1 Periodisation, v1.2 Insight & Polish).

`/release-check <version>` requires an entry here before a store build.

## [Unreleased]

### Added

- Specifications (`docs/REQUIREMENTS.md`, `docs/DESIGN.md`), CI, and the Claude Code configuration.
- Expo app scaffold (build plan Slice 0): Expo SDK 57, React Native 0.86, React 19,
  strict TypeScript, Expo Router, and the §2.2 folder layers.
- Two Jest projects — `core` (plain Node) and `app` (`jest-expo`) — with a 100% coverage threshold
  on `src/core`, and CI runs them under three time zones (NFR-12).
- ESLint layer boundaries (`import/no-restricted-paths`) and determinism rules that bar clock reads
  and randomness from `src/core` and `src/services`, with `src/services/clock.ts` exempt.
- Licence gate (`npm run check:licences`) over the production dependency tree; GPL and AGPL fail.
- Persistence (build plan Slice 2, NFR-2, NFR-4): the full DESIGN §4.3 schema for every release in
  Drizzle, versioned migrations applied in one exclusive transaction, and a test that compares the
  migrated database with the DDL in the doc. Repositories for settings, skills, templates, plans,
  blueprints and the schedule. A seeded Skill Library (FR-1.1), draft pending review.
- The database opens, migrates and seeds before any screen renders, and shows a blocking message
  if that fails. Android Auto Backup includes the database (DESIGN §2.7).

### Changed

- The build order is now `docs/BUILD_PLAN.md`: 16 vertical slices, each with its IDs, exit check
  and status. DESIGN §11 now points there (D-31).

- DESIGN 0.7: every TEXT primary key is `NOT NULL` (D-27); CHECKs require values explicitly, and
  local dates are format-checked (D-28). `docs/ERD.md` replaces the §4.2 sketch.
- Foreign keys are compiled on for every SQLite connection, so the app needs a development build
  rather than Expo Go.
- `Db` database interface (`src/data/db.ts`) with an Expo device driver and a `better-sqlite3` test
  driver, so data and service tests run in-memory against the same API (DESIGN §9.1).
- Core primitives (build plan Slice 1): `units`, `rounding`, `dates`, `loads` and
  `e1rm`, with 100% line and branch coverage and table-driven tests run under three time zones
  (FR-12.1, FR-1.6, FR-3.2, FR-3.5, FR-3.6, FR-3.12; AC-8, AC-10, AC-54, AC-61–63).
- Schedule engine (build plan Slice 3): schedule generation from phase blueprints with
  week, cycle and cycle-group numbering, partial cycles and continuations; derived missed status
  and progress; deload generation whose slots follow the training-day pins (D-30). The
  `startPlan` core steps and `insertDeload` services, tested in-memory with no UI (FR-2.5, FR-2.11,
  FR-2.12, FR-2.15, FR-4.2, FR-4.3, FR-4.9, FR-4.11, FR-8.3; AC-2, AC-57, AC-70).
- Live reads (D-32): `useLiveQuery` in `src/features` re-runs a repository read after every
  committed exclusive transaction, using a post-commit signal from `liveDb` in `src/data`. It
  replaces Drizzle's `useLiveQuery`, whose change events fire before commit.
- Design tokens (build plan Slice 4, DESIGN §6.2–6.4): light and dark colours, the Barlow type
  roles, spacing, radii and touch sizes, and the fonts loaded at launch. A contrast test checks
  every text colour on every surface in both themes (NFR-7). Adds `plateRedText` for red text,
  because plate red on set-row wells fell below WCAG AA (D-33).
- Today's components (build plan Slice 4, DESIGN §6.5): Button, BottomBar, StatusChip, LoadText,
  EmptyState, ExerciseCard, WeekStrip, ProgressMeter, PlanRibbon and Banner. Each has a spoken
  form for screen readers and 48 dp touch targets, and none caps text scaling (NFR-7, §7.17). If
  the fonts fail to load, text falls back to the system font.
- Status chips for in-progress and paused workouts, so every status the schedule engine derives
  can be shown (D-34).
