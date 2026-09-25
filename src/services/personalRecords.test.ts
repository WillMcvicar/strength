// PRs through the services (DESIGN §3.13, §4.4, §8.2): detection on finish, replay after a past
// session is edited or deleted, and the 1RM left alone (FR-10.1, FR-10.5, FR-9.12, FR-3.10).
import { rpeRequired, type PersonalRecord } from '@/core';
import type { Db } from '@/data/db';
import { repositories, type Repositories } from '@/data/repositories';

import { openMigratedTestDb } from '../../test/db/betterSqlite3';
import { idSequence } from '../../test/fixtures/ids';
import { aStartedPlan, START } from '../../test/fixtures/sessions';
import { addSet } from './addSet';
import { completeSet } from './completeSet';
import type { ServiceContext } from './context';
import { deleteSession } from './deleteSession';
import { deleteSet } from './deleteSet';
import { finishSession } from './finishSession';
import { markSetFailed } from './markSetFailed';
import { removeExercise } from './removeExercise';
import type { SetInput } from './setValues';
import { startSession } from './startSession';
import { swapExercise } from './swapExercise';
import { updateSet } from './updateSet';

let db: Db;
let repos: Repositories;
let ctx: ServiceContext;
let planId: string;

const MON = START; // Full body A: squat, dumbbell press, dumbbell row, plank
const WED = '2026-09-16'; // Full body B: bench, pull-up, run
const FRI = '2026-09-18'; // Full body A
const NEXT_MON = '2026-09-21'; // week B: Full body B

beforeEach(async () => {
  db = await openMigratedTestDb();
  repos = repositories(db);
  ctx = { today: START, now: `${START}T17:00:00.000Z`, newId: idSequence() };
  ({ planId } = await aStartedPlan(db, ctx));
});

afterEach(async () => {
  await db.closeAsync();
});

const on = (date: string, time = '17:00'): ServiceContext => ({
  ...ctx,
  today: date,
  now: `${date}T${time}:00.000Z`,
});

type Values = Omit<SetInput, 'setLogId'>;

/**
 * Starts the day's workout and logs every set: working sets of a skill in `values` take those
 * values, and everything else is done as planned. Returns the session, not yet finished.
 */
async function logDay(date: string, values: Record<string, Values> = {}): Promise<string> {
  const c = on(date);
  const workout = (await repos.plannedWorkouts.listByPlan(planId)).find(
    (w) => w.scheduledDate === date,
  )!;
  const started = await startSession(db, { plannedWorkoutId: workout.id }, c);
  if (!started.ok) throw new Error(started.reason);
  for (const { exercise, sets } of await repos.sessions.exercises(started.sessionId)) {
    for (const s of sets) {
      const given = s.isWarmup ? {} : (values[exercise.skillId] ?? {});
      const rpe = rpeRequired(exercise, s) ? (s.targetRpeMax ?? 8) : undefined;
      const done = await completeSet(db, { rpe, ...given, setLogId: s.id }, c);
      if (!done.ok) throw new Error(`${exercise.skillId}: ${done.reason}`);
    }
  }
  return started.sessionId;
}

async function logAndFinish(date: string, values: Record<string, Values> = {}) {
  const sessionId = await logDay(date, values);
  const finished = await finishSession(db, { sessionId }, on(date, '18:00'));
  if (!finished.ok) throw new Error(finished.reason);
  return { sessionId, prs: finished.prs };
}

const brief = (rows: readonly PersonalRecord[], skillId?: string) =>
  rows
    .filter((r) => skillId === undefined || r.skillId === skillId)
    .map((r) => [r.type, Math.round(r.value * 100) / 100, r.contextWeightKg]);

async function best(skillId: string, type: PersonalRecord['type']) {
  const rows = (await repos.prs.bySkills([skillId])).filter((r) => r.type === type);
  return rows.reduce<PersonalRecord | null>((b, r) => (!b || r.value > b.value ? r : b), null);
}

