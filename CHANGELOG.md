# Changelog

Notable changes to Workout Planner. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); releases follow the plan in
SRS §11 (v1.0 Core Loop, v1.1 Periodisation, v1.2 Insight & Polish).

`/release-check <version>` requires an entry here before a store build.

## [Unreleased]

### Added

- Specifications (`docs/REQUIREMENTS.md`, `docs/DESIGN.md`), CI, and the Claude Code configuration.
- Expo app scaffold (DESIGN §11, build-plan step 1): Expo SDK 57, React Native 0.86, React 19,
  strict TypeScript, Expo Router, and the §2.2 folder layers.
- Two Jest projects — `core` (plain Node) and `app` (`jest-expo`) — with a 100% coverage threshold
  on `src/core`, and CI runs them under three time zones (NFR-12).
- ESLint layer boundaries (`import/no-restricted-paths`) and determinism rules that bar clock reads
  and randomness from `src/core` and `src/services`, with `src/services/clock.ts` exempt.
- Licence gate (`npm run check:licences`) over the production dependency tree; GPL and AGPL fail.
- `Db` database interface (`src/data/db.ts`) with an Expo device driver and a `better-sqlite3` test
  driver, so data and service tests run in-memory against the same API (DESIGN §9.1).
- Core primitives (DESIGN §11, build-plan step 2): `units`, `rounding`, `dates`, `loads` and
  `e1rm`, with 100% line and branch coverage and table-driven tests run under three time zones
  (FR-12.1, FR-1.6, FR-3.2, FR-3.5, FR-3.6, FR-3.12; AC-8, AC-10, AC-54, AC-61–63).
