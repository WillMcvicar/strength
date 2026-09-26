// Remove an exercise and its sets from this session only (DESIGN §7.6 ⋯ menu, FR-9.4).
import type { Db } from '@/data/db';
import { repositories } from '@/data/repositories';

import { exclusive, type ServiceContext, type ServiceResult } from './context';
import { afterSessionChange } from './personalRecords';
import { editableExercise, type AccessError } from './sessionAccess';

export type RemoveExerciseResult = ServiceResult<AccessError>;

export function removeExercise(
  db: Db,
  input: { sessionExerciseId: string },
  ctx: ServiceContext,
): Promise<RemoveExerciseResult> {
  return exclusive(db, async (tx) => {
    const r = repositories(tx);
    const found = await editableExercise(r, input.sessionExerciseId);
    if (!found.ok) return found;
    await r.sessions.deleteExercise(found.exercise.id);
    await afterSessionChange(r, found.session, [found.exercise.skillId], ctx, [
      found.exercise.cycleExerciseId,
    ]);
    return { ok: true };
  });
}
