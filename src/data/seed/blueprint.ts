// Building blueprint rows for built-in content (DESIGN §4.6, D-37).
//
// A blueprint belongs to exactly one template or one plan (§4.1), and the tables are the same for
// both, so a declarative spec is turned into rows here and written once. Rows are built in memory
// first, which lets the deload week be generated from them before anything is stored.
//
// This is the one file under `src/data` that calls `src/core` at runtime rather than importing
// types only (D-37): a template ships its deload as rows, and `insertDeload` is plan-only (D-23).
import { generateDeload, planDraftDeloadInsert } from '@/core/deload';
import type {
  CycleExercise,
  CycleSet,
  CycleSlot,
  CycleWorkout,
  IncreaseRule,
  Phase,
  WorkoutKind,
} from '@/core/types';

import type { Orm } from '../orm';
import { cycleExercise, cycleSet, cycleSlot, cycleWorkout, increaseRule, phase } from '../schema';

export type SetSpec = Partial<Omit<CycleSet, 'id' | 'cycleExerciseId' | 'setIndex'>>;

export interface ExerciseSpec {
  skillId: string;
  restSec?: number;
  sets: SetSpec[];
}

export interface WorkoutSpec {
  name: string;
  kind?: WorkoutKind;
  exercises: ExerciseSpec[];
}

/** One appearance of a workout, by name, on a weekday of a cycle week (D-20). */
export interface SlotSpec {
  cycleWeekIndex: number;
  /** 0 Sunday … 6 Saturday. */
  weekday: number;
  workout: string;
}

export interface PhaseSpec {
  phase: Partial<Omit<Phase, 'id' | 'templateId' | 'planId' | 'sortOrder'>> & { name: string };
  workouts: WorkoutSpec[];
  slots: SlotSpec[];
  /** Per-skill overrides of the phase's rule, e.g. +5 kg lower body (FR-3.5 beginner note). */
  increaseRules?: Omit<IncreaseRule, 'id' | 'phaseId'>[];
}

/** A blueprint belongs to exactly one template or one plan (DESIGN §4.1). */
export type BlueprintOwner =
  { templateId: string; planId?: never } | { planId: string; templateId?: never };

export interface BlueprintRows {
  phases: Phase[];
  increaseRules: IncreaseRule[];
  workouts: CycleWorkout[];
  exercises: CycleExercise[];
  sets: CycleSet[];
  slots: CycleSlot[];
}

const PHASE_DEFAULTS = {
  type: 'training',
  reviewMode: 'every_cycle',
  lengthWeeks: 6,
  cycleLengthWeeks: 2,
  volumeFactor: null,
  loadFactor: null,
  rpeCap: null,
  restDaysAtEnd: null,
  hasTestDay: false,
  generatedFromPhaseId: null,
  continuesPhaseId: null,
  continuesOffsetWeeks: null,
  defaultIncreaseType: 'percent',
  defaultIncreaseValue: 0.025,
  defaultIncreaseValueLb: null,
  fallbackIncreaseType: null,
  fallbackIncreaseValue: null,
  fallbackIncreaseValueLb: null,
} as const satisfies Omit<Phase, 'id' | 'templateId' | 'planId' | 'sortOrder' | 'name'>;

const SET_DEFAULTS = {
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
} as const satisfies Omit<CycleSet, 'id' | 'cycleExerciseId' | 'setIndex'>;

