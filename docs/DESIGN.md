# Workout Planner App: Design Document

| | |
|---|---|
| **Document version** | 0.14 (transactions enable foreign keys) |
| **Date** | 22 September 2026 |
| **Status** | Ready for build (v1.0 scope) |
| **Implements** | `docs/REQUIREMENTS.md` document version 1.4 (the SRS) |
| **Location** | `docs/DESIGN.md` |

**Contents:**
1. Design Decisions Log
2. Architecture
3. Core Domain Module (training maths & scheduling)
4. Data Schema (SQLite)
5. Backup & Import Format
6. UI Design System
7. Navigation & Screens
8. Key Flows
9. Testing Strategy
10. Release Mapping
11. Build Plan

> **For Claude Code:** the SRS says *what* the app does; this document says *how*. Reference requirement IDs (e.g. `FR-4.6`) first, and design sections (e.g. `§3.8`) where helpful, in commits and PRs. If this document and the SRS disagree, the SRS wins: stop and flag the conflict. New design questions go in §1.2 as **Open** and aren't built until they're resolved.

---

## 1. Design Decisions Log

### 1.1 Resolved decisions

The first design review found 18 gaps or conflicts in SRS 1.0, resolved in SRS 1.1. The full review then found the top-set problem (D-19), resolved in SRS 1.2. A build-readiness review found seven more (D-20 to D-26), resolved in SRS 1.3. The SRS is now the authority for each rule. The IDs remain here because design sections and commit messages refer to them.

| ID | Decision | Now specified in | Tested by |
|---|---|---|---|
| D-1 | A training phase interrupted by a deload carries on as a **continuation** (same blueprint, cycle numbers continue). Beginner templates' Block 2 is a continuation, so v1.0 needs no multi-phase builder. | FR-2.1, FR-2.11, FR-2.12, FR-4.3 | AC-1, AC-57 |
| D-2 | A 1RM's effective week is derived (setup = week 1; review = week after the reviewed cycle) and recalculated whenever weeks are renumbered. | FR-4.9, SRS §4 | AC-58 |
| D-3 | Shifts in **both** directions are rejected if a moved workout lands on the same day as one that isn't moving. | FR-4.6 | AC-19, AC-47 |
| D-4 | A single move can land on a day that already has a workout, after a warning; never before today. | FR-4.7 | AC-48 |
| D-5 | When a cycle ends the program, only the Final Review is created. | FR-3.8, FR-3.9 | AC-18, AC-49 |
| D-6 | Pending reviews are completed oldest first; later reviews use earlier results as "current". | FR-3.8, FR-7.2a | AC-50 |
| D-7 | The Week screen shows calendar weeks (week-start setting); the header shows plan week(s). Plan start date defaults to the next week-start day. | FR-2.3, FR-8.1, FR-12.3 | AC-51 |
| D-8 | "Deload now" splits before the current week if it has no logged session, otherwise after it; that week's remaining workouts keep their week number and are pushed back. | FR-4.6a | AC-34, AC-52 |
| D-9 | The deload load factor applies to %-based, double-progression and fixed sets. | FR-2.12, FR-3.15 | AC-30, AC-53 |
| D-10 | e1RM PRs use RIR 0 when RPE is missing; suggestions still need RPE ≥ 7 or AMRAP. | FR-10.1 | AC-54 |
| D-11 | Volume counts × 2 for per-side **or** unilateral skills (never × 4). | FR-1.8, FR-9.8 | AC-39, AC-55 |
| D-12 | Double-progression rep pre-fill: range bottom after an increase, otherwise last session's reps clamped to the range. | FR-3.15 | AC-28, AC-29, AC-56 |
| D-13 | Double-progression working load = most common load of last session's completed working sets (ties → heavier). | FR-3.15 | AC-56 |
| D-14 | Reviews and cycle numbers are keyed by **cycle group** (`continues_phase_id ?? id`). | FR-2.11, FR-3.8, SRS §4 | AC-34, AC-57 |
| D-15 | Taper rest days ≤ taper days − 2. | FR-2.14 | AC-59 |
| D-16 | Skill properties are snapshotted onto logged exercises; tracking type and load convention lock after the first log. | FR-1.10 | AC-60 |
| D-17 | Cloud backup library choice is a v1.1 spike. | FR-12.9, SRS Open Question 2 | AC-46 |
| D-18 | Fonts may use OFL-1.1, listed in `THIRD_PARTY_NOTICES.md`. | SRS §1.3, NFR-13 | CI licence check (§9.5) |
| D-19 | **Top sets** (was OQ-3). Moderate sets logged at their target RPE estimate below the lifter's max, so the estimated rule almost never suggested an increase. Following common coaching practice (a heavy top set chosen by effort, then back-off sets, with a re-test at the end of the block), a new `top_set` load type is prescribed by RPE with a starting % of TM, and only top sets (RPE ≥ 7) and AMRAP sets qualify for estimates. The periodised Strength phase gets a weekly top set; deloads turn top sets into normal sets. | FR-2.1, FR-2.4, FR-2.12, FR-2.14, FR-3.5, FR-9.2a, FR-9.2b | AC-21, AC-25–27, AC-61–63 |
| D-20 | **Workouts are defined once per phase** and placed on weekday **slots** (`cycle_slot`). Previously each weekday appearance was its own row. "Full body A" on Monday and Friday therefore had separate content and separate double-progression tracks, so progression was several times slower and "last time" disagreed with the pre-fill. | FR-2.4, FR-2.6, FR-2.15, FR-3.15, FR-4.2, SRS §4 | AC-64 |
| D-21 | **Pending reviews stay current.** They are recalculated when opened and whenever their inputs change, and withdrawn if their cycle stops being resolved (e.g. a missed workout done a day late). Completed reviews are never reopened. | FR-3.8, FR-4.14 | AC-50, AC-65 |
| D-22 | **Final Review sources:** Test Day first; otherwise the final cycle's own rule, if the program ends in a training phase; otherwise no suggestion. The old wording left fixed-rule plans with no suggestion, and could reuse sets an earlier review had already counted. | FR-3.9, FR-2.14 | AC-32, AC-49, AC-66, AC-67 |
| D-23 | In v1.0, deloads can only be inserted into **draft** plans. Inserting into an active plan needs the full "Deload now" machinery (shift, renumbering, D-2, undo), so it ships in v1.1 with its tests. | FR-2.12, SRS §11 | feature flag `activeDeloadInsert` |
| D-24 | **Ending a plan early:** pending reviews are completed first or discarded, and no Final Review is created. Later open workouts show "Not done (plan ended)" and don't affect adherence. | FR-4.14, FR-4.15 | AC-68 |
| D-25 | **Import integrity.** Some tables reference each other in cycles, so foreign-key checks are deferred to commit during import. Files with a newer seed version are rejected. | NFR-4, FR-12.7 | AC-69 |
| D-26 | **Review reference estimate** is the best e1RM from the cycle's qualifying sets only, so `reference_e1rm_kg` has a single meaning. It shows "—" when there are no qualifying sets. | FR-3.5, FR-3.8 | AC-66 |
| D-27 | **Primary keys are never NULL.** SQLite only implies `NOT NULL` for `INTEGER PRIMARY KEY`, so every `TEXT PRIMARY KEY` is declared `NOT NULL`; otherwise any number of NULL-keyed rows could be inserted. `session.cycle_group_id` deliberately has no foreign key, so history outlives its plan. | DESIGN §4.1, §4.3, §4.4 (physical schema only; no SRS change) | schema test, constraint tests (§9.1) |
| D-28 | **CHECKs say NOT NULL when a value is required.** A comparison on NULL passes a SQLite CHECK, so the continuation offset (D-1) and a top set's `reps_max` (D-19) could be left empty despite being required. Both CHECKs now say `IS NOT NULL`, and the §4.1 `GLOB` check is declared on every local-date column, as §4.1 already promised. | SRS §4 (top sets); DESIGN §4.1, §4.3 | constraint tests (§9.1) |
| D-29 | **Drizzle runs over the `Db` interface, and foreign keys are compiled on.** Repositories use Drizzle's `sqlite-proxy` driver on top of `Db`, so the device and test drivers share one query layer, and transactions stay with `withExclusiveTransactionAsync` (C-15). `expo-sqlite` runs each exclusive transaction on a new connection that the open-time `PRAGMA foreign_keys` never reaches, so SQLite is built with `SQLITE_DEFAULT_FOREIGN_KEYS=1` through the `expo-sqlite` config plugin, and the migration runner refuses to run if foreign keys are off. The app therefore needed a development build, not Expo Go (superseded by D-35). | DESIGN §2.4, §4.1, §4.6, §9.1 (no SRS change) | migration and adapter tests (§9.1); release checklist |
| D-30 | **Deload details.** Building the schedule engine found four gaps in FR-2.12. (1) Deload slots were copied "on the same weekdays", but pins are set per slot at start, so a plan could train Tue/Thu/Sat and deload Mon/Wed/Fri. Each generated slot now keeps `source_cycle_slot_id` and takes its source slot's pin at start, and Plan setup lists only unlinked slots. (2) The volume factor counts working sets only; warm-ups are kept unchanged and uncapped. (3) A kept AMRAP set becomes a fixed-rep set at its minimum reps, since an all-out set contradicts the RPE cap. (4) A deload must follow a training week and can't sit directly before another deload. Core may also take new IDs through a caller-supplied `newId` generator (§2.1). | FR-2.12, FR-4.2, SRS §4 (SRS 1.4) | AC-70; core and service tests (§3.9, §8.1) |
| D-31 | **The build plan lives in `docs/BUILD_PLAN.md`.** §11 listed layered steps (core, then data, then services, then UI). Once the UI-free foundations had landed, the remaining work was re-cut into vertical slices, each ending in something that runs on a phone and each with its own IDs, exit check and status. Keeping a second copy here would drift, so §11 now points to that file and records only the ordering rules. No requirement changes. | `docs/BUILD_PLAN.md` (no SRS change) | every v1.0 AC and FR in SRS §11 is placed in a slice |
| D-32 | **Live reads re-run after each commit.** The `useLiveQuery` spike found that Drizzle's hook doesn't fit. `expo-sqlite`'s change events come from `sqlite3_update_hook`, which fires once per row while the transaction is still open. A re-read on the main connection can therefore see the pre-commit snapshot (WAL), and no event follows the commit. A service that writes N rows also triggers N re-reads. Drizzle's hook watches only the query's own table, so joins are missed, and its types reject `sqlite-proxy` relational queries. Instead, `liveDb(db)` wraps `withExclusiveTransactionAsync` and signals once each transaction commits, and `useLiveQuery` in `src/features` re-runs a repository read on that signal. The `Db` interface and the drivers don't change, and change listening is turned off. | DESIGN §2.4 (no SRS change) | live-read hook and decorator tests (§9.1) |
| D-33 | **Red text has its own token.** Building the tokens found that light `plateRed` text on `surfaceSunk` (set rows, input wells) is 4.38:1, below WCAG AA. `plateRedText` (`#B0352B` light, `#E8726A` dark) is used for red text and icons, as `plateYellowText` is for yellow; `plateRed` stays the fill. A contrast test checks every text token on `bg`, `surface` and `surfaceSunk` in both themes; it also corrected ink on yellow from 6.7 to 6.6 (6.65 had been rounded twice). | DESIGN §6.2, NFR-7 (no SRS change) | contrast test (§9) |
| D-34 | **Chips for in-progress and paused workouts.** `effectiveStatus` (§3.7) can return `in_progress` and `paused`, but §6.2 listed chips for six statuses only, so Today and Week had no way to show them. They are `▸ In progress` (blue) and `‖ Paused` (inkMuted). The glyphs avoid ▶ and ⏸, which iOS draws as colour emoji and which would ignore the token colour. `Paused` appears only once pause and resume ships (FR-4.10, v1.1, `pauseResume` flag). | DESIGN §6.2 (no SRS change) | StatusChip and WeekStrip tests |
| D-35 | **Exclusive transactions switch foreign keys on themselves.** D-29 relied on the `SQLITE_DEFAULT_FOREIGN_KEYS` build flag because `expo-sqlite`'s `withExclusiveTransactionAsync` begins the transaction before the caller runs, and `PRAGMA foreign_keys` is a no-op inside one. Expo Go ignores that flag, so the app couldn't run there, and without a Mac or an Apple Developer account there was no way to see it on an iPhone. The device driver now opens the transaction's connection itself (`useNewConnection`), runs `PRAGMA foreign_keys = ON` and a 5 s busy timeout, then `BEGIN EXCLUSIVE`, the work, and `COMMIT` or `ROLLBACK`, and always closes the connection. That takes the exclusive lock at `BEGIN`, where `expo-sqlite`'s version ran a plain `BEGIN`. Nested transactions are refused. The build flag stays as a backstop, and the migration runner still refuses to run with foreign keys off. The app runs in Expo Go for development; store builds are unchanged. | DESIGN §4.1, §9.1; D-29 (no SRS change) | driver tests (§9.1); migration guard test; release checklist |

### 1.2 Open design questions

| ID | Question | Blocks | Status |
|---|---|---|---|
| OQ-1 | Exact exercises in each built-in template (SRS Open Question 1). | Seeding templates before release | Open |
| OQ-2 | Cloud backup libraries and Google scope verification (SRS Open Question 2). | FR-12.9 (v1.1) | Open |

### 1.3 Design clarifications

These rules sit inside the SRS wording but aren't spelled out there. The design follows them. If any is wrong, flag it; if they're right, consider moving them into the SRS at its next revision.

| ID | Clarification | Related SRS | Section |
|---|---|---|---|
| C-1 | Deload and taper phases always have a 1-week cycle, so every week of a 2-week deload or taper repeats the generated week. | FR-2.12, FR-2.14 | §3.6 |
| C-2 | While a plan is paused, its workouts aren't shown as missed and no reviews are created. | FR-4.10 | §3.7 |
| C-3 | Undo is offered only for the most recent change, and only if no workout it affected has since been completed or skipped. | FR-4.13 | §3.8 |
| C-4 | Deleting a logged session returns its planned workout to `upcoming` (so it shows as missed if its date has passed). It also reruns the double-progression check, and refreshes or withdraws that cycle's pending review (D-21). | FR-9.12 | §4.4 |
| C-5 | Removing a slot after the plan has started retires it from future weeks. Removing a whole workout retires all its slots. Past logs and their planned workouts remain. Adding a slot generates it for weeks after the current week. | FR-2.9 | §4.4 |
| C-6 | Test Day loads are percentages of the current 1RM (warm-ups 50/70/80/90%, attempts 95/100/102.5%, all editable). The Test Day suggestion is the best RIR-adjusted e1RM of successful attempts, which equals the load for a single at RPE 10. Like cycle reviews, it never suggests a value below the current 1RM. | FR-2.14, FR-3.9 | §3.10, §3.11 |
| C-7 | A skill's first-ever logged sets record baseline PRs, but the summary labels them "First log" rather than celebrating new PRs. | FR-10.1, FR-10.2 | §3.13 |
| C-8 | Fixed-rule suggestions are rounded like other suggestions, because the current 1RM may not be a clean number in the display unit. | FR-3.5, FR-3.6 | §3.11 |
| C-9 | When several 1RM rows apply to a cycle, the one with the highest effective week wins, then the latest `set_at`. | SRS §4 | §3.3 |
| C-10 | Double-progression state isn't updated for a substituted exercise, or when no working set was completed. | FR-3.15, FR-9.4 | §3.12 |
| C-11 | "Deload now" finds the split week from the chosen start date, not from today. Open workouts in weeks after the split, and any dated on or after the start date, are pushed back. | FR-4.6a | §3.9 |
| C-12 | In the weekly volume panel, a session "hits" a muscle if it trains it as a primary or secondary muscle. | FR-2.13 | §3.14 |
| C-13 | A `plan_setup` 1RM row is written only when the value entered at setup differs from the skill's current 1RM. `plan_skill.starting_one_rm_kg` always holds the starting value. | FR-3.3, SRS §4 | §8.1 |
| C-14 | If there are missed workouts and a workout today, the Today screen shows the missed card above today's workout rather than hiding it. | FR-7.2, FR-7.6 | §7.2 |
| C-15 | Service transactions must be exclusive. Use `withExclusiveTransactionAsync`, never `withTransactionAsync`, which may let other queries run inside the transaction. Confirmed against Expo SDK 57; Drizzle's own `transaction()` is not used (D-29). | NFR-8, NFR-10 | §2.4 |
| C-16 | Deleting a phase (allowed only when it has no sessions) also deletes its reviews. Such reviews can only cover missed or skipped cycles. | FR-2.11 | §4.3 |

