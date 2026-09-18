// Brings a database up to date before any screen renders (DESIGN §4.6, §7.1): migrations, then
// seed updates. `now` comes from the caller; src/data never reads the clock.
import type { Db } from './db';
import { migrate } from './migrate';
import bundle from './migrations/migrations';
import { runSeed } from './seed';

export async function initDatabase(db: Db, now: string): Promise<void> {
  await migrate(db, bundle);
  await runSeed(db, now);
}
