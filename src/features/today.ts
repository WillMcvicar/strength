// Today's view-model (FR-7, DESIGN §7.2): the card to show, plus the plan header, ribbon,
// progress meter and week strip. All the maths is in src/core; this reads and assembles.
import { useCallback, useState } from 'react';

import {
  cycleFirstWeek,
  estimatedDurationMin,
  progress,
  sessionTotals,
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
import { startAdHocSession } from '@/services/startAdHocSession';
import { startSession, type StartSessionError } from '@/services/startSession';

import { secondsBetween } from './device';
import { useDb } from './database';
import { readSessionPrs, type SessionPrsView } from './prs';
import { serviceContext } from './serviceContext';
import { useLiveQuery } from './useLiveQuery';

/** A workout done today (FR-7.5, §7.2): its summary and PR chips, opening to History. */
export interface CompletedSessionView {
  sessionId: string;
  durationMin: number;
  setsCompleted: number;
  volumeKg: number;
  prs: SessionPrsView;
}

export type TodayCardView =
  | { kind: 'no_plan' }
  | {
      kind: 'completed';
      workoutId: string;
      name: string;
      /** Null only if its session has gone missing. */
      session: CompletedSessionView | null;
    }
  | {
      kind: 'workout' | 'in_progress';
      /** The planned workout, which "Start workout" starts (FR-9.1). */
      workoutId: string;
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

/** A session in progress, planned or ad hoc: Today offers "Resume" (§7.2, FR-9.10). */
export interface InProgressView {
  sessionId: string;
  name: string;
  startedAt: string;
}

export type TodayView =
  | { status: 'loading' }
  | { status: 'failed'; error: Error }
  | {
      status: 'ready';
      unit: Unit;
      card: TodayCardView;
      plan: TodayPlanView | null;
      inProgress: InProgressView | null;
    };

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
): Promise<Omit<Extract<TodayView, { status: 'ready' }>, 'status'>> {
  const r = repositories(db);
  const [settings, plan, session] = await Promise.all([
    r.settings.get(),
    r.plans.current(),
    r.sessions.inProgress(),
  ]);
  const inProgress = session
    ? { sessionId: session.id, name: session.name, startedAt: session.startedAt }
    : null;
  if (!plan) return { unit: settings.unit, card: { kind: 'no_plan' }, plan: null, inProgress };

  const [phases, workouts] = await Promise.all([
    r.blueprints.phasesOfPlan(plan.id),
    r.plannedWorkouts.listByPlan(plan.id),
  ]);
  const inProgressWorkoutId = session?.plannedWorkoutId ?? null;
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
  } else if (card.kind === 'completed') {
    cardView = {
      kind: 'completed',
      workoutId: card.workout.id,
      name: await workoutName(r, card.workout),
      session: card.workout.sessionId ? await completedSession(r, card.workout.sessionId) : null,
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
      workoutId: workout.id,
      name: planned?.workout.name ?? 'Workout',
      durationMin: estimatedDurationMin(rows),
      rows,
    };
  }

  return { unit: settings.unit, card: cardView, plan: planView, inProgress };
}

async function completedSession(
  r: Repositories,
  sessionId: string,
): Promise<CompletedSessionView | null> {
  const session = await r.sessions.get(sessionId);
  if (!session?.endedAt) return null;
  const [logged, prs] = await Promise.all([
    r.sessions.exercises(sessionId),
    readSessionPrs(r, sessionId),
  ]);
  const totals = sessionTotals(logged);
  return {
    sessionId,
    durationMin: Math.round(secondsBetween(session.startedAt, session.endedAt) / 60),
    setsCompleted: totals.setsCompleted,
    volumeKg: totals.volumeKg,
    prs,
  };
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

const START_MESSAGES: Record<StartSessionError, string> = {
  session_in_progress: 'A workout is already in progress. Resume it first.',
  not_found: 'This workout is no longer in your plan.',
  not_open: 'This workout is already done or skipped.',
  not_today: 'This workout isn’t scheduled for today.',
  plan_paused: 'Your plan is paused. Resume it to train.',
  plan_not_active: 'This plan isn’t running.',
};

type Started = { ok: true; sessionId: string } | { ok: false; message: string };

/** Start a planned workout (FR-9.1) or an ad-hoc one (FR-9.13); the screen opens the session. */
export function useStartWorkout(): {
  start: (plannedWorkoutId: string) => Promise<Started>;
  startAdHoc: () => Promise<Started>;
  starting: boolean;
} {
  const db = useDb();
  const [starting, setStarting] = useState(false);
  const run = useCallback(
    async (
      call: () => Promise<
        { ok: true; sessionId: string } | { ok: false; reason: StartSessionError }
      >,
    ) => {
      setStarting(true);
      try {
        const result = await call();
        return result.ok
          ? { ok: true as const, sessionId: result.sessionId }
          : { ok: false as const, message: START_MESSAGES[result.reason] };
      } finally {
        setStarting(false);
      }
    },
    [],
  );
  const start = useCallback(
    (plannedWorkoutId: string) =>
      run(() => startSession(db, { plannedWorkoutId }, serviceContext())),
    [db, run],
  );
  const startAdHoc = useCallback(
    () => run(() => startAdHocSession(db, {}, serviceContext())),
    [db, run],
  );
  return { start, startAdHoc, starting };
}
