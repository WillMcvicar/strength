// Test driver (DESIGN §9.1): "a small adapter makes better-sqlite3 satisfy the same interface as
// expo-sqlite". It lives under test/ rather than src/ so that a dev-only native module can never
// be reached from app code or bundled into a release build.
import Database from 'better-sqlite3';

import type { Db, RunResult, SqlValue } from '@/data/db';
import { initDatabase } from '@/data/init';

function wrap(handle: Database.Database): Db {
  const db: Db = {
    async execAsync(sql: string): Promise<void> {
      handle.exec(sql);
    },

    async runAsync(sql: string, params: SqlValue[] = []): Promise<RunResult> {
      const info = handle.prepare(sql).run(...params);
      return { changes: info.changes, lastInsertRowId: Number(info.lastInsertRowid) };
    },

    async getAllAsync<T>(sql: string, params: SqlValue[] = []): Promise<T[]> {
      return handle.prepare(sql).all(...params) as T[];
    },

    async getAllRawAsync(sql: string, params: SqlValue[] = []): Promise<SqlValue[][]> {
      return handle
        .prepare(sql)
        .raw(true)
        .all(...params) as SqlValue[][];
    },

    async getFirstAsync<T>(sql: string, params: SqlValue[] = []): Promise<T | null> {
      return (handle.prepare(sql).get(...params) as T | undefined) ?? null;
    },

    // better-sqlite3's own `transaction()` helper is synchronous, so the exclusive lock is taken
    // by hand to match C-15 and to allow an async task.
    async withExclusiveTransactionAsync(task: (tx: Db) => Promise<void>): Promise<void> {
      handle.exec('BEGIN EXCLUSIVE');
      try {
        await task(db);
        handle.exec('COMMIT');
      } catch (error) {
        handle.exec('ROLLBACK');
        throw error;
      }
    },

    async closeAsync(): Promise<void> {
      handle.close();
    },
  };
  return db;
}

/** Opens an in-memory database for a test. Callers close it in `afterEach`. */
export function openTestDb(): Db {
  const handle = new Database(':memory:');
  handle.pragma('foreign_keys = ON');
  return wrap(handle);
}

/** The fixed `now` test databases are seeded with. */
export const SEEDED_AT = '2026-09-14T08:00:00.000Z';

/** Opens an in-memory database with the real migrations and seed applied (DESIGN §9.1). */
export async function openMigratedTestDb(): Promise<Db> {
  const db = openTestDb();
  await initDatabase(db, SEEDED_AT);
  return db;
}
