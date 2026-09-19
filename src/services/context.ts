// What every service is given by its caller (DESIGN §2.1, §3.15). `today` and `now` come from
// clock.ts at the outermost call, and `newId` supplies row IDs, so services stay deterministic
// under test.
import type { LocalDate } from '@/core/types';
import type { Db } from '@/data/db';

export interface ServiceContext {
  today: LocalDate;
  now: string;
  newId: () => string;
}

/** A service's outcome: its payload, or a typed reason the UI can explain (DESIGN §6.6). */
export type ServiceResult<Reason extends string, Payload extends object = object> =
  ({ ok: true } & Payload) | { ok: false; reason: Reason };

/**
 * Runs `task` in one exclusive transaction (C-15) and returns its result. A thrown error rolls
 * everything back; an expected rejection should be returned before anything is written.
 */
export async function exclusive<R>(db: Db, task: (tx: Db) => Promise<R>): Promise<R> {
  let result: R | undefined;
  await db.withExclusiveTransactionAsync(async (tx) => {
    result = await task(tx);
  });
  return result as R;
}
