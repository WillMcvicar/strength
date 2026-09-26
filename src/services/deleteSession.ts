// Delete a past session from History (FR-9.12, DESIGN §4.4, C-4). Its exercises, sets and PRs go
// with it, its planned workout is open again (missed, if its date has passed), and the PRs of the
// skills it logged and its workout's double-progression tracks are replayed (FR-10.5, AC-5,
// §3.12). An in-progress session is discarded instead.
import type { Db } from '@/data/db';
import { repositories } from '@/data/repositories';

import { exclusive, type ServiceContext, type ServiceResult } from './context';
import { replaySessionProgression } from './doubleProgression';
import { replaySkillPrs } from './personalRecords';

export type DeleteSessionResult = ServiceResult<'not_found' | 'in_progress'>;

export function deleteSession(
  db: Db,
  input: { sessionId: string },
  ctx: ServiceContext,
): Promise<DeleteSessionResult> {
  return exclusive(db, async (tx) => {
    const r = repositories(tx);
    const session = await r.sessions.get(input.sessionId);
    if (!session) return { ok: false, reason: 'not_found' };
    if (session.status !== 'completed') return { ok: false, reason: 'in_progress' };

    const exercises = (await r.sessions.exercises(session.id)).map((e) => e.exercise);
    const skillIds = exercises.map((e) => e.skillId);
    if (session.plannedWorkoutId) {
      await r.plannedWorkouts.update(session.plannedWorkoutId, {
        status: 'upcoming',
        sessionId: null,
      });
    }
    await r.sessions.delete(session.id);
    await replaySkillPrs(r, skillIds, ctx, session.startedAt);
    await replaySessionProgression(
      r,
      session,
      exercises.map((e) => e.cycleExerciseId),
    );
    // TODO(Slice 10): end with reconcile(ctx.today) once it exists (DESIGN §2.5, D-21).
    return { ok: true };
  });
}
