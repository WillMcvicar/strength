// Swap an exercise for another skill, for this session only (DESIGN §7.6 ⋯ menu, FR-9.4, D-40).
// Sets already done stay with the skill they were done on, so its PRs and pre-fills stay right.
// If none are done, the exercise itself becomes the new skill. Otherwise the sets still to do
// move to a new exercise straight after it. Either way they lose any value the new skill doesn't
// track, and the new skill's fields are snapshotted (FR-1.10). The plan is untouched.
import { valuesForTracking, type Skill } from '@/core';
import type { Db } from '@/data/db';
import { repositories } from '@/data/repositories';

import { exclusive, type ServiceContext, type ServiceResult } from './context';
import { afterSessionChange } from './personalRecords';
import { editableExercise, type AccessError } from './sessionAccess';

export type SwapExerciseResult = ServiceResult<
  AccessError | 'skill_not_found' | 'nothing_to_swap',
  /** The exercise the new skill is on. */
  { sessionExerciseId: string }
>;

const snapshot = (skill: Skill) => ({
  skillId: skill.id,
  wasSubstituted: true,
  // The TM and the "↑" badge belonged to the skill it replaced.
  tmSnapshotKg: null,
  dpIncreaseKg: null,
  trackingType: skill.trackingType,
  loadConvention: skill.loadConvention,
  isUnilateral: skill.isUnilateral,
  isMainLift: skill.isMainLift,
});

export function swapExercise(
  db: Db,
  input: { sessionExerciseId: string; skillId: string },
  ctx: ServiceContext,
): Promise<SwapExerciseResult> {
  return exclusive(db, async (tx) => {
    const r = repositories(tx);
    const found = await editableExercise(r, input.sessionExerciseId);
    if (!found.ok) return found;
    const skill = await r.skills.get(input.skillId);
    if (!skill || skill.isArchived) return { ok: false, reason: 'skill_not_found' };

    const { exercise, session } = found;
    const sets = await r.sessions.setsOf(exercise.id);
    const toDo = sets.filter((s) => s.status === 'pending');
    if (toDo.length === 0) return { ok: false, reason: 'nothing_to_swap' };

    let target = exercise.id;
    if (toDo.length === sets.length) {
      await r.sessions.updateExercise(exercise.id, snapshot(skill));
    } else {
      // Make room straight after the old exercise, then move the sets still to do across.
      for (const { exercise: later } of await r.sessions.exercises(session.id)) {
        if (later.sortOrder > exercise.sortOrder) {
          await r.sessions.updateExercise(later.id, { sortOrder: later.sortOrder + 1 });
        }
      }
      target = ctx.newId();
      await r.sessions.insertExercise({
        ...exercise,
        ...snapshot(skill),
        id: target,
        // A substitute is not the planned exercise, so it won't drive its progression (Slice 8).
        cycleExerciseId: null,
        sortOrder: exercise.sortOrder + 1,
        notes: null,
        wasAdded: false,
      });
      for (const [i, set] of toDo.entries()) {
        // Negative first, then 1…n, so `uq_set_log` holds at every step.
        await r.sessions.updateSet(set.id, { sessionExerciseId: target, setIndex: -(i + 1) });
      }
      await r.sessions.renumberSets(toDo.map((s) => s.id));
      await r.sessions.renumberSets((await r.sessions.setsOf(exercise.id)).map((s) => s.id));
    }

    for (const set of toDo) {
      await r.sessions.updateSet(set.id, valuesForTracking(set, skill.trackingType));
    }
    await afterSessionChange(r, session, [exercise.skillId, skill.id], ctx);
    return { ok: true, sessionExerciseId: target };
  });
}
