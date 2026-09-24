// Remove an exercise and its sets from this session only (DESIGN §7.6 ⋯ menu, FR-9.4).
import type { Db } from '@/data/db';
import { repositories } from '@/data/repositories';

import { exclusive, type ServiceContext, type ServiceResult } from './context';
import { inProgressExercise, type AccessError } from './sessionAccess';

export type RemoveExerciseResult = ServiceResult<AccessError>;

export function removeExercise(
  db: Db,
  input: { sessionExerciseId: string },
  ctx: ServiceContext,
): Promise<RemoveExerciseResult> {
  return exclusive(db, async (tx) => {
    const r = repositories(tx);
    const found = await inProgressExercise(r, input.sessionExerciseId);
    if (!found.ok) return found;
    await r.sessions.deleteExercise(found.exercise.id);
    await r.sessions.update(found.session.id, { updatedAt: ctx.now });
    return { ok: true };
  });
}