---

## 2. Architecture

### 2.1 Layers

```
┌───────────────────────────────────────────────────────────┐
│ app/          Expo Router screens (UI only, no maths)     │
│ src/ui/       Design-system components, hooks             │
├───────────────────────────────────────────────────────────┤
│ src/features/ View-models: hooks that call services and   │
│               shape data for screens                       │
├───────────────────────────────────────────────────────────┤
│ src/services/ Use cases. Each is one DB transaction:       │
│               startPlan, finishSession, shiftSchedule,     │
│               completeReview, insertDeload, reconcile …   │
├──────────────────────────┬────────────────────────────────┤
│ src/data/                │ src/core/  (pure TypeScript)   │
│ schema, migrations,      │ loads, units, rounding, e1RM,  │
│ repositories, seed,      │ schedule generation, shifts,   │
│ export/import            │ reviews, double progression,   │
│                          │ PRs, volume, dates             │
└──────────────────────────┴────────────────────────────────┘
```

**Dependency rules** (enforced by ESLint `no-restricted-imports` / `import/no-restricted-paths`):
- `src/core` imports nothing outside itself (no React, Expo or SQLite) and never reads the clock or generates IDs. "Today", "now" and new IDs are passed in as arguments, so every function is deterministic. New IDs arrive either as values or, when the number of rows depends on the input, as a caller-supplied `newId: () => string` generator (D-30).
- `src/data` imports `src/core` types only.
- `src/features` may use **read** hooks from `src/data` repositories (for live queries), but all **writes** go through `src/services`.
- `src/services` orchestrates: load with repositories → compute with `core` → write with repositories, all in one transaction.
- Screens never import `src/data` directly (NFR-3, NFR-10).

### 2.2 Folder structure

```
app/                              Expo Router
  _layout.tsx                     providers, DB init, migrations, disclaimer gate
  onboarding/…                    disclaimer, units, choose plan, setup
  (tabs)/_layout.tsx              Today · Week · Plans · Progress · More
  (tabs)/index.tsx                Today
  (tabs)/week.tsx
  (tabs)/plans/index.tsx
  (tabs)/progress/index.tsx
  (tabs)/more/index.tsx           History, Library, Settings links
  session/[id]/index.tsx          full-screen logging (modal stack)
  session/[id]/summary.tsx
  plan/[id]/index.tsx             Plan Detail
  plan/[id]/overview.tsx          full plan grid
  plan/[id]/builder/index.tsx     single scrolling builder (§7.10)
  plan/[id]/builder/workout/[workoutId].tsx   workout and set editor
  plan/[id]/setup.tsx             dates, weekdays, 1RMs
  review/[id].tsx                 Cycle / Final Review
  program-summary/[planId].tsx
  template/[id].tsx
  skill/[id].tsx                  exercise detail (PRs, chart)
  library/…                       Skill Library, editor
  history/…                       list, session detail
  settings/…
src/config/release.ts             current release and feature flags (§10)
src/core/
  units.ts  rounding.ts  dates.ts  loads.ts  e1rm.ts
  schedule/generate.ts  schedule/shift.ts  schedule/deloadNow.ts  schedule/status.ts
  reviews.ts  doubleProgression.ts  prs.ts  volume.ts  deload.ts  taper.ts
  types.ts  index.ts
src/data/
  db.ts  schema.ts  migrations/  repositories/  seed/  backup/
src/services/
src/features/
src/ui/  (tokens.ts, components/)
content/explanations.json         FR-6.3
test/fixtures/                    plan builders for tests
```

### 2.3 Dependencies

All are free, and all licences allow store distribution (SRS §1.3).

| Purpose | Package | Licence | Release |
|---|---|---|---|
| Framework | `expo`, `react-native`, TypeScript (strict) | MIT / Apache-2.0 | 1.0 |
| Navigation | `expo-router` | MIT | 1.0 |
| Database | `expo-sqlite` | MIT | 1.0 |
| Query builder / migrations | `drizzle-orm`, `drizzle-kit` | Apache-2.0 | 1.0 |
| UI state (active session, dialogs) | `zustand` | MIT | 1.0 |
| Import validation | `zod` | MIT | 1.0 |
| Notifications (rest timer, reminders) | `expo-notifications` | MIT | 1.0 |
| Keep awake | `expo-keep-awake` | MIT | 1.0 |
| Export / import | `expo-file-system`, `expo-sharing`, `expo-document-picker` | MIT | 1.0 |
| IDs | `expo-crypto` (`randomUUID`) | MIT | 1.0 |
| Gestures, animation | `react-native-gesture-handler`, `react-native-reanimated` | MIT | 1.0 |
| Bottom sheets | `@gorhom/bottom-sheet` | MIT | 1.0 |
| Fonts | `@expo-google-fonts/barlow`, `@expo-google-fonts/barlow-semi-condensed` | OFL-1.1 (D-18) | 1.0 |
| Icons | `lucide-react-native` | ISC | 1.0 |
| Charts | `victory-native` | MIT | 1.2 |
| Cloud backup | see D-17 | TBD | 1.1 |
| Tests | `jest`, `jest-expo`, `@testing-library/react-native`, `better-sqlite3` (dev only) | MIT | 1.0 |
| Lint / format | `eslint`, `typescript-eslint`, `prettier` | MIT | 1.0 |

No analytics, ads or crash-reporting SDKs (NFR-11). Dates use a small in-house `core/dates.ts` on `YYYY-MM-DD` strings rather than a library, so time zones can never leak in (NFR-12).

### 2.4 Data flow and state

- **Source of truth:** SQLite. Screens read through view-model hooks built on `useLiveQuery` in `src/features`, which re-runs a repository read whenever an exclusive transaction commits (**D-32**). The signal comes from `liveDb(db)` in `src/data`, which wraps `withExclusiveTransactionAsync`, so it fires only after `COMMIT` and never after a rollback. Commits that finish in the same tick cause a single re-read.
- **Derived values are never stored** unless noted: prescribed loads (until snapshotted), TM, missed status, progress %, adherence, volume.
- **Active session:** every set change writes to SQLite immediately (NFR-8). A Zustand store holds UI-only state (focused set, open RPE picker, rest-timer end time) and is rebuilt from the DB on launch (FR-9.10).
- **Transactions:** every service runs inside one **exclusive** transaction (C-15). A service either fully applies or leaves nothing behind.

### 2.5 Reconciliation

Missed status is time-based, so some state changes happen just because a day passes. `reconcile(today)` is a service that runs on app start, on return to the foreground, and at local midnight while open. It:
1. creates any **pending Cycle Reviews** whose cycle is now fully resolved, and runs `refreshReviews` to recalculate or withdraw pending ones (§3.11, D-21);
2. creates the **Final Review** when the program has ended, or withdraws a pending one if the program has been reopened (FR-3.9, FR-4.14);
3. marks the plan `completed` if every workout is completed or skipped; otherwise, if the program has ended, flags "plan ended with open sessions" for the Today screen;
4. reschedules the workout-day reminder notification.

It is idempotent: running it twice changes nothing. It also runs at the end of `finishSession`, skip, and any schedule change. For a paused plan, steps 1–3 are skipped (C-2). Ended plans (`completed`, `abandoned`) are skipped entirely.

### 2.6 Notifications

- **Rest timer (FR-9.6):** when a set is completed and rest timer alerts are on (FR-12.5), schedule a local notification for `now + restSec` and store its ID. Skipping or adjusting the timer cancels and reschedules it. The in-app countdown is computed from the stored end time, so it stays correct after backgrounding.
- **Workout reminder (FR-12.5):** one scheduled notification for the next workout date at the chosen time, rescheduled by `reconcile` and after any schedule change.
- Permission is requested the first time it is needed (the first rest timer, or turning on reminders), not at launch.
- **Android timing risk:** recent Android versions restrict exact alarms, which can delay time-based notifications. Test rest-timer notifications on a real Android phone before logging is built (`docs/BUILD_PLAN.md`, Slice 6). If they fire late, keep the in-app countdown authoritative, and request the exact-alarm permission only if it is really needed.

### 2.7 Storage location and OS backup (NFR-4)

- `expo-sqlite` stores the database in the app's document directory, which iOS includes in iCloud device backups. Confirm this in a device test and don't set the "exclude from backup" flag.
- Android: a config plugin sets `android:allowBackup="true"` and a `dataExtractionRules` / `fullBackupContent` file that includes the database directory and excludes caches. Keep the DB well under Auto Backup's size limit (years of data are expected to stay in the low megabytes).

---

## 3. Core Domain Module (`src/core`)

Pure, synchronous functions. Inputs are plain objects shaped like the §4 tables. 100% unit-test coverage is the target (NFR-10).

### 3.1 Units and conversion (FR-12.1, FR-3.6)

```ts
export const KG_PER_LB = 0.45359237;          // exact definition
type Unit = 'kg' | 'lb';
toDisplay(kg: number, unit: Unit): number     // kg or kg / KG_PER_LB
toKg(value: number, unit: Unit): number       // stored as-is, no extra rounding
formatLoad(kg, unit, opts): string            // "82.5 kg", "175 lb", "22.5 kg × 2", "+20 kg", "−10 kg"
```

Stored weights are `REAL` kilograms. Converted display values are cleaned to 6 decimal places before rounding, to remove floating-point noise (so `174.99999` never happens).

### 3.2 Rounding (FR-3.6)

Round to the nearest increment **in the display unit**, with ties rounded down:

```ts
function roundToIncrement(value: number, inc: number): number {
  const q = Math.round((value / inc) * 1e6) / 1e6;   // strip float noise
  const lower = Math.floor(q);
  return (q - lower > 0.5 ? lower + 1 : lower) * inc;
}

function roundLoadKg(kg: number, unit: Unit, inc: number): number {
  return toKg(roundToIncrement(toDisplay(kg, unit), inc), unit);
}

// increment lookup (FR-1.6, FR-12.4)
incrementFor(skill, settings, unit) =
  unit === 'kg' ? skill.loadIncrementKg ?? settings.weightIncrementKg
                : skill.loadIncrementLb ?? settings.weightIncrementLb
```

Checks against the SRS: AC-8 (80 kg → 176.37 lb → **175 lb**), AC-10 (79.2 → **80**), AC-14 (82.8 → **82.5**), AC-30 (63 → **62.5**), AC-35 (108 → **107.5**).

### 3.3 Training max and prescribed loads (FR-3.2, FR-3.5, FR-3.12)

```ts
tmKg(oneRmKg, tmPercent) = oneRmKg * tmPercent        // never rounded; displayed to 2 dp

prescribedLoadKg(set, ctx): number | null
  switch set.loadType:
    'percent_tm':         raw = ctx.tmKg * set.loadPercent
    'top_set':            raw = ctx.tmKg * set.loadPercent        // pre-fill only; the lifter adjusts it
    'double_progression': raw = ctx.dpState?.workingLoadKg ?? ctx.lastLoadKg ?? null
    'fixed':              raw = set.fixedLoadKg
    'bodyweight':         return null
  if raw == null: return null
  if ctx.phase.type === 'deload': raw *= ctx.phase.loadFactor      // D-9 (deloads contain no top sets)
  return roundLoadKg(raw, ctx.unit, ctx.increment)
```

**1RM for a cycle:** among the skill's `one_rep_max_history` rows with `plan_id = plan` and `effective_from_week_index ≤ firstWeekOfCycle`, take the one with the highest effective week, then the latest `set_at` (C-9). If there is none, use `plan_skill.starting_one_rm_kg`.

**Cycle's first week** uses the cycle group (D-14), so a split cycle's first week is in the first part.

### 3.4 Estimated 1RM (FR-3.5, FR-10.1)

```ts
function e1rm(loadKg: number, reps: number, rpe: number | null): number {
  const rir = rpe != null ? 10 - rpe : 0;   // no RPE → RIR 0 (AMRAP rule, and D-10 for PRs)
  const n = reps + rir;
  return n <= 1 ? loadKg : loadKg * (1 + n / 30);
}

isQualifyingSet(s) =                                 // suggestions only (FR-3.5, D-19)
  s.status === 'completed' && !s.isWarmup &&
  s.reps >= 1 && s.reps <= 5 &&
  ((s.isTopSet && s.rpe != null && s.rpe >= 7) || s.isAmrap)
  // back-off and straight sets never qualify, whatever their RPE

isPrEligibleE1rm(s) = s.status === 'completed' && !s.isWarmup && s.reps >= 1 && s.reps <= 10
```

Why only top sets: RIR ratings are far less accurate at moderate loads. A set at about 74% of 1RM logged at its target RPE 8 for 5 reps estimates only about 91% of the real max, so counting it would block increases (AC-61). A heavy top set at RPE 8 lands close to the true max.

For `per_side` skills, `loadKg` (and so e1RM and heaviest-weight PRs) is per side, labelled "per hand". %-based skills are always `total` (FR-1.9), so this never affects suggestions.

### 3.5 Setup estimate validation (FR-3.3a)

```ts
validateEstimateSet({ reps, rpe }):
  reps < 1          → error 'reps_low'
  reps > 5          → error 'reps_high'   // "Too many reps — use a heavier load and try again"
  rpe < 7           → error 'rpe_low'     // "Too easy — add weight and try again"
  rpe > 10          → error 'rpe_invalid'
  else ok, value = roundLoadKg(e1rm(load, reps, rpe), unit, inc)
```

### 3.6 Schedule generation (FR-2.5, FR-4.3, FR-2.14)

```ts
type PhaseGroup = { rootId, phases: PlanPhase[] }  // a phase plus its continuations (D-1, D-14)

generatePlannedWorkouts(plan, phases, slots, newId): PlannedWorkout[]   // rows ready to insert (D-30)
  week = 0
  for phase in phases (ordered):
    offset = phase.continuesOffsetWeeks ?? 0         // weeks the group had before this part
    for w in 1..phase.lengthWeeks:
      week += 1
      g = offset + w                                   // weeks into the group
      cycleIndex     = ceil(g / phase.cycleLengthWeeks)
      cycleWeekIndex = ((g - 1) % phase.cycleLengthWeeks) + 1
      weekStart = addDays(plan.startDate, 7 * (week - 1))
      for slot in slots(phase).filter(cycleWeekIndex, not retired for g):       // D-20
        date = firstOnOrAfter(weekStart, slot.weekday)
        if phase.type === 'taper' && inRestWindow(date, phase): continue
        emit { phaseId: phase.id, cycleGroupId: phase.continuesPhaseId ?? phase.id,
               cycleWorkoutId: slot.cycleWorkoutId, cycleSlotId: slot.id,
               phaseCycleIndex: cycleIndex, weekIndex: week, scheduledDate: date }
    if phase.type === 'taper' && phase.hasTestDay:
      emit the test_day workout on the phase's last day (weekStart of its last week + 6),
      with cycleSlotId = null (Test Day has no slot)
```

