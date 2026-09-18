// The migration runner (DESIGN §4.6, NFR-4): versioned, all-or-nothing, and safe to rerun.
import type { Db } from '@/data/db';
import { migrate, type MigrationBundle } from '@/data/migrate';
import bundle from '@/data/migrations/migrations';

import { openTestDb } from '../../test/db/betterSqlite3';

const tableNames = (db: Db) =>
  db.getAllAsync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  );

const schemaVersion = async (db: Db) =>
  (
    await db.getFirstAsync<{ value: string }>(
      "SELECT value FROM app_meta WHERE key = 'schema_version'",
    )
  )?.value;

describe('migrate (NFR-4)', () => {
  let db: Db;

  beforeEach(() => {
    db = openTestDb();
  });

  afterEach(async () => {
    await db.closeAsync();
  });

  it('migrates a fresh database and records schema_version as the migration count', async () => {
    await migrate(db, bundle);

    expect(await tableNames(db)).toHaveLength(23); // 22 §4.3 tables + __drizzle_migrations
    expect(await schemaVersion(db)).toBe(String(bundle.journal.entries.length));
    expect(await db.getAllAsync('SELECT hash FROM __drizzle_migrations ORDER BY id')).toEqual(
      bundle.journal.entries.map((e) => ({ hash: e.tag })),
    );
  });

  it('is a no-op when run again', async () => {
    await migrate(db, bundle);
    await migrate(db, bundle);

    expect(await db.getAllAsync('SELECT * FROM __drizzle_migrations')).toHaveLength(
      bundle.journal.entries.length,
    );
  });

  it('applies only the migrations that are newer than the last one applied', async () => {
    const first: MigrationBundle = {
      journal: { entries: bundle.journal.entries.slice(0, 1) },
      migrations: bundle.migrations,
    };
    await migrate(db, first);
    expect(await schemaVersion(db)).toBe('1');
    expect(
      await db.getFirstAsync("SELECT 1 FROM sqlite_master WHERE name = 'uq_plan_single_active'"),
    ).toBeNull();

    await migrate(db, bundle);
    expect(await schemaVersion(db)).toBe('2');
    expect(
      await db.getFirstAsync(
        "SELECT 1 AS found FROM sqlite_master WHERE name = 'uq_plan_single_active'",
      ),
    ).toEqual({ found: 1 });
  });

  it('rolls everything back when a migration fails, leaving no partial schema', async () => {
    const broken: MigrationBundle = {
      journal: {
        entries: [
          ...bundle.journal.entries,
          { idx: 99, when: Number.MAX_SAFE_INTEGER, tag: '0099_broken', breakpoints: true },
        ],
      },
      migrations: { ...bundle.migrations, m0099: 'CREATE TABLE nope (;' },
    };

    await expect(migrate(db, broken)).rejects.toThrow();
    expect(await tableNames(db)).toEqual([]);
  });

  it('refuses a bundle whose journal names a missing migration', async () => {
    const missing: MigrationBundle = { journal: bundle.journal, migrations: {} };
    await expect(migrate(db, missing)).rejects.toThrow('Missing migration: 0000_init');
  });

  it('fails at launch when foreign keys are off on the connection (device build-flag guard)', async () => {
    await db.execAsync('PRAGMA foreign_keys = OFF');
    await expect(migrate(db, bundle)).rejects.toThrow(/SQLITE_DEFAULT_FOREIGN_KEYS/);
    expect(await tableNames(db)).toEqual([]);
  });
});
