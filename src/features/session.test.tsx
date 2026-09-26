// The workout session's view-model (FR-9, DESIGN §7.6), read from a real migrated database with
// the §7.6 example started: squat 1RM 125 kg → TM 112.5 kg → 90 kg sets.
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import type { Db } from '@/data/db';
import { liveDb, type LiveDb } from '@/data/live';
import { repositories } from '@/data/repositories';
import { DatabaseProvider } from '@/features/database';
import {
  blockedBeforeRpe,
  lastTimeLabel,
  loadLabel,
  useSession,
  useSessionActions,
  type SessionView,
} from '@/features/session';
import { completeSet } from '@/services/completeSet';
import { finishSession } from '@/services/finishSession';
import { startSession } from '@/services/startSession';

import { openMigratedTestDb } from '../../test/db/betterSqlite3';
import { idSequence } from '../../test/fixtures/ids';
import { aPlan, sets, topSet } from '../../test/fixtures/plans';
import {
  FRI,
  MON,
  NEXT_MON,
  WED,
  aStartedPlan,
  logAndFinish,
  on,
  START,
} from '../../test/fixtures/sessions';

jest.mock('@/features/serviceContext', () => {
  const { idSequence: ids } = jest.requireActual('../../test/fixtures/ids');
  const newId = ids('ui');
  return {
    serviceContext: () => ({ today: '2026-09-14', now: '2026-09-14T17:40:00.000Z', newId }),
  };
});

let db: Db;
let live: LiveDb;
const wrapper = ({ children }: { children: ReactNode }) => (
  <DatabaseProvider value={live}>{children}</DatabaseProvider>
);
const ctx = { today: START, now: '2026-09-14T17:30:00.000Z', newId: idSequence() };

beforeEach(async () => {
  db = await openMigratedTestDb();
  live = liveDb(db);
});

afterEach(async () => {
  await db.closeAsync();
});

async function started(): Promise<string> {
  const { planId } = await aStartedPlan(db, ctx);
  const [monday] = await repositories(db).plannedWorkouts.listByPlan(planId);
  const result = await startSession(db, { plannedWorkoutId: monday!.id }, ctx);
  if (!result.ok) throw new Error(result.reason);
  return result.sessionId;
}

async function viewOf(sessionId: string): Promise<SessionView> {
  const { result } = await renderHook(() => useSession(sessionId), { wrapper });
  await waitFor(() => expect(result.current.status).toBe('ready'));
  const current = result.current as Extract<ReturnType<typeof useSession>, { status: 'ready' }>;
  return current.session!;
}

