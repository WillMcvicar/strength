// Double progression across services (DESIGN §3.12, §8.2, FR-3.15, FR-2.15, D-20, C-4, C-10):
// finishing writes the workout's track, starting reads it, revert undoes an increase, and edits or
// deletes in History replay it.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { DoubleProgressionState } from '@/core';
import type { Db } from '@/data/db';
import { repositories, type Repositories } from '@/data/repositories';

import { openMigratedTestDb } from '../../test/db/betterSqlite3';
import { idSequence } from '../../test/fixtures/ids';
import { aPlan, sets, strength, topSet } from '../../test/fixtures/plans';
import {
  FRI,
  MON,
  NEXT_MON,
  logAndFinish,
  logDay,
  on,
  START,
  type SetValues,
} from '../../test/fixtures/sessions';
import { completeSet } from './completeSet';
import type { ServiceContext } from './context';
import { createPlanFromTemplate } from './createPlanFromTemplate';
import { deleteSession } from './deleteSession';
import { discardSession } from './discardSession';
import { finishSession } from './finishSession';
import { insertDeload } from './insertDeload';
import { removeExercise } from './removeExercise';
import { revertIncrease } from './revertIncrease';
import { startPlan } from './startPlan';
import { startSession } from './startSession';
import { swapExercise } from './swapExercise';
import { updateSet } from './updateSet';

const CURL = 'skill_dumbbell_curl';

let db: Db;
let repos: Repositories;
let ctx: ServiceContext;

beforeEach(async () => {
  db = await openMigratedTestDb();
  repos = repositories(db);
  ctx = { today: START, now: '2026-09-14T17:00:00.000Z', newId: idSequence() };
  // AC-28: a 1 kg increment on the curl.
  await repos.skills.update(CURL, { loadIncrementKg: 1 });
});

afterEach(async () => {
  await db.closeAsync();
});

/** Full body A on Monday and Friday, with a curl at 3 × 8–12 @ RPE 8–9 (AC-28, AC-29, AC-56). */
async function aCurlPlan(phase = strength({ weeks: 12, cycle: 2 })) {
  const built = await aPlan()
    .startingOn(START)
    .withPhase(phase)
    .withWorkouts('Full body A', 'Full body B')
    .withExercises('Full body A', [
      {
        skill: CURL,
        sets: sets(3, {
          loadType: 'double_progression',
          loadPercent: null,
          repsMin: 8,
          repsMax: 12,
          targetRpeMin: 8,
          targetRpeMax: 9,
        }),
      },
    ])
    .withExercises('Full body B', [
      {
        skill: 'skill_plank',
        sets: sets(1, {
          loadType: 'bodyweight',
          loadPercent: null,
          repsMin: null,
          repsMax: null,
          targetTimeSec: 60,
          targetRpeMin: null,
          targetRpeMax: null,
        }),
      },
    ])
    .withSchedule({
      A: { Mon: 'Full body A', Wed: 'Full body B', Fri: 'Full body A' },
      B: { Mon: 'Full body A', Wed: 'Full body B', Fri: 'Full body A' },
    })
    .build(db);
  return built;
}

async function start(planId: string, c = ctx) {
  const started = await startPlan(db, { planId, startDate: START }, c);
  if (!started.ok) throw new Error(started.reason);
}

const reps = (...values: number[]): SetValues[] =>
  values.map((n) => ({ reps: n, loadKg: 15, rpe: 8 }));

/** The curl as the next session pre-fills it: its badge, and each set's load and reps. */
async function curlOn(planId: string, date: string) {
  const sessionId = await logDayStart(planId, date);
  const exercises = await repos.sessions.exercises(sessionId);
  const curl = exercises.find((e) => e.exercise.skillId === CURL)!;
  return {
    sessionId,
    exercise: curl.exercise,
    badgeKg: curl.exercise.dpIncreaseKg,
    sets: curl.sets.map((s) => [s.loadKg, s.reps]),
  };
}

async function logDayStart(planId: string, date: string): Promise<string> {
  const workout = (await repos.plannedWorkouts.listByPlan(planId)).find(
    (w) => w.scheduledDate === date,
  )!;
  const started = await startSession(db, { plannedWorkoutId: workout.id }, on(ctx, date));
  if (!started.ok) throw new Error(started.reason);
  return started.sessionId;
}

