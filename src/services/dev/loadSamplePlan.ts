// Development mode only (`__DEV__`, including Expo Go; docs/BUILD_PLAN.md Slice 4): the Beginner
// Strength template, started on this week's Monday with stock 1RMs, so Today can be checked on a
// device without going through Plan setup. The Today screen offers it only when `__DEV__` is
// true, so release builds never call it.
import { addDays, weekday } from '@/core/dates';
import type { Db } from '@/data/db';
import { repositories } from '@/data/repositories';

import { exclusive, type ServiceContext, type ServiceResult } from '../context';
import { createPlanFromTemplateTx } from '../createPlanFromTemplate';
import { startPlanTx } from '../startPlan';

const TEMPLATE_ID = 'tpl_beginner_strength';

const ONE_RMS: Readonly<Record<string, number>> = {
  skill_back_squat: 100,
  skill_bench_press: 80,
  skill_deadlift: 140,
  skill_overhead_press: 50,
};

export type LoadSamplePlanResult = ServiceResult<'plan_already_current'>;

export function loadSamplePlan(db: Db, ctx: ServiceContext): Promise<LoadSamplePlanResult> {
  return exclusive(db, async (tx) => {
    // Checked before anything is written, so a refusal leaves no stray draft behind (FR-4.1).
    if (await repositories(tx).plans.current()) {
      return { ok: false, reason: 'plan_already_current' };
    }

    const created = await createPlanFromTemplateTx(
      tx,
      { templateId: TEMPLATE_ID, name: 'Sample: Beginner Strength' },
      ctx,
    );
    if (!created.ok) throw new Error(`Sample plan wasn't created: ${created.reason}`);

    const monday = addDays(ctx.today, -((weekday(ctx.today) + 6) % 7));
    const started = await startPlanTx(
      tx,
      { planId: created.planId, startDate: monday, oneRms: ONE_RMS },
      ctx,
    );
    if (!started.ok) throw new Error(`Sample plan didn't start: ${started.reason}`);
    return { ok: true };
  });
}
