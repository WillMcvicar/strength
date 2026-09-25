# Repository setup

This was the `workout-planner-repo-kit` starting layout. **The kit is installed** and the Expo app
is **scaffolded** (`docs/BUILD_PLAN.md`, Slice 0). What follows records what is in place and what is
still outstanding.

## What's in place

```
CLAUDE.md                       always-loaded instructions (keep it under ~200 lines)
README.md  LICENSE  CHANGELOG.md  THIRD_PARTY_NOTICES.md
.claude/
  settings.json                 team permissions and hooks (committed)
  hooks/guard.mjs               blocks edits that break core purity, migrations or secrets
  hooks/format.mjs              runs Prettier and ESLint after each edit
  hooks/stop-check.mjs          typecheck and related tests before Claude finishes
  rules/*.md                    path-scoped rules; they load only when matching files are read
  skills/implement/             /implement FR-x | AC-x | D-x
  skills/ac-test/               /ac-test AC-n
  skills/spec-change/           /spec-change <gap>
  skills/next-step/             /next-step (build-plan status)
  skills/release-check/         /release-check 1.0
  agents/spec-reviewer.md       read-only check against the SRS and design
  agents/architecture-reviewer.md  read-only check of layers, determinism, accessibility and licences
.github/workflows/ci.yml        typecheck, lint, format, licences, AC coverage, tests in 3 time zones
.github/dependabot.yml          grouped monthly dependency updates
.github/pull_request_template.md
docs/REQUIREMENTS.md            the SRS
docs/DESIGN.md                  the design
docs/RELEASE_CHECKLIST.md       manual device checks
scripts/check-ac-coverage.mjs   AC → test coverage (report mode, or --strict)
src/config/release.ts           current release and feature flags
app/                            Expo Router screens (placeholder shell)
src/core src/data src/services src/features src/ui   the §2.2 layers
package.json  tsconfig.json  jest.config.js  eslint.config.js  babel.config.js  app.json
.gitignore  .prettierignore  .prettierrc  .editorconfig  .nvmrc
```

`npm run check` passes, and `node scripts/check-ac-coverage.mjs` reports the v1.0 gap (59 acceptance
criteria, 0 with tests), so the release plan and the script agree.

## One-time setup steps

Steps 1–6 are **done**; `npm run check` and `npm run check:licences` both pass. Steps 7 and 8 are
yours, because they need your GitHub account and an interactive terminal.

1. ~~**Create the app.**~~ Done: Expo SDK 57 (React Native 0.86, React 19), Expo Router, strict
   TypeScript. The template's demo screens and its six demo-only packages were removed, and routes
   live at `app/` rather than the template's `src/app/`, to match DESIGN §2.2.
2. ~~**Pin Node.**~~ Done: `.nvmrc` says `22`. React Native 0.86 requires
   `^20.19.4 || ^22.13.0 || ^24.3.0 || >= 25`, and 22 is the current LTS inside that range.
3. ~~**Install the dev tooling.**~~ Done, along with the §2.3 runtime packages for v1.0.
   `victory-native` (v1.2) and the cloud-backup libraries (v1.1, blocked on OQ-2) are deliberately
   not installed yet.
4. ~~**Add the scripts.**~~ Done. `npm run check` chains typecheck, lint, format check, tests and AC
   coverage; CI runs `check:licences` separately.
5. ~~**Set up Jest projects.**~~ Done: `core` (plain Node) and `app` (`jest-expo`), with a 100%
   coverage threshold on `src/core`. `babel.config.js` had to be added — Metro infers Expo's Babel
   preset, but `babel-jest` does not.
6. ~~**Enforce the layers in ESLint.**~~ Done, and verified by deliberately breaking each rule:
   `src/core` importing another layer, `src/core` calling `Date.now()` or `Math.random()`,
   `src/services` calling `new Date()`, and `app/` importing `src/data` all fail the lint.
   `src/services/clock.ts` is exempt, per DESIGN §3.15.
7. **Protect `main`** on GitHub: require the CI checks and pull requests.
8. **Confirm the Claude Code setup.** Start Claude Code in the repository root:
   - `/context` lists `CLAUDE.md` under Memory files.
   - `/skills` lists the five skills.
   - `/agents` lists the two reviewers.
   - `/hooks` shows the three hooks. The first run asks you to trust the project.

### Still outstanding

- `app/_layout.tsx` and `app/index.tsx` are placeholders; Slice 4 replaces them.
- The README needs screenshots to satisfy NFR-13; they can only be taken once Slice 4 has UI.
- The remaining Slice 0 spike is Android rest-timer notification timing (§2.6, Slice 6). The
  measuring tool is built (More tab, development builds only): schedule 60, 120 and 180 s runs with
  the phone locked, then record how late each one fired under "Spike results" below. Slice 6 can't
  be marked done until this result is recorded.