describe('useSession (§7.6)', () => {
  it('shapes the session for SetRow: numbered working sets, the RPE each needs, the TM', async () => {
    const view = await viewOf(await started());
    expect(view).toMatchObject({
      name: 'Full body A',
      status: 'in_progress',
      unit: 'kg',
      keepAwake: true,
      restTimerAlerts: true,
      tips: { rpePicker: true, topSet: true },
      setsCompleted: 0,
      setsIncomplete: 9,
    });
    const [squat, press, , plank] = view.exercises;
    expect(squat).toMatchObject({ name: 'Back squat', tmKg: 112.5, increment: 2.5, restSec: 120 });
    expect(squat!.sets.map((s) => [s.number, s.isWarmup, s.prompt, s.targetRpe])).toEqual([
      [0, true, 'none', null],
      [1, false, 'required', 8],
      [2, false, 'required', 8],
      [3, false, 'required', 8],
    ]);
    // Dumbbells step 2 kg (FR-1.6); accessories offer an optional RPE; planks ask none.
    expect(press).toMatchObject({
      increment: 2,
      sets: [{ prompt: 'optional' }, { prompt: 'optional' }],
    });
    expect(plank!.sets.map((s) => s.prompt)).toEqual(['none', 'none']);
  });

  it('keeps the totals live as sets are logged (FR-9.8)', async () => {
    const sessionId = await started();
    const { result } = await renderHook(() => useSession(sessionId), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    const view = (result.current as Extract<ReturnType<typeof useSession>, { status: 'ready' }>)
      .session!;

    const { result: actions } = await renderHook(() => useSessionActions(sessionId), { wrapper });
    await act(async () => {
      await actions.current.completeSet({ setLogId: view.exercises[0]!.sets[1]!.id, rpe: 8 });
    });
    await waitFor(() =>
      expect(result.current).toMatchObject({
        session: { setsCompleted: 1, volumeKg: 450, setsIncomplete: 8 },
      }),
    );
  });

  it('shows the last top set for reference, and the top set target (FR-9.2b)', async () => {
    // A plan whose Monday workout has a bench top set, logged last cycle at 100 kg × 2 @ RPE 8.
    const { aPlan } = jest.requireActual('../../test/fixtures/plans');
    const { startPlan } = jest.requireActual('@/services/startPlan');
    await aPlan('tp')
      .startingOn(START)
      .withWorkouts('Heavy')
      .withExercises('Heavy', [{ skill: 'skill_bench_press', sets: [topSet(), topSet()] }])
      .withSchedule({ A: { Mon: 'Heavy', Wed: 'Heavy' }, B: { Mon: 'Heavy' } })
      .withOneRm('skill_bench_press', 110)
      .build(db);
    await startPlan(db, { planId: 'tp', startDate: START }, ctx);
    const [monday, wednesday] = await repositories(db).plannedWorkouts.listByPlan('tp');

    const first = await startSession(db, { plannedWorkoutId: monday!.id }, ctx);
    if (!first.ok) throw new Error(first.reason);
    const [bench] = await repositories(db).sessions.exercises(first.sessionId);
    await completeSet(db, { setLogId: bench!.sets[0]!.id, loadKg: 100, reps: 2, rpe: 8 }, ctx);
    await finishSession(db, { sessionId: first.sessionId }, ctx);

    const wed = { ...ctx, today: '2026-09-16', now: '2026-09-16T17:30:00.000Z' };
    const second = await startSession(db, { plannedWorkoutId: wednesday!.id }, wed);
    if (!second.ok) throw new Error(second.reason);
    const view = await viewOf(second.sessionId);
    expect(view.exercises[0]).toMatchObject({
      lastTopSet: 'Last: 100 kg × 2 @ RPE 8',
      sets: [
        {
          isTopSet: true,
          topSetTarget: { reps: [1, 3], rpe: { min: 8, max: 8 } },
          prompt: 'required',
        },
        {},
      ],
    });
  });

  it('reads nothing for a session that does not exist', async () => {
    const { result } = await renderHook(() => useSession('nope'), { wrapper });
    await waitFor(() => expect(result.current).toEqual({ status: 'ready', session: null }));
  });
});

describe('useSessionActions (§6.6)', () => {
  it('turns a refusal into plain words', async () => {
    const sessionId = await started();
    const view = await viewOf(sessionId);
    const { result } = await renderHook(() => useSessionActions(sessionId), { wrapper });
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.completeSet({ setLogId: view.exercises[0]!.sets[1]!.id });
    });
    expect(outcome).toEqual({ ok: false, message: 'Pick an RPE to finish this set.' });
  });

  it('finishes the session and returns its summary', async () => {
    const sessionId = await started();
    const { result } = await renderHook(() => useSessionActions(sessionId), { wrapper });
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.finish();
    });
    expect(outcome).toMatchObject({
      ok: true,
      summary: { name: 'Full body A', setsIncomplete: 9 },
    });
  });

  it('records a dismissed tip (FR-6.2)', async () => {
    const sessionId = await started();
    const { result } = await renderHook(() => useSessionActions(sessionId), { wrapper });
    await act(async () => {
      await result.current.dismissTip('tip_rpe_picker');
    });
    expect((await viewOf(sessionId)).tips).toEqual({ rpePicker: false, topSet: true });
  });
});

describe('loadLabel (§7.6)', () => {
  const base = {
    trackingType: 'weight_reps',
    loadConvention: 'total',
  } as unknown as Parameters<typeof loadLabel>[1];

  it('reads a load the way the set row shows it', () => {
    expect(loadLabel(100, base, 'kg')).toBe('100 kg');
    expect(loadLabel(20, { ...base, loadConvention: 'per_side' }, 'kg')).toBe('20 kg × 2');
    expect(loadLabel(20, { ...base, trackingType: 'bodyweight_plus_load' }, 'kg')).toBe(
      'BW +20 kg',
    );
  });
});

describe('blockedBeforeRpe (§7.6)', () => {
  it('says what is missing before the RPE picker opens, and nothing when only the RPE is', async () => {
    const view = await viewOf(await started());
    const squat = view.exercises[0]!;
    const set = squat.sets[1]!;
    expect(blockedBeforeRpe(squat.exercise, set)).toBeNull();
    expect(blockedBeforeRpe(squat.exercise, { ...set, loadKg: null })).toBe(
      'Enter the weight you used.',
    );
  });
});

