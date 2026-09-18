// Drizzle over the `Db` interface (DESIGN §2.1, §9.1). The sqlite-proxy driver hands every query
// to a callback, so one Drizzle type serves the device driver and the better-sqlite3 test driver
// alike. Transactions stay with `Db.withExclusiveTransactionAsync` (C-15): a service binds
// `orm(tx)` inside it, and Drizzle's own `transaction()` is never used.
import { drizzle, type SqliteRemoteDatabase } from 'drizzle-orm/sqlite-proxy';

import type { Db } from './db';
import * as schema from './schema';

export type Orm = SqliteRemoteDatabase<typeof schema>;

export function orm(db: Db): Orm {
  return drizzle(
    async (sql, params, method) => {
      if (method === 'run') {
        await db.runAsync(sql, params);
        return { rows: [] };
      }
      const rows = await db.getAllRawAsync(sql, params);
      // `get` expects the single row itself (undefined when there is none), not a list.
      return { rows: method === 'get' ? (rows[0] as unknown as unknown[]) : rows };
    },
    { schema },
  );
}
