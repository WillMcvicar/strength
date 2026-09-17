---
paths:
  - "**/*.test.ts"
  - "**/*.test.tsx"
  - "test/**"
---

# Test rules (DESIGN §9)

- **AC naming:** one test per acceptance criterion, named with its ID and title exactly as in the SRS, e.g. `describe('AC-50 Review order', ...)`. `npm run check:ac` finds tests by that prefix.
- **Worked numbers:** use the doc's figures verbatim (e.g. AC-25: 100 × (1 + 5/30) = 116.67 → 117.5). If a figure seems wrong, stop and flag it.
- **Fixtures:** build plans with `test/fixtures/plans.ts` (`aPlan().startingOn(...).withWorkouts(...).withSchedule(...)`).
- **Time:** always pass `today` and `now` explicitly. Never use fake timers to stand in for the clock argument.
- **Dates:** date logic must pass under `TZ=Pacific/Auckland`, `TZ=America/New_York` and `TZ=UTC`. CI runs all three.
- **Scope:** two Jest projects (`jest.config.js`). `core` runs `src/core`, `src/data`, `src/services` and `test/` in plain Node; `app` runs `app/`, `src/ui` and `src/features` under `jest-expo`. Put a test where its layer lives, or it won't be picked up.
- **Component tests** use React Native Testing Library and cover behaviour and accessibility labels, not snapshots. **`render` is async in RNTL v14** — `await render(<X />)` before querying, or `screen` stays empty and the failure message is misleading.
