// A note on one exercise of this session (DESIGN §7.6 ⋯ menu, FR-9.7). Blank means none.
import type { Db } from '@/data/db';
import { repositories } from '@/data/repositories';

import { exclusive, type ServiceContext, type ServiceResult } from './context';
import { afterSessionChange } from './personalRecords';
import { editableExercise, type AccessError } from './sessionAccess';

export type UpdateExerciseNoteResult = ServiceResult<AccessError>;

export function updateExerciseNote(
  db: Db,
  input: { sessionExerciseId: string; notes: string | null },
  ctx: ServiceContext,
): Promise<UpdateExerciseNoteResult> {
  return exclusive(db, async (tx) => {
    const r = repositories(tx);
    const found = await editableExercise(r, input.sessionExerciseId);
    if (!found.ok) return found;
    await r.sessions.updateExercise(found.exercise.id, { notes: input.notes?.trim() || null });
    await afterSessionChange(r, found.session, [], ctx);
    return { ok: true };
  });
}
