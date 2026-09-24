// Add a set, or a warm-up, to an exercise for this session only (DESIGN §7.6; FR-9.4, FR-9.14).
import { newSet } from '@/core';
import type { Db } from '@/data/db';
import { repositories } from '@/data/repositories';

import { exclusive, type ServiceContext, type ServiceResult } from './context';
import { inProgressExercise, type AccessError } from './sessionAccess';

export type AddSetResult = ServiceResult<AccessError, { setLogId: string }>;

export function addSet(
  db: Db,
  input: { sessionExerciseId: string; warmup?: boolean },
  ctx: ServiceContext,
): Promise<AddSetResult> {
  return exclusive(db, async (tx) => {
    const r = repositories(tx);
    const found = await inProgressExercise(r, input.sessionExerciseId);
    if (!found.ok) return found;

    const sets = await r.sessions.setsOf(found.exercise.id);
    const { position, prefill } = newSet(sets, { warmup: input.warmup ?? false });
    const setLogId = ctx.newId();
    // Inserted past the highest index, then renumbered into place.
    await r.sessions.insertSet({
      ...prefill,
      setIndex: Math.max(0, ...sets.map((s) => s.setIndex)) + 1,
      id: setLogId,
      sessionExerciseId: found.exercise.id,
      rpe: null,
      status: 'pending',
      completedAt: null,
    });
    const order = sets.map((s) => s.id);
    order.splice(position, 0, setLogId);
    await r.sessions.renumberSets(order);
    await r.sessions.update(found.session.id, { updatedAt: ctx.now });
    return { ok: true, setLogId };
  });
}
