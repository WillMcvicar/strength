// The blueprint shared by templates and plans: phases, increase rules, workouts, slots,
// exercises and sets (DESIGN §4.1, D-20). A continuation reads its blueprint from its original
// phase (DESIGN §4.4); callers pass that phase's id.
import { asc, eq, inArray } from 'drizzle-orm';

import type {
  CycleExercise,
  CycleSet,
  CycleSlot,
  CycleWorkout,
  IncreaseRule,
  Phase,
} from '@/core/types';

import type { Orm } from '../orm';
import { cycleExercise, cycleSet, cycleSlot, cycleWorkout, increaseRule, phase } from '../schema';

export type PhasePatch = Partial<Omit<Phase, 'id' | 'templateId' | 'planId'>>;

export interface BlueprintExercise {
  exercise: CycleExercise;
  sets: CycleSet[];
}

export interface BlueprintWorkout {
  workout: CycleWorkout;
  exercises: BlueprintExercise[];
}

/** Everything one phase defines, each level in sort order. */
export interface Blueprint {
  phase: Phase;
  increaseRules: IncreaseRule[];
  workouts: BlueprintWorkout[];
  slots: CycleSlot[];
}

export function blueprintRepository(o: Orm) {
  return {
    async phase(id: string): Promise<Phase | null> {
      return (await o.query.phase.findFirst({ where: eq(phase.id, id) })) ?? null;
    },

    async phasesOfPlan(planId: string): Promise<Phase[]> {
      return o.select().from(phase).where(eq(phase.planId, planId)).orderBy(asc(phase.sortOrder));
    },

    async phasesOfTemplate(templateId: string): Promise<Phase[]> {
      return o
        .select()
        .from(phase)
        .where(eq(phase.templateId, templateId))
        .orderBy(asc(phase.sortOrder));
    },

    async insertPhase(row: Phase): Promise<void> {
      await o.insert(phase).values(row);
    },

    async updatePhase(id: string, patch: PhasePatch): Promise<void> {
      await o.update(phase).set(patch).where(eq(phase.id, id));
    },

    async insertIncreaseRule(row: IncreaseRule): Promise<void> {
      await o.insert(increaseRule).values(row);
    },

    async insertWorkout(row: CycleWorkout): Promise<void> {
      await o.insert(cycleWorkout).values(row);
    },

    async insertSlot(row: CycleSlot): Promise<void> {
      await o.insert(cycleSlot).values(row);
    },

    /** Pins a slot to a weekday (FR-4.2). */
    async updateSlot(id: string, patch: Pick<CycleSlot, 'weekday'>): Promise<void> {
      await o.update(cycleSlot).set(patch).where(eq(cycleSlot.id, id));
    },

    /** Every slot of every phase of a plan, in phase then cycle-week order. */
    async slotsOfPlan(planId: string): Promise<CycleSlot[]> {
      const rows = await o
        .select({ slot: cycleSlot })
        .from(cycleSlot)
        .innerJoin(phase, eq(phase.id, cycleSlot.phaseId))
        .where(eq(phase.planId, planId))
        .orderBy(asc(phase.sortOrder), asc(cycleSlot.cycleWeekIndex), asc(cycleSlot.sortOrder));
      return rows.map((r) => r.slot);
    },

    async insertExercise(row: CycleExercise): Promise<void> {
      await o.insert(cycleExercise).values(row);
    },

    async insertSet(row: CycleSet): Promise<void> {
      await o.insert(cycleSet).values(row);
    },

    async loadBlueprint(phaseId: string): Promise<Blueprint | null> {
      const owner = await this.phase(phaseId);
      if (!owner) return null;

      const [increaseRules, workouts, slots] = await Promise.all([
        o
          .select()
          .from(increaseRule)
          .where(eq(increaseRule.phaseId, phaseId))
          .orderBy(asc(increaseRule.skillId)),
        o
          .select()
          .from(cycleWorkout)
          .where(eq(cycleWorkout.phaseId, phaseId))
          .orderBy(asc(cycleWorkout.sortOrder)),
        o
          .select()
          .from(cycleSlot)
          .where(eq(cycleSlot.phaseId, phaseId))
          .orderBy(asc(cycleSlot.cycleWeekIndex), asc(cycleSlot.sortOrder)),
      ]);

      const workoutIds = workouts.map((w) => w.id);
      const exercises = workoutIds.length
        ? await o
            .select()
            .from(cycleExercise)
            .where(inArray(cycleExercise.cycleWorkoutId, workoutIds))
            .orderBy(asc(cycleExercise.sortOrder))
        : [];
      const exerciseIds = exercises.map((e) => e.id);
      const sets = exerciseIds.length
        ? await o
            .select()
            .from(cycleSet)
            .where(inArray(cycleSet.cycleExerciseId, exerciseIds))
            .orderBy(asc(cycleSet.setIndex))
        : [];

      return {
        phase: owner,
        increaseRules,
        slots,
        workouts: workouts.map((workout) => ({
          workout,
          exercises: exercises
            .filter((e) => e.cycleWorkoutId === workout.id)
            .map((exercise) => ({
              exercise,
              sets: sets.filter((s) => s.cycleExerciseId === exercise.id),
            })),
        })),
      };
    },
  };
}
