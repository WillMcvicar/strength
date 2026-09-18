// Opens, migrates and seeds the on-device database before any screen renders (DESIGN §4.6, §7.1),
// then hands it to the tree. NFR-2: everything is local; there is no network step.
import { createContext, useContext, useEffect, useState } from 'react';

import type { Db } from '@/data/db';
import { openDeviceDb } from '@/data/drivers/expoSqlite';
import { initDatabase } from '@/data/init';
import { now } from '@/services/clock';

export const DATABASE_NAME = 'workout-planner.db';

export type DatabaseState =
  { status: 'opening' } | { status: 'ready'; db: Db } | { status: 'failed'; error: Error };

let opening: Promise<Db> | null = null;

/** Opens the app database once per launch, however many times it is asked for. */
function openAppDatabase(): Promise<Db> {
  opening ??= openDeviceDb(DATABASE_NAME).then(async (db) => {
    await initDatabase(db, now());
    return db;
  });
  return opening;
}

export function useOpenDatabase(open: () => Promise<Db> = openAppDatabase): DatabaseState {
  const [state, setState] = useState<DatabaseState>({ status: 'opening' });

  useEffect(() => {
    let current = true;
    open().then(
      (db) => current && setState({ status: 'ready', db }),
      (error: unknown) =>
        current &&
        setState({
          status: 'failed',
          error: error instanceof Error ? error : new Error(String(error)),
        }),
    );
    return () => {
      current = false;
    };
  }, [open]);

  return state;
}

const DatabaseContext = createContext<Db | null>(null);

export const DatabaseProvider = DatabaseContext.Provider;

/** The open database, for view-model hooks. Writes still go through src/services. */
export function useDb(): Db {
  const db = useContext(DatabaseContext);
  if (!db) throw new Error('useDb must be called inside <DatabaseProvider>.');
  return db;
}
