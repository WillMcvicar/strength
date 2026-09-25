// Edit a set's values before or after it is done (DESIGN §7.6, FR-9.3). A done set must stay one
// that could have been completed.
import { completionError, isValidSetRpe, type CompletionError } from '@/core';
import type { Db } from '@/data/db';
import { repositories } from '@/data/repositories';

import { exclusive, type ServiceContext, type ServiceResult } from './context';
import { afterSessionChange } from './personalRecords';
import { editableSet, type AccessError } from './sessionAccess';
import { mergeSetValues, type SetInput } from './setValues';

export type UpdateSetResult = ServiceResult<AccessError | 'bad_value' | CompletionError>;

export function updateSet(db: Db, input: SetInput, ctx: ServiceContext): Promise<UpdateSetResult> {
  return exclusive(db, async (tx) => {
    const r = repositories(tx);
    const found = await editableSet(r, input.setLogId);
    if (!found.ok) return found;
    const values = mergeSetValues(found.set, input);
    if (!values) return { ok: false, reason: 'bad_value' };
    if (found.set.status === 'completed') {
      const error = completionError(found.exercise, found.set, values);
      if (error) return { ok: false, reason: error };
    } else if (values.rpe != null && !isValidSetRpe(values.rpe)) {
      return { ok: false, reason: 'bad_rpe' };
    }

    await r.sessions.updateSet(found.set.id, values);
    await afterSessionChange(r, found.session, [found.exercise.skillId], ctx);
    return { ok: true };
  });
}
