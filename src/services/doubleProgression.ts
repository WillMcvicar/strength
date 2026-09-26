// Double-progression bookkeeping shared by the services that start, finish, edit and delete
// sessions (DESIGN §3.12, §8.2, C-4). Each runs inside its caller's exclusive transaction; none
// is a service of its own.
import {
  NEW_PROGRESSION,
  incrementFor,
  replayProgression,
  updateProgression,
  type CycleSet,
  type ProgressionRules,
  type Session,
} from '@/core';
import type { BlueprintExercise, Repositories } from '@/data/repositories';

/** A cycle exercise keeps a track when it has a double-progression working set (FR-3.15). */
export const isTracked = (sets: readonly CycleSet[]): boolean =>
  sets.some((s) => !s.isWarmup && s.loadType === 'double_progression');

/** The rules for each tracked exercise of the session's workout, when it is a training phase. */
async function trackedRules(
  r: Repositories,
  session: Session,
): Promise<Map<string, ProgressionRules>> {
  const rules = new Map<string, ProgressionRules>();
  if (!session.phaseId || !session.cycleGroupId) return rules;
  const [phase, blueprint, settings] = await Promise.all([
    r.blueprints.phase(session.phaseId),
    r.blueprints.loadBlueprint(session.cycleGroupId),
    r.settings.get(),
  ]);
  // Paused in deloads and tapers (FR-3.15): only training phases write.
  if (phase?.type !== 'training' || !blueprint) return rules;
  const exercises: BlueprintExercise[] = blueprint.workouts.flatMap((w) => w.exercises);
  const tracked = exercises.filter((e) => isTracked(e.sets));
  const skills = new Map(
    (await r.skills.getMany(tracked.map((e) => e.exercise.skillId))).map((s) => [s.id, s]),
  );
  for (const { exercise, sets } of tracked) {
    const skill = skills.get(exercise.skillId);
    if (!skill) continue;
    rules.set(exercise.id, {
      workingSetCount: sets.filter((s) => !s.isWarmup).length,
      increment: incrementFor(skill, settings, settings.unit),
      unit: settings.unit,
    });
  }
  return rules;
}

/** Finish Workout step 4 (§8.2): each tracked exercise of the session moves its track on. */
export async function recordSessionProgression(
  r: Repositories,
  session: Session,
  endedAt: string,
): Promise<void> {
  const rules = await trackedRules(r, session);
  if (rules.size === 0 || !session.planId) return;
  const logged = (await r.sessions.exercises(session.id)).filter(
    ({ exercise }) => exercise.cycleExerciseId !== null && rules.has(exercise.cycleExerciseId),
  );
  const states = await r.progression.getMany(logged.map((e) => e.exercise.cycleExerciseId!));
  for (const { exercise, sets } of logged) {
    const id = exercise.cycleExerciseId!;
    const next = updateProgression(
      states.get(id) ?? NEW_PROGRESSION,
      {
        sessionId: session.id,
        endedAt,
        phaseType: 'training',
        wasSubstituted: exercise.wasSubstituted,
        sets,
      },
      rules.get(id)!,
    );
    await r.progression.upsert({ ...next, cycleExerciseId: id, planId: session.planId });
  }
}

/**
 * Rebuilds the tracks of these cycle exercises from their finished sessions (C-4), after a
 * session of `session`'s workout was edited or deleted. Earlier sessions can't be changed by it,
 * but the reduce-hint count runs across sessions, so the whole track is replayed; a track holds
 * one plan's sessions of one workout, so this stays small.
 */
export async function replaySessionProgression(
  r: Repositories,
  session: Session,
  cycleExerciseIds: readonly (string | null)[],
): Promise<void> {
  if (!session.planId) return;
  const rules = await trackedRules(r, session);
  for (const id of new Set(cycleExerciseIds)) {
    const rule = id === null ? undefined : rules.get(id);
    if (!id || !rule) continue;
    const state = replayProgression(await r.sessions.progressionHistory(id), rule);
    await r.progression.upsert({ ...state, cycleExerciseId: id, planId: session.planId });
  }
}
