// Mark a set as failed, or undo that (DESIGN §7.6, FR-9.15). A failed set keeps its values and
// stays in history, but counts for no PR, e1RM, suggestion, volume or set count.
import type { Db } from '@/data/db';
import { repositories } from '@/data/repositories';

import { exclusive, type ServiceContext, type ServiceResult } from './context';
import { afterSessionChange, completionTime } from './personalRecords';
import { editableSet, type AccessError } from './sessionAccess';

export type MarkSetFailedResult = ServiceResult<AccessError>;

export function markSetFailed(
  db: Db,
  input: { setLogId: string; failed: boolean },
  ctx: ServiceContext,
): Promise<MarkSetFailedResult> {
  return exclusive(db, async (tx) => {
    const r = repositories(tx);
    const found = await editableSet(r, input.setLogId);
    if (!found.ok) return found;

    await r.sessions.updateSet(
      found.set.id,
      input.failed
        ? { status: 'failed', completedAt: completionTime(found.session, ctx) }
        : { status: 'pending', completedAt: null },
    );
    await afterSessionChange(r, found.session, [found.exercise.skillId], ctx);
    return { ok: true };
  });
}
