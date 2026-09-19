// DESIGN §3.7 — derived status and plan progress (FR-4.11, FR-4.15, FR-8.3, C-2, D-24).
// Nothing here is stored: "missed" and progress are recalculated from the schedule and today.
import type { LocalDate, Phase, Plan, PlannedWorkout } from '../types';
import { weekPosition } from './generate';

export type EffectiveStatus =
  'completed' | 'skipped' | 'not_done' | 'in_progress' | 'paused' | 'missed' | 'today' | 'upcoming';

type PlanState = Pick<Plan, 'status' | 'pausedOn' | 'endedOn'>;

export function effectiveStatus(
  pw: Pick<PlannedWorkout, 'status' | 'scheduledDate'>,
  today: LocalDate,
  plan: PlanState,
  hasInProgressSession: boolean,
): EffectiveStatus {
  if (pw.status === 'completed' || pw.status === 'skipped') return pw.status;
  const ended = plan.status === 'completed' || plan.status === 'abandoned';
  // D-24: excluded from adherence.
  if (ended && plan.endedOn !== null && pw.scheduledDate >= plan.endedOn) return 'not_done';
  if (hasInProgressSession) return 'in_progress';
  // C-2: a paused plan's workouts are never missed.
  if (plan.status === 'paused' && plan.pausedOn !== null && pw.scheduledDate >= plan.pausedOn) {
    return 'paused';
  }
  if (pw.scheduledDate < today) return 'missed';
  if (pw.scheduledDate === today) return 'today';
  return 'upcoming';
}

export interface PlanProgress {
  currentWeek: number;
  totalWeeks: number;
  currentPhase: Phase;
  completed: number;
  /** Every scheduled workout. */
  total: number;
  /** completed ÷ total, 0 when nothing is scheduled. */
  pctSessions: number;
  /** completed ÷ (completed + missed), skipped excluded; null when that is 0 ÷ 0. */
  adherence: number | null;
}

/**
 * The plan progress meter (FR-8.3). The current week is the week of the first workout dated
 * today or later, or the last week once none is left.
 */
export function progress(
  phases: readonly Phase[],
  workouts: readonly PlannedWorkout[],
  today: LocalDate,
  plan: PlanState,
  inProgressIds: ReadonlySet<string> = new Set(),
): PlanProgress {
  const last = phases.reduce((sum, p) => sum + p.lengthWeeks, 0);
  const next = [...workouts]
    .filter((w) => w.scheduledDate >= today)
    .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate) || a.weekIndex - b.weekIndex)[0];
  const position = weekPosition(phases, next?.weekIndex ?? last);

  let completed = 0;
  let missed = 0;
  for (const w of workouts) {
    const status = effectiveStatus(w, today, plan, inProgressIds.has(w.id));
    if (status === 'completed') completed += 1;
    if (status === 'missed') missed += 1;
  }

  return {
    currentWeek: position.weekIndex,
    totalWeeks: position.totalWeeks,
    currentPhase: position.phase,
    completed,
    total: workouts.length,
    pctSessions: workouts.length === 0 ? 0 : completed / workouts.length,
    adherence: completed + missed === 0 ? null : completed / (completed + missed),
  };
}
