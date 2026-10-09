// The Week tab's view-models (FR-8, D-7, DESIGN §7.3): a calendar week, Workout detail and the plan
// overview grid. The maths is in src/core; this reads and assembles.
import {
  addDays,
  calendarWeek,
  effectiveStatus,
  estimatedDurationMin,
  planOverview,
  progress,
  slotRanks,
  weekPosition,
  type EffectiveStatus,
  type LocalDate,
  type Phase,
  type PhaseType,
  type PlanProgress,
  type Unit,
  type WorkoutRow,
} from '@/core';
import type { Db } from '@/data/db';
import { repositories } from '@/data/repositories';
import { today as clockToday } from '@/services/clock';

import { positionLabel, readWorkoutRows, workoutNames } from './plannedWorkout';
import { useLiveQuery } from './useLiveQuery';

type Loaded<T> = { status: 'loading' } | { status: 'failed'; error: Error } | T;

export interface WeekWorkoutView {
  workoutId: string;
  name: string;
  status: EffectiveStatus;
}

export interface WeekScreenView {
  planId: string;
  range: { start: LocalDate; end: LocalDate };
  isThisWeek: boolean;
  /** "Plan week 9", or "Plan weeks 1–2" when the week spans two (AC-51); null when none show. */
  header: string | null;
  /** "Strength · Cycle 4 (week B)" for the first plan week in view; null when none show. */
  footer: string | null;
  days: { date: LocalDate; workouts: WeekWorkoutView[] }[];
}

/** Null when there is no plan (FR-7.8). */
export type WeekView = Loaded<{ status: 'ready'; week: WeekScreenView | null }>;

/**
 * The calendar week `offset` weeks from this one (FR-8.1, FR-8.2). `today` is injectable for
 * tests; the app reads the device clock.
 */
export function useWeek(offset: number, today: LocalDate = clockToday()): WeekView {
  const view = useLiveQuery((db) => readWeek(db, offset, today), [offset, today]);
  if (view.status !== 'ready') return view;
  return { status: 'ready', week: view.data };
}

async function readWeek(db: Db, offset: number, today: LocalDate): Promise<WeekScreenView | null> {
  const r = repositories(db);
  const [settings, plan, session] = await Promise.all([
    r.settings.get(),
    r.plans.current(),
    r.sessions.inProgress(),
  ]);
  if (!plan) return null;
  const [phases, workouts] = await Promise.all([
    r.blueprints.phasesOfPlan(plan.id),
    r.plannedWorkouts.listByPlan(plan.id),
  ]);
  const week = calendarWeek({
    workouts,
    date: addDays(today, 7 * offset),
    weekStart: settings.weekStart,
    today,
    plan,
    inProgressWorkoutId: session?.plannedWorkoutId ?? null,
  });
  const names = await workoutNames(
    r,
    week.days.flatMap((d) => d.workouts.map((w) => w.workout)),
  );
  const weeks = week.planWeeks;
  return {
    planId: plan.id,
    range: { start: week.start, end: week.end },
    isThisWeek: offset === 0,
    header: !weeks
      ? null
      : weeks.first === weeks.last
        ? `Plan week ${weeks.first}`
        : `Plan weeks ${weeks.first}–${weeks.last}`,
    footer: weeks ? cycleLabel(phases, weeks.first) : null,
    days: week.days.map((d) => ({
      date: d.date,
      workouts: d.workouts.map(({ workout, status }) => ({
        workoutId: workout.id,
        name: names.get(workout.cycleWorkoutId) ?? 'Workout',
        status,
      })),
    })),
  };
}

/**
 * §7.3's footer: a training week by its cycle, with the cycle week's letter when a cycle has more
 * than one week; a deload or taper week by its phase.
 */
function cycleLabel(phases: readonly Phase[], weekIndex: number): string {
  const position = weekPosition(phases, weekIndex);
  if (position.phase.type !== 'training') return position.phase.name;
  const cycleLength = phases.find((p) => p.id === position.cycleGroupId)?.cycleLengthWeeks ?? 1;
  const letter = String.fromCharCode(64 + position.cycleWeekIndex);
  return `${position.phase.name} · Cycle ${position.phaseCycleIndex}${cycleLength > 1 ? ` (week ${letter})` : ''}`;
}

const OPEN: ReadonlySet<EffectiveStatus> = new Set([
  'upcoming',
  'today',
  'missed',
  'in_progress',
  'paused',
]);

export interface WorkoutDetailView {
  workoutId: string;
  name: string;
  date: LocalDate;
  status: EffectiveStatus;
  /** "Strength · Cycle 4 · Week 9 of 13", as on Today (FR-7.2). */
  context: string;
  unit: Unit;
  /** What to do, with today's loads; empty once the workout is done (its session has the log). */
  rows: WorkoutRow[];
  durationMin: number;
  /** The finished workout's session, or the one under way, to open. */
  sessionId: string | null;
  /** Only today's workout starts here (FR-9.1); a missed one waits for FR-7.6's options. */
  canStart: boolean;
}

/** Null when the workout no longer exists. */
export type WorkoutDetailScreenView = Loaded<{
  status: 'ready';
  detail: WorkoutDetailView | null;
}>;

