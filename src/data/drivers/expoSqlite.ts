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

    getFirstAsync: <T>(sql: string, params: SqlValue[] = []): Promise<T | null> =>
      handle.getFirstAsync<T>(sql, params),

    // C-15: exclusive, never withTransactionAsync. `Transaction extends SQLiteDatabase`, so the
    // callback argument is wrapped the same way.
    withExclusiveTransactionAsync: (task: (tx: Db) => Promise<void>): Promise<void> =>
      handle.withExclusiveTransactionAsync((txn) => task(wrap(txn))),

    closeAsync: (): Promise<void> => handle.closeAsync(),
  };
}

export async function openDeviceDb(databaseName: string): Promise<Db> {
  const handle = await SQLite.openDatabaseAsync(databaseName);
  await handle.execAsync('PRAGMA foreign_keys = ON');
  return wrap(handle);
}
