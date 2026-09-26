// PR bookkeeping shared by the services that finish, edit and delete sessions (DESIGN §3.13,
// §4.4). Each runs inside its caller's exclusive transaction; none is a service of its own.
import {
  bestsOf,
  detectPrs,
  replayPrs,
  sessionTotals,
  type NewPr,
  type PersonalRecord,
  type Session,
} from '@/core';
import type { Repositories } from '@/data/repositories';

import type { ServiceContext } from './context';
import { replaySessionProgression } from './doubleProgression';

const withIds = (rows: readonly NewPr[], ctx: ServiceContext): PersonalRecord[] =>
  rows.map((row) => ({ ...row, id: ctx.newId() }));

/**
 * Finish Workout step 3 (§8.2): the session's sets against the current bests, taking the new
 * session as the latest. Returns the records it added, for the summary.
 */
export async function recordSessionPrs(
  r: Repositories,
  sessionId: string,
  ctx: ServiceContext,
): Promise<PersonalRecord[]> {
  const sets = await r.sessions.prSetsOfSession(sessionId);
  const skillIds = [...new Set(sets.map((s) => s.skillId))];
  const bests = bestsOf(await r.prs.bySkills(skillIds));
  const rows = withIds(detectPrs(bests, sets), ctx);
  await r.prs.insertMany(rows);
  return rows;
}

/**
 * Rebuilds these skills' logged PRs from `from` on (FR-10.5), usually a changed session's start.
 * The records before it stand and seed the bests, since a change to one session can't alter what
 * came before it, so a skill's whole history isn't walked on every tap.
 */
export async function replaySkillPrs(
  r: Repositories,
  skillIds: readonly string[],
  ctx: ServiceContext,
  from: string,
): Promise<void> {
  const skills = [...new Set(skillIds)];
  if (skills.length === 0) return;
  const records = await r.prs.bySkills(skills);
  const since = (row: PersonalRecord) => row.achievedAt >= from;
  const bests = bestsOf(records.filter((row) => !since(row)));
  const manual = records.filter((row) => row.isManual && since(row));
  await r.prs.deleteLogged(skills, from);
  const sets = await r.sessions.prSets(skills, from);
  await r.prs.insertMany(withIds(replayPrs(manual, sets, bests), ctx));
}

/**
 * Marks the session changed. A finished one is being edited from History (FR-9.12), so its
 * volume is recomputed, and the PRs of the skills it touched and its workout's
 * double-progression tracks are replayed (§4.4, §3.12, C-4).
 */
export async function afterSessionChange(
  r: Repositories,
  session: Session,
  skillIds: readonly string[],
  ctx: ServiceContext,
): Promise<void> {
  if (session.status !== 'completed') {
    await r.sessions.update(session.id, { updatedAt: ctx.now });
    return;
  }
  const exercises = await r.sessions.exercises(session.id);
  const { volumeKg } = sessionTotals(exercises);
  await r.sessions.update(session.id, { totalVolumeKg: volumeKg, updatedAt: ctx.now });
  // Its sets were all done after it started, and every earlier session's before (FR-9.13).
  await replaySkillPrs(r, skillIds, ctx, session.startedAt);
  await replaySessionProgression(
    r,
    session,
    exercises.map((e) => e.exercise.cycleExerciseId),
  );
  // TODO(Slice 10): end with reconcile(ctx.today) once it exists (DESIGN §2.5, AC-65).
}

/** When a set completes: now, or the end of a finished session, so replay order holds. */
export const completionTime = (session: Session, ctx: ServiceContext): string =>
  session.status === 'completed' && session.endedAt ? session.endedAt : ctx.now;
