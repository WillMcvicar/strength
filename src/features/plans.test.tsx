// The Plans tab and template detail view-models (FR-2.1, FR-2.2, DESIGN §7.4), read from a real
// migrated database with the built-in templates seeded.
import { renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import type { Db } from '@/data/db';
import { liveDb, type LiveDb } from '@/data/live';
import { DatabaseProvider } from '@/features/database';
import { usePlans, useTemplate, increaseRuleText } from '@/features/plans';
import { createPlanFromTemplate } from '@/services/createPlanFromTemplate';
import { startPlan } from '@/services/startPlan';

import { openMigratedTestDb } from '../../test/db/betterSqlite3';
import { idSequence } from '../../test/fixtures/ids';

const TODAY = '2026-09-16';
const START = '2026-09-14';
const ONE_RMS = {
  skill_back_squat: 110,
  skill_bench_press: 90,
  skill_deadlift: 140,
  skill_overhead_press: 55,
};

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

const ctx = () => ({ today: TODAY, now: `${TODAY}T09:00:00.000Z`, newId: idSequence() });

async function startBeginnerStrength(): Promise<string> {
  const created = await createPlanFromTemplate(db, { templateId: 'tpl_beginner_strength' }, ctx());
  if (!created.ok) throw new Error(created.reason);
  await startPlan(db, { planId: created.planId, startDate: START, oneRms: ONE_RMS }, ctx());
  return created.planId;
}

const plans = async () => {
  const { result } = await renderHook(() => usePlans(TODAY), { wrapper });
  await waitFor(() => expect(result.current.status).toBe('ready'));
  return result.current as Extract<ReturnType<typeof usePlans>, { status: 'ready' }>;
};

const template = async (id: string) => {
  const { result } = await renderHook(() => useTemplate(id), { wrapper });
  await waitFor(() => expect(result.current.status).toBe('ready'));
  return (result.current as Extract<ReturnType<typeof useTemplate>, { status: 'ready' }>).template;
};

describe('FR-2.1 the Plans tab lists the built-in templates', () => {
  it('shows each template with its length and sessions a week (DESIGN §7.4)', async () => {
    const view = await plans();
    expect(view.templates).toEqual([
      { id: 'tpl_beginner_hypertrophy', name: 'Beginner Hypertrophy', summary: '13 wk · 3/wk' },
      { id: 'tpl_beginner_strength', name: 'Beginner Strength', summary: '13 wk · 3/wk' },
    ]);
  });

  it('has no active plan and no my-plans rows on a fresh install', async () => {
    const view = await plans();
    expect(view.active).toBeNull();
    expect(view.myPlans).toEqual([]);
  });
});

describe('FR-7.8 the active plan card', () => {
  it('shows the plan name, its week and its ribbon', async () => {
    await startBeginnerStrength();
    const view = await plans();
    expect(view.active).toMatchObject({
      name: 'Beginner Strength',
      header: 'Week 1 of 13',
      currentWeek: 1,
    });
    expect(view.active?.ribbon).toEqual([
      { name: 'Block 1', type: 'training', weeks: 6 },
      { name: 'Deload', type: 'deload', weeks: 1 },
      { name: 'Block 2', type: 'training', weeks: 6 },
    ]);
  });

  it('lists a draft under my plans, not as the active plan', async () => {
    const created = await createPlanFromTemplate(
      db,
      { templateId: 'tpl_beginner_hypertrophy' },
      ctx(),
    );
    if (!created.ok) throw new Error(created.reason);

    const view = await plans();
    expect(view.active).toBeNull();
    expect(view.myPlans).toEqual([
      {
        id: created.planId,
        name: 'Beginner Hypertrophy',
        status: 'draft',
        subtitle: 'Draft · 13 weeks',
      },
    ]);
  });
});

describe('FR-2.2 template detail', () => {
  it('shows the name, description, length and sessions a week', async () => {
    const t = await template('tpl_beginner_strength');
    expect(t).toMatchObject({
      name: 'Beginner Strength',
      summary: '13 weeks · 3 sessions a week',
    });
    expect(t?.description).toContain('five sets of five');
  });

  it('shows each phase with its length, cycle length and increase rule in plain words', async () => {
    const t = await template('tpl_beginner_strength');
    expect(t?.phases).toEqual([
      {
        name: 'Block 1',
        type: 'training',
        length: '6 weeks · 2-week cycle',
        increase: '+2.5 kg each cycle',
      },
      { name: 'Deload', type: 'deload', length: '1 week · 1-week cycle', increase: 'No review' },
      {
        name: 'Block 2',
        type: 'training',
        length: '6 weeks · 2-week cycle',
        increase: '+2.5 kg each cycle',
      },
    ]);
  });

  it('previews both cycle weeks, on their pinned days', async () => {
    const t = await template('tpl_beginner_strength');
    expect(t?.cycleWeeks.map((w) => w.label)).toEqual(['Week A', 'Week B']);
    expect(t?.cycleWeeks[0]?.workouts.map((w) => [w.day, w.name])).toEqual([
      ['Monday', 'Full body A'],
      ['Wednesday', 'Full body B'],
      ['Friday', 'Full body A'],
    ]);
    expect(t?.cycleWeeks[1]?.workouts.map((w) => [w.day, w.name])).toEqual([
      ['Monday', 'Full body B'],
      ['Wednesday', 'Full body A'],
      ['Friday', 'Full body B'],
    ]);
  });

  it('shows the exercises, with no load until Plan setup supplies a 1RM (FR-3.3)', async () => {
    const t = await template('tpl_beginner_strength');
    const monday = t?.cycleWeeks[0]?.workouts[0];
    expect(monday?.rows.map((r) => [r.name, r.sets])).toEqual([
      ['Back squat', 5],
      ['Bench press', 5],
      ['Barbell row', 3],
      ['Plank', 3],
    ]);
    // No 1RM yet, so the %-based rows have no load to show; the plank is tracked by time, so it
    // never has one.
    expect(monday?.rows.map((r) => r.load)).toEqual([null, null, null, null]);
    // The prescription itself is there: 5 x 5 at RPE 7-8 (FR-2.1).
    expect(monday?.rows[0]).toMatchObject({ target: { reps: [5] }, rpe: { min: 7, max: 8 } });
  });

  it('returns null for an unknown template', async () => {
    expect(await template('nope')).toBeNull();
  });
});

describe('FR-2.2 increase rules in plain words', () => {
  const phase = (over: Record<string, unknown>) =>
    ({
      reviewMode: 'every_cycle',
      defaultIncreaseType: 'percent',
      defaultIncreaseValue: 0.025,
      defaultIncreaseValueLb: null,
      ...over,
    }) as never;

  it.each`
    rule                                                                                      | unit    | text
    ${{ defaultIncreaseType: 'percent', defaultIncreaseValue: 0.025 }}                        | ${'kg'} | ${'+2.5% each cycle'}
    ${{ defaultIncreaseType: 'fixed', defaultIncreaseValue: 2.5, defaultIncreaseValueLb: 5 }} | ${'kg'} | ${'+2.5 kg each cycle'}
    ${{ defaultIncreaseType: 'fixed', defaultIncreaseValue: 2.5, defaultIncreaseValueLb: 5 }} | ${'lb'} | ${'+5 lb each cycle'}
    ${{ defaultIncreaseType: 'estimated' }}                                                   | ${'kg'} | ${'Estimated from your top sets'}
    ${{ defaultIncreaseType: 'none' }}                                                        | ${'kg'} | ${'No increase suggested'}
    ${{ reviewMode: 'none' }}                                                                 | ${'kg'} | ${'No review'}
  `('reads "$text"', ({ rule, unit, text }) => {
    expect(increaseRuleText(phase(rule), unit)).toBe(text);
  });
});
