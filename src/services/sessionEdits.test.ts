// Changing a session while it is in progress (DESIGN §7.6, §8.2; FR-9.4, FR-9.7, FR-9.13,
// FR-9.14, FR-9.15). None of these change the plan: they are for this session only.
import type { Db } from '@/data/db';
import { repositories, type Repositories } from '@/data/repositories';

import { openMigratedTestDb } from '../../test/db/betterSqlite3';
import { idSequence } from '../../test/fixtures/ids';
import { aStartedPlan, START } from '../../test/fixtures/sessions';
import { addExercise } from './addExercise';
import { addSet } from './addSet';
import { completeSet } from './completeSet';
import type { ServiceContext } from './context';
import { deleteSet } from './deleteSet';
import { finishSession } from './finishSession';
import { markSetFailed } from './markSetFailed';
import { markSetWarmup } from './markSetWarmup';
import { removeExercise } from './removeExercise';
import { startAdHocSession } from './startAdHocSession';
import { startSession } from './startSession';
import { swapExercise } from './swapExercise';
import { updateExerciseNote } from './updateExerciseNote';
import { updateSessionDetails } from './updateSessionDetails';

let db: Db;
let repos: Repositories;
let ctx: ServiceContext;

const LATER = '2026-09-14T17:40:00.000Z';

beforeEach(async () => {
  db = await openMigratedTestDb();
  repos = repositories(db);
  ctx = { today: START, now: '2026-09-14T17:30:00.000Z', newId: idSequence() };
});

afterEach(async () => {
  await db.closeAsync();
});

/** Monday's Full body A, started: squat (warm-up + 3), press, row, plank. */
async function mondaySession() {
  const { planId } = await aStartedPlan(db, ctx);
  const [monday] = await repos.plannedWorkouts.listByPlan(planId);
  const started = await startSession(db, { plannedWorkoutId: monday!.id }, ctx);
  if (!started.ok) throw new Error(started.reason);
  const exercises = await repos.sessions.exercises(started.sessionId);
  return { sessionId: started.sessionId, exercises, plannedWorkoutId: monday!.id };
}

const indexes = async (exerciseId: string) =>
  (await repos.sessions.setsOf(exerciseId)).map((s) => [s.setIndex, s.isWarmup, s.id]);

describe('addSet (FR-9.4, FR-9.14)', () => {
  it('adds a working set after the last, pre-filled like it', async () => {
    const { exercises } = await mondaySession();
    const squat = exercises[0]!;
    const result = await addSet(db, { sessionExerciseId: squat.exercise.id }, ctx);
    if (!result.ok) throw new Error(result.reason);

    const sets = await repos.sessions.setsOf(squat.exercise.id);
    expect(sets).toHaveLength(5);
    expect(sets[4]).toMatchObject({
      id: result.setLogId,
      setIndex: 5,
      isWarmup: false,
      prescribedLoadKg: 90,
      loadKg: 90,
      reps: 5,
      status: 'pending',
    });
  });

  it('adds a warm-up after the existing warm-ups and renumbers the rest', async () => {
    const { exercises } = await mondaySession();
    const squat = exercises[0]!;
    const [warmup, a, b, c] = squat.sets.map((s) => s.id);
    const result = await addSet(db, { sessionExerciseId: squat.exercise.id, warmup: true }, ctx);
    if (!result.ok) throw new Error(result.reason);

    expect(await indexes(squat.exercise.id)).toEqual([
      [1, true, warmup],
      [2, true, result.setLogId],
      [3, false, a],
      [4, false, b],
      [5, false, c],
    ]);
  });
});

describe('deleteSet (FR-9.4)', () => {
  it('removes the set and closes the gap', async () => {
    const { exercises } = await mondaySession();
    const squat = exercises[0]!;
    const [warmup, a, , c] = squat.sets.map((s) => s.id);
    expect(await deleteSet(db, { setLogId: squat.sets[2]!.id }, ctx)).toEqual({ ok: true });
    expect(await indexes(squat.exercise.id)).toEqual([
      [1, true, warmup],
      [2, false, a],
      [3, false, c],
    ]);
  });
});

