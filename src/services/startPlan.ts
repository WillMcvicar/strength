// Start a draft plan (DESIGN §8.1, FR-4.2, FR-4.3). This slice covers steps 2, 4 and 6: pin the
// slots, set the start date, generate the schedule and make the plan active.
import { isLocalDate } from '@/core/dates';
import { generatePlannedWorkouts } from '@/core/schedule/generate';
import type { LocalDate } from '@/core/types';
import type { Db } from '@/data/db';
import { repositories } from '@/data/repositories';

import { exclusive, type ServiceContext, type ServiceResult } from './context';

export interface StartPlanInput {
  planId: string;
  startDate: LocalDate;
  /**
   * Weekday (0 Sunday … 6 Saturday) by slot id (DESIGN §7.5: one row per slot). Slots left out
   * keep their stored weekday. A generated deload slot has no row of its own: it takes its
   * source slot's day (D-30). Continuations have no slots, so pinning the original moves them too.
   */
  weekdayPins?: Readonly<Record<string, number>>;
}

export type StartPlanError =
  'not_found' | 'not_draft' | 'plan_already_current' | 'bad_date' | 'bad_pin' | 'empty_schedule';

export type StartPlanResult = ServiceResult<StartPlanError, { plannedCount: number }>;

export function startPlan(
  db: Db,
  input: StartPlanInput,
  ctx: ServiceContext,
): Promise<StartPlanResult> {
  return exclusive(db, (tx) => startPlanTx(tx, input, ctx));
}

/** The body of `startPlan`, for a caller that already holds the exclusive transaction. */
export async function startPlanTx(
  tx: Db,
  input: StartPlanInput,
  ctx: ServiceContext,
): Promise<StartPlanResult> {
  if (!isLocalDate(input.startDate)) return { ok: false, reason: 'bad_date' };
  const r = repositories(tx);
  const plan = await r.plans.get(input.planId);
  if (!plan) return { ok: false, reason: 'not_found' };
  if (plan.status !== 'draft') return { ok: false, reason: 'not_draft' };
  // TODO(end-plan slice): §8.1 step 1 ends the current plan once the user confirms (FR-4.1,
  // §8.6). Until endPlan exists, starting a second plan is refused.
  if (await r.plans.current()) return { ok: false, reason: 'plan_already_current' };

  // Step 2: pin the slots. Everything is validated and generated before the first write.
  // Two workouts pinned to one day are allowed here: setup warns about it (DESIGN §7.5).
  const slots = await r.blueprints.slotsOfPlan(plan.id);
  const pins = Object.entries(input.weekdayPins ?? {});
  const valid = pins.every(
    ([slotId, weekday]) =>
      slots.some((s) => s.id === slotId && s.sourceCycleSlotId === null) &&
      Number.isInteger(weekday) &&
      weekday >= 0 &&
      weekday <= 6,
  );
  if (!valid) return { ok: false, reason: 'bad_pin' };
  const dayOf = new Map(slots.map((s) => [s.id, input.weekdayPins?.[s.id] ?? s.weekday]));
  // D-30: a deload copy takes its source slot's day. Once its source is gone it keeps its own.
  const pinned = slots.map((s) => ({
    ...s,
    weekday: dayOf.get(s.sourceCycleSlotId ?? s.id) ?? s.weekday,
  }));

  // Step 4: generate the schedule (FR-4.3).
  const phases = await r.blueprints.phasesOfPlan(plan.id);
  const planned = generatePlannedWorkouts(
    { planId: plan.id, startDate: input.startDate, phases, slots: pinned },
    ctx.newId,
  );
  if (planned.length === 0) return { ok: false, reason: 'empty_schedule' };

  for (const s of pinned) {
    if (s.weekday !== slots.find((o) => o.id === s.id)!.weekday) {
      await r.blueprints.updateSlot(s.id, { weekday: s.weekday });
    }
  }
  // TODO(1RM setup slice): §8.1 step 3 — starting 1RMs and 'plan_setup' history rows (C-13),
  // and the §4.4 rule that every %-based skill needs a starting 1RM before activation (FR-3.3).
  await r.plannedWorkouts.insertMany(planned);
  // TODO(double-progression slice): §8.1 step 5 — create double_progression_state rows.

  // Step 6.
  await r.plans.update(plan.id, {
    startDate: input.startDate,
    status: 'active',
    updatedAt: ctx.now,
  });
  // TODO(reviews slice): finish with reconcile(ctx.today) once it exists (DESIGN §2.5).

  return { ok: true, plannedCount: planned.length };
}
