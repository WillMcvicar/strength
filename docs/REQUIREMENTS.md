# Workout Planner App: Software Requirements Specification

| | |
|---|---|
| **Document version** | 1.4 (deload details) |
| **Date** | 17 September 2026 |
| **Status** | Approved for the design phase |
| **Platform** | iOS + Android (React Native, Expo) |
| **Licence** | MIT (open source) |

**Contents:**
1. Overview
2. Users & Context
3. Functional Requirements (FR-1 to FR-12)
4. Data Model
5. Screens
6. Non-Functional Requirements
7. Acceptance Criteria
8. Future Considerations
9. Open Questions
10. Glossary
11. Release Plan
12. Revision History

> **For Claude Code:** This is the source of truth for *what* the app must do. Reference requirement IDs (e.g. `FR-4.2`) in commits, PRs and code comments. If an implementation choice conflicts with this doc, stop and flag it rather than silently deviating. Items under "Open Questions" are undecided. Don't assume an answer; ask. `docs/DESIGN.md` describes *how* the app is built.
>
> **Build by release:** only build the requirements tagged for the current release in **§11 Release Plan**. The data model is designed for the full scope from day one, so later releases don't need rewrites.

> **Evidence basis:** the training rules in this doc (deloads, RPE, double progression, 1RM estimation, tapering, volume display) follow current strength-training research and the public principles of evidence-based coaches. Don't change these rules for convenience; flag any conflict instead.

---

## 1. Overview

A cross-platform mobile app (iOS + Android) for following structured, multi-week training plans. It replaces a Notion setup where each workout was a database row across a 12-week plan, with a dashboard showing today's workout, this week's workouts, and overall plan progress.

The app goes beyond the Notion version by letting the user choose from plan templates or build their own plans, log completed workouts with actual performance, and track personal records (PRs).

### 1.1 Goals
- Open the app and see **today's workout** in one tap or less.
- See the **current week** at a glance, with what's done, missed and upcoming.
- Know **where you are in the plan** (e.g. "Week 5 of 12, 38% complete").
- **Create plans** from templates or from scratch by building one or more **phases** (e.g. hypertrophy → strength → peak → taper), each made of a repeating **cycle** (e.g. 2 weeks), with loads calculated from a **training max** (a percentage of your 1RM). At the end of each cycle, the app congratulates you and suggests an increase, which you confirm, edit or decline.
- **Adjust the schedule mid-plan** by pushing the rest of the plan back or pulling it forward, without breaking the cycle structure.
- **Log workouts quickly** mid-session, with minimal typing.
- **Automatically detect and track PRs.**

### 1.2 Non-Goals (v1.x)
- No Notion import, export or sync.
- No social features, sharing, coaching or multi-user plans.
- No nutrition, body-weight or wearable integrations.
- No video content or AI-generated plans.
- No payments, subscriptions, in-app purchases or ads.

### 1.3 Business Model & Cost Constraints
- **The app is free.** It has no paywalls, premium tiers, in-app purchases or advertising, and every feature in this doc is available to every user.
- **It has zero running costs.** v1 needs no backend servers, hosted databases or paid APIs. All data lives on the device (NFR-2).
- **Only free-tier or open-source dependencies** may be used. Licences must permit free distribution in the App Store and Google Play (e.g. MIT, Apache-2.0 or BSD). Copyleft licences (GPL/AGPL) need sign-off first.
  - **Fonts** may use the SIL Open Font License (OFL-1.1), which permits bundling in a free app. Every bundled font and its licence is listed in `THIRD_PARTY_NOTICES.md`.
- **Distribution:** listed as free on the Apple App Store and Google Play. The only expected costs are the developer account fees.
- **No tracking.** There are no third-party analytics, ad SDKs or data sale, and the app collects no personal data. This keeps the store privacy labels at "Data Not Collected".

### 1.4 Project Goals
- **Built for people, not profit.** The aim is a genuinely free, unlimited, no-paywall training app that friends, family and the public can rely on.
- **Portfolio quality.** The project should also showcase professional engineering. See NFR-13 to NFR-15:
  - an open-source repository
  - automated tests running in CI
  - these written requirements
  - a published store release

---

## 2. Users & Context

- **Primary users:** the owner, friends and family, and the public. These are lifters from **beginner to intermediate** who follow structured plans and are frustrated by paywalled or capped apps.
- **Beginners** may not know terms like 1RM, TM, RPE or deload. The app must explain these in context (FR-6).
- **Usage context:** at the gym, on a phone, often one-handed, between sets, possibly with poor connectivity.
- **Implications:** large tap targets, minimal typing, offline-first, fast launch, and plain-language explanations.

---

## 3. Functional Requirements

### FR-1 Skill Library
> "Skill" and "exercise" mean the same thing in this doc. The UI calls this the **Skill Library**.

- **FR-1.1** The app ships with a seeded library of skills. Each has a name, primary muscle group, **secondary muscle groups**, equipment, tracking type, load increment, and a **main-lift flag** (e.g. squat, bench, deadlift, overhead press).
- **FR-1.2** Tracking types: `weight_reps`, `reps_only` (bodyweight), `bodyweight_plus_load` (e.g. weighted pull-ups; added load is logged, and a negative value means assisted), `time` (e.g. plank), and `completion_only`.
  - `completion_only` is for cardio and conditioning (e.g. run, row, bike). It is simply marked **done / not done**, with no distance, pace or heart-rate tracking in v1.
- **FR-1.3** The user can create, edit and archive custom skills.
- **FR-1.4** Skills are searchable by name and filterable by muscle group and equipment.
- **FR-1.5** Archived skills remain visible in history and PRs but are hidden from pickers.
- **FR-1.6** **Load increments:** each skill can set its own load increment for rounding, **per unit** (e.g. 2.5 kg / 5 lb for a barbell, 2 kg / 5 lb for dumbbells). This overrides the global setting (FR-12.4). Rounding always happens in the user's display unit (FR-3.6).
- **FR-1.7** The plan builder adds skills to workouts directly from the library (FR-2.4).
- **FR-1.8** **Load convention:** each skill defines how its load is entered.
  - `total`: e.g. a barbell, including the bar
  - `per_side`: e.g. dumbbells, per hand. The UI shows "22.5 kg × 2", and total volume counts both sides.
  - Skills can also be flagged **unilateral** (e.g. split squats). Reps are then logged once and mean "each side", and total volume counts both sides.
  - **Volume multiplier:** a set's volume is counted **× 2** if the skill is `per_side`, unilateral, or both. Both flags together still count × 2, not × 4.
- **FR-1.9** Only `weight_reps` skills with the `total` convention can be %-based main lifts.
- **FR-1.10** **Editing a skill after it has been logged:**
  - Each logged exercise keeps a snapshot of the skill's tracking type, load convention, unilateral flag and main-lift flag, so past sessions always display as they were logged.
  - Once a skill has any logged sets, its **tracking type** and **load convention** can no longer be changed. The editor shows these fields as locked, with a short explanation. Other fields stay editable.

### FR-2 Plan Templates & Plan Builder
- **FR-2.1** The app ships with three read-only built-in templates.

  > **Draft structures:** confirm the exact exercises with the product owner before seeding. The rules below apply to all three templates:
  > - Main-lift loads are % of TM, with TM% at 90%.
  > - Accessories use double progression (FR-3.15).
  > - Every muscle is trained at least twice a week.
  > - Each template includes a deload after about 6 weeks of hard training (FR-2.12). The periodised template uses its peak and taper in place of a second deload.
  > - Any phase that uses the "estimated from top sets" rule (FR-3.5) includes a weekly **top set** (FR-2.4) for each main lift. Only top sets and AMRAP sets can drive an estimated increase.
  > - In the two beginner templates, **Block 2 is a continuation of Block 1** (FR-2.11): it uses the same cycle blueprint and suggested-increase rules, and its cycles are numbered on from Block 1's (Block 2 = cycles 4–6).

  | Template | Length | Structure | Days/wk | Main lifts (draft) | Accessories | Cycle Review suggestion |
  |---|---|---|---|---|---|---|
  | **Beginner Hypertrophy** | 13 wk | Block 1 (6 wk) → Deload (1 wk) → Block 2 (6 wk, continuation); 2-wk cycles | 3 (full body A/B alternating) | 3–4 × 8–12 @ 65–72.5% TM, RPE 7–9 | 3 × 10–15, RPE 8–9 | +2.5% (no qualifying low-rep sets) |
  | **Beginner Strength** | 13 wk | Block 1 (6 wk) → Deload (1 wk) → Block 2 (6 wk, continuation); 2-wk cycles | 3 (full body A/B alternating) | 5 × 5 @ 75–80% TM, RPE 7–8 | 3 × 8–12, RPE 7–9 | Fixed: +2.5 kg / +5 lb for upper-body lifts, +5 kg / +10 lb for lower-body lifts, set per skill (see FR-3.5 beginner note) |
  | **Periodised Hypertrophy → Strength Peak & Taper** | 17 wk | see below | 4 (upper/lower) | see below | 3 × 8–15, RPE 7–9 | see below |

  The periodised template's phases:

  | Phase | Weeks | Type / cycle | Main lifts (draft) | Cycle Review |
  |---|---|---|---|---|
  | Hypertrophy | 1–6 | training, 2-wk cycle | 4 × 8–10 @ 67.5–72.5% TM, RPE 7–9 | every cycle, +2.5% |
  | Deload | 7 | deload (generated) | ~50% of sets @ 90% of normal load, RPE ≤ 7 | none |
  | Strength | 8–13 | training, 2-wk cycle | Week A: 5 × 4–6 @ 77.5–82.5% TM, RPE 7–8. Week B: top set 1 × 1–3 @ RPE 8 (pre-filled at 97.5% TM), then 4 × 4–6 @ 77.5–82.5% TM back-off sets | every cycle, estimated from top sets (fallback +2.5%) |
  | Peak | 14–16 | training, 1-wk cycle | 3–5 × 1–3 @ 87.5–95% TM, RPE 8–9 | none |
  | Taper | 17 | taper | ~50% of peak volume, singles/doubles @ ~95% TM (≈85% 1RM) early in the week, then 2–3 rest days and an optional Test Day | Final Review |

- **FR-2.2** Browsing a template shows:
  - its name, description and default program length
  - its phases, each with length, cycle length and suggested-increase rules
  - sessions per week
  - a preview of each cycle week
- **FR-2.3** The user can **start a plan from a template**. This creates an editable copy and never modifies the template. The user is then prompted for a start date, training weekdays and 1RMs (FR-3.3).
  - The start date **defaults to the next occurrence of the week-start day, or today if today is the week-start day** (FR-12.3), so plan weeks line up with calendar weeks. The user can pick any other date.
- **FR-2.4** The user can **build a plan from scratch**, defining:
  - plan name and description
  - **start date** (same default as FR-2.3)
  - one or more **phases** (FR-2.11), each with:
    - a name
    - a **length** in weeks
    - a **cycle length** in weeks (1–8, default 2)
    - **suggested-increase rules** (FR-3.5)
  - the phase's **workouts** (e.g. "Full body A"), each defined once with its skills and prescriptions (FR-2.15)
  - the **cycle-week schedule**: which workout falls on which **pinned weekday** in each cycle week (e.g. week A: Mon A, Wed B, Fri A)
  - the skills in each workout, picked from the Skill Library, in order
  - a **per-set prescription** for each skill:
    - target reps (single value, range, or AMRAP)
    - load, as **% of training max**, **double progression** (FR-3.15), a **fixed load**, **bodyweight**, or a **top set** (below)
    - an optional **target RPE** (single value or range, 6–10 in 0.5 steps)
    - rest time and notes (optional)
    - a "same for all sets" shortcut
  - **Top sets:** a top set is a heavy set prescribed by effort rather than by a fixed percentage, as used by strength coaches to gauge real capacity. The lifter works up to it and picks the load on the day. A top set has:
    - target reps of 1–5 (single value or range)
    - a **required** target RPE (default 8)
    - a **starting load** as % of TM (default 97.5%), used only to pre-fill the session
    - no AMRAP flag
    - Top sets are only available for skills that can be %-based (FR-1.9). Sets after a top set in the same exercise are usually **back-off sets**: normal %-of-TM sets.

  **Program length** is the sum of the phase lengths (1–52 weeks in total). A new plan starts as a single 12-week phase.
- **FR-2.5** **Cycle repetition:** within each phase, the user builds only the weeks of one cycle. The app repeats that cycle until the phase length is filled. Depending on the phase's review mode, cycles end with a **Cycle Review** (FR-3.8).
  - For example, a 12-week phase with a 2-week cycle gives 6 cycles.
  - If the phase length isn't a multiple of the cycle length, the final cycle is partial (e.g. 13 weeks gives 6 full cycles plus week A of cycle 7). The builder shows a notice when this happens.
