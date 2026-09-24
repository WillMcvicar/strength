// Logging a set during a session (DESIGN §8.2, §7.6; FR-9.2, FR-9.2a, FR-9.3). The UI starts the
// rest timer and schedules its notification itself (§2.6); nothing about the timer is stored.
import { completionError, isValidSetRpe, type CompletionError, type SetValues } from '@/core';
import type { Db } from '@/data/db';
import { repositories, type Repositories } from '@/data/repositories';

import { exclusive, type ServiceContext, type ServiceResult } from './context';

/** Values to log. A value left out keeps what the set holds: its pre-fill, or an earlier edit. */
export interface SetInput {
  setLogId: string;
  reps?: number | null;
  loadKg?: number | null;
  timeSec?: number | null;
  rpe?: number | null;
}

export type LogSetError = 'not_found' | 'session_not_in_progress' | 'bad_value' | CompletionError;
export type LogSetResult = ServiceResult<LogSetError>;

/** "Done as planned" when no values are given (FR-9.2); the set completes only if it may. */
export function completeSet(db: Db, input: SetInput, ctx: ServiceContext): Promise<LogSetResult> {
  return exclusive(db, async (tx) => {
    const r = repositories(tx);
    const found = await load(r, input);
    if (!found.ok) return found;
    const error = completionError(found.exercise, found.set, found.values);
    if (error) return { ok: false, reason: error };

    await r.sessions.updateSet(found.set.id, {
      ...found.values,
      status: 'completed',
      completedAt: ctx.now,
    });
    await r.sessions.update(found.sessionId, { updatedAt: ctx.now });
    return { ok: true };
  });
}

/** Edits a set before or after it is done (FR-9.3). A done set must stay valid. */
export function updateSet(db: Db, input: SetInput, ctx: ServiceContext): Promise<LogSetResult> {
  return exclusive(db, async (tx) => {
    const r = repositories(tx);
    const found = await load(r, input);
    if (!found.ok) return found;
    if (found.set.status === 'completed') {
      const error = completionError(found.exercise, found.set, found.values);
      if (error) return { ok: false, reason: error };
    } else if (found.values.rpe != null && !isValidSetRpe(found.values.rpe)) {
      return { ok: false, reason: 'bad_rpe' };
    }

    await r.sessions.updateSet(found.set.id, found.values);
    await r.sessions.update(found.sessionId, { updatedAt: ctx.now });
    return { ok: true };
  });
}

async function load(r: Repositories, input: SetInput) {
  const set = await r.sessions.getSet(input.setLogId);
  const exercise = set && (await r.sessions.getExercise(set.sessionExerciseId));
  const session = exercise && (await r.sessions.get(exercise.sessionId));
  if (!set || !exercise || !session) return { ok: false as const, reason: 'not_found' as const };
  if (session.status !== 'in_progress') {
    return { ok: false as const, reason: 'session_not_in_progress' as const };
  }

  const values: SetValues = {
    reps: input.reps !== undefined ? input.reps : set.reps,
    loadKg: input.loadKg !== undefined ? input.loadKg : set.loadKg,
    timeSec: input.timeSec !== undefined ? input.timeSec : set.timeSec,
    rpe: input.rpe !== undefined ? input.rpe : set.rpe,
  };
  const count = (n: number | null) => n === null || (Number.isInteger(n) && n >= 0);
  const valid =
    count(values.reps) &&
    count(values.timeSec) &&
    (values.loadKg === null || Number.isFinite(values.loadKg));
  if (!valid) return { ok: false as const, reason: 'bad_value' as const };

  return { ok: true as const, set, exercise, sessionId: session.id, values };
}
