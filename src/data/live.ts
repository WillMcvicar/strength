// The post-commit signal behind live reads (D-32, DESIGN §2.4). expo-sqlite's change events fire
// per row while a transaction is still open, so a read they trigger can see the old snapshot.
// This wraps `withExclusiveTransactionAsync` instead and signals only once it has committed.
import type { Db } from './db';

export interface LiveDb {
  /** The database, with every committed exclusive transaction signalled to subscribers. */
  db: Db;
  /** Calls `listener` after each commit; never after a rollback. Returns the unsubscribe. */
  subscribe(listener: () => void): () => void;
}

export function liveDb(inner: Db): LiveDb {
  const listeners = new Set<() => void>();

  const db: Db = {
    execAsync: (sql) => inner.execAsync(sql),
    runAsync: (sql, params) => inner.runAsync(sql, params),
    getAllAsync: (sql, params) => inner.getAllAsync(sql, params),
    getAllRawAsync: (sql, params) => inner.getAllRawAsync(sql, params),
    getFirstAsync: (sql, params) => inner.getFirstAsync(sql, params),
    closeAsync: () => inner.closeAsync(),

    async withExclusiveTransactionAsync(task) {
      await inner.withExclusiveTransactionAsync(task);
      // The data is saved by now, so a listener's bug must not fail the caller or skip the other
      // listeners. It is rethrown on its own so it is still reported.
      for (const listener of [...listeners]) {
        try {
          listener();
        } catch (error) {
          queueMicrotask(() => {
            throw error;
          });
        }
      }
    },
  };

  return {
    db,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
