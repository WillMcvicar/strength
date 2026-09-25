// Mark a set done (DESIGN §8.2, §7.6; FR-9.2, FR-9.2a). The UI starts the rest timer and
// schedules its notification itself (§2.6, D-39); nothing about the timer is stored.
import { completionError, type CompletionError } from '@/core';
import type { Db } from '@/data/db';
import { repositories } from '@/data/repositories';

import { exclusive, type ServiceContext, type ServiceResult } from './context';
import { afterSessionChange, completionTime } from './personalRecords';
import { editableSet, type AccessError } from './sessionAccess';
import { mergeSetValues, type SetInput } from './setValues';

export type { SetInput } from './setValues';
export type CompleteSetResult = ServiceResult<AccessError | 'bad_value' | CompletionError>;

/** "Done as planned" when no values are given (FR-9.2); the set completes only if it may. */
export function completeSet(
  db: Db,
  input: SetInput,
  ctx: ServiceContext,
): Promise<CompleteSetResult> {
  return exclusive(db, async (tx) => {
    const r = repositories(tx);
    const found = await editableSet(r, input.setLogId);
    if (!found.ok) return found;
    const values = mergeSetValues(found.set, input);
    if (!values) return { ok: false, reason: 'bad_value' };
    const error = completionError(found.exercise, found.set, values);
    if (error) return { ok: false, reason: error };

    await r.sessions.updateSet(found.set.id, {
      ...values,
      status: 'completed',
      completedAt: completionTime(found.session, ctx),
    });
    await afterSessionChange(r, found.session, [found.exercise.skillId], ctx);
    return { ok: true };
  });
}
