// A started plan to log sessions against (FR-9, DESIGN §9.2). Full body A is the §7.6 example:
// squat 1RM 125 kg → TM 112.5 kg, so 80% is 90 kg. It also carries a per-side dumbbell press
// (AC-39), a unilateral row with the total convention (AC-55) and a timed plank. Full body B has
// a bench press, a pull-up with added load (AC-40) and a completion-only run (AC-37).
import type { Db } from '@/data/db';
import { startPlan } from '@/services/startPlan';
import type { ServiceContext } from '@/services/context';

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
