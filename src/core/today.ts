// DESIGN §3.3 and §7.2 — what Today shows (FR-7.2, FR-7.4, FR-7.5, FR-7.8; C-9).
import { addDays, weekday } from './dates';
import { prescribedLoadKg, tmKg } from './loads';
import { incrementFor } from './rounding';
import { effectiveStatus, type EffectiveStatus } from './schedule/status';
import type {
  CycleExercise,
  CycleSet,
  IncrementSettings,
  LocalDate,
  PhaseLoadSettings,
  Plan,
  PlannedWorkout,
  Skill,
  Unit,
} from './types';

/** One `one_rep_max_history` row of this plan, as far as §3.3 needs it. */
export interface OneRmRow {
  oneRmKg: number;
  /** D-2: derived; null when it can't apply to a plan week. */
  effectiveFromWeekIndex: number | null;
  setAt: string;
}

/**
 * The 1RM for a cycle (§3.3): among rows effective by the cycle's first week, the highest
 * effective week wins, then the latest `set_at` (C-9). Without one, the starting 1RM.
 */
export function oneRmForCycle(
  rows: readonly OneRmRow[],
  startingOneRmKg: number | null,
  firstWeekOfCycle: number,
): number | null {
  let best: OneRmRow | null = null;
  for (const row of rows) {
    const week = row.effectiveFromWeekIndex;
    if (week === null || week > firstWeekOfCycle) continue;
    const bestWeek = best?.effectiveFromWeekIndex ?? 0;
    if (best === null || week > bestWeek || (week === bestWeek && row.setAt > best.setAt)) {
      best = row;
    }
  }
  return best?.oneRmKg ?? startingOneRmKg;
}

/**
 * §7.2: 40 s per set plus the rest after every set except each exercise's last, rounded to the
 * nearest 5 minutes.
 */
export function estimatedDurationMin(
  exercises: readonly { sets: number; restSec: number }[],
): number {
  const seconds = exercises.reduce(
    (sum, e) => sum + (e.sets > 0 ? e.sets * 40 + (e.sets - 1) * e.restSec : 0),
    0,
  );
  return Math.round(seconds / 60 / 5) * 5;
}

export type TodayCard =
  | { kind: 'no_plan' }
  | { kind: 'in_progress'; workout: PlannedWorkout }
  | { kind: 'workout'; workout: PlannedWorkout }
  | { kind: 'completed'; workout: PlannedWorkout }
  | { kind: 'rest'; next: PlannedWorkout | null };

export interface TodayInput {
  hasPlan: boolean;
  workouts: readonly PlannedWorkout[];
  today: LocalDate;
  inProgressWorkoutId: string | null;
}

/** §7.2: in-progress session → today's workout → completed today → rest day → no plan. */
export function todayCard({
  hasPlan,
  workouts,
  today,
  inProgressWorkoutId,
}: TodayInput): TodayCard {
  if (!hasPlan) return { kind: 'no_plan' };

  const inProgress = workouts.find((w) => w.id === inProgressWorkoutId);
  if (inProgress) return { kind: 'in_progress', workout: inProgress };

  const todays = workouts.filter((w) => w.scheduledDate === today);
  const open = todays.find((w) => w.status === 'upcoming');
  if (open) return { kind: 'workout', workout: open };
  const done = todays.find((w) => w.status === 'completed');
  if (done) return { kind: 'completed', workout: done };

  const next = workouts
    .filter((w) => w.status === 'upcoming' && w.scheduledDate > today)
    .reduce<PlannedWorkout | null>(
      (soonest, w) => (soonest === null || w.scheduledDate < soonest.scheduledDate ? w : soonest),
      null,
    );
  return { kind: 'rest', next };
}

/** What a row needs to know about its skill. */
export type RowSkill = Pick<
  Skill,
  'name' | 'trackingType' | 'loadConvention' | 'loadIncrementKg' | 'loadIncrementLb'
>;

export interface WorkoutRowsInput {
  exercises: readonly { exercise: CycleExercise; sets: readonly CycleSet[] }[];
  skills: ReadonlyMap<string, RowSkill>;
  planSkills: ReadonlyMap<string, { tmPercent: number | null; startingOneRmKg: number | null }>;
  oneRmRows: ReadonlyMap<string, readonly OneRmRow[]>;
  defaultTmPercent: number;
  firstWeekOfCycle: number;
  phase: PhaseLoadSettings;
  unit: Unit;
  increments: IncrementSettings;
  defaultRestSec: number;
}