- **FR-2.6** **Copy week:** within a cycle, the user can copy one cycle week's schedule to another; the copy uses the same workouts. The user can also **duplicate a workout** to create an independent variant (FR-2.15), and copy a whole cycle blueprint from one phase to another as a starting point.
- **FR-2.7** Skills within a workout can be reordered, and **supersets** can be grouped.
- **FR-2.8** The user can save any plan as a **personal template**.
  - The template stores the phases, cycle structures, prescriptions, suggested-increase rules and TM %.
  - It does not store the start date or 1RM/TM values.
- **FR-2.9** Phase blueprints can be edited after the plan starts. Edits apply to all future, unlogged sessions; completed logs are never changed.
- **FR-2.10** **Change phase length mid-plan:** the user picks a phase to extend or shorten, and all later phases move accordingly.
  - **Extending** generates additional weeks, continuing that phase's cycle pattern.
  - **Shortening** removes future, unlogged weeks, after confirmation. It can't cut before the current week.
- **FR-2.11** **Phases:**
  - A plan is an ordered list of one or more phases. Phases run back to back with no gaps.
  - Each phase has its own cycle blueprint and suggested-increase rules.
  - **1RMs and TMs carry across phases.** They change only through a Cycle Review (FR-3.8).
  - The builder hides the phase UI for single-phase plans until the user taps "Add phase".
  - Phases can be reordered, renamed or deleted (deletion is allowed only if the phase has no logged sessions).
  - Each phase has a **type** (`training`, `deload` or `taper`) and a **review mode**:
    - `every_cycle`: the default for training phases
    - `end_of_phase`
    - `none`: the default for deload and taper phases, and used by the template's Peak phase
  - **Continuation parts:** a training phase can be interrupted by a deload and then carry on. The part after the deload is a **continuation** of the original phase:
    - it shares the original phase's cycle blueprint and suggested-increase rules
    - its cycle numbering carries on from where the original part stopped
    - its Cycle Reviews belong to the original phase (together, the original and its continuations form a **cycle group**)
    - the builder shows the original phase and its continuations as **one phase with a deload inside it**, not as separate phases
  - Continuations are created by the beginner templates (FR-2.1), by adding a deload inside a phase (FR-2.12), and by "Deload now" (FR-4.6a). They are part of v1.0, independent of the full multi-phase builder.
- **FR-2.12** **Deload phases.** Evidence basis: deloads are typically about a week long, every ~4–6 weeks.
  - **Adding one:** the user can insert a deload phase (1–2 weeks, default 1) between phases or **inside** a training phase at a week boundary. Inserting inside a phase splits it into the original part and a continuation (FR-2.11).
    - **Active plans:** in v1.0, a deload can only be inserted while the plan is a draft. Inserting one into an active plan shifts later workouts and renumbers weeks (FR-4.9), so it arrives in v1.1 together with "Deload now" (FR-4.6a).
    - **Placement:** a deload must directly follow a training week, and can't sit directly before another deload. To rest longer, the user lengthens the existing deload (up to 2 weeks) instead.
  - **Generated content:** the app builds it from the workouts scheduled in the preceding training phase's first cycle week. It copies them as the deload's own workouts, on the same weekdays, with these defaults (all editable):
    - **weekdays follow the training days:** each copied workout stays linked to the appearance it was copied from, and takes that appearance's weekday when the user sets training days at plan start (FR-4.2). The user sets training days once, and the deload trains on the same days.
    - **volume factor** 50% of the **working sets**: sets are rounded up, with a minimum of 1 per skill. Warm-up sets are kept unchanged.
    - **load factor** 90% of normal prescribed load, applied to **every loaded set**: %-based, double-progression and fixed loads. Bodyweight sets are unchanged.
    - **RPE cap** 7 on every working set
    - **top sets** become normal %-of-TM sets at their starting load %, so the load factor and RPE cap apply as usual. There are no top sets in a deload.
    - **AMRAP sets** become fixed-rep sets at their minimum reps. An all-out set contradicts the RPE cap and the deload's purpose of shedding fatigue. There are no AMRAP sets in a deload.
  - **Behaviour:**
    - Deload loads use the current TM.
    - Deloads don't trigger a Cycle Review.
    - Double-progression state is paused (FR-3.15).
  - **Builder hint:** it shows "consider a deload" when a run of training phases without a deload exceeds 6 weeks. This is a hint only, never enforced.
- **FR-2.13** **Weekly volume display.** For each cycle week, the builder shows:
  - **sets per muscle group**, counting primary muscles as 1 set and secondary muscles as 0.5 (the "fractional" method)
  - **how many sessions hit each muscle**

  This is informational only. A muscle trained only once a week gets a neutral note ("trained 1×/week — 2×+ is generally recommended"). No volume target is enforced.
- **FR-2.14** **Taper phases.** Evidence basis: cut volume by ~30–70%, maintain intensity (≥ ~85% 1RM) or reduce it slightly, over 1–2 weeks, and finish with a few days off.
  - **Length:** 1–2 weeks.
  - **Defaults:**
    - **volume factor** 50% (allowed range 30–70%)
    - **intensity maintained**, so loads are not reduced by default
    - top sets are kept, so the lifter can gauge readiness before the Test Day
  - **Rest days:** optional, 2–7 days at the end with no scheduled sessions.
    - **Limit:** rest days can't exceed the taper's total days minus 2, so at least one training day and the Test Day slot remain (e.g. at most 5 rest days in a 1-week taper). The builder shows this limit and rejects larger values.
  - **Test Day:** an optional workout on the final day. For each main lift, it shows a warm-up ladder, then up to 3 single attempts that the user logs with RPE. Test Day results feed the Final Review (FR-3.9).
    - Test Day is the main source of Final Review suggestions for a program that ends in a taper, so the builder recommends one when a taper is added.
- **FR-2.15** **Workouts are defined once per phase.** A workout (its name, skills and prescriptions) is defined once in its phase's blueprint and placed on one or more weekday **slots** across the cycle weeks.
  - Editing a workout changes every appearance of it, subject to FR-2.9.
  - Double progression, "last time" data and increase badges follow the workout. Every appearance of "Full body A" shares one progression (FR-3.15).
  - To make appearances differ (e.g. a heavier Monday and a lighter Friday), the user duplicates the workout and edits the copy.

### FR-3 One-Rep Max, Training Max & Cycle Reviews
- **FR-3.1** **1RM record:** each skill has a current **one-rep max (1RM)**, with full history.
  - The 1RM **only changes when the user confirms it**. The app never changes it on its own from logged sets or PRs.
- **FR-3.2** **Training max is a function of 1RM:** `TM = 1RM × TM%`, with a **default TM% of 90%**.
  - TM% is set per plan and can be overridden per skill.
  - The TM is never entered directly; it is always derived from the 1RM.
- **FR-3.3** **Plan setup:** when a plan is created or started, each %-based skill is pre-filled with its current 1RM, and the resulting TM is shown.
  - **A 1RM is required** for every %-based skill before the plan can start. If one is missing, the user can **type a number** or tap **"Estimate it for me"**.
- **FR-3.3a** **"Estimate it for me"** is a guided test-set flow:
  1. **Safety and warm-up:** the app shows a short safety note and suggests warming up with a few progressively heavier sets.
  2. **Choose a load:** the user picks a weight they can lift for **3–5 good-form reps**.
  3. **Perform the set:** the user does the set and logs **reps (1–5)** and **RPE (7–10)**. Values outside these ranges are rejected, with guidance to adjust the load and try again.
  4. **Calculate:** the app computes the e1RM (FR-3.5 formula), rounds it (FR-3.6), and shows it for the user to **confirm or edit**.
  5. **Save:** the set is saved as an ad-hoc session tagged "1RM estimate". The confirmed value is written to 1RM history with source `setup_estimate`.
- **FR-3.3b** 1RMs, TM% and suggested-increase rules can be edited until the plan's first session is logged.
- **FR-3.4** **TM is constant within a cycle.**
  - Once a cycle's first session is logged, that cycle's 1RM and TM **can't be edited manually**.
  - Values change only through Cycle Reviews (FR-3.8).
  - **Late reviews:** a *pending* review for the previous cycle, completed late, updates only the current cycle's **unlogged** sessions. Logged sessions keep their snapshotted loads.
- **FR-3.5** **Loads and suggested increases**
  - **Prescribed load** = `TM × set%`. There is **no automatic per-cycle step-up**: weights only rise when a higher 1RM is confirmed.
  - **Suggested-increase rule:** each phase has a default rule, which can be overridden per skill. It is only a suggestion shown in the Cycle Review. The rule is one of:
    - **Estimated from top sets:** the default for main lifts in strength phases. Evidence basis: 1RM estimates are most accurate from low-rep sets, frequent true-max testing is fatiguing, and reps-in-reserve ratings are much more accurate with heavy loads close to failure than with moderate loads further from it. Coaches therefore gauge strength from a heavy top set rather than from moderate working sets.
      - **Qualifying sets:** completed, non-warm-up, non-failed sets from this cycle with **1–5 reps** that are either:
        - a **top set** (FR-2.4) with a logged RPE ≥ 7, or
        - an **AMRAP** set (with or without an RPE; without one, RIR 0 is used)
      - **Other working sets never qualify**, including back-off sets and straight sets logged at their target RPE. Moderate sets rated at RPE 7–8 would otherwise estimate below the lifter's real max and block every increase.
      - **Formula:** `e1RM = load × (1 + (reps + RIR) / 30)`, where `RIR = 10 − RPE`. If `reps + RIR = 1`, `e1RM = load`.
      - **Suggestion:** the best qualifying e1RM, rounded. It is **never below the current 1RM**; if the estimate is at or below it, the review shows "no increase suggested" with the estimate as reference. Because only heavy top sets and AMRAP sets qualify, this is treated as a genuine signal, and the fallback rule is **not** used in its place.
      - **Fallback:** if no sets qualify (for example, the top set was skipped, failed or logged below RPE 7), the fallback rule (percentage or fixed) is used and labelled as such.
      - **Beginner note:** less experienced lifters misjudge reps in reserve by several reps. Beginner templates therefore default to fixed or percentage rules. Their Cycle Reviews show an estimate as reference only if a qualifying set (a top set or AMRAP set) was logged; ordinary working sets never produce one. The estimated rule is the default in the intermediate periodised template.
    - **Percentage:** suggested 1RM = current 1RM × (1 + increment%)
    - **Fixed:** suggested 1RM = current 1RM + a fixed increment (set per unit, e.g. +5 kg / +10 lb)
    - **None:** no increase is suggested (e.g. a taper phase)
  - **Rounding:** see FR-3.6.
- **FR-3.6** **Rounding:** prescribed loads and suggested 1RMs are rounded to the nearest load increment **in the user's display unit** (FR-1.6), with ties rounded down.
  - An lb user sees clean lb numbers (e.g. 185 lb), never converted values like 83.9 kg → 185.0 lb.
  - The rounded display value is converted to kg for storage without further rounding.
