// Opens, migrates and seeds the on-device database before any screen renders (DESIGN §4.6, §7.1),
// then hands it to the tree. NFR-2: everything is local; there is no network step.
import { createContext, useContext, useEffect, useState } from 'react';

import type { Db } from '@/data/db';
import { openDeviceDb } from '@/data/drivers/expoSqlite';
import { initDatabase } from '@/data/init';
import { liveDb, type LiveDb } from '@/data/live';
import { now } from '@/services/clock';

export const DATABASE_NAME = 'workout-planner.db';

export type DatabaseState =
  { status: 'opening' } | { status: 'ready'; db: LiveDb } | { status: 'failed'; error: Error };

let opening: Promise<LiveDb> | null = null;

/** Opens the app database once per launch, however many times it is asked for. */
function openAppDatabase(): Promise<LiveDb> {
  opening ??= openDeviceDb(DATABASE_NAME).then(async (db) => {
    await initDatabase(db, now());
    // Live reads re-run after each commit (D-32), so every write must go through this wrapper.
    return liveDb(db);
  });
  return opening;
}

export function useOpenDatabase(open: () => Promise<LiveDb> = openAppDatabase): DatabaseState {
  const [state, setState] = useState<DatabaseState>({ status: 'opening' });

  useEffect(() => {
    let current = true;
    open().then(
      (db) => current && setState({ status: 'ready', db }),
      (error: unknown) => current && setState({ status: 'failed', error: toError(error) }),
    );
    return () => {
      current = false;
    };
  }, [open]);

  return state;
}

export function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

const DatabaseContext = createContext<LiveDb | null>(null);

export const DatabaseProvider = DatabaseContext.Provider;

/** The open database and its commit signal, for `useLiveQuery` (D-32). */
export function useLiveDb(): LiveDb {
  const live = useContext(DatabaseContext);
  if (!live) throw new Error('Database hooks must be called inside <DatabaseProvider>.');
  return live;
}

/** The open database, for view-model hooks. Writes still go through src/services. */
export function useDb(): Db {
  return useLiveDb().db;
}
