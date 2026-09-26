// A started plan to log sessions against (FR-9, DESIGN §9.2). Full body A is the §7.6 example:
// squat 1RM 125 kg → TM 112.5 kg, so 80% is 90 kg. It also carries a per-side dumbbell press
// (AC-39), a unilateral row with the total convention (AC-55) and a timed plank. Full body B has
// a bench press, a pull-up with added load (AC-40) and a completion-only run (AC-37).
import { rpeRequired } from '@/core';
import type { Db } from '@/data/db';
import { repositories } from '@/data/repositories';
import { completeSet } from '@/services/completeSet';
import type { ServiceContext } from '@/services/context';
import { finishSession } from '@/services/finishSession';
import type { SetInput } from '@/services/setValues';
import { startSession } from '@/services/startSession';
import { startPlan } from '@/services/startPlan';

import { aPlan, sets, type BuiltPlan } from './plans';

export const START = '2026-09-14'; // a Monday

export async function aStartedPlan(db: Db, ctx: ServiceContext): Promise<BuiltPlan> {
  const built = await aPlan()
    .startingOn(START)
    .withWorkouts('Full body A', 'Full body B')
    .withExercises('Full body A', [
      {
        skill: 'skill_back_squat',
        sets: [
          {
            isWarmup: true,
            loadType: 'fixed',
            loadPercent: null,
            fixedLoadKg: 60,
            targetRpeMin: null,
            targetRpeMax: null,
          },
          ...sets(3, { loadPercent: 0.8, targetRpeMin: 8, targetRpeMax: 8 }),
        ],
      },
      {
        skill: 'skill_incline_dumbbell_press',
        sets: sets(2, {
          loadType: 'fixed',
          loadPercent: null,
          fixedLoadKg: 30,
          repsMin: 10,
          repsMax: 10,
          targetRpeMin: null,
          targetRpeMax: null,
        }),
      },
      {
        skill: 'skill_dumbbell_row',
        sets: sets(1, {
          loadType: 'fixed',
          loadPercent: null,
          fixedLoadKg: 20,
          repsMin: 8,
          repsMax: 8,
          targetRpeMin: null,
          targetRpeMax: null,
        }),
      },
      {
        skill: 'skill_plank',
        sets: sets(2, {
          loadType: 'bodyweight',
          loadPercent: null,
          repsMin: null,
          repsMax: null,
          targetTimeSec: 60,
          targetRpeMin: null,
          targetRpeMax: null,
        }),
      },
    ])
    .withExercises('Full body B', [
      { skill: 'skill_bench_press', sets: sets(3) },
      {
        skill: 'skill_pull_up',
        sets: sets(2, {
          loadType: 'bodyweight',
          loadPercent: null,
          targetRpeMin: null,
          targetRpeMax: null,
        }),
      },
      {
        skill: 'skill_run',
        sets: sets(1, {
          loadType: 'bodyweight',
          loadPercent: null,
          repsMin: null,
          repsMax: null,
          targetRpeMin: null,
          targetRpeMax: null,
        }),
      },
    ])
    .withSchedule({
      A: { Mon: 'Full body A', Wed: 'Full body B', Fri: 'Full body A' },
      B: { Mon: 'Full body B', Wed: 'Full body A', Fri: 'Full body B' },
    })
    .withOneRm('skill_back_squat', 125)
    .withOneRm('skill_bench_press', 100)
    .build(db);

  const started = await startPlan(db, { planId: built.planId, startDate: START }, ctx);
  if (!started.ok) throw new Error(`Plan didn't start: ${started.reason}`);
  return built;
}

/** Plan dates of the started plan: Full body A on Mon/Fri and B on Wed in week A (week B swaps). */
export const MON = START;
export const WED = '2026-09-16';
export const FRI = '2026-09-18';
export const NEXT_MON = '2026-09-21';

/** A context for a plan date, at 17:00 UTC by default. */
export const on = (ctx: ServiceContext, date: string, time = '17:00'): ServiceContext => ({
  ...ctx,
  today: date,
  now: `${date}T${time}:00.000Z`,
});

export type SetValues = Omit<SetInput, 'setLogId'>;

/** A skill's values for every working set, or one entry per working set in order. */
export type DayValues = Record<string, SetValues | SetValues[]>;

/**
 * Starts the day's workout and logs every set: working sets of a skill in `values` take those
 * values, and everything else is done as planned (RPE at the top of its target, or 8, where one is
 * required). Returns the session, still in progress.
 */
export async function logDay(
  db: Db,
  planId: string,
  date: string,
  ctx: ServiceContext,
  values: DayValues = {},
): Promise<string> {
  const r = repositories(db);
  const c = on(ctx, date);
  const workout = (await r.plannedWorkouts.listByPlan(planId)).find(
    (w) => w.scheduledDate === date,
  );
  if (!workout) throw new Error(`No workout on ${date}`);
  const started = await startSession(db, { plannedWorkoutId: workout.id }, c);
  if (!started.ok) throw new Error(started.reason);
  for (const { exercise, sets } of await r.sessions.exercises(started.sessionId)) {
    let working = 0;
    for (const s of sets) {
      const skillValues = values[exercise.skillId] ?? {};
      const given = s.isWarmup
        ? {}
        : Array.isArray(skillValues)
          ? (skillValues[working++] ?? {})
          : skillValues;
      const rpe = rpeRequired(exercise, s) ? (s.targetRpeMax ?? 8) : undefined;
      const done = await completeSet(db, { rpe, ...given, setLogId: s.id }, c);
      if (!done.ok) throw new Error(`${exercise.skillId}: ${done.reason}`);
    }
  }
  return started.sessionId;
}

/** `logDay`, then Finish at 18:00. */
export async function logAndFinish(
  db: Db,
  planId: string,
  date: string,
  ctx: ServiceContext,
  values: DayValues = {},
) {
  const sessionId = await logDay(db, planId, date, ctx, values);
  const finished = await finishSession(db, { sessionId }, on(ctx, date, '18:00'));
  if (!finished.ok) throw new Error(finished.reason);
  return { sessionId, prs: finished.prs };
}
