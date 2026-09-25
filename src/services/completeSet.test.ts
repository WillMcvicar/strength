// Completing and editing a set during a session (DESIGN §8.2, §7.6; FR-9.2, FR-9.2a, FR-9.3).
import type { Db } from '@/data/db';
import { repositories, type LoggedExercise, type Repositories } from '@/data/repositories';

import { openMigratedTestDb } from '../../test/db/betterSqlite3';
import { idSequence } from '../../test/fixtures/ids';
import { aStartedPlan, START } from '../../test/fixtures/sessions';
import type { ServiceContext } from './context';
import { completeSet } from './completeSet';
import { updateSet } from './updateSet';
import { startSession } from './startSession';

let db: Db;
let repos: Repositories;
let ctx: ServiceContext;
let exercises: LoggedExercise[];
let sessionId: string;

const LATER = '2026-09-14T17:35:00.000Z';

beforeEach(async () => {
  db = await openMigratedTestDb();
  repos = repositories(db);
  ctx = { today: START, now: '2026-09-14T17:30:00.000Z', newId: idSequence() };
  const { planId } = await aStartedPlan(db, ctx);
  const [monday] = await repos.plannedWorkouts.listByPlan(planId);
  const started = await startSession(db, { plannedWorkoutId: monday!.id }, ctx);
  if (!started.ok) throw new Error(started.reason);
  sessionId = started.sessionId;
  exercises = await repos.sessions.exercises(sessionId);
});

afterEach(async () => {
  await db.closeAsync();
});

const squatSet = (i: number) => exercises[0]!.sets[i]!;
const pressSet = () => exercises[1]!.sets[0]!;
const plankSet = () => exercises[3]!.sets[0]!;

describe('completeSet (FR-9.2 "done as planned")', () => {
  it('logs the pre-filled values with one call, plus the RPE a main lift needs', async () => {
    const result = await completeSet(
      db,
      { setLogId: squatSet(1).id, rpe: 8 },
      { ...ctx, now: LATER },
    );
    expect(result).toEqual({ ok: true });
    expect(await repos.sessions.getSet(squatSet(1).id)).toMatchObject({
      status: 'completed',
      reps: 5,
      loadKg: 90,
      prescribedLoadKg: 90,
      rpe: 8,
      completedAt: LATER,
    });
    expect((await repos.sessions.get(sessionId))!.updatedAt).toBe(LATER);
  });

  it('logs the values the lifter changed, keeping the prescription', async () => {
    await completeSet(db, { setLogId: squatSet(1).id, reps: 4, loadKg: 92.5, rpe: 9 }, ctx);
    expect(await repos.sessions.getSet(squatSet(1).id)).toMatchObject({
      reps: 4,
      loadKg: 92.5,
      prescribedLoadKg: 90,
      rpe: 9,
    });
  });

  it('logs a warm-up with no RPE', async () => {
    expect(await completeSet(db, { setLogId: squatSet(0).id }, ctx)).toEqual({ ok: true });
  });

  it('logs a timed set', async () => {
    expect(await completeSet(db, { setLogId: plankSet().id, timeSec: 75 }, ctx)).toEqual({
      ok: true,
    });
    expect((await repos.sessions.getSet(plankSet().id))!.timeSec).toBe(75);
  });

  it('rejects before writing anything when the values are incomplete', async () => {
    expect(await completeSet(db, { setLogId: squatSet(1).id }, ctx)).toEqual({
      ok: false,
      reason: 'rpe_required',
    });
    expect(await completeSet(db, { setLogId: pressSet().id, loadKg: null }, ctx)).toEqual({
      ok: false,
      reason: 'missing_load',
    });
    expect(await completeSet(db, { setLogId: pressSet().id, reps: 2.5 }, ctx)).toEqual({
      ok: false,
      reason: 'bad_value',
    });
    expect(await repos.sessions.getSet(squatSet(1).id)).toMatchObject({ status: 'pending' });
  });

  it('refuses a set that does not exist', async () => {
    expect(await completeSet(db, { setLogId: 'nope' }, ctx)).toEqual({
      ok: false,
      reason: 'not_found',
    });
  });

  it('completes a set of a finished session as of its end, when edited from History (FR-9.12)', async () => {
    await repos.sessions.update(sessionId, { status: 'completed', endedAt: LATER });
    expect(await completeSet(db, { setLogId: pressSet().id }, ctx)).toEqual({ ok: true });
    expect(await repos.sessions.getSet(pressSet().id)).toMatchObject({
      status: 'completed',
      completedAt: LATER,
    });
  });
});

describe('updateSet (FR-9.3)', () => {
  it('edits a pending set without completing it', async () => {
    expect(await updateSet(db, { setLogId: pressSet().id, loadKg: 32 }, ctx)).toEqual({ ok: true });
    expect(await repos.sessions.getSet(pressSet().id)).toMatchObject({
      loadKg: 32,
      status: 'pending',
      completedAt: null,
    });
  });

  it('edits a completed set, but not into one that could not have completed', async () => {
    await completeSet(db, { setLogId: squatSet(1).id, rpe: 8 }, ctx);
    expect(await updateSet(db, { setLogId: squatSet(1).id, reps: 6 }, ctx)).toEqual({ ok: true });
    expect(await updateSet(db, { setLogId: squatSet(1).id, rpe: null }, ctx)).toEqual({
      ok: false,
      reason: 'rpe_required',
    });
    expect(await repos.sessions.getSet(squatSet(1).id)).toMatchObject({ reps: 6, rpe: 8 });
  });

  it('rejects values that are not numbers a set can hold', async () => {
    for (const bad of [{ reps: -1 }, { timeSec: 1.5 }, { loadKg: Number.NaN }]) {
      expect(await updateSet(db, { setLogId: pressSet().id, ...bad }, ctx)).toEqual({
        ok: false,
        reason: 'bad_value',
      });
    }
    expect(await updateSet(db, { setLogId: pressSet().id, rpe: 11 }, ctx)).toEqual({
      ok: false,
      reason: 'bad_rpe',
    });
  });
});
