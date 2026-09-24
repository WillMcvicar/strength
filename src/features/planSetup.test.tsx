// Plan setup's view-model (FR-2.3, FR-3.3, DESIGN §7.5), read from a real migrated database with
// a draft copied from the seeded Beginner Strength template.
import { renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import type { Db } from '@/data/db';
import { liveDb, type LiveDb } from '@/data/live';
import { repositories } from '@/data/repositories';
import { DatabaseProvider } from '@/features/database';
import { trainingMaxKg, usePlanSetup } from '@/features/planSetup';
import { createPlanFromTemplate } from '@/services/createPlanFromTemplate';
import { startPlan } from '@/services/startPlan';

import { openMigratedTestDb } from '../../test/db/betterSqlite3';
import { idSequence } from '../../test/fixtures/ids';

// Wednesday, so "the next week-start day" is a real step forward (FR-2.3).
const TODAY = '2026-09-16';

let db: Db;
let live: LiveDb;
const wrapper = ({ children }: { children: ReactNode }) => (
  <DatabaseProvider value={live}>{children}</DatabaseProvider>
);

let newId: () => string;

beforeEach(async () => {
  db = await openMigratedTestDb();
  live = liveDb(db);
  // One sequence per test, so two service calls never mint the same id.
  newId = idSequence();
});

afterEach(async () => {
  await db.closeAsync();
});

const ctx = () => ({ today: TODAY, now: `${TODAY}T09:00:00.000Z`, newId });

async function draft(templateId = 'tpl_beginner_strength'): Promise<string> {
  const created = await createPlanFromTemplate(db, { templateId }, ctx());
  if (!created.ok) throw new Error(created.reason);
  return created.planId;
}

const setupOf = async (planId: string, today = TODAY) => {
  const { result } = await renderHook(() => usePlanSetup(planId, today), { wrapper });
  await waitFor(() => expect(result.current.status).toBe('ready'));
  return (result.current as Extract<ReturnType<typeof usePlanSetup>, { status: 'ready' }>).setup;
};

describe('FR-2.3 the start date default', () => {
  it('is the next week-start day, so plan weeks line up with calendar weeks', async () => {
    const setup = await setupOf(await draft());
    // Wednesday 16 September 2026 → Monday 21 September.
    expect(setup?.defaultStartDate).toBe('2026-09-21');
    expect(setup?.totalWeeks).toBe(13);
  });

  it('is today when today is already the week-start day', async () => {
    const setup = await setupOf(await draft(), '2026-09-14');
    expect(setup?.defaultStartDate).toBe('2026-09-14');
  });

  it('follows the week-start setting (FR-12.3)', async () => {
    await repositories(db).settings.update({ weekStart: 0 });
    const setup = await setupOf(await draft());
    expect(setup?.defaultStartDate).toBe('2026-09-20'); // the next Sunday
  });
});

describe('DESIGN §7.5 training days', () => {
  it('lists one row per slot, named "Week A · Full body A"', async () => {
    const setup = await setupOf(await draft());
    expect(setup?.slots.every((s) => s.phaseId !== '' && s.cycleWeekIndex >= 1)).toBe(true);
    expect(setup?.slots.map((s) => [s.label, s.weekday])).toEqual([
      ['Week A · Full body A', 1],
      ['Week A · Full body B', 3],
      ['Week A · Full body A', 5],
      ['Week B · Full body B', 1],
      ['Week B · Full body A', 3],
      ['Week B · Full body B', 5],
    ]);
  });

  it('D-30: leaves out generated deload slots, which take their source slot’s day', async () => {
    const planId = await draft();
    const all = await repositories(db).blueprints.slotsOfPlan(planId);
    const setup = await setupOf(planId);
    expect(all.filter((s) => s.sourceCycleSlotId !== null)).toHaveLength(3);
    expect(setup?.slots).toHaveLength(all.length - 3);
  });
});

describe('FR-3.3 the 1RM step', () => {
  it('lists every %-based skill, by name, with no value on a fresh install', async () => {
    const setup = await setupOf(await draft());
    expect(setup?.skills).toEqual([
      { skillId: 'skill_back_squat', name: 'Back squat', oneRmKg: null },
      { skillId: 'skill_bench_press', name: 'Bench press', oneRmKg: null },
      { skillId: 'skill_deadlift', name: 'Deadlift', oneRmKg: null },
      { skillId: 'skill_overhead_press', name: 'Overhead press', oneRmKg: null },
    ]);
  });

  it('pre-fills from the skill’s current 1RM, so a new plan starts where the last left off', async () => {
    const first = await draft();
    await startPlan(
      db,
      {
        planId: first,
        startDate: '2026-09-21',
        oneRms: {
          skill_back_squat: 110,
          skill_bench_press: 90,
          skill_deadlift: 140,
          skill_overhead_press: 55,
        },
      },
      ctx(),
    );

    const setup = await setupOf(await draft('tpl_beginner_hypertrophy'));
    expect(setup?.skills.map((s) => s.oneRmKg)).toEqual([110, 90, 140, 55]);
    // FR-4.1: the running plan is named, so setup can say what starting this one would end.
    expect(setup?.activePlanName).toBe('Beginner Strength');
  });

  it('shows the plan’s TM percentage for the "→ TM" line (FR-3.2)', async () => {
    const setup = await setupOf(await draft());
    expect(setup?.tmPercent).toBe(0.9);
    expect(trainingMaxKg(110, 0.9)).toBe(99);
  });

  it('returns null once the plan is no longer a draft', async () => {
    const planId = await draft();
    await startPlan(
      db,
      {
        planId,
        startDate: '2026-09-21',
        oneRms: {
          skill_back_squat: 110,
          skill_bench_press: 90,
          skill_deadlift: 140,
          skill_overhead_press: 55,
        },
      },
      ctx(),
    );
    expect(await setupOf(planId)).toBeNull();
  });
});
