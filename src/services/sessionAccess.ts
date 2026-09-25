// Lookups shared by the session edits (DESIGN §8.2, FR-9.3, FR-9.4, FR-9.12). Each finds a row
// and its session. A session in progress is edited as it is logged; a finished one is edited
// from History, and the caller then replays its PRs (`afterSessionChange`).
import type { Session, SessionExercise, SetLog } from '@/core';
import type { Repositories } from '@/data/repositories';

export type AccessError = 'not_found';
type Found<T> = ({ ok: true } & T) | { ok: false; reason: AccessError };

export async function editableSession(
  r: Repositories,
  sessionId: string,
): Promise<Found<{ session: Session }>> {
  const session = await r.sessions.get(sessionId);
  return session ? { ok: true, session } : { ok: false, reason: 'not_found' };
}

export async function editableExercise(
  r: Repositories,
  sessionExerciseId: string,
): Promise<Found<{ exercise: SessionExercise; session: Session }>> {
  const exercise = await r.sessions.getExercise(sessionExerciseId);
  if (!exercise) return { ok: false, reason: 'not_found' };
  const found = await editableSession(r, exercise.sessionId);
  return found.ok ? { ...found, exercise } : found;
}

export async function editableSet(
  r: Repositories,
  setLogId: string,
): Promise<Found<{ set: SetLog; exercise: SessionExercise; session: Session }>> {
  const set = await r.sessions.getSet(setLogId);
  if (!set) return { ok: false, reason: 'not_found' };
  const found = await editableExercise(r, set.sessionExerciseId);
  return found.ok ? { ...found, set } : found;
}
