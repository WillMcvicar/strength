// Swap an exercise for another skill, for this session only (DESIGN §7.6 ⋯ menu, FR-9.4). The
// sets carry over; sets still to do lose any value the new skill doesn't track. The new skill's
// fields are snapshotted (FR-1.10), and the plan's exercise is untouched.
import { valuesForTracking } from '@/core';
import type { Db } from '@/data/db';
import { repositories } from '@/data/repositories';

import { exclusive, type ServiceContext, type ServiceResult } from './context';
import { inProgressExercise, type AccessError } from './sessionAccess';

export type SwapExerciseResult = ServiceResult<AccessError | 'skill_not_found'>;

export function swapExercise(
  db: Db,
  input: { sessionExerciseId: string; skillId: string },
  ctx: ServiceContext,
): Promise<SwapExerciseResult> {
  return exclusive(db, async (tx) => {
    const r = repositories(tx);
    const found = await inProgressExercise(r, input.sessionExerciseId);
    if (!found.ok) return found;
    const skill = await r.skills.get(input.skillId);
    if (!skill || skill.isArchived) return { ok: false, reason: 'skill_not_found' };

    await r.sessions.updateExercise(found.exercise.id, {
      skillId: skill.id,
      wasSubstituted: true,
      // The TM belonged to the skill it replaced.
      tmSnapshotKg: null,
      trackingType: skill.trackingType,
      loadConvention: skill.loadConvention,
      isUnilateral: skill.isUnilateral,
      isMainLift: skill.isMainLift,
      dpIncreaseKg: null,
    });
    for (const set of await r.sessions.setsOf(found.exercise.id)) {
      if (set.status === 'pending') {
        await r.sessions.updateSet(set.id, valuesForTracking(set, skill.trackingType));
      }
    }
    await r.sessions.update(found.session.id, { updatedAt: ctx.now });
    return { ok: true };
  });
}