/** Workout detail (§7.3), opened from a day on the Week tab or a cell of the plan overview. */
export function useWorkoutDetail(
  plannedWorkoutId: string,
  today: LocalDate = clockToday(),
): WorkoutDetailScreenView {
  const view = useLiveQuery(
    (db) => readWorkoutDetail(db, plannedWorkoutId, today),
    [plannedWorkoutId, today],
  );
  if (view.status !== 'ready') return view;
  return { status: 'ready', detail: view.data };
}

async function readWorkoutDetail(
  db: Db,
  plannedWorkoutId: string,
  today: LocalDate,
): Promise<WorkoutDetailView | null> {
  const r = repositories(db);
  const workout = await r.plannedWorkouts.get(plannedWorkoutId);
  if (!workout) return null;
  const [settings, plan, phases, session] = await Promise.all([
    r.settings.get(),
    r.plans.get(workout.planId),
    r.blueprints.phasesOfPlan(workout.planId),
    r.sessions.inProgress(),
  ]);
  if (!plan) return null;
  const inProgress = session?.plannedWorkoutId === workout.id ? session : null;
  const status = effectiveStatus(workout, today, plan, inProgress !== null);
  const { name, rows } = await readWorkoutRows(r, plan, phases, settings, workout);
  // Rows are worked out from today's 1RMs and progression, so they describe a workout still to
  // do. A finished one's loads are in its session (View session), and nothing is waiting to be
  // lifted on one that's done, skipped or left when the plan ended.
  const open = OPEN.has(status);
  return {
    workoutId: workout.id,
    name,
    date: workout.scheduledDate,
    status,
    context: positionLabel(weekPosition(phases, workout.weekIndex)),
    unit: settings.unit,
    rows:
      status === 'completed' ? [] : open ? rows : rows.map((row) => ({ ...row, increased: false })),
    durationMin: estimatedDurationMin(rows),
    sessionId: inProgress?.id ?? (status === 'completed' ? workout.sessionId : null),
    canStart: status === 'today',
  };
}

export interface OverviewCellView {
  workoutId: string;
  name: string;
  date: LocalDate;
  status: EffectiveStatus;
}

export interface OverviewRowView {
  weekIndex: number;
  /** Index into `ribbon`, for the row's phase colour (§7.3). */
  phaseIndex: number;
  /** "Deload" or "Taper"; training weeks have none. */
  label: string | null;
  cells: OverviewCellView[];
}

export interface PlanOverviewView {
  name: string;
  ribbon: { name: string; type: PhaseType; weeks: number }[];
  progress: Pick<
    PlanProgress,
    'currentWeek' | 'totalWeeks' | 'pctSessions' | 'adherence' | 'completed' | 'total'
  >;
  rows: OverviewRowView[];
}

/** Null when the plan no longer exists. */
export type PlanOverviewScreenView = Loaded<{ status: 'ready'; overview: PlanOverviewView | null }>;

const ROW_LABEL: Record<PhaseType, string | null> = {
  training: null,
  deload: 'Deload',
  taper: 'Taper',
};

/** The full plan overview (FR-8.4) with the full progress meter (FR-8.3). */
export function usePlanOverview(
  planId: string,
  today: LocalDate = clockToday(),
): PlanOverviewScreenView {
  const view = useLiveQuery((db) => readPlanOverview(db, planId, today), [planId, today]);
  if (view.status !== 'ready') return view;
  return { status: 'ready', overview: view.data };
}

async function readPlanOverview(
  db: Db,
  planId: string,
  today: LocalDate,
): Promise<PlanOverviewView | null> {
  const r = repositories(db);
  const [plan, phases, workouts, session, slots] = await Promise.all([
    r.plans.get(planId),
    r.blueprints.phasesOfPlan(planId),
    r.plannedWorkouts.listByPlan(planId),
    r.sessions.inProgress(),
    r.blueprints.slotsOfPlan(planId),
  ]);
  if (!plan || phases.length === 0) return null;
  const inProgressWorkoutId = session?.plannedWorkoutId ?? null;
  const names = await workoutNames(r, workouts);
  const rows = planOverview({
    phases,
    workouts,
    today,
    plan,
    inProgressWorkoutId,
    slotRanks: plan.startDate ? slotRanks(slots, plan.startDate) : undefined,
  });
  return {
    name: plan.name,
    ribbon: phases.map((p) => ({ name: p.name, type: p.type, weeks: p.lengthWeeks })),
    progress: progress(
      phases,
      workouts,
      today,
      plan,
      new Set(inProgressWorkoutId ? [inProgressWorkoutId] : []),
    ),
    rows: rows.map((row) => ({
      weekIndex: row.weekIndex,
      phaseIndex: phases.findIndex((p) => p.id === row.phase.id),
      label: ROW_LABEL[row.phase.type],
      cells: row.cells.map(({ workout, status }) => ({
        workoutId: workout.id,
        name: names.get(workout.cycleWorkoutId) ?? 'Workout',
        date: workout.scheduledDate,
        status,
      })),
    })),
  };
}