/** Turns phase specs into rows, in phase order. Nothing is written. */
export function buildBlueprint(
  owner: BlueprintOwner,
  specs: readonly PhaseSpec[],
  newId: () => string,
): BlueprintRows {
  const rows: BlueprintRows = {
    phases: [],
    increaseRules: [],
    workouts: [],
    exercises: [],
    sets: [],
    slots: [],
  };

  for (const [i, spec] of specs.entries()) {
    const phaseId = newId();
    rows.phases.push({
      ...PHASE_DEFAULTS,
      ...spec.phase,
      id: phaseId,
      templateId: owner.templateId ?? null,
      planId: owner.planId ?? null,
      sortOrder: i + 1,
    });

    for (const rule of spec.increaseRules ?? []) {
      rows.increaseRules.push({ ...rule, id: newId(), phaseId });
    }

    const workoutIds = new Map<string, string>();
    for (const [j, workout] of spec.workouts.entries()) {
      const workoutId = newId();
      workoutIds.set(workout.name, workoutId);
      rows.workouts.push({
        id: workoutId,
        phaseId,
        name: workout.name,
        sortOrder: j + 1,
        kind: workout.kind ?? 'normal',
      });

      for (const [k, exercise] of workout.exercises.entries()) {
        const exerciseId = newId();
        rows.exercises.push({
          id: exerciseId,
          cycleWorkoutId: workoutId,
          skillId: exercise.skillId,
          sortOrder: k + 1,
          supersetGroup: null,
          restSec: exercise.restSec ?? null,
          notes: null,
          sourceCycleExerciseId: null,
        });
        for (const [n, set] of exercise.sets.entries()) {
          rows.sets.push({
            ...SET_DEFAULTS,
            ...set,
            id: newId(),
            cycleExerciseId: exerciseId,
            setIndex: n + 1,
          });
        }
      }
    }

    for (const [j, slot] of spec.slots.entries()) {
      const cycleWorkoutId = workoutIds.get(slot.workout);
      if (!cycleWorkoutId) throw new Error(`Unknown workout in schedule: ${slot.workout}`);
      rows.slots.push({
        id: newId(),
        phaseId,
        cycleWorkoutId,
        cycleWeekIndex: slot.cycleWeekIndex,
        weekday: slot.weekday,
        sortOrder: j + 1,
        retiredFromGroupWeek: null,
        sourceCycleSlotId: null,
      });
    }
  }

  return rows;
}

/**
 * Splits a training phase after `afterWeek` and generates the deload week between the two halves
 * (FR-2.11, FR-2.12, D-1). The second half continues the first, so cycle numbering carries on
 * (D-14). This is the same core pair `insertDeload` uses, so a built-in template's deload and one
 * the user inserts are generated by one algorithm.
 */
export function withDeload(
  rows: BlueprintRows,
  afterWeek: number,
  lengthWeeks: number,
  newId: () => string,
): BlueprintRows {
  const planned = planDraftDeloadInsert(rows.phases, afterWeek, lengthWeeks, newId);
  if (!planned.ok)
    throw new Error(`Deload after week ${afterWeek} was rejected: ${planned.reason}`);

  const sourceWorkouts = rows.workouts.filter((w) => w.phaseId === planned.sourcePhaseId);
  const sourceIds = new Set(sourceWorkouts.map((w) => w.id));
  const sourceExercises = rows.exercises.filter((e) => sourceIds.has(e.cycleWorkoutId));
  const exerciseIds = new Set(sourceExercises.map((e) => e.id));
  const content = generateDeload(
    {
      workouts: sourceWorkouts,
      slots: rows.slots.filter((s) => s.phaseId === planned.sourcePhaseId),
      exercises: sourceExercises,
      sets: rows.sets.filter((s) => exerciseIds.has(s.cycleExerciseId)),
    },
    planned.deload.id,
    // The stored phase's factors, so the phase row and its generated sets can't disagree.
    { volumeFactor: planned.deload.volumeFactor!, rpeCap: planned.deload.rpeCap! },
    newId,
  );

  return {
    // `planned.phases` is the whole list, re-sorted, with the split phase already shortened.
    phases: planned.phases,
    increaseRules: rows.increaseRules,
    workouts: [...rows.workouts, ...content.workouts],
    exercises: [...rows.exercises, ...content.exercises],
    sets: [...rows.sets, ...content.sets],
    slots: [...rows.slots, ...content.slots],
  };
}

/**
 * Writes a blueprint, parents before children. Conflicts are ignored so that re-running the seed
 * over stable IDs is a no-op (DESIGN §4.6).
 */
export async function writeBlueprint(o: Orm, rows: BlueprintRows): Promise<void> {
  if (rows.phases.length > 0) await o.insert(phase).values(rows.phases).onConflictDoNothing();
  if (rows.increaseRules.length > 0) {
    await o.insert(increaseRule).values(rows.increaseRules).onConflictDoNothing();
  }
  if (rows.workouts.length > 0) {
    await o.insert(cycleWorkout).values(rows.workouts).onConflictDoNothing();
  }
  if (rows.exercises.length > 0) {
    await o.insert(cycleExercise).values(rows.exercises).onConflictDoNothing();
  }
  if (rows.sets.length > 0) await o.insert(cycleSet).values(rows.sets).onConflictDoNothing();
  if (rows.slots.length > 0) await o.insert(cycleSlot).values(rows.slots).onConflictDoNothing();
}
