// A note on one exercise of this session (DESIGN §7.6 ⋯ menu, FR-9.7). Blank means none.
import type { Db } from '@/data/db';
import { repositories } from '@/data/repositories';

import { exclusive, type ServiceContext, type ServiceResult } from './context';
import { inProgressExercise, type AccessError } from './sessionAccess';

export type UpdateExerciseNoteResult = ServiceResult<AccessError>;

export function updateExerciseNote(
  db: Db,
  input: { sessionExerciseId: string; notes: string | null },
  ctx: ServiceContext,
): Promise<UpdateExerciseNoteResult> {
  return exclusive(db, async (tx) => {
    const r = repositories(tx);
    const found = await inProgressExercise(r, input.sessionExerciseId);
    if (!found.ok) return found;
    await r.sessions.updateExercise(found.exercise.id, { notes: input.notes?.trim() || null });
    await r.sessions.update(found.session.id, { updatedAt: ctx.now });
    return { ok: true };
  });
}
