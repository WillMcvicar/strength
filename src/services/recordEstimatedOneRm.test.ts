// Recording a confirmed setup estimate (FR-3.3a, FR-3.3b, C-13, DESIGN §8.1).
import type { Db } from '@/data/db';
import { repositories, type Repositories } from '@/data/repositories';

import { openMigratedTestDb } from '../../test/db/betterSqlite3';
import { count } from '../../test/db/rows';
import { idSequence } from '../../test/fixtures/ids';
import type { ServiceContext } from './context';
import { createPlanFromTemplate } from './createPlanFromTemplate';
import { recordEstimatedOneRm } from './recordEstimatedOneRm';
import { startPlan } from './startPlan';

const ONE_RMS = {
  skill_back_squat: 110,
  skill_bench_press: 90,
  skill_deadlift: 140,
  skill_overhead_press: 55,
};

let db: Db;
let repos: Repositories;
let ctx: ServiceContext;

beforeEach(async () => {
  db = await openMigratedTestDb();
  repos = repositories(db);
  ctx = { today: '2026-09-16', now: '2026-09-16T09:00:00.000Z', newId: idSequence() };
});

afterEach(async () => {
  await db.closeAsync();
});

const draft = async (): Promise<string> => {
  const created = await createPlanFromTemplate(db, { templateId: 'tpl_beginner_strength' }, ctx);
  if (!created.ok) throw new Error(created.reason);
  return created.planId;
};

describe('FR-3.3a the confirmed estimate', () => {
  it('writes a setup_estimate row and pre-fills the plan skill', async () => {
    const planId = await draft();
    expect(
      await recordEstimatedOneRm(db, { planId, skillId: 'skill_back_squat', oneRmKg: 117.5 }, ctx),
    ).toEqual({ ok: true });

    const rows = await repos.oneRepMax.listByPlan(planId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      skillId: 'skill_back_squat',
      oneRmKg: 117.5,
      source: 'setup_estimate',
      planId,
      effectiveFromWeekIndex: 1,
      estimateSessionId: null,
      setAt: ctx.now,
    });

    const planSkill = (await repos.plans.skills(planId)).find(
      (ps) => ps.skillId === 'skill_back_squat',
    );
    expect(planSkill?.startingOneRmKg).toBe(117.5);
  });

  it('stores the value the user confirmed, even when they edited the estimate', async () => {
    const planId = await draft();
    await recordEstimatedOneRm(db, { planId, skillId: 'skill_back_squat', oneRmKg: 120 }, ctx);
    expect((await repos.oneRepMax.listByPlan(planId))[0]?.oneRmKg).toBe(120);
  });

  it('C-13: startPlan adds no second row for a skill the estimate already set', async () => {
    const planId = await draft();
    await recordEstimatedOneRm(db, { planId, skillId: 'skill_back_squat', oneRmKg: 110 }, ctx);

    const started = await startPlan(db, { planId, startDate: '2026-09-21', oneRms: ONE_RMS }, ctx);
    expect(started.ok).toBe(true);

    const rows = await repos.oneRepMax.listByPlan(planId);
    expect(rows.filter((r) => r.skillId === 'skill_back_squat')).toEqual([
      expect.objectContaining({ source: 'setup_estimate', oneRmKg: 110 }),
    ]);
    // The other three had no value before setup, so each gets one plan_setup row.
    expect(rows.filter((r) => r.source === 'plan_setup')).toHaveLength(3);
  });

  it('a later edit in setup does write a plan_setup row (C-13)', async () => {
    const planId = await draft();
    await recordEstimatedOneRm(db, { planId, skillId: 'skill_back_squat', oneRmKg: 110 }, ctx);
    await startPlan(
      db,
      { planId, startDate: '2026-09-21', oneRms: { ...ONE_RMS, skill_back_squat: 115 } },
      ctx,
    );

    const squat = (await repos.oneRepMax.listByPlan(planId)).filter(
      (r) => r.skillId === 'skill_back_squat',
    );
    expect(squat.map((r) => [r.source, r.oneRmKg])).toEqual([
      ['setup_estimate', 110],
      ['plan_setup', 115],
    ]);
  });
});

describe('FR-3.3a rejections, which write nothing', () => {
  it.each([0, -5])('refuses a 1RM of %s', async (oneRmKg) => {
    const planId = await draft();
    expect(
      await recordEstimatedOneRm(db, { planId, skillId: 'skill_back_squat', oneRmKg }, ctx),
    ).toEqual({ ok: false, reason: 'bad_one_rm' });
    expect(await count(db, 'one_rep_max_history')).toBe(0);
  });

  it('refuses an unknown plan and a skill the plan has no row for', async () => {
    const planId = await draft();
    expect(
      await recordEstimatedOneRm(
        db,
        { planId: 'nope', skillId: 'skill_back_squat', oneRmKg: 110 },
        ctx,
      ),
    ).toEqual({ ok: false, reason: 'not_found' });
    expect(
      await recordEstimatedOneRm(db, { planId, skillId: 'skill_plank', oneRmKg: 110 }, ctx),
    ).toEqual({ ok: false, reason: 'not_in_plan' });
    expect(await count(db, 'one_rep_max_history')).toBe(0);
  });

  it('FR-3.3b refuses once the plan has started', async () => {
    const planId = await draft();
    await startPlan(db, { planId, startDate: '2026-09-21', oneRms: ONE_RMS }, ctx);
    expect(
      await recordEstimatedOneRm(db, { planId, skillId: 'skill_back_squat', oneRmKg: 120 }, ctx),
    ).toEqual({ ok: false, reason: 'not_draft' });
  });
});