### Spike results (Slice 0)

- **`useLiveQuery` (before Slice 4).** Drizzle's hook doesn't fit, found by reading the
  `drizzle-orm/expo-sqlite` and `expo-sqlite` sources for SDK 57. `expo-sqlite`'s change events come
  from `sqlite3_update_hook`, which fires once per row before `COMMIT`, so a re-read can see the old
  WAL snapshot and nothing fires after the commit. The hook also watches only one table. Live reads
  therefore use `useLiveQuery` in `src/features`, which re-runs on a post-commit signal from
  `liveDb` in `src/data`, and change listening is off (D-32). No device run was needed: the signal
  doesn't depend on native event timing. Today (Slice 4) is the first on-device check.

- **C-15, exclusive transactions.** Confirmed against Expo SDK 57: `expo-sqlite` exposes
  `withExclusiveTransactionAsync(task: (txn: Transaction) => Promise<void>)`, and its own API docs
  say to prefer it over `withTransactionAsync` when execution order matters — which is what C-15
  requires. `Transaction extends SQLiteDatabase`, so the callback satisfies the `Db` interface in
  `src/data/db.ts` unchanged. The better-sqlite3 test driver takes the lock by hand with
  `BEGIN EXCLUSIVE`, and `test/db/adapter.test.ts` proves commit and rollback behaviour.
  Recorded in DESIGN §1.3 (C-15) and D-29.
- **Foreign keys inside transactions (found in Slice 2).** Each exclusive transaction runs on a new
  connection, which the open-time `PRAGMA foreign_keys = ON` never reaches. `app.json` builds
  SQLite with `SQLITE_DEFAULT_FOREIGN_KEYS=1` (D-29). Expo Go ignores that flag, so the device
  driver now opens each transaction's connection itself and switches foreign keys on before
  `BEGIN EXCLUSIVE` (D-35). **The app runs in Expo Go:** `npx expo start`, then scan the QR code.
  A development build (`npx expo run:android` / `run:ios`) also works.

## Upgrading dependencies

`npx expo-doctor` is the arbiter: it checks every package against what the installed SDK expects.

- **Expo-managed packages** (`expo`, `expo-*`, `react`, `react-native*`, `jest-expo`, `@types/react`)
  are pinned as a set by the SDK. Never bump one on its own. Upgrade the SDK, then run
  `npx expo install --fix` to realign the set, then `npx expo-doctor`. `.github/dependabot.yml`
  ignores these for that reason.
- **`jest`, `@types/jest` and `typescript`** are ignored for the same reason, one step removed:
  `jest-expo` is SDK-pinned and built against the Jest 29 line, and `typescript-eslint`
  peer-requires `typescript >=4.8.4 <6.1.0`. Check both peer ranges before bumping either.
- **Everything else** (`drizzle-orm`, `zod`, `zustand`, ESLint, Prettier, …) is fair game for
  Dependabot's monthly grouped PRs.
- Because those packages are ignored, Dependabot will not raise PRs for them. Watch the repository's
  **Security** tab for advisories affecting them and handle those through an SDK upgrade.
- Any new runtime dependency needs a permitted licence and an entry in `THIRD_PARTY_NOTICES.md`
  (SRS §1.3, NFR-13); `npm run check:licences` enforces the licence half.

## Working rhythm

- **One build-plan slice per branch** (`docs/BUILD_PLAN.md`). Start a session with `/next-step`, then `/implement <ID>`.
- **Plan first** for anything bigger than a small fix: use plan mode (Shift+Tab) and approve the
  plan before any edits.
- **Review before committing:** "Use the spec-reviewer agent on this change." For work that crosses
  layers, add the architecture-reviewer.
- **Clear between tasks.** Run `/clear` so each task starts with a clean context. The rules and
  skills reload automatically.
- **Spec gaps** go through `/spec-change`, never through silent code changes.
- **Personal preferences** go in `CLAUDE.local.md` or `.claude/settings.local.json`; both are
  gitignored.

## Optional: `@claude` on GitHub

Running `/install-github-app` inside Claude Code sets up the GitHub App and a workflow that responds
to `@claude` in issues and pull requests.

- **Cost:** these runs use your Claude plan or API credit, so the app isn't needed to meet the
  zero-running-cost rule.
- **Public repo safety:** if you enable it on this public repository, limit triggers to yourself
  (for example, check `author_association == 'OWNER'` in the workflow's `if:`).
