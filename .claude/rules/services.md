---
paths:
  - "src/services/**"
---

# src/services rules (DESIGN §2.1, §8)

- **Shape of a service:** one exported use case per file (`startPlan`, `finishSession`, `shiftSchedule`, …). It follows the pattern **load → compute with `src/core` → write**, inside **one exclusive transaction** (C-15).
- **Time:** `today` and `now` come from parameters, or from `src/services/clock.ts` at the outermost call. Nothing else reads the clock.
- **Reconcile:** any service that changes plan state (sessions, skips, shifts, moves, undo, reviews, ending a plan) finishes by calling `reconcile(today)`. `reconcile` also runs `refreshReviews` (D-21) and must stay idempotent.
- **Validation:** check the rules listed in DESIGN §4.4 here. When one fails, return a typed error the UI can show in plain words (DESIGN §6.6).
- **Tests:** every service has in-memory SQLite tests named after the acceptance criteria it covers.
