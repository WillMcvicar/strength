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
  Pick<SetLog, 'reps' | 'loadKg' | 'timeSec' | 'rpe' | 'status' | 'completedAt' | 'isWarmup'>
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