export interface WorkoutRow {
  exerciseId: string;
  name: string;
  /** Working sets; warm-ups aren't counted. */
  sets: number;
  /** null when the set has neither reps nor a time, e.g. a completion-only item. */
  target: { reps: readonly [number] | readonly [number, number] } | { seconds: number } | null;
  /**
   * null when there is no load to show: tracked without one (time, reps only, completion only), or
   * not calculable yet (no 1RM, or double progression with no history). `kg` is null only for
   * sets prescribed as bodyweight, which show as "BW".
   */
  load: { kg: number | null; perSide: boolean; added: boolean } | null;
  /** The first working set's target RPE; a lone bound is used as both ends (D-36, AC-71). */
  rpe: { min: number; max: number } | null;
  /** A top set's RPE is its prescription and its load a pre-fill (D-19). */
  topSet: boolean;
  restSec: number;
  inSuperset: boolean;
}

const LOADED: ReadonlySet<RowSkill['trackingType']> = new Set([
  'weight_reps',
  'bodyweight_plus_load',
]);

/**
 * Today's exercise list (FR-7.2): working sets × target × calculated load. The target and load
 * come from the first working set; loads follow §3.3 with the cycle's 1RM (C-9). Double
 * progression has no history until Slice 8, so its loads are empty for now.
 */
export function workoutRows(input: WorkoutRowsInput): WorkoutRow[] {
  return input.exercises.map(({ exercise, sets }) => {
    const skill = input.skills.get(exercise.skillId);
    const working = sets.filter((s) => !s.isWarmup);
    const first = working[0];

    let load: WorkoutRow['load'] = null;
    if (skill && first && LOADED.has(skill.trackingType)) {
      const planSkill = input.planSkills.get(exercise.skillId);
      const oneRm = oneRmForCycle(
        input.oneRmRows.get(exercise.skillId) ?? [],
        planSkill?.startingOneRmKg ?? null,
        input.firstWeekOfCycle,
      );
      const needsTm = first.loadType === 'percent_tm' || first.loadType === 'top_set';
      const kg =
        needsTm && oneRm === null
          ? null
          : prescribedLoadKg(first, {
              tmKg:
                oneRm === null ? 0 : tmKg(oneRm, planSkill?.tmPercent ?? input.defaultTmPercent),
              unit: input.unit,
              increment: incrementFor(skill, input.increments, input.unit),
              phase: input.phase,
              dpState: null,
            });
      if (kg !== null || first.loadType === 'bodyweight') {
        load = {
          kg,
          perSide: skill.loadConvention === 'per_side',
          added: skill.trackingType === 'bodyweight_plus_load',
        };
      }
    }

    const target: WorkoutRow['target'] =
      first?.targetTimeSec != null
        ? { seconds: first.targetTimeSec }
        : first?.repsMin != null && first.repsMax != null && first.repsMax !== first.repsMin
          ? { reps: [first.repsMin, first.repsMax] }
          : first?.repsMin != null
            ? { reps: [first.repsMin] }
            : null;

    const rpeMin = first?.targetRpeMin ?? first?.targetRpeMax ?? null;
    const rpeMax = first?.targetRpeMax ?? first?.targetRpeMin ?? null;

    return {
      exerciseId: exercise.id,
      name: skill?.name ?? 'Unknown exercise',
      sets: working.length,
      target,
      load,
      rpe: rpeMin !== null && rpeMax !== null ? { min: rpeMin, max: rpeMax } : null,
      topSet: first?.loadType === 'top_set',
      restSec: exercise.restSec ?? input.defaultRestSec,
      inSuperset: exercise.supersetGroup !== null,
    };
  });
}

export type StripStatus = EffectiveStatus | 'rest';

/**
 * The calendar week around today for the week strip (FR-8.1, §7.2), starting on the week-start
 * day. A day with no workout is a rest day; with two (D-4), the first in date order shows.
 */
export function weekDays(
  workouts: readonly PlannedWorkout[],
  today: LocalDate,
  weekStart: 0 | 1,
  plan: Pick<Plan, 'status' | 'pausedOn' | 'endedOn'>,
  inProgressWorkoutId: string | null,
): { date: LocalDate; status: StripStatus }[] {
  const start = addDays(today, -((weekday(today) - weekStart + 7) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(start, i);
    const workout = workouts.find((w) => w.scheduledDate === date);
    return {
      date,
      status: workout
        ? effectiveStatus(workout, today, plan, workout.id === inProgressWorkoutId)
        : 'rest',
    };
  });
}
