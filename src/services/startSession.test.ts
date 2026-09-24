// Starting a planned session (DESIGN §8.2, FR-3.12, FR-9.1, FR-9.2, FR-9.10, FR-9.13, FR-1.10).
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { PlannedWorkout } from '@/core';
import type { Db } from '@/data/db';
import { repositories, type Repositories } from '@/data/repositories';

import { openMigratedTestDb } from '../../test/db/betterSqlite3';
import { idSequence } from '../../test/fixtures/ids';
import { aStartedPlan, START } from '../../test/fixtures/sessions';
import type { ServiceContext } from './context';
import { startSession } from './startSession';

let db: Db;
let repos: Repositories;
let ctx: ServiceContext;

beforeEach(async () => {
  db = await openMigratedTestDb();
  repos = repositories(db);
  ctx = { today: START, now: '2026-09-14T17:30:00.000Z', newId: idSequence() };
});

afterEach(async () => {
  await db.closeAsync();
});

const workoutOn = async (planId: string, date: string): Promise<PlannedWorkout> => {
  const rows = await repos.plannedWorkouts.listByPlan(planId);
  const found = rows.find((w) => w.scheduledDate === date);
  if (!found) throw new Error(`No workout on ${date}`);
  return found;
};

describe('startSession (FR-9.1, FR-3.12)', () => {
  it('creates an in-progress session with the §7.6 squat snapshotted at 90 kg', async () => {
    const { planId, phaseId } = await aStartedPlan(db, ctx);
    const monday = await workoutOn(planId, START);

    const result = await startSession(db, { plannedWorkoutId: monday.id }, ctx);
    if (!result.ok) throw new Error(result.reason);

    const session = await repos.sessions.get(result.sessionId);
    expect(session).toMatchObject({
      planId,
      plannedWorkoutId: monday.id,
      phaseId,
      cycleGroupId: monday.cycleGroupId,
      phaseCycleIndex: 1,
      name: 'Full body A',
      kind: 'planned',
      localDate: START,
      startedAt: ctx.now,
      endedAt: null,
      status: 'in_progress',
    });

    const [squat, press, row, plank] = await repos.sessions.exercises(result.sessionId);
    expect(squat!.exercise).toMatchObject({
      skillId: 'skill_back_squat',
      sortOrder: 1,
      tmSnapshotKg: 112.5,
      trackingType: 'weight_reps',
      loadConvention: 'total',
      isUnilateral: false,
      isMainLift: true,
      wasAdded: false,
      wasSubstituted: false,
    });
    expect(
      squat!.sets.map((s) => [s.isWarmup, s.prescribedLoadKg, s.loadKg, s.reps, s.status]),
    ).toEqual([
      [true, 60, 60, 5, 'pending'],
      [false, 90, 90, 5, 'pending'],
      [false, 90, 90, 5, 'pending'],
      [false, 90, 90, 5, 'pending'],
    ]);
    // Skill fields are snapshotted, so the log reads as it was logged (FR-1.10).
    expect(press!.exercise).toMatchObject({ loadConvention: 'per_side', tmSnapshotKg: null });
    expect(row!.exercise).toMatchObject({ loadConvention: 'total', isUnilateral: true });
    expect(plank!.sets.map((s) => [s.timeSec, s.loadKg, s.reps])).toEqual([
      [60, null, null],
      [60, null, null],
    ]);

    // The planned workout itself is only linked when the session finishes (§8.2 step 2).
    expect(await repos.plannedWorkouts.get(monday.id)).toMatchObject({
      status: 'upcoming',
      sessionId: null,
    });
  });

  it('refuses a second session while one is in progress (FR-9.13)', async () => {
    const { planId } = await aStartedPlan(db, ctx);
    const monday = await workoutOn(planId, START);
    const first = await startSession(db, { plannedWorkoutId: monday.id }, ctx);
    expect(first.ok).toBe(true);

    expect(await startSession(db, { plannedWorkoutId: monday.id }, ctx)).toEqual({
      ok: false,
      reason: 'session_in_progress',
    });
  });

  it("refuses a workout that isn't today's; missed ones go through the missed options", async () => {
    const { planId } = await aStartedPlan(db, ctx);
    const wednesday = await workoutOn(planId, '2026-09-16');
    expect(await startSession(db, { plannedWorkoutId: wednesday.id }, ctx)).toEqual({
      ok: false,
      reason: 'not_today',
    });

    const monday = await workoutOn(planId, START);
    const later = { ...ctx, today: '2026-09-15' };
    expect(await startSession(db, { plannedWorkoutId: monday.id }, later)).toEqual({
      ok: false,
      reason: 'not_today',
    });
  });

  it('refuses a workout that is already done or skipped', async () => {
    const { planId } = await aStartedPlan(db, ctx);
    const monday = await workoutOn(planId, START);
    await repos.plannedWorkouts.update(monday.id, { status: 'skipped', skippedAt: ctx.now });
    expect(await startSession(db, { plannedWorkoutId: monday.id }, ctx)).toEqual({
      ok: false,
      reason: 'not_open',
    });
  });

  it('refuses when the plan is paused, and when the workout does not exist', async () => {
    const { planId } = await aStartedPlan(db, ctx);
    const monday = await workoutOn(planId, START);
    await repos.plans.update(planId, { status: 'paused', pausedOn: START });
    expect(await startSession(db, { plannedWorkoutId: monday.id }, ctx)).toEqual({
      ok: false,
      reason: 'plan_paused',
    });
    expect(await startSession(db, { plannedWorkoutId: 'nope' }, ctx)).toEqual({
      ok: false,
      reason: 'not_found',
    });
  });

  it('leaves %-based loads empty for a skill with no 1RM', async () => {
    const { planId } = await aStartedPlan(db, ctx);
    const monday = await workoutOn(planId, START);
    const [squatSkill] = (await repos.plans.skills(planId)).filter(
      (s) => s.skillId === 'skill_back_squat',
    );
    await repos.plans.updateSkill(squatSkill!.id, { startingOneRmKg: null });
    await db.runAsync('DELETE FROM one_rep_max_history WHERE skill_id = ?', ['skill_back_squat']);

    const result = await startSession(db, { plannedWorkoutId: monday.id }, ctx);
    if (!result.ok) throw new Error(result.reason);
    const [squat] = await repos.sessions.exercises(result.sessionId);
    expect(squat!.exercise.tmSnapshotKg).toBeNull();
    expect(squat!.sets.filter((s) => !s.isWarmup).map((s) => s.loadKg)).toEqual([null, null, null]);
  });
});