- **FR-3.7** **Non-percentage skills** use **double progression** by default (FR-3.15). A plain fixed load with no progression is also allowed. These skills do not appear in Cycle Reviews.
- **FR-3.8** **Cycle Review**
  - **When it opens:** it follows the phase's review mode (FR-2.11). Reviews belong to the phase's **cycle group**, so a phase split by a deload keeps one continuous set of cycle reviews.
    - `every_cycle`: when a cycle finishes, meaning every session in it is completed, skipped or missed, the app opens a Cycle Review, e.g. **"Well done — Strength Cycle 2 complete!"**
    - `end_of_phase`: only after the phase's last cycle.
    - `none`: never.
    - **Program end:** if a cycle's end is also the end of the program, no Cycle Review is created for it. The Final Review (FR-3.9) takes its place.
  - **Summary:** sessions completed out of planned (e.g. 5/6), and any PRs hit.
  - **Per skill:**
    - current 1RM and TM
    - **suggested new 1RM** (FR-3.5), its source ("from 140 kg × 3 @ RPE 8" or "+2.5% rule"), and the resulting TM, e.g. "Increase TM 99 → 101.25 kg"
    - reference data, clearly labelled as information only: the heaviest completed single this cycle, and the best estimated 1RM from this cycle's **qualifying sets** (FR-3.5). Either is shown as "—" when there is none.
  - **Actions:**
    - **"Increase all"** (the primary button) confirms every suggestion.
    - Per skill, the user can **accept**, **edit** the value, or **keep current**.
    - **"Keep all current"** declines every suggestion. Nothing changes, and the next cycle uses the same loads.
    - Entering a value **lower** than current is allowed, after a confirmation prompt.
  - **No automatic threshold:** missed sessions never block or change the suggestion. The user decides; the review simply shows the completion count.
  - **Timing:**
    - Confirmed values apply from the **first week after the reviewed cycle** (the next cycle's first unlogged session, or the next phase if the cycle ended a phase), and are written to 1RM history.
    - If the review is dismissed, it stays **pending**. The Today screen shows a banner, and the next cycle uses the current values until the review is completed.
    - If the review is completed late, only sessions not yet logged are updated.
  - **Several pending reviews:** reviews must be completed **in order**, oldest first. The banner always opens the oldest pending review, and a later review uses the result of the earlier one as its "current" values.
  - **Keeping reviews current:** a pending review's figures (sessions completed, current values, suggestions and reference data) are recalculated whenever they could have changed. This happens:
    - when the review is opened
    - after a session in its cycle is logged, edited or deleted
    - after an earlier review is completed

    Values are fixed once the review is completed.
    - **Withdrawal:** if a pending review's cycle stops being finished, the review is withdrawn, and a new one opens when the cycle finishes again. This happens, for example, when a missed workout in the cycle is moved or pushed to a later date, or its session is deleted.
    - **Completed reviews** are never reopened. Sessions from the cycle that are logged afterwards keep that cycle's loads and don't change the confirmed values.
  - **Phase boundaries:** the review at the end of a phase's last cycle works the same way. Its confirmed values carry into the next phase.
- **FR-3.9** **End of program:** a **Final Review** always runs when the program ends, whatever the last phase's review mode. It uses the Cycle Review UI, and it replaces any Cycle Review the last cycle would otherwise have had (FR-3.8). The FR-3.8 rules for keeping reviews current apply to it too.
  - **Suggestion sources, in priority order:**
    1. **Test Day** results, if any attempt was completed: the best successful single, or an RIR-adjusted estimate
    2. if the program ends in a **training phase**: that phase's own suggested-increase rule (FR-3.5), applied to the program's final cycle, exactly as that cycle's Cycle Review would have applied it (e.g. Beginner Strength's fixed rule, or an estimated rule with its fallback)
    3. otherwise (the program ends in a deload or taper, or the rule is `none`): no increase is suggested, and the user can still enter a value
  - **Reference data:** as in FR-3.8, taken from the final cycle. If the program ends in a deload or taper, it comes from the last training cycle instead (e.g. the Peak phase's heaviest single).
  - **Program Summary:** after the Final Review, it shows adherence, PRs and 1RM changes across the whole program.
  - Confirmed 1RMs pre-fill the next plan (FR-3.3).
- **FR-3.10** **PRs** are recorded as PRs (FR-10) and shown as reference in Cycle Reviews. They never change the 1RM or TM without confirmation.
- **FR-3.11** **Updating a 1RM between programs:** when no plan is active, the user can set a new 1RM for any skill (e.g. after a test day, a layoff or an injury).
  - The value can be **raised or lowered**; lowering asks for confirmation.
  - An optional note can record the reason (e.g. "shoulder injury").
- **FR-3.12** **Calculated loads:** prescribed loads are **calculated, not stored** on planned workouts. When a session starts, they are snapshotted into the log (FR-9). For a top set, the snapshotted value is its pre-filled starting load (`TM × starting %`, rounded).
- **FR-3.13** **Plan load table:** the plan screen shows each skill's 1RM and TM per cycle.
  - Past cycles show the values that were used.
  - Future cycles show the current values, marked "projected — updates after each Cycle Review".
- **FR-3.14** **Cycle Reviews follow cycle completion, not calendar time.** Schedule shifts (FR-4.5) do not change which cycle a workout belongs to.
- **FR-3.15** **Double progression** is the default for accessories and non-percentage skills.
  - **Prescription:** each set has a rep range (e.g. 3 × 8–12), an optional target RPE, and a working load. The working load is entered at plan setup or in the first session, pre-filled from "last time".
  - **Suggesting an increase:** when **every working set** in a session reaches the **top of the range** at or below the target RPE (or just reaches the top, if no RPE was logged), the next session pre-fills **load + the skill's increment**. The rep target resets to the bottom of the range, and a "↑ +2.5 kg" badge shows. The user can revert with one tap.
    - Every prescribed working set must be completed for an increase. Failed or missing sets mean no increase.
  - **Otherwise:** the load stays the same, and the goal is to add reps.
  - **Working load after a session:** the load used for the next session is the **most common load** across that exercise's completed working sets, so a load the user changed mid-session carries forward. If there's a tie, the heavier load is used.
  - **Rep pre-fill:**
    - after an increase: the bottom of the range, for every set
    - otherwise: the reps the user achieved in the same set last session, kept within the range
    - "Done as planned" (FR-9.2) logs these pre-filled values.
  - **No automatic decreases.** If the bottom of the range is missed on every set in two consecutive sessions, the app shows a neutral "consider reducing load" hint.
  - **Scope:** state is kept per plan, per workout (FR-2.15) and per exercise within it, so every appearance of the same workout shares it. It is paused during deload and taper phases, and resumes afterwards. Deload loads for these skills are the working load × the deload load factor (FR-2.12).

### FR-4 Active Plan & Scheduling
- **FR-4.1** **Only one plan can be active at a time.** This is a firm product decision. Starting a new plan requires confirming that the current one will be ended, or paused once pause is available (FR-4.10). Ad-hoc workouts (FR-9.13) remain available alongside it.
- **FR-4.2** On creation, the plan records a **start date**, and every workout slot in each phase's cycle (FR-2.15) is **pinned to a weekday** (e.g. Mon Upper A, Wed Lower A, Fri Full).
- **FR-4.3** **Date resolution:**
  - plan week *N* covers the 7 days starting on `startDate + 7 × (N − 1)`
  - each workout is scheduled on the first occurrence of its pinned weekday within its plan week
  - plan week *N* belongs to the phase whose week range contains it
  - within that phase's cycle group, it belongs to cycle `ceil(weeksIntoGroup / phase.cycleLength)`, where `weeksIntoGroup` counts the weeks of the original phase and any earlier continuation parts (FR-2.11)
- **FR-4.4** Plan states: `draft`, `active`, `paused`, `completed`, `abandoned`.
- **FR-4.5** **Shift remaining plan:** from any upcoming or missed workout, the user can **push the rest of the plan back** (later) or **pull it forward** (earlier) by *N* days.
  - That workout and every later one move by the same offset, keeping their order and spacing.
  - Completed and skipped workouts do not move.
  - The plan's end date updates.
- **FR-4.6** **Shifts always preserve spacing.** Workouts are never stacked on the same day or reordered. A shift in **either direction** is rejected, with an explanation, if any moved workout would land on the same day as a workout that isn't moving (e.g. a later skipped workout). A forward shift is also rejected if any moved workout would land:
  - before today
  - on or before the most recently completed workout
- **FR-4.6a** **"Deload now"**
  - **Access:** available from the Today screen and Plan Detail during a training phase.
  - **When it can't be used:**
    - during a deload or taper phase
    - while a session is in progress
  - **What it does:**
    1. Asks for a start date (default today) and a length (1 week by default, or 2 weeks).
    2. Inserts a **deload phase** generated from the current training phase's current cycle week (FR-2.12 factors).
    3. **Pushes every not-yet-completed workout from that date onward back** by the deload length. This is an FR-4.5 shift, so spacing is preserved and FR-4.6 validation applies.
  - **Where the phase splits:** the deload is inserted at a plan-week boundary.
    - If the current plan week has **no logged sessions**, the split comes **before** the current week. The whole week is pushed back and resumes after the deload.
    - If the current plan week **already has a logged session**, the split comes **after** the current week. The week's remaining workouts keep their week number and are pushed back with the rest (the user can skip them). The dialog explains this before the user confirms.
  - **Mid-phase insertion:** if the deload lands in the middle of a phase, the part after it becomes a continuation (FR-2.11).
    - The **cycle index continues** across the split, so the cycle in progress resumes where it stopped.
    - Its Cycle Review still happens when that cycle finishes.
  - **History:** recorded in schedule history as `insert_deload` and can be undone (FR-4.13).
- **FR-4.7** **Move one workout only:** as an alternative to FR-4.5, the user can move a single upcoming or missed workout to another date without affecting the rest.
  - The new date can't be before today.
  - Moving onto a day that already has a workout **is allowed**, after a warning (e.g. "You'll have 2 workouts on Thu"). This is the user's explicit choice, unlike a bulk shift.
- **FR-4.8** **Change training days:** the user can re-pin weekdays from a chosen plan week onward (e.g. Mon/Wed/Fri → Tue/Thu/Sat). Workouts in those weeks are re-resolved.
- **FR-4.9** Shifts, moves and day changes never alter a workout's phase, cycle index or week index (see FR-3.14).
  - **Exceptions:** operations that insert or remove weeks (inserting a deload, "Deload now" and phase length changes) renumber the week index of every later workout. When a phase is split, workouts after the split move to the continuation phase record, which keeps the original's cycle count. Any stored week references (such as when a confirmed 1RM takes effect) are updated in the same step.
- **FR-4.10** **Pause/resume:** pausing freezes the schedule. Resuming applies an FR-4.5 shift equal to the number of paused days.
- **FR-4.11** **Missed workouts** stay on their date with `missed` status until the user acts (FR-7.6). There is no automatic shifting.
- **FR-4.12** The user can **skip** a workout, marking it as skipped rather than missed.
- **FR-4.13** Every schedule change (shift, move, day change, pause, phase length change or inserted deload) is recorded in a visible **schedule history**. The most recent change can be undone.
- **FR-4.14** **Program end:** once every workout is completed, skipped or missed, the Final Review opens (FR-3.9).
  - If every workout is completed or skipped, the plan is marked `completed` automatically.
  - If some are missed, the Today screen offers three choices:
    - **finish the plan**
    - **push the rest back** (FR-4.5)
    - **extend it** (FR-2.10, v1.1)

    Pushing back or extending withdraws a pending Final Review (FR-3.8).
  - Completing the Final Review marks the plan `completed`, and any missed workouts stay missed. The Program Summary follows (FR-3.9).
- **FR-4.15** **Ending a plan early:** the user can end an active or paused plan from Plan Detail, or by starting a new plan (FR-4.1).
  - **Pending reviews:** if any Cycle Reviews are pending, the confirmation offers two choices:
    - **Review now** completes them in order, then ends the plan.
    - **End without reviewing** discards them.
  - **No Final Review** is created. The user can still update 1RMs afterwards (FR-3.11).
  - The plan is marked `abandoned`, and a Program Summary covers the sessions up to the end date.
  - **Remaining workouts:** open workouts dated before the end date stay `missed`. Later ones show as "Not done (plan ended)" and don't count towards adherence.

### FR-5 First-Launch Disclaimer
- **FR-5.1** **First launch only:** a health and safety disclaimer is shown **on the very first app launch only**, before onboarding. It covers:
  - the content is general information, not medical advice
  - consult a qualified professional before starting a program
  - train at your own risk
  - stop and seek help if you feel pain or unwell
- **FR-5.2** The user must tap **"I understand"** to continue. The acknowledgement is stored locally with a timestamp.
- **FR-5.3** The disclaimer is **never shown again** automatically, including after app updates. It stays readable at any time under **Settings → About → Disclaimer**.
- **FR-5.4** Clearing app data or reinstalling counts as a first launch.

### FR-6 In-App Explanations
- **FR-6.1** Key terms (1RM, TM, TM%, RPE/RIR, cycle, phase, deload, taper, double progression, AMRAP) show a small **ⓘ** wherever they appear. Tapping it opens a 2–3 sentence plain-language explanation.
- **FR-6.2** The **first** time a user meets each of these, a one-time tip explains it:
  - the RPE picker
  - the first Cycle Review
  - the first deload

  Tips can be dismissed and re-enabled in Settings.
- **FR-6.3** Explanations live in one local content file, so they can be edited without code changes.

### FR-7 Today Screen (Home)
- **FR-7.1** This is the default screen on launch.
- **FR-7.2** It shows **today's scheduled workout**: name, phase, cycle and week (e.g. "Strength · Cycle 1 · Week 9 of 17"), skill list with target sets × reps × calculated load, and estimated duration.
- **FR-7.2a** If a Cycle Review is pending (FR-3.8), it shows a banner that opens the oldest pending review.
- **FR-7.3** A primary **"Start Workout"** action opens the logging flow (FR-9).
- **FR-7.4** If today is a **rest day**, it says so and shows the next scheduled workout and its date.
- **FR-7.5** If today's workout is already completed, it shows a completion summary, including any PRs hit.
- **FR-7.6** If there are **missed workouts**, it surfaces them with these options:
  - **Do now and push the rest back** (FR-4.5), which is the default
  - **Move this one only** (FR-4.7)
  - **Skip** (FR-4.12)
- **FR-7.7** It shows a compact **plan progress meter** (see FR-8.3).
- **FR-7.8** If there is no active plan, it shows an empty state with actions to "Browse templates" or "Build a plan".

### FR-8 Week View & Progress
- **FR-8.1** The **week view** shows the 7 days of the current **calendar week**, starting on the week-start day (FR-12.3). Each day shows its workout name(s) or "Rest", and a status of `upcoming`, `today`, `completed`, `missed` or `skipped`.
  - Workouts are placed by their scheduled date, so shifted and moved workouts appear on the day they now fall on. A day with two workouts (FR-4.7) shows both.
  - The header shows the plan week(s) of the workouts in view (e.g. "Plan week 5"). When the plan starts on the week-start day (the default, FR-2.3) and nothing has been shifted, calendar weeks and plan weeks line up exactly.
- **FR-8.2** The user can swipe or step between weeks (past and future). Tapping a day opens its workout detail.
- **FR-8.3** The **plan progress meter** displays the current phase, plus:
  - current week out of total (e.g. "Week 5 of 12")
  - sessions completed out of total scheduled sessions, as a percentage and a progress bar
  - an adherence rate: completed ÷ (completed + missed), with skipped sessions excluded
- **FR-8.4** A **full plan overview** shows all plan weeks in a grid or list with per-session status. This replaces the "link to the database" from the Notion setup.

### FR-9 Workout Logging
- **FR-9.1** Starting a workout creates a **session** with a start timestamp.
- **FR-9.2** Each exercise shows its target sets, pre-filled with target reps and load (see FR-3.15 for double-progression pre-fill), so a typical set is logged with **one tap** ("done as planned").
- **FR-9.2a** **Per-set RPE:** after a set is marked done, a compact RPE picker (6–10 in 0.5 steps) appears inline.
  - **Main lifts (`isMainLift`) and all top sets: RPE is required.** The set isn't recorded as complete until an RPE is chosen, which is a single tap on the pre-highlighted value.
  - **Other skills:** RPE is optional, and the picker can be dismissed with one tap.
  - When the set has a target RPE, the picker is pre-highlighted at that value.
  - RPE feeds 1RM estimation (FR-3.5) and double progression (FR-3.15).
- **FR-9.2b** **Top sets in a session:**
  - The set is labelled "Top set" and shows its target, e.g. "Work up to 1–3 reps @ RPE 8".
  - The load is pre-filled from the starting % of TM. The app explains that the lifter should adjust it to reach the target RPE, and shows last cycle's top set as reference (e.g. "Last: 100 kg × 2 @ RPE 8").
  - The user adds warm-up sets as needed (FR-9.14). Back-off sets keep their calculated loads.
- **FR-9.3** The user can edit **actual reps, load or time** for any set before or after marking it done. `completion_only` items have only a done checkbox.
- **FR-9.4** The user can **add or remove sets**, **swap an exercise** for another from the library, or **add an unplanned exercise**, for this session only.
- **FR-9.5** When "last time" data exists, it is shown per exercise (e.g. "Last: 3×8 @ 60 kg").
- **FR-9.6** A **rest timer** starts automatically after a set is marked done, using the planned rest time or a default. It can be skipped or adjusted, and it notifies the user when finished, even when the app is backgrounded.
- **FR-9.7** The user can add an optional **note** per exercise and per session, plus an optional session **effort rating** (RPE 1–10).
- **FR-9.8** **Finish Workout** records an end timestamp and shows a summary: duration, total volume (using the FR-1.8 volume multiplier), sets completed, and PRs hit.
- **FR-9.9** A session can be finished with incomplete sets. It is then marked `completed` with its partial data kept.
- **FR-9.10** An in-progress session **survives app close or crash** and resumes where the user left off.
- **FR-9.11** The user can **discard** an in-progress session after confirming.
- **FR-9.12** The user can **edit or delete** past sessions from history.
- **FR-9.13** The user can log an **ad-hoc workout** that is not part of any plan. Only one session can be in progress at a time.
- **FR-9.14** **Warm-up sets:** sets can be marked as warm-ups, either in the prescription or added during a session.
  - Warm-ups are shown in a lighter style.
  - They **don't require RPE**.
  - They're **excluded** from PRs, e1RM, 1RM suggestions, double progression, total volume and set counts.
- **FR-9.15** **Failed sets:** a set can be marked **failed**, e.g. a missed Test Day attempt or a rep that didn't complete. Failed sets are kept in history but excluded from PRs, e1RM and 1RM suggestions.

### FR-10 Personal Records
- **FR-10.1** PRs are **detected automatically** when a session is finished, per exercise:
  - **Heaviest weight** (any reps) for `weight_reps`
  - **Best estimated 1RM** for `weight_reps`, using the RIR-adjusted Epley formula (FR-3.5) for sets of 1–10 reps. **If a set has no RPE, RIR 0 is used** (plain Epley). This applies to PRs only; 1RM suggestions still need RPE ≥ 7 or AMRAP (FR-3.5).
  - **Most reps at a given weight** for `weight_reps`
  - **Most reps in a set** for `reps_only`
  - **Heaviest added load** and **most reps at a given added load** for `bodyweight_plus_load` (no e1RM, since bodyweight isn't tracked)
  - **Longest time** for `time`
  - No PRs for `completion_only`
- **FR-10.2** New PRs are highlighted in the session summary and on the Today screen after completion.
- **FR-10.3** A **PR board** lists current PRs for every exercise the user has logged, each with its date.
- **FR-10.4** An **exercise detail** screen shows PR history and a simple chart of top set or estimated 1RM over time.
- **FR-10.5** Editing or deleting a past session **recalculates** the affected PRs.
- **FR-10.6** The user can **manually enter a PR**, e.g. from before using the app. It is flagged as manual.
- **FR-10.7** Heaviest-single and estimated-1RM PRs are shown as reference in Cycle Reviews (FR-3.8). They never change the 1RM without confirmation.

### FR-11 History
- **FR-11.1** A reverse-chronological list of completed sessions, showing date, workout name, duration and PR indicator.
- **FR-11.2** Filters: by plan, and by exercise.
- **FR-11.3** Tapping a session opens full detail, with edit and delete actions (see FR-9.12).
- **FR-11.4** Ended plans are listed with their final adherence stats.

### FR-12 Settings
- **FR-12.1** Units: kg or lb. Values are stored in one canonical unit (kg) and converted for display.
- **FR-12.2** Default rest time.
- **FR-12.3** Week start day (Monday or Sunday). This sets the layout of the week view (FR-8.1) and the default plan start date (FR-2.3).
- **FR-12.4** Default weight increment **per unit** (e.g. 2.5 kg and 5 lb), used for quick +/- buttons and rounding when a skill has no override.
- **FR-12.5** Notifications: workout-day reminder (on/off and time) and rest timer alerts.
- **FR-12.6** Theme: light, dark or system.
- **FR-12.7** **Export all data** to JSON as a backup, and **import** it back (see NFR-4).
- **FR-12.8** **Backup status and reminder:**
  - Settings shows the date of the last export, and whether device backup is expected to include app data.
  - If there has been no export for 30 days and an active plan exists, the Today screen shows a gentle, dismissible reminder, at most once a month.
  - Onboarding includes a one-line note: "Your data lives on this phone — keep phone backups on or export regularly."
- **FR-12.9** **Automatic cloud backup (no login):** the user can switch on automatic backups to **their own** cloud storage (iCloud Drive on iOS, Google Drive on Android).
  - **When it runs:**
    - after each finished session
    - after each Cycle Review
    - at most once a day otherwise
  - **What it writes:** the same versioned JSON as FR-12.7, to an app folder in the user's storage. The latest 10 backups are kept.
  - **Restore:** on a fresh install, if a cloud backup is found, the app offers to restore it before onboarding. Restoring follows the NFR-4 import rules.
  - **Cost and privacy:** no app-owned server is involved, so it adds no running costs and collects no data. Failures are shown quietly in Settings and never block training.
  - **Off by default.** It is offered during onboarding and in Settings.
  - **Platform note:**
    - **iOS** uses the iCloud Drive container with no extra sign-in.
    - **Android** needs a one-time Google authorisation for the Drive app-data folder. This is permission to the user's *own* Drive, not an app account. The Drive API is used within its free quota.
  - **Implementation gate:** Expo has no first-party module for either storage. Before v1.1 work starts, a technical spike must confirm a suitably licensed library (§1.3) for both platforms, and confirm Google's verification requirements for the Drive app-data scope (see Open Question 2).

---

## 4. Data Model (logical)

Entity names and fields are indicative; the implementation may refine them but must preserve these relationships. The physical schema is in `docs/DESIGN.md` §4.

```
Skill                                   (UI name for exercise)
  id, name, muscleGroup, secondaryMuscleGroups[], equipment,
  trackingType: weight_reps|reps_only|bodyweight_plus_load|time|completion_only,
  loadConvention: total|per_side, isUnilateral,
  isMainLift, loadIncrementKg?, loadIncrementLb?, isCustom, isArchived

PlanTemplate                            (read-only built-ins + user-saved)
  id, name, description, defaultTmPercent, isBuiltIn
  └─ TemplatePhase (order, name, type: training|deload|taper,
                    reviewMode: every_cycle|end_of_phase|none,
                    lengthWeeks, cycleLengthWeeks,
                    volumeFactor?, loadFactor?, rpeCap?, restDaysAtEnd?, hasTestDay?,
                    continuesPhaseId?, continuesOffsetWeeks?,   ← e.g. Block 2 in the beginner templates
                    defaultIncrementType, defaultIncrementValue, fallbackIncrementType?, fallbackIncrementValue?)
       ├─ TemplateIncreaseRule (skillId, incrementType: estimated|percent|fixed|none, incrementValue,
       │                        fallbackType?, fallbackValue?)
       ├─ TemplateWorkout (name, order, kind: normal|test_day)        ← defined once per phase (FR-2.15)
       │    └─ TemplateExercise (skillId, order, supersetGroup, restSec?, notes,
       │                         sourceExerciseId?)          ← set on generated deload/taper copies
       │         └─ TemplateSet (setIndex, isWarmup, repsMin, repsMax, isAmrap,
       │                         targetRpeMin?, targetRpeMax?,
       │                         loadType: percent_tm|double_progression|fixed|bodyweight|top_set,
       │                         loadPercent?,                  ← for top_set: starting % of TM
       │                         fixedLoadKg?,
       │                         targetTimeSec?)
       └─ TemplateSlot (cycleWeekIndex, weekday, workoutId, order,
                        sourceSlotId?)                           ← each appearance of a workout

Plan
  id, name, description, sourceTemplateId?, status,
  startDate, defaultTmPercent (0.9), endedOn?, createdAt   ← programLengthWeeks is derived from phases
  ├─ PlanSkill (id, skillId, tmPercent, startingOneRmKg?)
  ├─ PlanPhase (id, order, name, type, reviewMode, lengthWeeks, cycleLengthWeeks,
  │             volumeFactor?, loadFactor?, rpeCap?, restDaysAtEnd?, hasTestDay?,
  │             generatedFromPhaseId?,          ← set for generated deloads
  │             continuesPhaseId?,              ← continuation part (FR-2.11); shares the original's blueprint
  │             continuesOffsetWeeks?,          ← weeks of the cycle group before this part
  │             defaultIncrementType, defaultIncrementValue, fallback…)
  │    ├─ PhaseIncreaseRule (same shape as TemplateIncreaseRule)
  │    ├─ CycleWorkout (id, name, order, kind: normal|test_day)    ← blueprint, defined once (FR-2.15)
  │    │    └─ CycleExercise (same shape as TemplateExercise)
  │    │         └─ CycleSet (same shape as TemplateSet)
  │    └─ CycleSlot (id, cycleWeekIndex, weekday, cycleWorkoutId, order,
  │                  retiredFromGroupWeek?,
  │                  sourceSlotId?)                                ← weekday appearances; set on deload copies
  ├─ PlannedWorkout (id, phaseId, cycleGroupId, cycleWorkoutId, cycleSlotId?, phaseCycleIndex, weekIndex,  ← generated
  │                  scheduledDate, status: upcoming|completed|skipped,   ← missed is derived
  │                  sessionId?)
  ├─ DoubleProgressionState (cycleExerciseId, workingLoadKg, previousWorkingLoadKg?,
  │                          lastIncreasedAt?, lastReps[], consecutiveBelowMin)   ← paused is derived from phase type
  ├─ CycleReview (id, kind: cycle|final, cycleGroupId, phaseCycleIndex,
  │               status: pending|completed,
  │               sessionsCompleted, sessionsPlanned, completedAt?)
  │    └─ CycleReviewItem (skillId, previousOneRmKg, suggestedOneRmKg?,
  │                        suggestionSource: estimated|test_day|percent|fixed|none,
  │                        isFallback, referenceE1rmKg?, heaviestSingleKg?,
  │                        sourceSetLogId?,
  │                        confirmedOneRmKg?, decision: accepted|edited|kept)
  └─ ScheduleChange (id, type: shift|move|repin|pause|length|insert_deload, fromPlannedWorkoutId?,
                     fromWeekIndex?, offsetDays?, payload, createdAt, undoneAt?)

Session                                 (a logged workout, planned or ad-hoc)
  id, plannedWorkoutId?, phaseId?, cycleGroupId?, phaseCycleIndex?, startedAt, endedAt?,
  status: in_progress|completed, notes, rpe
  └─ SessionExercise (id, skillId, cycleExerciseId?, order, notes, wasSubstituted, tmSnapshotKg?,
                      trackingType, loadConvention, isUnilateral, isMainLift)   ← snapshots (FR-1.10)
       └─ SetLog (id, setIndex, isWarmup, isTopSet, prescribedReps, prescribedLoadKg,
                  targetRpe?, reps, loadKg, rpe?, timeSec, isAmrap,
                  status: pending|completed|failed, completedAt)

OneRepMaxHistory                        (the skill's confirmed 1RMs over time)
  id, skillId, oneRmKg, source: plan_setup|setup_estimate|cycle_review|manual,
  planId?, effectiveFromWeekIndex?, cycleReviewId?, note?, setAt
  → the skill's "current 1RM" is the latest row

PersonalRecord
  id, skillId, type (heaviest|e1rm|reps_at_weight|max_reps|
                     heaviest_added|reps_at_added|longest_time),
  value, contextWeightKg?, sessionId?, setLogId?, achievedAt, isManual

Settings (singleton)
  unit, defaultRestSec, weekStart, weightIncrementKg, weightIncrementLb, reminders, theme,
  disclaimerAcknowledgedAt?, tipsEnabled, seenTips[],
  lastExportAt?, backupReminderDismissedAt?, autoBackupEnabled, lastAutoBackupAt?, lastAutoBackupError?
```

**Rules**
- **Indexes:**
  - `phaseStartWeek = 1 + sum(lengthWeeks of earlier phases)`
  - `weeksIntoGroup = (continuesOffsetWeeks ?? 0) + (weekIndex − phaseStartWeek + 1)`
  - `phaseCycleIndex = ceil(weeksIntoGroup / cycleLengthWeeks)`
  - `cycleWeekIndex = ((weeksIntoGroup − 1) mod cycleLengthWeeks) + 1`
  - `programLengthWeeks = sum(phase.lengthWeeks)`, and `weekIndex ≤ programLengthWeeks`
- **Cycle groups:** `cycleGroupId = continuesPhaseId ?? phase.id`. A continuation uses its original phase's blueprint, increase rules and review mode. Cycle Reviews are keyed by `(cycleGroupId, phaseCycleIndex)`.
- **Initial dates:** `scheduledDate` is set by FR-4.3 when the plan is generated. After that, it is changed only by schedule changes (FR-4.5–4.10, FR-4.6a, FR-2.10). Completed and skipped workouts never move.
- **1RM for a cycle:** the latest `OneRepMaxHistory` row for the skill in this plan whose `effectiveFromWeekIndex` is at or before the cycle's first week. If there is none, the plan's starting 1RM. A split cycle's first week is in its original part.
- **Effective week is derived:** in-plan rows only come from plan setup (always week 1) or a Cycle Review (the first week after the reviewed cycle's last week). `effectiveFromWeekIndex` is a stored copy of that derived value, and every operation that renumbers weeks (FR-4.9) must recalculate it in the same transaction.
- **TM for a cycle:** `1RM × tmPercent`. It is constant within the cycle.
- **Prescribed load:**
  - percentage sets: `TM × set%`
  - top sets: `TM × starting %` (a pre-fill the user adjusts)
  - double-progression sets: `workingLoadKg`
  - fixed sets: `fixedLoadKg`
  - in deload phases, each of the above is multiplied by `loadFactor` (FR-2.12)
  - the result is rounded (FR-3.6). There is no automatic step-up.
- **Cycle lock:** once a cycle's first session is logged, its 1RM/TM can't be edited manually. A Cycle Review's `effectiveFromWeekIndex` is the first week after the reviewed cycle. Because logged sessions keep snapshots, a late review only affects unlogged sessions (FR-3.4).
- **1RM updates:** a new `OneRepMaxHistory` row is written only by user action: plan setup, a confirmed Cycle Review, or a manual update (FR-3.11). Logged sets never write to it. "Keep current" writes no row.
- **Snapshots:** prescribed loads are calculated at read time and snapshotted into `SetLog.prescribedLoadKg` and `SessionExercise.tmSnapshotKg` when a session starts. Skill properties are snapshotted onto `SessionExercise` (FR-1.10).
- **Review timing:** a `CycleReview` is created as `pending` when the cycle's last session is resolved (completed, skipped or missed), but only if the phase's `reviewMode` requires one and the cycle doesn't end the program. A `final` review is always created when the program ends. Pending reviews are completed oldest first, recalculated whenever their inputs change, and withdrawn if their cycle stops being resolved (FR-3.8).
- **e1RM:** `load × (1 + (reps + RIR)/30)`, where `RIR = 10 − rpe`. AMRAP sets without an RPE use RIR 0, and `reps + RIR = 1` gives `load`. Only top sets with RPE ≥ 7 and AMRAP sets, with 1–5 reps, qualify for suggestions (FR-3.5). For PRs, sets of 1–10 reps count, and a missing RPE uses RIR 0 (FR-10.1).
- **Volume:** `reps × load × multiplier`, where the multiplier is 2 for `per_side` or unilateral skills and 1 otherwise (FR-1.8).
- **Deload generation:** a generated deload copies the workouts scheduled in the source phase's cycle week 1 (or the current cycle week for "Deload now") as its own workouts and slots. Working sets become `ceil(workingSets × volumeFactor)` (minimum 1) and warm-ups are kept unchanged. On working sets, `targetRpeMax` becomes `min(target, rpeCap)`, top sets become `percent_tm` sets at their starting %, and AMRAP sets become fixed-rep sets at their minimum reps. Generated exercises keep a link to their source exercise, so double-progression state can be read (not written) during the deload. Generated slots keep a link to their source slot and take its weekday pin at plan start. After generation it is a normal editable phase.
- **Taper rest days:** `restDaysAtEnd ≤ (lengthWeeks × 7) − 2` (FR-2.14).
- **Blueprint edits:** editing a `CycleWorkout` affects every open appearance of it (all its slots). Editing slots re-dates or regenerates only `PlannedWorkout`s that are not yet completed or in progress.
- **Dates and times:**
  - `startDate`, `scheduledDate` and all plan dates are **local calendar dates** (`YYYY-MM-DD`) with no time zone.
  - Event timestamps (`startedAt`, `completedAt`, etc.) are stored in UTC.
  - Travel and daylight-saving changes never move a scheduled workout.
- **Excluded sets:** warm-up and failed sets are excluded from PRs, e1RM, suggestions, double progression and volume (FR-9.14, FR-9.15).
- **Missed status** is derived: the scheduled date is before today, the workout is not completed or skipped, and no in-progress session exists. For an ended plan, open workouts dated on or after `endedOn` are "not done" rather than missed (FR-4.15).
- **Top sets:** `loadType = top_set` requires `loadPercent`, a target RPE, `repsMax ≤ 5` and `isAmrap = false`, and is only allowed for skills eligible under FR-1.9. `SetLog.isTopSet` is copied from the prescription when the session starts.
- **Skill locks:** a skill's `trackingType` and `loadConvention` can't change once it has logged sets (FR-1.10).
- **Deleting a plan** does not delete its sessions. Their `plannedWorkoutId` is nulled so history and PRs are kept.
- **Templates** are never mutated by plan edits.

---

## 5. Screens (full scope; see §11 for release timing)

1. **Today** (home tab)
2. **Week** (tab): calendar weeks (FR-8.1), including the plan overview grid
3. **Workout Session** (logging flow, full-screen, with inline RPE picker; also used for Test Day)
4. **Session Summary**
5. **Plans** (tab): active plan, my plans, templates
6. **Template Detail / Preview**
7. **Plan Builder**, in this order:
   - plan settings (start date, TM %)
   - phases (name, length, cycle length, suggested increase), with deloads and continuations shown inside their phase
   - each phase's workouts (FR-2.15) and its cycle-week schedule, with weekday pins
   - workout editor
   - Skill Library picker
   - set prescription (load type, reps, target RPE)
   - weekly volume panel (FR-2.13)
   - 1RMs, TM % and suggested-increase rules
7a. **Plan Detail**, showing the 1RM/TM and load table, schedule history, and the shift/move/re-pin/change-length actions
7b. **Cycle Review**: a congratulations message, completion stats, suggested 1RM/TM increases, and the confirm/edit/keep actions
7c. **Final Review and Program Summary**, showing adherence, PRs and 1RM changes across the program
8. **Progress** (tab): PR board, exercise detail with chart
9. **History**, with session detail
10. **Skill Library**, with custom skill editor
11. **Settings**, including tips on/off, the per-unit increments, export/import, and About → Disclaimer
12. **Onboarding**: disclaimer on first launch only (FR-5), then units, then "pick a template" or "build a plan", then start date, training days and 1RMs

Suggested bottom tabs: **Today · Week · Plans · Progress · More** (More holds History, Library and Settings).

---

## 6. Non-Functional Requirements

- **NFR-1 Platforms:** a single **React Native** codebase in **TypeScript**, built with **Expo** (managed workflow, with development builds), targeting iOS and Android.
  - **Why Expo:** it is the framework the React Native docs recommend. It also gives one-command builds and maintained modules for everything this app needs:
    - local SQLite storage
    - notifications
    - keep-awake
    - file sharing and export
  - **Zero-cost builds (§1.3):** use EAS Build's free tier, or run builds locally.
  - **Native code:** if a native module is ever needed, use Expo config plugins or a development build rather than ejecting.
- **NFR-2 Offline-first:** every feature works with no network. Data is stored in a local on-device database, SQLite or equivalent.
- **NFR-3 No account required** in v1, which is also required by the zero-cost constraint (§1.3). The architecture should isolate the data layer (a repository or service pattern) so cloud sync and auth can be added later without rewriting screens.
- **NFR-4 Data safety:**
  - Local data persists across app updates, and schema changes use versioned migrations.
  - The v1 backup path is **JSON export and import**, with no server involved.
  - **Export** includes `schemaVersion`, `seedVersion` and `appVersion`.
  - **Import rules:**
    - validates the file against the schema
    - migrates files from older schema versions
    - rejects files from a newer schema or seed version with a clear message
    - restores rows that reference each other (e.g. sessions and planned workouts) without integrity errors
    - replaces all local data only after the user confirms
    - automatically creates a backup export of the current data first
  - Export uses the OS share sheet, so the user can save the file to iCloud Drive, Google Drive, Files or email.
  - **Storage model:** all data lives in a local SQLite database. **No login or account is needed** to store plans, sessions, completions or PRs.
  - **OS backups:** the database must be included in the phone's own backups.
    - iOS: stored in the app's Documents/Application Support folder, not excluded from iCloud backup.
    - Android: Auto Backup is enabled, with the database included in the backup rules, keeping within the platform's size limit.
  - **Recovery layers:**
    1. OS device backup (v1.0)
    2. manual export (v1.0)
    3. automatic backup to the user's own cloud (FR-12.9, v1.1)
    4. optional login with sync (future, see §8)
- **NFR-5 Performance:**
  - cold start to a usable Today screen in under 2 seconds on a mid-range device
  - logging a set responds in under 100 ms
  - history and PR queries stay fast with 2+ years of data (roughly 500 sessions and 20k sets)
- **NFR-6 Usability:**
  - tap targets of at least 44 pt
  - core logging is usable one-handed
  - the screen can stay awake during an active session (setting)
- **NFR-7 Accessibility:** supports dynamic type and screen readers, with sufficient colour contrast in light and dark themes.
- **NFR-8 Reliability:** in-progress sessions are persisted on every set change (FR-9.10).
- **NFR-9 Testing:** unit tests are required for the following, for every feature in the release being built:
  - date resolution (FR-4.3), including continuation parts
  - shift, move and re-pin logic, with validation in both directions, the same-day warning on single moves, and undo
  - pause/resume
  - missed-status derivation
  - TM from 1RM
  - load calculation and rounding, including top-set pre-fills and the deload load factor on every loaded set type
  - RIR-adjusted e1RM and qualifying-set filtering (top sets and AMRAP only; back-off sets excluded), including missing RPE for PRs
  - double progression (increase, hold, working load after an edited session, rep pre-fill, pause/resume, hint)
  - deload generation (volume and load factors, RPE cap, top sets converted), including inserting a deload inside a phase
  - taper volume factor, rest-day limit, and Test Day → Final Review
  - review modes (every cycle, end of phase, none), including no Cycle Review when a cycle ends the program
  - weekly volume (fractional counting) and session volume multipliers
  - "Deload now" insertion (shift, both split positions, cycle continuation, undo)
  - recalculation of 1RM effective weeks after any week renumbering
  - setup 1RM estimate validation
  - skill field locks after logging
  - shared workout definitions (progression shared across appearances, duplicating a workout)
  - review freshness (recalculation, withdrawal when a cycle reopens, Final Review withdrawal)
  - Final Review sources (Test Day, the final cycle's own rule, no suggestion)
  - ending a plan early (pending reviews, status of remaining workouts)
  - backup round-trip with cross-referencing rows, and seed-version rejection
  - Cycle Review:
    - suggestion maths (percentage, fixed, none)
    - accept, edit, keep and lower paths
    - pending reviews, completion order and late completion
    - the cycle lock
    - carry-over across phases and into the next plan
  - phase and cycle generation (including partial cycles, multi-phase plans, continuations and phase length changes)
  - PR detection and recalculation
  - unit conversion
- **NFR-10 Code quality:** TypeScript strict mode, linting and formatting enforced, and no business logic inside UI components. Training maths (loads, e1RM, scheduling, reviews) lives in a pure, framework-free module with full unit-test coverage.
- **NFR-11 Privacy:** no network calls are needed for any feature. The only exception is the optional FR-12.9 backup, which talks solely to the user's own cloud provider. Any crash reporting must be opt-in and use a free tier.
- **NFR-12 Dates:** all scheduling uses local calendar dates (see Data Model rules). Tests must cover month and year boundaries, leap years and daylight-saving transitions.
- **NFR-13 Open source:** the repository is public on GitHub under the **MIT licence**. It includes:
  - a README with screenshots, a "why I built this" section and setup instructions
  - this document at `docs/REQUIREMENTS.md`, and the design at `docs/DESIGN.md`
  - a CHANGELOG
  - `THIRD_PARTY_NOTICES.md` listing dependency and font licences (§1.3)
  - a privacy policy page, hosted for free (e.g. GitHub Pages). Both stores require one even when no data is collected.
- **NFR-14 CI:** GitHub Actions runs type-checking, linting and unit tests on every push and pull request. The main branch must stay green.
- **NFR-15 Release process:**
  - Beta builds go to friends and family through **TestFlight** and a **Google Play closed test** before each public release.
  - **Google Play:** new personal developer accounts must run a closed test before production access. At the time of writing, this means at least 12 opted-in testers for 14 days. Check the current policy and recruit testers early.
  - Versions follow semantic versioning and match §11.

---

## 7. Acceptance Criteria (key flows)

- **AC-1 Start from a template**
  - **Given** no active plan
  - **When** the user starts the Beginner Strength template (13 weeks), enters a start date and 1RMs, and pins Mon/Wed/Fri
  - **Then** 13 weeks of workouts (including the week-7 deload) are generated on the correct dates, and the progress meter reads "Week 1 of 13, 0%"
- **AC-2 Cycle repetition**
  - **Given** a new plan with a 12-week program length and a 2-week cycle
  - **When** the user builds cycle weeks 1–2 and saves
  - **Then** plan weeks 3, 5, 7, 9 and 11 match week 1, and weeks 4, 6, 8, 10 and 12 match week 2 (apart from calculated loads)
- **AC-3 Log a session**
  - **Given** today's workout
  - **When** the user taps "Start", marks every set "done as planned" and taps "Finish"
  - **Then** the session is saved with prescribed and actual loads, the workout shows `completed`, and the progress meter increases
- **AC-4 PR detection**
  - **Given** a previous best bench press of 80 kg × 5
  - **When** the user logs 82.5 kg × 5
  - **Then** a "Heaviest weight" PR and an "Est. 1RM" PR are shown in the summary and on the PR board
- **AC-5 PR recalculation**
  - **Given** a PR-setting session
  - **When** the user deletes it
  - **Then** the PR reverts to the previous best
- **AC-6 Missed workout**
  - **Given** yesterday's workout was not done
  - **When** the user opens the app
  - **Then** it appears as missed with three options: do now and push the rest back, move this one only, or skip
- **AC-7 Session recovery**
  - **Given** an in-progress session
  - **When** the app is force-closed and reopened
  - **Then** the session resumes with all logged sets intact
- **AC-8 Unit switch**
  - **Given** the unit is switched from kg to lb, with a 5 lb barbell increment
  - **Then** stored values are unchanged, and prescribed loads are rounded in lb
  - **And** TM 100 kg × 80% = 176.4 lb is shown as 175 lb
- **AC-9 Offline**
  - With airplane mode on, every flow above still works.
- **AC-10 No automatic step-up**
  - **Given** a squat 1RM of 110 kg (TM 99 kg) and a set at 80%
  - **Then** every cycle prescribes 80 kg (79.2 rounded) until a higher 1RM is confirmed
- **AC-11 Push the rest back**
  - **Given** Mon/Wed/Fri training, with Monday of week 3 completed
  - **When** the user pushes the rest of the plan back 2 days from Wednesday
  - **Then** Wednesday's workout moves to Friday, Friday's moves to Sunday, and every later workout moves +2 days
  - **And** Monday is unchanged, the plan end date is 2 days later, and cycle, week and 1RM/TM values are unchanged
- **AC-12 Pull forward (validation)**
  - **Given** tomorrow's workout
  - **When** the user tries to pull the rest of the plan forward 2 days
  - **Then** the change is rejected with an explanation (FR-4.6)
- **AC-13 Re-pin training days**
  - **Given** Mon/Wed/Fri training
  - **When** the user re-pins to Tue/Thu/Sat from week 6
  - **Then** weeks 6–12 use Tue/Thu/Sat, and weeks 1–5 are unchanged
- **AC-14 Cycle Review: increase**
  - **Given** a squat 1RM of 110 kg (TM 99 kg), a +5 kg suggestion rule, a 2.5 kg increment, a set at 80%, and cycle 2 just finished with 6/6 sessions
  - **Then** the review opens with "Well done — Cycle 2 complete!" and suggests a 1RM of 115 kg (TM 103.5 kg)
  - **When** the user taps "Increase all"
  - **Then** cycle 3's 80% set prescribes 82.5 kg, up from 80 kg (103.5 × 0.8 = 82.8, rounded)
  - **And** a history row is written, effective from cycle 3's first week
- **AC-14b Cycle Review: keep current**
  - **Given** the same review, after a cycle with only 2/6 sessions completed
  - **When** the user taps "Keep all current"
  - **Then** no history row is written, and cycle 3 uses the same loads as cycle 2
- **AC-14c Cycle Review: edit**
  - **When** the user edits the squat value to 117.5 kg
  - **Then** the TM shows 105.75 kg and applies from the next cycle
- **AC-15 Undo**
  - **Given** a schedule shift was just applied
  - **When** the user taps undo
  - **Then** all affected dates return to their previous values
- **AC-16 Pending review**
  - **Given** a Cycle Review was dismissed
  - **Then** the Today screen shows a banner, and cycle 3 sessions use the current values
  - **When** the review is completed after 2 cycle-3 sessions have been logged
  - **Then** only the remaining unlogged sessions use the new TM
- **AC-17 Cycle lock**
  - **Given** a cycle with one logged session
  - **When** the user opens the 1RM/TM editor
  - **Then** the values are read-only, with a note that they can be updated at the end of this cycle
- **AC-18 Partial cycle and extension**
  - **Given** a single-phase plan with a 2-week cycle
  - **When** the phase length is set to 13 weeks
  - **Then** week 13 is cycle 7, week A
  - **When** the plan is later extended to 16 weeks
  - **Then** weeks 14–16 continue the pattern (cycle 7 week B, cycle 8 weeks A and B)
  - **And** cycle 7 ends with a Cycle Review, and cycle 8, which ends the program, ends with the Final Review instead (FR-3.8)
- **AC-19 Pull forward can't stack**
  - **Given** Mon/Wed/Fri training, today is Monday, and Monday's workout is not yet done
  - **When** the user pulls the rest of the plan forward 2 days from Wednesday
  - **Then** the change is rejected, because Wednesday's workout would land on Monday alongside Monday's workout
- **AC-20 Lower a 1RM between programs**
  - **Given** no active plan and a bench 1RM of 100 kg
  - **When** the user sets it to 90 kg with the note "shoulder injury" and confirms
  - **Then** the next plan pre-fills a 1RM of 90 kg and a TM of 81 kg
- **AC-21 Multi-phase plan**
  - **Given** the periodised template
  - **Then**:
    - week 7 shows "Deload"
    - week 8 shows "Strength · Cycle 1"
    - weeks 14–16 (Peak) trigger no Cycle Reviews
    - week 17 shows "Taper", with a Final Review at the end
  - **And** a 1RM confirmed at the end of the last Hypertrophy cycle is used in the Deload and in Strength cycle 1
  - **And** week 9 (Strength cycle 1, week B) starts each main lift with a top set, followed by back-off sets
- **AC-22 Extending a phase**
  - **Given** the periodised template
  - **When** the Hypertrophy phase is extended from 6 to 8 weeks
  - **Then** the program becomes 19 weeks, the Deload moves to week 9, and Strength starts in week 10
- **AC-23 No automatic 1RM changes**
  - **Given** an active plan
  - **When** the user logs a set with an estimated 1RM above their current 1RM
  - **Then** a PR is recorded, but the 1RM and TM are unchanged until confirmed in a Cycle Review
- **AC-24 Program Summary**
  - **Given** the Final Review is completed
  - **Then** the Program Summary shows 1RM changes per skill, and the next plan pre-fills the latest confirmed 1RMs
- **AC-25 Estimated suggestion**
  - **Given** a Strength cycle where the user logged a bench **top set** of 100 kg × 3 @ RPE 8, a current 1RM of 110 kg, and a 2.5 kg increment
  - **Then** the e1RM is 100 × (1 + 5/30) = 116.7, rounded to 117.5
  - **And** the review suggests 117.5 kg, labelled "from 100 kg × 3 @ RPE 8"
- **AC-26 Estimate below current**
  - **Given** a best qualifying (top set) e1RM of 105 kg, a current 1RM of 110 kg, and a +2.5% fallback rule
  - **Then** the review shows "no increase suggested", with 105 kg as reference, and the fallback is not used
- **AC-27 No qualifying sets**
  - **Given** a Hypertrophy cycle with only 8–12 rep sets and no top sets
  - **Then** the suggestion uses the +2.5% fallback and is labelled as such
- **AC-28 Double progression increase**
  - **Given** a curl at 3 × 8–12 @ 15 kg with a 1 kg increment
  - **When** all three sets are logged at 12 reps, RPE ≤ target
  - **Then** the next session pre-fills 16 kg × 8 with a "↑ +1 kg" badge, and one tap reverts it
- **AC-29 Double progression hold**
  - **Given** the same curl
  - **When** the sets are logged as 12, 11 and 10 reps
  - **Then** the next session keeps 15 kg, and pre-fills 12, 11 and 10 reps
- **AC-30 Deload generation**
  - **Given** a training phase whose week A has squat 4 × 8 @ 70% TM (TM 100 kg), RPE 8
  - **When** a deload is inserted after it
  - **Then** the deload week shows squat 2 × 8 @ 62.5 kg (70 × 0.9 = 63, rounded) with an RPE cap of 7
  - **And** no Cycle Review is triggered
- **AC-31 Per-set RPE**
  - **When** a main-lift set is marked done
  - **Then** the RPE picker appears pre-highlighted at the target, and the set completes only after an RPE is tapped
  - **When** an accessory set is marked done
  - **Then** the picker can be dismissed, leaving the RPE empty
- **AC-32 Taper and Test Day**
  - **Given** a taper with a volume factor of 50% and a Test Day
  - **Then** sets are halved (rounded up), loads are not reduced, the final days have no sessions, and the Test Day is scheduled last
  - **When** the user logs a 160 kg single @ RPE 10 on Test Day
  - **Then** the Final Review suggests a 160 kg squat 1RM, labelled "Test Day"
- **AC-33 Volume panel**
  - **Given** a week with bench 3 sets (chest primary; triceps secondary) and dips 3 sets (triceps primary)
  - **Then** the panel shows chest 3, triceps 4.5
- **AC-34 Deload now**
  - **Given** Strength cycle 2 in progress, with week A done and no sessions logged yet in week B, the current week
  - **When** the user taps "Deload now" (1 week, from today)
  - **Then** a deload week is inserted from today, and all later workouts move 7 days later
  - **And** after the deload, Strength resumes at cycle 2 week B, and cycle 2's review triggers when week B finishes
  - **When** the user taps undo
  - **Then** everything returns to how it was
- **AC-35 Estimate it for me**
  - **Given** a plan being started, with no bench 1RM
  - **When** the user chooses "Estimate it for me" and logs 90 kg × 4 @ RPE 8
  - **Then** the app shows 107.5 kg (90 × (1 + 6/30) = 108, rounded to the 2.5 kg increment) for the user to confirm
  - **When** the user logs 8 reps instead
  - **Then** the entry is rejected with guidance to use a heavier load
- **AC-36 Disclaimer**
  - **Given** a fresh install
  - **Then** the disclaimer shows before onboarding and requires "I understand"
  - **When** the app is relaunched, including after an update
  - **Then** the disclaimer does not appear, but it remains available in Settings → About
- **AC-37 Cardio completion**
  - **Given** a workout with a `completion_only` "Easy run"
  - **Then** it shows only a done checkbox, and the session counts as complete when it is ticked
- **AC-38 Warm-ups and failed sets**
  - **Given** a squat session with warm-ups at 60 and 80 kg, a failed single at 150 kg, and working sets at 120 kg × 5
  - **Then** no RPE is asked for the warm-ups
  - **And** PRs, e1RM and volume use only the 120 kg sets, while the failed single is visible in history
- **AC-39 Per-side dumbbells**
  - **Given** a dumbbell press (`per_side`) logged at 30 kg × 10
  - **Then** it displays "30 kg × 2", and the session's total volume counts 600 kg
- **AC-40 Weighted pull-up**
  - **Given** a `bodyweight_plus_load` skill
  - **When** the user logs +20 kg × 5
  - **Then** a "heaviest added load" PR is recorded, and no e1RM is computed
- **AC-41 Import safety**
  - **When** the user imports a file with a newer `schemaVersion`
  - **Then** it is rejected with a message
  - **When** the user imports a valid older file
  - **Then** a backup of the current data is exported first, then the file is migrated and loaded after confirmation
- **AC-42 Time zones**
  - **Given** a workout scheduled for Wednesday
  - **When** the device time zone changes, or daylight saving begins
  - **Then** the workout still shows on Wednesday
- **AC-43 Term explanations**
  - **When** the user taps ⓘ next to "TM" on the plan setup screen
  - **Then** a plain-language explanation appears
  - **And** the first RPE picker shows a one-time tip
- **AC-44 No-login persistence**
  - **Given** a fresh install with no account
  - **When** the user completes a session, force-closes the app and reopens it
  - **Then** the session, its completion status and any PRs are all present
- **AC-45 Backup reminder**
  - **Given** an active plan and no export for 30 days
  - **Then** the Today screen shows one dismissible backup reminder
  - **And** it does not show again for 30 days after being dismissed
- **AC-46 Automatic cloud backup and restore**
  - **Given** automatic backup is on
  - **When** a session is finished
  - **Then** a new backup file appears in the user's cloud app folder, and only the latest 10 are kept
  - **When** the app is installed on a new phone signed into the same cloud account
  - **Then** the app offers to restore before onboarding, and all plans and history return after confirmation
- **AC-47 Push back can't stack**
  - **Given** Mon/Wed/Fri training, with this Friday's workout already skipped
  - **When** the user pushes the rest of the plan back 2 days from Wednesday
  - **Then** the change is rejected, because Wednesday's workout would land on Friday alongside the skipped workout (FR-4.6)
- **AC-48 Move one onto a busy day**
  - **Given** Mon/Wed/Fri training
  - **When** the user moves only Wednesday's workout to Friday
  - **Then** the app warns "You'll have 2 workouts on Fri", and after confirming, Friday shows both workouts in the week view
  - **When** the user tries to move a workout to yesterday
  - **Then** the move is rejected
- **AC-49 Final Review replaces the last Cycle Review**
  - **Given** the Beginner Strength template, whose last cycle (cycle 6) ends in week 13
  - **When** the last session of week 13 is resolved
  - **Then** only the Final Review is created, with no Cycle Review for cycle 6
- **AC-50 Review order**
  - **Given** the cycle 2 review is pending and cycle 3 has just finished
  - **Then** the Today banner opens the cycle 2 review
  - **When** the cycle 2 review is completed with squat 1RM 115 kg
  - **Then** the cycle 3 review shows 115 kg as the current squat 1RM
- **AC-51 Week view uses calendar weeks**
  - **Given** a Monday week start and a plan that starts on a Wednesday
  - **Then** the week view shows Monday to Sunday, with plan workouts on their scheduled dates, and the header reads "Plan weeks 1–2" for the second calendar week
  - **When** a new plan is started with no date chosen
  - **Then** the start date defaults to the next Monday (or today, if today is a Monday)
- **AC-52 Deload now after training this week**
  - **Given** Mon/Wed/Fri training, with Monday of the current plan week completed
  - **When** the user taps "Deload now" on Tuesday (1 week)
  - **Then** the dialog explains that Wednesday's and Friday's workouts will be pushed back after the deload
  - **And** after confirming, those two workouts keep their week number and move 7 days later, and the deload is inserted after the current plan week
- **AC-53 Deload load for double progression**
  - **Given** a curl with a working load of 16 kg and a 1 kg increment
  - **When** a deload week with a 90% load factor is generated
  - **Then** the curl pre-fills 14 kg (16 × 0.9 = 14.4, rounded), and the curl's double-progression state is unchanged afterwards
- **AC-54 e1RM PR without RPE**
  - **Given** an accessory `weight_reps` skill with no previous PRs
  - **When** the user logs 80 kg × 10 with no RPE
  - **Then** an "Est. 1RM" PR of 106.7 kg is recorded (80 × (1 + 10/30))
  - **And** the set does not qualify for a 1RM suggestion
- **AC-55 Unilateral volume**
  - **Given** a unilateral split squat (`total` convention) logged at 20 kg × 8
  - **Then** it displays "8 each side", and the session's total volume counts 320 kg
- **AC-56 Double progression after an edited session**
  - **Given** a curl at 3 × 8–12 @ 15 kg with a 1 kg increment
  - **When** the sets are logged as 10 reps @ 15 kg, 9 reps @ 16 kg and 9 reps @ 16 kg
  - **Then** the next session pre-fills 16 kg with reps 10, 9 and 9, and no increase badge
- **AC-57 Template continuation numbering**
  - **Given** the Beginner Strength template
  - **Then** week 8 shows "Cycle 4 · Week 8 of 13", and the builder shows one training phase with a deload inside it
- **AC-58 1RM effective week survives renumbering**
  - **Given** Strength cycle 1 (weeks 1–2) whose review confirmed a squat 1RM of 115 kg
  - **When** the user inserts a 1-week "Deload now" at week 3
  - **Then** the deload and Strength cycle 2 (now weeks 4–5) both use 115 kg
  - **When** the user taps undo
  - **Then** cycle 2 is weeks 3–4 again and still uses 115 kg
- **AC-59 Taper rest-day limit**
  - **Given** a 1-week taper phase
  - **When** the user sets 6 rest days
  - **Then** the builder rejects it and shows that the maximum is 5
- **AC-60 Skill locks after logging**
  - **Given** a custom skill with at least one logged set
  - **When** the user opens its editor
  - **Then** tracking type and load convention are locked with an explanation, other fields can be edited, and past sessions display unchanged

- **AC-61 Back-off sets don't qualify**
  - **Given** a Strength cycle with the estimated rule, a squat 1RM of 140 kg (TM 126 kg), a +2.5% fallback, and a 2.5 kg increment
  - **When** the only squat sets logged are back-off sets of 100 kg × 5 @ RPE 8 (e1RM 123.3 kg), and the top set was skipped
  - **Then** no set qualifies, and the review suggests 142.5 kg labelled "+2.5% rule (no top sets this cycle)", rather than "no increase suggested"
- **AC-62 Top set in a session**
  - **Given** a bench top set of 1 × 1–3 @ RPE 8 with a starting load of 97.5% TM, and a TM of 99 kg
  - **Then** the set is labelled "Top set", pre-filled at 97.5 kg (96.5, rounded), and completes only after an RPE is chosen
  - **When** the user changes the load to 100 kg and logs 3 reps @ RPE 8
  - **Then** the back-off sets keep their calculated loads, and the set counts as qualifying (AC-25)
- **AC-63 Top sets in deloads**
  - **Given** a training week with a squat top set (starting load 97.5% TM, TM 100 kg, RPE 8)
  - **When** a deload is generated from that week
  - **Then** the set becomes a normal set at 87.5 kg (97.5 × 0.9 = 87.75, rounded) with an RPE cap of 7, and is not labelled as a top set
- **AC-64 Shared workout progression**
  - **Given** Beginner Hypertrophy, with a curl in Full body A at 3 × 10–15 @ 15 kg, a 1 kg increment, and Full body A on Monday and Friday of week 1
  - **When** all three curl sets on Monday reach 15 reps
  - **Then** Friday's Full body A pre-fills 16 kg × 10 with a "↑ +1 kg" badge
  - **When** the user edits Full body A's exercises
  - **Then** every open appearance of Full body A changes
- **AC-65 Workout done a day late**
  - **Given** Mon/Wed/Fri training with every-cycle reviews, and cycle 2's last workout (Friday) not done
  - **When** the app opens on Saturday
  - **Then** Friday shows as missed, and the cycle 2 review is pending with 5/6 sessions
  - **When** the user chooses "Do now and push the rest back" and finishes the session
  - **Then** the cycle 2 review shows 6/6 sessions, and its suggestions include Saturday's sets
- **AC-66 Final Review with a fixed rule**
  - **Given** Beginner Strength with a squat 1RM of 120 kg, a bench 1RM of 80 kg, the +5 kg / +2.5 kg rules, and no top sets or AMRAP sets
  - **When** the last session of week 13 is finished
  - **Then** the Final Review suggests squat 125 kg and bench 82.5 kg, labelled with their rules
  - **And** the best estimated 1RM is shown as "—"
- **AC-67 Final Review without Test Day**
  - **Given** the periodised template with no Test Day, and a squat single of 150 kg @ RPE 9 logged in week 16
  - **When** the taper ends
  - **Then** the Final Review shows "no increase suggested" for squat, with 150 kg as the heaviest single for reference, and the user can enter a value
- **AC-68 Ending a plan early**
  - **Given** an active plan in week 5, with the cycle 2 review pending
  - **When** the user taps "End plan"
  - **Then** the confirmation offers "Review now" and "End without reviewing"
  - **When** the user chooses "End without reviewing"
  - **Then** the review is discarded, no Final Review is created, and the plan is `abandoned`
  - **And** its remaining workouts show "Not done (plan ended)" and don't lower adherence, and the Program Summary covers sessions up to today
- **AC-69 Backup round-trip**
  - **Given** a plan with completed sessions, a completed Cycle Review and a double-progression increase
  - **When** the user exports the data and imports the file into a fresh install
  - **Then** every plan, session, review, 1RM and PR is restored, and the database passes an integrity check
  - **When** the user imports a file whose `seedVersion` is newer than the app's
  - **Then** it is rejected with a message
- **AC-70 Deload follows training days**
  - **Given** the Beginner Strength template, whose week-7 deload was generated on Mon/Wed/Fri
  - **When** the user starts it on Monday 14 Sep 2026 and pins Tue/Thu/Sat
  - **Then** the week-7 deload workouts fall on Tue 27, Thu 29 and Sat 31 Oct 2026, with no separate deload rows to pin

---

## 8. Future Considerations (beyond v1.2; don't build, but don't block)

- **Optional login and multi-device sync (v2 candidate):**
  - Sign in with Apple or Google, and only if users ask for multi-device use.
  - It must stay **optional**; the app remains fully usable without an account.
  - It requires, before building:
    - a cost review, preferring user-owned storage or a free-tier backend
    - in-app account deletion (an App Store requirement)
    - updated privacy labels and a privacy policy
    - security review
  - The repository-pattern data layer (NFR-3) exists so this can be added without rewriting screens.
- Apple Health / Google Fit integration
- Home-screen widgets for today's workout
- Watch app for set logging
- Plate calculator and warm-up set generator
- In-session load adjustment based on RPE (e.g. "the top set felt easy, add 2.5 kg to the back-off sets")
- Velocity-based 1RM estimation using a bar-speed sensor
- Sharing plans with others

---

## 9. Open Questions

1. **Template exercises** *(deferred)*: which exact exercises go in each built-in template? This must be resolved before the templates are seeded, but it doesn't block design or build.
2. **Cloud backup libraries** *(v1.1 spike)*: which library provides iCloud Drive and Google Drive app-data access in Expo under a permitted licence, and what verification does Google require for the Drive app-data scope? This must be resolved before FR-12.9 work starts, but it doesn't block v1.0.

---

## 10. Glossary

- **Skill:** an exercise in the Skill Library.
- **Plan:** the user's own multi-week program, either active or historical.
- **Template:** a reusable blueprint a plan is created from.
- **Phase:** a block of a plan with its own purpose, cycle and suggested-increase rules (e.g. hypertrophy, strength, peak, taper). Phases run in order.
- **Continuation:** the part of a training phase that follows a deload inserted inside it. It shares the original phase's blueprint and carries on its cycle numbering.
- **Cycle group:** a phase together with its continuations. Cycle numbers and Cycle Reviews belong to the cycle group.
- **Cycle:** a block of 1–8 weeks that repeats until its phase's length is filled.
- **Cycle week:** a week's position within a cycle (e.g. Week A or Week B of a 2-week cycle).
- **Plan week:** a week's absolute position in the plan (1 to total weeks).
- **Calendar week:** the 7 days starting on the week-start day, as shown in the week view.
- **Program length:** total weeks in a plan; the sum of its phase lengths.
- **1RM:** one-rep max, set by the user for each skill.
- **TM %:** the percentage of 1RM used to set the training max (default 90%).
- **Training max (TM):** `1RM × TM %`, the reference weight that %-based loads are calculated from. It is fixed within a cycle and changes only when the user confirms a new 1RM.
- **Suggested-increase rule:** the 1RM increase proposed at each Cycle Review: estimated from top sets, a percentage, a fixed amount, or none.
- **Cycle Review:** the end-of-cycle screen where the user confirms, edits or declines 1RM/TM increases.
- **Final Review:** the end-of-program review, which replaces the last cycle's Cycle Review.
- **Workout:** a named list of exercises and prescriptions, defined once per phase (FR-2.15).
- **Slot:** one appearance of a workout on a pinned weekday within a cycle week.
- **Planned workout:** a generated, dated instance of a workout slot.
- **Not done (plan ended):** the status of open workouts dated on or after the day a plan was ended early (FR-4.15).
- **Schedule shift:** moving a workout and all later workouts by the same number of days.
- **Deload:** a short (usually 1-week) phase of reduced volume and load, used to manage fatigue.
- **Taper:** the final phase before testing, with volume cut and intensity kept high.
- **Test Day:** a workout where the user works up to heavy singles to establish a new 1RM.
- **RPE / RIR:** rating of perceived exertion (6–10) and reps in reserve (`RIR = 10 − RPE`).
- **Double progression:** progressing within a rep range first, then adding load once every set reaches the top of the range.
- **Working load:** the load a double-progression skill uses next session; the most common load from the last session, plus an increment after an increase.
- **Top set:** a heavy set of 1–5 reps prescribed by target RPE, where the lifter picks the load on the day. Top sets (and AMRAP sets) are the only sets used to estimate a new 1RM.
- **Back-off set:** a lighter %-of-TM working set done after a top set.
- **Qualifying set:** a completed 1–5 rep top set with RPE ≥ 7, or a 1–5 rep AMRAP set, used for 1RM suggestions.
- **Completion-only item:** a cardio or conditioning entry that is only marked done or not done.
- **Session:** an actual logged workout.
- **Set log:** one performed set within a session.
- **Volume:** reps × load, counted twice for per-side or unilateral skills.
- **PR:** personal record.
- **e1RM:** estimated one-rep max.
- **AMRAP:** as many reps as possible.
- **Adherence:** completed ÷ (completed + missed).

---

## 11. Release Plan

Each release is shippable on its own. Build only what is tagged for the current release, but implement the data model (§4) for the full scope from v1.0 so later releases need no rewrites.

### v1.0 — Core Loop (MVP)
**Goal:** replace the Notion setup and give friends and family a usable, free app.

- **Onboarding and help:**
  - FR-5: disclaimer
  - FR-6: in-app explanations
  - FR-12: settings, including export/import and backup reminders (FR-12.1–12.8; automatic cloud backup FR-12.9 is v1.1)
- **Skills:** FR-1 in full (seeded library, custom skills, tracking types, load conventions, volume multipliers, per-unit increments, locks after logging)
- **Plans:**
  - FR-2.3–2.7, FR-2.9, FR-2.12 and FR-2.15, for **a single training phase plus deloads**. A deload inside the phase creates a continuation (FR-2.11), which is supported in v1.0.
  - Deloads can only be inserted while the plan is a draft (FR-2.12).
  - The full multi-phase builder comes in v1.1.
- **Templates:** Beginner Strength and Beginner Hypertrophy (each a training phase with a deload and a continuation)
- **Scheduling:**
  - FR-4.1–4.7 (except FR-4.6a), FR-4.9 and FR-4.11–4.15
  - This includes shift and pull with validation in both directions, single moves with the same-day warning, and undo. "Deload now" (FR-4.6a) is not included.
  - In v1.0, starting a new plan ends the current one.
- **Screens:** FR-7 (Today) and FR-8 (Week and Progress)
- **Logging:** FR-9 in full, including required RPE on main lifts and top sets, warm-ups and failed sets
- **Top sets:** the top-set prescription (FR-2.4), in the builder and in sessions, so the estimated rule works in v1.0 plans built from scratch
- **PRs:** FR-10.1–10.3, FR-10.5 and FR-10.7
- **History:** FR-11.1 and FR-11.3
- **1RM, TM and progression:**
  - FR-3.1–3.8 (review modes `every_cycle` and `none`, review order, Final Review replacing the last Cycle Review)
  - FR-3.9 (Final Review without Test Day)
  - FR-3.10–3.12 and FR-3.14–3.15
- **Engineering:** all NFRs
- **Acceptance tests:** AC-1 to AC-12, AC-14 to AC-17, AC-19, AC-20, AC-23 to AC-31, AC-35 to AC-45, AC-47 to AC-51, AC-53 to AC-57, AC-60 to AC-66, AC-68 to AC-70

### v1.1 — Periodisation
**Goal:** support real blocks and peaking.

- **Plan builder:** the full multi-phase builder (FR-2.11), review mode `end_of_phase`, phase length changes (FR-2.10), and personal templates (FR-2.8)
- **Taper:** taper phases and Test Day (FR-2.14), with Test Day feeding the Final Review (FR-3.9)
- **Templates:** the periodised Hypertrophy → Strength → Peak → Taper template
- **Scheduling:** "Deload now" (FR-4.6a), inserting a deload into an active plan (FR-2.12), re-pinning training days (FR-4.8), and pause/resume (FR-4.10)
- **History:** ended-plan stats (FR-11.4)
- **Data safety:** automatic backup to the user's own iCloud or Google Drive, with restore on a new install (FR-12.9), after Open Question 2 is resolved
- **Acceptance tests:** AC-13, AC-18, AC-21, AC-22, AC-32, AC-34, AC-46, AC-52, AC-58, AC-59, AC-67

### v1.2 — Insight & Polish
**Goal:** help users understand their training.

- **Plan builder:** the weekly volume panel (FR-2.13), and the "consider a deload" hint from FR-2.12
- **Plan screen:** the 1RM/TM load table (FR-3.13)
- **Progress:** exercise charts (FR-10.4) and manual PR entry (FR-10.6)
- **History:** filters (FR-11.2)
- **Acceptance tests:** AC-33

### Later
See §8 Future Considerations.

---

## 12. Revision History

| Version | Date | Changes |
|---|---|---|
| 1.0 | 16 Sep 2026 | Final for design. |
| 1.1 | 17 Sep 2026 | Design review fixes (design decisions D-1 to D-18 in `docs/DESIGN.md`): |
| | | • Continuation phases and cycle groups; beginner templates' Block 2 is a continuation, so v1.0 needs no multi-phase builder (FR-2.1, FR-2.11, FR-2.12, FR-4.3, §4, §11) |
| | | • 1RM effective week is derived and recalculated when weeks are renumbered (FR-4.9, §4) |
| | | • Same-day validation for shifts in both directions (FR-4.6); single moves may share a day after a warning (FR-4.7) |
| | | • Final Review replaces the last cycle's Cycle Review; pending reviews are completed in order (FR-3.8, FR-3.9) |
| | | • Week view shows calendar weeks; plan start date defaults to the next week-start day (FR-2.3, FR-8.1, FR-12.3) |
| | | • "Deload now" split position when the current week already has a logged session (FR-4.6a) |
| | | • Deload load factor applies to every loaded set type (FR-2.12, FR-3.15, §4) |
| | | • e1RM PRs use RIR 0 when RPE is missing (FR-10.1) |
| | | • Unilateral skills count volume × 2 (FR-1.8, FR-9.8) |
| | | • Double-progression working load and rep pre-fill rules (FR-3.15) |
| | | • Taper rest-day limit (FR-2.14) |
| | | • Skill snapshots and field locks after logging (FR-1.10, §4) |
| | | • Cloud backup library spike added as Open Question 2 (FR-12.9, §9) |
| | | • Fonts may use OFL-1.1; `THIRD_PARTY_NOTICES.md` required (§1.3, NFR-13) |
| | | • New acceptance criteria AC-47 to AC-60; AC-18, AC-29 and AC-34 clarified; NFR-9 test list extended |
| 1.2 | 17 Sep 2026 | Top sets for 1RM estimation (design question OQ-3). The estimated rule could almost never suggest an increase, because moderate sets logged at their target RPE estimated below the lifter's max. Following common coaching practice (a heavy top set, then back-off sets, with re-testing at the end of a block): |
| | | • New top-set prescription, prescribed by RPE with a starting % of TM (FR-2.4, SRS §4) |
| | | • Only top sets and AMRAP sets qualify for estimated suggestions; an estimate at or below current is a genuine "no increase" (FR-3.5) |
| | | • Periodised Strength phase adds a weekly top set in week B (FR-2.1) |
| | | • Top sets require RPE and have their own session display (FR-9.2a, FR-9.2b); deloads turn them into normal sets, tapers keep them (FR-2.12, FR-2.14) |
| | | • AC-21, AC-25, AC-26 and AC-27 clarified; new AC-61 to AC-63; glossary and release plan updated |
| 1.3 | 17 Sep 2026 | Build-readiness fixes (design decisions D-20 to D-26): |
| | | • Workouts are defined once per phase and placed on weekday slots; progression is shared across appearances (FR-2.4, FR-2.6, FR-2.15, FR-3.15, FR-4.2, §4, §5) |
| | | • Pending reviews are recalculated when their inputs change, and withdrawn if their cycle reopens (FR-3.8, §4) |
| | | • Final Review uses Test Day, else the final cycle's own rule, else no suggestion (FR-3.9, FR-2.14) |
| | | • In v1.0, deloads can only be inserted into draft plans (FR-2.12, §11) |
| | | • Program end clarified, and ending a plan early specified (FR-4.14, FR-4.15, §4) |
| | | • Import handles cross-referencing rows and rejects newer seed versions (NFR-4) |
| | | • The review reference estimate uses qualifying sets only (FR-3.5, FR-3.8, FR-2.1) |
| | | • Start date defaults to today when today is the week-start day (FR-2.3, AC-51) |
| | | • Privacy policy page and Google Play closed testing added (NFR-13, NFR-15) |
| | | • New acceptance criteria AC-64 to AC-69; NFR-9 test list, glossary and release plan updated |
| 1.4 | 19 Sep 2026 | Deload details found while building the schedule engine (design decision D-30): |
| | | • Deload slots stay linked to their source slot and follow its weekday pin at plan start (FR-2.12, FR-4.2, §4) |
| | | • The volume factor applies to working sets; warm-ups are kept unchanged (FR-2.12, §4) |
| | | • AMRAP sets become fixed-rep sets at their minimum reps in a deload (FR-2.12, §4) |
| | | • A deload must follow a training week and can't sit directly before another deload (FR-2.12) |
| | | • New acceptance criterion AC-70; release plan updated |
