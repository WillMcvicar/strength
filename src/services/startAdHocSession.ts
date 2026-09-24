// Start a workout that is not part of any plan (FR-9.13, DESIGN §8.2). It starts empty; the
// lifter adds exercises (FR-9.4). Only one session can be in progress at a time.
import type { Db } from '@/data/db';
import { repositories } from '@/data/repositories';

import { exclusive, type ServiceContext, type ServiceResult } from './context';

export type StartAdHocSessionResult = ServiceResult<'session_in_progress', { sessionId: string }>;

export function startAdHocSession(
  db: Db,
  input: { name?: string },
  ctx: ServiceContext,
): Promise<StartAdHocSessionResult> {
  return exclusive(db, async (tx) => {
    const r = repositories(tx);
    if (await r.sessions.inProgress()) return { ok: false, reason: 'session_in_progress' };

    const sessionId = ctx.newId();
    await r.sessions.insert({
      id: sessionId,
      planId: null,
      plannedWorkoutId: null,
      phaseId: null,
      cycleGroupId: null,
      phaseCycleIndex: null,
      name: input.name?.trim() || 'Workout',
      kind: 'ad_hoc',
      localDate: ctx.today,
      startedAt: ctx.now,
      endedAt: null,
      status: 'in_progress',
      notes: null,
      rpe: null,
      totalVolumeKg: null,
      updatedAt: ctx.now,
    });
    return { ok: true, sessionId };
  });
}
