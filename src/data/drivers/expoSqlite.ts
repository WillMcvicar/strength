// Device driver (DESIGN §9.1). expo-sqlite's API is the one `Db` is modelled on, but its methods
// take required params, so each is wrapped to supply the default. `SQLiteRunResult` already has
// the `{ changes, lastInsertRowId }` shape `RunResult` uses.
import * as SQLite from 'expo-sqlite';

import type { Db, RunResult, SqlValue } from '../db';

/**
 * `transaction` is how exclusive transactions reach the connection: the main connection opens a
 * new one, and a connection already inside a transaction refuses to open another.
 */
function wrap(
  handle: SQLite.SQLiteDatabase,
  transaction: (task: (tx: Db) => Promise<void>) => Promise<void>,
): Db {
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

    withExclusiveTransactionAsync: transaction,

    closeAsync: (): Promise<void> => handle.closeAsync(),
  };
}

// The database file lives in expo-sqlite's default directory: the app's document directory on
// iOS, which iCloud device backups include, and `filesDir/SQLite` on Android, which the backup
// rules in plugins/withAndroidBackup.js include (DESIGN §2.7, NFR-4).
export async function openDeviceDb(databaseName: string): Promise<Db> {
  // No change listening: its events fire before commit, so live reads use `liveDb` instead (D-32).
  const handle = await SQLite.openDatabaseAsync(databaseName);
  // WAL is stored in the file, so it covers every connection (§4.1). Transactions set foreign
  // keys on their own connection (D-35).
  await handle.execAsync('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL');
  return wrap(handle, (task) => exclusiveTransaction(databaseName, task));
}

/**
 * C-15, D-35: one exclusive transaction on its own connection, as expo-sqlite's
 * `withExclusiveTransactionAsync` does, but opened here so foreign keys can be switched on before
 * the transaction begins (the pragma is a no-op inside one). That makes it independent of the
 * SQLITE_DEFAULT_FOREIGN_KEYS build flag, which Expo Go ignores; the flag stays as a backstop, and
 * `migrate` still checks. The busy timeout makes a second writer wait rather than fail at once.
 */
async function exclusiveTransaction(
  databaseName: string,
  task: (tx: Db) => Promise<void>,
): Promise<void> {
  const connection = await SQLite.openDatabaseAsync(databaseName, { useNewConnection: true });
  try {
    await connection.execAsync('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000');
    await connection.execAsync('BEGIN EXCLUSIVE');
    try {
      await task(wrap(connection, refuseNested));
      await connection.execAsync('COMMIT');
    } catch (error) {
      // A failed rollback mustn't hide why the work failed; closing discards the transaction.
      await connection.execAsync('ROLLBACK').catch(() => {});
      throw error;
    }
  } finally {
    await connection.closeAsync();
  }
}

function refuseNested(): Promise<void> {
  return Promise.reject(
    new Error('Already inside an exclusive transaction: pass `tx` on instead of opening another.'),
  );
}