describe('double progression on the session screen (FR-3.15, FR-9.5, §7.6)', () => {
  const CURL = 'skill_dumbbell_curl';
  const curlSets = sets(3, {
    loadType: 'double_progression',
    loadPercent: null,
    repsMin: 8,
    repsMax: 12,
    targetRpeMin: 8,
    targetRpeMax: 9,
  });

  /** Full body A (Mon, Fri) and B (Wed) both curl, so each has its own track (D-20). */
  async function curlPlan(): Promise<string> {
    const { startPlan } = jest.requireActual('@/services/startPlan');
    await repositories(db).skills.update(CURL, { loadIncrementKg: 1 });
    await aPlan('dp')
      .startingOn(START)
      .withWorkouts('Full body A', 'Full body B')
      .withExercises('Full body A', [{ skill: CURL, sets: curlSets }])
      .withExercises('Full body B', [{ skill: CURL, sets: curlSets }])
      .withSchedule({
        A: { Mon: 'Full body A', Wed: 'Full body B', Fri: 'Full body A' },
        B: { Mon: 'Full body A', Wed: 'Full body B', Fri: 'Full body A' },
      })
      .build(db);
    await startPlan(db, { planId: 'dp', startDate: START }, ctx);
    return 'dp';
  }

  async function startOn(planId: string, date: string): Promise<string> {
    const workout = (await repositories(db).plannedWorkouts.listByPlan(planId)).find(
      (w) => w.scheduledDate === date,
    )!;
    const result = await startSession(db, { plannedWorkoutId: workout.id }, on(ctx, date));
    if (!result.ok) throw new Error(result.reason);
    return result.sessionId;
  }

  const curl = (reps: number, loadKg = 15) => ({ reps, loadKg, rpe: 8 });

  it('shows the "↑ +1 kg" badge and last time, and Revert takes the badge away (AC-28)', async () => {
    const planId = await curlPlan();
    await logAndFinish(db, planId, MON, ctx, { [CURL]: [curl(12), curl(12), curl(12)] });
    await logAndFinish(db, planId, WED, ctx, { [CURL]: [curl(9, 10), curl(9, 10), curl(8, 10)] });
    const friday = await startOn(planId, FRI);

    const view = await viewOf(friday);
    // Last time follows the workout: Monday's Full body A, not Wednesday's B (FR-2.15).
    expect(view.exercises[0]).toMatchObject({
      increase: { text: '↑ +1 kg', kg: 1 },
      lastTime: 'Last: 3×12 @ 15 kg × 2',
      reduceHint: false,
    });

    const { result } = await renderHook(() => useSessionActions(friday), { wrapper });
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.revertIncrease(view.exercises[0]!.id);
    });
    expect(outcome).toEqual({ ok: true });
    expect((await viewOf(friday)).exercises[0]).toMatchObject({ increase: null });
    await act(async () => {
      outcome = await result.current.revertIncrease(view.exercises[0]!.id);
    });
    expect(outcome).toEqual({ ok: false, message: 'There’s no increase to undo.' });
  });

  it("falls back to the skill's last time before this workout has one", async () => {
    const planId = await curlPlan();
    await logAndFinish(db, planId, MON, ctx, { [CURL]: [curl(12), curl(11), curl(10)] });
    const wednesday = await startOn(planId, WED);
    expect((await viewOf(wednesday)).exercises[0]).toMatchObject({
      increase: null,
      lastTime: 'Last: 12, 11, 10 @ 15 kg × 2',
    });
  });

  it('shows the reduce hint after two sessions below the range, and no badge once finished', async () => {
    const planId = await curlPlan();
    const low = { [CURL]: [curl(7), curl(6), curl(6)] };
    await logAndFinish(db, planId, MON, ctx, low);
    const friday = await logAndFinish(db, planId, FRI, ctx, low);
    const next = await startOn(planId, NEXT_MON);
    expect((await viewOf(next)).exercises[0]).toMatchObject({ reduceHint: true });
    // A finished session shows neither: its track has already moved on.
    expect((await viewOf(friday.sessionId)).exercises[0]).toMatchObject({
      reduceHint: false,
      increase: null,
      lastTime: 'Last: 7, 6, 6 @ 15 kg × 2',
    });
  });
});

describe('lastTimeLabel (FR-9.5)', () => {
  const as = (over: object) =>
    ({ trackingType: 'weight_reps', loadConvention: 'total', ...over }) as unknown as Parameters<
      typeof lastTimeLabel
    >[1];

  it('reads "3×8 @ 60 kg", listing reps that differ, with runs at other loads after a dot', () => {
    expect(lastTimeLabel([{ loadKg: 60, values: [8, 8, 8] }], as({}), 'kg')).toBe(
      'Last: 3×8 @ 60 kg',
    );
    expect(
      lastTimeLabel(
        [
          { loadKg: 15, values: [10] },
          { loadKg: 16, values: [9, 9] },
        ],
        as({}),
        'kg',
      ),
    ).toBe('Last: 10 @ 15 kg · 2×9 @ 16 kg');
  });

  it('reads reps alone, times in seconds, and nothing when there is nothing to show', () => {
    expect(
      lastTimeLabel([{ loadKg: null, values: [10, 8] }], as({ trackingType: 'reps_only' }), 'kg'),
    ).toBe('Last: 10, 8');
    expect(
      lastTimeLabel([{ loadKg: null, values: [60, 60] }], as({ trackingType: 'time' }), 'kg'),
    ).toBe('Last: 2×60 s');
    expect(lastTimeLabel([], as({}), 'kg')).toBeNull();
  });
});
