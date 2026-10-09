// The Week tab's view-models (FR-8.1–8.4, D-7, DESIGN §7.3): the calendar week, Workout detail and
// the plan overview grid, read from a real migrated database with a plan started by startPlan.
import { renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import type { Db } from '@/data/db';
import { liveDb, type LiveDb } from '@/data/live';
import { repositories } from '@/data/repositories';
import { DatabaseProvider } from '@/features/database';
import { usePlanOverview, useWeek, useWorkoutDetail } from '@/features/week';
import { finishSession } from '@/services/finishSession';
import { insertDeload } from '@/services/insertDeload';
import { startPlan } from '@/services/startPlan';
import { startSession } from '@/services/startSession';

import { openMigratedTestDb } from '../../test/db/betterSqlite3';
import { idSequence } from '../../test/fixtures/ids';
import { aPlan, FULL_BODY_AB, sets, strength } from '../../test/fixtures/plans';

let db: Db;
let live: LiveDb;
const wrapper = ({ children }: { children: ReactNode }) => (
  <DatabaseProvider value={live}>{children}</DatabaseProvider>
);

beforeEach(async () => {
  db = await openMigratedTestDb();
  live = liveDb(db);
});

afterEach(async () => {
  await db.closeAsync();
});

/** A 4-week, 2-week-cycle block on Mon/Wed/Fri, optionally with a deload after week 2. */
async function startBlock(startDate: string, { deloadAfter }: { deloadAfter?: number } = {}) {
  const newId = idSequence();
  const ctx = { today: '2026-09-12', now: '2026-09-12T09:00:00.000Z', newId };
  await aPlan('plan')
    .withPhase(strength({ weeks: 4, cycle: 2 }))
    .withWorkouts('Full body A', 'Full body B')
    .withExercises('Full body A', [
      {
        skill: 'skill_back_squat',
        sets: sets(5, { repsMin: 5, loadType: 'percent_tm', loadPercent: 0.8 }),
      },
    ])
    .withExercises('Full body B', [
      {
        skill: 'skill_deadlift',
        sets: sets(1, { repsMin: 5, loadType: 'percent_tm', loadPercent: 0.8 }),
      },
    ])
    .withSchedule(FULL_BODY_AB)
    .withOneRm('skill_back_squat', 100)
    .withOneRm('skill_deadlift', 140)
    .build(db);
  if (deloadAfter !== undefined) {
    const inserted = await insertDeload(db, { planId: 'plan', afterWeek: deloadAfter }, ctx);
    if (!inserted.ok) throw new Error(inserted.reason);
  }
  const started = await startPlan(db, { planId: 'plan', startDate }, ctx);
  if (!started.ok) throw new Error(started.reason);
}

const readyWeek = async (offset: number, today: string) => {
  const { result } = await renderHook(() => useWeek(offset, today), { wrapper });
  await waitFor(() => expect(result.current.status).toBe('ready'));
  return (result.current as Extract<ReturnType<typeof useWeek>, { status: 'ready' }>).week;
};

describe('AC-51 Week view uses calendar weeks', () => {
  it('shows Monday to Sunday, workouts on their dates, and "Plan weeks 1–2" for the second week', async () => {
    // A Wednesday start: plan week 1 is Wed 16 – Tue 22 September, so its Monday is the 21st.
    await startBlock('2026-09-16');
    const week = await readyWeek(1, '2026-09-16');

    expect(week).toMatchObject({
      range: { start: '2026-09-21', end: '2026-09-27' },
      isThisWeek: false,
      header: 'Plan weeks 1–2',
    });
    expect(week?.days.map((d) => [d.date, d.workouts.map((w) => w.name)])).toEqual([
      ['2026-09-21', ['Full body A']],
      ['2026-09-22', []],
      ['2026-09-23', ['Full body A']],
      ['2026-09-24', []],
      ['2026-09-25', ['Full body B']],
      ['2026-09-26', []],
      ['2026-09-27', []],
    ]);
  });
});

describe('useWeek (FR-8.1, FR-8.2, §7.3)', () => {
  it('shows no week without a plan', async () => {
    expect(await readyWeek(0, '2026-09-16')).toBeNull();
  });

  it("shows this week's statuses, one plan week, and its phase and cycle week", async () => {
    await startBlock('2026-09-14');
    const week = await readyWeek(0, '2026-09-16');

    expect(week).toMatchObject({
      planId: 'plan',
      range: { start: '2026-09-14', end: '2026-09-20' },
      isThisWeek: true,
      header: 'Plan week 1',
      footer: 'Block 1 · Cycle 1 (week A)',
    });
    expect(week?.days.map((d) => d.workouts.map((w) => [w.name, w.status]))).toEqual([
      [['Full body A', 'missed']],
      [],
      [['Full body B', 'today']],
      [],
      [['Full body A', 'upcoming']],
      [],
      [],
    ]);
  });

  it('steps forward to the second week of the cycle, and back past the plan start', async () => {
    await startBlock('2026-09-14');
    expect(await readyWeek(1, '2026-09-16')).toMatchObject({
      range: { start: '2026-09-21' },
      header: 'Plan week 2',
      footer: 'Block 1 · Cycle 1 (week B)',
    });
    const before = await readyWeek(-1, '2026-09-16');
    expect(before).toMatchObject({ range: { start: '2026-09-07' }, header: null, footer: null });
    expect(before?.days.every((d) => d.workouts.length === 0)).toBe(true);
  });

  it('names a deload week by its phase alone', async () => {
    await startBlock('2026-09-14', { deloadAfter: 2 });
    expect(await readyWeek(2, '2026-09-14')).toMatchObject({
      header: 'Plan week 3',
      footer: 'Deload',
    });
  });

  it('follows a Sunday week start (FR-12.3)', async () => {
    await startBlock('2026-09-14');
    await repositories(db).settings.update({ weekStart: 0 });
    const week = await readyWeek(0, '2026-09-16');
    expect(week?.range).toEqual({ start: '2026-09-13', end: '2026-09-19' });
  });
});

describe('useWorkoutDetail (§7.3)', () => {
  const ctx = { today: '2026-09-14', now: '2026-09-14T17:30:00.000Z', newId: idSequence('s') };

  const detailOf = async (id: string, today: string) => {
    const { result } = await renderHook(() => useWorkoutDetail(id, today), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    return (result.current as Extract<ReturnType<typeof useWorkoutDetail>, { status: 'ready' }>)
      .detail;
  };

  it("shows today's workout with its loads and position, and offers Start", async () => {
    await startBlock('2026-09-14');
    const [monday] = await repositories(db).plannedWorkouts.listByPlan('plan');
    expect(await detailOf(monday!.id, '2026-09-14')).toMatchObject({
      workoutId: monday!.id,
      name: 'Full body A',
      date: '2026-09-14',
      status: 'today',
      context: 'Block 1 · Cycle 1 · Week 1 of 4',
      unit: 'kg',
      // TM 100 × 0.9 = 90; × 0.8 = 72 → 72.5 kg.
      rows: [{ name: 'Back squat', sets: 5, target: { reps: [5] }, load: { kg: 72.5 } }],
      // 5 × 40 + 4 × 120 = 680 s ≈ 11.3 min → 10.
      durationMin: 10,
      sessionId: null,
      canStart: true,
    });
  });

  it('shows a future workout without Start', async () => {
    await startBlock('2026-09-14');
    const [, wednesday] = await repositories(db).plannedWorkouts.listByPlan('plan');
    expect(await detailOf(wednesday!.id, '2026-09-14')).toMatchObject({
      name: 'Full body B',
      status: 'upcoming',
      canStart: false,
    });
  });

  it('links to the session of a workout in progress, then of the finished one', async () => {
    await startBlock('2026-09-14');
    const [monday] = await repositories(db).plannedWorkouts.listByPlan('plan');
    const started = await startSession(db, { plannedWorkoutId: monday!.id }, ctx);
    if (!started.ok) throw new Error(started.reason);
    expect(await detailOf(monday!.id, '2026-09-14')).toMatchObject({
      status: 'in_progress',
      sessionId: started.sessionId,
      canStart: false,
    });

    await finishSession(db, { sessionId: started.sessionId }, ctx);
    // Today's loads no longer describe it; what was lifted is in the session.
    expect(await detailOf(monday!.id, '2026-09-14')).toMatchObject({
      status: 'completed',
      sessionId: started.sessionId,
      canStart: false,
      rows: [],
    });
  });

  it('shows nothing for a workout that no longer exists', async () => {
    expect(await detailOf('gone', '2026-09-14')).toBeNull();
  });
});

describe('usePlanOverview (FR-8.4, FR-8.3, §7.3)', () => {
  const overviewOf = async (planId: string, today: string) => {
    const { result } = await renderHook(() => usePlanOverview(planId, today), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    return (result.current as Extract<ReturnType<typeof usePlanOverview>, { status: 'ready' }>)
      .overview;
  };

  it('has a row per plan week, the deload labelled, and each workout with its status', async () => {
    await startBlock('2026-09-14', { deloadAfter: 2 });
    const overview = await overviewOf('plan', '2026-09-16');

    expect(overview).toMatchObject({
      name: expect.any(String),
      ribbon: [
        { name: 'Block 1', type: 'training', weeks: 2 },
        { name: 'Deload', type: 'deload', weeks: 1 },
        { name: 'Block 1', type: 'training', weeks: 2 },
      ],
      // 1 missed of 15, nothing completed (FR-8.3).
      progress: { currentWeek: 1, totalWeeks: 5, completed: 0, total: 15, adherence: 0 },
    });
    expect(overview?.rows.map((r) => [r.weekIndex, r.phaseIndex, r.label, r.cells.length])).toEqual(
      [
        [1, 0, null, 3],
        [2, 0, null, 3],
        [3, 1, 'Deload', 3],
        [4, 2, null, 3],
        [5, 2, null, 3],
      ],
    );
    expect(overview?.rows[0]?.cells.map((c) => [c.name, c.date, c.status])).toEqual([
      ['Full body A', '2026-09-14', 'missed'],
      ['Full body B', '2026-09-16', 'today'],
      ['Full body A', '2026-09-18', 'upcoming'],
    ]);
  });

  it('shows nothing for a plan that no longer exists', async () => {
    expect(await overviewOf('gone', '2026-09-16')).toBeNull();
  });
});
