// Start a planned session (DESIGN §8.2, FR-9.1, FR-9.2, FR-3.12, FR-1.10). The prescription is
// calculated now and snapshotted into the log, so later 1RM changes never rewrite it.
import {
  cycleFirstWeek,
  increaseKg,
  incrementFor,
  oneRmForCycle,
  prefillSets,
  progressionKey,
  tmKg,
  type SessionExercise,
} from '@/core';
import type { Db } from '@/data/db';
import { repositories } from '@/data/repositories';

import { exclusive, type ServiceContext, type ServiceResult } from './context';

export interface StartSessionInput {
  plannedWorkoutId: string;
}

export type StartSessionError =
  | 'session_in_progress'
  | 'not_found'
  | 'not_open'
  | 'not_today'
  | 'plan_paused'
  | 'plan_not_active';

export type StartSessionResult = ServiceResult<StartSessionError, { sessionId: string }>;

export function startSession(
  db: Db,
  input: StartSessionInput,
  ctx: ServiceContext,
): Promise<StartSessionResult> {
  return exclusive(db, (tx) => startSessionTx(tx, input, ctx));
}

/** The body of `startSession`, for a caller that holds the transaction (e.g. §8.4 do-now). */
export async function startSessionTx(
  tx: Db,
  input: StartSessionInput,
  ctx: ServiceContext,
): Promise<StartSessionResult> {
  const r = repositories(tx);
  // "Resume" is offered instead (§8.2); the unique index backs this up (FR-9.13).
  if (await r.sessions.inProgress()) return { ok: false, reason: 'session_in_progress' };

  const workout = await r.plannedWorkouts.get(input.plannedWorkoutId);
  if (!workout) return { ok: false, reason: 'not_found' };
  if (workout.status !== 'upcoming') return { ok: false, reason: 'not_open' };
  // A missed workout is started through its options, which move it to today first (§8.4, D-39).
  if (workout.scheduledDate !== ctx.today) return { ok: false, reason: 'not_today' };

  const plan = await r.plans.get(workout.planId);
  if (!plan) return { ok: false, reason: 'not_found' };
  if (plan.status === 'paused') return { ok: false, reason: 'plan_paused' };
  if (plan.status !== 'active') return { ok: false, reason: 'plan_not_active' };

  const [settings, phases, blueprint, planSkills, oneRms] = await Promise.all([
    r.settings.get(),
    r.blueprints.phasesOfPlan(plan.id),
    r.blueprints.loadBlueprint(workout.cycleGroupId),
    r.plans.skills(plan.id),
    r.oneRepMax.listByPlan(plan.id),
  ]);
  const planned = blueprint?.workouts.find((w) => w.workout.id === workout.cycleWorkoutId);
  if (!planned) return { ok: false, reason: 'not_found' };

  const skillIds = [...new Set(planned.exercises.map((e) => e.exercise.skillId))];
  const [skills, lastLoads, tracks] = await Promise.all([
    r.skills.getMany(skillIds),
    r.sessions.lastLoadBySkill(skillIds),
    // A deload copy reads its source's track (§3.12); every slot of a workout shares one (D-20).
    r.progression.getMany(planned.exercises.map((e) => progressionKey(e.exercise))),
  ]);
  const skillById = new Map(skills.map((s) => [s.id, s]));
  const phase = phases.find((p) => p.id === workout.phaseId);
  const training = (phase?.type ?? 'training') === 'training';
  const firstWeek = cycleFirstWeek(phases, workout.weekIndex);

  const sessionId = ctx.newId();
  await r.sessions.insert({
    id: sessionId,
    planId: plan.id,
    plannedWorkoutId: workout.id,
    phaseId: workout.phaseId,
    cycleGroupId: workout.cycleGroupId,
    phaseCycleIndex: workout.phaseCycleIndex,
    name: planned.workout.name,
    kind: planned.workout.kind === 'test_day' ? 'test_day' : 'planned',
    localDate: ctx.today,
    startedAt: ctx.now,
    endedAt: null,
    status: 'in_progress',
    notes: null,
    rpe: null,
    totalVolumeKg: null,
    updatedAt: ctx.now,
  });

  for (const { exercise, sets } of planned.exercises) {
    const skill = skillById.get(exercise.skillId);
    if (!skill) throw new Error(`Unknown skill ${exercise.skillId}`);
    const planSkill = planSkills.find((s) => s.skillId === skill.id);
    const oneRm = oneRmForCycle(
      oneRms.filter((row) => row.skillId === skill.id),
      planSkill?.startingOneRmKg ?? null,
      firstWeek,
    );
    const tm = oneRm === null ? null : tmKg(oneRm, planSkill?.tmPercent ?? plan.defaultTmPercent);
    const track = tracks.get(progressionKey(exercise)) ?? null;

    const row: SessionExercise = {
      id: ctx.newId(),
      sessionId,
      skillId: skill.id,
      cycleExerciseId: exercise.id,
      sortOrder: exercise.sortOrder,
      supersetGroup: exercise.supersetGroup,
      restSec: exercise.restSec,
      notes: null,
      wasSubstituted: false,
      wasAdded: false,
      tmSnapshotKg: sets.some((s) => s.loadType === 'percent_tm' || s.loadType === 'top_set')
        ? tm
        : null,
      trackingType: skill.trackingType,
      loadConvention: skill.loadConvention,
      isUnilateral: skill.isUnilateral,
      isMainLift: skill.isMainLift,
      // The "↑" badge while an increase waits to be lifted; none while paused (FR-3.15).
      dpIncreaseKg: training && track ? increaseKg(track) : null,
    };
    await r.sessions.insertExercise(row);

    const prefills = prefillSets(sets, skill.trackingType, {
      tmKg: tm,
      unit: settings.unit,
      increment: incrementFor(skill, settings, settings.unit),
      phase: { type: phase?.type ?? 'training', loadFactor: phase?.loadFactor ?? null },
      dpState: track,
      lastLoadKg: lastLoads.get(skill.id) ?? null,
    });
    for (const prefill of prefills) {
      await r.sessions.insertSet({
        ...prefill,
        id: ctx.newId(),
        sessionExerciseId: row.id,
        rpe: null,
        status: 'pending',
        completedAt: null,
      });
    }
  }

  return { ok: true, sessionId };
}
