// Today's view-model (FR-7, DESIGN §7.2): the card to show, plus the plan header, ribbon,
// progress meter and week strip. All the maths is in src/core; this reads and assembles.
import {
  cycleFirstWeek,
  estimatedDurationMin,
  progress,
  todayCard,
  weekDays,
  weekPosition,
  workoutRows,
  type LocalDate,
  type OneRmRow,
  type PhaseType,
  type PlanProgress,
  type PlannedWorkout,
  type StripStatus,
  type Unit,
  type WorkoutRow,
} from '@/core';
import type { Db } from '@/data/db';
import { repositories, type Repositories } from '@/data/repositories';
import { today as clockToday } from '@/services/clock';

import { useLiveQuery } from './useLiveQuery';

export type TodayCardView =
  | { kind: 'no_plan' }
  | {
      kind: 'workout' | 'in_progress' | 'completed';
      name: string;
      durationMin: number;
      rows: WorkoutRow[];
    }
  | { kind: 'rest'; next: { name: string; date: LocalDate } | null };

export interface TodayPlanView {
  /** "Strength · Cycle 4 · Week 9 of 13" (FR-7.2). */
  header: string;
  ribbon: { name: string; type: PhaseType; weeks: number }[];
  currentWeek: number;
  progress: Pick<PlanProgress, 'currentWeek' | 'totalWeeks' | 'pctSessions' | 'adherence'>;
  week: { date: LocalDate; status: StripStatus }[];
}

export type TodayView =
  | { status: 'loading' }
  | { status: 'failed'; error: Error }
  | { status: 'ready'; unit: Unit; card: TodayCardView; plan: TodayPlanView | null };

/** `today` is injectable for tests; the app reads the device clock. */
export function useToday(today: LocalDate = clockToday()): TodayView {
  const view = useLiveQuery((db) => readToday(db, today), [today]);
  if (view.status === 'loading') return view;
  if (view.status === 'failed') return view;
  return { status: 'ready', ...view.data };
}

async function readToday(
  db: Db,
  today: LocalDate,
): Promise<{ unit: Unit; card: TodayCardView; plan: TodayPlanView | null }> {
  const r = repositories(db);
  const [settings, plan] = await Promise.all([r.settings.get(), r.plans.current()]);
  if (!plan) return { unit: settings.unit, card: { kind: 'no_plan' }, plan: null };

  const [phases, workouts] = await Promise.all([
    r.blueprints.phasesOfPlan(plan.id),
    r.plannedWorkouts.listByPlan(plan.id),
  ]);
  // Sessions arrive in Slice 6; until then nothing is in progress.
  const inProgressWorkoutId = null;
  const card = todayCard({ hasPlan: true, workouts, today, inProgressWorkoutId });
  const planProgress = progress(phases, workouts, today, plan);
  const position = weekPosition(phases, planProgress.currentWeek);

  const planView: TodayPlanView = {
    header: `${position.phase.name} · Cycle ${position.phaseCycleIndex} · Week ${position.weekIndex} of ${position.totalWeeks}`,
    ribbon: phases.map((p) => ({ name: p.name, type: p.type, weeks: p.lengthWeeks })),
    currentWeek: planProgress.currentWeek,
    progress: planProgress,
    week: weekDays(workouts, today, settings.weekStart, plan, inProgressWorkoutId),
  };

  let cardView: TodayCardView;
  if (card.kind === 'no_plan') {
    cardView = card;
  } else if (card.kind === 'rest') {
    cardView = {
      kind: 'rest',
      next: card.next
        ? { name: await workoutName(r, card.next), date: card.next.scheduledDate }
        : null,
    };
  } else {
    const workout = card.workout;
    const blueprint = await r.blueprints.loadBlueprint(workout.cycleGroupId);
    const planned = blueprint?.workouts.find((w) => w.workout.id === workout.cycleWorkoutId);
    const exercises = planned?.exercises ?? [];
    const skillIds = [...new Set(exercises.map((e) => e.exercise.skillId))];
    const [skills, planSkills, oneRms] = await Promise.all([
      r.skills.getMany(skillIds),
      r.plans.skills(plan.id),
      r.oneRepMax.listByPlan(plan.id),
    ]);
    const phase = phases.find((p) => p.id === workout.phaseId);
    const rows = workoutRows({
      exercises,
      skills: new Map(skills.map((s) => [s.id, s])),
      planSkills: new Map(planSkills.map((s) => [s.skillId, s])),
      oneRmRows: groupBySkill(oneRms),
      defaultTmPercent: plan.defaultTmPercent,
      firstWeekOfCycle: cycleFirstWeek(phases, workout.weekIndex),
      phase: { type: phase?.type ?? 'training', loadFactor: phase?.loadFactor ?? null },
      unit: settings.unit,
      increments: settings,
      defaultRestSec: settings.defaultRestSec,
    });
    cardView = {
      kind: card.kind,
      name: planned?.workout.name ?? 'Workout',
      durationMin: estimatedDurationMin(rows),
      rows,
    };
  }

  return { unit: settings.unit, card: cardView, plan: planView };
}

async function workoutName(r: Repositories, workout: PlannedWorkout): Promise<string> {
  const blueprint = await r.blueprints.loadBlueprint(workout.cycleGroupId);
  return (
    blueprint?.workouts.find((w) => w.workout.id === workout.cycleWorkoutId)?.workout.name ??
    'Workout'
  );
}

function groupBySkill(rows: readonly (OneRmRow & { skillId: string })[]) {
  const bySkill = new Map<string, OneRmRow[]>();
  for (const row of rows) bySkill.set(row.skillId, [...(bySkill.get(row.skillId) ?? []), row]);
  return bySkill;
}
