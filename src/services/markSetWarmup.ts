// Mark a set as a warm-up, or back to a working set (DESIGN §7.6, FR-9.14). Warm-ups need no RPE
// and count for nothing, so a done set can only become a working set if it would still be done.
import { completionError, type CompletionError } from '@/core';
import type { Db } from '@/data/db';
import { repositories } from '@/data/repositories';

import { exclusive, type ServiceContext, type ServiceResult } from './context';
import { afterSessionChange } from './personalRecords';
import { editableSet, type AccessError } from './sessionAccess';

export type MarkSetWarmupResult = ServiceResult<AccessError | CompletionError>;

export function markSetWarmup(
  db: Db,
  input: { setLogId: string; isWarmup: boolean },
  ctx: ServiceContext,
): Promise<MarkSetWarmupResult> {
  return exclusive(db, async (tx) => {
    const r = repositories(tx);
    const found = await editableSet(r, input.setLogId);
    if (!found.ok) return found;
    const { set, exercise } = found;

    if (set.status === 'completed') {
      const error = completionError(exercise, { ...set, isWarmup: input.isWarmup }, set);
      if (error) return { ok: false, reason: error };
    }
    await r.sessions.updateSet(set.id, { isWarmup: input.isWarmup });
    await afterSessionChange(r, found.session, [found.exercise.skillId], ctx);
    return { ok: true };
  });
}