describe('AC-4 PR detection', () => {
  it('records heaviest and Est. 1RM PRs for 82.5 kg × 5 after a best of 80 kg × 5', async () => {
    const first = await logAndFinish(WED, { skill_bench_press: { loadKg: 80, reps: 5 } });
    // The first log sets the bench baseline (C-7).
    expect(brief(first.prs, 'skill_bench_press')).toEqual([
      ['heaviest', 80, null],
      ['e1rm', 98.67, null], // 80 × (1 + (5 + 2)/30) at RPE 8
      ['reps_at_weight', 5, 80],
    ]);

    const second = await logAndFinish(NEXT_MON, { skill_bench_press: { loadKg: 82.5, reps: 5 } });
    expect(brief(second.prs, 'skill_bench_press')).toEqual([
      ['heaviest', 82.5, null],
      ['e1rm', 101.75, null], // 82.5 × (1 + 7/30)
      ['reps_at_weight', 5, 82.5],
    ]);
    // Stored: each row points at the set that set it.
    const stored = await repos.prs.bySession(second.sessionId);
    expect(stored).toEqual(second.prs);
    expect(stored.every((r) => r.setLogId !== null && !r.isManual)).toBe(true);
  });

  it('records nothing for a session that only equals the bests', async () => {
    await logAndFinish(WED, { skill_bench_press: { loadKg: 80, reps: 5 } });
    const again = await logAndFinish(NEXT_MON, { skill_bench_press: { loadKg: 80, reps: 5 } });
    expect(brief(again.prs, 'skill_bench_press')).toEqual([]);
  });

  it('records no PRs from warm-ups or failed sets (FR-9.14, FR-9.15)', async () => {
    const sessionId = await logDay(MON);
    const [squat] = await repos.sessions.exercises(sessionId);
    // A heavy failed attempt, and a working set turned into a failed one.
    const last = squat!.sets.at(-1)!;
    await updateSet(db, { setLogId: last.id, loadKg: 150 }, on(MON));
    await markSetFailed(db, { setLogId: last.id, failed: true }, on(MON));
    const { prs } = (await finishSession(db, { sessionId }, on(MON, '18:00'))) as {
      prs: PersonalRecord[];
    };
    expect(brief(prs, 'skill_back_squat')).toEqual([
      ['heaviest', 90, null],
      ['e1rm', 111, null], // 90 × (1 + 7/30); the 60 kg warm-up isn't counted
      ['reps_at_weight', 5, 90],
    ]);
  });
});

describe('AC-54 e1RM PR without RPE', () => {
  it('records an Est. 1RM PR of 106.7 kg for an accessory 80 kg × 10 with no RPE', async () => {
    const { prs } = await logAndFinish(MON, {
      skill_dumbbell_row: { loadKg: 80, reps: 10, rpe: null },
    });
    const e1rm = prs.find((r) => r.skillId === 'skill_dumbbell_row' && r.type === 'e1rm')!;
    expect(e1rm.value).toBeCloseTo(106.6667, 4);
  });
});

describe('AC-40 Weighted pull-up', () => {
  it('records a "heaviest added load" PR for +20 kg × 5 and computes no e1RM', async () => {
    const { prs } = await logAndFinish(WED, { skill_pull_up: { loadKg: 20, reps: 5 } });
    expect(brief(prs, 'skill_pull_up')).toEqual([
      ['heaviest_added', 20, null],
      ['reps_at_added', 5, 20],
    ]);
  });
});

describe('AC-23 No automatic 1RM changes', () => {
  it('records an e1RM PR above the 1RM, but leaves the 1RM and TM alone', async () => {
    const oneRmsBefore = await repos.oneRepMax.listByPlan(planId);
    // 110 × (1 + 5/30) = 128.3, above the squat 1RM of 125 kg
    const { prs } = await logAndFinish(MON, {
      skill_back_squat: { loadKg: 110, reps: 5, rpe: 10 },
    });
    const e1rm = prs.find((r) => r.skillId === 'skill_back_squat' && r.type === 'e1rm')!;
    expect(e1rm.value).toBeCloseTo(128.3333, 4);

    expect(await repos.oneRepMax.listByPlan(planId)).toEqual(oneRmsBefore);
    const squat = (await repos.plans.skills(planId)).find((s) => s.skillId === 'skill_back_squat');
    expect(squat!.startingOneRmKg).toBe(125);
    // Friday's squat still works from TM 112.5 kg (90% of 125), so 80% is 90 kg.
    const friday = await logDay(FRI);
    const [fridaySquat] = await repos.sessions.exercises(friday);
    expect(fridaySquat!.exercise.tmSnapshotKg).toBe(112.5);
    expect(fridaySquat!.sets.filter((s) => !s.isWarmup)[0]!.prescribedLoadKg).toBe(90);
  });
});

describe('AC-5 PR recalculation', () => {
  it('reverts the PR to the previous best when the PR-setting session is deleted', async () => {
    const first = await logAndFinish(WED, { skill_bench_press: { loadKg: 80, reps: 5 } });
    const second = await logAndFinish(NEXT_MON, { skill_bench_press: { loadKg: 82.5, reps: 5 } });
    expect((await best('skill_bench_press', 'heaviest'))!.value).toBe(82.5);

    expect(await deleteSession(db, { sessionId: second.sessionId }, on(NEXT_MON))).toEqual({
      ok: true,
    });
    expect(await best('skill_bench_press', 'heaviest')).toMatchObject({
      value: 80,
      sessionId: first.sessionId,
    });
    expect(await repos.prs.bySession(second.sessionId)).toEqual([]);
  });
});

