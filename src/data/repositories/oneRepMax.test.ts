// 1RM history (SRS §4, DESIGN §3.3): the rows a plan's cycles resolve their 1RM from (C-9).
import type { OneRepMaxHistory } from '@/core/types';
import type { Db } from '@/data/db';
import { repositories } from '@/data/repositories';

import { openMigratedTestDb } from '../../../test/db/betterSqlite3';
import { aPlan } from '../../../test/fixtures/plans';

let db: Db;

const row = (id: string, over: Partial<OneRepMaxHistory> = {}): OneRepMaxHistory => ({
  id,
  skillId: 'skill_back_squat',
  oneRmKg: 100,
  source: 'plan_setup',
  planId: 'plan',
  effectiveFromWeekIndex: 1,
  cycleReviewId: null,
  estimateSessionId: null,
  note: null,
  setAt: '2026-09-14T08:00:00.000Z',
  ...over,
});

beforeEach(async () => {
  db = await openMigratedTestDb();
  await aPlan('plan').build(db);
  await aPlan('other').build(db);
});

afterEach(async () => {
  await db.closeAsync();
});

describe('oneRepMax repository', () => {
  it("lists a plan's rows only, in skill then set_at order", async () => {
    const r = repositories(db).oneRepMax;
    await r.insert(row('b', { skillId: 'skill_bench_press', oneRmKg: 80 }));
    await r.insert(
      row('a2', { oneRmKg: 105, effectiveFromWeekIndex: 3, setAt: '2026-09-27T10:00:00.000Z' }),
    );
    await r.insert(row('a1'));
    await r.insert(row('elsewhere', { planId: 'other' }));
    await r.insert(row('between_plans', { planId: null, source: 'manual' }));

    expect((await r.listByPlan('plan')).map((x) => x.id)).toEqual(['a1', 'a2', 'b']);
    expect(await r.listByPlan('plan')).toContainEqual(row('a1'));
  });
});

describe('skills.getMany', () => {
  it('returns the skills asked for, and nothing for unknown ids', async () => {
    const skills = await repositories(db).skills.getMany([
      'skill_bench_press',
      'skill_back_squat',
      'no_such_skill',
    ]);
    expect(skills.map((s) => s.id).sort()).toEqual(['skill_back_squat', 'skill_bench_press']);
  });

  it('returns nothing for no ids', async () => {
    expect(await repositories(db).skills.getMany([])).toEqual([]);
  });
});
