// Plan builders for tests (DESIGN §9.2). They write through the real repositories, so a built
// plan passes the same constraints as one made in the app.
//
//   aPlan().startingOn('2026-09-14').withPhase(strength({ weeks: 12, cycle: 2 }))
//     .withWorkouts('Full body A', 'Full body B')
//     .withExercises('Full body A', [{ skill: 'skill_back_squat', sets: sets(4, { ... }) }])
//     .withSchedule({ A: { Mon: 'Full body A', Wed: 'Full body B', Fri: 'Full body A' },
//                     B: { Mon: 'Full body B', Wed: 'Full body A', Fri: 'Full body B' } })
//     .withOneRm('skill_back_squat', 110)
//     .build(db)
import type { CycleSet, LocalDate, Phase, Plan, PlanStatus } from '@/core/types';
import type { Db } from '@/data/db';
import { repositories } from '@/data/repositories';

const NOW = '2026-09-14T08:00:00.000Z';

/** Weekday names for schedules, numbered like `cycle_slot.weekday` (0 Sunday). */
export const WEEKDAY = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 } as const;
export type Day = keyof typeof WEEKDAY;

/** Cycle weeks by letter: A is cycle week 1, B is 2, … */
export type CycleWeekLetter = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H';
export type Schedule = Partial<Record<CycleWeekLetter, Partial<Record<Day, string>>>>;

export type PhaseSpec = Partial<Omit<Phase, 'id' | 'planId' | 'templateId'>>;
export type SetSpec = Partial<Omit<CycleSet, 'id' | 'cycleExerciseId' | 'setIndex'>>;
export interface ExerciseSpec {
  skill: string;
  sets: SetSpec[];
}

/** A training phase with every-cycle reviews, like a beginner template's block. */
export function strength({ weeks, cycle }: { weeks: number; cycle: number }): PhaseSpec {
  return {
    name: 'Block 1',
    type: 'training',
    reviewMode: 'every_cycle',
    lengthWeeks: weeks,
    cycleLengthWeeks: cycle,
    defaultIncreaseType: 'fixed',
    defaultIncreaseValue: 2.5,
    defaultIncreaseValueLb: 5,
  };
}

/** `n` identical working sets: 5 reps at 75% TM, RPE 7–8, unless overridden. */
export function sets(n: number, over: SetSpec = {}): SetSpec[] {
  return Array.from({ length: n }, () => ({ ...over }));
}

/** A top set (D-19): 1–3 reps at RPE 8, pre-filled at 97.5% TM. */
export function topSet(over: SetSpec = {}): SetSpec {
  return {
    loadType: 'top_set',
    loadPercent: 0.975,
    repsMin: 1,
    repsMax: 3,
    targetRpeMin: 8,
    targetRpeMax: 8,
    ...over,
  };
}

const letterIndex = (letter: CycleWeekLetter) => 'ABCDEFGH'.indexOf(letter) + 1;

export interface BuiltPlan {
  planId: string;
  phaseId: string;
  /** By workout name. */
  workoutIds: Record<string, string>;
  /** By cycle week letter, then weekday. */
  slotIds: Partial<Record<CycleWeekLetter, Partial<Record<Day, string>>>>;
  /** By workout name, in order. */
  exerciseIds: Record<string, string[]>;
}

class PlanBuilder {
  private phaseSpec: PhaseSpec = strength({ weeks: 12, cycle: 2 });
  private startDate: LocalDate | null = null;
  private status: PlanStatus = 'draft';
  private workouts: string[] = [];
  private exercises = new Map<string, ExerciseSpec[]>();
  private schedule: Schedule = {};
  private oneRms = new Map<string, number>();

  constructor(private readonly id: string) {}

  startingOn(date: LocalDate): this {
    this.startDate = date;
    return this;
  }

  withStatus(status: PlanStatus): this {
    this.status = status;
    return this;
  }

  withPhase(spec: PhaseSpec): this {
    this.phaseSpec = spec;
    return this;
  }

  withWorkouts(...names: string[]): this {
    this.workouts = names;
    return this;
  }

  withExercises(workout: string, exercises: ExerciseSpec[]): this {
    this.exercises.set(workout, exercises);
    return this;
  }

  withSchedule(schedule: Schedule): this {
    this.schedule = schedule;
    return this;
  }

