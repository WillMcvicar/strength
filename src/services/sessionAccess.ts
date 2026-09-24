// Lookups shared by the in-session edits (DESIGN §8.2, FR-9.3, FR-9.4). Each finds a row and its
// session and refuses one that has finished: past sessions are edited from History (FR-9.12).
import type { Session, SessionExercise, SetLog } from '@/core';
import type { Repositories } from '@/data/repositories';

export type AccessError = 'not_found' | 'session_not_in_progress';
type Found<T> = ({ ok: true } & T) | { ok: false; reason: AccessError };

export async function inProgressSession(
  r: Repositories,
  sessionId: string,
): Promise<Found<{ session: Session }>> {
  const session = await r.sessions.get(sessionId);
  if (!session) return { ok: false, reason: 'not_found' };
  if (session.status !== 'in_progress') return { ok: false, reason: 'session_not_in_progress' };
  return { ok: true, session };
}

export async function inProgressExercise(
  r: Repositories,
  sessionExerciseId: string,
): Promise<Found<{ exercise: SessionExercise; session: Session }>> {
  const exercise = await r.sessions.getExercise(sessionExerciseId);
  if (!exercise) return { ok: false, reason: 'not_found' };
  const found = await inProgressSession(r, exercise.sessionId);
  return found.ok ? { ...found, exercise } : found;
}

export async function inProgressSet(
  r: Repositories,
  setLogId: string,
): Promise<Found<{ set: SetLog; exercise: SessionExercise; session: Session }>> {
  const set = await r.sessions.getSet(setLogId);
  if (!set) return { ok: false, reason: 'not_found' };
  const found = await inProgressExercise(r, set.sessionExerciseId);
  return found.ok ? { ...found, set } : found;
}