describe('deleteSession (FR-9.12, C-4)', () => {
  it('deletes the session and returns its planned workout to upcoming', async () => {
    const { sessionId } = await logAndFinish(MON);
    expect(await deleteSession(db, { sessionId }, on(WED))).toEqual({ ok: true });

    expect(await repos.sessions.get(sessionId)).toBeNull();
    expect(await repos.sessions.exercises(sessionId)).toEqual([]);
    const monday = (await repos.plannedWorkouts.listByPlan(planId)).find(
      (w) => w.scheduledDate === MON,
    );
    expect(monday).toMatchObject({ status: 'upcoming', sessionId: null });
  });

  it('replays the PRs of later sessions that the deleted one was holding back', async () => {
    // Deleting the heavier first session makes the second one's 85 kg the heaviest.
    const first = await logAndFinish(WED, { skill_bench_press: { loadKg: 90, reps: 3 } });
    const second = await logAndFinish(NEXT_MON, { skill_bench_press: { loadKg: 85, reps: 3 } });
    expect(brief(second.prs, 'skill_bench_press')).toEqual([['reps_at_weight', 3, 85]]);

    await deleteSession(db, { sessionId: first.sessionId }, on(NEXT_MON));
    expect(brief(await repos.prs.bySession(second.sessionId), 'skill_bench_press')).toEqual([
      ['heaviest', 85, null],
      ['e1rm', 99.17, null], // 85 × (1 + (3 + 2)/30) at RPE 8
      ['reps_at_weight', 3, 85],
    ]);
  });

  it('refuses a session that is missing or still in progress (that is Discard)', async () => {
    expect(await deleteSession(db, { sessionId: 'nope' }, ctx)).toEqual({
      ok: false,
      reason: 'not_found',
    });
    const sessionId = await logDay(MON);
    expect(await deleteSession(db, { sessionId }, ctx)).toEqual({
      ok: false,
      reason: 'in_progress',
    });
  });
});

describe('editing a past session (FR-9.12, FR-10.5)', () => {
  it('replays PRs across later sessions and recomputes the volume', async () => {
    const first = await logAndFinish(WED, { skill_bench_press: { loadKg: 80, reps: 5 } });
    const second = await logAndFinish(NEXT_MON, { skill_bench_press: { loadKg: 82.5, reps: 5 } });
    const [bench] = await repos.sessions.exercises(first.sessionId);

    // The first session's last bench set was really 90 kg.
    const set = bench!.sets.at(-1)!;
    expect(await updateSet(db, { setLogId: set.id, loadKg: 90 }, on(NEXT_MON, '20:00'))).toEqual({
      ok: true,
    });

    expect((await best('skill_bench_press', 'heaviest'))!.sessionId).toBe(first.sessionId);
    // 82.5 kg is no longer the heaviest, and its e1RM (101.75) no longer beats 90 kg's (111).
    expect(brief(await repos.prs.bySession(second.sessionId), 'skill_bench_press')).toEqual([
      ['reps_at_weight', 5, 82.5],
    ]);
    // 2 × 5 × 80 + 5 × 90
    expect((await repos.sessions.get(first.sessionId))!.totalVolumeKg).toBe(1250);
  });

  it('dates a set completed afterwards at the end of its session', async () => {
    const { sessionId } = await logAndFinish(MON);
    const [squat] = await repos.sessions.exercises(sessionId);
    const added = await addSet(db, { sessionExerciseId: squat!.exercise.id }, on(WED));
    if (!added.ok) throw new Error(added.reason);
    await completeSet(db, { setLogId: added.setLogId, loadKg: 100, rpe: 9 }, on(WED));

    expect((await repos.sessions.getSet(added.setLogId))!.completedAt).toBe(`${MON}T18:00:00.000Z`);
    expect(await best('skill_back_squat', 'heaviest')).toMatchObject({
      value: 100,
      achievedAt: `${MON}T18:00:00.000Z`,
    });
  });

  it('replays after a set or an exercise is removed, or an exercise swapped', async () => {
    const { sessionId } = await logAndFinish(MON, { skill_back_squat: { loadKg: 100 } });
    const [squat, , row] = await repos.sessions.exercises(sessionId);

    await deleteSet(db, { setLogId: squat!.sets.at(-1)!.id }, on(WED));
    expect(await repos.prs.bySkills(['skill_back_squat'])).not.toEqual([]);
    await removeExercise(db, { sessionExerciseId: squat!.exercise.id }, on(WED));
    expect(await repos.prs.bySkills(['skill_back_squat'])).toEqual([]);

    // A swap moves only sets still to do (D-40); a pending one moves to the new skill.
    const pending = await addSet(db, { sessionExerciseId: row!.exercise.id }, on(WED));
    if (!pending.ok) throw new Error(pending.reason);
    const swapped = await swapExercise(
      db,
      { sessionExerciseId: row!.exercise.id, skillId: 'skill_barbell_row' },
      on(WED),
    );
    expect(swapped).toMatchObject({ ok: true });
    expect(await repos.prs.bySkills(['skill_dumbbell_row'])).not.toEqual([]);
  });
});
