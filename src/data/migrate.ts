// Runs drizzle-kit's bundled migrations over `Db` (DESIGN §4.6, NFR-4). Drizzle's own proxy
// migrator issues a bare `begin`, which would bypass C-15, so this small runner applies pending
// migrations inside one exclusive transaction instead: all of them, or none.
import type { Db } from './db';

export interface JournalEntry {
  idx: number;
  when: number;
  tag: string;
  breakpoints: boolean;
}

/** The shape of drizzle-kit's `migrations.js` (driver: 'expo'). */
export interface MigrationBundle {
  journal: { entries: JournalEntry[] };
  migrations: Record<string, string>;
}

/** Same table name and columns Drizzle uses; `hash` holds the migration's tag. */
const MIGRATIONS_TABLE = `CREATE TABLE IF NOT EXISTS __drizzle_migrations (
  id         INTEGER PRIMARY KEY,
  hash       TEXT NOT NULL,
  created_at NUMERIC
)`;

export async function migrate(db: Db, bundle: MigrationBundle): Promise<void> {
  const entries = [...bundle.journal.entries].sort((a, b) => a.idx - b.idx);

  await db.withExclusiveTransactionAsync(async (tx) => {
    // On device, every transaction runs on a fresh connection, so foreign keys depend on the
    // SQLITE_DEFAULT_FOREIGN_KEYS build flag (app.json). Fail at launch rather than silently.
    const fk = await tx.getFirstAsync<{ foreign_keys: number }>('PRAGMA foreign_keys');
    if (fk?.foreign_keys !== 1) {
      throw new Error(
        'Foreign keys are off on this connection. Build with SQLITE_DEFAULT_FOREIGN_KEYS=1 (app.json).',
      );
    }

    await tx.execAsync(MIGRATIONS_TABLE);
    // A database migrated by a newer build (a sideloaded downgrade) must not be touched or have
    // its schema_version rewritten downwards.
    const applied = await tx.getFirstAsync<{ n: number }>(
      'SELECT COUNT(*) AS n FROM __drizzle_migrations',
    );
    if ((applied?.n ?? 0) > entries.length) {
      throw new Error(
        `This database was created by a newer version of the app (schema ${applied?.n}, app ${entries.length}).`,
      );
    }
    const last = await tx.getFirstAsync<{ created_at: number }>(
      'SELECT created_at FROM __drizzle_migrations ORDER BY created_at DESC LIMIT 1',
    );

    for (const entry of entries) {
      if (last && Number(last.created_at) >= entry.when) continue;
      const sql = bundle.migrations[`m${String(entry.idx).padStart(4, '0')}`];
      if (sql === undefined) throw new Error(`Missing migration: ${entry.tag}`);
      for (const statement of sql.split('--> statement-breakpoint')) {
        if (statement.trim()) await tx.execAsync(statement);
      }
      await tx.runAsync('INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)', [
        entry.tag,
        entry.when,
      ]);
    }

    // The export `schemaVersion` (DESIGN §4.6, §5).
    await tx.runAsync(
      `INSERT INTO app_meta (key, value) VALUES ('schema_version', ?)
       ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
      [String(entries.length)],
    );
  });
}
