// Development builds only (docs/BUILD_PLAN.md Slice 4): a sample Beginner Strength plan, started
// on this week's Monday, so Today can be checked on a device before templates arrive in Slice 5.
// The Today screen offers it only when `__DEV__` is true, so release builds never call it.
import { addDays, weekday } from '@/core/dates';
import type { CycleSet } from '@/core/types';
import type { Db } from '@/data/db';
import { repositories } from '@/data/repositories';

import { exclusive, type ServiceContext, type ServiceResult } from '../context';
import { insertDeloadTx } from '../insertDeload';
import { startPlanTx } from '../startPlan';

type SetSpec = Partial<Omit<CycleSet, 'id' | 'cycleExerciseId' | 'setIndex'>>;
interface ExerciseSpec {
  skillId: string;
  sets: number;
  set: SetSpec;
  restSec?: number;
}

const main = (skillId: string, sets = 5): ExerciseSpec => ({
  skillId,
  sets,
  set: { repsMin: 5, repsMax: 5, targetRpeMin: 7, targetRpeMax: 8, loadPercent: 0.8 },
  restSec: 180,
});
const accessory = (skillId: string, fixedLoadKg: number): ExerciseSpec => ({
  skillId,
  sets: 3,
  set: { repsMin: 8, repsMax: 12, loadType: 'fixed', loadPercent: null, fixedLoadKg },
});

const WORKOUTS: { name: string; exercises: ExerciseSpec[] }[] = [
  {
    name: 'Full body A',
    exercises: [
      main('skill_back_squat'),
      main('skill_bench_press'),
      accessory('skill_barbell_row', 60),
      {
        skillId: 'skill_plank',
        sets: 3,
        set: {
          repsMin: null,
          repsMax: null,
          loadType: 'bodyweight',
          loadPercent: null,
          targetTimeSec: 45,
        },
      },
    ],
  },
  {
    name: 'Full body B',
    exercises: [
      main('skill_deadlift', 3),
      main('skill_overhead_press'),
      accessory('skill_lat_pulldown', 50),
    ],
  },
];

/** Mon/Wed/Fri, A/B alternating over a 2-week cycle (FR-2.1). */
const SCHEDULE: { week: number; weekday: number; workout: number }[] = [
  { week: 1, weekday: 1, workout: 0 },
  { week: 1, weekday: 3, workout: 1 },
  { week: 1, weekday: 5, workout: 0 },
  { week: 2, weekday: 1, workout: 1 },
  { week: 2, weekday: 3, workout: 0 },
  { week: 2, weekday: 5, workout: 1 },
];

const STARTING_ONE_RM_KG: Record<string, number> = {
  skill_back_squat: 100,
  skill_bench_press: 80,
  skill_deadlift: 140,
  skill_overhead_press: 50,
};

export type LoadSamplePlanResult = ServiceResult<'plan_already_current'>;

export function loadSamplePlan(db: Db, ctx: ServiceContext): Promise<LoadSamplePlanResult> {
  return exclusive(db, async (tx) => {
    const r = repositories(tx);
    if (await r.plans.current()) return { ok: false, reason: 'plan_already_current' };

    const planId = ctx.newId();
    await r.plans.insert({
      id: planId,
      name: 'Sample: Beginner Strength',
      description: 'Development sample plan.',
      sourceTemplateId: null,
      status: 'draft',
      startDate: null,
      defaultTmPercent: 0.9,
      pausedOn: null,
      endedAt: null,
      endedOn: null,
      createdAt: ctx.now,
      updatedAt: ctx.now,
    });

    const phaseId = ctx.newId();
    await r.blueprints.insertPhase({
      id: phaseId,
      templateId: null,
      planId,
      sortOrder: 1,
      name: 'Block 1',
      type: 'training',
      reviewMode: 'every_cycle',
      lengthWeeks: 12,
      cycleLengthWeeks: 2,
      volumeFactor: null,
      loadFactor: null,
      rpeCap: null,
      restDaysAtEnd: null,
      hasTestDay: false,
      generatedFromPhaseId: null,
      continuesPhaseId: null,
      continuesOffsetWeeks: null,
      defaultIncreaseType: 'fixed',
      defaultIncreaseValue: 2.5,
      defaultIncreaseValueLb: 5,
      fallbackIncreaseType: null,
      fallbackIncreaseValue: null,
      fallbackIncreaseValueLb: null,
    });

    const workoutIds: string[] = [];
    for (const [i, workout] of WORKOUTS.entries()) {
      const workoutId = ctx.newId();
      workoutIds.push(workoutId);
      await r.blueprints.insertWorkout({
        id: workoutId,
        phaseId,
        name: workout.name,
        sortOrder: i + 1,
        kind: 'normal',
      });
      for (const [j, spec] of workout.exercises.entries()) {
        const exerciseId = ctx.newId();
        await r.blueprints.insertExercise({
          id: exerciseId,
          cycleWorkoutId: workoutId,
          skillId: spec.skillId,
          sortOrder: j + 1,
          supersetGroup: null,
          restSec: spec.restSec ?? null,
          notes: null,
          sourceCycleExerciseId: null,
        });
        for (let k = 1; k <= spec.sets; k++) {
          await r.blueprints.insertSet({
            id: ctx.newId(),
            cycleExerciseId: exerciseId,
            setIndex: k,
            isWarmup: false,
            repsMin: null,
            repsMax: null,
            isAmrap: false,
            targetRpeMin: null,
            targetRpeMax: null,
            loadType: 'percent_tm',
            loadPercent: null,
            fixedLoadKg: null,
            targetTimeSec: null,
            ...spec.set,
          });
        }
      }
    }

    for (const [i, slot] of SCHEDULE.entries()) {
      await r.blueprints.insertSlot({
        id: ctx.newId(),
        phaseId,
        cycleWorkoutId: workoutIds[slot.workout]!,
        cycleWeekIndex: slot.week,
        weekday: slot.weekday,
        sortOrder: i + 1,
        retiredFromGroupWeek: null,
        sourceCycleSlotId: null,
      });
    }

    for (const [skillId, kg] of Object.entries(STARTING_ONE_RM_KG)) {
      await r.plans.insertSkill({
        id: ctx.newId(),
        planId,
        skillId,
        tmPercent: null,
        startingOneRmKg: kg,
      });
    }

    // Block 1 (6 wk) → Deload (1 wk) → Block 2 (6 wk, continuation), as in FR-2.1.
    const deload = await insertDeloadTx(tx, { planId, afterWeek: 6 }, ctx);
    if (!deload.ok || !deload.continuationPhaseId) throw new Error('Sample plan deload failed');
    await r.blueprints.updatePhase(deload.continuationPhaseId, { name: 'Block 2' });

    const monday = addDays(ctx.today, -((weekday(ctx.today) + 6) % 7));
    const started = await startPlanTx(tx, { planId, startDate: monday }, ctx);
    if (!started.ok) throw new Error(`Sample plan didn't start: ${started.reason}`);
    return { ok: true };
  });
}
