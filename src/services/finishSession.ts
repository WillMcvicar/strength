// Finish Workout (DESIGN §8.2, FR-9.8, FR-9.9). Unfinished sets are kept as they are, and the
// session still counts as completed.
import { sessionTotals, type PersonalRecord } from '@/core';
import type { Db } from '@/data/db';
import { repositories } from '@/data/repositories';

import { exclusive, type ServiceContext, type ServiceResult } from './context';
import { recordSessionProgression } from './doubleProgression';
import { recordSessionPrs } from './personalRecords';

export interface SessionSummary {
  name: string;
  startedAt: string;
  endedAt: string;
  /** reps × load × multiplier over completed working sets (§3.14). */
  volumeKg: number;
  setsCompleted: number;
  /** Sets still pending, warm-ups included: "4 sets aren't done" (§7.6). */
  setsIncomplete: number;
}

export type FinishSessionResult = ServiceResult<
  'not_in_progress',
  { summary: SessionSummary; prs: PersonalRecord[] }
>;

export function finishSession(
  db: Db,
  input: { sessionId: string },
  ctx: ServiceContext,
): Promise<FinishSessionResult> {
  return exclusive(db, async (tx) => {
    const r = repositories(tx);
    const session = await r.sessions.get(input.sessionId);
    if (!session || session.status !== 'in_progress') {
      return { ok: false, reason: 'not_in_progress' };
    }

    // Step 1: close the session and cache its volume.
    const exercises = await r.sessions.exercises(session.id);
    const totals = sessionTotals(exercises);
    await r.sessions.update(session.id, {
      status: 'completed',
      endedAt: ctx.now,
      totalVolumeKg: totals.volumeKg,
      updatedAt: ctx.now,
    });

    // Step 2: the planned workout is done, even with sets left over (FR-9.9).
    if (session.plannedWorkoutId) {
      await r.plannedWorkouts.update(session.plannedWorkoutId, {
        status: 'completed',
        sessionId: session.id,
      });
    }

    // Step 3: PRs against the current bests (§3.13). They never touch the 1RM (FR-3.10, AC-23).
    const prs = await recordSessionPrs(r, session.id, ctx);

    // Step 4: each linked exercise moves its workout's track on (§3.12).
    await recordSessionProgression(r, session, ctx.now);
    // TODO(Slice 10): step 5, finish with reconcile(ctx.today) once it exists (DESIGN §2.5).

    return {
      ok: true,
      summary: {
        name: session.name,
        startedAt: session.startedAt,
        endedAt: ctx.now,
        volumeKg: totals.volumeKg,
        setsCompleted: totals.setsCompleted,
        setsIncomplete: exercises.reduce(
          (n, e) => n + e.sets.filter((s) => s.status === 'pending').length,
          0,
        ),
      },
      prs,
    };
  });
}
