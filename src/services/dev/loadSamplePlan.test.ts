// The development-only sample plan (docs/BUILD_PLAN.md Slice 4): the Beginner Strength shape,
// started on this week's Monday, so Today has something to show on a device before Slice 5.
import { weekPosition } from '@/core';
import type { Db } from '@/data/db';
import { repositories } from '@/data/repositories';

import { openMigratedTestDb } from '../../../test/db/betterSqlite3';
import { idSequence } from '../../../test/fixtures/ids';
import type { ServiceContext } from '../context';
import { loadSamplePlan } from './loadSamplePlan';

let db: Db;
const on = (today: string): ServiceContext => ({
  today,
  now: `${today}T09:00:00.000Z`,
  newId: idSequence(),
});

beforeEach(async () => {
  db = await openMigratedTestDb();
});

afterEach(async () => {
  await db.closeAsync();
});

describe('loadSamplePlan (dev only)', () => {
  it('starts a 13-week Beginner Strength plan on this week’s Monday', async () => {
    expect(await loadSamplePlan(db, on('2026-09-16'))).toEqual({ ok: true });

    const r = repositories(db);
    const plan = await r.plans.current();
    expect(plan).toMatchObject({ status: 'active', startDate: '2026-09-14' });

    const phases = await r.blueprints.phasesOfPlan(plan!.id);
    expect(phases.map((p) => [p.name, p.type, p.lengthWeeks])).toEqual([
      ['Block 1', 'training', 6],
      ['Deload', 'deload', 1],
      ['Block 2', 'training', 6],
    ]);
    // Block 2 continues as cycles 4–6 (D-1, D-14).
    expect(weekPosition(phases, 8).phaseCycleIndex).toBe(4);

    const workouts = await r.plannedWorkouts.listByPlan(plan!.id);
    expect(workouts.filter((w) => w.weekIndex === 1).map((w) => w.scheduledDate)).toEqual([
      '2026-09-14',
      '2026-09-16',
      '2026-09-18',
    ]);
  });

  it('starts on the same day when today is a Monday', async () => {
    await loadSamplePlan(db, on('2026-09-14'));
    expect((await repositories(db).plans.current())?.startDate).toBe('2026-09-14');
  });

  it('gives the main lifts starting 1RMs, so Today has loads to show', async () => {
    await loadSamplePlan(db, on('2026-09-16'));
    const r = repositories(db);
    const skills = await r.plans.skills((await r.plans.current())!.id);
    expect(Object.fromEntries(skills.map((s) => [s.skillId, s.startingOneRmKg]))).toEqual({
      skill_back_squat: 100,
      skill_bench_press: 80,
      skill_deadlift: 140,
      skill_overhead_press: 50,
    });
  });

  it('refuses while a plan is already current (FR-4.1)', async () => {
    await loadSamplePlan(db, on('2026-09-16'));
    expect(await loadSamplePlan(db, on('2026-09-16'))).toEqual({
      ok: false,
      reason: 'plan_already_current',
    });
  });
});
