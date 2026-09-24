// Finishing and discarding a session (DESIGN §8.2; FR-9.8, FR-9.9, FR-9.11).
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { progress, rpeRequired } from '@/core';
import type { Db } from '@/data/db';
import { repositories, type Repositories } from '@/data/repositories';

import { openMigratedTestDb } from '../../test/db/betterSqlite3';
import { idSequence } from '../../test/fixtures/ids';
import { aStartedPlan, START } from '../../test/fixtures/sessions';
import type { ServiceContext } from './context';
import { discardSession } from './discardSession';
import { finishSession } from './finishSession';
import { completeSet } from './completeSet';
import { startSession } from './startSession';

let db: Db;
let repos: Repositories;
let ctx: ServiceContext;

const FINISHED = '2026-09-14T18:22:00.000Z';

beforeEach(async () => {
  db = await openMigratedTestDb();
  repos = repositories(db);
  ctx = { today: START, now: '2026-09-14T17:30:00.000Z', newId: idSequence() };
});

afterEach(async () => {
  await db.closeAsync();
});

/** Starts the given day's workout and marks every set "done as planned" (FR-9.2). */
async function logAsPlanned(d: Db, planId: string, date: string, c = ctx): Promise<string> {
  const r = repositories(d);
  const workout = (await r.plannedWorkouts.listByPlan(planId)).find(
    (w) => w.scheduledDate === date,
  )!;
  const started = await startSession(d, { plannedWorkoutId: workout.id }, c);
  if (!started.ok) throw new Error(started.reason);
  for (const { exercise, sets } of await r.sessions.exercises(started.sessionId)) {
    for (const s of sets) {
      const rpe = rpeRequired(exercise, s) ? (s.targetRpeMax ?? 8) : undefined;
      const done = await completeSet(d, { setLogId: s.id, rpe }, c);
      if (!done.ok) throw new Error(done.reason);
    }
  }
  return started.sessionId;
}

describe('AC-3 Log a session', () => {
  it('saves prescribed and actual loads, completes the workout and moves the progress meter', async () => {
    const { planId } = await aStartedPlan(db, ctx);
    const plan = (await repos.plans.get(planId))!;
    const phases = await repos.blueprints.phasesOfPlan(planId);
    const before = progress(phases, await repos.plannedWorkouts.listByPlan(planId), START, plan);

    const sessionId = await logAsPlanned(db, planId, START);
    const result = await finishSession(db, { sessionId }, { ...ctx, now: FINISHED });
    expect(result).toEqual({
      ok: true,
      summary: {
        name: 'Full body A',
        startedAt: ctx.now,
        endedAt: FINISHED,
        // squat 3 × 5 × 90 + press 2 × 10 × 30 × 2 + row 8 × 20 × 2; the warm-up and planks add none
        volumeKg: 1350 + 1200 + 320,
        setsCompleted: 8,
        setsIncomplete: 0,
      },
    });

    const session = (await repos.sessions.get(sessionId))!;
    expect(session).toMatchObject({ status: 'completed', endedAt: FINISHED, totalVolumeKg: 2870 });
    const [squat] = await repos.sessions.exercises(sessionId);
    expect(
      squat!.sets.filter((s) => !s.isWarmup).map((s) => [s.prescribedLoadKg, s.loadKg]),
    ).toEqual([
      [90, 90],
      [90, 90],
      [90, 90],
    ]);

    const workouts = await repos.plannedWorkouts.listByPlan(planId);
    const monday = workouts.find((w) => w.scheduledDate === START)!;
    expect(monday).toMatchObject({ status: 'completed', sessionId });
    const after = progress(phases, workouts, START, plan);
    expect(after.pctSessions).toBeGreaterThan(before.pctSessions);
  });
});

describe('AC-37 Cardio completion', () => {
  it('counts a ticked completion-only run as a completed set', async () => {
    const { planId } = await aStartedPlan(db, ctx);
    const wednesday = { ...ctx, today: '2026-09-16', now: '2026-09-16T07:00:00.000Z' };
    const sessionId = await logAsPlanned(db, planId, '2026-09-16', wednesday);
    const [, , run] = await repos.sessions.exercises(sessionId);
    expect(run!.exercise.trackingType).toBe('completion_only');
    expect(run!.sets.map((s) => s.status)).toEqual(['completed']);

    const result = await finishSession(db, { sessionId }, wednesday);
    // bench 3 + pull-ups 2 + run 1; only the bench adds volume (3 × 5 × 67.5)
    expect(result).toMatchObject({ ok: true, summary: { setsCompleted: 6, volumeKg: 1012.5 } });
  });
});

