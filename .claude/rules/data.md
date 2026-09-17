---
paths:
  - "src/data/**"
  - "drizzle.config.ts"
---

# src/data rules (DESIGN §4, §5)

- **Schema:** `src/data/schema.ts` must match the DDL in DESIGN §4.3, including CHECK constraints, partial and unique indexes, and `ON DELETE` actions. A test compares the migrated `sqlite_master` against the expected shape.
- **Schema changes:**
  1. Edit `schema.ts`.
  2. Run `npx drizzle-kit generate`.
  3. Add a JSON backup migrator in `src/data/backup/migrations/` for the same version bump.
  4. Update DESIGN §4.3.

  Never edit an existing migration; the guard hook blocks it.
- **Repositories:** they return plain objects typed from `src/core/types.ts`. They contain no business rules; those belong in `src/core` or `src/services`.
- **Storage conventions:**
  - IDs are UUID v4 strings, except seeded rows, which use readable fixed IDs (`skill_back_squat`).
  - Weights are kg `REAL`s, percentages are fractions, and booleans are `0`/`1`.
- **Seed data:** it has its own `seed_version`. Placeholder template exercises carry `TODO(OQ-1)` until OQ-1 is resolved.
- **Import (D-25):** runs in one transaction with `PRAGMA defer_foreign_keys = ON`. It rejects a newer `schemaVersion` or `seedVersion`, and exports a backup first.
- **Database interface:** `src/data/db.ts` defines `Db`, the subset of the `expo-sqlite` async API this
  project uses. It is types only, so Node tests can import it. The device driver is
  `src/data/drivers/expoSqlite.ts`; the test driver is `test/db/betterSqlite3.ts` (`openTestDb()`),
  which lives under `test/` so a dev-only native module can never reach a release build.
- **Transactions:** use `withExclusiveTransactionAsync` (C-15), never `withTransactionAsync`.
