// Logged sessions (FR-9, DESIGN §4.3): the session, its exercises with their snapshots (FR-1.10),
// and their sets. At most one session is in progress (`uq_session_in_progress`, FR-9.13).
import { and, asc, desc, eq, inArray } from 'drizzle-orm';

import type { Session, SessionExercise, SetLog } from '@/core/types';

import type { Orm } from '../orm';
import { session, sessionExercise, setLog } from '../schema';

export type SessionPatch = Partial<
  Pick<Session, 'status' | 'endedAt' | 'notes' | 'rpe' | 'totalVolumeKg' | 'updatedAt'>
>;
export type SetLogPatch = Partial<
  Pick<
    SetLog,
    | 'sessionExerciseId'
    | 'setIndex'
    | 'reps'
    | 'loadKg'
    | 'timeSec'
    | 'rpe'
    | 'status'
    | 'completedAt'
    | 'isWarmup'
  >
>;
export type SessionExercisePatch = Partial<
  Pick<
    SessionExercise,
    | 'skillId'
    | 'sortOrder'
    | 'notes'
    | 'wasSubstituted'
    | 'tmSnapshotKg'
    | 'trackingType'
    | 'loadConvention'
    | 'isUnilateral'
    | 'isMainLift'
    | 'dpIncreaseKg'
  >
>;

export interface LoggedExercise {
  exercise: SessionExercise;
  sets: SetLog[];
}

export function sessionRepository(o: Orm) {
  return {
    async get(id: string): Promise<Session | null> {
      return (await o.query.session.findFirst({ where: eq(session.id, id) })) ?? null;
    },

    async inProgress(): Promise<Session | null> {
      return (
        (await o.query.session.findFirst({ where: eq(session.status, 'in_progress') })) ?? null
      );
    },

    async insert(row: Session): Promise<void> {
      await o.insert(session).values(row);
    },

    async update(id: string, patch: SessionPatch): Promise<void> {
      await o.update(session).set(patch).where(eq(session.id, id));
    },

    /** Its exercises and sets go with it (ON DELETE CASCADE). */
    async delete(id: string): Promise<void> {
      await o.delete(session).where(eq(session.id, id));
    },

    async insertExercise(row: SessionExercise): Promise<void> {
      await o.insert(sessionExercise).values(row);
    },

    async insertSet(row: SetLog): Promise<void> {
      await o.insert(setLog).values(row);
    },

    async getSet(id: string): Promise<SetLog | null> {
      return (await o.query.setLog.findFirst({ where: eq(setLog.id, id) })) ?? null;
    },

    async getExercise(id: string): Promise<SessionExercise | null> {
      return (
        (await o.query.sessionExercise.findFirst({ where: eq(sessionExercise.id, id) })) ?? null
      );
    },

    async updateSet(id: string, patch: SetLogPatch): Promise<void> {
      await o.update(setLog).set(patch).where(eq(setLog.id, id));
    },

    async deleteSet(id: string): Promise<void> {
      await o.delete(setLog).where(eq(setLog.id, id));
    },

    /** One exercise's sets in set order. */
    async setsOf(sessionExerciseId: string): Promise<SetLog[]> {
      return o
        .select()
        .from(setLog)
        .where(eq(setLog.sessionExerciseId, sessionExerciseId))
        .orderBy(asc(setLog.setIndex));
    },

    /**
     * Gives the exercise's sets indexes 1…n in the order given. Two passes through negative
     * indexes keep `uq_set_log` satisfied at every step.
     */
    async renumberSets(orderedIds: readonly string[]): Promise<void> {
      for (const [i, id] of orderedIds.entries()) {
        await o
          .update(setLog)
          .set({ setIndex: -(i + 1) })
          .where(eq(setLog.id, id));
      }
      for (const [i, id] of orderedIds.entries()) {
        await o
          .update(setLog)
          .set({ setIndex: i + 1 })
          .where(eq(setLog.id, id));
      }
    },

    async updateExercise(id: string, patch: SessionExercisePatch): Promise<void> {
      await o.update(sessionExercise).set(patch).where(eq(sessionExercise.id, id));
    },

    /** Its sets go with it (ON DELETE CASCADE). */
    async deleteExercise(id: string): Promise<void> {
      await o.delete(sessionExercise).where(eq(sessionExercise.id, id));
    },

    /** The session's exercises in order, each with its sets in order. */
    async exercises(sessionId: string): Promise<LoggedExercise[]> {
      const exercises = await o
        .select()
        .from(sessionExercise)
        .where(eq(sessionExercise.sessionId, sessionId))
        .orderBy(asc(sessionExercise.sortOrder));
      if (exercises.length === 0) return [];
      const sets = await o
        .select()
        .from(setLog)
        .where(
          inArray(
            setLog.sessionExerciseId,
            exercises.map((e) => e.id),
          ),
        )
        .orderBy(asc(setLog.setIndex));
      return exercises.map((exercise) => ({
        exercise,
        sets: sets.filter((s) => s.sessionExerciseId === exercise.id),
      }));
    },

    /**
     * Each skill's most recent completed top set from a completed session, shown as "Last: 100 kg
     * × 2 @ RPE 8" beside a new one (FR-9.2b, §8.2). Top sets come once a cycle, so this is last
     * cycle's.
     */
    async lastTopSetBySkill(
      skillIds: readonly string[],
    ): Promise<Map<string, Pick<SetLog, 'loadKg' | 'reps' | 'rpe'>>> {
      if (skillIds.length === 0) return new Map();
      const rows = await o
        .select({
          skillId: sessionExercise.skillId,
          loadKg: setLog.loadKg,
          reps: setLog.reps,
          rpe: setLog.rpe,
        })
        .from(setLog)
        .innerJoin(sessionExercise, eq(setLog.sessionExerciseId, sessionExercise.id))
        .innerJoin(session, eq(sessionExercise.sessionId, session.id))
        .where(
          and(
            inArray(sessionExercise.skillId, [...skillIds]),
            eq(session.status, 'completed'),
            eq(setLog.status, 'completed'),
            eq(setLog.isTopSet, true),
          ),
        )
        .orderBy(desc(setLog.completedAt));
      const last = new Map<string, Pick<SetLog, 'loadKg' | 'reps' | 'rpe'>>();
      for (const { skillId, ...set } of rows) if (!last.has(skillId)) last.set(skillId, set);
      return last;
    },

    /**
     * Each skill's most recent logged working load from a completed session (DESIGN §3.12, "no
     * working load yet"). Skills never logged with a load are left out.
     */
    async lastLoadBySkill(skillIds: readonly string[]): Promise<Map<string, number>> {
      if (skillIds.length === 0) return new Map();
      const rows = await o
        .select({ skillId: sessionExercise.skillId, loadKg: setLog.loadKg })
        .from(setLog)
        .innerJoin(sessionExercise, eq(setLog.sessionExerciseId, sessionExercise.id))
        .innerJoin(session, eq(sessionExercise.sessionId, session.id))
        .where(
          and(
            inArray(sessionExercise.skillId, [...skillIds]),
            eq(session.status, 'completed'),
            eq(setLog.status, 'completed'),
            eq(setLog.isWarmup, false),
          ),
        )
        .orderBy(desc(setLog.completedAt), desc(setLog.setIndex));
      const last = new Map<string, number>();
      for (const row of rows) {
        if (row.loadKg != null && !last.has(row.skillId)) last.set(row.skillId, row.loadKg);
      }
      return last;
    },
  };
}