describe('AC-38 Warm-ups and failed sets', () => {
  it('marks a set as a warm-up, which then completes without an RPE', async () => {
    const { exercises } = await mondaySession();
    const set = exercises[0]!.sets[1]!;
    expect(await markSetWarmup(db, { setLogId: set.id, isWarmup: true }, ctx)).toEqual({
      ok: true,
    });
    expect(await completeSet(db, { setLogId: set.id }, ctx)).toEqual({ ok: true });
  });

  it('will not turn a completed warm-up of a main lift into a working set with no RPE', async () => {
    const { exercises } = await mondaySession();
    const warmup = exercises[0]!.sets[0]!;
    await completeSet(db, { setLogId: warmup.id }, ctx);
    expect(await markSetWarmup(db, { setLogId: warmup.id, isWarmup: false }, ctx)).toEqual({
      ok: false,
      reason: 'rpe_required',
    });
  });

  it('keeps a failed single visible, with its values, and out of volume and set counts', async () => {
    const { sessionId, exercises } = await mondaySession();
    const squat = exercises[0]!;
    const added = await addSet(db, { sessionExerciseId: squat.exercise.id }, ctx);
    if (!added.ok) throw new Error(added.reason);
    await completeSet(db, { setLogId: added.setLogId, reps: 1, loadKg: 150, rpe: 10 }, ctx);
    expect(
      await markSetFailed(db, { setLogId: added.setLogId, failed: true }, { ...ctx, now: LATER }),
    ).toEqual({ ok: true });
    expect(await repos.sessions.getSet(added.setLogId)).toMatchObject({
      status: 'failed',
      reps: 1,
      loadKg: 150,
      completedAt: LATER,
    });

    for (const s of squat.sets.slice(1)) await completeSet(db, { setLogId: s.id, rpe: 8 }, ctx);
    const finished = await finishSession(db, { sessionId }, ctx);
    // 3 × 5 × 90; the failed 150 kg single adds nothing
    expect(finished).toMatchObject({ ok: true, summary: { volumeKg: 1350, setsCompleted: 3 } });
  });

  it('un-fails a set back to pending', async () => {
    const { exercises } = await mondaySession();
    const set = exercises[0]!.sets[1]!;
    await markSetFailed(db, { setLogId: set.id, failed: true }, ctx);
    await markSetFailed(db, { setLogId: set.id, failed: false }, ctx);
    expect(await repos.sessions.getSet(set.id)).toMatchObject({
      status: 'pending',
      completedAt: null,
    });
  });
});

describe('swapExercise (FR-9.4)', () => {
  it('swaps in another skill for this session, carrying the sets over', async () => {
    const { exercises } = await mondaySession();
    const press = exercises[1]!;
    const result = await swapExercise(
      db,
      { sessionExerciseId: press.exercise.id, skillId: 'skill_lateral_raise' },
      ctx,
    );
    expect(result).toEqual({ ok: true });

    const [swapped] = (await repos.sessions.exercises(press.exercise.sessionId)).filter(
      (e) => e.exercise.id === press.exercise.id,
    );
    expect(swapped!.exercise).toMatchObject({
      skillId: 'skill_lateral_raise',
      wasSubstituted: true,
      cycleExerciseId: press.exercise.cycleExerciseId,
      loadConvention: 'per_side',
      isMainLift: false,
      tmSnapshotKg: null,
    });
    expect(swapped!.sets.map((s) => [s.reps, s.loadKg])).toEqual([
      [10, 30],
      [10, 30],
    ]);
  });

  it('clears values the new skill does not track from sets still to do', async () => {
    const { exercises } = await mondaySession();
    const squat = exercises[0]!;
    await completeSet(db, { setLogId: squat.sets[1]!.id, rpe: 8 }, ctx);
    await swapExercise(db, { sessionExerciseId: squat.exercise.id, skillId: 'skill_push_up' }, ctx);

    const sets = await repos.sessions.setsOf(squat.exercise.id);
    // The done set keeps what was logged; the rest keep reps but lose the load.
    expect(sets.map((s) => [s.status, s.reps, s.loadKg])).toEqual([
      ['pending', 5, null],
      ['completed', 5, 90],
      ['pending', 5, null],
      ['pending', 5, null],
    ]);
  });

  it('refuses an unknown or archived skill', async () => {
    const { exercises } = await mondaySession();
    const id = exercises[1]!.exercise.id;
    expect(await swapExercise(db, { sessionExerciseId: id, skillId: 'nope' }, ctx)).toEqual({
      ok: false,
      reason: 'skill_not_found',
    });
    await repos.skills.update('skill_lateral_raise', { isArchived: true });
    expect(
      await swapExercise(db, { sessionExerciseId: id, skillId: 'skill_lateral_raise' }, ctx),
    ).toEqual({ ok: false, reason: 'skill_not_found' });
  });
});

describe('addExercise and removeExercise (FR-9.4)', () => {
  it('adds an unplanned exercise at the end with one blank set', async () => {
    const { sessionId } = await mondaySession();
    const result = await addExercise(db, { sessionId, skillId: 'skill_face_pull' }, ctx);
    if (!result.ok) throw new Error(result.reason);

    const exercises = await repos.sessions.exercises(sessionId);
    const added = exercises.at(-1)!;
    expect(added.exercise).toMatchObject({
      id: result.sessionExerciseId,
      skillId: 'skill_face_pull',
      sortOrder: 5,
      wasAdded: true,
      cycleExerciseId: null,
      tmSnapshotKg: null,
      trackingType: 'weight_reps',
    });
    expect(added.sets.map((s) => [s.setIndex, s.reps, s.loadKg, s.status])).toEqual([
      [1, null, null, 'pending'],
    ]);
  });

  it('removes an exercise and its sets', async () => {
    const { sessionId, exercises } = await mondaySession();
    expect(await removeExercise(db, { sessionExerciseId: exercises[3]!.exercise.id }, ctx)).toEqual(
      { ok: true },
    );
    expect((await repos.sessions.exercises(sessionId)).map((e) => e.exercise.skillId)).toEqual([
      'skill_back_squat',
      'skill_incline_dumbbell_press',
      'skill_dumbbell_row',
    ]);
  });
});

