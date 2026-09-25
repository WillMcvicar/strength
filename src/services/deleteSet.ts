// Remove a set for this session only (DESIGN §7.6 long-press menu, FR-9.4).
import type { Db } from '@/data/db';
import { repositories } from '@/data/repositories';

import { exclusive, type ServiceContext, type ServiceResult } from './context';
import { afterSessionChange } from './personalRecords';
import { editableSet, type AccessError } from './sessionAccess';

export type DeleteSetResult = ServiceResult<AccessError>;

export function deleteSet(
  db: Db,
  input: { setLogId: string },
  ctx: ServiceContext,
): Promise<DeleteSetResult> {
  return exclusive(db, async (tx) => {
    const r = repositories(tx);
    const found = await editableSet(r, input.setLogId);
    if (!found.ok) return found;

    await r.sessions.deleteSet(found.set.id);
    const rest = await r.sessions.setsOf(found.exercise.id);
    await r.sessions.renumberSets(rest.map((s) => s.id));
    await afterSessionChange(r, found.session, [found.exercise.skillId], ctx);
    return { ok: true };
  });
}
