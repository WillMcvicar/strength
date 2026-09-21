// Today's view-model (FR-7.2, FR-7.4, FR-7.7, FR-7.8, DESIGN §7.2), read from a real migrated
// database with a plan started by the startPlan service.
import { renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import type { Db } from '@/data/db';
import { liveDb, type LiveDb } from '@/data/live';
import { DatabaseProvider } from '@/features/database';
import { useToday } from '@/features/today';
import { startPlan } from '@/services/startPlan';

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

/** Beginner Strength's first block, Mon/Wed/Fri from Monday 14 September 2026. */
async function startBeginner() {
  await aPlan('plan')
    .withPhase(strength({ weeks: 6, cycle: 2 }))
    .withWorkouts('Full body A', 'Full body B')
    .withExercises('Full body A', [
      {
        skill: 'skill_back_squat',
        sets: sets(5, { repsMin: 5, loadType: 'percent_tm', loadPercent: 0.8 }),
      },
      {
        skill: 'skill_plank',
        sets: sets(3, { repsMin: null, loadType: 'bodyweight', targetTimeSec: 45 }),
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
  const started = await startPlan(
    db,
    { planId: 'plan', startDate: '2026-09-14' },
    { today: '2026-09-12', now: '2026-09-12T09:00:00.000Z', newId: idSequence() },
  );
  expect(started.ok).toBe(true);
}

describe('useToday (FR-7)', () => {
  it('shows the no-plan empty state (FR-7.8)', async () => {
    const { result } = await renderHook(() => useToday('2026-09-16'), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current).toMatchObject({ card: { kind: 'no_plan' }, plan: null });
  });

  it("shows Monday's workout with calculated loads and duration (FR-7.2)", async () => {
    await startBeginner();
    const { result } = await renderHook(() => useToday('2026-09-14'), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('ready'));

    expect(result.current).toMatchObject({
      unit: 'kg',
      card: {
        kind: 'workout',
        name: 'Full body A',
        rows: [
          // TM 100 × 0.9 = 90; × 0.8 = 72 → 72.5 kg.
          { name: 'Back squat', sets: 5, target: { reps: [5] }, load: { kg: 72.5 } },
          { name: 'Plank', sets: 3, target: { seconds: 45 }, load: null },
        ],
      },
      plan: {
        header: 'Block 1 · Cycle 1 · Week 1 of 6',
        currentWeek: 1,
        ribbon: [{ name: 'Block 1', type: 'training', weeks: 6 }],
      },
    });
    // 5 × 40 + 4 × 120 = 680 s, and 3 × 40 + 2 × 120 = 360 s: 1040 s ≈ 17.3 min → 15.
    expect(
      result.current.status === 'ready' && result.current.card.kind === 'workout'
        ? result.current.card.durationMin
        : null,
    ).toBe(15);
  });

  it('shows a rest day with the next workout and its date (FR-7.4)', async () => {
    await startBeginner();
    const { result } = await renderHook(() => useToday('2026-09-15'), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('ready'));

    expect(result.current).toMatchObject({
      card: { kind: 'rest', next: { name: 'Full body B', date: '2026-09-16' } },
    });
  });

  it('shows the compact progress meter and the week strip (FR-7.7, FR-8.3)', async () => {
    await startBeginner();
    const { result } = await renderHook(() => useToday('2026-09-16'), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('ready'));

    expect(result.current).toMatchObject({
      plan: {
        progress: { currentWeek: 1, totalWeeks: 6, pctSessions: 0, adherence: 0 },
        week: [
          { date: '2026-09-14', status: 'missed' },
          { date: '2026-09-15', status: 'rest' },
          { date: '2026-09-16', status: 'today' },
          { date: '2026-09-17', status: 'rest' },
          { date: '2026-09-18', status: 'upcoming' },
          { date: '2026-09-19', status: 'rest' },
          { date: '2026-09-20', status: 'rest' },
        ],
      },
    });
  });
});