describe('AC-40 Weighted pull-up', () => {
  it('logs +20 kg × 5 as added load, which adds no volume', async () => {
    const { sessionId } = await mondaySession();
    const added = await addExercise(db, { sessionId, skillId: 'skill_pull_up' }, ctx);
    if (!added.ok) throw new Error(added.reason);
    const [set] = await repos.sessions.setsOf(added.sessionExerciseId);
    expect(await completeSet(db, { setLogId: set!.id, reps: 5, loadKg: 20 }, ctx)).toEqual({
      ok: true,
    });
    expect(await repos.sessions.getSet(set!.id)).toMatchObject({ reps: 5, loadKg: 20 });

    const finished = await finishSession(db, { sessionId }, ctx);
    expect(finished).toMatchObject({ ok: true, summary: { volumeKg: 0, setsCompleted: 1 } });
  });

  it.todo('records a "heaviest added load" PR and computes no e1RM (Slice 7)');
});

describe('notes and effort (FR-9.7)', () => {
  it('saves a note per exercise and a note and effort rating per session', async () => {
    const { sessionId, exercises } = await mondaySession();
    expect(
      await updateExerciseNote(
        db,
        { sessionExerciseId: exercises[0]!.exercise.id, notes: 'Belt from set 2' },
        ctx,
      ),
    ).toEqual({ ok: true });
    expect(
      await updateSessionDetails(db, { sessionId, notes: 'Felt strong', rpe: 7 }, ctx),
    ).toEqual({ ok: true });

    expect((await repos.sessions.getExercise(exercises[0]!.exercise.id))!.notes).toBe(
      'Belt from set 2',
    );
    expect(await repos.sessions.get(sessionId)).toMatchObject({ notes: 'Felt strong', rpe: 7 });
  });

  it('can still rate and note a session on its summary, after it finished (§7.7)', async () => {
    const { sessionId } = await mondaySession();
    await finishSession(db, { sessionId }, ctx);
    expect(await updateSessionDetails(db, { sessionId, rpe: 8 }, ctx)).toEqual({ ok: true });
    expect((await repos.sessions.get(sessionId))!.rpe).toBe(8);
  });

  it('keeps a blank note as none, and refuses an effort outside 1–10', async () => {
    const { sessionId } = await mondaySession();
    await updateSessionDetails(db, { sessionId, notes: '   ' }, ctx);
    expect((await repos.sessions.get(sessionId))!.notes).toBeNull();
    for (const rpe of [0, 11, 7.5]) {
      expect(await updateSessionDetails(db, { sessionId, rpe }, ctx)).toEqual({
        ok: false,
        reason: 'bad_rpe',
      });
    }
    expect(await updateSessionDetails(db, { sessionId: 'nope' }, ctx)).toEqual({
      ok: false,
      reason: 'not_found',
    });
  });
});

describe('startAdHocSession (FR-9.13)', () => {
  it('starts a session that belongs to no plan', async () => {
    const result = await startAdHocSession(db, {}, ctx);
    if (!result.ok) throw new Error(result.reason);
    expect(await repos.sessions.get(result.sessionId)).toMatchObject({
      planId: null,
      plannedWorkoutId: null,
      kind: 'ad_hoc',
      name: 'Workout',
      localDate: START,
      status: 'in_progress',
    });
    expect(await repos.sessions.exercises(result.sessionId)).toEqual([]);
  });

  it('is refused while another session is in progress', async () => {
    await mondaySession();
    expect(await startAdHocSession(db, { name: 'Arms' }, ctx)).toEqual({
      ok: false,
      reason: 'session_in_progress',
    });
  });
});

describe('edits after a session has finished', () => {
  it('are refused; past sessions are edited from History (FR-9.12)', async () => {
    const { sessionId, exercises } = await mondaySession();
    await finishSession(db, { sessionId }, ctx);
    const exerciseId = exercises[0]!.exercise.id;
    const setLogId = exercises[0]!.sets[0]!.id;
    const refused = { ok: false, reason: 'session_not_in_progress' };

    expect(await addSet(db, { sessionExerciseId: exerciseId }, ctx)).toEqual(refused);
    expect(await deleteSet(db, { setLogId }, ctx)).toEqual(refused);
    expect(await markSetWarmup(db, { setLogId, isWarmup: false }, ctx)).toEqual(refused);
    expect(await markSetFailed(db, { setLogId, failed: true }, ctx)).toEqual(refused);
    expect(
      await swapExercise(db, { sessionExerciseId: exerciseId, skillId: 'skill_front_squat' }, ctx),
    ).toEqual(refused);
    expect(await addExercise(db, { sessionId, skillId: 'skill_front_squat' }, ctx)).toEqual(
      refused,
    );
    expect(await removeExercise(db, { sessionExerciseId: exerciseId }, ctx)).toEqual(refused);
    expect(
      await updateExerciseNote(db, { sessionExerciseId: exerciseId, notes: 'x' }, ctx),
    ).toEqual(refused);
  });
});