  withOneRm(skillId: string, kg: number): this {
    this.oneRms.set(skillId, kg);
    return this;
  }

  async build(db: Db): Promise<BuiltPlan> {
    const r = repositories(db);
    const id = this.id;
    const plan: Plan = {
      id,
      name: 'Test plan',
      description: '',
      sourceTemplateId: null,
      status: this.status,
      startDate: this.startDate,
      defaultTmPercent: 0.9,
      pausedOn: null,
      endedAt: null,
      endedOn: null,
      createdAt: NOW,
      updatedAt: NOW,
    };
    await r.plans.insert(plan);

    const phaseId = `${id}:block1`;
    await r.blueprints.insertPhase({
      id: phaseId,
      templateId: null,
      planId: id,
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
      defaultIncreaseType: 'percent',
      defaultIncreaseValue: 0.025,
      defaultIncreaseValueLb: null,
      fallbackIncreaseType: null,
      fallbackIncreaseValue: null,
      fallbackIncreaseValueLb: null,
      ...this.phaseSpec,
    });

    const workoutIds: Record<string, string> = {};
    const exerciseIds: Record<string, string[]> = {};
    for (const [i, name] of this.workouts.entries()) {
      const workoutId = `${id}:w${i + 1}`;
      workoutIds[name] = workoutId;
      await r.blueprints.insertWorkout({
        id: workoutId,
        phaseId,
        name,
        sortOrder: i + 1,
        kind: 'normal',
      });

      exerciseIds[name] = [];
      for (const [j, ex] of (this.exercises.get(name) ?? []).entries()) {
        const exerciseId = `${workoutId}:e${j + 1}`;
        exerciseIds[name].push(exerciseId);
        await r.blueprints.insertExercise({
          id: exerciseId,
          cycleWorkoutId: workoutId,
          skillId: ex.skill,
          sortOrder: j + 1,
          supersetGroup: null,
          restSec: null,
          notes: null,
          sourceCycleExerciseId: null,
        });
        for (const [k, s] of ex.sets.entries()) {
          await r.blueprints.insertSet({
            id: `${exerciseId}:s${k + 1}`,
            cycleExerciseId: exerciseId,
            setIndex: k + 1,
            isWarmup: false,
            repsMin: 5,
            repsMax: 5,
            isAmrap: false,
            targetRpeMin: 7,
            targetRpeMax: 8,
            loadType: 'percent_tm',
            loadPercent: 0.75,
            fixedLoadKg: null,
            targetTimeSec: null,
            ...s,
          });
        }
      }
    }

    const slotIds: BuiltPlan['slotIds'] = {};
    for (const [letter, days] of Object.entries(this.schedule) as [
      CycleWeekLetter,
      Partial<Record<Day, string>>,
    ][]) {
      slotIds[letter] = {};
      for (const [day, workoutName] of Object.entries(days) as [Day, string][]) {
        const workoutId = workoutIds[workoutName];
        if (!workoutId) throw new Error(`Unknown workout in schedule: ${workoutName}`);
        const slotId = `${id}:${letter}-${day}`;
        slotIds[letter][day] = slotId;
        await r.blueprints.insertSlot({
          id: slotId,
          phaseId,
          cycleWorkoutId: workoutId,
          cycleWeekIndex: letterIndex(letter),
          weekday: WEEKDAY[day],
          sortOrder: WEEKDAY[day],
          retiredFromGroupWeek: null,
        });
      }
    }

    for (const [skillId, kg] of this.oneRms) {
      await r.plans.insertSkill({
        id: `${id}:ps:${skillId}`,
        planId: id,
        skillId,
        tmPercent: null,
        startingOneRmKg: kg,
      });
    }

    return { planId: id, phaseId, workoutIds, slotIds, exerciseIds };
  }
}

export function aPlan(id = 'plan'): PlanBuilder {
  return new PlanBuilder(id);
}

/** Mon/Wed/Fri full-body A/B alternating (FR-2.1 beginner templates). */
export const FULL_BODY_AB: Schedule = {
  A: { Mon: 'Full body A', Wed: 'Full body B', Fri: 'Full body A' },
  B: { Mon: 'Full body B', Wed: 'Full body A', Fri: 'Full body B' },
};