/** A plan's cycle exercises of a skill; the seeded templates have their own. */
const PLAN_EXERCISES = `SELECT e.id, e.cycle_workout_id FROM cycle_exercise e
  JOIN cycle_workout w ON w.id = e.cycle_workout_id
  JOIN phase p ON p.id = w.phase_id
  WHERE p.plan_id IS NOT NULL AND e.skill_id = ?`;

async function curlTrack(): Promise<DoubleProgressionState> {
  const [exercise] = await db.getAllAsync<{ id: string }>(
    `${PLAN_EXERCISES} AND e.source_cycle_exercise_id IS NULL`,
    [CURL],
  );
  const row = (await repos.progression.getMany([exercise!.id])).get(exercise!.id);
  if (!row) throw new Error('No track');
  return row;
}

describe('AC-28 Double progression increase', () => {
  it('pre-fills 16 kg × 8 with a "↑ +1 kg" badge, and one tap reverts it', async () => {
    const { planId } = await aCurlPlan();
    await start(planId);
    await logAndFinish(db, planId, MON, ctx, { [CURL]: reps(12, 12, 12) });

    const friday = await curlOn(planId, FRI);
    expect(friday.badgeKg).toBe(1);
    expect(friday.sets).toEqual([
      [16, 8],
      [16, 8],
      [16, 8],
    ]);

    const reverted = await revertIncrease(
      db,
      { sessionExerciseId: friday.exercise.id },
      on(ctx, FRI),
    );
    expect(reverted).toEqual({ ok: true });
    const after = await repos.sessions.exercises(friday.sessionId);
    expect(after[0]!.exercise.dpIncreaseKg).toBeNull();
    // As if the increase hadn't happened: 15 kg and last session's reps.
    expect(after[0]!.sets.map((s) => [s.prescribedLoadKg, s.loadKg, s.reps])).toEqual([
      [15, 15, 12],
      [15, 15, 12],
      [15, 15, 12],
    ]);
    expect(await curlTrack()).toMatchObject({ workingLoadKg: 15, lastIncreaseSessionId: null });
  });
});

describe('AC-29 Double progression hold', () => {
  it('keeps 15 kg and pre-fills 12, 11 and 10 reps', async () => {
    const { planId } = await aCurlPlan();
    await start(planId);
    await logAndFinish(db, planId, MON, ctx, { [CURL]: reps(12, 11, 10) });

    const friday = await curlOn(planId, FRI);
    expect(friday.badgeKg).toBeNull();
    expect(friday.sets).toEqual([
      [15, 12],
      [15, 11],
      [15, 10],
    ]);
  });
});

describe('AC-56 Double progression after an edited session', () => {
  it('pre-fills 16 kg with reps 10, 9 and 9, and no increase badge', async () => {
    const { planId } = await aCurlPlan();
    await start(planId);
    await logAndFinish(db, planId, MON, ctx, {
      [CURL]: [
        { reps: 10, loadKg: 15, rpe: 8 },
        { reps: 9, loadKg: 16, rpe: 8 },
        { reps: 9, loadKg: 16, rpe: 8 },
      ],
    });

    const friday = await curlOn(planId, FRI);
    expect(friday.badgeKg).toBeNull();
    expect(friday.sets).toEqual([
      [16, 10],
      [16, 9],
      [16, 9],
    ]);
  });
});

