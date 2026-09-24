// The development-only reset (docs/BUILD_PLAN.md Slice 5): back to a fresh install.
import type { Db } from '@/data/db';
import { repositories } from '@/data/repositories';
import { SEED_TEMPLATES } from '@/data/seed/templates';
import { SEED_SKILLS } from '@/data/seed/skills';

import { openMigratedTestDb } from '../../../test/db/betterSqlite3';
import { count } from '../../../test/db/rows';
import { idSequence } from '../../../test/fixtures/ids';
import { acknowledgeDisclaimer } from '../acknowledgeDisclaimer';
import { completeOnboarding } from '../completeOnboarding';
import type { ServiceContext } from '../context';
import { createPlanFromTemplate } from '../createPlanFromTemplate';
import { startPlan } from '../startPlan';
import { resetAppData } from './resetAppData';

const ONE_RMS = {
  skill_back_squat: 110,
  skill_bench_press: 90,
  skill_deadlift: 140,
  skill_overhead_press: 55,
};

let db: Db;
let ctx: ServiceContext;

beforeEach(async () => {
  db = await openMigratedTestDb();
  ctx = { today: '2026-09-16', now: '2026-09-16T09:00:00.000Z', newId: idSequence() };
});

afterEach(async () => {
  await db.closeAsync();
});

/** A phone that has been through onboarding and started a plan. */
async function useTheApp(): Promise<void> {
  await acknowledgeDisclaimer(db, ctx);
  await completeOnboarding(db, 'lb', ctx);
  const created = await createPlanFromTemplate(db, { templateId: 'tpl_beginner_strength' }, ctx);
  if (!created.ok) throw new Error(created.reason);
  const started = await startPlan(
    db,
    { planId: created.planId, startDate: '2026-09-21', oneRms: ONE_RMS },
    ctx,
  );
  if (!started.ok) throw new Error(started.reason);
}

describe('resetAppData (dev only)', () => {
  it('clears the plan, its schedule and its 1RM history', async () => {
    await useTheApp();
    expect(await count(db, 'planned_workout')).toBe(39);

    expect(await resetAppData(db)).toEqual({ ok: true });

    for (const table of ['plan', 'plan_skill', 'planned_workout', 'one_rep_max_history']) {
      expect([table, await count(db, table)]).toEqual([table, 0]);
    }
    expect(await repositories(db).plans.current()).toBeNull();
  });

  it('§7.1 puts the launch rules back, so first launch runs again', async () => {
    await useTheApp();
    await resetAppData(db);

    expect(await repositories(db).settings.get()).toMatchObject({
      disclaimerAckAt: null,
      onboardingCompletedAt: null,
      unit: 'kg',
    });
  });

  it('keeps the seeded skills and templates, as a fresh install has them (§4.6)', async () => {
    await useTheApp();
    await resetAppData(db);

    const r = repositories(db);
    expect(await r.skills.search({ includeArchived: true })).toHaveLength(SEED_SKILLS.length);
    expect(await r.templates.list()).toHaveLength(SEED_TEMPLATES.length);
    // The templates keep their blueprint, so a plan can be started straight away.
    expect(await r.blueprints.phasesOfTemplate('tpl_beginner_strength')).toHaveLength(3);
    expect(await r.appMeta.get('seed_version')).not.toBeNull();
  });

  it('removes custom skills but not built-in ones', async () => {
    const { skills } = repositories(db);
    await skills.insert({ ...(await skills.get('skill_plank'))!, id: 'mine', isCustom: true });
    await resetAppData(db);

    expect(await skills.get('mine')).toBeNull();
    expect(await skills.get('skill_plank')).not.toBeNull();
  });

  it('is safe to run on an untouched install', async () => {
    expect(await resetAppData(db)).toEqual({ ok: true });
    expect(await count(db, 'settings')).toBe(1);
    expect(await repositories(db).templates.list()).toHaveLength(SEED_TEMPLATES.length);
  });

  it('leaves a working database: the app can be set up again afterwards', async () => {
    await useTheApp();
    await resetAppData(db);
    await useTheApp();

    expect(await count(db, 'planned_workout')).toBe(39);
    expect((await repositories(db).plans.current())?.name).toBe('Beginner Strength');
  });
});
