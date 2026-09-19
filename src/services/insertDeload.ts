// Insert a deload into a draft plan (FR-2.12, FR-2.11, D-1, D-23; DESIGN §3.9).
import {
  DELOAD_DEFAULTS,
  generateDeload,
  planDraftDeloadInsert,
  type DeloadInsertRejection,
} from '@/core/deload';
import type { Db } from '@/data/db';
import { repositories } from '@/data/repositories';

import { exclusive, type ServiceContext, type ServiceResult } from './context';

export interface InsertDeloadInput {
  planId: string;
  /** The deload starts after this plan week. */
  afterWeek: number;
  /** 1 or 2 weeks; 1 by default (FR-2.12). */
  lengthWeeks?: number;
}

export type InsertDeloadError = 'not_found' | 'not_draft' | DeloadInsertRejection;

export type InsertDeloadResult = ServiceResult<
  InsertDeloadError,
  { deloadPhaseId: string; continuationPhaseId: string | null }
>;

// No reconcile: drafts have no planned workouts, and reconcile skips them (DESIGN §2.5).
export function insertDeload(
  db: Db,
  input: InsertDeloadInput,
  ctx: ServiceContext,
): Promise<InsertDeloadResult> {
  return exclusive(db, (tx) => insertDeloadTx(tx, input, ctx));
}

/** The body of `insertDeload`, for a caller that already holds the exclusive transaction. */
export async function insertDeloadTx(
  tx: Db,
  input: InsertDeloadInput,
  ctx: ServiceContext,
): Promise<InsertDeloadResult> {
  const r = repositories(tx);
  const plan = await r.plans.get(input.planId);
  if (!plan) return { ok: false, reason: 'not_found' };
  // D-23: an active plan needs "Deload now"'s shift, renumbering and D-2 recalculation, which
  // arrive in v1.1 behind `activeDeloadInsert`. This draft-only path never does that.
  if (plan.status !== 'draft') return { ok: false, reason: 'not_draft' };

  const phases = await r.blueprints.phasesOfPlan(plan.id);
  const planned = planDraftDeloadInsert(
    phases,
    input.afterWeek,
    input.lengthWeeks ?? DELOAD_DEFAULTS.lengthWeeks,
    ctx.newId,
  );
  if (!planned.ok) return planned;

  // The phase was just found by id, so its blueprint exists.
  const source = (await r.blueprints.loadBlueprint(planned.sourcePhaseId))!;
  const content = generateDeload(
    {
      workouts: source.workouts.map((w) => w.workout),
      slots: source.slots,
      exercises: source.workouts.flatMap((w) => w.exercises.map((e) => e.exercise)),
      sets: source.workouts.flatMap((w) => w.exercises.flatMap((e) => e.sets)),
    },
    planned.deload.id,
    // The stored phase's factors, so the phase row and its generated sets can't disagree.
    { volumeFactor: planned.deload.volumeFactor!, rpeCap: planned.deload.rpeCap! },
    ctx.newId,
  );

  for (const { id, patch } of planned.updates) await r.blueprints.updatePhase(id, patch);
  await r.blueprints.insertPhase(planned.deload);
  if (planned.continuation) await r.blueprints.insertPhase(planned.continuation);
  for (const w of content.workouts) await r.blueprints.insertWorkout(w);
  for (const s of content.slots) await r.blueprints.insertSlot(s);
  for (const e of content.exercises) await r.blueprints.insertExercise(e);
  for (const s of content.sets) await r.blueprints.insertSet(s);
  await r.plans.update(plan.id, { updatedAt: ctx.now });

  return {
    ok: true,
    deloadPhaseId: planned.deload.id,
    continuationPhaseId: planned.continuation?.id ?? null,
  };
}
