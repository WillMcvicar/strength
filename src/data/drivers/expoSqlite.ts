// Device driver (DESIGN §9.1). expo-sqlite's API is the one `Db` is modelled on, but its methods
// take required params, so each is wrapped to supply the default. `SQLiteRunResult` already has
// the `{ changes, lastInsertRowId }` shape `RunResult` uses.
import * as SQLite from 'expo-sqlite';

import type { Db, RunResult, SqlValue } from '../db';

function wrap(handle: SQLite.SQLiteDatabase): Db {
  return {
    execAsync: (sql: string): Promise<void> => handle.execAsync(sql),

    runAsync: (sql: string, params: SqlValue[] = []): Promise<RunResult> =>
      handle.runAsync(sql, params),

    getAllAsync: <T>(sql: string, params: SqlValue[] = []): Promise<T[]> =>
      handle.getAllAsync<T>(sql, params),

    getAllRawAsync: async (sql: string, params: SqlValue[] = []): Promise<SqlValue[][]> => {
      const statement = await handle.prepareAsync(sql);
      try {
        const result = await statement.executeForRawResultAsync<Record<string, SqlValue>>(params);
        return await result.getAllAsync();
      } finally {
        await statement.finalizeAsync();
      }
    },

    getFirstAsync: <T>(sql: string, params: SqlValue[] = []): Promise<T | null> =>
      handle.getFirstAsync<T>(sql, params),

    // C-15: exclusive, never withTransactionAsync. `Transaction extends SQLiteDatabase`, so the
    // callback argument is wrapped the same way.
    withExclusiveTransactionAsync: (task: (tx: Db) => Promise<void>): Promise<void> =>
      handle.withExclusiveTransactionAsync((txn) => task(wrap(txn))),

    closeAsync: (): Promise<void> => handle.closeAsync(),
  };
}

// The database file lives in expo-sqlite's default directory: the app's document directory on
// iOS, which iCloud device backups include, and `filesDir/SQLite` on Android, which the backup
// rules in plugins/withAndroidBackup.js include (DESIGN §2.7, NFR-4).
export async function openDeviceDb(databaseName: string): Promise<Db> {
  // No change listening: its events fire before commit, so live reads use `liveDb` instead (D-32).
  const handle = await SQLite.openDatabaseAsync(databaseName);
  // Exclusive transactions run on their own connection, where this pragma never reaches, so
  // foreign keys are also compiled on with SQLITE_DEFAULT_FOREIGN_KEYS (app.json, D-27 note in
  // §4.1); `migrate` checks it. WAL is stored in the file, so it covers every connection (§4.1).
  await handle.execAsync('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL');
  return wrap(handle);
}