describe('AC-44 No-login persistence', () => {
  it('keeps a finished session and its completed workout after the app is closed', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'wp-ac44-'));
    const file = join(dir, 'app.db');
    try {
      const first = await openMigratedTestDb(file);
      const { planId } = await aStartedPlan(first, ctx);
      const sessionId = await logAsPlanned(first, planId, START);
      await finishSession(first, { sessionId }, { ...ctx, now: FINISHED });
      await first.closeAsync();

      const reopened = await openMigratedTestDb(file);
      try {
        const r = repositories(reopened);
        expect(await r.sessions.get(sessionId)).toMatchObject({ status: 'completed' });
        const [monday] = await r.plannedWorkouts.listByPlan(planId);
        expect(monday).toMatchObject({ status: 'completed', sessionId });
      } finally {
        await reopened.closeAsync();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it.todo('keeps any PRs the session set (Slice 7)');
});

describe('finishSession (FR-9.8, FR-9.9)', () => {
  it('finishes with incomplete sets, keeping the partial data', async () => {
    const { planId } = await aStartedPlan(db, ctx);
    const [monday] = await repos.plannedWorkouts.listByPlan(planId);
    const started = await startSession(db, { plannedWorkoutId: monday!.id }, ctx);
    if (!started.ok) throw new Error(started.reason);
    const [squat] = await repos.sessions.exercises(started.sessionId);
    await completeSet(db, { setLogId: squat!.sets[1]!.id, rpe: 8 }, ctx);

    const result = await finishSession(db, { sessionId: started.sessionId }, ctx);
    expect(result).toMatchObject({
      ok: true,
      summary: { volumeKg: 450, setsCompleted: 1, setsIncomplete: 8 },
    });
    const [again] = await repos.sessions.exercises(started.sessionId);
    expect(again!.sets.map((s) => s.status)).toEqual([
      'pending',
      'completed',
      'pending',
      'pending',
    ]);
    expect(await repos.plannedWorkouts.get(monday!.id)).toMatchObject({ status: 'completed' });
  });

  it('refuses a session that is not in progress', async () => {
    expect(await finishSession(db, { sessionId: 'nope' }, ctx)).toEqual({
      ok: false,
      reason: 'not_in_progress',
    });
    const { planId } = await aStartedPlan(db, ctx);
    const sessionId = await logAsPlanned(db, planId, START);
    await finishSession(db, { sessionId }, ctx);
    expect(await finishSession(db, { sessionId }, ctx)).toEqual({
      ok: false,
      reason: 'not_in_progress',
    });
  });
});

describe('discardSession (FR-9.11)', () => {
  it('deletes the session and its sets, and leaves the workout to do', async () => {
    const { planId } = await aStartedPlan(db, ctx);
    const sessionId = await logAsPlanned(db, planId, START);

    expect(await discardSession(db, { sessionId }, ctx)).toEqual({ ok: true });
    expect(await repos.sessions.get(sessionId)).toBeNull();
    expect(await repos.sessions.inProgress()).toBeNull();
    const [row] = await db.getAllAsync<{ n: number }>('SELECT COUNT(*) AS n FROM set_log');
    expect(row!.n).toBe(0);
    const [monday] = await repos.plannedWorkouts.listByPlan(planId);
    expect(monday).toMatchObject({ status: 'upcoming', sessionId: null });

    // The workout can be started again.
    expect((await startSession(db, { plannedWorkoutId: monday!.id }, ctx)).ok).toBe(true);
  });

  it('never discards a finished session; that is a history delete (FR-9.12)', async () => {
    const { planId } = await aStartedPlan(db, ctx);
    const sessionId = await logAsPlanned(db, planId, START);
    await finishSession(db, { sessionId }, ctx);
    expect(await discardSession(db, { sessionId }, ctx)).toEqual({
      ok: false,
      reason: 'not_in_progress',
    });
  });
});