describe('AC-64 Shared workout progression', () => {
  const ONE_RMS = {
    skill_back_squat: 110,
    skill_bench_press: 90,
    skill_deadlift: 140,
    skill_overhead_press: 55,
  };

  async function hypertrophy(c: ServiceContext): Promise<string> {
    const created = await createPlanFromTemplate(db, { templateId: 'tpl_beginner_hypertrophy' }, c);
    if (!created.ok) throw new Error(created.reason);
    const started = await startPlan(
      db,
      { planId: created.planId, startDate: START, oneRms: ONE_RMS },
      c,
    );
    if (!started.ok) throw new Error(started.reason);
    return created.planId;
  }

  /** The template's accessories have no load until their first session (§3.12). */
  const accessories = (curlReps: number, more: Record<string, SetValues> = {}) => ({
    [CURL]: { reps: curlReps, loadKg: 15, rpe: 8 },
    skill_barbell_row: { reps: 10, loadKg: 50, rpe: 8 },
    ...more,
  });

  it("gives Friday's Full body A 16 kg × 10 with a badge after Monday's curls reach 15", async () => {
    const planId = await hypertrophy(ctx);
    await logAndFinish(db, planId, MON, ctx, accessories(15));

    const friday = await curlOn(planId, FRI);
    expect(friday.badgeKg).toBe(1);
    expect(friday.sets).toEqual([
      [16, 10],
      [16, 10],
      [16, 10],
    ]);
  });

  it('changes every open appearance of Full body A when its exercises are edited', async () => {
    const planId = await hypertrophy(ctx);
    const [curl] = await db.getAllAsync<{ id: string; cycle_workout_id: string }>(PLAN_EXERCISES, [
      CURL,
    ]);
    // An edit to the workout's definition (Slice 12's builder writes the same rows).
    await repos.blueprints.insertExercise({
      id: 'lateral_raise',
      cycleWorkoutId: curl!.cycle_workout_id,
      skillId: 'skill_lateral_raise',
      sortOrder: 99,
      supersetGroup: null,
      restSec: 60,
      notes: null,
      sourceCycleExerciseId: null,
    });
    await repos.blueprints.insertSet({
      id: 'lateral_raise_1',
      cycleExerciseId: 'lateral_raise',
      setIndex: 1,
      isWarmup: false,
      repsMin: 12,
      repsMax: 15,
      isAmrap: false,
      targetRpeMin: null,
      targetRpeMax: null,
      loadType: 'double_progression',
      loadPercent: null,
      fixedLoadKg: null,
      targetTimeSec: null,
    });

    for (const date of [MON, FRI]) {
      await logAndFinish(
        db,
        planId,
        date,
        ctx,
        accessories(12, { skill_lateral_raise: { reps: 12, loadKg: 6, rpe: 8 } }),
      );
      const [session] = await db.getAllAsync<{ id: string }>(
        `SELECT session_id AS id FROM planned_workout WHERE plan_id = ? AND scheduled_date = ?`,
        [planId, date],
      );
      const skills = (await repos.sessions.exercises(session!.id)).map((e) => e.exercise.skillId);
      expect(skills).toContain('skill_lateral_raise');
    }
  });

  it('keeps the session, its completion, its PRs and the shared track after a force-close', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'wp-ac64-'));
    const file = join(dir, 'app.db');
    try {
      const first = await openMigratedTestDb(file);
      const r = repositories(first);
      await r.skills.update(CURL, { loadIncrementKg: 1 });
      const created = await createPlanFromTemplate(
        first,
        { templateId: 'tpl_beginner_hypertrophy' },
        ctx,
      );
      if (!created.ok) throw new Error(created.reason);
      const planId = created.planId;
      await startPlan(first, { planId, startDate: START, oneRms: ONE_RMS }, ctx);
      const { sessionId, prs } = await logAndFinish(first, planId, MON, ctx, accessories(15));
      await first.closeAsync();

      const reopened = await openMigratedTestDb(file);
      try {
        const again = repositories(reopened);
        expect(await again.sessions.get(sessionId)).toMatchObject({ status: 'completed' });
        const monday = (await again.plannedWorkouts.listByPlan(planId)).find(
          (w) => w.scheduledDate === MON,
        );
        expect(monday).toMatchObject({ status: 'completed', sessionId });
        expect(await again.prs.bySession(sessionId)).toEqual(prs);
        const [curl] = await reopened.getAllAsync<{ working_load_kg: number }>(
          `SELECT working_load_kg FROM double_progression_state s
             JOIN cycle_exercise e ON e.id = s.cycle_exercise_id WHERE e.skill_id = ?`,
          [CURL],
        );
        expect(curl!.working_load_kg).toBe(16);
      } finally {
        await reopened.closeAsync();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('startPlan (§8.1 step 5)', () => {
  it('creates an empty track for each double-progression exercise', async () => {
    const { planId } = await aCurlPlan();
    await start(planId);
    expect(await curlTrack()).toMatchObject({
      planId,
      workingLoadKg: null,
      lastReps: [],
      consecutiveBelowMin: 0,
    });
    const rows = await db.getAllAsync('SELECT * FROM double_progression_state');
    expect(rows).toHaveLength(1);
  });
});

describe('startSession with double progression (§3.12)', () => {
  it("uses the skill's last logged load, at the bottom of the range, before the track has one", async () => {
    const { planId } = await aCurlPlan();
    await start(planId);
    const first = await curlOn(planId, MON);
    expect(first.sets).toEqual([
      [null, 8],
      [null, 8],
      [null, 8],
    ]);
    expect(first.badgeKg).toBeNull();
  });

  it('shows no badge once the increase has been lifted', async () => {
    const { planId } = await aCurlPlan();
    await start(planId);
    await logAndFinish(db, planId, MON, ctx, { [CURL]: reps(12, 12, 12) });
    const at16 = (n: number) => ({ reps: n, loadKg: 16, rpe: 8 });
    await logAndFinish(db, planId, FRI, ctx, { [CURL]: [at16(9), at16(9), at16(8)] });
    const next = await curlOn(planId, NEXT_MON);
    expect(next.badgeKg).toBeNull();
    expect(next.sets).toEqual([
      [16, 9],
      [16, 9],
      [16, 8],
    ]);
  });
});

describe('Double progression is paused in a deload (FR-2.12, FR-3.15, D-9)', () => {
  it("pre-fills the source track's load × the factor at the bottom of the range, and writes nothing", async () => {
    const { planId } = await aCurlPlan(strength({ weeks: 2, cycle: 1 }));
    const inserted = await insertDeload(db, { planId, afterWeek: 1 }, ctx);
    if (!inserted.ok) throw new Error(inserted.reason);
    await start(planId);
    await logAndFinish(db, planId, MON, ctx, { [CURL]: reps(12, 11, 10) });
    const before = await curlTrack();

    const deload = await curlOn(planId, NEXT_MON);
    const phase = await repos.blueprints.phase(inserted.deloadPhaseId);
    expect(phase!.loadFactor).toBe(0.9);
    // 15 × 0.9 = 13.5 → 13 on the 1 kg grid (ties round down, FR-3.6).
    expect(deload.sets[0]).toEqual([13, 8]);
    expect(deload.badgeKg).toBeNull();

    const finished = await finishSession(
      db,
      { sessionId: deload.sessionId },
      on(ctx, NEXT_MON, '18:00'),
    );
    expect(finished.ok).toBe(true);
    expect(await curlTrack()).toEqual(before);
  });
});

describe('C-10 no update for a substituted exercise', () => {
  it('leaves the track alone when the curl was swapped before any set was done', async () => {
    const { planId } = await aCurlPlan();
    await start(planId);
    const monday = await curlOn(planId, MON);
    const swapped = await swapExercise(
      db,
      { sessionExerciseId: monday.exercise.id, skillId: 'skill_wrist_curl' },
      on(ctx, MON),
    );
    if (!swapped.ok) throw new Error(swapped.reason);
    for (const set of (await repos.sessions.exercises(monday.sessionId))[0]!.sets) {
      const done = await completeSet(
        db,
        { setLogId: set.id, reps: 12, loadKg: 15, rpe: 8 },
        on(ctx, MON),
      );
      expect(done.ok).toBe(true);
    }
    const finished = await finishSession(
      db,
      { sessionId: monday.sessionId },
      on(ctx, MON, '18:00'),
    );
    expect(finished.ok).toBe(true);
    expect(await curlTrack()).toMatchObject({ workingLoadKg: null, lastReps: [] });
  });
});

describe('History edits and deletes replay the track (C-4, D-42)', () => {
  it('drops the increase when a past set is edited below the top of the range', async () => {
    const { planId } = await aCurlPlan();
    await start(planId);
    const { sessionId } = await logAndFinish(db, planId, MON, ctx, { [CURL]: reps(12, 12, 12) });
    expect(await curlTrack()).toMatchObject({ workingLoadKg: 16 });

    const [curl] = await repos.sessions.exercises(sessionId);
    const edited = await updateSet(db, { setLogId: curl!.sets[2]!.id, reps: 10 }, on(ctx, FRI));
    expect(edited).toEqual({ ok: true });
    expect(await curlTrack()).toMatchObject({
      workingLoadKg: 15,
      lastIncreaseSessionId: null,
      lastReps: [12, 12, 10],
    });
  });

  it('rebuilds from the sessions left when one is deleted', async () => {
    const { planId } = await aCurlPlan();
    await start(planId);
    const monday = await logAndFinish(db, planId, MON, ctx, { [CURL]: reps(12, 12, 12) });
    const at16 = (n: number) => ({ reps: n, loadKg: 16, rpe: 8 });
    const friday = await logAndFinish(db, planId, FRI, ctx, {
      [CURL]: [at16(9), at16(8), at16(8)],
    });
    expect(await curlTrack()).toMatchObject({ workingLoadKg: 16, lastIncreaseSessionId: null });

    expect(await deleteSession(db, { sessionId: friday.sessionId }, on(ctx, FRI))).toEqual({
      ok: true,
    });
    // Back to the state Monday left: the increase is waiting again.
    expect(await curlTrack()).toMatchObject({
      workingLoadKg: 16,
      previousWorkingLoadKg: 15,
      lastIncreaseSessionId: monday.sessionId,
      lastReps: [12, 12, 12],
    });

    await deleteSession(db, { sessionId: monday.sessionId }, on(ctx, FRI));
    expect(await curlTrack()).toMatchObject({ workingLoadKg: null, lastReps: [] });
  });

  it('replays the track of an exercise removed from a past session', async () => {
    const { planId } = await aCurlPlan();
    await start(planId);
    const { sessionId } = await logAndFinish(db, planId, MON, ctx, { [CURL]: reps(12, 12, 12) });
    const [curl] = await repos.sessions.exercises(sessionId);
    expect(
      await removeExercise(db, { sessionExerciseId: curl!.exercise.id }, on(ctx, FRI)),
    ).toEqual({ ok: true });
    expect(await curlTrack()).toMatchObject({ workingLoadKg: null, lastIncreaseSessionId: null });
  });

  it('keeps a reverted increase reverted when a past session is edited (D-44)', async () => {
    const { planId } = await aCurlPlan();
    await start(planId);
    const monday = await logAndFinish(db, planId, MON, ctx, { [CURL]: reps(12, 12, 12) });
    const friday = await curlOn(planId, FRI);
    await revertIncrease(db, { sessionExerciseId: friday.exercise.id }, on(ctx, FRI));
    await discardSession(db, { sessionId: friday.sessionId }, on(ctx, FRI));

    const [curl] = await repos.sessions.exercises(monday.sessionId);
    await updateSet(db, { setLogId: curl!.sets[0]!.id, rpe: 8.5 }, on(ctx, FRI));
    expect(await curlTrack()).toMatchObject({
      workingLoadKg: 15,
      lastIncreaseSessionId: null,
      revertedIncreaseSessionId: monday.sessionId,
    });
  });

  it('leaves the track alone for a note on a past session', async () => {
    const { planId } = await aCurlPlan();
    await start(planId);
    const monday = await logAndFinish(db, planId, MON, ctx, { [CURL]: reps(12, 12, 12) });
    const before = await curlTrack();
    const [curl] = await repos.sessions.exercises(monday.sessionId);
    const { updateExerciseNote } = jest.requireActual('./updateExerciseNote');
    await updateExerciseNote(db, { sessionExerciseId: curl!.exercise.id, notes: 'Easy' }, ctx);
    expect(await curlTrack()).toEqual(before);
  });

  it('leaves the track alone for an edit to a session still in progress', async () => {
    const { planId } = await aCurlPlan();
    await start(planId);
    const sessionId = await logDay(db, planId, MON, ctx, { [CURL]: reps(12, 12, 12) });
    const [curl] = await repos.sessions.exercises(sessionId);
    await updateSet(db, { setLogId: curl!.sets[0]!.id, reps: 11 }, on(ctx, MON));
    expect(await curlTrack()).toMatchObject({ workingLoadKg: null });
  });
});

describe('revertIncrease (FR-3.15, §7.6 ⋯ menu)', () => {
  it('refuses when there is no increase to revert', async () => {
    const { planId } = await aCurlPlan();
    await start(planId);
    const monday = await curlOn(planId, MON);
    expect(
      await revertIncrease(db, { sessionExerciseId: monday.exercise.id }, on(ctx, MON)),
    ).toEqual({ ok: false, reason: 'nothing_to_revert' });
    expect(await revertIncrease(db, { sessionExerciseId: 'nope' }, on(ctx, MON))).toEqual({
      ok: false,
      reason: 'not_found',
    });
  });

  it('keeps sets already done at the new load, and only resets the ones still to do', async () => {
    const { planId } = await aCurlPlan();
    await start(planId);
    await logAndFinish(db, planId, MON, ctx, { [CURL]: reps(12, 12, 12) });
    const friday = await curlOn(planId, FRI);
    const [firstSet] = (await repos.sessions.exercises(friday.sessionId))[0]!.sets;
    await db.runAsync(`UPDATE set_log SET status = 'completed', completed_at = ? WHERE id = ?`, [
      ctx.now,
      firstSet!.id,
    ]);

    await revertIncrease(db, { sessionExerciseId: friday.exercise.id }, on(ctx, FRI));
    const sets = (await repos.sessions.exercises(friday.sessionId))[0]!.sets;
    expect(sets.map((s) => [s.status, s.loadKg, s.reps])).toEqual([
      ['completed', 16, 8],
      ['pending', 15, 12],
      ['pending', 15, 12],
    ]);
  });

  it('clears a badge the track no longer backs, and re-fills from the track as it is', async () => {
    const { planId } = await aCurlPlan();
    await start(planId);
    const monday = await logAndFinish(db, planId, MON, ctx, { [CURL]: reps(12, 12, 12) });
    const friday = await curlOn(planId, FRI);
    // History edit while Friday is under way: Monday no longer earns the increase.
    const [curl] = await repos.sessions.exercises(monday.sessionId);
    await updateSet(db, { setLogId: curl!.sets[2]!.id, reps: 10 }, on(ctx, FRI));

    expect(
      await revertIncrease(db, { sessionExerciseId: friday.exercise.id }, on(ctx, FRI)),
    ).toEqual({ ok: true });
    const after = (await repos.sessions.exercises(friday.sessionId))[0]!;
    expect(after.exercise.dpIncreaseKg).toBeNull();
    expect(after.sets.map((s) => [s.loadKg, s.reps])).toEqual([
      [15, 12],
      [15, 12],
      [15, 10],
    ]);
  });

  it('leaves a top set in the same exercise alone', async () => {
    const bench = 'skill_bench_press';
    const backOff = {
      loadType: 'double_progression' as const,
      loadPercent: null,
      repsMin: 8,
      repsMax: 12,
      targetRpeMin: 8,
      targetRpeMax: 9,
    };
    const built = await aPlan('top')
      .startingOn(START)
      .withWorkouts('Heavy')
      .withExercises('Heavy', [{ skill: bench, sets: [topSet(), ...sets(2, backOff)] }])
      .withSchedule({ A: { Mon: 'Heavy', Fri: 'Heavy' }, B: { Mon: 'Heavy', Fri: 'Heavy' } })
      .withOneRm(bench, 100)
      .build(db);
    await start(built.planId);
    await logAndFinish(db, built.planId, MON, ctx, {
      [bench]: [
        { reps: 3, loadKg: 90, rpe: 8 },
        { reps: 12, loadKg: 60, rpe: 8 },
        { reps: 12, loadKg: 60, rpe: 8 },
      ],
    });
    const fridayId = await logDayStart(built.planId, FRI);
    const [before] = await repos.sessions.exercises(fridayId);
    expect(before!.exercise.dpIncreaseKg).toBe(2.5);
    const topBefore = before!.sets[0]!;

    await revertIncrease(db, { sessionExerciseId: before!.exercise.id }, on(ctx, FRI));
    const [after] = await repos.sessions.exercises(fridayId);
    expect(after!.sets[0]).toEqual(topBefore);
    expect(after!.sets.slice(1).map((s) => [s.loadKg, s.reps])).toEqual([
      [60, 12],
      [60, 12],
    ]);
  });

  it('refuses once the session is finished', async () => {
    const { planId } = await aCurlPlan();
    await start(planId);
    await logAndFinish(db, planId, MON, ctx, { [CURL]: reps(12, 12, 12) });
    const friday = await logAndFinish(db, planId, FRI, ctx);
    const [curl] = await repos.sessions.exercises(friday.sessionId);
    expect(
      await revertIncrease(db, { sessionExerciseId: curl!.exercise.id }, on(ctx, FRI)),
    ).toEqual({ ok: false, reason: 'not_in_progress' });
  });
});
