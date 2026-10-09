// DESIGN §7.3 — the Week screen's calendar weeks and the plan overview grid (FR-8.1, FR-8.2,
// FR-8.4, D-7). Statuses are derived by §3.7; nothing here is stored.
import { addDays, weekday } from './dates';
import { weekPosition } from './schedule/generate';
import { effectiveStatus, type EffectiveStatus } from './schedule/status';
import type { CycleSlot, LocalDate, Phase, Plan, PlannedWorkout } from './types';

type PlanState = Pick<Plan, 'status' | 'pausedOn' | 'endedOn'>;

export interface WorkoutStatus {
  workout: PlannedWorkout;
  status: EffectiveStatus;
}

/** The first day of the calendar week holding `date` (FR-8.1, FR-12.3). */
export function calendarWeekStart(date: LocalDate, weekStart: 0 | 1): LocalDate {
  return addDays(date, -((weekday(date) - weekStart + 7) % 7));
}

export interface CalendarWeekInput {
  /** In schedule order, as the repository returns them. */
  workouts: readonly PlannedWorkout[];
  /** Any day of the week to show. */
  date: LocalDate;
  weekStart: 0 | 1;
  today: LocalDate;
  plan: PlanState;
  inProgressWorkoutId: string | null;
}

export interface CalendarWeek {
  start: LocalDate;
  end: LocalDate;
  /** Seven days from `start`. A day with no workouts is a rest day; with two (D-4), both show. */
  days: { date: LocalDate; workouts: WorkoutStatus[] }[];
  /** The plan weeks of the workouts in view (AC-51), or null when none are. */
  planWeeks: { first: number; last: number } | null;
}

/**
 * A calendar week (FR-8.1). Workouts sit on their scheduled date, so shifted and moved ones show
 * where they now fall, and keep the plan week they belong to (FR-4.9).
 */
export function calendarWeek(input: CalendarWeekInput): CalendarWeek {
  const start = calendarWeekStart(input.date, input.weekStart);
  const end = addDays(start, 6);
  const status = (w: PlannedWorkout) =>
    effectiveStatus(w, input.today, input.plan, w.id === input.inProgressWorkoutId);

  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(start, i);
    return {
      date,
      workouts: input.workouts
        .filter((w) => w.scheduledDate === date)
        .map((workout) => ({ workout, status: status(workout) })),
    };
  });

  const weeks = days.flatMap((d) => d.workouts.map((w) => w.workout.weekIndex));
  return {
    start,
    end,
    days,
    planWeeks: weeks.length ? { first: Math.min(...weeks), last: Math.max(...weeks) } : null,
  };
}

export interface OverviewInput {
  phases: readonly Phase[];
  /** In schedule order, as the repository returns them. */
  workouts: readonly PlannedWorkout[];
  today: LocalDate;
  plan: PlanState;
  inProgressWorkoutId: string | null;
  /** Each slot's column (`slotRanks`). Without it, cells follow schedule order. */
  slotRanks?: ReadonlyMap<string, number>;
}

export interface OverviewRow {
  weekIndex: number;
  phase: Phase;
  cells: WorkoutStatus[];
}

/**
 * Each slot's place within a plan week (§7.3 columns): the days from the plan's start weekday to
 * its pinned day, then its sort order, as generation places them (§3.1). A generated deload slot
 * takes its source slot's day (D-30). Moves change dates but not slots, so a moved workout keeps
 * its column.
 */
export function slotRanks(slots: readonly CycleSlot[], startDate: LocalDate): Map<string, number> {
  const byId = new Map(slots.map((s) => [s.id, s]));
  const first = weekday(startDate);
  return new Map(
    slots.map((s) => {
      const pinned = (s.sourceCycleSlotId && byId.get(s.sourceCycleSlotId)) || s;
      return [s.id, ((pinned.weekday - first + 7) % 7) * 1000 + s.sortOrder];
    }),
  );
}

/**
 * The plan overview grid (FR-8.4, §7.3): a row per plan week, its workouts by slot so each keeps
 * its column. A Test Day has no slot and comes last.
 */
export function planOverview(input: OverviewInput): OverviewRow[] {
  const totalWeeks = input.phases.reduce((sum, p) => sum + p.lengthWeeks, 0);
  const byWeek = new Map<number, { workout: PlannedWorkout; rank: number }[]>();
  input.workouts.forEach((workout, order) => {
    const week = byWeek.get(workout.weekIndex) ?? [];
    week.push({ workout, rank: rankOf(workout, input.slotRanks, order) });
    byWeek.set(workout.weekIndex, week);
  });
  return Array.from({ length: totalWeeks }, (_, i) => {
    const weekIndex = i + 1;
    return {
      weekIndex,
      phase: weekPosition(input.phases, weekIndex).phase,
      cells: (byWeek.get(weekIndex) ?? [])
        .sort((a, b) => a.rank - b.rank)
        .map(({ workout }) => ({
          workout,
          status: effectiveStatus(
            workout,
            input.today,
            input.plan,
            workout.id === input.inProgressWorkoutId,
          ),
        })),
    };
  });
}

/** Without ranks, schedule order; a workout with no ranked slot sorts after every slot. */
function rankOf(
  workout: PlannedWorkout,
  ranks: ReadonlyMap<string, number> | undefined,
  order: number,
): number {
  if (!ranks) return order;
  const rank = workout.cycleSlotId === null ? undefined : ranks.get(workout.cycleSlotId);
  return rank ?? Number.MAX_SAFE_INTEGER;
}
