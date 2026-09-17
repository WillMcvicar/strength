// The database interface the rest of the app talks to (DESIGN §9.1).
//
// It is the subset of `expo-sqlite`'s async API that this project uses, so the device driver is a
// pass-through and `better-sqlite3` only has to satisfy this much to stand in for it under Jest.
// Types only — no runtime import — so the Node test project can import it without pulling Expo in.

/** Values SQLite can bind. Booleans are stored as 0/1 and weights as REAL kg (DESIGN §4.3). */
export type SqlValue = string | number | null | Uint8Array;

export interface RunResult {
  changes: number;
  lastInsertRowId: number;
}

export interface Db {
  /** Run one or more statements with no parameters and no result. */
  execAsync(sql: string): Promise<void>;
  /** Run a single writing statement. */
  runAsync(sql: string, params?: SqlValue[]): Promise<RunResult>;
  /** Read every matching row. */
  getAllAsync<T>(sql: string, params?: SqlValue[]): Promise<T[]>;
  /** Read the first matching row, or null. */
  getFirstAsync<T>(sql: string, params?: SqlValue[]): Promise<T | null>;
  /**
   * Run `task` inside one BEGIN EXCLUSIVE transaction, committing on success and rolling back on
   * any throw. C-15 requires exclusivity: `withTransactionAsync` may interleave other queries.
   * Confirmed against expo-sqlite in Expo SDK 57 at scaffold time, as C-15 instructs.
   */
  withExclusiveTransactionAsync(task: (tx: Db) => Promise<void>): Promise<void>;
  closeAsync(): Promise<void>;
}
