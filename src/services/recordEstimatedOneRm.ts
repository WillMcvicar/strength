// Record a confirmed setup estimate (FR-3.3a step 5, DESIGN §8.1). One exclusive transaction.
//
// The user confirms or edits the number the test set produced, so what is stored is their answer,
// not the raw estimate; the source still says where it came from. The draft's `plan_skill` row is
// updated too, so Plan setup shows the confirmed value and `startPlan` writes no second row (C-13).
import type { Db } from '@/data/db';
import { repositories } from '@/data/repositories';

import { exclusive, type ServiceContext, type ServiceResult } from './context';

export interface RecordEstimatedOneRmInput {
  planId: string;
  skillId: string;
  /** The value the user confirmed, which may differ from the raw estimate. */
  oneRmKg: number;
}

export type RecordEstimatedOneRmError = 'not_found' | 'not_draft' | 'bad_one_rm' | 'not_in_plan';

export type RecordEstimatedOneRmResult = ServiceResult<RecordEstimatedOneRmError>;

export function recordEstimatedOneRm(
  db: Db,
  input: RecordEstimatedOneRmInput,
  ctx: ServiceContext,
): Promise<RecordEstimatedOneRmResult> {
  return exclusive(db, async (tx) => {
    if (!(input.oneRmKg > 0)) return { ok: false, reason: 'bad_one_rm' };

    const r = repositories(tx);
    const plan = await r.plans.get(input.planId);
    if (!plan) return { ok: false, reason: 'not_found' };
    // FR-3.3b: 1RMs are editable until the plan's first session is logged. Setup runs on a draft.
    if (plan.status !== 'draft') return { ok: false, reason: 'not_draft' };

    const planSkill = (await r.plans.skills(plan.id)).find((ps) => ps.skillId === input.skillId);
    if (!planSkill) return { ok: false, reason: 'not_in_plan' };

    await r.oneRepMax.insert({
      id: ctx.newId(),
      skillId: input.skillId,
      oneRmKg: input.oneRmKg,
      source: 'setup_estimate',
      planId: plan.id,
      effectiveFromWeekIndex: 1,
      cycleReviewId: null,
      // TODO(Slice 6): FR-3.3a saves the test set as an ad-hoc session tagged "1RM estimate" and
      // links it here. Sessions don't exist yet, so the estimate is recorded without one.
      estimateSessionId: null,
      note: null,
      setAt: ctx.now,
    });
    await r.plans.updateSkill(planSkill.id, { startingOneRmKg: input.oneRmKg });
    return { ok: true };
  });
}