- `slots(phase)`, and the workouts they point to, are the phase's own. For a continuation part, they are the original phase's, and `cycleLengthWeeks`, increase rules and review mode are also read from the original (the continuation's copies are ignored).
- Deload and taper phases always have `cycleLengthWeeks = 1` (C-1), enforced by a table check.

- **Rest window:** the `restDaysAtEnd` days before the final day of the taper when there is a Test Day, or the last `restDaysAtEnd` days when there isn't.
- **Partial cycles** fall out naturally: 13 weeks with a 2-week cycle gives week 13 = cycle 7, week 1 (AC-18). The builder shows a notice when `lengthWeeks % cycleLengthWeeks !== 0`.
- **Re-pinning (FR-4.8):** re-pinning changes slot weekdays. Weeks before `fromWeek` keep their stored dates. For each open workout of a re-pinned slot with `weekIndex ≥ fromWeek`, keep any shift it has already had:
  ```ts
  base   = firstOnOrAfter(weekStart(weekIndex), oldWeekday)
  offset = daysBetween(base, scheduledDate)        // net effect of earlier shifts or moves
  newDate = addDays(firstOnOrAfter(weekStart(weekIndex), newWeekday), offset)
  ```
  The result is validated like a shift (not before today, no same-day clashes with workouts that aren't moving).
- **Phase length changes (FR-2.10):** extending appends weeks to the phase, dated with the same net offset as the phase's last existing workout. Shortening deletes open planned workouts from the end of the phase, and is rejected if it would remove the current week or any week with a logged or skipped workout. In both cases, later phases' week indices change by `Δweeks` and their open workouts move by `Δweeks × 7` days, validated as a shift (§3.8), and D-2 recalculation runs.

### 3.7 Status and progress (FR-8.3, FR-4.11)

```ts
effectiveStatus(pw, today, plan, hasInProgressSession /* for this workout */):
  if pw.status in ('completed','skipped') return pw.status
  if plan.status in ('completed','abandoned') && plan.endedOn && pw.scheduledDate >= plan.endedOn
                                             return 'not_done'    // D-24, excluded from adherence
  if hasInProgressSession                    return 'in_progress'
  if plan.status === 'paused' && pw.scheduledDate >= plan.pausedOn
                                             return 'paused'      // C-2
  if pw.scheduledDate < today                return 'missed'
  if pw.scheduledDate === today              return 'today'
  return 'upcoming'

progress(plan) = {
  currentWeek:   weekIndex of the first workout dated today or later (or the last week if none),
  totalWeeks:    sum(phase.lengthWeeks),
  pctSessions:   completed / total planned,
  adherence:     completed / (completed + missed)   // null if denominator is 0
}
```

### 3.8 Shifting the schedule (FR-4.5, FR-4.6, FR-4.7, FR-4.10)

```ts
planShift(workouts, anchorId, offsetDays, today): ShiftResult
  anchor = find(anchorId)                         // must be upcoming or missed
  moving = workouts.filter(w => isOpen(w) && isOnOrAfter(w, anchor))   // open = upcoming or missed
  still  = workouts.filter(w => !moving.includes(w))
  newDates = moving.map(w => addDays(w.scheduledDate, offsetDays))

  if offsetDays < 0:
    any newDate < today                      → reject 'before_today'
    any newDate <= lastCompletedDate         → reject 'before_last_completed'
  any newDate collides with a date in `still` → reject 'same_day'        // both directions (D-3)
  // `still` = completed, skipped, and open workouts earlier than the anchor
  return { ok, changes: [{ id, from, to }], newEndDate }
```

`isOnOrAfter` orders by `(scheduledDate, weekIndex, cycleWorkout.order)`.

- **Undo (FR-4.13):** `schedule_change.payload` stores every `{ id, from, to }`. Undo writes `from` back and sets `undone_at`. Only the most recent change that hasn't been undone can be undone, and only while none of the workouts it affected has been completed or skipped since (C-3). Otherwise the Undo button is hidden and the history row says why.
- **Missed → "Do now and push the rest back":** `planShift(missed, daysBetween(missed.date, today))`.
- **Pause/resume (FR-4.10):** pausing sets `plan.paused_on`. Resuming runs `planShift(first open workout dated on or after paused_on, daysBetween(paused_on, today))`, stored as one `pause` change, and clears `paused_on`.
- **Move one (FR-4.7):** changes one upcoming or missed workout's date. Rejected if before today; warns on the same day as another workout, and the user confirms (D-4, AC-48).

### 3.9 Deload generation (FR-2.12) and "Deload now" (FR-4.6a)

```ts
generateDeload(sourceWeek, deloadPhaseId, factors, newId) → { workouts, slots, exercises, sets }
  // one copy per distinct workout used in the week (A/B/A → 2 workouts, 3 slots), slots on the same weekdays, cycleWeekIndex 1
  // each slot copy: sourceCycleSlotId = original slot id (D-30: it follows that slot's pin at start)
  for each exercise: keep warm-ups unchanged (D-30),
                     keep the first ceil(workingSets × volumeFactor) working sets (min 1), top sets first,
                     on each kept working set:
                       targetRpeMax = min(targetRpeMax ?? cap, rpeCap), targetRpeMin = min(targetRpeMin, rpeCap),
                       top_set → percent_tm at the same loadPercent (D-19),
                       isAmrap → false, repsMax = repsMin (D-30),
                     sourceCycleExerciseId = original id
```

The load factor is applied when loads are calculated (§3.3), not stored on the sets.

AC-30 check: 4 sets × 0.5 → 2 sets; 70% × TM 100 × 0.9 = 63 → 62.5 kg; RPE 8 → 7. AC-63: a top set at 97.5% × TM 100 × 0.9 = 87.75 → 87.5 kg, no longer a top set.

When counting sets for the volume factor, the top set counts as a working set. It is kept first, so a deload of "top set + 4 back-off sets" (5 sets × 0.5 → 3) becomes one set at the top set's starting % plus two back-off sets.

```ts
planDeloadNow(plan, today, startDate, lengthWeeks):
  guard: current phase.type === 'training', no in-progress session
  k = weekIndex of the first open workout dated ≥ startDate (C-11)
  splitAfter = weekHasLoggedSession(k) ? k : k - 1                              // D-8
  P = phase containing k
  if splitAfter is strictly inside P (not P's last week, not before P's first):
     P.lengthWeeks = weeksOfP up to splitAfter
     P2 = { ...P, id: new, continuesPhaseId: rootOf(P), continuesOffsetWeeks: offset(P) + P.lengthWeeks,
            lengthWeeks: remaining }
  D = deload phase (cycle length 1) from the blueprint week of week k, generatedFromPhaseId = P.id
  insert D after P (and before P2 if there is one)
  moving = open workouts in weeks > splitAfter, plus open workouts dated ≥ startDate
  shift `moving` by 7 × lengthWeeks (§3.8 rules)
  weekIndex += lengthWeeks for workouts after the split; move P2 workouts to phaseId = P2
  generate D's workouts: week i (0-based) dated firstOnOrAfter(startDate + 7i, weekday),
     validated against workouts that aren't moving
  recalc effective_from_week_index (D-2)
  record schedule_change 'insert_deload' with the full before/after snapshot of affected rows
```

Undo restores the snapshot: it deletes D and P2, restores P's length, and restores the original week indices, phase IDs, dates and 1RM effective weeks (AC-34, AC-58).

**Inserting a deload in the builder (FR-2.12)** uses the same split logic at a chosen week boundary. The week before the boundary must be a training week, and the phase after it can't be a deload (D-30). In v1.0 this is only offered for draft plans (D-23), so there are no dates to shift. Inserting into an active plan arrives in v1.1 and uses the full `planDeloadNow` logic (shift, renumbering, D-2 and undo) behind the `activeDeloadInsert` flag.

### 3.10 Taper (FR-2.14)

A taper added in the builder copies the workouts and slots of the preceding training phase's first cycle week and keeps `ceil(workingSets × volumeFactor)` working sets, keeping any top sets first (the periodised template seeds its own taper content instead). Loads are unchanged (no load factor), and the cycle length is 1 (C-1). `volumeFactor` is validated to 0.30–0.70. `restDaysAtEnd` is either empty or 2–7, and at most `lengthWeeks × 7 − 2` (D-15).

**Test Day** is a `cycle_workout` with `kind = 'test_day'`, dated on the taper's last day. For each main lift it has:
- warm-up sets at 50/70/80/90% of the current 1RM (reps 5/3/2/1, no RPE)
- three single attempts at 95/100/102.5% of the current 1RM, RPE required, with "Mark as failed" shown on each (C-6)

These use `loadType = 'percent_tm'` with `loadPercent = pct1RM / tmPercent`, so they follow the current 1RM. Loads are rounded as usual and can be edited in the session.

### 3.11 Cycle Reviews (FR-3.8, FR-3.9)

```ts
reviewDue(group, cycleIndex, workouts, today):
  phase.reviewMode === 'every_cycle': all workouts of (group, cycleIndex) resolved
  phase.reviewMode === 'end_of_phase': cycleIndex is the group's last cycle and it is resolved
  'none': never
  skip if this cycle ends the program; the Final Review replaces it (D-5, AC-49)

suggest(skill, rule, cycleSets, current1RmKg, unit, inc): Suggestion
  switch rule.type:
    'estimated':
      q = cycleSets.filter(isQualifyingSet)
      if q.empty → return suggest(fallback rule) with source labelled '… (fallback)'
      best = max over q of e1rm(...)
      rounded = roundLoadKg(best, unit, inc)
      if rounded <= current → { value: null, source: 'estimated', reference: rounded }   // "no increase suggested"; no fallback (D-19)
      return { value: rounded, source: 'estimated', sourceSetId }
    'percent': value = roundLoadKg(current × (1 + v), unit, inc)
    'fixed':   value = roundLoadKg(current + toKg(unit === 'kg' ? v : vLb, unit), unit, inc)   // C-8
    'none':    value = null

reference(cycleSets) = {                                                  // D-26
  heaviestSingleKg: max loadKg over completed, non-warm-up sets with reps = 1 (else null),
  referenceE1rmKg:  max roundLoadKg(e1rm(...)) over sets where isQualifyingSet (else null)
}

finalSuggest(skill, testDaySets, program, …):                             // D-22
  1. Test Day, if any attempt was completed: best e1rm(load, 1, rpe) over completed
     (not failed) attempts, rounded; never below current → otherwise "no increase
     suggested" with it as reference                                      // C-6
  2. else if the program's last phase is a training phase:
     suggest(skill, that cycle group's rule, final cycle's sets, …)       // as its Cycle Review would
  3. else → { value: null, source: 'none' }
  reference() uses the final cycle's sets, or the last training cycle's sets when the
  program ends in a deload or taper
```

AC-25 check (top set): 100 × (1 + 5/30) = 116.67 → **117.5**. AC-61: only back-off sets (100 × 5 @ RPE 8 = 123.3, not qualifying) → fallback 140 × 1.025 = 143.5 → **142.5**. AC-32: 160 × 1 @ RPE 10 → reps + RIR = 1 → **160**. AC-66: Beginner Strength's final cycle uses its fixed rule → squat 120 + 5 = **125**, bench 80 + 2.5 = **82.5**, best estimate "—".

**Completing a review** (service):
- For each item: `accepted` writes the suggested value, `edited` writes the entered value (asking for confirmation if it is lower than current), and `kept` writes nothing.
- Written rows use `source = 'cycle_review'` and `effective_from_week_index = lastWeek(reviewed cycle) + 1`.
- Sessions that are already logged keep their snapshots, so a late review only affects unlogged sessions (FR-3.4, AC-16).
- Order is enforced (D-6, AC-50).

**Keeping reviews current (D-21):**
- `reviewDue` skips any cycle that already has a review, pending or completed.
- `refreshReviews(plan, today)` runs inside `reconcile`, and when a review is opened. It goes through pending reviews oldest first:
  - If the review's cycle is no longer resolved (or, for the Final Review, the program has been reopened), the review and its items are deleted.
  - Otherwise it recomputes `sessions_completed`, `sessions_planned`, and each item's `previous_one_rm_kg`, suggestion and reference figures, using the results of earlier completed reviews.
- `finishSession`, `editSession`, `deleteSession`, shifts, moves and undo all end with `reconcile`, so a review never shows stale figures (AC-65).
- Deleting a pending review has no side effects, because nothing is written to 1RM history until completion.
- Completed reviews are frozen. If their cycle later gains a session (a workout shifted after completion), that session uses its cycle's snapshot loads and doesn't touch the review.
- Completing the Final Review also sets the plan to `completed`, with `ended_at` and `ended_on` (FR-4.14).

**Cycle lock (FR-3.4, AC-17):** the 1RM/TM editor is read-only when the current cycle has any session with `status = 'completed'`, or any session in progress. Between cycles (no session logged in the new cycle yet), the plan's 1RMs still change only through reviews once the plan's first session is logged (FR-3.3b).

### 3.12 Double progression (FR-3.15)

```ts
updateAfterSession(state, prescription, exercise, loggedSets, inc, unit, phaseType, sessionId, now): State
  if phaseType !== 'training' return state                          // paused
  if exercise.wasSubstituted return state                           // C-10
  working = loggedSets.filter(!isWarmup)
  done    = working.filter(s => s.status === 'completed')
  if done.length === 0 return state                                 // C-10
  allTop = working.length >= prescription.workingSetCount &&
           working.every(s => s.status === 'completed' && s.reps >= repsMax &&
                              (s.rpe == null || targetRpeMax == null || s.rpe <= targetRpeMax))
  used = modeLoad(done)                         // D-13: most common load, ties → heavier
  lastReps = working.map(s => s.status === 'completed' ? s.reps : null)
  if allTop:
    return { ...state, previousWorkingLoadKg: used, lastReps,
             workingLoadKg: roundLoadKg(used + toKg(inc, unit), unit, inc),
             lastIncreasedAt: now, lastIncreaseSessionId: sessionId, consecutiveBelowMin: 0 }
  belowAll = working.every(s => s.status === 'failed' || s.reps < repsMin)
  return { ...state, workingLoadKg: used, lastReps, lastIncreaseSessionId: null,
           consecutiveBelowMin: belowAll ? state.consecutiveBelowMin + 1 : 0 }

showReduceHint = state.consecutiveBelowMin >= 2
```

- **Scope (D-20):** state is keyed by `cycle_exercise_id`, and a cycle exercise belongs to a workout definition. Every slot of "Full body A" therefore reads and writes the same state, in session order (AC-64).
- **Revert (one tap):** sets `workingLoadKg = previousWorkingLoadKg` and clears the badge.
- **Pre-fill (D-12):** after an increase, `repsMin`; otherwise `lastReps` for that set, clamped to the range (`repsMin` if there's no value).
- **No working load yet** (first session of a new plan): pre-fill the skill's most recent logged load from any session. If the skill has never been logged, the load cell is empty and "done as planned" is disabled until a load is entered.
- **In deloads**, generated exercises read the source's state through `sourceCycleExerciseId` and apply the load factor, but never write to it.

AC-28: 3 × 12 at 15 kg → 16 kg × 8, badge "↑ +1 kg". AC-29: 12/11/10 → stays at 15 kg, pre-fills 12/11/10. AC-56: 10@15, 9@16, 9@16 → 16 kg, pre-fills 10/9/9. AC-53: in a deload, 16 kg × 0.9 = 14.4 → 14 kg, state untouched.

### 3.13 Personal records (FR-10)

PRs are an **event log rebuilt by replay**. Recalculation (FR-10.5) deletes a skill's non-manual PR rows and replays that skill's sets in `completed_at` order, together with its manual PRs.

| Tracking type | PR types | Value | Key |
|---|---|---|---|
| `weight_reps` | `heaviest` | loadKg | – |
| | `e1rm` | e1rm(), reps 1–10 | – |
| | `reps_at_weight` | reps | contextWeightKg (exact stored kg) |
| `reps_only` | `max_reps` | reps | – |
| `bodyweight_plus_load` | `heaviest_added` | added kg | – |
| | `reps_at_added` | reps | contextWeightKg |
| `time` | `longest_time` | seconds | – |
| `completion_only` | none | – | – |

- **Eligible sets:** completed, not warm-up, not failed.
- A set is a PR only if it is **strictly greater** than the previous best for that (type, key). A skill's first-ever sets set the baseline: they are stored as PRs, but the summary shows "First log" instead of "New PR" (C-7).
- **After finishing a session**, PRs are detected incrementally against current bests (the new session is the latest). A full replay runs only when a past session is edited or deleted.
- `reps_at_weight` is only shown when the set isn't also a `heaviest` PR, to avoid noise.
- The PR board shows the current best for each type.

AC-4: 82.5 × 5 after 80 × 5 gives `heaviest` + `e1rm` PRs (and `reps_at_weight` for 82.5 kg is suppressed). AC-54: 80 × 10 with no RPE gives an `e1rm` PR of 106.7 kg.

### 3.14 Weekly volume (FR-2.13)

```ts
weeklyVolume(week: CycleWorkout[]): Map<Muscle, { sets: number; sessions: number }>
  for each workout, for each exercise, n = working sets:
    primary     += n;    secondary[i] += 0.5 × n
    each muscle touched, primary or secondary → sessions += 1 (once per workout)   // C-12
  note when sessions === 1
```

AC-33: bench 3 (chest 3, triceps 1.5) + dips 3 (triceps 3) → chest 3, triceps 4.5.

**Session tonnage (FR-9.8):** Σ reps × loadKg × (per_side || unilateral ? 2 : 1) over completed, non-warm-up `weight_reps` sets (D-11). Other tracking types don't add volume. AC-39: 30 × 10 × 2 = 600 kg. AC-55: 20 × 8 × 2 = 320 kg.

### 3.15 Dates (NFR-12)

```ts
type LocalDate = string // 'YYYY-MM-DD'
addDays(d, n)      // pure calendar arithmetic via Date.UTC, no local-time use
weekday(d)         // 0–6
firstOnOrAfter(d, weekday)
daysBetween(a, b)
```

`todayLocal()` lives in `src/services/clock.ts`, not in core. It is the only code that reads the device clock, and it builds the date from the device's local year, month and day. Everything else receives `today` as a `LocalDate`.

Tests cover month and year ends, 29 February, and the DST-change dates for NZ, the US and the EU (AC-42).

---

## 4. Data Schema (SQLite)

### 4.1 Conventions

- `PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;` on open. Exclusive transactions run on their own connection, which the driver opens and sets `PRAGMA foreign_keys = ON` on before `BEGIN EXCLUSIVE` (D-35); `SQLITE_DEFAULT_FOREIGN_KEYS=1` stays compiled on as a backstop (D-29).
- **IDs:** `TEXT` UUID v4 from `expo-crypto`. Seeded rows use fixed, readable IDs (`skill_back_squat`, `tpl_beginner_strength`).
- **Primary keys:** every `TEXT PRIMARY KEY` is also `NOT NULL` (D-27). SQLite only implies it for `INTEGER PRIMARY KEY`.
- **NULL in CHECKs:** SQLite passes a CHECK whose result is NULL, so a comparison on a nullable column (`x >= 1`, `x <= 5`) doesn't make `x` required. A CHECK that requires a value says `x IS NOT NULL` explicitly (D-28).
- **Local dates:** `TEXT` `YYYY-MM-DD`, every such column checked with `CHECK (x GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]')`.
- **Timestamps:** `TEXT` ISO-8601 UTC with `Z`.
- **Booleans:** `INTEGER` 0/1. **Weights:** `REAL` kg. **Percentages:** `REAL` fractions (0.9, not 90).
- **Enums:** `TEXT` with `CHECK (... IN (...))`.
- **Blueprint tables are shared** by templates and plans. A phase belongs to exactly one template or one plan. Starting a plan deep-copies the template's rows with new IDs (FR-2.3). Saving a template deep-copies the other way (FR-2.8).
- The Drizzle schema in `src/data/schema.ts` is the code source of truth. The DDL below is the reviewed reference, and the two must match.

### 4.2 Entity relationships

The full entity-relationship diagram, with every foreign key, its cardinality and its delete behaviour, is in [`docs/ERD.md`](ERD.md). The DDL below remains the reviewed reference; if they disagree, the DDL wins.

### 4.3 DDL

```sql
-- ───────────── Meta & settings ─────────────
CREATE TABLE app_meta (
  key   TEXT PRIMARY KEY NOT NULL, -- 'schema_version', 'seed_version'
  value TEXT NOT NULL
);

CREATE TABLE settings (
  id                         INTEGER PRIMARY KEY CHECK (id = 1),
  unit                       TEXT NOT NULL DEFAULT 'kg' CHECK (unit IN ('kg','lb')),
  default_rest_sec           INTEGER NOT NULL DEFAULT 120,
  week_start                 INTEGER NOT NULL DEFAULT 1 CHECK (week_start IN (0,1)), -- 0 Sun, 1 Mon
  weight_increment_kg        REAL NOT NULL DEFAULT 2.5,
  weight_increment_lb        REAL NOT NULL DEFAULT 5,
  reminder_enabled           INTEGER NOT NULL DEFAULT 0,
  reminder_time              TEXT,                        -- 'HH:MM' local
  rest_timer_alerts          INTEGER NOT NULL DEFAULT 1,
  keep_awake                 INTEGER NOT NULL DEFAULT 1,
  theme                      TEXT NOT NULL DEFAULT 'system' CHECK (theme IN ('light','dark','system')),
  disclaimer_ack_at          TEXT,
  tips_enabled               INTEGER NOT NULL DEFAULT 1,
  seen_tips                  TEXT NOT NULL DEFAULT '[]',  -- JSON array of tip keys
  onboarding_completed_at    TEXT,
  last_export_at             TEXT,
  backup_reminder_dismissed_at TEXT,
  auto_backup_enabled        INTEGER NOT NULL DEFAULT 0,  -- v1.1
  last_auto_backup_at        TEXT,
  last_auto_backup_error     TEXT
);

-- ───────────── Skill Library (FR-1) ─────────────
CREATE TABLE skill (
  id                  TEXT PRIMARY KEY NOT NULL,
  name                TEXT NOT NULL,
  muscle_group        TEXT NOT NULL,              -- see MuscleGroup enum
  secondary_muscles   TEXT NOT NULL DEFAULT '[]', -- JSON array of MuscleGroup
  equipment           TEXT NOT NULL,              -- see Equipment enum
  tracking_type       TEXT NOT NULL CHECK (tracking_type IN
                        ('weight_reps','reps_only','bodyweight_plus_load','time','completion_only')),
  load_convention     TEXT NOT NULL DEFAULT 'total' CHECK (load_convention IN ('total','per_side')),
  is_unilateral       INTEGER NOT NULL DEFAULT 0,
  is_main_lift        INTEGER NOT NULL DEFAULT 0,
  load_increment_kg   REAL,
  load_increment_lb   REAL,
  is_custom           INTEGER NOT NULL DEFAULT 0,
  is_archived         INTEGER NOT NULL DEFAULT 0,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL,
  CHECK (is_main_lift = 0 OR (tracking_type = 'weight_reps' AND load_convention = 'total'))  -- FR-1.9
);
CREATE INDEX idx_skill_name ON skill(name COLLATE NOCASE);
CREATE INDEX idx_skill_filter ON skill(is_archived, muscle_group, equipment);

-- MuscleGroup: chest, upper_back, lats, shoulders, biceps, triceps, forearms,
--              quads, hamstrings, glutes, calves, abs, lower_back, cardio
-- Equipment:   barbell, dumbbell, kettlebell, machine, cable, bodyweight, band, cardio_machine, other

-- ───────────── Templates & plans ─────────────
CREATE TABLE template (
  id                  TEXT PRIMARY KEY NOT NULL,
  name                TEXT NOT NULL,
  description         TEXT NOT NULL DEFAULT '',
  default_tm_percent  REAL NOT NULL DEFAULT 0.9,
  sessions_per_week   INTEGER NOT NULL,
  level               TEXT CHECK (level IN ('beginner','intermediate')),
  is_built_in         INTEGER NOT NULL DEFAULT 0,   -- the periodised template is added by the v1.1 seed
  created_at          TEXT NOT NULL
);

CREATE TABLE plan (
  id                  TEXT PRIMARY KEY NOT NULL,
  name                TEXT NOT NULL,
  description         TEXT NOT NULL DEFAULT '',
  source_template_id  TEXT REFERENCES template(id) ON DELETE SET NULL,
  status              TEXT NOT NULL CHECK (status IN ('draft','active','paused','completed','abandoned')),
  start_date          TEXT CHECK (start_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),  -- required before 'active'
  default_tm_percent  REAL NOT NULL DEFAULT 0.9,
  paused_on           TEXT CHECK (paused_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),   -- v1.1
  ended_at            TEXT,
  ended_on            TEXT CHECK (ended_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),    -- the plan ended (D-24)
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL
);
-- FR-4.1: at most one active or paused plan
CREATE UNIQUE INDEX uq_plan_single_active
  ON plan((status IN ('active','paused'))) WHERE status IN ('active','paused');

CREATE TABLE plan_skill (
  id                  TEXT PRIMARY KEY NOT NULL,
  plan_id             TEXT NOT NULL REFERENCES plan(id) ON DELETE CASCADE,
  skill_id            TEXT NOT NULL REFERENCES skill(id),
  tm_percent          REAL,                          -- null = plan default
  starting_one_rm_kg  REAL,
  UNIQUE (plan_id, skill_id)
);

-- ───────────── Blueprint (shared) ─────────────
CREATE TABLE phase (
  id                        TEXT PRIMARY KEY NOT NULL,
  template_id               TEXT REFERENCES template(id) ON DELETE CASCADE,
  plan_id                   TEXT REFERENCES plan(id) ON DELETE CASCADE,
  sort_order                INTEGER NOT NULL,
  name                      TEXT NOT NULL,
  type                      TEXT NOT NULL CHECK (type IN ('training','deload','taper')),
  review_mode               TEXT NOT NULL CHECK (review_mode IN ('every_cycle','end_of_phase','none')),
  length_weeks              INTEGER NOT NULL CHECK (length_weeks BETWEEN 1 AND 52),
  cycle_length_weeks        INTEGER NOT NULL DEFAULT 2 CHECK (cycle_length_weeks BETWEEN 1 AND 8),
  volume_factor             REAL CHECK (volume_factor IS NULL OR volume_factor BETWEEN 0.1 AND 1),
  load_factor               REAL CHECK (load_factor IS NULL OR load_factor BETWEEN 0.5 AND 1),
  rpe_cap                   REAL CHECK (rpe_cap IS NULL OR rpe_cap BETWEEN 6 AND 10),
  rest_days_at_end          INTEGER CHECK (rest_days_at_end IS NULL OR rest_days_at_end BETWEEN 2 AND 7),
  has_test_day              INTEGER NOT NULL DEFAULT 0,
  generated_from_phase_id   TEXT REFERENCES phase(id) ON DELETE SET NULL,
  continues_phase_id        TEXT REFERENCES phase(id) ON DELETE CASCADE,   -- D-1, D-14
  continues_offset_weeks    INTEGER,                 -- required when continues_phase_id is set
  default_increase_type     TEXT NOT NULL DEFAULT 'percent'
                              CHECK (default_increase_type IN ('estimated','percent','fixed','none')),
  default_increase_value    REAL,                    -- percent: 0.025; fixed: kg (see lb column)
  default_increase_value_lb REAL,                    -- fixed rules are per unit (FR-3.5)
  fallback_increase_type    TEXT CHECK (fallback_increase_type IN ('percent','fixed','none')),
  fallback_increase_value   REAL,
  fallback_increase_value_lb REAL,
  CHECK ((template_id IS NULL) <> (plan_id IS NULL)),
  CHECK (type = 'training' OR (length_weeks <= 2 AND cycle_length_weeks = 1)),   -- C-1
  CHECK (continues_phase_id IS NULL OR (type = 'training' AND continues_offset_weeks IS NOT NULL
                                         AND continues_offset_weeks >= 1)),
  CHECK (has_test_day = 0 OR type = 'taper')
);
CREATE INDEX idx_phase_plan ON phase(plan_id, sort_order);
CREATE INDEX idx_phase_template ON phase(template_id, sort_order);

CREATE TABLE increase_rule (                         -- per-skill override
  id                  TEXT PRIMARY KEY NOT NULL,
  phase_id            TEXT NOT NULL REFERENCES phase(id) ON DELETE CASCADE,
  skill_id            TEXT NOT NULL REFERENCES skill(id),
  increase_type       TEXT NOT NULL CHECK (increase_type IN ('estimated','percent','fixed','none')),
  increase_value      REAL,
  increase_value_lb   REAL,
  fallback_type       TEXT CHECK (fallback_type IN ('percent','fixed','none')),
  fallback_value      REAL,
  fallback_value_lb   REAL,
  UNIQUE (phase_id, skill_id)
);

CREATE TABLE cycle_workout (                         -- a workout, defined once per phase (D-20)
  id                  TEXT PRIMARY KEY NOT NULL,
  phase_id            TEXT NOT NULL REFERENCES phase(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  sort_order          INTEGER NOT NULL,
  kind                TEXT NOT NULL DEFAULT 'normal' CHECK (kind IN ('normal','test_day'))
);
CREATE INDEX idx_cw_phase ON cycle_workout(phase_id, sort_order);

CREATE TABLE cycle_slot (                            -- one weekday appearance of a workout (D-20)
  id                  TEXT PRIMARY KEY NOT NULL,
  phase_id            TEXT NOT NULL REFERENCES phase(id) ON DELETE CASCADE,
  cycle_workout_id    TEXT NOT NULL REFERENCES cycle_workout(id) ON DELETE CASCADE,
  cycle_week_index    INTEGER NOT NULL CHECK (cycle_week_index >= 1),
  weekday             INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  sort_order          INTEGER NOT NULL,
  retired_from_group_week INTEGER,                   -- C-5: not generated from this week of the cycle group on
  source_cycle_slot_id TEXT REFERENCES cycle_slot(id) ON DELETE SET NULL  -- D-30: deload copies follow its pin
);
CREATE INDEX idx_slot_phase ON cycle_slot(phase_id, cycle_week_index, sort_order);
CREATE INDEX idx_slot_workout ON cycle_slot(cycle_workout_id);

CREATE TABLE cycle_exercise (
  id                        TEXT PRIMARY KEY NOT NULL,
  cycle_workout_id          TEXT NOT NULL REFERENCES cycle_workout(id) ON DELETE CASCADE,
  skill_id                  TEXT NOT NULL REFERENCES skill(id),
  sort_order                INTEGER NOT NULL,
  superset_group            TEXT,                    -- same value = same superset
  rest_sec                  INTEGER,
  notes                     TEXT,
  source_cycle_exercise_id  TEXT REFERENCES cycle_exercise(id) ON DELETE SET NULL  -- deload/taper copies
);
CREATE INDEX idx_ce_workout ON cycle_exercise(cycle_workout_id, sort_order);

CREATE TABLE cycle_set (
  id                  TEXT PRIMARY KEY NOT NULL,
  cycle_exercise_id   TEXT NOT NULL REFERENCES cycle_exercise(id) ON DELETE CASCADE,
  set_index           INTEGER NOT NULL,
  is_warmup           INTEGER NOT NULL DEFAULT 0,
  reps_min            INTEGER,
  reps_max            INTEGER,
  is_amrap            INTEGER NOT NULL DEFAULT 0,
  target_rpe_min      REAL CHECK (target_rpe_min IS NULL OR target_rpe_min BETWEEN 6 AND 10),
  target_rpe_max      REAL CHECK (target_rpe_max IS NULL OR target_rpe_max BETWEEN 6 AND 10),
  load_type           TEXT NOT NULL CHECK (load_type IN ('percent_tm','double_progression','fixed','bodyweight','top_set')),
  load_percent        REAL,                          -- top_set: starting % of TM (pre-fill)
  fixed_load_kg       REAL,
  target_time_sec     INTEGER,
  CHECK (load_type <> 'percent_tm' OR load_percent IS NOT NULL),
  CHECK (load_type <> 'fixed' OR fixed_load_kg IS NOT NULL),
  CHECK (load_type <> 'top_set' OR (load_percent IS NOT NULL AND target_rpe_max IS NOT NULL
                                    AND reps_max IS NOT NULL AND reps_max <= 5
                                    AND is_amrap = 0 AND is_warmup = 0)),   -- D-19
  CHECK (reps_min IS NULL OR reps_max IS NULL OR reps_min <= reps_max),
  UNIQUE (cycle_exercise_id, set_index)
);

-- ───────────── Generated schedule ─────────────
CREATE TABLE planned_workout (
  id                  TEXT PRIMARY KEY NOT NULL,
  plan_id             TEXT NOT NULL REFERENCES plan(id) ON DELETE CASCADE,
  phase_id            TEXT NOT NULL REFERENCES phase(id) ON DELETE CASCADE,
  cycle_group_id      TEXT NOT NULL REFERENCES phase(id) ON DELETE CASCADE,   -- D-14
  cycle_workout_id    TEXT NOT NULL REFERENCES cycle_workout(id),
  cycle_slot_id       TEXT REFERENCES cycle_slot(id),   -- D-20; null for Test Day
  phase_cycle_index   INTEGER NOT NULL,
  week_index          INTEGER NOT NULL,
  scheduled_date      TEXT NOT NULL CHECK (scheduled_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  status              TEXT NOT NULL DEFAULT 'upcoming'
                        CHECK (status IN ('upcoming','completed','skipped')),  -- 'missed' is derived
  session_id          TEXT REFERENCES session(id) ON DELETE SET NULL,
  skipped_at          TEXT
);
CREATE INDEX idx_pw_date ON planned_workout(plan_id, scheduled_date);
CREATE INDEX idx_pw_cycle ON planned_workout(plan_id, cycle_group_id, phase_cycle_index);
CREATE INDEX idx_pw_week ON planned_workout(plan_id, week_index);

CREATE TABLE double_progression_state (
  cycle_exercise_id         TEXT PRIMARY KEY NOT NULL REFERENCES cycle_exercise(id) ON DELETE CASCADE,
  plan_id                   TEXT NOT NULL REFERENCES plan(id) ON DELETE CASCADE,
  working_load_kg           REAL,
  previous_working_load_kg  REAL,                    -- one-tap revert
  last_increased_at         TEXT,
  last_increase_session_id  TEXT REFERENCES session(id) ON DELETE SET NULL,
  last_reps                 TEXT NOT NULL DEFAULT '[]',  -- JSON reps per set, for D-12 pre-fill
  consecutive_below_min     INTEGER NOT NULL DEFAULT 0
);
-- "paused" is derived from the phase type (§3.12), so it isn't stored.

-- ───────────── Reviews ─────────────
CREATE TABLE cycle_review (
  id                  TEXT PRIMARY KEY NOT NULL,
  plan_id             TEXT NOT NULL REFERENCES plan(id) ON DELETE CASCADE,
  kind                TEXT NOT NULL CHECK (kind IN ('cycle','final')),
  cycle_group_id      TEXT REFERENCES phase(id) ON DELETE CASCADE,   -- C-16
  phase_cycle_index   INTEGER,
  status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed')),
  sessions_completed  INTEGER NOT NULL,
  sessions_planned    INTEGER NOT NULL,
  created_at          TEXT NOT NULL,
  completed_at        TEXT,
  CHECK ((kind = 'cycle') = (cycle_group_id IS NOT NULL AND phase_cycle_index IS NOT NULL)),
  UNIQUE (plan_id, cycle_group_id, phase_cycle_index)
);
-- SQLite treats NULLs as distinct in UNIQUE, so the final review needs its own index
CREATE UNIQUE INDEX uq_final_review ON cycle_review(plan_id) WHERE kind = 'final';

CREATE TABLE cycle_review_item (
  id                  TEXT PRIMARY KEY NOT NULL,
  cycle_review_id     TEXT NOT NULL REFERENCES cycle_review(id) ON DELETE CASCADE,
  skill_id            TEXT NOT NULL REFERENCES skill(id),
  previous_one_rm_kg  REAL NOT NULL,
  suggested_one_rm_kg REAL,
  reference_e1rm_kg   REAL,                          -- best qualifying e1RM this cycle (D-26)
  heaviest_single_kg  REAL,                          -- reference only
  suggestion_source   TEXT NOT NULL CHECK (suggestion_source IN
                        ('estimated','test_day','percent','fixed','none')),
  is_fallback         INTEGER NOT NULL DEFAULT 0,
  source_set_log_id   TEXT REFERENCES set_log(id) ON DELETE SET NULL,
  confirmed_one_rm_kg REAL,
  decision            TEXT CHECK (decision IN ('accepted','edited','kept')),
  UNIQUE (cycle_review_id, skill_id)
);

CREATE TABLE one_rep_max_history (
  id                        TEXT PRIMARY KEY NOT NULL,
  skill_id                  TEXT NOT NULL REFERENCES skill(id),
  one_rm_kg                 REAL NOT NULL CHECK (one_rm_kg > 0),
  source                    TEXT NOT NULL CHECK (source IN ('plan_setup','setup_estimate','cycle_review','manual')),
  plan_id                   TEXT REFERENCES plan(id) ON DELETE SET NULL,
  effective_from_week_index INTEGER,                 -- cached, see D-2
  cycle_review_id           TEXT REFERENCES cycle_review(id) ON DELETE SET NULL,
  estimate_session_id       TEXT REFERENCES session(id) ON DELETE SET NULL,
  note                      TEXT,
  set_at                    TEXT NOT NULL
);
CREATE INDEX idx_orm_skill ON one_rep_max_history(skill_id, set_at DESC);
CREATE INDEX idx_orm_plan ON one_rep_max_history(plan_id, skill_id, effective_from_week_index);

-- ───────────── Schedule history (FR-4.13) ─────────────
CREATE TABLE schedule_change (
  id                        TEXT PRIMARY KEY NOT NULL,
  plan_id                   TEXT NOT NULL REFERENCES plan(id) ON DELETE CASCADE,
  type                      TEXT NOT NULL CHECK (type IN ('shift','move','repin','pause','length','insert_deload')),
  from_planned_workout_id   TEXT REFERENCES planned_workout(id) ON DELETE SET NULL,
  from_week_index           INTEGER,
  offset_days               INTEGER,
  payload                   TEXT NOT NULL,           -- JSON, see §4.5
  summary                   TEXT NOT NULL,           -- "Pushed back 2 days from Wed 24 Sep"
  created_at                TEXT NOT NULL,
  undone_at                 TEXT
);
CREATE INDEX idx_sc_plan ON schedule_change(plan_id, created_at DESC);

-- ───────────── Logging ─────────────
CREATE TABLE session (
  id                  TEXT PRIMARY KEY NOT NULL,
  plan_id             TEXT REFERENCES plan(id) ON DELETE SET NULL,
  planned_workout_id  TEXT REFERENCES planned_workout(id) ON DELETE SET NULL,
  phase_id            TEXT REFERENCES phase(id) ON DELETE SET NULL,
  cycle_group_id      TEXT,
  phase_cycle_index   INTEGER,
  name                TEXT NOT NULL,                 -- snapshot of the workout name
  kind                TEXT NOT NULL DEFAULT 'planned'
                        CHECK (kind IN ('planned','ad_hoc','one_rm_estimate','test_day')),
  local_date          TEXT NOT NULL CHECK (local_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),  -- date it counts for (history grouping)
  started_at          TEXT NOT NULL,
  ended_at            TEXT,
  status              TEXT NOT NULL CHECK (status IN ('in_progress','completed')),
  notes               TEXT,
  rpe                 REAL CHECK (rpe IS NULL OR rpe BETWEEN 1 AND 10),
  total_volume_kg     REAL,                          -- cached at finish, recomputed on edit
  updated_at          TEXT NOT NULL
);
CREATE UNIQUE INDEX uq_session_in_progress ON session(status) WHERE status = 'in_progress';
CREATE INDEX idx_session_date ON session(status, started_at DESC);
CREATE INDEX idx_session_plan ON session(plan_id, started_at DESC);

CREATE TABLE session_exercise (
  id                  TEXT PRIMARY KEY NOT NULL,
  session_id          TEXT NOT NULL REFERENCES session(id) ON DELETE CASCADE,
  skill_id            TEXT NOT NULL REFERENCES skill(id),
  cycle_exercise_id   TEXT REFERENCES cycle_exercise(id) ON DELETE SET NULL,
  sort_order          INTEGER NOT NULL,
  superset_group      TEXT,
  rest_sec            INTEGER,
  notes               TEXT,
  was_substituted     INTEGER NOT NULL DEFAULT 0,
  was_added           INTEGER NOT NULL DEFAULT 0,
  tm_snapshot_kg      REAL,
  tracking_type       TEXT NOT NULL,                 -- snapshots (D-16)
  load_convention     TEXT NOT NULL,
  is_unilateral       INTEGER NOT NULL,
  is_main_lift        INTEGER NOT NULL,
  dp_increase_kg      REAL                           -- shows the "↑" badge, null if none
);
CREATE INDEX idx_se_session ON session_exercise(session_id, sort_order);
CREATE INDEX idx_se_skill ON session_exercise(skill_id);

CREATE TABLE set_log (
  id                  TEXT PRIMARY KEY NOT NULL,
  session_exercise_id TEXT NOT NULL REFERENCES session_exercise(id) ON DELETE CASCADE,
  set_index           INTEGER NOT NULL,
  is_warmup           INTEGER NOT NULL DEFAULT 0,
  is_amrap            INTEGER NOT NULL DEFAULT 0,
  is_top_set          INTEGER NOT NULL DEFAULT 0,    -- copied from the prescription (D-19)
  prescribed_reps_min INTEGER,
  prescribed_reps_max INTEGER,
  prescribed_load_kg  REAL,
  prescribed_time_sec INTEGER,
  target_rpe_min      REAL,
  target_rpe_max      REAL,
  reps                INTEGER,
  load_kg             REAL,                          -- per side if per_side; added load (may be < 0) if bodyweight_plus_load
  time_sec            INTEGER,
  rpe                 REAL CHECK (rpe IS NULL OR (rpe BETWEEN 6 AND 10 AND rpe * 2 = CAST(rpe * 2 AS INTEGER))),
  status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','failed')),
  completed_at        TEXT,
  UNIQUE (session_exercise_id, set_index)
);
CREATE INDEX idx_set_completed ON set_log(completed_at);

-- ───────────── PRs (FR-10) ─────────────
CREATE TABLE personal_record (
  id                  TEXT PRIMARY KEY NOT NULL,
  skill_id            TEXT NOT NULL REFERENCES skill(id),
  type                TEXT NOT NULL CHECK (type IN ('heaviest','e1rm','reps_at_weight','max_reps',
                        'heaviest_added','reps_at_added','longest_time')),
  value               REAL NOT NULL,
  context_weight_kg   REAL,
  session_id          TEXT REFERENCES session(id) ON DELETE CASCADE,
  set_log_id          TEXT REFERENCES set_log(id) ON DELETE CASCADE,
  achieved_at         TEXT NOT NULL,
  is_manual           INTEGER NOT NULL DEFAULT 0,
  note                TEXT
);
CREATE INDEX idx_pr_skill ON personal_record(skill_id, type, achieved_at);
CREATE INDEX idx_pr_session ON personal_record(session_id);
```

### 4.4 Rules enforced in services (not expressible in DDL)

| Rule | Where | Ref |
|---|---|---|
| A plan can't become `active` until every %-based skill has `starting_one_rm_kg` | `startPlan` | FR-3.3 |
| 1RM/TM/rules editable only before the first logged session; then the cycle lock applies | `updatePlanSkill` | FR-3.3b, FR-3.4 |
| Blueprint edits affect only open workouts. Loads and content are read when a session starts, so editing a workout needs no rewrite and applies to all its slots. Adding a slot generates it for weeks after the current week. Removing a slot deletes its open planned workouts and sets `retired_from_group_week`; past ones stay. Removing a workout does this for all its slots, and its row is kept while any planned workout references it | `editBlueprint` | FR-2.9, C-5, D-20 |
| A phase can be deleted only if it has no sessions; its reviews are deleted with it | `deletePhase` | FR-2.11, C-16 |
| Templates are never written after seeding, except user templates on save | repository | FR-2.8 |
| Tracking type and load convention are read-only once a skill has logs | `updateSkill` | D-16 |
| Editing or deleting a session triggers PR replay for its skills and recomputes volume | `editSession`, `deleteSession` | FR-10.5 |
| Deleting a session sets its planned workout back to `upcoming`, then reruns reconcile and the double-progression update for that exercise from the previous session | `deleteSession` | FR-9.12, C-4 |
| A continuation's blueprint, rules and review mode are read from its original phase | repositories | FR-2.11 |
| Deleting a plan clears `plan_id` on its sessions and 1RM history, and keeps PRs | FKs (`SET NULL`) | SRS §4 |
| Main-lift sets and top sets can't be `completed` without an RPE (warm-ups excepted) | `completeSet` | FR-9.2a |
| `top_set` prescriptions are only allowed for skills eligible under FR-1.9 | `editBlueprint` | FR-2.4 |
| Marking a top set as a warm-up clears `is_top_set` (a warm-up can't qualify) | `updateSet` | FR-9.14 |
| A slot must point to a `normal` workout of the same phase; Test Day workouts have no slot | `editBlueprint` | D-20 |
| "Duplicate workout" deep-copies a workout's exercises and sets. The copy gets its own double-progression state, seeded with the original's working load | `duplicateWorkout` | FR-2.15 |
| Deloads can only be inserted into draft plans until `activeDeloadInsert` is enabled | `insertDeload` | D-23 |
| Pending reviews are refreshed or withdrawn after every change that can affect them | `reconcile` → `refreshReviews` | D-21 |
| Ending a plan completes or discards pending reviews, sets `status = 'abandoned'`, `ended_at` and `ended_on`, and creates no Final Review | `endPlan` | D-24 |
| `session.cycle_group_id` and `phase_cycle_index` are historical labels with no foreign key, so sessions survive plan deletion. They are meaningless once `phase_id` is null, and nothing may join through them after that | repositories | D-27, SRS §4 |

### 4.5 `schedule_change.payload` shapes

```ts
type ShiftPayload   = { changes: { id: string; from: LocalDate; to: LocalDate }[] };      // shift, move, pause, repin
type LengthPayload  = { phaseId: string; fromWeeks: number; toWeeks: number;
                        added: string[]; removed: PlannedWorkoutRow[];
                        changes: ShiftPayload['changes'];
                        weekIndexChanges: { id: string; from: number; to: number }[] };
type DeloadPayload  = { deloadPhaseId: string; splitPhase?: { id: string; fromWeeks: number; toWeeks: number };
                        continuationPhaseId?: string; createdPlannedIds: string[];
                        changes: ShiftPayload['changes'];
                        weekIndexChanges: { id: string; from: number; to: number }[];
                        phaseIdChanges: { id: string; from: string; to: string }[];
                        ormEffectiveChanges: { id: string; from: number; to: number }[] };
```

### 4.6 Migrations and seeding

- Drizzle migrations are bundled and run in `app/_layout.tsx` before any screen renders. A failed migration shows a blocking error with an "Export raw database" option, and the data is never deleted.
- `src/data/migrate.ts` applies pending migrations in one exclusive transaction (C-15), and refuses a database already migrated by a newer app. An index drizzle-kit can't express (`uq_plan_single_active`) is a hand-written migration.
- `app_meta.schema_version` is the number of applied migrations, and is the export `schemaVersion`.
- **Seed data** (`src/data/seed/`) is versioned separately (`seed_version`). Upgrades add new built-in skills and templates (the v1.1 seed adds the periodised template) and update built-in template content. Plans already started from a template are unaffected, because they are copies. They never touch custom skills or user templates.
- The built-in skill list (`src/data/seed/skills.ts`) is a draft awaiting product-owner review. It can change freely until v1.0 ships, and after that only with a `seed_version` bump.
- Template exercises remain blocked on SRS Open Question 1, so the seed ships placeholder exercises behind a `TODO(OQ-1)` marker, and a CI check fails a release build while the marker exists.

### 4.7 Performance (NFR-5)

- Today screen: one query for today's planned workout plus its blueprint (indexed on `plan_id, scheduled_date`), and loads computed in memory.
- History and PR queries use `idx_session_date`, `idx_se_skill` and `idx_pr_skill`. A test generates 500 sessions × 40 sets and checks that queries return in under 50 ms under Jest with `better-sqlite3`, plus a device check before release.
- Completing a set is one `UPDATE` on `set_log`, and the UI updates optimistically (target < 100 ms).

---

## 5. Backup & Import Format (FR-12.7, NFR-4)

```jsonc
{
  "format": "workout-planner-backup",
  "schemaVersion": 1,
  "seedVersion": 1,
  "appVersion": "1.0.0",
  "exportedAt": "2026-09-16T08:30:00Z",
  "data": {
    "settings": [ … ], "skill": [ … ], "template": [ … ], "plan": [ … ],
    "plan_skill": [ … ], "phase": [ … ], "increase_rule": [ … ],
    "cycle_workout": [ … ], "cycle_slot": [ … ], "cycle_exercise": [ … ], "cycle_set": [ … ],
    "planned_workout": [ … ], "double_progression_state": [ … ],
    "cycle_review": [ … ], "cycle_review_item": [ … ],
    "one_rep_max_history": [ … ], "schedule_change": [ … ],
    "session": [ … ], "session_exercise": [ … ], "set_log": [ … ],
    "personal_record": [ … ]
  }
}
```

- Rows use the column names from §4. Built-in skills and templates (with their blueprint rows) are excluded, because the app re-seeds them. **User rows** means every other table except `app_meta`.
- File name: `workout-planner-backup-2026-09-16.json`.
- **Import pipeline:** parse → check `format` → reject if `schemaVersion` or `seedVersion` is newer than the app's (D-25) → migrate older versions with JSON-level migrators (`src/data/backup/migrations/v1_to_v2.ts` …) → validate with Zod → show a summary ("3 plans, 142 sessions, last session 12 Sep") → user confirms → export the current data automatically → in one transaction, with `PRAGMA defer_foreign_keys = ON`, delete all user rows and insert the imported ones → run `reconcile`.
- **Why deferred foreign keys (D-25):** some tables reference each other in cycles (`session` ↔ `planned_workout`, the self-references on `phase` and `cycle_exercise`, `cycle_review_item` → `set_log`), so no insert order is valid on its own. Deferral checks every key at commit. Any violation rolls the whole import back with a clear message, and the current data is left untouched.
- Every schema migration must ship with a matching JSON migrator. CI checks that the two version numbers match.
- Automatic cloud backups (v1.1) use the same format.

---

## 6. UI Design System

### 6.1 Design direction

The app is used between sets, one-handed, by lifters who may be tired and sweaty. The UI takes its cues from the gym floor rather than a generic fitness dashboard.

- **Competition plate colours carry meaning.** Blue, green, yellow and red are the colours of 20, 10, 15 and 25 kg bumper plates. The app uses them for phase types, so a plan reads like a bar loaded with plates.
- **Big, condensed numbers.** Load and reps are the most important things on screen, and they're set large in a condensed face with tabular figures, like a gym scoreboard.
- **One bold element: the plan ribbon.** A horizontal strip of phase-coloured segments with a marker for "you are here". It appears on Today, Plan Detail and the builder, and it's the app's recognisable visual. Everything else stays quiet.
- **Thumb zone first.** Primary actions sit at the bottom of the screen. Nothing needed mid-set is in the top third.
- **Colour never carries meaning alone** (NFR-7). Every status has an icon and a text label.

### 6.2 Colour tokens

| Token | Light | Dark | Use |
|---|---|---|---|
| `bg` | `#EEF1F0` (chalk) | `#131B22` | screen background |
| `surface` | `#FFFFFF` | `#1C2630` | cards, sheets |
| `surfaceSunk` | `#E2E7E6` | `#0F161C` | input wells, set rows |
| `ink` | `#18232D` | `#E7ECEF` | primary text |
| `inkMuted` | `#5A6873` | `#9AA7B1` | secondary text, warm-up sets |
| `line` | `#CBD3D6` | `#2C3843` | dividers, outlines |
| `plateBlue` | `#1F5FAE` | `#5B93DB` | training phase, primary action, "today" |
| `plateGreen` | `#23733F` | `#5DBB82` | deload phase, completed |
| `plateYellow` | `#D69E12` | `#EDC04F` | taper phase, PR and pending-review fills |
| `plateYellowText` | `#7F5C05` | `#EDC04F` | yellow text and icons on `bg`/`surface` |
| `plateRed` | `#BE3A2F` | `#E8726A` | missed, destructive |
| `plateRedText` | `#B0352B` | `#E8726A` | red text and icons on `bg`/`surface`/`surfaceSunk` (D-33) |
| `onPlate` | `#FFFFFF` | `#0F161C` | text on blue, green and red fills |
| `onPlateYellow` | `#18232D` | `#0F161C` | text on yellow fills |

- Phase colours: training → blue; deload → green; taper → yellow. Consecutive training phases alternate between full and 70% tint of blue so the ribbon still shows the boundary. Red is reserved for missed and destructive states, so it never means two things.
- Contrast (WCAG AA, 4.5:1), checked for these values: white on blue 6.4, white on green 5.8, white on red 5.5, ink on yellow 6.6, yellow text 5.4, green text 5.1, red text (`plateRedText`) 5.4 (light theme, on `bg`); dark-theme pairs are all 4.8 or higher. On `surfaceSunk`, the weakest light pairs are `inkMuted` 4.6, green text 4.7 and red text 5.0. White on yellow (2.4) is not allowed. A contrast test re-checks every pair whenever a token changes (D-33).
- Status chips use icon + label: `✓ Done` (green), `! Missed` (red), `↷ Skipped` (inkMuted), `● Today` (blue), `○ Upcoming` (outline), `– Not done` (inkMuted, for workouts left when a plan was ended early, D-24), `▸ In progress` (blue), `‖ Paused` (inkMuted, v1.1) (D-34).

### 6.3 Typography

| Role | Face | Size / line height | Notes |
|---|---|---|---|
| Scoreboard (set load and reps) | Barlow Semi Condensed SemiBold | 40/44 | tabular figures |
| Display (screen titles) | Barlow Semi Condensed SemiBold | 28/34 | sentence case |
| Title (cards, exercise names) | Barlow SemiBold | 20/26 | |
| Body | Barlow Regular | 16/24 | minimum body size |
| Label | Barlow Medium | 14/20 | sentence case, never all caps |
| Caption | Barlow Regular | 13/18 | "Last: 3×8 @ 60 kg" |

All sizes scale with the OS text size (NFR-7). Layouts must survive 200% text: rows wrap rather than truncating numbers.

### 6.4 Spacing, shape and touch

- 4-pt spacing grid; screen padding 16; card padding 16; gap between cards 12.
- Radius: 12 for cards and sheets, 10 for buttons, 999 for chips. Set rows are square-cornered wells, so they read as a table, not as cards.
- **Touch targets:** at least 48 × 48 dp (above the 44 pt minimum in NFR-6). The "done" check on a set row is 56 × 56.
- Elevation: sheets only. Cards use a 1 px `line` border instead of shadows.
- Motion: respond to actions only (set completes, sheet opens, PR appears). One moment of celebration: the PR chip pops on Session Summary. Respect the OS "reduce motion" setting.
- Haptics: light tap on set completion, success pattern on Finish and on PRs.

### 6.5 Component library (`src/ui/components`)

| Component | Purpose | Notes |
|---|---|---|
| `Button` | primary, secondary, ghost, destructive | height 52; primary is `plateBlue`; label names the action ("Start workout", "Increase all") |
| `BottomBar` | fixed action area | holds a screen's 1–2 main actions in the thumb zone |
| `PlanRibbon` | phase-coloured program strip | segment widths ∝ weeks; tick per week; "you are here" marker; tap opens Plan Detail |
| `ProgressMeter` | "Week 5 of 12", sessions %, adherence | compact and full variants |
| `StatusChip` | workout status | icon + label |
| `LoadText` | formatted load | handles units, `× 2` for per-side, `+`/`−` for added load, "BW" |
| `SetRow` | one set in logging | see §7.6 |
| `RpePicker` | inline 6–10 in 0.5 steps | horizontal row of 9 chips, pre-highlighted target |
| `NumberSheet` | numeric entry | large keypad plus ± increment buttons; avoids the OS keyboard |
| `RestTimerBar` | pinned countdown | −15 s / +15 s / Skip |
| `InfoTip` | ⓘ term explanation | opens `TermSheet` with text from `content/explanations.json` |
| `TipCard` | one-time tip | dismissible; records the key in `settings.seen_tips` |
| `Banner` | pending review, backup reminder | colour + icon + action |
| `WeekStrip` | 7 day cells | used on Today (compact) and Week |
| `ExerciseCard` | exercise summary in lists | name, sets × reps × load, superset bracket |
| `ConfirmSheet` | confirmations | states consequences plainly: "Remove weeks 11–12? 6 upcoming workouts will be deleted." |
| `EmptyState` | empty screens | one sentence plus the action that fixes it |
| `SegmentedControl`, `Stepper`, `ListRow`, `Toggle`, `DatePickerSheet`, `WeekdayPicker` | form controls | |

### 6.6 Voice and copy

- Plain words for beginners; jargon always has an ⓘ (FR-6.1).
- Buttons say what happens: "Push rest of plan back", "Keep all current", "Finish workout".
- Confirmations follow through: "Finish workout" produces "Workout finished".
- Errors say what happened and what to do: "Can't pull forward 2 days: Wednesday's workout would land on Monday, which already has a workout. Try 1 day, or move just this workout."
- Celebrate briefly: "Well done — Strength cycle 2 complete!" (FR-3.8).

---

## 7. Navigation & Screens

### 7.1 Navigation map

```
Root stack
├─ Disclaimer (first launch only, FR-5) ─→ Restore offer (v1.1, if a cloud backup exists)
├─ Onboarding stack: Units → Backup note → Choose plan → Plan setup
├─ Tabs
│   ├─ Today
│   ├─ Week ──────────→ Plan overview grid
│   ├─ Plans ─────────→ Template detail → Plan setup
│   │                 → Plan detail → Builder / Schedule history / Load table (v1.2)
│   ├─ Progress ──────→ Exercise detail
│   └─ More ──────────→ History → Session detail
│                     → Skill Library → Skill editor
│                     → Settings → About → Disclaimer
└─ Full-screen modals
    ├─ Workout session → Session summary
    ├─ Cycle / Final review → Program summary
    └─ 1RM estimate flow
Sheets (over any screen): Term info, Shift, Move, Skip, Deload now, Number entry, Skill picker
```

**Launch rules** (in `app/_layout.tsx`):
1. Run migrations and seed updates.
2. `settings.disclaimer_ack_at` is null → Disclaimer.
3. `onboarding_completed_at` is null → Onboarding.
4. A session is `in_progress` → reopen the Workout session (FR-9.10).
5. Otherwise → Today. Run `reconcile` in the background.

### 7.2 Today (FR-7)

The Today screen shows one main card, chosen in this order: in-progress session → today's workout → completed today → rest day → no plan. If there are missed workouts, a missed card appears above the main card (C-14). The example below is Beginner Strength (Mon/Wed/Fri) on Wednesday 16 September, in plan week 9 (cycle 4, week B). Cycle 3's review was completed before the deload, so the only banner is the backup reminder. A pending review would appear above it, in yellow.

```
┌─────────────────────────────────────┐
│ Today                   Wed 16 Sep  │
│ ▆▆▆▆▆▆|▆|▆▆▆▆▆▆  (plan ribbon)       │
│ Strength · Cycle 4 · Week 9 of 13   │
│ ■■■■■■■□□□□□  62% · adherence 96%  │
├─────────────────────────────────────┤
│ ⚑ Back up your data        Export   │  ← banner (FR-12.8)
├─────────────────────────────────────┤
│ Full body A                ~55 min  │
│ Squat         5 × 5       90 kg     │
│ Bench press   5 × 5       80 kg     │
│ Barbell row   3 × 8–12    60 kg ↑   │
│ Plank         3 × 45 s              │
│                                     │
│ M  T  W  T  F  S  S   (week strip)  │
│ ✓  ·  ●  ·  ○  ·  ·                 │
├─────────────────────────────────────┤
│ [        Start workout         ]    │  ← BottomBar
└─────────────────────────────────────┘
```

| State | Content | Actions |
|---|---|---|
| Workout today | name, phase/cycle/week, exercises with calculated loads, est. duration | **Start workout**; ⋯ menu: Move, Skip, Push rest back, Deload now (v1.1) |
| Missed (FR-7.6), shown above the main card | "You missed Full body A (Fri 11 Sep)"; lists all missed workouts, oldest first | **Do now and push the rest back** (primary), Move this one only, Skip |
| Rest day (FR-7.4) | "Rest day" plus next workout name and date | View next workout |
| Completed (FR-7.5) | summary: duration, sets, volume, PR chips | View session |
| In progress | "Workout in progress, started 18:02" | **Resume** |
| Paused (v1.1) | "Plan paused since Mon 14 Sep" | **Resume plan** |
| No plan (FR-7.8) | "No plan yet. Pick a ready-made plan or build your own." | **Browse templates**, Build a plan |
| Plan ended with open sessions (FR-4.14) | "Your plan's last day has passed." | Finish plan, Push rest back, Extend (v1.1) |

**Banners** stack above the card, at most two, in this priority order: pending review, then backup reminder (FR-12.8). Double-progression hints appear in the session screen, not here.

**Estimated duration:** 40 s per set plus the rest time after every set except each exercise's last, rounded to the nearest 5 minutes.

### 7.3 Week (FR-8.1, FR-8.2, D-7)

```
┌─────────────────────────────────────┐
│ ‹  14–20 Sep  ›        Plan week 9  │
├─────────────────────────────────────┤
│ Mon 14  Full body B     ✓ Done    › │
│ Tue 15  Rest                        │
│ Wed 16  Full body A     ● Today   › │
│ Thu 17  Rest                        │
│ Fri 18  Full body B     ○ Upcoming› │
│ Sat 19  Rest                        │
│ Sun 20  Rest                        │
├─────────────────────────────────────┤
│ Strength · Cycle 4 (week B)         │
│ [ View whole plan ]                 │
└─────────────────────────────────────┘
```

- Calendar weeks follow the week-start setting (FR-8.1). The header shows the plan week(s) of the workouts in view, e.g. "Plan weeks 1–2" (AC-51).
- Swipe or use ‹ › to change weeks; tap the date range to jump back to this week.
- Days with two workouts (after a single move, D-4) show both rows.
- Tapping a row opens **Workout detail** (a sheet): exercises and loads, plus Start (if today or missed), Move, Skip, Push rest back / Pull forward.
- **Plan overview grid (FR-8.4):** rows are plan weeks, columns are the plan's workouts in order. Each cell shows a status icon. The left edge shows phase colours. Deload and taper rows are labelled. Tapping a cell opens Workout detail.

### 7.4 Plans tab (FR-2)

```
┌─────────────────────────────────────┐
│ Plans                               │
│ Active                              │
│ ┌─────────────────────────────────┐ │
│ │ Beginner Strength   Week 9/13   │ │
│ │ ▆▆▆▆▆▆|▆|▆▆▆▆▆▆                  │ │
│ └─────────────────────────────────┘ │
│ My plans           (drafts, ended)  │
│ Templates                           │
│   Beginner Strength   13 wk · 3/wk  │
│   Beginner Hypertrophy 13 wk · 3/wk │
│   My templates (v1.1)               │
│ [  Build a plan  ]                  │
└─────────────────────────────────────┘
```

**Template detail (FR-2.2):** description, ribbon, phases (length, cycle length, increase rule in plain words), sessions per week, and a cycle-week preview with tabs Week A / Week B. Bottom bar: **Use this template**.

### 7.5 Plan setup (FR-2.3, FR-3.3, FR-3.3a)

A three-step flow with a progress indicator, used after choosing a template, after building, and in onboarding.

1. **Start date:** date picker, defaulting to the next week-start day, or today if today is the week-start day (FR-2.3). Shows the end date as it changes.
2. **Training days:** one row per slot (e.g. "Week A · Full body A"), each with a `WeekdayPicker`. Generated deload slots aren't listed: they take their source slot's day (D-30). Warns if two workouts share a day, and shows "Tip: leave a day between full-body sessions".
3. **1RMs:** one row per %-based skill.

```
│ Squat                         ⓘ 1RM │
│ [ 110 kg ]   → TM 99 kg (90%) ⓘ     │
│ Don't know it?  Estimate it for me  │
```

- **Start plan** is disabled until all 1RMs are filled; the button explains why ("Add a 1RM for Bench press").
- If a plan is already active: ConfirmSheet "Starting this plan will end Beginner Hypertrophy. Your history and PRs are kept." If that plan has pending reviews, the sheet offers the same Review now / End without reviewing choice as the End plan sheet (§7.9, D-24).
- **Estimate it for me** opens a full-screen modal with 4 steps (safety note and warm-up guide → choose a load for 3–5 good reps → log reps with a 1–5 stepper and RPE 7–10 → result "Estimated 1RM: 107.5 kg" with **Use this** / Edit). Out-of-range entries show the §3.5 messages inline.

### 7.6 Workout session (FR-9)

The most important screen. It is a full-screen modal, with keep-awake on when that setting is enabled. In the example (plan week 9 of Beginner Strength), the squat 1RM is 125 kg (TM 112.5 kg), so 80% gives 90 kg. The squat was last done on Friday of week 8 (cycle 4, week A), also at 90 kg. Cycle 3 used 87.5 kg, from a 1RM of 120 kg (TM 108 × 0.8 = 86.4 → 87.5), before its Cycle Review added the template's +5 kg.

```
┌─────────────────────────────────────┐
│ ✕  Full body A       24:13    Finish│
├─────────────────────────────────────┤
│ Squat             TM 112.5 kg ⓘ  ⋯  │
│ Last: 5×5 @ 90 kg                   │
│ ┌───┬──────────┬────────┬─────────┐ │
│ │ W │  60 kg   │  5     │   ✓     │ │  ← warm-up, muted
│ │ 1 │  90 kg   │  5     │   ✓     │ │
│ │   │ RPE  6 6.5 7 7.5 [8] 8.5 9 …│ │  ← inline picker, target pre-highlighted
│ │ 2 │  90 kg   │  5     │  ( )    │ │  ← next set, emphasised
│ │ 3 │  90 kg   │  5     │  ( )    │ │
│ └───┴──────────┴────────┴─────────┘ │
│ + Add set                           │
├─────────────────────────────────────┤
│ Bench press                     ⋯   │
│ …                                   │
├─────────────────────────────────────┤
│ Rest  1:42     −15s  +15s   Skip    │  ← RestTimerBar
└─────────────────────────────────────┘
```

**Set row behaviour**

| Interaction | Result |
|---|---|
| Tap ✓ | Marks the set "done as planned" with the pre-filled values. Haptic tap. Starts the rest timer. For main lifts, opens the RPE picker and the set shows "Pick RPE" until one is tapped; the rest timer still starts, and the set only counts as complete once an RPE is chosen. At Finish, sets still waiting for an RPE are listed so they can be fixed. |
| Tap load or reps | Opens `NumberSheet` with ± increment buttons. Editing is allowed before or after ✓ (FR-9.3). |
| Long-press a row | Menu: Mark as warm-up, Mark as failed, Delete set, Add note. |
| RPE picker, accessory | Optional; "Skip" chip dismisses it (FR-9.2a). |
| AMRAP set | Reps cell shows "AMRAP" until edited; ✓ opens the reps sheet first. |
| Top set (D-19) | Row is labelled "TOP" in `plateBlue` with the target underneath ("Work up to 1–3 @ RPE 8"). The load is pre-filled and highlighted as "adjust on the day"; tapping it opens `NumberSheet` with last cycle's top set shown ("Last: 100 kg × 2 @ RPE 8"). ✓ always opens the RPE picker, and the set completes only once an RPE is chosen. |
| `time` | Cell shows a target time; tapping starts a count-up stopwatch that fills the value. |
| `completion_only` | Row is a single large checkbox with the item name (FR-9.3, AC-37). |
| `per_side` | Load shows "22.5 kg × 2". |
| Unilateral | Reps show "5 each side". |
| `bodyweight_plus_load` | Load shows "BW +20 kg" or "BW −10 kg" (assisted). |
| Superset | Exercises in a group share a bracket on the left, and the next set jumps between them in round order. The rest timer starts only after the last exercise of a round. |

**Exercise menu (⋯):** Swap exercise (Skill picker, sets carry over, FR-9.4), Add note, Remove exercise, Revert increase (when a "↑ +2.5 kg" badge shows, FR-3.15), View history.

**Other details**
- The header shows elapsed time. "Finish" is always available (FR-9.9). If sets are incomplete, it asks: "4 sets aren't done. Finish anyway?"
- ✕ opens: Keep going, Save and exit (session stays in progress), **Discard workout** (destructive, confirmed; FR-9.11).
- At the bottom of the list: **+ Add exercise** (ad-hoc, FR-9.4), session note, and effort rating (1–10 slider) (FR-9.7).
- **Hints:** "↑ +2.5 kg" badge by the exercise name; "Consider reducing the load" hint when §3.12 says so.
- **Top set tip:** the first top set a user meets shows a one-time TipCard (`tip_top_set`): "Warm up in a few jumps, then pick a weight you can lift for the target reps with about 2 left in the tank. This set is how the app estimates your new max." The same text is available from the ⓘ next to "TOP".
- **Test Day** uses the same screen. Attempt rows show "Attempt 1", "Attempt 2" and "Attempt 3", with loads pre-filled from §3.10 that the user usually adjusts before each attempt. "Mark as failed" is a visible button on attempt rows, not hidden in a menu.
- **Scroll behaviour:** after ✓ on the last set of an exercise, the list scrolls so the next exercise is at the top.

### 7.7 Session summary (FR-9.8, FR-10.2)

```
┌─────────────────────────────────────┐
│ Workout finished                    │
│ Full body A · 52 min                │
│   16 sets    6,063 kg               │
│ ★ 2 new PRs                         │
│   Bench press  Heaviest  82.5 kg    │
│   Bench press  Est. 1RM  99 kg      │
│ How hard was it?  [1 … 10]          │
│ Note  ____________________          │
├─────────────────────────────────────┤
│ [            Done              ]    │
└─────────────────────────────────────┘
```

If this session completed a cycle, **Done** leads straight into the Cycle Review. In the example, the lifter did the last bench set at 82.5 kg × 5 @ RPE 9 instead of the planned 80 kg, which set both PRs (82.5 × (1 + 6/30) = 99). Volume is squat 5 × 5 × 90 (2,250) + bench 4 × 5 × 80 + 1 × 5 × 82.5 (2,012.5) + row 3 × 10 × 60 (1,800) = 6,062.5, shown rounded. Plank sets count as sets but add no volume.

### 7.8 Cycle Review and Final Review (FR-3.8, FR-3.9)

```
┌─────────────────────────────────────┐
│ Well done — Strength cycle 2        │
│ complete!                           │
│ 7 of 8 sessions · 1 PR              │
├─────────────────────────────────────┤
│ Bench press                         │
│ 1RM 110 → [ 115 kg ] ✎              │
│ TM   99 → 103.5 kg                  │
│ From 95 kg × 3 @ RPE 7              │
│ For reference: heaviest single —,   │
│ best est. 1RM 114 kg                │
│ ( Accept )  ( Keep 110 )            │
├─────────────────────────────────────┤
│ Squat                               │
│ No increase suggested               │
│ Best estimate 135 kg (below 140)    │
│ ( Keep 140 )  ( Set a value )       │
├─────────────────────────────────────┤
│ [        Increase all          ]    │
│  Keep all current      Later        │
└─────────────────────────────────────┘
```

- Items default to **Accept** when a suggestion exists, or **Keep** when none does. "Increase all" confirms every suggested value; items with edits keep their edits.
- The example is the periodised template's Strength phase (4 sessions a week, estimated rule). The bench suggestion comes from the week B top set: 95 × (1 + 6/30) = 114 → 115 kg. The squat estimate, also from a top set, came in below the current 1RM, so no increase is suggested and the fallback isn't used.
- ✎ opens `NumberSheet`. A value below current shows ConfirmSheet "Lower your bench 1RM to 105 kg? Loads from the next cycle will drop."
- Fallback suggestions are labelled "+2.5% rule (no top sets this cycle)" (AC-27, AC-61).
- **Reference figures (D-26):** the heaviest completed single, and the best estimated 1RM from qualifying sets only. Each shows "—" when there is none, which is common in beginner plans.
- **Staying current (D-21):** figures refresh when the review opens. If a shift reopens the cycle, the review and its banner disappear until the cycle finishes again.
- **Later** leaves the review pending (FR-3.8). "Keep all current" confirms and writes nothing.
- The first review shows a one-time TipCard explaining how increases work (FR-6.2).
- **Final Review:** same layout, titled "Program complete!". Suggestions follow D-22. Test Day items are labelled "Test Day: 160 kg single". Otherwise the final cycle's rule is used (e.g. "+5 kg rule" in Beginner Strength). A program that ends in a taper with no Test Day shows "No increase suggested" with the reference figures. After it, **Program summary** shows adherence, total sessions, PR list, and a per-skill 1RM start → end table, with actions **Start a new plan** (pre-fills these 1RMs) and Done.

### 7.9 Plan Detail (FR-3.13, FR-4)

Sections, top to bottom:
1. Header: name, status chip, ribbon, progress meter.
2. **Phases:** each with its type, weeks, cycle length and review mode. Tap to open it in the builder.
3. **1RM & training max:** current values per skill. Read-only with a lock note during a cycle (AC-17): "Locked until the end of this cycle. You'll be able to update it in the Cycle Review."
4. **Load table** (v1.2): skill × cycle grid; past cycles solid, future cycles italic and labelled "Projected — updates after each Cycle Review".
5. **Schedule:** Push back / Pull forward, Change training days (v1.1), Change phase length (v1.1), Pause (v1.1), Deload now (v1.1).
6. **Schedule history:** list of `summary` strings with dates; the latest has **Undo**.
7. Danger zone: End plan, Delete plan (explains that history and PRs are kept), Save as template (v1.1).

**End plan sheet** (FR-4.15): "End Beginner Strength? Workouts after today will be marked as not done. Your history and PRs are kept."
- If reviews are pending, the sheet offers **Review now**, which opens them in order and then ends the plan, and **End without reviewing**.
- After ending, the Program Summary opens.

**Shift sheet** (FR-4.5): segmented Push back / Pull forward, a day stepper (1–14), and a live preview: "Wed 16 → Fri 18, Fri 18 → Sun 20, and 11 more. Plan now ends Sun 18 Oct." Validation errors appear in place of the preview and disable **Apply**.

**Deload now sheet** (FR-4.6a): start date (default today), length (1 or 2 weeks), and a preview ("Strength cycle 2 week B resumes Wed 30 Sep. Plan ends 7 days later."). When this week already has a logged session, the preview adds: "Wed and Fri from this week will be done after the deload." (AC-52)

### 7.10 Plan Builder (FR-2.4 – FR-2.13)

A single scrolling editor with collapsible sections (not a wizard), matching the SRS §5 order. It autosaves the draft.

```
┌─────────────────────────────────────┐
│ ‹  Edit plan                  Save  │
├─────────────────────────────────────┤
│ Name  [ Beginner Strength      ]    │
│ TM %  [ 90% ] ⓘ                     │
├─────────────────────────────────────┤
│ Phases                              │
│ ▆▆▆▆▆▆|▆|▆▆▆▆▆▆  13 weeks           │
│ Strength   12 wk · 2-wk cycle   ›   │
│   ├ weeks 1–6   cycles 1–3          │
│   ├ Deload  week 7              ›   │
│   └ weeks 8–13  cycles 4–6          │
│ + Add deload     + Add phase (v1.1) │
├─────────────────────────────────────┤
│ Strength · workouts                 │
│ Full body A   5 exercises       ›   │
│ Full body B   5 exercises       ›   │
│ + Add workout                       │
│ Schedule                            │
│ [ Week A ][ Week B ]     Copy week  │
│ Mon  [ Full body A ⌄ ]              │
│ Wed  [ Full body B ⌄ ]              │
│ Fri  [ Full body A ⌄ ]              │
│ + Add day                           │
│ ⓘ 12 training weeks = 6 cycles      │
│ Volume this week (v1.2)          ⌄  │
├─────────────────────────────────────┤
│ Progression                      ⌄  │
│  Suggested increase: fixed ⓘ        │
│  +2.5 kg upper body, +5 kg lower    │
└─────────────────────────────────────┘
```

- **Continuations (FR-2.11):** a phase with a deload inside it is shown as one phase with indented parts, as above (AC-57). "Add deload" asks where to insert it: after the phase, or after a chosen week inside it (which creates a continuation). In v1.0 it is only shown for draft plans (D-23).
- **Phase sheet:** name, type, length stepper, cycle length stepper (1–8), review mode, increase rule (Estimated / Percentage / Fixed / None, with value and fallback), and deload/taper factors when relevant. Shows the partial-cycle notice.
- **Workouts and schedule (D-20):** each workout is edited once. The Schedule assigns workouts to weekdays in each cycle week; the same workout can appear several times.
- **Workout editor:** name, exercise list (drag handles to reorder, "Link as superset" when two or more are selected), **+ Add exercise** opens the Skill picker (search plus muscle and equipment filters, FR-1.4). The editor shows where the workout is used ("Mon and Fri in week A, Wed in week B") and offers **Duplicate workout** to make an independent variant (FR-2.15).
- **Set prescription editor:**

```
│ Bench press                         │
│ Load type  [ % TM | Top set | Double prog | Fixed | BW ] │
│ Sets 5   Reps [ 5 ] – [ 5 ]  ☐ AMRAP │
│ Load  80 % of TM                    │
│ Target RPE  [ 7 ] – [ 8 ]   ⓘ       │
│ Rest  2:30   Notes ________         │
│ ☑ Same for all sets   Add warm-up   │
```

  Unchecking "Same for all sets" shows one row per set. %-based and top-set loads are only offered for skills allowed by FR-1.9.
- **Adding a top set:** "Add top set" on an exercise inserts one top set before the working sets (reps 1–3, RPE 8, starting load 97.5% TM, all editable) and relabels the existing sets as back-off sets. Selecting the Top set load type shows reps (max 5), a required target RPE and "Starting load __ % of TM", and hides AMRAP.
- **Rule check:** if a phase uses the estimated rule but a main lift in it has no top set or AMRAP set in any cycle week, the Progression section shows a neutral note: "Squat has no top set, so its increases will always use the fallback rule." 
- **Volume panel (v1.2, FR-2.13):** a list of muscles with bars for fractional sets and a count of sessions, plus the neutral "trained 1×/week" note.
- **Deload hint (v1.2):** a TipCard in the Phases section when training runs longer than 6 weeks without a deload.
- The sketch shows a copy of Beginner Strength (week A: A/B/A, week B: B/A/B). A new plan from scratch opens with one 12-week phase and an empty Week A and Week B.
- **Taper note (v1.1):** adding a taper shows a TipCard recommending a Test Day, because it is the main source of Final Review suggestions (D-22).
- **Save** validates: every cycle week has at least one slot (or the user confirms a planned rest week), no workout is empty, every workout is used by at least one slot (unused ones are flagged), %-based sets use eligible skills, and the total length is 1–52 weeks. For a draft, it then goes to Plan setup (§7.5).

### 7.11 Progress (FR-10)

- **PR board (FR-10.3):** searchable list of skills with logged sets. Each row shows the headline PR (heaviest or max reps/time) and its date, with a chevron.
- **Exercise detail:**
  - v1.0: current 1RM with its history (source, date, note), current PRs, recent sessions, and **Update 1RM** when no plan is active (FR-3.11).
  - v1.2 adds PR history per type and a chart with a "Top set / Est. 1RM" toggle (FR-10.4), and **Add PR manually** (FR-10.6).

### 7.12 History (FR-11)

- Reverse-chronological list grouped by month: date, workout name, duration, ★ if PRs. Filters by plan and exercise (v1.2).
- Ended plans section with adherence (v1.1).
- **Session detail:** full sets table (warm-ups muted, failed sets struck through with a "Failed" label), notes, effort, PRs. Actions: **Edit** (reuses the logging screen in edit mode, without a timer) and **Delete** (ConfirmSheet: "PRs from this workout will be recalculated").

### 7.13 Skill Library (FR-1)

- Search field plus filter chips (muscle group, equipment). "Show archived" toggle.
- **Skill editor:** name, primary muscle, secondary muscles (multi-select), equipment, tracking type, load convention, unilateral, main lift, load increments (kg and lb, "Use default" when empty). Locked fields show "Can't change after logging" (D-16). Archive / Unarchive.

### 7.14 Settings (FR-12)

Groups: **Units** (kg/lb, increments per unit); **Workout** (default rest, keep screen awake, week start); **Notifications** (workout reminder and time, rest timer alerts); **Appearance** (theme); **Help** (tips on/off, reset tips); **Data** (Export data, Import data, last export date, device backup note, automatic cloud backup in v1.1 with status); **About** (version, licence, open-source notices, Disclaimer, source code link).

### 7.15 Onboarding (FR-5, SRS §5.12)

1. **Disclaimer** (first launch only): the four FR-5.1 points in plain language, and a single **I understand** button. There's no back or skip.
2. **Restore offer** (v1.1, only if a cloud backup is found).
3. **Units:** kg / lb, big buttons.
4. **Your data:** "Your data lives on this phone — keep phone backups on or export regularly." (v1.1 adds the automatic backup toggle here.)
5. **Get started:** Pick a template / Build a plan / Skip for now.
6. **Plan setup** (§7.5).

### 7.16 Term explanations (FR-6)

`content/explanations.json`:

```json
{
  "tm": { "title": "Training max (TM)", "body": "A slightly reduced version of your 1RM that your working weights are based on. Using 90% of your true max leaves room to build up without grinding every set." }
}
```

Keys: `one_rm`, `tm`, `tm_percent`, `rpe`, `rir`, `cycle`, `phase`, `deload`, `taper`, `double_progression`, `amrap`, `e1rm`, `test_day`, `top_set`, `back_off_set`. One-time tips: `tip_rpe_picker`, `tip_first_review`, `tip_first_deload`, `tip_top_set`. Copy is reviewed by the product owner before v1.0.

### 7.17 Accessibility checklist (NFR-7)

- Every icon-only control has an `accessibilityLabel` ("Mark set 2 done").
- Set rows are read as one element: "Set 2, 100 kilograms, 5 reps, not done". Actions are exposed as custom accessibility actions (Mark done, Edit load, Edit reps).
- The rest timer announces only at 10 s and at the end, not every second.
- The plan ribbon has a text alternative, e.g. "Phase 3 of 5, Strength, week 9 of 17".
- Focus order follows the visual order. Sheets trap focus and return it when closed.

---

## 8. Key Flows

Each flow is one service call and one transaction unless noted.

### 8.1 Start a plan from a template (FR-2.3, AC-1)

```
UI: Template detail → "Use this template" → Plan setup (date, days, 1RMs) → "Start plan"

createDraftFromTemplate(templateId)          // on "Use this template"
  deep-copy template → plan (status 'draft'), phases, rules, workouts/exercises/sets and slots
  insert plan_skill rows pre-filled with each skill's current 1RM
  // the draft gives Plan setup and the estimate flow a plan id to write to

startPlan(planId, startDate, weekdayPins, oneRms, today)   // on "Start plan"
  1. if an active/paused plan exists and the user confirmed → endPlan(it, choice, today, now)   // §8.6
  2. apply weekday pins to the plan's cycle_slots; a slot with source_cycle_slot_id takes its
     source's pinned weekday instead of its own row (D-30); set start_date
  3. set plan_skill.starting_one_rm_kg; write a 'plan_setup' history row (week 1) only
     where the value differs from the current 1RM (C-13); estimate rows already exist
  4. core.generatePlannedWorkouts → insert planned_workout rows
  5. create double_progression_state rows (working load null → §3.12 first-session rule)
  6. status = 'active'; reconcile(today)
```

Drafts left unused for 30 days are deleted on launch. A draft has no planned workouts or plan sessions. If the estimate flow wrote 1RM history rows for it, those rows are kept when the draft is deleted (their `plan_id` is set to null), and the ad-hoc "1RM estimate" sessions stay in History.

### 8.2 Log a session (FR-9, AC-3)

```
startSession(plannedWorkoutId | adHoc, now)
  - reject if another session is in progress (show "Resume" instead)
  - reject if the plan is paused
  - resolve 1RM → TM per skill for this cycle; compute prescribed loads (§3.3)
  - insert session, session_exercise (with snapshots), set_log rows (status 'pending', values pre-filled,
    is_top_set copied from the prescription, top-set load from §3.3 and last cycle's top set looked up for display)
completeSet(setLogId, values)        → UPDATE set_log …; the UI schedules the rest notification
updateSet / addSet / deleteSet / swapExercise / addExercise   → single-row writes
finishSession(sessionId, now)
  1. session.status = 'completed', ended_at, total_volume_kg
  2. if planned: planned_workout.status = 'completed', session_id
  3. incremental PR detection for each skill (§3.13) → new PR rows (returned for the summary)
  4. double progression update for each linked cycle_exercise (§3.12)
  5. reconcile(today) → may create a pending Cycle Review
  6. (v1.1) queue an automatic backup
```

### 8.3 Cycle Review (FR-3.8, AC-14 – AC-16)

```
reconcile → createReview(group, cycleIndex) and refreshReviews(plan)      // §3.11, D-21
UI opens review → user decisions
completeReview(reviewId, decisions)
  - enforce order (D-6)
  - write one_rep_max_history rows for accepted/edited items
  - status 'completed'
  - no other writes: future loads are computed at read time; logged sessions keep snapshots
```

Suggestions are stored, then refreshed when the review is opened and after any change that can affect them (D-21). Values don't change while the review screen is open.

### 8.4 Missed workout → do now (AC-6, AC-11)

```
Today: "Do now and push the rest back"
doMissedNow(planId, missedId, today, now)
  shift = planShift(missedId, daysBetween(missed.date, today))   // §3.8 validation
  apply shift; record schedule_change
  startSession(missedId, now)
```

`doMissedNow` is one service and one transaction, so a failed start also leaves the schedule unchanged. Other missed workouts later than this one move with it and stay in order. If the missed workout's cycle had a pending review, the shift withdraws it; finishing the session recreates it with the new figures (AC-65).

### 8.5 Export and import (FR-12.7, AC-41)

Export: `exportAll()` → JSON file in the cache directory → `expo-sharing` sheet → on success, set `last_export_at`. Import: see §5.

### 8.6 End a plan early (FR-4.15, AC-68)

```
UI: End plan sheet → Review now (complete pending reviews in order, then continue) | End without reviewing
endPlan(planId, today, now)
  - delete any pending reviews that remain (discarded)
  - status = 'abandoned', ended_at = now, ended_on = today
  - no Final Review; cancel the workout reminder
  - open workouts dated ≥ ended_on now show 'not_done' (§3.7)
UI: Program summary (sessions up to ended_on)
```

---

## 9. Testing Strategy

### 9.1 Layers

| Layer | Tool | What | Target |
|---|---|---|---|
| Core unit | Jest (node) | every NFR-9 item, table-driven | 100% lines/branches in `src/core` |
| Data | Jest + `better-sqlite3` running the same migrations | repositories, constraints, migrations, import/export round-trip | all repositories |
| Service | Jest + in-memory SQLite | flows in §8 end to end, AC checks without UI | every in-release AC |
| Component | React Native Testing Library | SetRow, RpePicker, ReviewItem, Shift sheet validation text | key components |
| Contrast | Jest | every text/fill token pair in `tokens.ts` meets 4.5:1 | all pairs |
| Device (manual, per release) | TestFlight / Play closed test | offline mode, notifications in background (including Android timing, §2.6), OS backup restore, font scaling, VoiceOver/TalkBack | checklist in `docs/RELEASE_CHECKLIST.md` |

`better-sqlite3` is a dev-only dependency (MIT). A small adapter makes it satisfy the same interface as `expo-sqlite`, and Drizzle's `sqlite-proxy` driver runs over that interface, so repositories are identical on device and in tests (D-29).

### 9.2 Fixtures

`test/fixtures/plans.ts` provides builders:

```ts
aPlan().startingOn('2026-09-14').withPhase(strength({ weeks: 12, cycle: 2 }))
       .withWorkouts('Full body A', 'Full body B')
       .withSchedule({ A: { Mon: 'Full body A', Wed: 'Full body B', Fri: 'Full body A' },
                       B: { Mon: 'Full body B', Wed: 'Full body A', Fri: 'Full body B' } })
       .withOneRm('squat', 110).build()
```

All service tests pass `today` and `now` explicitly. Lint bans `Date.now()` and `new Date()` in `src/core` and `src/services`, except in `src/services/clock.ts`.

### 9.3 Acceptance criteria mapping

Each AC gets one service test named after it, e.g. `describe('AC-14 Cycle Review: increase')`. CI fails if an AC tagged for the current release (§10) has no matching test, using a script that reads `REQUIREMENTS.md` and greps the test files. The script must also match lettered sub-criteria such as AC-14b.

### 9.4 Date edge cases (NFR-12)

Table tests for `addDays`, `firstOnOrAfter` and generation across: 31 Dec → 1 Jan, 28/29 Feb in 2027 and 2028, and DST changes (NZ: 27 Sep 2026 and 4 Apr 2027; US: 8 Mar and 1 Nov 2026; EU: 29 Mar and 25 Oct 2026). Run the suite under `TZ=Pacific/Auckland`, `TZ=America/New_York` and `TZ=UTC` in CI.

### 9.5 CI (NFR-14)

GitHub Actions on every push and PR: `tsc --noEmit` → `eslint` → `prettier --check` → `jest --coverage` (fails below the core threshold) → AC-coverage script → licence check (`license-checker` fails on GPL/AGPL without an allow-list entry, SRS §1.3) → seed `TODO(OQ-1)` check on release branches.

---

## 10. Release Mapping

The schema in §4 ships complete in v1.0. Later releases add screens and services, plus migrations only for genuinely new needs.

| Area | v1.0 | v1.1 | v1.2 |
|---|---|---|---|
| Core module | units, rounding, dates, loads (incl. top-set pre-fill), e1RM and top-set qualifying rule, generation (single training phase + deloads + continuations, D-1), shift (both-direction validation)/move/undo (C-3), status, reviews (`every_cycle`, `none`, ordered, final without Test Day, final replaces last cycle review), double progression, PRs, deload generation and in-phase insertion, estimate validation, skill locks, workout slots (D-20), review refresh and withdrawal (D-21), Final Review sources (D-22), ending a plan (D-24) | multi-phase, active-plan deload insertion (D-23), `end_of_phase`, taper + Test Day, deload now, re-pin, pause, phase length | volume |
| Data | full schema (including `cycle_slot`), migrations, seed (2 templates), export/import (deferred foreign keys, seed-version check) | periodised template seed (with week B top sets), cloud backup module (D-17) | — |
| Screens | Disclaimer, Onboarding, Today, Week + overview grid, Plans, Template detail, Plan setup + estimate flow, Builder (single phase + deloads, top sets), Plan detail (no load table) with End plan sheet, Session, Summary, Cycle/Final review, Program summary, PR board, Exercise detail (v1.0 scope, §7.11), History + session detail, Skill Library, Settings | Builder phases UI, Deload now / re-pin / pause / length sheets, Save as template, Test Day mode, ended plans in History, restore offer, backup settings | Volume panel, deload hint, load table, charts, manual PR, history filters |
| Tests | AC-1–12, 14–17, 19, 20, 23–31, 35–45, 47–51, 53–57, 60–66, 68–70 | AC-13, 18, 21, 22, 32, 34, 46, 52, 58, 59, 67 | AC-33 |

**Feature flags:** `src/config/release.ts` exports the current release (`'1.0'`). Screens and actions check `isEnabled('deloadNow')`, `isEnabled('activeDeloadInsert')` and similar flags, so v1.1 work can merge to `main` hidden behind a flag, keeping `main` releasable (NFR-14, NFR-15).

---

## 11. Build Plan

The build order is in **`docs/BUILD_PLAN.md`** (**D-31**). It splits v1.0 into vertical slices, each with its requirement IDs, a "Done when" check and a status. This document keeps no copy, so the two can't drift. `/next-step` reads that file.

The ordering rules behind it:

- **Riskiest, UI-free work first.** Core maths, the schema and the schedule engine are built and tested in Jest before any screen.
- **Core loop next.** Today, starting a plan and logging a session come before keeping a plan alive (missed workouts, reviews) and before the builder.
- **Gym test before the rest of the UI.** The owner trains with the core loop for 1–2 weeks, and the findings update §6 and §7 before the remaining screens are built.
- **Spikes before the slice that needs them:** `useLiveQuery` before Today, rest-timer notification timing on Android (§2.6) before logging, and OQ-2 before any FR-12.9 work.
- **Long lead times start on day one:** developer accounts, the privacy policy page (NFR-13), recruiting the Play closed-test group (NFR-15), and an owner and date for OQ-1.
- **Scope stays gated by SRS §11.** A slice never enables work tagged for a later release (§10).