describe('AC-7 Session recovery', () => {
  it('resumes an in-progress session with its logged sets after the app is closed', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'wp-ac7-'));
    const file = join(dir, 'app.db');
    try {
      const first = await openMigratedTestDb(file);
      const { planId } = await aStartedPlan(first, ctx);
      const monday = (await repositories(first).plannedWorkouts.listByPlan(planId))[0]!;
      const started = await startSession(first, { plannedWorkoutId: monday.id }, ctx);
      if (!started.ok) throw new Error(started.reason);
      const [squat] = await repositories(first).sessions.exercises(started.sessionId);
      const logged = squat!.sets[1]!;
      await repositories(first).sessions.updateSet(logged.id, {
        status: 'completed',
        rpe: 8,
        reps: 5,
        completedAt: ctx.now,
      });
      // Force-close: nothing but the file survives.
      await first.closeAsync();

      const reopened = await openMigratedTestDb(file);
      try {
        const r = repositories(reopened);
        const resumed = await r.sessions.inProgress();
        expect(resumed?.id).toBe(started.sessionId);
        const [again] = await r.sessions.exercises(started.sessionId);
        expect(again!.sets.find((s) => s.id === logged.id)).toMatchObject({
          status: 'completed',
          rpe: 8,
          reps: 5,
          loadKg: 90,
        });
      } finally {
        await reopened.closeAsync();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
