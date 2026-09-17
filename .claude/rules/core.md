---
paths:
  - "src/core/**"
---

# src/core rules (DESIGN §3)

- **Pure and synchronous.** Plain objects in, plain objects out, shaped like the §4 tables.
  - No I/O.
  - No clock: take `today: LocalDate` and `now: string` as arguments.
  - No random values or ID generation: take new IDs as arguments.
- **One module per concern**, as listed in DESIGN §2.2: `units`, `rounding`, `dates`, `loads`, `e1rm`, `schedule/*`, `reviews`, `doubleProgression`, `prs`, `volume`, `deload`, `taper`.
- **Follow the pseudocode** in the matching DESIGN §3 subsection. Cite it in a short comment, e.g. `// DESIGN §3.8, D-3`.
- **Rounding:** always use `roundLoadKg(kg, unit, increment)`. Never round kg values directly for display, and never use `toFixed` for maths.
- **Dates:** `LocalDate` strings only. Use `addDays`, `firstOnOrAfter` and `daysBetween` from `dates.ts`, which work on `Date.UTC` internally.
- **Rejections:** return typed results (e.g. `{ ok: false, reason: 'same_day' }`) rather than throwing for expected validation failures. Throw only for programmer errors.
- **Coverage:** 100% line and branch coverage is the target. Table-driven tests are preferred.
