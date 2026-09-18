// The generated schedule (FR-4.2). "Missed" is derived, never stored (DESIGN §3.7).
import { and, asc, eq, gte, lte } from 'drizzle-orm';

import type { LocalDate, PlannedWorkout } from '@/core/types';

import type { Orm } from '../orm';
import { plannedWorkout } from '../schema';

export type PlannedWorkoutPatch = Partial<
  Pick<
    PlannedWorkout,
    'scheduledDate' | 'weekIndex' | 'phaseId' | 'status' | 'sessionId' | 'skippedAt'
  >
>;

const inScheduleOrder = [
  asc(plannedWorkout.scheduledDate),
  asc(plannedWorkout.weekIndex),
  asc(plannedWorkout.id),
] as const;

export function plannedWorkoutRepository(o: Orm) {
  return {
    async get(id: string): Promise<PlannedWorkout | null> {
      return (await o.query.plannedWorkout.findFirst({ where: eq(plannedWorkout.id, id) })) ?? null;
    },

    async insertMany(rows: readonly PlannedWorkout[]): Promise<void> {
      for (const row of rows) await o.insert(plannedWorkout).values(row);
    },

    async listByPlan(planId: string): Promise<PlannedWorkout[]> {
      return o
        .select()
        .from(plannedWorkout)
        .where(eq(plannedWorkout.planId, planId))
        .orderBy(...inScheduleOrder);
    },

    /** Inclusive on both ends; uses idx_pw_date. */
    async listBetween(planId: string, from: LocalDate, to: LocalDate): Promise<PlannedWorkout[]> {
      return o
        .select()
        .from(plannedWorkout)
        .where(
          and(
            eq(plannedWorkout.planId, planId),
            gte(plannedWorkout.scheduledDate, from),
            lte(plannedWorkout.scheduledDate, to),
          ),
        )
        .orderBy(...inScheduleOrder);
    },

    /** One cycle of a cycle group (D-14); uses idx_pw_cycle. */
    async listByCycle(
      planId: string,
      cycleGroupId: string,
      phaseCycleIndex: number,
    ): Promise<PlannedWorkout[]> {
      return o
        .select()
        .from(plannedWorkout)
        .where(
          and(
            eq(plannedWorkout.planId, planId),
            eq(plannedWorkout.cycleGroupId, cycleGroupId),
            eq(plannedWorkout.phaseCycleIndex, phaseCycleIndex),
          ),
        )
        .orderBy(...inScheduleOrder);
    },

    async update(id: string, patch: PlannedWorkoutPatch): Promise<void> {
      await o.update(plannedWorkout).set(patch).where(eq(plannedWorkout.id, id));
    },
  };
}
