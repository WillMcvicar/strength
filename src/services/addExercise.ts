// Add an unplanned exercise to this session (DESIGN §7.6 "+ Add exercise", FR-9.4). It goes last,
// with one blank set; the lifter adds more with "+ Add set".
import { newSet } from '@/core';
import type { Db } from '@/data/db';
import { repositories } from '@/data/repositories';

import { exclusive, type ServiceContext, type ServiceResult } from './context';
import { inProgressSession, type AccessError } from './sessionAccess';

export type AddExerciseResult = ServiceResult<
  AccessError | 'skill_not_found',
  { sessionExerciseId: string }
>;

export function addExercise(
  db: Db,
  input: { sessionId: string; skillId: string },
  ctx: ServiceContext,
): Promise<AddExerciseResult> {
  return exclusive(db, async (tx) => {
    const r = repositories(tx);
    const found = await inProgressSession(r, input.sessionId);
    if (!found.ok) return found;
    const skill = await r.skills.get(input.skillId);
    if (!skill || skill.isArchived) return { ok: false, reason: 'skill_not_found' };

    const exercises = await r.sessions.exercises(found.session.id);
    const sessionExerciseId = ctx.newId();
    await r.sessions.insertExercise({
      id: sessionExerciseId,
      sessionId: found.session.id,
      skillId: skill.id,
      cycleExerciseId: null,
      sortOrder: Math.max(0, ...exercises.map((e) => e.exercise.sortOrder)) + 1,
      supersetGroup: null,
      restSec: null,
      notes: null,
      wasSubstituted: false,
      wasAdded: true,
      tmSnapshotKg: null,
      trackingType: skill.trackingType,
      loadConvention: skill.loadConvention,
      isUnilateral: skill.isUnilateral,
      isMainLift: skill.isMainLift,
      dpIncreaseKg: null,
    });
    await r.sessions.insertSet({
      ...newSet([], { warmup: false }).prefill,
      id: ctx.newId(),
      sessionExerciseId,
      rpe: null,
      status: 'pending',
      completedAt: null,
    });
    await r.sessions.update(found.session.id, { updatedAt: ctx.now });
    return { ok: true, sessionExerciseId };
  });
}
