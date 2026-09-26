// Revert increase (DESIGN §7.6 ⋯ menu, §3.12, FR-3.15, D-44): one tap undoes a double-progression
// increase for the workout's track, and re-fills the sets still to do in this session as if it
// hadn't happened. Sets already done keep what was lifted, and only the sets pre-filled at the
// increased load change, so a top set or a fixed set in the same exercise keeps its own.
import {
  incrementFor,
  modeLoad,
  nearlyEqual,
  prescribedLoadKg,
  progressionReps,
  revertIncrease as revertedState,
} from '@/core';
import type { Db } from '@/data/db';
import { repositories } from '@/data/repositories';

import { exclusive, type ServiceContext, type ServiceResult } from './context';
import { editableExercise, type AccessError } from './sessionAccess';

export type RevertIncreaseResult = ServiceResult<
  AccessError | 'not_in_progress' | 'nothing_to_revert'
>;

export function revertIncrease(
  db: Db,
  input: { sessionExerciseId: string },
  ctx: ServiceContext,
): Promise<RevertIncreaseResult> {
  return exclusive(db, async (tx) => {
    const r = repositories(tx);
    const found = await editableExercise(r, input.sessionExerciseId);
    if (!found.ok) return found;
    const { exercise, session } = found;
    if (session.status !== 'in_progress') return { ok: false, reason: 'not_in_progress' };

    const id = exercise.cycleExerciseId;
    const state = id ? (await r.progression.getMany([id])).get(id) : undefined;
    if (!state || exercise.dpIncreaseKg === null) {
      return { ok: false, reason: 'nothing_to_revert' };
    }

    // A History edit may already have replayed the increase away; the badge then just follows
    // the track as it is now.
    const reverted = revertedState(state);
    if (reverted !== state) await r.progression.upsert({ ...state, ...reverted });
    await r.sessions.updateExercise(exercise.id, { dpIncreaseKg: null });

    const [settings, skill] = await Promise.all([r.settings.get(), r.skills.get(exercise.skillId)]);
    const loadKg = prescribedLoadKg(
      { loadType: 'double_progression' },
      {
        tmKg: 0,
        unit: settings.unit,
        increment: incrementFor(skill ?? {}, settings, settings.unit),
        phase: { type: 'training' },
        dpState: reverted,
      },
    );
    const working = (await r.sessions.setsOf(exercise.id)).filter((s) => !s.isWarmup);
    // The sets the increase pre-filled all carry its load.
    const increased = modeLoad(
      working.flatMap((s) =>
        s.isTopSet || s.prescribedLoadKg === null ? [] : [s.prescribedLoadKg],
      ),
    );
    const reps = progressionReps(
      reverted,
      working.map((s) => ({ repsMin: s.prescribedRepsMin, repsMax: s.prescribedRepsMax })),
      { paused: false },
    );
    for (const [i, set] of working.entries()) {
      if (
        set.status !== 'pending' ||
        set.isTopSet ||
        increased === null ||
        set.prescribedLoadKg === null ||
        !nearlyEqual(set.prescribedLoadKg, increased)
      ) {
        continue;
      }
      await r.sessions.updateSet(set.id, {
        prescribedLoadKg: loadKg,
        loadKg,
        reps: reps[i] ?? set.reps,
      });
    }
    await r.sessions.update(session.id, { updatedAt: ctx.now });
    return { ok: true };
  });
}
